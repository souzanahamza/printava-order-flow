import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string | null;
}

export interface ExchangeRate {
  id: string;
  company_id: string;
  currency_id: string;
  rate_to_company_currency: number;
  valid_from: string;
  is_active: boolean;
  currency?: Currency;
}

export function useCurrencies() {
  return useQuery({
    queryKey: ["currencies"],
    queryFn: async () => {
      // Use raw query since table isn't in generated types yet
      const { data, error } = await (supabase as any)
        .from("currencies")
        .select("*")
        .order("code");
      if (error) throw error;
      return (data || []) as Currency[];
    },
  });
}

export function useExchangeRates() {
  const { companyId } = useUserRole();

  return useQuery({
    queryKey: ["exchange-rates", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await (supabase as any)
        .from("exchange_rates")
        .select(`
          *,
          currency:currencies(*)
        `)
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("valid_from", { ascending: false });
      if (error) throw error;
      return (data || []) as ExchangeRate[];
    },
    enabled: !!companyId,
  });
}

export interface CompanyCurrency {
  currency_id: string;
  base_currency: {
    code: string;
    symbol: string | null;
  };
}

export function useCompanyCurrency() {
  const { companyId } = useUserRole();

  return useQuery({
    queryKey: ["company-currency", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      // Fetch currency_id and join with currencies table
      const { data, error } = await (supabase as any)
        .from("companies")
        .select("currency_id, base_currency:currencies(code, symbol)")
        .eq("id", companyId)
        .single();
      if (error) throw error;
      return data as CompanyCurrency;
    },
    enabled: !!companyId,
  });
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PricingTier {
  id: string;
  name: string;
  label: string | null;
  markup_percent: number;
  is_default: boolean | null;
  company_id: string | null;
}

export function usePricingTiers() {
  return useQuery({
    queryKey: ["pricingTiers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pricing_tiers")
        .select("*")
        .order("name", { ascending: true });
      
      if (error) throw error;
      return data as PricingTier[];
    },
  });
}

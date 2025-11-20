import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OrderStatus {
  id: string;
  name: string;
  sort_order: number;
  color: string;
  company_id: string | null;
}

export function useOrderStatuses() {
  return useQuery({
    queryKey: ["orderStatuses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_statuses")
        .select("*")
        .order("sort_order", { ascending: true });
      
      if (error) throw error;
      return data as OrderStatus[];
    },
  });
}

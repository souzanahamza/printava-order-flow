import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

export interface TaskStatus {
  id: string;
  name: string;
  sort_order: number;
  color: string | null;
  company_id: string | null;
  created_at?: string | null;
}

/**
 * Task status labels/colors from `task_statuses`.
 * Returns global rows (company_id null) plus any rows for the current company, sorted by sort_order.
 */
export function useTaskStatuses() {
  const { companyId } = useUserRole();

  return useQuery({
    queryKey: ["taskStatuses", companyId],
    queryFn: async () => {
      let query = supabase.from("task_statuses").select("*");

      if (companyId) {
        query = query.or(`company_id.is.null,company_id.eq.${companyId}`);
      } else {
        query = query.is("company_id", null);
      }

      const { data, error } = await query.order("sort_order", { ascending: true });

      if (error) throw error;
      return data as TaskStatus[];
    },
  });
}

/** Resolve hex color for a task status name; fallback when missing or null color. */
export function getTaskStatusColor(
  statusName: string,
  statuses: TaskStatus[] | undefined,
  fallback = "#64748b"
): string {
  const row = statuses?.find((s) => s.name === statusName);
  const c = row?.color?.trim();
  return c && c.length > 0 ? c : fallback;
}

import type { Enums } from "@/integrations/supabase/types";

export type AppRole = Enums<"app_role">;

export interface RoleOption {
  role: AppRole;
  label: string;
  description: string;
  badgeClassName: string;
}

export const ROLE_OPTIONS: RoleOption[] = [
  {
    role: "admin",
    label: "Admin",
    description: "Full access to settings, users, and company-wide controls.",
    badgeClassName:
      "border-red-300 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
  },
  {
    role: "sales",
    label: "Sales",
    description: "Manage clients, quotations, and order creation.",
    badgeClassName:
      "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
  },
  {
    role: "designer",
    label: "Designer",
    description: "Handle artwork preparation and design approvals.",
    badgeClassName:
      "border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-300",
  },
  {
    role: "production",
    label: "Production",
    description: "Execute production tasks and workflow completion.",
    badgeClassName:
      "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
  }
];

export function formatRoleLabel(role: string): string {
  const mapped = ROLE_OPTIONS.find((option) => option.role === role);
  if (mapped) return mapped.label;
  return role.charAt(0).toUpperCase() + role.slice(1);
}

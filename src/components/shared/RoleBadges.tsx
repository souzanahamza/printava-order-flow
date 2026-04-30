import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ROLE_OPTIONS, formatRoleLabel } from "@/features/settings/types/teamRoles";
import { cn } from "@/lib/utils";

export interface RoleBadgesProps {
  roles: readonly string[];
  /** Distinct prefix for React keys (e.g. member id). */
  keyPrefix?: string;
  className?: string;
  badgeClassName?: string;
  /** Rendered when `roles` is empty (default: nothing). */
  empty?: ReactNode;
}

export function RoleBadges({
  roles,
  keyPrefix = "role",
  className,
  badgeClassName,
  empty = null,
}: RoleBadgesProps) {
  if (!roles.length) {
    return <>{empty}</>;
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {roles.map((role) => {
        const option = ROLE_OPTIONS.find((o) => o.role === role);
        return (
          <Badge
            key={`${keyPrefix}-${role}`}
            variant="outline"
            className={cn(
              "font-medium",
              option?.badgeClassName ?? "border-border bg-muted/30 text-foreground",
              badgeClassName
            )}
          >
            {formatRoleLabel(role)}
          </Badge>
        );
      })}
    </div>
  );
}

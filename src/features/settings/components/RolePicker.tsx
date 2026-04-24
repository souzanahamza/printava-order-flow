import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ROLE_OPTIONS, type AppRole } from "@/features/settings/types/teamRoles";
import { cn } from "@/lib/utils";

interface RolePickerProps {
  idPrefix: string;
  value: AppRole[];
  onChange: (next: AppRole[]) => void;
  disabledRoles?: AppRole[];
}

export function RolePicker({ idPrefix, value, onChange, disabledRoles = [] }: RolePickerProps) {
  const toggleRole = (role: AppRole) => {
    const exists = value.includes(role);
    if (exists) {
      onChange(value.filter((currentRole) => currentRole !== role));
      return;
    }

    onChange([...value, role]);
  };

  return (
    <div className="space-y-3">
      <Label>Roles</Label>
      <p className="text-sm text-muted-foreground">
        Users can hold multiple roles; at least one role is required.
      </p>
      <div className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-2">
        {ROLE_OPTIONS.map((option) => {
          const inputId = `${idPrefix}-${option.role}`;
          const isDisabled = disabledRoles.includes(option.role);
          return (
            <label
              key={option.role}
              htmlFor={inputId}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
                "hover:bg-muted/40",
                isDisabled && "cursor-not-allowed opacity-60"
              )}
            >
              <Checkbox
                id={inputId}
                checked={value.includes(option.role)}
                disabled={isDisabled}
                onCheckedChange={() => toggleRole(option.role)}
              />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">{option.label}</p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

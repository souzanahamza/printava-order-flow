import { Bell, LogOut, Settings } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { RoleBadges } from "@/components/shared/RoleBadges";

function accountInitials(user: User | null, profileFullName: string | null): string {
  if (!user) return "?";
  const fullName =
    profileFullName?.trim() ||
    (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "");
  if (fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return fullName.slice(0, 2).toUpperCase();
  }
  const email = user.email ?? "";
  return email.slice(0, 2).toUpperCase();
}

export function Navbar() {
  const { user, signOut } = useAuth();
  const { companyId, isAdmin, fullName, roles, companyName: profileCompanyName, loading: roleLoading } =
    useUserRole();
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState<string | null>(null);

  useEffect(() => {
    if (companyId) {
      supabase
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .single()
        .then(({ data }) => {
          if (data?.name) {
            setCompanyName(data.name);
          }
        });
    }
  }, [companyId]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card">
      <div className="flex h-16 items-center px-4 gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-foreground">
            {companyName}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Bell className="h-5 w-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar>
                  <AvatarFallback className="bg-primary text-xs font-medium text-primary-foreground">
                    {accountInitials(user, fullName)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 min-w-[14rem] max-w-[18rem]">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-1.5">
                  <p className="truncate text-sm font-semibold leading-tight" title={fullName ?? undefined}>
                    {fullName?.trim() || user?.email?.split("@")[0] || "My account"}
                  </p>
                  {user?.email ? (
                    <p
                      className="truncate text-xs leading-snug text-muted-foreground"
                      title={user.email}
                    >
                      {user.email}
                    </p>
                  ) : null}
                  {profileCompanyName ? (
                    <div className="pt-0.5">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/80">
                        Organization
                      </p>
                      <p className="truncate text-xs text-muted-foreground" title={profileCompanyName}>
                        {profileCompanyName}
                      </p>
                    </div>
                  ) : null}
                  {roleLoading ? (
                    <p className="text-xs text-muted-foreground/70">Loading roles…</p>
                  ) : (
                    <RoleBadges
                      roles={roles}
                      keyPrefix={user?.id ?? "nav"}
                      className="pt-0.5"
                      badgeClassName="text-[10px] font-semibold leading-tight"
                    />
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isAdmin ? (
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
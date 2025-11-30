import {
  LayoutDashboard,
  ShoppingCart,
  Plus,
  Package,
  CheckSquare,
  Factory,
  Truck,
  Users,
  Settings,
  DollarSign,
  UserCircle,
  Cog
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import printavaLogo from "@/assets/printava-logo.png";
import { Skeleton } from "@/components/ui/skeleton";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: ['admin', 'sales', 'designer', 'accountant'] },
  { title: "Orders", url: "/orders", icon: ShoppingCart, roles: ['admin', 'sales', 'designer', 'accountant'] },
  { title: "New Order", url: "/new-order", icon: Plus, roles: ['admin', 'sales'] },
  { title: "Clients", url: "/clients", icon: UserCircle, roles: ['admin', 'sales', 'accountant'] },
  { title: "Products", url: "/products", icon: Package, roles: ['admin', 'sales', 'accountant', 'production'] },
  { title: "Production", url: "/production", icon: Factory, roles: ['admin', 'production'] },
];

const adminItems = [
  { title: "Settings", url: "/settings", icon: Cog },
  { title: "Team", url: "/team", icon: Users },
  { title: "Statuses", url: "/settings/statuses", icon: CheckSquare },
  { title: "Pricing", url: "/settings/pricing", icon: DollarSign },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const { fullName, role, companyName, companyId, loading } = useUserRole();
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);

  useEffect(() => {
    if (companyId) {
      supabase
        .from('companies')
        .select('logo_url')
        .eq('id', companyId)
        .single()
        .then(({ data }) => {
          if (data?.logo_url) {
            setCompanyLogo(data.logo_url);
          }
        });
    }
  }, [companyId]);

  const isActive = (path: string) => currentPath === path;

  // Filter items based on user role
  const visibleItems = items.filter(item =>
    !role || item.roles.includes(role)
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent>
        {companyName && (
          <div className="px-4 py-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <img
                src={companyLogo}
                alt="Company Logo"
                className="h-10 w-auto max-w-[120px] object-contain"
              />
              {/* {open && (
                <h2 className="text-lg font-semibold text-foreground truncate">
                  {companyName}
                </h2>
              )} */}
            </div>
          </div>
        )}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {loading ? (
                // Show loading skeletons while role is being fetched
                <>
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <SidebarMenuItem key={i}>
                      <div className="px-2 py-2">
                        <Skeleton className="h-9 w-full" />
                      </div>
                    </SidebarMenuItem>
                  ))}
                </>
              ) : (
                // Show actual menu items once role is loaded
                visibleItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="flex items-center gap-3"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!loading && role === 'admin' && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink
                        to={item.url}
                        className="flex items-center gap-3"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {!loading && (fullName || role) && (
        <SidebarFooter className="border-t border-sidebar-border">
          <div className="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                {fullName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              {open && (
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">
                    {fullName || 'User'}
                  </span>
                  {role && (
                    <span className="text-xs text-muted-foreground capitalize truncate">
                      {role}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}

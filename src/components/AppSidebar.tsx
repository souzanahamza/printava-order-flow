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
  DollarSign
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";

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
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Orders", url: "/orders", icon: ShoppingCart },
  { title: "New Order", url: "/new-order", icon: Plus },
  { title: "Products", url: "/products", icon: Package },
  // { title: "Design Approvals", url: "/design-approvals", icon: CheckSquare },
  // { title: "Production", url: "/production", icon: Factory },
  // { title: "Shipping", url: "/shipping", icon: Truck },
];

const adminItems = [
  { title: "Team", url: "/team", icon: Users },
  { title: "Statuses", url: "/settings/statuses", icon: CheckSquare },
  { title: "Pricing", url: "/settings/pricing", icon: DollarSign },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const { fullName, role, companyName, loading } = useUserRole();

  const isActive = (path: string) => currentPath === path;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent>
        {open && companyName && (
          <div className="px-4 py-4 border-b border-sidebar-border">
            <h2 className="text-lg font-semibold text-foreground truncate">
              {companyName}
            </h2>
          </div>
        )}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
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
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {role === 'admin' && (
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

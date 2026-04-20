import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Clock, CheckCircle, ClipboardCheck, type LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { OrderDetails } from "@/features/orders/components/OrderDetails";
import { OrderCard } from "@/features/orders/components/OrderCard";
import { useOrderStatuses } from "@/hooks/useOrderStatuses";
import { useUserRole } from "@/hooks/useUserRole";

import { AccountantDashboard } from "@/features/dashboard/components/AccountantDashboard";
import { AdminDashboard } from "@/features/dashboard/components/AdminDashboard";
import { DesignerDashboard } from "@/features/designer/components/DesignerDashboard";
type OrderWithDetails = {
  id: string;
  order_number?: number | null;
  client_name: string;
  phone: string | null;
  delivery_date: string;
  status: string;
  total_price: number;
  total_price_foreign?: number | null;
  total_price_company?: number | null;
  exchange_rate?: number | null;
  currencies?: {
    code: string;
    symbol: string | null;
  } | null;
  notes?: string | null;
  pricing_tier?: {
    name: string;
    label: string;
  } | null;
  order_items: Array<{
    product: {
      name_en: string;
    };
  }>;
};

type DashboardStat = {
  title: string;
  value: string;
  icon: LucideIcon;
  change: string;
  /** When set, the whole card navigates here on click (admin / sales workflow). */
  navigateTo?: string;
  cardClassName?: string;
  iconClassName?: string;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const { role, loading: roleLoading, companyId } = useUserRole();

  const { data: statuses } = useOrderStatuses();

  // Fetch company profile for currency
  const { data: companyProfile } = useQuery({
    queryKey: ["company-profile", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("companies")
        .select("currency_id, base_currency:currencies(code, symbol)")
        .eq("id", companyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const currency = companyProfile?.base_currency?.code;

  const { data: pendingDesignApprovals = 0, isLoading: pendingApprovalsLoading } = useQuery({
    queryKey: ["dashboard-pending-design-approvals", companyId],
    enabled: !!companyId && role === "sales",
    queryFn: async () => {
      const { count, error } = await supabase
        .from("order_tasks")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId!)
        .eq("task_type", "design")
        .eq("status", "Design Approval");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const {
    data: allOrders,
    isLoading: isLoadingStats
  } = useQuery({
    queryKey: ["all-orders-stats", companyId],
    enabled: !!companyId && !!role && role !== "admin" && role !== "designer" && role !== "accountant",
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase
        .from("orders")
        .select("id, status, total_price, total_price_company, created_at")
        .eq("company_id", companyId!);
      if (error) throw error;
      return data;
    }
  });
  const {
    data: recentOrders,
    isLoading: isLoadingRecent
  } = useQuery({
    queryKey: ["recent-orders", companyId],
    enabled: !!companyId && !!role && role !== "admin" && role !== "designer" && role !== "accountant",
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("orders").select(`
          *,
          total_price_foreign,
          currencies:currency_id(code, symbol),
          pricing_tier:pricing_tiers(name, label),
          order_items(
            product:products(name_en)
          )
        `)
        .eq("company_id", companyId!)
        .order("created_at", {
        ascending: false
      }).limit(5);
      if (error) throw error;
      return data as OrderWithDetails[];
    }
  });

  const stats = useMemo((): DashboardStat[] => {
    if (!allOrders) return [];
    const totalOrders = allOrders.length;
    const completedOrders = allOrders.filter(o => o.status?.toLowerCase() === "delivered").length;
    const activeOrders = allOrders.filter(o => !["Delivered", "Canceled"].includes(o.status)).length;
    const inProductionOrders = allOrders.filter(o => o.status?.toLowerCase() === "in production").length;

    const base: DashboardStat[] = [
      {
        title: "Total Orders",
        value: totalOrders.toString(),
        icon: ShoppingCart,
        change: `${completedOrders} completed`,
      },
      {
        title: "Active Orders",
        value: activeOrders.toString(),
        icon: Clock,
        change: "Awaiting action",
      },
      {
        title: "In Production",
        value: inProductionOrders.toString(),
        icon: CheckCircle,
        change: "Currently printing",
      },
    ];

    if (role === "sales") {
      base.splice(2, 0, {
        title: "Pending Approvals",
        value: String(pendingDesignApprovals),
        icon: ClipboardCheck,
        change: "Design tasks awaiting review",
        navigateTo: "/design-approvals",
        cardClassName:
          "border-violet-300/60 bg-gradient-to-br from-violet-50 via-white to-amber-50/70 dark:from-violet-950/40 dark:via-card dark:to-amber-950/25 dark:border-violet-700/50 cursor-pointer hover:shadow-md transition-shadow",
        iconClassName: "h-4 w-4 text-violet-600 dark:text-violet-300",
      });
    }

    return base;
  }, [allOrders, role, pendingDesignApprovals]);

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Designer Dashboard
  if (role === 'designer') {
    return <DesignerDashboard />;
  }

  // Accountant Dashboard
  if (role === 'accountant') {
    return <AccountantDashboard />;
  }

  if (role === "admin" && companyId) {
    return (
      <AdminDashboard
        companyId={companyId}
        currency={currency}
        baseCurrencySymbol={companyProfile?.base_currency?.symbol}
      />
    );
  }

  if (role === "admin" && !companyId) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Your profile is not linked to a company yet. Contact an administrator to assign a company before using the admin dashboard.
        </p>
      </div>
    );
  }

  // Default Dashboard (sales and other roles)
  return <div className="space-y-6">
    <div>
      <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
      <p className="text-muted-foreground">
        Welcome back. Here is an overview of your print shop pipeline and orders.
      </p>
    </div>

    <div
      className={cn(
        "grid gap-4 md:grid-cols-2",
        stats.length > 3 ? "lg:grid-cols-4" : "lg:grid-cols-3"
      )}
    >
      {isLoadingStats ? <>
        {(role === "sales" ? [1, 2, 3, 4] : [1, 2, 3]).map(i => <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>)}
      </> : stats.map(stat => (
        <Card
          key={stat.title}
          className={stat.cardClassName}
          onClick={stat.navigateTo ? () => navigate(stat.navigateTo!) : undefined}
          role={stat.navigateTo ? "link" : undefined}
          tabIndex={stat.navigateTo ? 0 : undefined}
          onKeyDown={
            stat.navigateTo
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(stat.navigateTo!);
                  }
                }
              : undefined
          }
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className={stat.iconClassName ?? "h-4 w-4 text-muted-foreground"} />
          </CardHeader>
          <CardContent>
            {stat.title === "Pending Approvals" && pendingApprovalsLoading ? (
              <Skeleton className="h-8 w-14 mb-2" />
            ) : (
              <div className="text-2xl font-bold">{stat.value}</div>
            )}
            <p className="text-xs text-muted-foreground">{stat.change}</p>
          </CardContent>
        </Card>
      ))}
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Recent Orders</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoadingRecent ? <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div> : recentOrders && recentOrders.length > 0 ? <div className="space-y-4">
          {recentOrders.map(order => <OrderCard
            key={order.id}
            id={order.id}
            order_number={order.order_number}
            client_name={order.client_name}
            phone={order.phone || ""}
            delivery_date={order.delivery_date}
            status={order.status}
            statusColor={statuses?.find(s => s.name === order.status)?.color}
            total_price={order.total_price}
            foreignPrice={order.total_price_foreign}
            basePriceCompany={order.total_price_company}
            currencyCode={order.currencies?.code}
            pricing_tier={order.pricing_tier}
            currency={currency}
            baseCurrencySymbol={companyProfile?.base_currency?.symbol}
            foreignCurrencySymbol={order.currencies?.symbol}
            onClick={() => {
              setSelectedOrderId(order.id);
              setIsDetailsOpen(true);
            }} />)}
        </div> : <p className="text-center text-muted-foreground py-8">No orders found</p>}
      </CardContent>
    </Card>

    {selectedOrderId && (
      <OrderDetails
        orderId={selectedOrderId}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      />
    )}
  </div>;
};
export default Dashboard;
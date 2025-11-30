import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Clock, CheckCircle, TrendingUp, FileText, AlertCircle, Upload } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo, useState } from "react";
import { OrderDetails } from "@/components/OrderDetails";
import { OrderCard } from "@/components/OrderCard";
import { useOrderStatuses } from "@/hooks/useOrderStatuses";
import { useUserRole } from "@/hooks/useUserRole";
import { DesignerTaskCard } from "@/components/DesignerTaskCard";
import { AccountantDashboard } from "@/components/dashboard/AccountantDashboard";
import { format, addDays, isWithinInterval } from "date-fns";
import { formatCurrency } from "@/utils/formatCurrency";
type OrderWithDetails = {
  id: string;
  client_name: string;
  email: string;
  delivery_date: string;
  status: string;
  total_price: number;
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

type DesignerOrder = {
  id: string;
  client_name: string;
  delivery_date: string;
  status: string;
  notes?: string | null;
  pricing_tier?: {
    name: string;
    label: string;
  } | null;
};
const Dashboard = () => {
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
        .select("currency")
        .eq("id", companyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const currency = companyProfile?.currency || 'AED';

  const {
    data: allOrders,
    isLoading: isLoadingStats
  } = useQuery({
    queryKey: ["all-orders-stats"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("orders").select("id, status, total_price, created_at");
      if (error) throw error;
      return data;
    }
  });
  const {
    data: recentOrders,
    isLoading: isLoadingRecent
  } = useQuery({
    queryKey: ["recent-orders"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("orders").select(`
          *,
          pricing_tier:pricing_tiers(name, label),
          order_items(
            product:products(name_en)
          )
        `).order("created_at", {
        ascending: false
      }).limit(5);
      if (error) throw error;
      return data as OrderWithDetails[];
    }
  });
  // Designer-specific query
  const {
    data: designerOrders,
    isLoading: isLoadingDesignerOrders
  } = useQuery({
    queryKey: ["designer-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          client_name,
          delivery_date,
          status,
          notes,
          pricing_tier:pricing_tiers(name, label)
        `)
        .in("status", ["In Design", "Design Revision", "Waiting for Print File"])
        .order("delivery_date", { ascending: true });
      
      if (error) throw error;
      return data as DesignerOrder[];
    },
    enabled: role === 'designer'
  });

  const designerStats = useMemo(() => {
    if (!designerOrders) return [];
    
    const toDesign = designerOrders.filter(o => o.status === "In Design").length;
    const revisions = designerOrders.filter(o => o.status === "Design Revision").length;
    const waitingForFiles = designerOrders.filter(o => o.status === "Waiting for Print File").length;

    return [
      {
        title: "To Design",
        value: toDesign.toString(),
        icon: FileText,
        change: "Needs design work"
      },
      {
        title: "Revisions Needed",
        value: revisions.toString(),
        icon: AlertCircle,
        change: "Client requested changes",
        highlight: true
      },
      {
        title: "Waiting for Files",
        value: waitingForFiles.toString(),
        icon: Upload,
        change: "Upload final print files"
      }
    ];
  }, [designerOrders]);

  // Filter orders for next 7 days
  const thisWeekOrders = useMemo(() => {
    if (!designerOrders) return [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysFromNow = addDays(today, 7);
    
    return designerOrders.filter(order => {
      const deliveryDate = new Date(order.delivery_date);
      deliveryDate.setHours(0, 0, 0, 0);
      return isWithinInterval(deliveryDate, { start: today, end: sevenDaysFromNow });
    });
  }, [designerOrders]);

  const stats = useMemo(() => {
    if (!allOrders) return [];
    const totalOrders = allOrders.length;
    const pendingOrders = allOrders.filter(o => o.status?.toLowerCase() === "new").length;
    const completedOrders = allOrders.filter(o => o.status?.toLowerCase() === "delivered").length;
    const totalRevenue = allOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
    const inProductionOrders = allOrders.filter(o => o.status?.toLowerCase() === "production").length;
    return [{
      title: "Total Orders",
      value: totalOrders.toString(),
      icon: ShoppingCart,
      change: `${completedOrders} completed`
    }, {
      title: "Pending",
      value: pendingOrders.toString(),
      icon: Clock,
      change: "Awaiting action"
    }, {
      title: "In Production",
      value: inProductionOrders.toString(),
      icon: CheckCircle,
      change: "Currently printing"
    }, {
      title: "Revenue",
      value: formatCurrency(totalRevenue, currency),
      icon: TrendingUp,
      change: `From ${totalOrders} orders`
    }];
  }, [allOrders, currency]);

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Designer Dashboard
  if (role === 'designer') {
    return <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Designer Workspace</h1>
        <p className="text-muted-foreground">Your active design tasks and pending work</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {isLoadingDesignerOrders ? (
          <>
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          designerStats.map(stat => (
            <Card key={stat.title} className={stat.highlight ? "border-orange-500" : ""}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.highlight ? 'text-orange-500' : 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${stat.highlight ? 'text-orange-500' : ''}`}>
                  {stat.value}
                </div>
                <p className="text-xs text-muted-foreground">{stat.change}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card className="bg-background/60 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Active Task Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingDesignerOrders ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-64 w-full" />
                </div>
              ))}
            </div>
          ) : thisWeekOrders && thisWeekOrders.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {thisWeekOrders.map((order) => (
                <DesignerTaskCard key={order.id} order={order} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No tasks due in the next 7 days. Great work!</p>
            </div>
          )}
        </CardContent>
      </Card>

      <OrderDetails
        orderId={selectedOrderId || ""}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      />
    </div>;
  }

  // Accountant Dashboard
  if (role === 'accountant') {
    return <AccountantDashboard />;
  }

  // Default Dashboard (Admin)
  return <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's an overview of your print shop .                                                                                                                                                          </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoadingStats ? <>
            {[1, 2, 3, 4].map(i => <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>)}
          </> : stats.map(stat => <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.change}</p>
              </CardContent>
            </Card>)}
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
                client_name={order.client_name} 
                email={order.email} 
                delivery_date={order.delivery_date} 
                status={order.status} 
                statusColor={statuses?.find(s => s.name === order.status)?.color} 
                total_price={order.total_price} 
                pricing_tier={order.pricing_tier}
                currency={currency}
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
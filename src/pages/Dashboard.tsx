import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Clock, CheckCircle, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo, useState } from "react";
import { OrderDetails } from "@/components/OrderDetails";
import { OrderCard } from "@/components/OrderCard";
import { useOrderStatuses } from "@/hooks/useOrderStatuses";
type OrderWithDetails = {
  id: string;
  client_name: string;
  email: string;
  delivery_date: string;
  status: string;
  total_price: number;
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
const Dashboard = () => {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const { data: statuses } = useOrderStatuses();

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
      value: `$${totalRevenue.toFixed(2)}`,
      icon: TrendingUp,
      change: `From ${totalOrders} orders`
    }];
  }, [allOrders]);
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
              {recentOrders.map(order => <OrderCard key={order.id} id={order.id} client_name={order.client_name} email={order.email} delivery_date={order.delivery_date} status={order.status} statusColor={statuses?.find(s => s.name === order.status)?.color} total_price={order.total_price} pricing_tier={order.pricing_tier} onClick={() => {
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
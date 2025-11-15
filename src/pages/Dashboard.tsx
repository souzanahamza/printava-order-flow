import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Clock, CheckCircle, TrendingUp } from "lucide-react";
import { StatusBadge, OrderStatus } from "@/components/StatusBadge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
const stats = [{
  title: "Total Orders",
  value: "188",
  icon: ShoppingCart,
  change: "+12% from last month"
}, {
  title: "Pending",
  value: "23",
  icon: Clock,
  change: "Awaiting action"
}, {
  title: "Completed",
  value: "118",
  icon: CheckCircle,
  change: "This month"
}, {
  title: "Revenue",
  value: "$12,450",
  icon: TrendingUp,
  change: "+8% from last month"
}];
type OrderWithDetails = {
  id: string;
  client_name: string;
  delivery_date: string;
  status: string;
  total_price: number;
  order_items: Array<{
    product: {
      name_en: string;
    };
  }>;
};
const Dashboard = () => {
  const { data: orders, isLoading } = useQuery({
    queryKey: ["recent-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_items(
            product:products(name_en)
          )
        `)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as OrderWithDetails[];
    },
  });

  return <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's an overview of your print shop..     </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map(stat => <Card key={stat.title}>
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
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : orders && orders.length > 0 ? (
            <div className="space-y-4">
              {orders.map(order => (
                <div key={order.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <div className="space-y-1 mb-2 sm:mb-0">
                    <div className="font-semibold text-foreground">{order.id.slice(0, 8)}</div>
                    <div className="text-sm text-muted-foreground">{order.client_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {order.order_items[0]?.product?.name_en || "No items"}
                      {order.order_items.length > 1 && ` +${order.order_items.length - 1} more`}
                    </div>
                    <div className="text-sm font-semibold text-foreground">
                      ${order.total_price?.toFixed(2) || "0.00"}
                    </div>
                  </div>
                  <div className="flex flex-col sm:items-end gap-2">
                    <StatusBadge status={order.status.toLowerCase() as OrderStatus} />
                    <span className="text-xs text-muted-foreground">
                      {new Date(order.delivery_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No orders found</p>
          )}
        </CardContent>
      </Card>
    </div>;
};
export default Dashboard;
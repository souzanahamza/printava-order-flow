import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Clock, CheckCircle, TrendingUp } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
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
const recentOrders = [{
  id: "ORD-1234",
  client: "Acme Corp",
  product: "Business Cards",
  status: "production" as const,
  date: "2025-11-14"
}, {
  id: "ORD-1235",
  client: "Tech Start",
  product: "Banners",
  status: "design" as const,
  date: "2025-11-14"
}, {
  id: "ORD-1236",
  client: "Local Cafe",
  product: "Menus",
  status: "shipping" as const,
  date: "2025-11-13"
}, {
  id: "ORD-1237",
  client: "Real Estate Co",
  product: "Flyers",
  status: "new" as const,
  date: "2025-11-13"
}, {
  id: "ORD-1238",
  client: "Fashion Brand",
  product: "Catalogs",
  status: "delivered" as const,
  date: "2025-11-12"
}];
const Dashboard = () => {
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
          <div className="space-y-4">
            {recentOrders.map(order => <div key={order.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <div className="space-y-1 mb-2 sm:mb-0">
                  <div className="font-semibold text-foreground">{order.id}</div>
                  <div className="text-sm text-muted-foreground">{order.client}</div>
                  <div className="text-sm text-muted-foreground">{order.product}</div>
                </div>
                <div className="flex flex-col sm:items-end gap-2">
                  <StatusBadge status={order.status} />
                  <span className="text-xs text-muted-foreground">{order.date}</span>
                </div>
              </div>)}
          </div>
        </CardContent>
      </Card>
    </div>;
};
export default Dashboard;
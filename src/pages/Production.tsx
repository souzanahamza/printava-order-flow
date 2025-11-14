import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";

const productionOrders = [
  { id: "ORD-1234", client: "Acme Corp", product: "Business Cards", date: "2025-11-14", quantity: 500 },
  { id: "ORD-1239", client: "Local School", product: "Posters", date: "2025-11-11", quantity: 100 },
];

const Production = () => {
  const handleMoveToShipping = (orderId: string) => {
    toast.success(`Order ${orderId} moved to shipping!`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Production</h1>
        <p className="text-muted-foreground">Manage orders in production</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {productionOrders.map((order) => (
          <Card key={order.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{order.id}</CardTitle>
                <StatusBadge status="production" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Client</div>
                <div className="font-medium">{order.client}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Product</div>
                <div className="font-medium">{order.product}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Quantity</div>
                <div className="font-medium">{order.quantity} units</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Started</div>
                <div className="font-medium">{order.date}</div>
              </div>
              <Button
                className="w-full"
                onClick={() => handleMoveToShipping(order.id)}
              >
                Move to Shipping
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Production;

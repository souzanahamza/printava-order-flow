import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { Package } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const shippingOrders = [
  { id: "ORD-1236", client: "Local Cafe", product: "Menus", date: "2025-11-13", address: "123 Main St, City, State 12345" },
];

const Shipping = () => {
  const [trackingNumber, setTrackingNumber] = useState("");

  const handleMarkDelivered = (orderId: string) => {
    if (!trackingNumber) {
      toast.error("Please enter a tracking number");
      return;
    }
    toast.success(`Order ${orderId} marked as delivered with tracking: ${trackingNumber}`);
    setTrackingNumber("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Shipping</h1>
        <p className="text-muted-foreground">Manage shipping and deliveries</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {shippingOrders.map((order) => (
          <Card key={order.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{order.id}</CardTitle>
                <StatusBadge status="shipping" />
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
                <div className="text-sm text-muted-foreground">Shipping Address</div>
                <div className="font-medium">{order.address}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Shipped Date</div>
                <div className="font-medium">{order.date}</div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tracking">Tracking Number</Label>
                <Input
                  id="tracking"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Enter tracking number"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => handleMarkDelivered(order.id)}
              >
                <Package className="mr-2 h-4 w-4" />
                Mark as Delivered
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Shipping;

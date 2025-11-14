import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

const designOrders = [
  { id: "ORD-1235", client: "Tech Start", product: "Banners", date: "2025-11-14", preview: "Design preview for banners" },
  { id: "ORD-1240", client: "Marketing Agency", product: "Brochures", date: "2025-11-11", preview: "Design preview for brochures" },
];

const DesignApprovals = () => {
  const handleApprove = (orderId: string) => {
    toast.success(`Order ${orderId} design approved!`);
  };

  const handleReject = (orderId: string) => {
    toast.error(`Order ${orderId} design rejected`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Design Approvals</h1>
        <p className="text-muted-foreground">Review and approve design submissions</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {designOrders.map((order) => (
          <Card key={order.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{order.id}</CardTitle>
                <StatusBadge status="design" />
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
                <div className="text-sm text-muted-foreground">Submitted</div>
                <div className="font-medium">{order.date}</div>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center text-muted-foreground">
                {order.preview}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleReject(order.id)}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => handleApprove(order.id)}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default DesignApprovals;

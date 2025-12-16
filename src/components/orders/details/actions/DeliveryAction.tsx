import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Truck, MapPin } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency } from "@/utils/formatCurrency";

interface DeliveryActionProps {
  order: {
    id: string;
    total_price: number;
    paid_amount: number | null;
    payment_status: string | null;
    delivery_method: string | null;
  };
  onSuccess?: () => void;
  currency?: string;
}

export function DeliveryAction({ order, onSuccess, currency }: DeliveryActionProps) {
  const queryClient = useQueryClient();
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");

  const remainingBalance = order.total_price - (order.paid_amount || 0);
  const isFullyPaid = remainingBalance <= 0;

  const deliveryMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "Delivered",
          payment_status: "paid",
          paid_amount: order.total_price,
        })
        .eq("id", order.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-details", order.id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order marked as delivered");
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast.error(`Failed to mark as delivered: ${error.message}`);
    },
  });

  const handleDeliver = () => {
    deliveryMutation.mutate();
  };

  if (!isFullyPaid) {
    return (
      <Card className="border-destructive bg-destructive/5">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-2xl text-destructive">
            <AlertCircle className="h-6 w-6" />
            Balance Due: {formatCurrency(remainingBalance, currency)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total:</span>
            <span className="font-semibold">{formatCurrency(order.total_price, currency)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Paid:</span>
            <span className="font-semibold">{formatCurrency(order.paid_amount || 0, currency)}</span>
          </div>
          <div className="h-px bg-border" />
          <div className="space-y-3">
            <Label>Payment Method for Remaining Balance</Label>
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cash" id="cash" />
                <Label htmlFor="cash" className="cursor-pointer">Cash</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="card" id="card" />
                <Label htmlFor="card" className="cursor-pointer">Card</Label>
              </div>
            </RadioGroup>
          </div>
          <Button
            onClick={handleDeliver}
            disabled={deliveryMutation.isPending}
            variant="destructive"
            className="w-full"
          >
            {deliveryMutation.isPending ? "Processing..." : "Collect Payment & Mark Delivered"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-2xl text-green-700 dark:text-green-400">
          <CheckCircle className="h-6 w-6" />
          Fully Paid - Ready for Handover
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Label className="text-muted-foreground">Delivery Method:</Label>
          <Badge variant="outline" className="gap-1.5">
            {order.delivery_method === "delivery" ? (
              <>
                <Truck className="h-3.5 w-3.5" />
                Delivery
              </>
            ) : (
              <>
                <MapPin className="h-3.5 w-3.5" />
                Pickup
              </>
            )}
          </Badge>
        </div>
        <Button
          onClick={handleDeliver}
          disabled={deliveryMutation.isPending}
          className="w-full bg-green-600 hover:bg-green-700 text-white"
        >
          {deliveryMutation.isPending ? "Processing..." : "Mark as Delivered"}
        </Button>
      </CardContent>
    </Card>
  );
}

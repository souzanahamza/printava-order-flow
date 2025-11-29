import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrderStatuses } from "./useOrderStatuses";

interface UpdateOrderStatusParams {
  orderId: string;
  newStatus: string;
  onSuccess?: () => void;
}

interface ConfirmPaymentParams {
  orderId: string;
  paymentMethod: string;
  onSuccess?: () => void;
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  const { data: statuses } = useOrderStatuses();

  return useMutation({
    mutationFn: async ({ orderId, newStatus }: UpdateOrderStatusParams) => {
      const statusObj = statuses?.find(s => s.name === newStatus);
      if (!statusObj) throw new Error(`Status "${newStatus}" not found`);

      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["order-details", variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      
      if (variables.onSuccess) {
        variables.onSuccess();
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to update order status: ${error.message}`);
    },
  });
}

export function useConfirmPayment() {
  const queryClient = useQueryClient();
  const { data: statuses } = useOrderStatuses();

  return useMutation({
    mutationFn: async ({ orderId, paymentMethod }: ConfirmPaymentParams) => {
      if (!paymentMethod) {
        throw new Error("Please select a payment method");
      }

      const paymentStatus = paymentMethod === "cod" ? "pending" : "paid";
      const inProductionStatus = statuses?.find(s => s.name === "In Production");
      
      if (!inProductionStatus) {
        throw new Error("In Production status not found");
      }

      const { error } = await supabase
        .from("orders")
        .update({
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          status: inProductionStatus.name,
        })
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["order-details", variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order sent to production");
      
      if (variables.onSuccess) {
        variables.onSuccess();
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to confirm payment: ${error.message}`);
    },
  });
}

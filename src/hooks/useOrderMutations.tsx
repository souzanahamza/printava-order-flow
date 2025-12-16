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
  paymentStatus: string;
  paidAmount: number;
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
    mutationFn: async ({ orderId, paymentMethod, paymentStatus, paidAmount }: ConfirmPaymentParams) => {
      if (!paymentMethod) {
        throw new Error("Please select a payment method");
      }

      const readyForProductionStatus = statuses?.find(s => s.name === "Ready for Production");
      
      if (!readyForProductionStatus) {
        throw new Error("Ready for Production status not found");
      }

      const { error } = await supabase
        .from("orders")
        .update({
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          paid_amount: paidAmount,
          status: readyForProductionStatus.name,
        })
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["order-details", variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order queued for production");
      
      if (variables.onSuccess) {
        variables.onSuccess();
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to confirm payment: ${error.message}`);
    },
  });
}

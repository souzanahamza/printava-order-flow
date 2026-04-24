import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { OrderForm, type EditOrderHydrationData } from "@/features/orders/components/OrderForm";
import { supabase } from "@/integrations/supabase/client";

const EditOrder = () => {
  const { orderId } = useParams<{ orderId: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["edit-order", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select(
          `
          id,
          status,
          client_id,
          client_name,
          email,
          phone,
          delivery_date,
          delivery_method,
          pricing_tier_id,
          notes,
          currency_id,
          exchange_rate,
          order_items(
            id,
            product_id,
            quantity,
            unit_price,
            item_total,
            description,
            needs_design,
            product:products(
              name_en,
              name_ar,
              product_code,
              sku
            )
          )
        `
        )
        .eq("id", orderId)
        .single();

      if (orderError) throw orderError;

      const { data: attachments, error: attachmentsError } = await supabase
        .from("order_attachments")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (attachmentsError) throw attachmentsError;

      return {
        ...order,
        order_attachments: attachments ?? [],
      } as EditOrderHydrationData;
    },
  });

  useEffect(() => {
    if (error) {
      toast.error("Failed to load order for editing");
    }
  }, [error]);

  if (error) {
    return <div className="text-sm text-destructive">Could not load order data.</div>;
  }

  if (isLoading || !data) {
    return <div className="text-sm text-muted-foreground">Loading order...</div>;
  }

  return <OrderForm mode="edit" initialData={data} />;
};

export default EditOrder;

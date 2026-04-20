import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { DesignerTaskCard } from "@/features/designer/components/DesignerTaskCard";
import { OrderDetails } from "@/features/orders/components/OrderDetails";
import { ItemTaskDetailDialog } from "@/features/orders/components/details/ItemTaskDetailDialog";
import { ADMIN_DESIGN_TASK_LIST_SELECT } from "@/features/designer/designerTaskSelect";
import type { AdminDesignTaskRow } from "@/features/designer/types";
import type { OrderDetail } from "@/features/orders/types";
import { useAuth } from "@/hooks/useAuth";

function taskRowToDetailItem(task: AdminDesignTaskRow): OrderDetail["order_items"][number] {
  const line = task.order_item;
  if (!line?.product) {
    throw new Error("Missing order line or product for task detail");
  }
  const p = line.product;
  return {
    id: line.id,
    order_id: task.order_id,
    quantity: line.quantity,
    unit_price: line.unit_price,
    item_total: line.item_total,
    needs_design: line.needs_design ?? true,
    product: {
      name_en: p.name_en,
      name_ar: p.name_ar,
      image_url: p.image_url,
      sku: p.sku,
      product_code: p.product_code ?? null,
    },
    order_tasks: [],
  };
}

export default function AdminDesignTasks() {
  const { user, loading: authLoading } = useAuth();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<OrderDetail["order_items"][number] | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: adminTasks, isLoading } = useQuery({
    queryKey: ["admin-design-tasks"],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_tasks")
        .select(ADMIN_DESIGN_TASK_LIST_SELECT)
        .eq("task_type", "design")
        .order("created_at", { ascending: true });

      if (error) throw error;
      const rows = (data ?? []) as AdminDesignTaskRow[];
      return [...rows].sort((a, b) => {
        const da = a.order?.delivery_date ? new Date(a.order.delivery_date).getTime() : Number.POSITIVE_INFINITY;
        const db = b.order?.delivery_date ? new Date(b.order.delivery_date).getTime() : Number.POSITIVE_INFINITY;
        return da - db;
      });
    },
  });

  const handleOpenOrderDetails = (orderId: string) => {
    setSelectedOrderId(orderId);
    setIsDetailsOpen(true);
  };

  const openTaskDetail = (task: AdminDesignTaskRow) => {
    try {
      setDetailItem(taskRowToDetailItem(task));
      setDetailOpen(true);
    } catch {
      /* ignore */
    }
  };

  const empty = !isLoading && (!adminTasks || adminTasks.length === 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Design Tasks Monitor</h1>
        <p className="text-muted-foreground">
          All design tasks in your company, sorted by order due date. Click a card (outside Order and client files) to
          open the line-item task sheet for reassignment and status.
        </p>
      </div>

      {authLoading || !user?.id || isLoading ? (
        <div className="flex flex-col gap-3 px-2 sm:px-0">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : empty ? (
        <div className="text-center py-12">
          <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No design tasks found.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-2 sm:px-0">
          {adminTasks!.map((task) => (
            <DesignerTaskCard
              key={task.id}
              task={task}
              readOnly
              onOpenOrderDetails={handleOpenOrderDetails}
              onOpenTaskDetail={() => openTaskDetail(task)}
            />
          ))}
        </div>
      )}

      <OrderDetails
        orderId={selectedOrderId || ""}
        open={isDetailsOpen}
        onOpenChange={(open) => {
          setIsDetailsOpen(open);
          if (!open) setSelectedOrderId(null);
        }}
      />

      <ItemTaskDetailDialog
        item={detailItem}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setDetailItem(null);
        }}
      />
    </div>
  );
}

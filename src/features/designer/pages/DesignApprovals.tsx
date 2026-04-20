import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Pencil, ImageIcon, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
const SALES_QUEUE_SELECT = `
  id,
  order_id,
  order_item_id,
  status,
  created_at,
  order_item:order_items!order_tasks_order_item_id_fkey(
    quantity,
    product:products!order_items_product_id_fkey(name_en, category, image_url)
  ),
  order:orders!order_tasks_order_id_fkey(
    id,
    order_number,
    client_name
  )
`;

type SalesQueueTask = {
  id: string;
  order_id: string;
  order_item_id: string;
  status: string;
  created_at: string;
  order_item: {
    quantity: number;
    product: { name_en: string; category: string; image_url: string | null } | null;
  } | null;
  order: { id: string; order_number: number | null; client_name: string } | null;
};

function isLikelyImageUrl(url: string) {
  return /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url);
}

const DesignApprovals = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { companyId } = useUserRole();
  const [revisionTask, setRevisionTask] = useState<SalesQueueTask | null>(null);
  const [revisionNotes, setRevisionNotes] = useState("");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["design-approvals"],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_tasks")
        .select(SALES_QUEUE_SELECT)
        .eq("task_type", "design")
        .eq("status", "Design Approval")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as SalesQueueTask[];
    },
  });

  const orderIds = useMemo(() => [...new Set(tasks.map((t) => t.order_id))], [tasks]);

  type MockupRow = {
    id: string;
    order_id: string;
    order_item_id: string | null;
    file_url: string;
    file_name: string;
    created_at: string | null;
  };

  const { data: mockupsForOrders = [] } = useQuery({
    queryKey: ["design-approvals-mockups", [...orderIds].sort().join(",")],
    enabled: orderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_attachments")
        .select("id, order_id, order_item_id, file_url, file_name, created_at")
        .in("order_id", orderIds)
        .eq("file_type", "design_mockup")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as MockupRow[];
    },
  });

  const invalidateQueues = () => {
    queryClient.invalidateQueries({ queryKey: ["design-approvals"] });
    queryClient.invalidateQueries({ queryKey: ["design-approvals-mockups"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-pending-design-approvals"] });
    queryClient.invalidateQueries({ queryKey: ["designer-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
  };

  const approveMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("order_tasks")
        .update({ status: "Waiting for Print File" })
        .eq("id", taskId)
        .eq("task_type", "design")
        .eq("status", "Design Approval");

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Design approved. Designer can upload the final print file.");
      invalidateQueues();
    },
    onError: (e: Error) => toast.error(e.message || "Approve failed"),
  });

  const revisionMutation = useMutation({
    mutationFn: async ({ taskId, orderId, notes }: { taskId: string; orderId: string; notes: string }) => {
      const trimmed = notes.trim();
      if (!trimmed) throw new Error("Please add revision notes for the designer.");

      const { data: ok, error: rpcErr } = await supabase.rpc("set_order_task_status_with_notes", {
        p_task_id: taskId,
        p_new_status: "Design Revision",
        p_notes: `[Sales revision] ${trimmed}`,
        p_only_if_task_type: "design",
        p_only_if_status: "Design Approval",
      });
      if (rpcErr) throw rpcErr;
      if (!ok) throw new Error("Could not update task. It may no longer be awaiting approval.");

      if (user?.id && companyId) {
        const { error: cErr } = await supabase.from("order_comments").insert({
          order_id: orderId,
          user_id: user.id,
          company_id: companyId,
          content: `[Sales — design revision requested] ${trimmed}`,
          is_internal: true,
        });
        if (cErr) throw cErr;
      }
    },
    onSuccess: () => {
      toast.success("Revision requested. The designer has been notified via order comments.");
      setRevisionTask(null);
      setRevisionNotes("");
      invalidateQueues();
    },
    onError: (e: Error) => toast.error(e.message || "Request failed"),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-96 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Design approvals</h1>
        <p className="text-muted-foreground">
          Review proofs submitted by designers. Approve to allow final print file upload, or request a revision.
        </p>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium text-foreground">No tasks awaiting approval</p>
            <p className="text-sm mt-1">When designers submit proofs, they will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {tasks.map((task) => {
            const order = task.order;
            const product = task.order_item?.product;
            const category = product?.category?.trim() || "Product";
            const mockups = mockupsForOrders.filter(
              (m) => m.order_id === task.order_id && m.order_item_id === task.order_item_id
            );

            return (
              <Card key={task.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg">
                        {order?.order_number != null
                          ? `Order #${String(order.order_number).padStart(4, "0")}`
                          : `Order ${task.order_id.slice(0, 8)}…`}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">{order?.client_name ?? "—"}</p>
                    </div>
                    <Badge variant="secondary">Design approval</Badge>
                  </div>
                  <p className="text-sm font-medium pt-2">
                    {category} · {product?.name_en ?? "Line item"}
                    {task.order_item?.quantity != null ? ` ×${task.order_item.quantity}` : ""}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mockups</div>
                    {mockups.length === 0 ? (
                      <div className="flex items-center gap-2 rounded-lg border border-dashed p-6 text-sm text-muted-foreground justify-center">
                        <ImageIcon className="h-5 w-5 shrink-0" />
                        No design mockup files on this order yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {mockups.map((m) => (
                          <a
                            key={m.id}
                            href={m.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative rounded-lg border bg-muted/30 overflow-hidden aspect-square flex items-center justify-center"
                          >
                            {isLikelyImageUrl(m.file_url) ? (
                              <img
                                src={m.file_url}
                                alt={m.file_name}
                                className="max-h-full max-w-full object-contain p-1"
                              />
                            ) : (
                              <span className="text-xs text-center px-2 break-all">{m.file_name}</span>
                            )}
                            <span className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <ExternalLink className="h-4 w-4 text-foreground drop-shadow" />
                            </span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {task.created_at && (
                    <p className="text-xs text-muted-foreground">
                      Submitted {format(new Date(task.created_at), "MMM d, yyyy · h:mm a")}
                    </p>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setRevisionTask(task);
                        setRevisionNotes("");
                      }}
                      disabled={approveMutation.isPending || revisionMutation.isPending}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Request revision
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => approveMutation.mutate(task.id)}
                      disabled={approveMutation.isPending || revisionMutation.isPending}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approve design
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={revisionTask != null} onOpenChange={(open) => !open && setRevisionTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request design revision</DialogTitle>
            <DialogDescription>
              The designer will see the task return to &quot;Design revision&quot; and can read these notes on the order.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="revision-notes">Revision notes</Label>
            <Textarea
              id="revision-notes"
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              placeholder="Describe what should change in the proof…"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevisionTask(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!revisionTask) return;
                revisionMutation.mutate({
                  taskId: revisionTask.id,
                  orderId: revisionTask.order_id,
                  notes: revisionNotes,
                });
              }}
              disabled={revisionMutation.isPending}
            >
              Send revision request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DesignApprovals;

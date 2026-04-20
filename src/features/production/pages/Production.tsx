import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Download,
  CheckCircle,
  AlertCircle,
  Calendar,
  Package as PackageIcon,
  User,
  FileText,
  Truck,
  Clock,
  Cog,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isToday, isTomorrow } from "date-fns";
import { getTaskStatusColor, useTaskStatuses } from "@/hooks/useTaskStatuses";
import { useAuth } from "@/hooks/useAuth";

type OrderFile = {
  file_url: string;
  file_name: string;
  /** True when attachment is scoped to the whole order (no line item). */
  orderLevel?: boolean;
};

type AttachmentRow = {
  order_id: string;
  order_item_id: string | null;
  file_url: string;
  file_name: string;
  file_type: string;
};

type ProductionTaskRow = {
  id: string;
  order_id: string;
  order_item_id: string;
  company_id: string;
  task_type: string;
  status: string;
  assigned_to: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  assigned_profile: { full_name: string | null; email: string | null } | null;
  order_item: {
    quantity: number;
    product: {
      name_en: string;
      sku: string;
      image_url: string | null;
      category: string;
    } | null;
  } | null;
  order: {
    id: string;
    order_number: number | null;
    client_name: string;
    email: string;
    phone: string | null;
    delivery_date: string;
    delivery_method: string | null;
    notes: string | null;
    created_at: string;
  } | null;
  attachments: OrderFile[];
  clientFiles: OrderFile[];
  designMockups: OrderFile[];
};

const PRODUCTION_TASK_SELECT = `
  id,
  order_id,
  order_item_id,
  company_id,
  task_type,
  status,
  assigned_to,
  started_at,
  completed_at,
  created_at,
  assigned_profile:profiles!order_tasks_assigned_to_fkey(full_name, email),
  order_item:order_items!order_tasks_order_item_id_fkey(
    quantity,
    product:products!order_items_product_id_fkey(
      name_en,
      sku,
      image_url,
      category
    )
  ),
  order:orders!order_tasks_order_id_fkey(
    id,
    order_number,
    client_name,
    email,
    phone,
    delivery_date,
    delivery_method,
    notes,
    created_at
  )
`;

/** Print / client / design files for this line: item-scoped OR whole-order (order_item_id null). */
function attachmentsForTask(
  task: { order_id: string; order_item_id: string },
  rows: AttachmentRow[]
): { print: OrderFile[]; client: OrderFile[]; mockup: OrderFile[] } {
  const print: OrderFile[] = [];
  const client: OrderFile[] = [];
  const mockup: OrderFile[] = [];

  for (const r of rows) {
    if (r.order_id !== task.order_id) continue;
    const itemMatch = r.order_item_id === task.order_item_id;
    const orderWide = r.order_item_id == null;
    if (!itemMatch && !orderWide) continue;

    const orderLevel = orderWide;
    const f: OrderFile = { file_url: r.file_url, file_name: r.file_name, orderLevel };

    if (r.file_type === "print_file") print.push(f);
    else if (r.file_type === "client_reference") client.push(f);
    else if (r.file_type === "design_mockup") mockup.push(f);
  }

  return { print, client, mockup };
}

function ProductionFileLink({ file }: { file: OrderFile }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-auto min-h-10 gap-2 justify-start py-2 w-full sm:w-auto"
      asChild
    >
      <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 min-w-0">
        <Download className="h-4 w-4 shrink-0" />
        <span className="truncate text-left flex-1 min-w-0">{file.file_name}</span>
        {file.orderLevel ? (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 shrink-0 font-normal whitespace-nowrap">
            Order asset
          </Badge>
        ) : null}
      </a>
    </Button>
  );
}

const Production = () => {
  const queryClient = useQueryClient();
  const { data: taskStatuses } = useTaskStatuses();
  const { user, loading: authLoading } = useAuth();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["production-tasks"],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_tasks")
        .select(PRODUCTION_TASK_SELECT)
        .eq("task_type", "production")
        .in("status", ["Pending", "In Progress"])
        .order("created_at", { ascending: true });

      if (error) throw error;

      const base = (data ?? []) as Omit<ProductionTaskRow, "attachments" | "clientFiles" | "designMockups">[];
      const orderIds = [...new Set(base.map((t) => t.order_id))];

      let attRows: AttachmentRow[] = [];
      if (orderIds.length > 0) {
        const { data, error: attErr } = await supabase
          .from("order_attachments")
          .select("order_id, order_item_id, file_url, file_name, file_type")
          .in("order_id", orderIds)
          .in("file_type", ["print_file", "client_reference", "design_mockup"]);

        if (attErr) throw attErr;
        attRows = (data ?? []) as AttachmentRow[];
      }

      const merged: ProductionTaskRow[] = base.map((t) => {
        const { print, client, mockup } = attachmentsForTask(t, attRows);
        return {
          ...t,
          attachments: print,
          clientFiles: client,
          designMockups: mockup,
        };
      });

      return merged.sort((a, b) => {
        const da = a.order?.delivery_date ? new Date(a.order.delivery_date).getTime() : 0;
        const db = b.order?.delivery_date ? new Date(b.order.delivery_date).getTime() : 0;
        return da - db;
      });
    },
  });

  const startTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!user?.id) throw new Error("You must be signed in");

      const { data, error } = await supabase
        .from("order_tasks")
        .update({
          status: "In Progress",
          assigned_to: user.id,
          started_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .eq("status", "Pending")
        .is("assigned_to", null)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("This task was just claimed by someone else. Refresh the list.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Task started — printing in progress.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to start task");
      console.error(error);
    },
  });

  const markTaskReadyMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!user?.id) throw new Error("You must be signed in");

      const now = new Date().toISOString();
      const { error } = await supabase
        .from("order_tasks")
        .update({
          status: "Completed",
          completed_at: now,
        })
        .eq("id", taskId)
        .eq("task_type", "production")
        .eq("assigned_to", user.id)
        .eq("status", "In Progress");

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Task marked complete.");
    },
    onError: (error) => {
      toast.error("Failed to complete task");
      console.error(error);
    },
  });

  const getUrgencyBadge = (deliveryDate: string) => {
    const date = new Date(deliveryDate);

    if (isToday(date)) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Due Today {format(date, "h:mm a")}
        </Badge>
      );
    }

    if (isTomorrow(date)) {
      return (
        <Badge variant="default" className="bg-orange-500 hover:bg-orange-600 gap-1">
          <AlertCircle className="h-3 w-3" />
          Due Tomorrow {format(date, "h:mm a")}
        </Badge>
      );
    }

    return <Badge variant="outline">{format(date, "EEE, MMM d • h:mm a")}</Badge>;
  };

  const getTaskStatusBadge = (status: string) => {
    const bg = getTaskStatusColor(status, taskStatuses);

    if (status === "Pending") {
      return (
        <Badge variant="secondary" className="gap-1 border-transparent text-white" style={{ backgroundColor: bg }}>
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      );
    }
    return (
      <Badge
        variant="default"
        className="gap-1 border-transparent text-white animate-pulse hover:opacity-90"
        style={{ backgroundColor: bg }}
      >
        <Cog className="h-3 w-3 animate-spin" />
        In progress
      </Badge>
    );
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="px-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Production task pool</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          One card per line item. When design finishes for a product on an order, only that line&apos;s production task
          appears here. Start and mark ready update the task row only; parent order status is handled in the database.
        </p>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No production tasks in the queue</p>
            <p className="text-sm text-muted-foreground">All caught up.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 px-2 sm:px-0">
          {tasks.map((task) => {
            const order = task.order;
            if (!order) return null;

            const item = task.order_item;
            const product = item?.product;
            const categoryLabel = product?.category?.trim() || "Product";
            const lineTitle = product
              ? `${categoryLabel} · ${item!.quantity}× ${product.name_en}`
              : "Line item";
            const assigneeName =
              task.assigned_profile?.full_name?.trim() ||
              task.assigned_profile?.email?.trim() ||
              null;
            const isMine = Boolean(user?.id && task.assigned_to === user.id);
            const isClaimedByOther = Boolean(task.assigned_to && user?.id && task.assigned_to !== user.id);
            const startDisabled =
              startTaskMutation.isPending ||
              task.status !== "Pending" ||
              task.assigned_to != null ||
              isClaimedByOther;
            const canMarkReady = task.status === "In Progress" && isMine;
            const markReadyDisabled = markTaskReadyMutation.isPending || !canMarkReady;

            const accent = getTaskStatusColor(task.status, taskStatuses);

            return (
              <Card
                key={task.id}
                className={`hover:shadow-lg transition-shadow ${task.status === "In Progress" ? "ring-1" : ""}`}
                style={
                  task.status === "In Progress"
                    ? { borderColor: `${accent}80`, boxShadow: `0 0 0 1px ${accent}33` }
                    : undefined
                }
              >
                <CardHeader className="pb-4 px-4 sm:px-6">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <CardTitle className="text-lg sm:text-xl font-bold shrink-0">
                          {order.order_number != null
                            ? `#${String(order.order_number).padStart(4, "0")}`
                            : `#${order.id.slice(0, 8)}`}
                        </CardTitle>
                        <Badge variant="outline" className="text-xs font-normal truncate max-w-[200px]">
                          {lineTitle}
                        </Badge>
                        {isClaimedByOther && assigneeName && (
                          <Badge variant="secondary" className="text-xs max-w-[160px] truncate" title={assigneeName}>
                            {assigneeName}
                          </Badge>
                        )}
                        {isClaimedByOther && !assigneeName && (
                          <Badge variant="secondary" className="text-xs">
                            Assigned
                          </Badge>
                        )}
                      </div>
                      <Badge variant="outline" className="gap-1 shrink-0">
                        <Calendar className="h-3 w-3" />
                        <span className="hidden sm:inline">{format(new Date(order.created_at), "MMM d, yyyy • h:mm a")}</span>
                        <span className="sm:hidden">{format(new Date(order.created_at), "MMM d • h:mm a")}</span>
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {getTaskStatusBadge(task.status)}
                      {getUrgencyBadge(order.delivery_date)}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 px-4 sm:px-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span className="font-medium">Client</span>
                      </div>
                      <p className="text-sm sm:text-base font-semibold ml-6 break-words">{order.client_name}</p>
                      {order.phone && <p className="text-xs sm:text-sm text-muted-foreground ml-6">{order.phone}</p>}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Truck className="h-4 w-4" />
                        <span className="font-medium">Delivery</span>
                      </div>
                      <p className="text-sm sm:text-base font-semibold ml-6">
                        <span className="hidden sm:inline">
                          {format(new Date(order.delivery_date), "EEEE, MMM d, yyyy • h:mm a")}
                        </span>
                        <span className="sm:hidden">{format(new Date(order.delivery_date), "MMM d, yyyy • h:mm a")}</span>
                      </p>
                      {order.delivery_method && (
                        <Badge variant="secondary" className="ml-6 mt-1">
                          {order.delivery_method}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <PackageIcon className="h-4 w-4" />
                      This task (line item)
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-background border rounded-lg">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {product?.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name_en}
                            className="h-12 w-12 sm:h-14 sm:w-14 rounded-lg object-cover border shrink-0"
                          />
                        ) : (
                          <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-lg bg-muted border shrink-0">
                            <PackageIcon className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm sm:text-base truncate">{product?.name_en ?? "—"}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">
                            {categoryLabel} · SKU: {product?.sku ?? "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <Badge variant="secondary" className="font-semibold text-sm">
                          {item?.quantity ?? 0}x
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {order.notes && (
                    <>
                      <Separator />
                      <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900">
                        <FileText className="h-4 w-4 text-yellow-800 dark:text-yellow-500" />
                        <AlertDescription className="text-sm text-yellow-800 dark:text-yellow-500 ml-2">
                          <strong className="font-semibold">Production notes:</strong>
                          <p className="mt-1">{order.notes}</p>
                        </AlertDescription>
                      </Alert>
                    </>
                  )}

                  <Separator />

                  <div className="flex flex-col gap-3">
                    {(task.clientFiles.length > 0 || task.designMockups.length > 0) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {task.clientFiles.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                              <FileText className="h-4 w-4" />
                              Client files
                            </div>
                            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                              {task.clientFiles.map((file, idx) => (
                                <ProductionFileLink key={`${file.file_url}-client-${idx}`} file={file} />
                              ))}
                            </div>
                          </div>
                        )}

                        {task.designMockups.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                              <FileText className="h-4 w-4" />
                              Design mockups
                            </div>
                            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                              {task.designMockups.map((file, idx) => (
                                <ProductionFileLink key={`${file.file_url}-mock-${idx}`} file={file} />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Download className="h-4 w-4" />
                        Print files
                      </div>
                      {task.attachments.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                            {task.attachments.map((file, idx) => (
                              <ProductionFileLink key={`${file.file_url}-print-${idx}`} file={file} />
                            ))}
                          </div>
                          {task.attachments.length > 1 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="self-start text-xs h-8 text-muted-foreground"
                              onClick={() => {
                                task.attachments.forEach((file) => {
                                  window.open(file.file_url, "_blank", "noopener,noreferrer");
                                });
                              }}
                            >
                              Open all print files in new tabs
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>No print files for this line (upload at order or line level).</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">

                      {task.status === "Pending" ? (
                        <Button
                          onClick={() => startTaskMutation.mutate(task.id)}
                          disabled={startDisabled}
                          className="flex-1 gap-2 bg-amber-600 hover:bg-amber-700 min-w-0 disabled:opacity-60"
                          size="lg"
                        >
                          <Cog className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                          <span className="truncate">Start</span>
                        </Button>
                      ) : (
                        <Button
                          onClick={() => markTaskReadyMutation.mutate(task.id)}
                          disabled={markReadyDisabled}
                          className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 min-w-0"
                          size="lg"
                        >
                          <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                          <span className="truncate">Mark ready</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Production;

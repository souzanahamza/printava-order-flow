import { useState, useMemo, type MouseEvent } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Download,
  Send,
  FileText,
  X,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Package,
  User,
  Truck,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrderFileUpload } from "@/hooks/useOrderFileUpload";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { getTaskStatusColor, useTaskStatuses } from "@/hooks/useTaskStatuses";
import type { DesignerTaskCardTask } from "@/features/designer/types";
import {
  filterAttachmentsForDesignLineItem,
  isOrderLevelAttachment,
  type DesignerOrderAttachmentRow,
} from "@/features/designer/designerAttachmentUtils";
import { cn } from "@/lib/utils";

interface DesignerTaskCardProps {
  task: DesignerTaskCardTask;
  onOpenOrderDetails: (orderId: string) => void;
  /** When true, hide designer actions (admin monitor or read-only viewing). */
  readOnly?: boolean;
  /** Opens line-item task dialog (e.g. admin reassignment). */
  onOpenTaskDetail?: () => void;
  /**
   * Batched attachments from Designer Dashboard (same order can appear on multiple tasks).
   * When omitted, this card loads attachments for `task.order_id` itself.
   */
  orderAttachments?: DesignerOrderAttachmentRow[];
  /** Parent is loading batched attachments; suppresses duplicate per-card fetch. */
  orderAttachmentsLoading?: boolean;
}

const PROOF_WORKFLOW_STATUSES = ["In Progress", "Design Revision"] as const;

export function DesignerTaskCard({
  task,
  onOpenOrderDetails,
  readOnly = false,
  onOpenTaskDetail,
  orderAttachments: orderAttachmentsFromParent,
  orderAttachmentsLoading = false,
}: DesignerTaskCardProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { companyId } = useUserRole();
  const { data: taskStatuses } = useTaskStatuses();

  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [printFiles, setPrintFiles] = useState<File[]>([]);
  const [designerNotes, setDesignerNotes] = useState("");

  const order = task.order;
  const line = task.order_item;
  const product = line?.product;
  const categoryLabel = product?.category?.trim() || "Product";
  const lineLabel = line
    ? `${categoryLabel} · ${line.quantity}× ${product?.name_en ?? "Product"}${product?.name_ar ? ` (${product.name_ar})` : ""}`
    : "Line item";
  const lineTitleShort =
    product && line ? `${categoryLabel} · ${line.quantity}× ${product.name_en}` : "Line item";

  const statusColor = getTaskStatusColor(task.status, taskStatuses);
  const isUnassigned = task.assigned_to == null;
  const isMine = Boolean(user?.id && task.assigned_to === user.id);
  const assigneeName =
    task.assigned_profile?.full_name?.trim() ||
    task.assigned_profile?.email?.trim() ||
    null;
  const isClaimedByOther = Boolean(task.assigned_to && user?.id && task.assigned_to !== user.id);

  const canWork = !readOnly && isMine;
  const isProofPhase = canWork && (PROOF_WORKFLOW_STATUSES as readonly string[]).includes(task.status);
  const isAwaitingSales = canWork && task.status === "Design Approval";
  const isPrintFilePhase = canWork && task.status === "Waiting for Print File";
  const showAwaitingSalesBadge =
    task.status === "Design Approval" && (readOnly ? true : isAwaitingSales);

  const fileUpload = useOrderFileUpload({
    orderId: task.order_id,
    clientName: order?.client_name ?? "Client",
    companyId: companyId || "",
    bucketName: "order-files",
  });

  const { data: fetchedOrderAttachments } = useQuery({
    queryKey: ["designer-order-attachments", task.order_id],
    enabled: !orderAttachmentsLoading && orderAttachmentsFromParent === undefined,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_attachments")
        .select("id, order_id, order_item_id, file_url, file_name, file_type, created_at")
        .eq("order_id", task.order_id)
        .in("file_type", ["client_reference", "design_mockup"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DesignerOrderAttachmentRow[];
    },
  });

  const rawAttachmentRows: DesignerOrderAttachmentRow[] =
    orderAttachmentsFromParent ?? fetchedOrderAttachments ?? [];

  const { clientReferences: clientRefRows, designMockups: mockupRows } = useMemo(
    () =>
      filterAttachmentsForDesignLineItem(
        { order_id: task.order_id, order_item_id: task.order_item_id },
        rawAttachmentRows
      ),
    [task.order_id, task.order_item_id, rawAttachmentRows]
  );

  const totalReferenceFiles = clientRefRows.length + mockupRows.length;

  const invalidateDesigner = () => {
    queryClient.invalidateQueries({ queryKey: ["designer-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["admin-design-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["designer-order-attachments"] });
    queryClient.invalidateQueries({ queryKey: ["designer-order-attachments-batch"] });
    queryClient.invalidateQueries({ queryKey: ["design-approvals"] });
    queryClient.invalidateQueries({ queryKey: ["design-approvals-mockups"] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
  };

  const startDesignMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("You must be signed in");

      const { data, error } = await supabase
        .from("order_tasks")
        .update({
          status: "In Progress",
          assigned_to: user.id,
          started_at: new Date().toISOString(),
        })
        .eq("id", task.id)
        .is("assigned_to", null)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("This task was just claimed by someone else. Refresh the list.");
    },
    onSuccess: () => {
      toast.success("Design started!");
      invalidateDesigner();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const uploadProofForApprovalMutation = useMutation({
    mutationFn: async () => {
      if (proofFiles.length === 0 || !companyId) throw new Error("Select at least one proof file.");
      if (!user?.id) throw new Error("Unauthorized");

      const uploadPromises = proofFiles.map((file) =>
        fileUpload.uploadFileAsync({
          file,
          fileType: "design_mockup",
          uploaderId: user.id,
          orderItemId: task.order_item_id,
        })
      );

      await Promise.all(uploadPromises);

      if (designerNotes.trim()) {
        await supabase.from("order_comments").insert({
          order_id: task.order_id,
          user_id: user.id,
          company_id: companyId,
          content: `[Design task — proof for approval — ${lineLabel}] ${designerNotes.trim()}`,
        });
      }

      const { data, error: taskError } = await supabase
        .from("order_tasks")
        .update({
          status: "Design Approval",
        })
        .eq("id", task.id)
        .eq("assigned_to", user.id)
        .in("status", ["In Progress", "Design Revision"])
        .select("id")
        .maybeSingle();

      if (taskError) throw taskError;
      if (!data) throw new Error("Could not submit proof (check task status and assignment).");

      return { fileNames: proofFiles.map((f) => f.name) };
    },
    onSuccess: (data) => {
      toast.success(
        data.fileNames.length === 1
          ? `Proof uploaded: ${data.fileNames[0]}. Awaiting sales approval.`
          : `${data.fileNames.length} proof file(s) uploaded. Awaiting sales approval.`
      );
      setProofFiles([]);
      setDesignerNotes("");
      invalidateDesigner();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const uploadPrintFileAndCompleteMutation = useMutation({
    mutationFn: async () => {
      if (printFiles.length === 0 || !companyId) throw new Error("Select at least one final print file.");
      if (!user?.id) throw new Error("Unauthorized");

      const uploadPromises = printFiles.map((file) =>
        fileUpload.uploadFileAsync({
          file,
          fileType: "print_file",
          uploaderId: user.id,
          orderItemId: task.order_item_id,
        })
      );

      await Promise.all(uploadPromises);

      const now = new Date().toISOString();
      const { data, error: taskError } = await supabase
        .from("order_tasks")
        .update({
          status: "Completed",
          completed_at: now,
        })
        .eq("id", task.id)
        .eq("assigned_to", user.id)
        .eq("status", "Waiting for Print File")
        .select("id")
        .maybeSingle();

      if (taskError) throw taskError;
      if (!data) throw new Error("Could not complete task (check task status and assignment).");

      return { fileNames: printFiles.map((f) => f.name) };
    },
    onSuccess: (data) => {
      toast.success(
        data.fileNames.length === 1
          ? `Print file uploaded. Task completed: ${data.fileNames[0]}`
          : `${data.fileNames.length} print file(s) uploaded. Task completed.`
      );
      setPrintFiles([]);
      invalidateDesigner();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const downloadAttachmentList = async (files: DesignerOrderAttachmentRow[]) => {
    if (!files.length) return;
    for (const file of files) {
      const link = document.createElement("a");
      link.href = file.file_url;
      link.download = file.file_name || "download";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    toast.success(`Downloaded ${files.length} file(s)`);
  };

  const handleDownloadAllReferenceFiles = async () => {
    if (totalReferenceFiles === 0) return;
    await downloadAttachmentList([...clientRefRows, ...mockupRows]);
  };

  const handleProofFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setProofFiles((prev) => [...prev, ...Array.from(files)]);
    }
  };

  const handlePrintFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setPrintFiles((prev) => [...prev, ...Array.from(files)]);
    }
  };

  const removeProofFile = (index: number) => {
    setProofFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removePrintFile = (index: number) => {
    setPrintFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const deliveryDate = order?.delivery_date ? new Date(order.delivery_date) : null;

  const orderLabel =
    order?.order_number != null
      ? `#${String(order.order_number).padStart(4, "0")}`
      : `#${task.order_id.slice(0, 8)}`;

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const assigneeChip = (() => {
    if (isUnassigned) {
      return (
        <Badge variant="secondary" className="text-[10px] font-medium uppercase tracking-wide">
          Unclaimed
        </Badge>
      );
    }
    if (isMine) {
      return (
        <Badge className="text-[10px] font-semibold uppercase tracking-wide bg-primary/10 text-primary hover:bg-primary/15 border-transparent">
          You
        </Badge>
      );
    }
    const initials = assigneeName ? getInitials(assigneeName) : "?";
    return (
      <Badge
        variant="outline"
        className="text-[10px] font-semibold tracking-wide"
        title={assigneeName ?? "Assigned"}
      >
        {initials}
      </Badge>
    );
  })();

  const handleCardSurfaceClick = (e: MouseEvent) => {
    if (!onOpenTaskDetail) return;
    const el = e.target as HTMLElement;
    if (el.closest("[data-task-card-stop]")) return;
    onOpenTaskDetail();
  };

  const urgencyBadge =
    order?.delivery_date &&
    (() => {
      const date = new Date(order.delivery_date);
      if (isToday(date)) {
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Due today {format(date, "h:mm a")}
          </Badge>
        );
      }
      if (isTomorrow(date)) {
        return (
          <Badge variant="default" className="bg-orange-500 hover:bg-orange-600 gap-1">
            <AlertCircle className="h-3 w-3" />
            Due tomorrow {format(date, "h:mm a")}
          </Badge>
        );
      }
      return (
        <Badge variant="outline" className="font-normal">
          {format(date, "EEE, MMM d • h:mm a")}
        </Badge>
      );
    })();

  const cardActive =
    !readOnly && isMine && (task.status === "In Progress" || task.status === "Design Revision");

  return (
    <Card
      className={cn(
        "overflow-hidden flex flex-col transition-shadow hover:shadow-lg",
        cardActive ? "ring-1" : "",
        onOpenTaskDetail && "cursor-pointer"
      )}
      style={
        cardActive
          ? {
              borderColor: `${statusColor}80`,
              boxShadow: `0 0 0 1px ${statusColor}33`,
            }
          : undefined
      }
      onClick={handleCardSurfaceClick}
    >
      <CardHeader className="pb-4 px-4 sm:px-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <CardTitle className="text-lg sm:text-xl font-bold shrink-0">{orderLabel}</CardTitle>
              <Badge variant="outline" className="text-xs font-normal truncate max-w-[min(100%,280px)]">
                {lineTitleShort}
              </Badge>
              {assigneeChip}
              {showAwaitingSalesBadge && (
                <Badge
                  variant="secondary"
                  className="text-[10px] border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100"
                >
                  ⏳ Sales
                </Badge>
              )}
            </div>
            {deliveryDate && (
              <Badge variant="outline" className="gap-1 shrink-0 w-fit">
                <Calendar className="h-3 w-3" />
                <span className="hidden sm:inline">{format(deliveryDate, "MMM d, yyyy • h:mm a")}</span>
                <span className="sm:hidden">{format(deliveryDate, "MMM d • h:mm a")}</span>
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} color={statusColor} className="text-[10px]" />
            {urgencyBadge}
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Assigned to:</span>{" "}
            {isUnassigned ? "---" : isMine ? "You" : assigneeName ?? "---"}
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-4 sm:px-6 pb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4 shrink-0" />
              <span className="font-medium">Client</span>
            </div>
            <p className="text-sm sm:text-base font-semibold ml-6 break-words">{order?.client_name ?? "—"}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Truck className="h-4 w-4 shrink-0" />
              <span className="font-medium">Delivery</span>
            </div>
            <p className="text-sm sm:text-base font-semibold ml-6">
              {deliveryDate ? (
                <>
                  <span className="hidden sm:inline">{format(deliveryDate, "EEEE, MMM d, yyyy • h:mm a")}</span>
                  <span className="sm:hidden">{format(deliveryDate, "MMM d, yyyy • h:mm a")}</span>
                </>
              ) : (
                "—"
              )}
            </p>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Package className="h-4 w-4 shrink-0" />
            This line item
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-background border rounded-lg">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {product?.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name_en ?? "Product"}
                  className="h-12 w-12 sm:h-14 sm:w-14 rounded-lg object-cover border shrink-0"
                />
              ) : (
                <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-lg bg-muted border shrink-0">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm sm:text-base truncate">{product?.name_en ?? "—"}</p>
                {product?.name_ar && (
                  <p className="text-xs text-muted-foreground truncate line-clamp-1" dir="rtl">
                    {product.name_ar}
                  </p>
                )}
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  {categoryLabel} · SKU: {product?.sku?.trim() || "—"} · Code:{" "}
                  {product?.product_code?.trim() || "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              <Badge variant="secondary" className="font-semibold text-sm">
                {line?.quantity ?? 0}×
              </Badge>
            </div>
          </div>
        </div>

        {order?.notes && (
          <>
            <Separator />
            <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900">
              <FileText className="h-4 w-4 text-yellow-800 dark:text-yellow-500" />
              <AlertDescription className="text-sm text-yellow-800 dark:text-yellow-500 ml-2">
                <strong className="font-semibold">Order notes:</strong>
                <p className="mt-1 whitespace-pre-wrap">{order.notes}</p>
              </AlertDescription>
            </Alert>
          </>
        )}

        <Separator />

        {orderAttachmentsLoading ? (
          <p className="text-xs text-muted-foreground" data-task-card-stop>
            Loading attachments…
          </p>
        ) : (
          (clientRefRows.length > 0 || mockupRows.length > 0) && (
            <div className="space-y-4" data-task-card-stop>
              {clientRefRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <FileText className="h-4 w-4 shrink-0" />
                    Client files
                  </div>
                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                    {clientRefRows.map((file) => (
                      <Button
                        key={file.id}
                        variant="outline"
                        size="sm"
                        className="h-auto min-h-10 gap-2 justify-start py-2 w-full sm:w-auto"
                        asChild
                      >
                        <a
                          href={file.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 min-w-0"
                        >
                          <Download className="h-4 w-4 shrink-0" />
                          <span className="truncate text-left flex-1 min-w-0">{file.file_name}</span>
                          {isOrderLevelAttachment(file) ? (
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0 h-5 shrink-0 font-normal whitespace-nowrap"
                            >
                              Order asset
                            </Badge>
                          ) : null}
                        </a>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {mockupRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <FileText className="h-4 w-4 shrink-0" />
                    Design mockups
                  </div>
                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                    {mockupRows.map((file) => (
                      <Button
                        key={file.id}
                        variant="outline"
                        size="sm"
                        className="h-auto min-h-10 gap-2 justify-start py-2 w-full sm:w-auto"
                        asChild
                      >
                        <a
                          href={file.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 min-w-0"
                        >
                          <Download className="h-4 w-4 shrink-0" />
                          <span className="truncate text-left flex-1 min-w-0">{file.file_name}</span>
                          {isOrderLevelAttachment(file) ? (
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0 h-5 shrink-0 font-normal whitespace-nowrap"
                            >
                              Order asset
                            </Badge>
                          ) : null}
                        </a>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {/* Order link + download all reference files */}
        <div className="flex items-center gap-2 flex-wrap" data-task-card-stop>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onOpenOrderDetails(task.order_id)}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            Order
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadAllReferenceFiles}
            disabled={totalReferenceFiles === 0 || orderAttachmentsLoading}
            className="h-8 px-2 text-xs ml-auto"
            title={`Client files + mockups for this line (${totalReferenceFiles})`}
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Files
            <span className="ml-1 text-muted-foreground">({totalReferenceFiles})</span>
          </Button>
        </div>

        {!readOnly && (
          <div className="space-y-3 pt-2 border-t border-border/60" data-task-card-stop>
            {isUnassigned && (
              <Button
                onClick={() => startDesignMutation.mutate()}
                disabled={startDesignMutation.isPending}
                className="w-full h-9 font-medium"
              >
                {startDesignMutation.isPending ? "Starting…" : "Start designing"}
              </Button>
            )}

            {isAwaitingSales && (
              <div className="flex items-start gap-2 text-xs bg-amber-500/10 border border-amber-500/30 rounded-md px-2.5 py-2 text-amber-900 dark:text-amber-100">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <p>Awaiting sales approval. Uploads locked until reviewed.</p>
              </div>
            )}

            {isProofPhase && (
              <>
                <div className="space-y-2">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Proof for review
                  </Label>
                  <Input
                    type="file"
                    onChange={handleProofFileSelect}
                    multiple
                    className="text-xs cursor-pointer h-9"
                  />

                  {proofFiles.length > 0 && (
                    <div className="space-y-1.5 max-h-28 overflow-y-auto">
                      {proofFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between gap-2 px-2 py-1.5 bg-muted/40 rounded-md border border-border/50 text-xs"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium text-foreground">{file.name}</p>
                            <p className="text-muted-foreground text-[10px]">{formatFileSize(file.size)}</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeProofFile(index)}
                            className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Textarea
                  value={designerNotes}
                  onChange={(e) => setDesignerNotes(e.target.value)}
                  placeholder="Notes for sales (optional)…"
                  rows={2}
                  className="text-xs min-h-[40px] resize-none"
                />

                <Button
                  onClick={() => uploadProofForApprovalMutation.mutate()}
                  disabled={proofFiles.length === 0 || uploadProofForApprovalMutation.isPending}
                  className="w-full h-9 font-medium"
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  {uploadProofForApprovalMutation.isPending
                    ? `Uploading ${proofFiles.length}…`
                    : "Upload proof"}
                </Button>
              </>
            )}

            {isPrintFilePhase && (
              <>
                <div className="flex items-start gap-2 text-xs bg-emerald-500/10 border border-emerald-500/30 rounded-md px-2.5 py-2 text-emerald-900 dark:text-emerald-100">
                  <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <p>
                    <span className="font-semibold">Approved.</span> Upload final print file to complete.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Final print file(s)
                  </Label>
                  <Input
                    type="file"
                    onChange={handlePrintFileSelect}
                    multiple
                    className="text-xs cursor-pointer h-9"
                  />
                  {printFiles.length > 0 && (
                    <div className="space-y-1.5 max-h-28 overflow-y-auto">
                      {printFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between gap-2 px-2 py-1.5 bg-muted/40 rounded-md border border-border/50 text-xs"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium text-foreground">{file.name}</p>
                            <p className="text-muted-foreground text-[10px]">{formatFileSize(file.size)}</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removePrintFile(index)}
                            className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => uploadPrintFileAndCompleteMutation.mutate()}
                  disabled={printFiles.length === 0 || uploadPrintFileAndCompleteMutation.isPending}
                  className="w-full h-9 font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  {uploadPrintFileAndCompleteMutation.isPending
                    ? `Uploading ${printFiles.length}…`
                    : "Upload final & complete"}
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    Package,
    User,
    Clock,
    CheckCircle2,
    History,
    Loader2,
    ChevronDown,
    Stethoscope,
    ArrowRight,
    ClipboardCheck,
    ImageIcon,
    ExternalLink,
    Pencil,
    FileText,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

/**
 * Centralized theme tokens for the Item Task Detail dialog.
 * Edit these in one place to restyle the whole surface app-wide.
 */
const ITD_THEME = {
    // Outer dialog shell
    contentClass:
        "max-w-[min(100vw-1rem,56rem)] sm:max-w-4xl w-full max-h-[92vh] p-0 gap-0 overflow-hidden flex flex-col rounded-xl",
    // Section padding (mobile-first → desktop)
    sectionX: "px-4 sm:px-6 lg:px-8",
    sectionY: "py-4 sm:py-5",
    // Section dividers
    divider: "border-b border-border/70",
    // Card grid (stack on mobile, 2-col on md+)
    cardGrid: "grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4",
    // Standard transition for hover/interactive surfaces
    transition: "transition-all duration-200 ease-out",
} as const;
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useTaskStatuses, getTaskStatusColor, type TaskStatus } from "@/hooks/useTaskStatuses";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OrderDetail } from "@/features/orders/types";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Item = OrderDetail["order_items"][number];

type TaskStatusRow = { name: string; color: string | null };

type TaskHistoryEmbed = {
    id: string;
    previous_status: string | null;
    new_status: string;
    created_at: string;
    changed_by: string | null;
    notes: string | null;
    actor?: { full_name: string | null } | null;
};

type EnrichedOrderTask = {
    id: string;
    task_type: string;
    status: string;
    started_at: string | null;
    completed_at: string | null;
    assigned_to: string | null;
    assigned_profile: { id: string; full_name: string | null; email: string | null } | null;
    task_status: TaskStatusRow | null;
    task_status_history?: TaskHistoryEmbed[] | null;
};

type HistoryRow = {
    id: string;
    task_id: string;
    task_type: string;
    previous_status: string | null;
    new_status: string;
    created_at: string;
    changed_by: string | null;
    notes: string | null;
    actor_name: string;
};

type HistoryEntry = HistoryRow & { untilIso: string | null };

interface ItemTaskDetailDialogProps {
    item: Item | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const DESIGN_STATUS_OPTIONS = [
    "Pending",
    "In Progress",
    "Design Approval",
    "Design Revision",
    "Waiting for Print File",
    "Completed",
];
const PRODUCTION_STATUS_OPTIONS = ["Blocked", "Pending", "In Progress", "Completed"];

const UNASSIGNED = "__unassigned__";

/** Thumbnail + lightbox: raster images only (.jpg / .jpeg / .png / .webp). */
function isRasterImageMockup(fileUrl: string, fileName: string) {
    const combined = `${fileUrl.split("?")[0]} ${fileName}`.toLowerCase();
    return /\.(jpe?g|png|webp)(\?|$|\s)/i.test(combined);
}

function resolveTaskColor(task: EnrichedOrderTask | undefined, statuses: TaskStatus[] | undefined) {
    if (!task) return "#64748b";
    const hex = task.task_status?.color?.trim();
    if (hex) return hex;
    return getTaskStatusColor(task.status, statuses);
}

function taskTypeLabel(taskType: string): string {
    if (taskType === "design") return "Design Task";
    if (taskType === "production") return "Production Task";
    return taskType ? `${taskType} task` : "Task";
}

function formatStayDuration(fromIso: string, toIso: string | null): string {
    const from = new Date(fromIso).getTime();
    const to = toIso ? new Date(toIso).getTime() : Date.now();
    const ms = Math.max(0, to - from);
    if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
    const mins = Math.floor(ms / 60_000);
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h < 48) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
}

export function ItemTaskDetailDialog({ item, open, onOpenChange }: ItemTaskDetailDialogProps) {
    const { user } = useAuth();
    const { role, companyId, loading: roleLoading } = useUserRole();
    const isAdmin = role === "admin";
    const canSalesReviewDesign = !roleLoading && (role === "admin" || role === "sales");
    const { data: taskStatuses } = useTaskStatuses();
    const queryClient = useQueryClient();
    const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
    const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
    const [revisionNotes, setRevisionNotes] = useState("");
    const [mockupLightbox, setMockupLightbox] = useState<{ url: string; name: string } | null>(null);

    useEffect(() => {
        if (!open) {
            setRevisionDialogOpen(false);
            setRevisionNotes("");
            setMockupLightbox(null);
        }
    }, [open]);

    const { data: itemTasks = [], isLoading: tasksLoading } = useQuery({
        queryKey: ["order-item-task-detail", item?.id],
        enabled: !!item?.id && open,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("order_tasks")
                .select(
                    `
          id,
          task_type,
          status,
          started_at,
          completed_at,
          assigned_to,
          assigned_profile:profiles!order_tasks_assigned_to_fkey(id, full_name, email),
          task_status:task_statuses!order_tasks_status_fkey(name, color),
          task_status_history (
            id,
            previous_status,
            new_status,
            created_at,
            changed_by,
            notes,
            actor:profiles!task_status_history_changed_by_fkey(full_name)
          )
        `
                )
                .eq("order_item_id", item!.id);
            if (error) throw error;
            return (data ?? []) as EnrichedOrderTask[];
        },
    });

    /** Unified timeline: design + production histories, merged and sorted newest-first (DESC). */
    const history = useMemo((): HistoryEntry[] => {
        const flat: HistoryRow[] = [];
        for (const t of itemTasks) {
            for (const h of t.task_status_history ?? []) {
                const actorName = h.actor?.full_name?.trim()
                    ? h.actor.full_name
                    : h.changed_by
                      ? "Unknown"
                      : "System";
                flat.push({
                    id: h.id,
                    task_id: t.id,
                    task_type: t.task_type,
                    previous_status: h.previous_status,
                    new_status: h.new_status,
                    created_at: h.created_at,
                    changed_by: h.changed_by,
                    notes: h.notes,
                    actor_name: actorName,
                });
            }
        }
        const asc = [...flat].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const withUntil = asc.map((entry, i) => ({
            ...entry,
            untilIso: asc[i + 1]?.created_at ?? null,
        }));
        return withUntil.reverse();
    }, [itemTasks]);

    const { data: staff = [], isLoading: staffLoading } = useQuery({
        queryKey: ["company-staff-assign", companyId],
        enabled: open && isAdmin && !!companyId,
        queryFn: async () => {
            const { data: profiles, error: pErr } = await supabase
                .from("profiles")
                .select("id, full_name, email")
                .eq("company_id", companyId!)
                .order("full_name");
            if (pErr) throw pErr;
            const { data: roles, error: rErr } = await supabase
                .from("user_roles")
                .select("user_id, role")
                .eq("company_id", companyId!);
            if (rErr) throw rErr;
            const roleMap = new Map((roles || []).map((r) => [r.user_id, r.role]));
            return (profiles || []).map((p) => ({
                ...p,
                role: roleMap.get(p.id) ?? null,
            }));
        },
    });

    const updateTaskStatus = useMutation({
        mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
            setPendingTaskId(taskId);
            const patch: { status: string; completed_at?: string | null; started_at?: string | null } = { status };
            if (status === "Completed") patch.completed_at = new Date().toISOString();
            if (status === "In Progress") patch.started_at = new Date().toISOString();
            const { error } = await supabase.from("order_tasks").update(patch).eq("id", taskId);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Task status updated");
            if (item.order_id) {
                queryClient.invalidateQueries({ queryKey: ["order-details", item.order_id] });
            } else {
                queryClient.invalidateQueries({ queryKey: ["order-details"] });
            }
            queryClient.invalidateQueries({ queryKey: ["order-item-task-detail", item.id] });
            queryClient.invalidateQueries({ queryKey: ["admin-design-tasks"] });
        },
        onError: (err: Error) => toast.error(err.message || "Failed to update task"),
        onSettled: () => setPendingTaskId(null),
    });

    const updateAssignee = useMutation({
        mutationFn: async ({ taskId, assignedTo }: { taskId: string; assignedTo: string | null }) => {
            const { error } = await supabase.from("order_tasks").update({ assigned_to: assignedTo }).eq("id", taskId);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Assignee updated");
            if (item.order_id) {
                queryClient.invalidateQueries({ queryKey: ["order-details", item.order_id] });
            } else {
                queryClient.invalidateQueries({ queryKey: ["order-details"] });
            }
            queryClient.invalidateQueries({ queryKey: ["order-item-task-detail", item.id] });
            queryClient.invalidateQueries({ queryKey: ["admin-design-tasks"] });
        },
        onError: (err: Error) => toast.error(err.message || "Failed to update assignee"),
    });

    const designTask = useMemo((): EnrichedOrderTask | undefined => {
        if (!item) return undefined;
        const fromQuery = itemTasks.find((t) => t.task_type === "design");
        if (fromQuery) return fromQuery;
        const p = item.order_tasks?.find((t) => t.task_type === "design");
        if (!p) return undefined;
        const ap = p.assigned_profile;
        return {
            id: p.id,
            task_type: "design",
            status: p.status,
            started_at: p.started_at ?? null,
            completed_at: p.completed_at ?? null,
            assigned_to: p.assigned_to ?? null,
            assigned_profile: ap
                ? {
                      id: (ap as { id?: string }).id ?? p.assigned_to ?? "",
                      full_name: ap.full_name ?? null,
                      email: ap.email ?? null,
                  }
                : null,
            task_status: p.task_status ? { name: p.task_status.name, color: p.task_status.color } : null,
            task_status_history: null,
        };
    }, [item, itemTasks]);

    const productionTask = itemTasks.find((t) => t.task_type === "production");
    const orderIdForMockups = item?.order_id ?? "";

    const showReviewDesignSection = Boolean(
        item &&
            canSalesReviewDesign &&
            item.needs_design !== false &&
            designTask?.status === "Design Approval" &&
            designTask?.id
    );

    const lineItemIdForMockups = item?.id;

    const { data: designMockups = [], isLoading: mockupsLoading } = useQuery({
        queryKey: ["order-design-mockups", orderIdForMockups, lineItemIdForMockups],
        enabled: open && !!orderIdForMockups && !!lineItemIdForMockups && showReviewDesignSection,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("order_attachments")
                .select("id, file_url, file_name, created_at")
                .eq("order_id", orderIdForMockups)
                .eq("order_item_id", lineItemIdForMockups!)
                .eq("file_type", "design_mockup")
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data ?? [];
        },
    });

    const invalidateAfterSalesDesignDecision = useCallback(() => {
        const oid = item?.order_id;
        if (oid) {
            queryClient.invalidateQueries({ queryKey: ["order-details", oid] });
        } else {
            queryClient.invalidateQueries({ queryKey: ["order-details"] });
        }
        const iid = item?.id;
        if (iid) {
            queryClient.invalidateQueries({ queryKey: ["order-item-task-detail", iid] });
        }
        queryClient.invalidateQueries({ queryKey: ["design-approvals"] });
        queryClient.invalidateQueries({ queryKey: ["design-approvals-mockups"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-pending-design-approvals"] });
        queryClient.invalidateQueries({ queryKey: ["designer-tasks"] });
        queryClient.invalidateQueries({ queryKey: ["admin-design-tasks"] });
        queryClient.invalidateQueries({ queryKey: ["orders"] });
        if (orderIdForMockups && iid) {
            queryClient.invalidateQueries({ queryKey: ["order-design-mockups", orderIdForMockups, iid] });
            queryClient.invalidateQueries({ queryKey: ["order-attachments", orderIdForMockups] });
        }
    }, [item?.order_id, item?.id, orderIdForMockups, queryClient]);

    const approveDesignMutation = useMutation({
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
            toast.success("Design approved. Designer notified.");
            invalidateAfterSalesDesignDecision();
        },
        onError: (e: Error) => toast.error(e.message || "Approve failed"),
    });

    const requestDesignRevisionMutation = useMutation({
        mutationFn: async ({ taskId, notes }: { taskId: string; notes: string }) => {
            const trimmed = notes.trim();
            if (!trimmed) throw new Error("Please add notes for the designer.");

            const { data: ok, error: rpcErr } = await supabase.rpc("set_order_task_status_with_notes", {
                p_task_id: taskId,
                p_new_status: "Design Revision",
                p_notes: `[Sales revision] ${trimmed}`,
                p_only_if_task_type: "design",
                p_only_if_status: "Design Approval",
            });
            if (rpcErr) throw rpcErr;
            if (!ok) throw new Error("Could not update task. It may no longer be awaiting approval.");

            const oid = item?.order_id;
            if (user?.id && companyId && oid) {
                const { error: cErr } = await supabase.from("order_comments").insert({
                    order_id: oid,
                    user_id: user.id,
                    company_id: companyId,
                    content: `[Sales — design revision requested] ${trimmed}`,
                    is_internal: true,
                });
                if (cErr) throw cErr;
            }
        },
        onSuccess: () => {
            toast.success("Revision requested.");
            setRevisionDialogOpen(false);
            setRevisionNotes("");
            invalidateAfterSalesDesignDecision();
        },
        onError: (e: Error) => toast.error(e.message || "Request failed"),
    });

    if (!item) return null;

    const renderTaskCard = (
        title: string,
        task: EnrichedOrderTask | undefined,
        options: string[],
        skipped?: boolean
    ) => {
        if (skipped) {
            return (
                <Card className="bg-muted/30 border-dashed">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-sm text-muted-foreground italic">Skipped — design not required</span>
                    </CardContent>
                </Card>
            );
        }

        if (!task) {
            return (
                <Card className="bg-muted/30">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-sm text-muted-foreground italic">No task created</span>
                    </CardContent>
                </Card>
            );
        }

        const color = resolveTaskColor(task, taskStatuses);
        const assignee = task.assigned_profile?.full_name;
        const isLoading = pendingTaskId === task.id;

        return (
            <Card className="shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">{title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                        {isAdmin ? (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <button
                                        type="button"
                                        className="rounded-md hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 inline-flex items-center gap-1.5"
                                        disabled={isLoading}
                                    >
                                        <StatusBadge status={task.status} color={color} />
                                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                        {isLoading && (
                                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                        )}
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 p-2" align="start">
                                    <div className="text-xs font-semibold text-muted-foreground px-2 py-1.5">
                                        Override status
                                    </div>
                                    <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto">
                                        {options.map((opt) => {
                                            const optColor = getTaskStatusColor(opt, taskStatuses);
                                            const isCurrent = opt === task.status;
                                            return (
                                                <Button
                                                    key={opt}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="justify-start h-8 px-2"
                                                    disabled={isCurrent || isLoading}
                                                    onClick={() =>
                                                        updateTaskStatus.mutate({ taskId: task.id, status: opt })
                                                    }
                                                >
                                                    <span
                                                        className="h-2 w-2 rounded-full mr-2 shrink-0"
                                                        style={{ backgroundColor: optColor }}
                                                    />
                                                    <span className={isCurrent ? "font-semibold" : ""}>{opt}</span>
                                                </Button>
                                            );
                                        })}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        ) : (
                            <StatusBadge status={task.status} color={color} />
                        )}
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 gap-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-3.5 w-3.5 shrink-0" />
                            <span className="text-xs shrink-0">Assigned:</span>
                            <span className="text-foreground font-medium truncate">{assignee || "Unassigned"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            <span className="text-xs shrink-0">Started:</span>
                            <span className="text-foreground">
                                {task.started_at ? format(new Date(task.started_at), "MMM d, yyyy · HH:mm") : "—"}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            <span className="text-xs shrink-0">Completed:</span>
                            <span className="text-foreground">
                                {task.completed_at ? format(new Date(task.completed_at), "MMM d, yyyy · HH:mm") : "—"}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    };

    const renderAssigneeSelect = (label: string, task: EnrichedOrderTask | undefined, skipped?: boolean) => {
        if (skipped || !task) return null;
        const val = task.assigned_to ?? UNASSIGNED;
        return (
            <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Select
                    value={val}
                    disabled={staffLoading || updateAssignee.isPending}
                    onValueChange={(v) => {
                        const assignedTo = v === UNASSIGNED ? null : v;
                        updateAssignee.mutate({ taskId: task.id, assignedTo });
                    }}
                >
                    <SelectTrigger className="h-9 text-left">
                        <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                        {staff.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                                <span className="truncate">
                                    {m.full_name || m.email || m.id}
                                    {m.role ? (
                                        <span className="text-muted-foreground text-xs ml-1">({m.role})</span>
                                    ) : null}
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        );
    };

    return (
        <>
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={cn(ITD_THEME.contentClass)}>
                <DialogHeader
                    className={cn(
                        ITD_THEME.sectionX,
                        "pt-5 sm:pt-6 pb-4 shrink-0 text-left space-y-1 sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85",
                        ITD_THEME.divider
                    )}
                >
                    <div className="flex flex-col sm:flex-row items-start gap-4">
                        {item.product.image_url ? (
                            <img
                                src={item.product.image_url}
                                alt={item.product.name_en}
                                className={cn(
                                    "h-16 w-16 sm:h-20 sm:w-20 rounded-lg object-cover border shrink-0",
                                    ITD_THEME.transition,
                                    "hover:shadow-md"
                                )}
                            />
                        ) : (
                            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-lg bg-muted flex items-center justify-center border shrink-0">
                                <Package className="h-7 w-7 text-muted-foreground" />
                            </div>
                        )}
                        <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                                <Stethoscope className="h-4 w-4 text-primary shrink-0" />
                                <DialogTitle className="text-lg sm:text-xl leading-tight">
                                    Line item record
                                </DialogTitle>
                            </div>
                            <DialogDescription className="text-left">
                                <span className="font-medium text-foreground block truncate text-sm sm:text-base">
                                    {item.product.name_en}
                                </span>
                                <span className="block text-xs mt-1 text-muted-foreground">
                                    SKU: {item.product.sku}
                                    {item.product.product_code ? <> · {item.product.product_code}</> : null} · Qty:{" "}
                                    {item.quantity}
                                </span>
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                    {showReviewDesignSection && designTask && (
                        <div
                            className={cn(
                                ITD_THEME.sectionX,
                                ITD_THEME.sectionY,
                                ITD_THEME.divider,
                                "bg-violet-50/70 dark:bg-violet-950/35"
                            )}
                        >
                            <div className="rounded-xl border-2 border-violet-400/70 dark:border-violet-600 bg-card p-4 shadow-md space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="rounded-lg bg-violet-600 text-white p-2 shrink-0 shadow-sm">
                                        <ClipboardCheck className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <h2 className="text-base font-semibold tracking-tight">Review Design</h2>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            Proofs for this order are shown below. Approve to continue to print file, or
                                            request a revision with notes for the designer.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                        Mockups & proofs
                                    </div>
                                    {!orderIdForMockups ? (
                                        <p className="text-sm text-muted-foreground italic">
                                            This line item is missing an order reference; mockups cannot be loaded.
                                        </p>
                                    ) : mockupsLoading ? (
                                        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground border rounded-lg border-dashed bg-muted/20">
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            Loading attachments…
                                        </div>
                                    ) : designMockups.length === 0 ? (
                                        <div className="flex items-center gap-2 rounded-lg border border-dashed p-6 text-sm text-muted-foreground justify-center bg-muted/15">
                                            <ImageIcon className="h-5 w-5 shrink-0" />
                                            No design mockup files on this order yet.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {designMockups.map((m) => {
                                                const isRaster = isRasterImageMockup(m.file_url, m.file_name);
                                                return isRaster ? (
                                                    <button
                                                        key={m.id}
                                                        type="button"
                                                        onClick={() =>
                                                            setMockupLightbox({ url: m.file_url, name: m.file_name })
                                                        }
                                                        className="group relative rounded-lg border bg-muted/30 overflow-hidden aspect-square flex items-center justify-center hover:bg-muted/50 hover:ring-2 hover:ring-violet-400/60 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                    >
                                                        <img
                                                            src={m.file_url}
                                                            alt={m.file_name}
                                                            className="h-full w-full object-cover"
                                                        />
                                                        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-2">
                                                            <span className="text-[10px] text-white font-medium truncate block text-left">
                                                                {m.file_name}
                                                            </span>
                                                        </span>
                                                        <span className="absolute top-1 right-1 rounded bg-black/50 px-1 py-0.5 text-[9px] uppercase text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                                            View full
                                                        </span>
                                                    </button>
                                                ) : (
                                                    <a
                                                        key={m.id}
                                                        href={m.file_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="group relative rounded-lg border bg-muted/30 overflow-hidden aspect-square flex flex-col items-center justify-center gap-2 p-3 hover:bg-muted/50 transition-colors"
                                                    >
                                                        <FileText className="h-10 w-10 text-muted-foreground shrink-0" />
                                                        <span className="text-xs text-center font-medium text-foreground line-clamp-3 break-all">
                                                            {m.file_name}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                            Open file
                                                            <ExternalLink className="h-3 w-3" />
                                                        </span>
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col gap-3 pt-1">
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="flex-1 border-amber-500/80 text-amber-800 bg-amber-50 hover:bg-amber-100 dark:text-amber-200 dark:bg-amber-950/40 dark:hover:bg-amber-950/70 dark:border-amber-600"
                                            onClick={() => {
                                                setRevisionNotes("");
                                                setRevisionDialogOpen(true);
                                            }}
                                            disabled={
                                                approveDesignMutation.isPending || requestDesignRevisionMutation.isPending
                                            }
                                        >
                                            <Pencil className="h-4 w-4" />
                                            Request Revision
                                        </Button>
                                        <Button
                                            type="button"
                                            className="flex-1 bg-emerald-600 text-white hover:bg-emerald-600/90 shadow-sm"
                                            onClick={() => approveDesignMutation.mutate(designTask.id)}
                                            disabled={
                                                approveDesignMutation.isPending || requestDesignRevisionMutation.isPending
                                            }
                                        >
                                            {approveDesignMutation.isPending ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <CheckCircle2 className="h-4 w-4" />
                                            )}
                                            Approve Design
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {isAdmin && (
                        <div
                            className={cn(
                                ITD_THEME.sectionX,
                                ITD_THEME.sectionY,
                                ITD_THEME.divider,
                                "bg-muted/40 space-y-3"
                            )}
                        >
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                <User className="h-3.5 w-3.5" />
                                Assignment (admin)
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {renderAssigneeSelect("Design task", designTask, item.needs_design === false)}
                                {renderAssigneeSelect("Production task", productionTask)}
                            </div>
                        </div>
                    )}

                    <div className={cn(ITD_THEME.sectionX, ITD_THEME.sectionY, "space-y-6")}>
                        {tasksLoading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <div className={ITD_THEME.cardGrid}>
                                {renderTaskCard(
                                    "Design",
                                    designTask,
                                    DESIGN_STATUS_OPTIONS,
                                    item.needs_design === false
                                )}
                                {renderTaskCard("Production", productionTask, PRODUCTION_STATUS_OPTIONS)}
                            </div>
                        )}

                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <History className="h-4 w-4 text-primary" />
                                <h3 className="text-sm font-semibold">Audit trail</h3>
                                <span className="text-xs text-muted-foreground">(task status history)</span>
                            </div>
                            {tasksLoading ? (
                                <div className="flex items-center justify-center py-10">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                            ) : history.length === 0 ? (
                                <div className="text-sm text-muted-foreground italic text-center py-8 border rounded-lg bg-muted/20">
                                    No history recorded yet.
                                </div>
                            ) : (
                                <div className="relative pl-6 border-l-2 border-border/80 ml-1.5 space-y-0">
                                    {history.map((entry) => {
                                        const prevColor = entry.previous_status
                                            ? getTaskStatusColor(entry.previous_status, taskStatuses)
                                            : undefined;
                                        const newColor = getTaskStatusColor(entry.new_status, taskStatuses);
                                        const durationLabel = formatStayDuration(entry.created_at, entry.untilIso);
                                        const ongoing = !entry.untilIso;

                                        return (
                                            <div key={entry.id} className="relative pb-8 last:pb-2">
                                                <span
                                                    className="absolute -left-[calc(0.75rem+5px)] top-1.5 h-3 w-3 rounded-full border-2 border-background shadow-sm z-10"
                                                    style={{ backgroundColor: newColor }}
                                                />
                                                <div className="space-y-2 pl-1">
                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                                                        <span className="text-sm font-semibold text-foreground shrink-0">
                                                            {taskTypeLabel(entry.task_type)}:
                                                        </span>
                                                        {entry.previous_status ? (
                                                            <StatusBadge
                                                                status={entry.previous_status}
                                                                color={prevColor}
                                                                className="text-xs font-normal"
                                                            />
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground italic">
                                                                (initial)
                                                            </span>
                                                        )}
                                                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                        <StatusBadge
                                                            status={entry.new_status}
                                                            color={newColor}
                                                            className="text-xs font-normal"
                                                        />
                                                    </div>
                                                    <div className="text-xs text-muted-foreground space-y-0.5">
                                                        <div>
                                                            Changed by{" "}
                                                            <span className="text-foreground font-medium">
                                                                {entry.actor_name}
                                                            </span>
                                                            <span className="mx-1">·</span>
                                                            <time dateTime={entry.created_at}>
                                                                {format(new Date(entry.created_at), "MMM d, yyyy HH:mm")}
                                                            </time>
                                                            <span className="mx-1 text-border">|</span>
                                                            <span className="text-foreground/90">
                                                                {ongoing
                                                                    ? `In this state (ongoing): ${durationLabel}`
                                                                    : `Duration in this state: ${durationLabel}`}
                                                            </span>
                                                        </div>
                                                        {entry.notes ? (
                                                            <div className="text-[11px] italic border-l-2 border-muted pl-2">
                                                                {entry.notes}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>

        <Dialog
            open={!!mockupLightbox}
            onOpenChange={(o) => {
                if (!o) setMockupLightbox(null);
            }}
        >
            <DialogContent className="max-w-[min(100vw-2rem,56rem)] max-h-[90vh] p-0 gap-0 overflow-hidden sm:max-w-4xl">
                <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
                    <DialogTitle className="text-base truncate pr-8">{mockupLightbox?.name ?? "Preview"}</DialogTitle>
                    <DialogDescription className="sr-only">Full-size mockup preview</DialogDescription>
                </DialogHeader>
                <div className="px-6 pb-6 flex items-center justify-center bg-muted/30 min-h-[200px] max-h-[calc(90vh-6rem)]">
                    {mockupLightbox ? (
                        <img
                            src={mockupLightbox.url}
                            alt={mockupLightbox.name}
                            className="max-h-[calc(90vh-7rem)] w-auto max-w-full object-contain rounded-md shadow-sm"
                        />
                    ) : null}
                </div>
                <DialogFooter className="px-6 pb-4 sm:justify-between gap-2 border-t bg-background/95">
                    {mockupLightbox ? (
                        <Button type="button" variant="outline" size="sm" asChild>
                            <a href={mockupLightbox.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                                Open in new tab
                            </a>
                        </Button>
                    ) : (
                        <span />
                    )}
                    <Button type="button" size="sm" onClick={() => setMockupLightbox(null)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={revisionDialogOpen} onOpenChange={setRevisionDialogOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Request revision</DialogTitle>
                    <DialogDescription>
                        Explain what should change. This is saved on the order and in the task audit trail.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-2">
                    <Label htmlFor="sales-revision-notes-dialog">Notes for the designer</Label>
                    <Textarea
                        id="sales-revision-notes-dialog"
                        placeholder="Describe required changes…"
                        value={revisionNotes}
                        onChange={(e) => setRevisionNotes(e.target.value)}
                        rows={4}
                        className="resize-none text-sm"
                    />
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button type="button" variant="outline" onClick={() => setRevisionDialogOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        className="bg-amber-600 hover:bg-amber-600/90 text-white"
                        disabled={
                            requestDesignRevisionMutation.isPending ||
                            approveDesignMutation.isPending ||
                            !designTask
                        }
                        onClick={() => {
                            if (!designTask) return;
                            requestDesignRevisionMutation.mutate({
                                taskId: designTask.id,
                                notes: revisionNotes,
                            });
                        }}
                    >
                        {requestDesignRevisionMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        Submit revision
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}

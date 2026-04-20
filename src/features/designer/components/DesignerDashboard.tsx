import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CheckCircle, FileText, AlertCircle, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo, useState } from "react";
import { OrderDetails } from "@/features/orders/components/OrderDetails";
import { DesignerTaskCard } from "@/features/designer/components/DesignerTaskCard";
import { useAuth } from "@/hooks/useAuth";
import type { DesignerTaskListRow } from "@/features/designer/types";
import { DESIGN_TASK_LIST_SELECT } from "@/features/designer/designerTaskSelect";
import type { DesignerOrderAttachmentRow } from "@/features/designer/designerAttachmentUtils";

export const DesignerDashboard = () => {
    const { user, loading: authLoading } = useAuth();
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    const {
        data: designerTasks,
        isLoading: isLoadingDesignerTasks
    } = useQuery({
        queryKey: ["designer-tasks"],
        enabled: Boolean(user?.id),
        queryFn: async () => {
            if (!user?.id) return [];

            const { data, error } = await supabase
                .from("order_tasks")
                .select(DESIGN_TASK_LIST_SELECT)
                .eq("task_type", "design")
                .neq("status", "Completed")
                .order("created_at", { ascending: true });

            if (error) throw error;
            const rows = (data ?? []) as DesignerTaskListRow[];
            return [...rows].sort((a, b) => {
                const da = a.order?.delivery_date ? new Date(a.order.delivery_date).getTime() : 0;
                const db = b.order?.delivery_date ? new Date(b.order.delivery_date).getTime() : 0;
                return da - db;
            });
        }
    });

    const orderIdsForAttachments = useMemo(() => {
        const ids = designerTasks?.map((t) => t.order_id) ?? [];
        return [...new Set(ids)].sort();
    }, [designerTasks]);

    const {
        data: attachmentsBatch,
        isFetched: attachmentsFetched,
    } = useQuery({
        queryKey: ["designer-order-attachments-batch", orderIdsForAttachments.join(",")],
        enabled: Boolean(designerTasks?.length) && orderIdsForAttachments.length > 0,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("order_attachments")
                .select("id, order_id, order_item_id, file_url, file_name, file_type, created_at")
                .in("order_id", orderIdsForAttachments)
                .in("file_type", ["client_reference", "design_mockup"]);
            if (error) throw error;
            return (data ?? []) as DesignerOrderAttachmentRow[];
        },
    });

    const attachmentsByOrderId = useMemo(() => {
        const map = new Map<string, DesignerOrderAttachmentRow[]>();
        for (const id of orderIdsForAttachments) {
            map.set(id, []);
        }
        for (const row of attachmentsBatch ?? []) {
            map.get(row.order_id)?.push(row);
        }
        return map;
    }, [attachmentsBatch, orderIdsForAttachments]);

    const designerStats = useMemo(() => {
        if (!designerTasks || !user?.id) return [];

        const unclaimed = designerTasks.filter((t) => t.assigned_to == null).length;
        const mine = designerTasks.filter((t) => t.assigned_to === user.id).length;
        const mineInProgress = designerTasks.filter(
            (t) => t.assigned_to === user.id && t.status === "In Progress"
        ).length;
        const total = designerTasks.length;

        return [
            {
                title: "Open queue",
                value: total.toString(),
                icon: FileText,
                change: "Open design tasks in the pool",
            },
            {
                title: "Unclaimed",
                value: unclaimed.toString(),
                icon: Clock,
                change: "Available to pick up",
            },
            {
                title: "Yours",
                value: mine.toString(),
                icon: User,
                change: "Assigned to you (any status)",
            },
            {
                title: "In progress",
                value: mineInProgress.toString(),
                icon: AlertCircle,
                change: "You are actively designing",
                highlight: mineInProgress > 0,
            },
        ];
    }, [designerTasks, user?.id]);

    const handleOpenOrderDetails = (orderId: string) => {
        setSelectedOrderId(orderId);
        setIsDetailsOpen(true);
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground">Designer Workspace</h1>
                <p className="text-muted-foreground">
                    Claim and work on design tasks by line item — multiple designers can share one order.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {authLoading || !user?.id || isLoadingDesignerTasks ? (
                    <>
                        {[1, 2, 3, 4].map((i) => (
                            <Card key={i}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-4 w-4" />
                                </CardHeader>
                                <CardContent>
                                    <Skeleton className="h-8 w-16 mb-2" />
                                    <Skeleton className="h-3 w-32" />
                                </CardContent>
                            </Card>
                        ))}
                    </>
                ) : (
                    designerStats.map((stat) => (
                        <Card key={stat.title} className={stat.highlight ? "border-orange-500" : ""}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                                <stat.icon
                                    className={`h-4 w-4 ${stat.highlight ? "text-orange-500" : "text-muted-foreground"}`}
                                />
                            </CardHeader>
                            <CardContent>
                                <div
                                    className={`text-2xl font-bold ${stat.highlight ? "text-orange-500" : ""}`}
                                >
                                    {stat.value}
                                </div>
                                <p className="text-xs text-muted-foreground">{stat.change}</p>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            <Card className="bg-background/60 backdrop-blur">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Design task pool
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoadingDesignerTasks ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-32 w-full" />
                            ))}
                        </div>
                    ) : designerTasks && designerTasks.length > 0 ? (
                        <div className="flex flex-col gap-3">
                            {designerTasks.map((task) => (
                                <DesignerTaskCard
                                    key={task.id}
                                    task={task}
                                    onOpenOrderDetails={handleOpenOrderDetails}
                                    orderAttachments={
                                        attachmentsFetched && designerTasks.length > 0
                                            ? attachmentsByOrderId.get(task.order_id) ?? []
                                            : undefined
                                    }
                                    orderAttachmentsLoading={
                                        Boolean(designerTasks.length) &&
                                        orderIdsForAttachments.length > 0 &&
                                        !attachmentsFetched
                                    }
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">No design tasks pending. Great work!</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <OrderDetails
                orderId={selectedOrderId || ""}
                open={isDetailsOpen}
                onOpenChange={(open) => {
                    setIsDetailsOpen(open);
                    if (!open) setSelectedOrderId(null);
                }}
            />
        </div>
    );
};

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Palette, Wrench, ChevronRight } from "lucide-react";
import { OrderDetail } from "@/features/orders/types";
import { formatCurrency } from "@/utils/formatCurrency";
import { useUserRole } from "@/hooks/useUserRole";
import { useTaskStatuses, getTaskStatusColor } from "@/hooks/useTaskStatuses";
import { useState } from "react";
import { ItemTaskDetailDialog } from "./ItemTaskDetailDialog";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface OrderItemsTableProps {
    items: OrderDetail["order_items"];
    totalPrice: number;
    currency?: string;
}

type TaskRow = NonNullable<OrderDetail["order_items"][number]["order_tasks"]>[number];

export function OrderItemsTable({ items, totalPrice, currency }: OrderItemsTableProps) {
    const { role, loading: roleLoading } = useUserRole();
    const { data: taskStatuses } = useTaskStatuses();

    const canViewFinancials = !roleLoading && ["admin", "sales", "accountant"].includes(role || "");
    const canSalesReviewDesign = !roleLoading && (role === "admin" || role === "sales");

    const [activeItem, setActiveItem] = useState<OrderDetail["order_items"][number] | null>(null);

    const renderStatusDot = (
        Icon: typeof Palette,
        label: string,
        task: TaskRow | undefined,
        skipped?: boolean,
        attention?: { pulseApproval: boolean; needsActionLabel: boolean }
    ) => {
        if (skipped) {
            return (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Icon className="h-3.5 w-3.5" />
                            <span className="italic">Skipped</span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>{label}: Skipped</TooltipContent>
                </Tooltip>
            );
        }
        if (!task) {
            return (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Icon className="h-3.5 w-3.5 opacity-50" />
                            <span>—</span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>{label}: not started</TooltipContent>
                </Tooltip>
            );
        }
        const color =
            task.task_status?.color?.trim() || getTaskStatusColor(task.status, taskStatuses);
        const pulseApproval = Boolean(attention?.pulseApproval);
        const showNeedsAction = Boolean(attention?.needsActionLabel);
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="inline-flex items-center gap-1.5 flex-wrap max-w-[200px]">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span
                            className={cn(
                                "h-2.5 w-2.5 rounded-full ring-2 ring-background shrink-0",
                                pulseApproval && "animate-pulse"
                            )}
                            style={{ backgroundColor: color }}
                        />
                        <span className="text-xs font-medium truncate max-w-[110px]">{task.status}</span>
                        {showNeedsAction && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 shrink-0">
                                Needs action
                            </span>
                        )}
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <div className="text-xs">
                        <div className="font-semibold">{label}</div>
                        <div>{task.status}</div>
                        {task.assigned_profile?.full_name && (
                            <div className="text-muted-foreground">👤 {task.assigned_profile.full_name}</div>
                        )}
                    </div>
                </TooltipContent>
            </Tooltip>
        );
    };

    return (
        <TooltipProvider delayDuration={150}>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        Order Items
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg border overflow-x-auto">
                        <table className="w-full min-w-[760px]">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="text-left p-4 font-medium">Product</th>
                                    <th className="text-center p-4 font-medium">Qty</th>
                                    <th className="text-left p-4 font-medium">Execution Status</th>
                                    {canViewFinancials && <th className="text-right p-4 font-medium">Unit</th>}
                                    {canViewFinancials && <th className="text-right p-4 font-medium">Total</th>}
                                    <th className="w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => {
                                    const designTask = item.order_tasks?.find((t) => t.task_type === "design");
                                    const productionTask = item.order_tasks?.find(
                                        (t) => t.task_type === "production"
                                    );
                                    const awaitingDesignApproval = designTask?.status === "Design Approval";

                                    return (
                                        <tr
                                            key={item.id}
                                            onClick={() => setActiveItem(item)}
                                            className="border-t align-middle cursor-pointer hover:bg-muted/40 transition-colors group"
                                        >
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    {item.product.image_url ? (
                                                        <img
                                                            src={item.product.image_url}
                                                            alt={item.product.name_en}
                                                            className="h-12 w-12 rounded object-cover"
                                                        />
                                                    ) : (
                                                        <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                                                            <Package className="h-6 w-6 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <div className="font-medium group-hover:text-primary transition-colors truncate">
                                                            {item.product.name_en}
                                                        </div>
                                                        <div className="text-sm text-muted-foreground truncate">
                                                            {item.product.name_ar}
                                                        </div>
                                                        {item.product.product_code && (
                                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                                {item.product.product_code}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-center font-medium">{item.quantity}</td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-4">
                                                    {renderStatusDot(
                                                        Palette,
                                                        "Design",
                                                        designTask,
                                                        item.needs_design === false,
                                                        awaitingDesignApproval
                                                            ? {
                                                                  pulseApproval: true,
                                                                  needsActionLabel: canSalesReviewDesign,
                                                              }
                                                            : undefined
                                                    )}
                                                    {renderStatusDot(Wrench, "Production", productionTask)}
                                                </div>
                                            </td>
                                            {canViewFinancials && (
                                                <td className="p-4 text-right">
                                                    {formatCurrency(item.unit_price, currency)}
                                                </td>
                                            )}
                                            {canViewFinancials && (
                                                <td className="p-4 text-right font-semibold">
                                                    {formatCurrency(item.item_total, currency)}
                                                </td>
                                            )}
                                            <td className="p-4 text-right">
                                                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            {canViewFinancials && (
                                <tfoot className="bg-muted/30 border-t-2">
                                    <tr>
                                        <td colSpan={4} className="p-4 text-right font-semibold">
                                            Total:
                                        </td>
                                        <td className="p-4 text-right text-lg font-bold text-primary">
                                            {formatCurrency(totalPrice, currency)}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Line-item sheet: unified task_status_history (design + production) lives in ItemTaskDetailDialog */}
            <ItemTaskDetailDialog
                item={activeItem}
                open={!!activeItem}
                onOpenChange={(o) => !o && setActiveItem(null)}
            />
        </TooltipProvider>
    );
}

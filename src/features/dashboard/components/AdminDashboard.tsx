import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  ClipboardCheck,
  DollarSign,
  Package,
  Palette,
  Factory,
  Timer,
  Truck,
  UserX,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrderDetails } from "@/features/orders/components/OrderDetails";
import { OrderCard } from "@/features/orders/components/OrderCard";
import { useOrderStatuses } from "@/hooks/useOrderStatuses";
import { formatCurrency } from "@/utils/formatCurrency";
import { cn } from "@/lib/utils";

type OrderWithDetails = {
  id: string;
  order_number?: number | null;
  client_name: string;
  phone: string | null;
  delivery_date: string;
  status: string;
  total_price: number;
  total_price_foreign?: number | null;
  total_price_company?: number | null;
  currencies?: { code: string; symbol: string | null } | null;
  pricing_tier?: { name: string; label: string } | null;
  order_items: Array<{ product: { name_en: string } }>;
};

type TaskRow = {
  task_type: string;
  status: string;
  assigned_to: string | null;
};

type HistoryRow = {
  task_id: string;
  created_at: string;
  new_status: string;
  order_tasks: { task_type: string } | null;
};

type UrgentTaskRow = {
  id: string;
  order_id: string;
  status: string;
  task_type: string;
  order: { order_number: number | null } | null;
  order_item: {
    description: string | null;
    product: { name_en: string } | null;
  } | null;
};

type AdminStatCard = {
  title: string;
  value: string;
  change: string;
  icon: LucideIcon;
  department: "admin";
  accentColor: "border-l-primary";
  iconClassName?: string;
  valueClassName?: string;
  cardClassName?: string;
  navigateTo?: string;
  valueLoading?: boolean;
};

const STATUS_URGENCY: Record<string, number> = {
  "Design Revision": 0,
  Blocked: 1,
  "In Progress": 2,
  "Design Approval": 3,
  "Waiting for Print File": 4,
  Pending: 5,
};

function urgencyRank(status: string) {
  return STATUS_URGENCY[status] ?? 50;
}

function formatOrderNo(orderNumber: number | null | undefined, orderId: string) {
  if (orderNumber != null) return `#${String(orderNumber).padStart(4, "0")}`;
  return `#${orderId.slice(0, 8).toUpperCase()}`;
}

function lineItemLabel(item: UrgentTaskRow["order_item"]) {
  if (!item) return "Line item";
  const name = item.product?.name_en?.trim();
  if (item.description?.trim()) return item.description.trim();
  if (name) return name;
  return "Line item";
}

/** Average wall-clock time spent in each "In Progress" spell, from task_status_history. */
function averageInProgressDurationMs(rows: HistoryRow[], taskType: "design" | "production"): number | null {
  const byTask = new Map<string, HistoryRow[]>();
  for (const r of rows) {
    const t = r.order_tasks?.task_type;
    if (t !== taskType) continue;
    const list = byTask.get(r.task_id) ?? [];
    list.push(r);
    byTask.set(r.task_id, list);
  }

  const durationsMs: number[] = [];
  for (const [, list] of byTask) {
    list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    let startMs: number | null = null;
    for (const row of list) {
      if (row.new_status === "In Progress") {
        startMs = new Date(row.created_at).getTime();
      } else if (startMs !== null) {
        const endMs = new Date(row.created_at).getTime();
        if (endMs > startMs) durationsMs.push(endMs - startMs);
        startMs = null;
      }
    }
  }

  if (durationsMs.length === 0) return null;
  return durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length;
}

function formatAvgDuration(ms: number | null) {
  if (ms == null) return "—";
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.round(ms / 60_000)}m avg`;
  return `${hours.toFixed(1)}h avg`;
}

interface AdminDashboardProps {
  companyId: string;
  currency: string | undefined;
  baseCurrencySymbol: string | null | undefined;
  layout?: "full" | "statsOnly" | "tasksOnly";
  limit?: number;
}

export function AdminDashboard({ companyId, currency, baseCurrencySymbol, layout = "full", limit }: AdminDashboardProps) {
  const navigate = useNavigate();
  const { data: statuses } = useOrderStatuses();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const { data: pendingDesignApprovals = 0, isLoading: pendingApprovalsLoading } = useQuery({
    queryKey: ["dashboard-pending-design-approvals", companyId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("order_tasks")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("task_type", "design")
        .eq("status", "Design Approval");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: adminOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ["admin-dashboard-orders", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, total_price, total_price_company")
        .eq("company_id", companyId);
      if (error) throw error;
      return data;
    },
  });

  const { data: taskRows, isLoading: tasksLoading } = useQuery({
    queryKey: ["admin-dashboard-order-tasks", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_tasks")
        .select("task_type, status, assigned_to")
        .eq("company_id", companyId);
      if (error) throw error;
      return data as TaskRow[];
    },
  });

  const { data: historyRows, isLoading: historyLoading } = useQuery({
    queryKey: ["admin-dashboard-task-status-history", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_status_history")
        .select(
          `
          task_id,
          created_at,
          new_status,
          order_tasks ( task_type )
        `
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as HistoryRow[];
    },
  });

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const { data: urgentTasks, isLoading: urgentLoading } = useQuery({
    queryKey: ["admin-dashboard-urgent-tasks", companyId, todayStr],
    queryFn: async () => {
      const { data: ordersToday, error: oErr } = await supabase
        .from("orders")
        .select("id")
        .eq("company_id", companyId)
        .eq("delivery_date", todayStr);
      if (oErr) throw oErr;
      const orderIds = (ordersToday ?? []).map((o) => o.id);
      if (orderIds.length === 0) return [];

      const { data: tasks, error: tErr } = await supabase
        .from("order_tasks")
        .select(
          `
          id,
          order_id,
          status,
          task_type,
          order:orders!order_tasks_order_id_fkey ( order_number ),
          order_item:order_items!order_tasks_order_item_id_fkey (
            description,
            product:products!order_items_product_id_fkey ( name_en )
          )
        `
        )
        .eq("company_id", companyId)
        .in("order_id", orderIds)
        .neq("status", "Completed");
      if (tErr) throw tErr;

      const list = (tasks ?? []) as UrgentTaskRow[];
      list.sort((a, b) => {
        const ur = urgencyRank(a.status) - urgencyRank(b.status);
        if (ur !== 0) return ur;
        const na = a.order?.order_number ?? -1;
        const nb = b.order?.order_number ?? -1;
        return nb - na;
      });
      return list.slice(0, 5);
    },
  });

  const { data: recentOrders, isLoading: isLoadingRecent } = useQuery({
    queryKey: ["recent-orders", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          *,
          total_price_foreign,
          currencies:currency_id(code, symbol),
          pricing_tier:pricing_tiers(name, label),
          order_items(
            product:products(name_en)
          )
        `
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as OrderWithDetails[];
    },
  });

  const metrics = useMemo(() => {
    const orders = adminOrders ?? [];
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total_price_company || o.total_price || 0), 0);
    const readyForDelivery = orders.filter((o) => o.status === "Ready for Pickup").length;

    const tasks = taskRows ?? [];
    const designRevisions = tasks.filter((t) => t.task_type === "design" && t.status === "Design Revision").length;
    const unassigned = tasks.filter((t) => t.assigned_to == null && t.status !== "Completed").length;

    const designTasks = tasks.filter((t) => t.task_type === "design");
    const productionTasks = tasks.filter((t) => t.task_type === "production");
    const designCompleted = designTasks.filter((t) => t.status === "Completed").length;
    const productionCompleted = productionTasks.filter((t) => t.status === "Completed").length;

    return {
      totalRevenue,
      readyForDelivery,
      designRevisions,
      unassigned,
      designTotal: designTasks.length,
      designCompleted,
      productionTotal: productionTasks.length,
      productionCompleted,
    };
  }, [adminOrders, taskRows]);

  const avgDesignMs = useMemo(
    () => averageInProgressDurationMs(historyRows ?? [], "design"),
    [historyRows]
  );
  const avgProductionMs = useMemo(
    () => averageInProgressDurationMs(historyRows ?? [], "production"),
    [historyRows]
  );

  const designProgressPct =
    metrics.designTotal === 0 ? 0 : Math.round((metrics.designCompleted / metrics.designTotal) * 100);
  const productionProgressPct =
    metrics.productionTotal === 0
      ? 0
      : Math.round((metrics.productionCompleted / metrics.productionTotal) * 100);

  const statsLoading = ordersLoading || tasksLoading;
  const adminStats = useMemo((): AdminStatCard[] => {
    return [
      {
        title: "Total revenue",
        value: formatCurrency(metrics.totalRevenue, currency, baseCurrencySymbol),
        change: "Sum of order totals (company currency)",
        icon: DollarSign,
        department: "admin",
        accentColor: "border-l-primary",
      },
      {
        title: "Design revisions",
        value: String(metrics.designRevisions),
        change: "Tasks in Design Revision (rework)",
        icon: AlertTriangle,
        department: "admin",
        accentColor: "border-l-primary",
        iconClassName: metrics.designRevisions > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
        cardClassName:
          metrics.designRevisions > 0
            ? "border-amber-300/60 bg-gradient-to-br from-amber-50/90 to-card dark:border-amber-800/50 dark:from-amber-950/30"
            : undefined,
      },
      {
        title: "Unassigned tasks",
        value: String(metrics.unassigned),
        change: "No owner yet (excludes completed)",
        icon: UserX,
        department: "admin",
        accentColor: "border-l-primary",
        cardClassName:
          metrics.unassigned > 0
            ? "border-sky-300/60 bg-gradient-to-br from-sky-50/80 to-card dark:border-sky-800/50 dark:from-sky-950/25"
            : undefined,
      },
      {
        title: "Ready for delivery",
        value: String(metrics.readyForDelivery),
        change: "Orders in Ready for Pickup",
        icon: Truck,
        department: "admin",
        accentColor: "border-l-primary",
      },
      {
        title: "Pending approvals",
        value: String(pendingDesignApprovals),
        change: "Design tasks awaiting review",
        icon: ClipboardCheck,
        department: "admin",
        accentColor: "border-l-primary",
        navigateTo: "/design-approvals",
        cardClassName:
          "cursor-pointer border-violet-300/60 bg-gradient-to-br from-violet-50 via-white to-amber-50/70 transition-shadow hover:shadow-md dark:from-violet-950/40 dark:via-card dark:to-amber-950/25 dark:border-violet-700/50",
        iconClassName: "text-violet-600 dark:text-violet-300",
        valueLoading: pendingApprovalsLoading,
      },
    ];
  }, [baseCurrencySymbol, currency, metrics.designRevisions, metrics.readyForDelivery, metrics.totalRevenue, metrics.unassigned, pendingApprovalsLoading, pendingDesignApprovals]);
  const showHeader = layout === "full";
  const showStats = layout === "full" || layout === "statsOnly";
  const showTaskSections = layout === "full" || layout === "tasksOnly";
  const visibleUrgentTasks = limit != null ? (urgentTasks ?? []).slice(0, limit) : (urgentTasks ?? []);
  const visibleRecentOrders = limit != null ? (recentOrders ?? []).slice(0, limit) : (recentOrders ?? []);

  const statsCards = statsLoading ? (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="mb-2 h-8 w-16" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </>
  ) : (
    <>
      {adminStats.map((stat) => (
        <Card
          key={stat.title}
          className={cn("bg-card shadow-sm border-l-4", stat.accentColor, stat.cardClassName)}
          onClick={stat.navigateTo ? () => navigate(stat.navigateTo) : undefined}
          role={stat.navigateTo ? "link" : undefined}
          tabIndex={stat.navigateTo ? 0 : undefined}
          onKeyDown={
            stat.navigateTo
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(stat.navigateTo!);
                  }
                }
              : undefined
          }
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className={cn("h-4 w-4 text-muted-foreground", stat.iconClassName)} />
          </CardHeader>
          <CardContent>
            {stat.valueLoading ? (
              <Skeleton className="mb-2 h-8 w-14" />
            ) : (
              <div className={cn("text-2xl font-bold", stat.valueClassName)}>{stat.value}</div>
            )}
            <p className="text-xs text-muted-foreground">{stat.change}</p>
          </CardContent>
        </Card>
      ))}
    </>
  );

  if (layout === "statsOnly") {
    return <>{statsCards}</>;
  }

  return (
    <div className="space-y-6">
      {showHeader && (
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Operational overview: revenue, workflow bottlenecks, today&apos;s deadlines, and throughput.
          </p>
        </div>
      )}

      {showStats && <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">{statsCards}</div>}

      {showTaskSections && <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="h-4 w-4 text-primary" />
              Live workload — design
            </CardTitle>
            <CardDescription>Completed vs total design tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasksLoading ? (
              <Skeleton className="h-4 w-full" />
            ) : (
              <>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {metrics.designCompleted} / {metrics.designTotal} completed
                  </span>
                  <span>{metrics.designTotal === 0 ? "—" : `${designProgressPct}%`}</span>
                </div>
                <Progress value={metrics.designTotal === 0 ? 0 : designProgressPct} className="h-2" />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Factory className="h-4 w-4 text-primary" />
              Live workload — production
            </CardTitle>
            <CardDescription>Completed vs total production tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasksLoading ? (
              <Skeleton className="h-4 w-full" />
            ) : (
              <>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {metrics.productionCompleted} / {metrics.productionTotal} completed
                  </span>
                  <span>{metrics.productionTotal === 0 ? "—" : `${productionProgressPct}%`}</span>
                </div>
                <Progress value={metrics.productionTotal === 0 ? 0 : productionProgressPct} className="h-2" />
              </>
            )}
          </CardContent>
        </Card>
      </div>}

      {showTaskSections && <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Urgent tasks (due today)
          </CardTitle>
          <CardDescription>
            Up to five open tasks on orders with delivery date {todayStr}, highest rework risk first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {urgentLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !visibleUrgentTasks.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No open tasks for orders due today.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleUrgentTasks.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      {formatOrderNo(t.order?.order_number ?? null, t.order_id)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{lineItemLabel(t.order_item)}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">{t.task_type}</TableCell>
                    <TableCell>{t.status}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedOrderId(t.order_id);
                          setIsDetailsOpen(true);
                        }}
                      >
                        View order
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>}

      {showTaskSections && <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Timer className="h-4 w-4 text-primary" />
            Performance (from status history)
          </CardTitle>
          <CardDescription>
            Average time spent in &quot;In Progress&quot; per spell, derived from task status transitions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex gap-8">
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-10 w-40" />
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/40 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Design</p>
                <p className="text-2xl font-semibold">{formatAvgDuration(avgDesignMs)}</p>
              </div>
              <div className="rounded-lg border bg-muted/40 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Production</p>
                <p className="text-2xl font-semibold">{formatAvgDuration(avgProductionMs)}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>}

      {showTaskSections && <Card>
        <CardHeader>
          <CardTitle>Recent orders</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingRecent ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : visibleRecentOrders.length > 0 ? (
            <div className="space-y-4">
              {visibleRecentOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  id={order.id}
                  order_number={order.order_number}
                  client_name={order.client_name}
                  phone={order.phone || ""}
                  delivery_date={order.delivery_date}
                  status={order.status}
                  statusColor={statuses?.find((s) => s.name === order.status)?.color}
                  total_price={order.total_price}
                  foreignPrice={order.total_price_foreign}
                  basePriceCompany={order.total_price_company}
                  currencyCode={order.currencies?.code}
                  pricing_tier={order.pricing_tier}
                  currency={currency}
                  baseCurrencySymbol={baseCurrencySymbol}
                  foreignCurrencySymbol={order.currencies?.symbol}
                  onClick={() => {
                    setSelectedOrderId(order.id);
                    setIsDetailsOpen(true);
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-muted-foreground">No orders found</p>
          )}
        </CardContent>
      </Card>}

      {(showTaskSections || showHeader || showStats) && selectedOrderId && (
        <OrderDetails orderId={selectedOrderId} open={isDetailsOpen} onOpenChange={setIsDetailsOpen} />
      )}
    </div>
  );
}

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReactToPrint } from "react-to-print";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Calendar, DollarSign, FileText, Upload, Printer, Loader2, History, RefreshCw, Pencil } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrderStatuses } from "@/hooks/useOrderStatuses";
import { OrderDetail, OrderAttachment } from "@/features/orders/types";
import { ClientInfoCard } from "./details/ClientInfoCard";
import { OrderItemsTable } from "./details/OrderItemsTable";
import { AttachmentsList } from "./details/AttachmentsList";
import { InvoiceTemplate, CompanyProfile } from "./details/InvoiceTemplate";
import { DeliveryAction } from "./details/actions/DeliveryAction";
import { ArchivedHistory } from "./details/ArchivedHistory";
import { OrderTimeline } from "./details/OrderTimeline";
import { PriceDisplay } from "@/components/ui/price-display";
import { cn } from "@/lib/utils";

interface OrderDetailsProps {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrderDetails({
  orderId,
  open,
  onOpenChange
}: OrderDetailsProps) {
  const navigate = useNavigate();
  const {
    companyId,
    loading: roleLoading,
    canViewFinancials,
    isAdmin,
    isSales,
  } = useUserRole();
  const { data: statuses } = useOrderStatuses();
  const componentRef = useRef<HTMLDivElement>(null);
  const [isInvoiceReady, setIsInvoiceReady] = useState(false);


  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    pageStyle: "@page { size: legal portrait; margin: 0mm; }"
  });

  const {
    data: order,
    isLoading
  } = useQuery({
    queryKey: ["order-details", orderId],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("orders").select(`
          *,
          total_price_foreign,
          exchange_rate,
          currencies:currency_id ( code, symbol ),
          pricing_tier:pricing_tiers(name, label),
          clients(full_name, phone, address, tax_number),
          order_items(
            id,
            order_id,
            quantity,
            unit_price,
            item_total,
            description,
            needs_design,
            product:products(
              name_en,
              name_ar,
              sku,
              image_url,
              product_code
            ),
            order_tasks(
              id,
              task_type,
              status,
              started_at,
              completed_at,
              assigned_to,
              assigned_profile:profiles!order_tasks_assigned_to_fkey(id, full_name, email),
              task_status:task_statuses!order_tasks_status_fkey(name, color)
            )
          )
        `).eq("id", orderId).single();
      if (error) throw error;
      return data as OrderDetail;
    },
    enabled: open && !!orderId
  });

  const { data: companyProfile } = useQuery({
    queryKey: ["company-profile", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("companies")
        .select("*, base_currency:currencies(code, symbol)")
        .eq("id", companyId)
        .single();
      if (error) throw error;
      return data as CompanyProfile;
    },
    enabled: !!companyId
  });

  const {
    data: attachments
  } = useQuery({
    queryKey: ["order-attachments", orderId],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("order_attachments").select("*").eq("order_id", orderId).order("created_at", {
        ascending: false
      });
      if (error) throw error;

      // Fetch uploader profiles and roles
      const uploaderIds = [...new Set(data?.map(a => a.uploader_id).filter(Boolean))];
      if (uploaderIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", uploaderIds);
        const { data: userRoles } = await supabase.from("user_roles").select("user_id, role").in("user_id", uploaderIds);
        const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
        const roleMap = new Map(userRoles?.map(r => [r.user_id, r.role]) || []);
        return data.map(attachment => ({
          ...attachment,
          uploader_name: attachment.uploader_id ? profileMap.get(attachment.uploader_id) || "Unknown User" : undefined,
          uploader_role: attachment.uploader_id ? roleMap.get(attachment.uploader_id) : undefined
        })) as OrderAttachment[];
      }
      return data as OrderAttachment[];
    },
    enabled: open && !!orderId
  });

  const {
    data: comments
  } = useQuery({
    queryKey: ["order-comments", orderId],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("order_comments").select("*").eq("order_id", orderId).order("created_at", {
        ascending: false
      });
      if (error) throw error;

      // Fetch user profiles and roles
      const userIds = [...new Set(data?.map(c => c.user_id).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
        const { data: userRoles } = await supabase.from("user_roles").select("user_id, role").in("user_id", userIds);
        const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
        const roleMap = new Map(userRoles?.map(r => [r.user_id, r.role]) || []);
        return data.map(comment => ({
          ...comment,
          user_name: comment.user_id ? profileMap.get(comment.user_id) || "Unknown User" : undefined,
          user_role: comment.user_id ? roleMap.get(comment.user_id) : undefined
        }));
      }
      return data;
    },
    enabled: open && !!orderId
  });

  // Separate attachments by type
  const clientFiles = attachments?.filter(file => file.file_type === "client_reference") || [];
  const designFiles = attachments?.filter(file => file.file_type === "design_mockup") || [];
  const printFiles = attachments?.filter(file => file.file_type === "print_file") || [];
  const orderItemNamesById = Object.fromEntries(
    (order?.order_items || []).map((item) => [
      item.id,
      `${item.quantity}x ${item.product?.name_en || item.product?.name_ar || "Unnamed Product"}`,
    ])
  );

  const showDeliveryWorkflow =
    canViewFinancials && !roleLoading && order?.status === "Ready for Pickup";

  const showOrderHistoryTab = isAdmin;

  const handleSuccess = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-5xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6 gap-4 sm:gap-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : order ? (
          (() => {
            const isForeignCurrency = !!(order.total_price_foreign && order.currencies?.code && order.exchange_rate);
            const displayCurrency = isForeignCurrency
              ? order.currencies?.code
              : companyProfile?.base_currency?.code || '';

            const orderNumberLabel = order.order_number != null
              ? `#${String(order.order_number).padStart(4, '0')}`
              : `#${order.id.slice(0, 8).toUpperCase()}`;
            const statusColor = statuses?.find(s => s.name === order.status)?.color;

            const priceNode = canViewFinancials && !roleLoading ? (
              <PriceDisplay
                amount={order.total_price_foreign || order.total_price || 0}
                baseCurrency={companyProfile?.base_currency?.code}
                foreignCurrency={order.currencies?.code}
                baseAmount={order.total_price_company || order.total_price || 0}
                baseSymbol={companyProfile?.base_currency?.symbol}
                foreignSymbol={order.currencies?.symbol}
                variant="inline"
              />
            ) : null;

            const actionButtons = (
              <>
                {(isAdmin || isSales) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 lg:h-9 shrink-0"
                    onClick={() => navigate(`/orders/new?fromOrder=${order.id}`)}
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span className="ml-1.5">Reorder</span>
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 lg:h-9 shrink-0"
                    onClick={() => navigate(`/orders/${order.id}/edit`)}
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="ml-1.5">Edit</span>
                  </Button>
                )}
                {canViewFinancials && !roleLoading && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 lg:h-9 shrink-0"
                    onClick={() => handlePrint()}
                    disabled={!isInvoiceReady}
                  >
                    {isInvoiceReady ? (
                      <>
                        <Printer className="h-4 w-4" />
                        <span className="ml-1.5">Print</span>
                      </>
                    ) : (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="ml-1.5">Preparing...</span>
                      </>
                    )}
                  </Button>
                )}
              </>
            );

            return (
              <div className="space-y-6">
                {/* Responsive Header Bar */}
                <DialogHeader className="space-y-0 text-left">
                  <DialogTitle className="sr-only">Order {orderNumberLabel}</DialogTitle>
                  <DialogDescription className="sr-only">
                    Detailed view for order {orderNumberLabel}
                  </DialogDescription>

                  {/* Unified 2-row header: compacts to full stack on phones */}
                  <div className="space-y-3">
                    {/* Top row: order number (+ inline Ref on md+) + status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h2 className="flex items-baseline gap-2 min-w-0 text-lg md:text-xl lg:text-2xl font-bold leading-tight tracking-tight">
                          <span className="flex items-center gap-2 min-w-0">
                            <Package className="h-5 w-5 md:h-6 md:w-6 text-primary shrink-0 self-center" />
                            <span className="truncate">Order {orderNumberLabel}</span>
                          </span>
                          {order.order_number != null && (
                            <span className="hidden md:inline text-xs font-normal text-muted-foreground truncate">
                              Ref: {order.id.slice(0, 8)}
                            </span>
                          )}
                        </h2>
                        {order.order_number != null && (
                          <p className="md:hidden mt-0.5 pl-7 text-[11px] text-muted-foreground truncate">
                            Ref: {order.id.slice(0, 8)}
                          </p>
                        )}
                      </div>
                      <StatusBadge
                        status={order.status}
                        color={statusColor}
                        className="shrink-0 mt-0.5"
                      />
                    </div>

                    {/* Secondary row: meta left, actions right on md+; stacked on mobile */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs md:text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          {format(new Date(order.created_at), "PP · HH:mm")}
                        </span>
                        {priceNode && (
                          <span className="flex items-center gap-1.5 font-semibold text-foreground">
                            <DollarSign className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
                            {priceNode}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap md:flex-nowrap items-center gap-2 overflow-x-auto md:overflow-visible -mx-4 px-4 md:mx-0 md:px-0 pb-1 md:pb-0 md:shrink-0">
                        {actionButtons}
                      </div>
                    </div>
                  </div>
                </DialogHeader>

                {/* Hidden Invoice Template */}
                <div className="hidden">
                  <InvoiceTemplate
                    ref={componentRef}
                    order={order}
                    companyProfile={companyProfile || null}
                    onTemplateReady={() => setIsInvoiceReady(true)}
                  />
                </div>

                {/* Client Info Card */}
                <ClientInfoCard order={order} />

                {/* Tabs for Details and History (Admin only) */}
                <Tabs defaultValue="details" className="w-full">
                  <TabsList
                    className={cn(
                      "h-10 w-full max-w-md rounded-lg bg-muted p-1 text-muted-foreground",
                      showOrderHistoryTab ? "grid grid-cols-2 gap-1" : "flex gap-1"
                    )}
                  >
                    <TabsTrigger
                      value="details"
                      className={cn(!showOrderHistoryTab && "flex-1")}
                    >
                      Order Details
                    </TabsTrigger>
                    {showOrderHistoryTab && (
                      <TabsTrigger value="history" className="flex items-center gap-2">
                        <History className="h-4 w-4" />
                        History
                      </TabsTrigger>
                    )}
                  </TabsList>

                  <TabsContent value="details" className="space-y-6 mt-6">
                    {/* Order Notes */}
                    {order.notes && (
                      <div className="rounded-lg border bg-card p-4 text-sm whitespace-pre-wrap">
                        <h3 className="font-semibold mb-1">Order Notes</h3>
                        <p className="text-muted-foreground">{order.notes}</p>
                      </div>
                    )}

                    {/* Delivery Action Card */}
                    {showDeliveryWorkflow && (
                      <DeliveryAction
                        order={{
                          id: order.id,
                          total_price: order.total_price || 0,
                          paid_amount: order.paid_amount,
                          payment_status: order.payment_status,
                          delivery_method: order.delivery_method,
                        }}
                        onSuccess={handleSuccess}
                        currency={displayCurrency}
                      />
                    )}

                    {/* Order Items Table (shown before file cards for quick overview) */}
                    <OrderItemsTable
                      items={order.order_items}
                      totalPrice={order.total_price}
                      currency={displayCurrency}
                    />

                    {/* Design Proofs & Mockups */}
                    <AttachmentsList
                      attachments={designFiles}
                      title="Design Proofs & Mockups"
                      icon={Upload}
                      orderItemNamesById={orderItemNamesById}
                    />

                    {/* Client Files & Assets */}
                    <AttachmentsList
                      attachments={clientFiles}
                      title="Client Files & Assets"
                      icon={FileText}
                      orderItemNamesById={orderItemNamesById}
                    />

                    {/* Print Files */}
                    <AttachmentsList
                      attachments={printFiles}
                      title="Final Print Files"
                      icon={FileText}
                      className="border-purple-500/50 bg-purple-50 dark:bg-purple-950/20"
                      iconClassName="text-purple-600"
                      iconBgClassName="bg-purple-100 dark:bg-purple-900/30"
                      orderItemNamesById={orderItemNamesById}
                    />

                    {/* Archived Revisions History */}
                    <ArchivedHistory attachments={attachments || []} comments={comments} />
                  </TabsContent>

                  {/* Admin-only History Tab */}
                  {showOrderHistoryTab && (
                    <TabsContent value="history" className="mt-6">
                      <div className="rounded-lg border bg-card p-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                          <History className="h-5 w-5 text-primary" />
                          Order Lifecycle Timeline
                        </h3>
                        <p className="text-sm text-muted-foreground mb-6">
                          Track the duration of each stage to identify bottlenecks and optimize workflow.
                        </p>
                        <OrderTimeline orderId={orderId} />
                      </div>
                    </TabsContent>
                  )}
                </Tabs>

              </div>
            );
          })()
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
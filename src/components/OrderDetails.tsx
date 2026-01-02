import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReactToPrint } from "react-to-print";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Calendar, DollarSign, FileText, Upload, Printer, Loader2, History, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrderStatuses } from "@/hooks/useOrderStatuses";
import { OrderDetail, OrderAttachment } from "./orders/types";
import { ClientInfoCard } from "./orders/details/ClientInfoCard";
import { OrderItemsTable } from "./orders/details/OrderItemsTable";
import { AttachmentsList } from "./orders/details/AttachmentsList";
import { DesignerWorkspace } from "./orders/details/DesignerWorkspace";
import { SalesReview } from "./orders/details/SalesReview";
import { AccountingAction } from "./orders/details/AccountingAction";
import { InvoiceTemplate, CompanyProfile } from "./orders/details/InvoiceTemplate";
import { DeliveryAction } from "./orders/details/actions/DeliveryAction";
import { ArchivedHistory } from "./orders/details/ArchivedHistory";
import { OrderTimeline } from "./orders/details/OrderTimeline";
import { formatCurrency } from "@/utils/formatCurrency";
import { PriceDisplay } from "@/components/ui/price-display";

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
  const { role, companyId, loading: roleLoading } = useUserRole();
  const { data: statuses } = useOrderStatuses();
  const componentRef = useRef<HTMLDivElement>(null);
  const [isInvoiceReady, setIsInvoiceReady] = useState(false);

  // Role-based financial visibility - wait for role to load first
  const canViewFinancials = !roleLoading && ['admin', 'sales', 'accountant'].includes(role || '');

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
            quantity,
            unit_price,
            item_total,
            product:products(
              name_en,
              name_ar,
              sku,
              image_url
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
        .select("*, base_currency:currencies(code)")
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

  // Check if Designer Workspace should be visible
  const showDesignerWorkspace = role === "designer" && order?.status && (order.status === "In Design" || order.status === "Design Revision" || order.status === "Waiting for Print File");

  // Check if Sales Review section should be visible
  const showSalesReview = (role === "sales" || role === "admin") && order?.status === "Design Approval";

  // Check if Accounting Action Card should be visible
  const showAccountingWorkflow = (role === "accountant" || role === "admin") && order?.status === "Pending Payment";

  // Check if Delivery Action should be visible
  const showDeliveryWorkflow = (role === "admin" || role === "accountant" || role === "sales") && order?.status === "Ready for Pickup";

  const handleSuccess = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : order ? (
          (() => {
            // ===== Multi-Currency Calculation Logic =====
            // 1. Determine if this is a Multi-Currency Order
            const isForeignCurrency = !!(order.total_price_foreign && order.currencies?.code && order.exchange_rate);

            // 2. Determine which currency to show in the UI
            const displayCurrency = isForeignCurrency
              ? order.currencies?.code
              : companyProfile?.base_currency?.code || 'AED';

            // 3. Get the Rate (Safe fallback to 1)
            const exchangeRate = order.exchange_rate || 1;

            // 4. Calculate Display Values
            // Total: Use the stored foreign price if available, otherwise base total
            const totalAmountDisplay = isForeignCurrency
              ? (order.total_price_foreign || 0)
              : (order.total_price || 0);

            // Paid: paid_amount is stored in the transaction currency (same as total_price_foreign)
            const paidAmountDisplay = order.paid_amount || 0;

            // Due: Simple subtraction of display values
            const dueAmountDisplay = totalAmountDisplay - paidAmountDisplay;

            return (
              <div className="space-y-10">
                {/* Header */}
                <DialogHeader className="-bottom-10 ">
                  <div className="flex items-start justify-between gap-16 ">
                    <div className="space-y-2">
                      <DialogTitle className="text-3xl font-bold flex items-center gap-3">
                        <Package className="h-8 w-8 text-primary" />
                        Order {order.order_number != null ? `#${String(order.order_number).padStart(4, '0')}` : `#${order.id.slice(0, 8).toUpperCase()}`}
                        {order.order_number != null && (
                          <span className="text-sm font-normal text-muted-foreground ml-2">
                            (Ref: {order.id.slice(0, 8)})
                          </span>
                        )}
                      </DialogTitle>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(order.created_at), "PPP HH:mm")}
                        </span>
                        {canViewFinancials && (
                          <>
                            <span className="flex items-center gap-1.5">
                              <DollarSign className="h-4 w-4" />
                              <PriceDisplay
                                amount={order.total_price_foreign || order.total_price || 0}
                                baseCurrency={companyProfile?.base_currency?.code}
                                foreignCurrency={order.currencies?.code}
                                baseAmount={order.total_price_company || order.total_price || 0}
                                variant="inline"
                              />
                            </span>
                            <span className="flex items-center gap-1.5 font-medium text-foreground">
                              Paid: {formatCurrency(paidAmountDisplay, displayCurrency)}
                            </span>
                            {dueAmountDisplay > 0.01 && (
                              <span className="flex items-center gap-1.5 font-semibold text-destructive">
                                Due: {formatCurrency(dueAmountDisplay, displayCurrency)}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {(role === "accountant" || role === "admin" || role === "sales") && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/orders/new?fromOrder=${order.id}`)}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Reorder
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePrint()}
                            disabled={!isInvoiceReady}
                          >
                            {isInvoiceReady ? (
                              <>
                                <Printer className="h-4 w-4 mr-2" />
                                Print Invoice
                              </>
                            ) : (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Preparing...
                              </>
                            )}
                          </Button>
                        </>
                      )}
                      <StatusBadge status={order.status} color={statuses?.find(s => s.name === order.status)?.color} />
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
                  <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="details">Order Details</TabsTrigger>
                    {role === "admin" && (
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

                    {/* Accounting Action Card */}
                    {showAccountingWorkflow && (
                      <AccountingAction
                        orderId={orderId}
                        totalPrice={order.total_price || 0}
                        onSuccess={handleSuccess}
                        currency={displayCurrency}
                      />
                    )}

                    {/* Design Proofs & Mockups */}
                    <AttachmentsList
                      attachments={designFiles}
                      title="Design Proofs & Mockups"
                      icon={Upload}
                    />

                    {/* Client Files & Assets */}
                    <AttachmentsList
                      attachments={clientFiles}
                      title="Client Files & Assets"
                      icon={FileText}
                    />

                    {/* Print Files */}
                    <AttachmentsList
                      attachments={printFiles}
                      title="Final Print Files"
                      icon={FileText}
                      className="border-purple-500/50 bg-purple-50 dark:bg-purple-950/20"
                      iconClassName="text-purple-600"
                      iconBgClassName="bg-purple-100 dark:bg-purple-900/30"
                    />

                    {/* Designer Workspace */}
                    {showDesignerWorkspace && (
                      <DesignerWorkspace orderId={orderId} order={order} onSuccess={handleSuccess} />
                    )}

                    {/* Sales Review */}
                    {showSalesReview && (
                      <SalesReview orderId={orderId} designFiles={designFiles} onSuccess={handleSuccess} />
                    )}

                    {/* Order Items Table */}
                    <OrderItemsTable
                      items={order.order_items}
                      totalPrice={order.total_price}
                      currency={displayCurrency}
                      exchangeRate={isForeignCurrency ? exchangeRate : null}
                    />

                    {/* Archived Revisions History */}
                    <ArchivedHistory attachments={attachments || []} comments={comments} />
                  </TabsContent>

                  {/* Admin-only History Tab */}
                  {role === "admin" && (
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
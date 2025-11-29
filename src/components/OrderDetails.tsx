import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReactToPrint } from "react-to-print";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Package, Calendar, DollarSign, FileText, Upload, Printer, Loader2 } from "lucide-react";
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
  const { role, companyId } = useUserRole();
  const { data: statuses } = useOrderStatuses();
  const componentRef = useRef<HTMLDivElement>(null);
  const [isInvoiceReady, setIsInvoiceReady] = useState(false);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
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
        .select("*")
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

      // Fetch uploader profiles
      const uploaderIds = [...new Set(data?.map(a => a.uploader_id).filter(Boolean))];
      if (uploaderIds.length > 0) {
        const {
          data: profiles
        } = await supabase.from("profiles").select("id, full_name, role").in("id", uploaderIds);
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        return data.map(attachment => ({
          ...attachment,
          uploader_name: attachment.uploader_id ? profileMap.get(attachment.uploader_id)?.full_name || "Unknown User" : undefined,
          uploader_role: attachment.uploader_id ? profileMap.get(attachment.uploader_id)?.role : undefined
        })) as OrderAttachment[];
      }
      return data as OrderAttachment[];
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
          <div className="space-y-10">
            {/* Header */}
            <DialogHeader className="-bottom-10 ">
              <div className="flex items-start justify-between gap-16 ">
                <div className="space-y-2">
                  <DialogTitle className="text-3xl font-bold flex items-center gap-3">
                    <Package className="h-8 w-8 text-primary" />
                    Order #{order.id.slice(0, 8).toUpperCase()}
                  </DialogTitle>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(order.created_at), "PPP")}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <DollarSign className="h-4 w-4" />
                      ${order.total_price?.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
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

            {/* Accounting Action Card */}
            {showAccountingWorkflow && (
              <AccountingAction orderId={orderId} onSuccess={handleSuccess} />
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
            <OrderItemsTable items={order.order_items} totalPrice={order.total_price} />

          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
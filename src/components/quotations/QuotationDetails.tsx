import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReactToPrint } from "react-to-print";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { PriceDisplay } from "@/components/ui/price-display";
import { QuotationTemplate } from "@/components/orders/details/QuotationTemplate";
import { Package, Calendar, DollarSign, Printer, Loader2 } from "lucide-react";
import { formatCurrency } from "@/utils/formatCurrency";
import { useNavigate } from "react-router-dom";

type QuotationItemWithProduct = {
  id: string;
  product_id?: string;
  quantity: number;
  unit_price: number;
  item_total: number;
  product: {
    name_en: string;
    name_ar: string;
    sku: string;
    image_url: string | null;
  };
};

type QuotationDetail = {
  id: string;
  client_id: string | null;
  client_name: string;
  email: string | null;
  phone: string | null;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  total_price: number | null;
  total_price_foreign?: number | null;
  total_price_company?: number | null;
  exchange_rate?: number | null;
  currency_id: string | null;
  currencies?: {
    code: string;
    symbol: string | null;
  } | null;
  clients?: {
    full_name: string | null;
    phone: string | null;
    address: string | null;
    tax_number: string | null;
  } | null;
  quotation_items: QuotationItemWithProduct[];
};

interface QuotationDetailsProps {
  quotationId: string;
  onClose: () => void;
}

export function QuotationDetails({ quotationId }: QuotationDetailsProps) {
  const navigate = useNavigate();
  const { companyId } = useUserRole();
  const componentRef = useRef<HTMLDivElement>(null);
  const [isTemplateReady, setIsTemplateReady] = useState(false);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    pageStyle: "@page { size: legal portrait; margin: 0mm; }",
  });

  const { data: quotation, isLoading } = useQuery({
    queryKey: ["quotation-details", quotationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotations")
        .select(
          `
          *,
          currencies:currency_id ( code, symbol ),
          clients(*),
          quotation_items(
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
        `
        )
        .eq("id", quotationId)
        .single();
      if (error) throw error;
      return data as unknown as QuotationDetail;
    },
    enabled: !!quotationId,
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
      return data;
    },
    enabled: !!companyId,
  });

  if (isLoading || !quotation) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const displayCurrency =
    quotation.currencies?.code || companyProfile?.base_currency?.code;
  const totalForeign = quotation.total_price_foreign ?? quotation.total_price ?? 0;
  const totalCompany =
    quotation.total_price_company ??
    totalForeign * (quotation.exchange_rate || 1);

  return (
    <div className="space-y-8 p-6">
      <DialogHeader>
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-2">
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              <Package className="h-6 w-6 text-primary" />
              Quotation #{quotation.id.slice(0, 8).toUpperCase()}
            </DialogTitle>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                Created {format(new Date(quotation.created_at), "PPP HH:mm")}
              </span>
              {quotation.valid_until && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  Valid until {format(new Date(quotation.valid_until), "PPP")}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4" />
                <PriceDisplay
                  amount={totalForeign}
                  baseCurrency={companyProfile?.base_currency?.code}
                  foreignCurrency={quotation.currencies?.code}
                  baseAmount={totalCompany}
                  variant="inline"
                />
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePrint()}
                disabled={!isTemplateReady}
              >
                {isTemplateReady ? (
                  <>
                    <Printer className="h-4 w-4 mr-2" />
                    Print Quotation
                  </>
                ) : (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Preparing...
                  </>
                )}
              </Button>
            </div>
            <Button
              size="sm"
              className="mt-1"
              onClick={() =>
                navigate(`/orders/new?fromQuotation=${quotation.id}`)
              }
            >
              Convert to Order
            </Button>
          </div>
        </div>
      </DialogHeader>

      {/* Hidden printable template */}
      <div className="hidden">
        <QuotationTemplate
          ref={componentRef}
          quotation={quotation}
          companyProfile={companyProfile || null}
          onTemplateReady={() => setIsTemplateReady(true)}
        />
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-6 space-y-6">
          {/* Client info */}
          <div className="rounded-lg border bg-card p-4 space-y-1 text-sm">
            <div className="font-semibold text-foreground">
              {quotation.client_name}
            </div>
            {quotation.email && (
              <div className="text-muted-foreground">{quotation.email}</div>
            )}
            {quotation.phone && (
              <div className="text-muted-foreground">{quotation.phone}</div>
            )}
          </div>

          {/* Items table */}
          <div className="rounded-lg border bg-card">
            <div className="grid grid-cols-[40px_3fr_1fr_1fr_1fr] gap-4 px-4 py-3 border-b text-[11px] font-medium uppercase text-muted-foreground">
              <div>#</div>
              <div>Item</div>
              <div className="text-right">Qty</div>
              <div className="text-right">Unit Price</div>
              <div className="text-right">Total</div>
            </div>
            <div>
              {quotation.quotation_items.map((item, index) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[40px_3fr_1fr_1fr_1fr] gap-4 px-4 py-3 border-b last:border-b-0 text-sm items-center"
                >
                  <div className="text-xs text-muted-foreground">
                    {index + 1}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {item.product?.name_en}
                    </span>
                    {item.product?.name_ar && (
                      <span className="text-xs text-muted-foreground">
                        {item.product.name_ar}
                      </span>
                    )}
                  </div>
                  <div className="text-right">{item.quantity}</div>
                  <div className="text-right">
                    {formatCurrency(item.unit_price, displayCurrency)}
                  </div>
                  <div className="text-right font-medium">
                    {formatCurrency(item.item_total, displayCurrency)}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end px-4 py-3 border-t">
              <div className="text-right space-y-1">
                <div className="text-xs text-muted-foreground">
                  Total quotation amount
                </div>
                <div className="text-xl font-bold">
                  {formatCurrency(totalForeign, displayCurrency)}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <div className="rounded-lg border bg-card p-4 text-sm whitespace-pre-wrap">
            {quotation.notes || "No additional notes for this quotation."}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}



import React from "react";
import { format } from "date-fns";
import { formatCurrency } from "@/utils/formatCurrency";

export interface QuotationCompanyProfile {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  website: string | null;
  tax_number?: string | null;
  base_currency?: {
    code: string;
  };
}

type QuotationItemForTemplate = {
  id: string;
  quantity: number;
  unit_price: number;
  item_total: number;
  product: {
    name_en: string;
    name_ar: string;
  };
};

interface ExtendedQuotationDetail {
  id: string;
  client_name: string;
  phone: string | null;
  created_at: string;
  valid_until?: string | null;
  notes?: string | null;
  total_price_foreign?: number | null;
  exchange_rate?: number | null;
  currencies?: {
    code: string;
    symbol: string | null;
  } | null;
  clients?: {
    tax_number?: string | null;
    address?: string | null;
    phone?: string | null;
  };
  quotation_items: QuotationItemForTemplate[];
}

interface QuotationTemplateProps {
  quotation: ExtendedQuotationDetail;
  companyProfile: QuotationCompanyProfile | null;
  onTemplateReady?: () => void;
}

export const QuotationTemplate = React.forwardRef<
  HTMLDivElement,
  QuotationTemplateProps
>(({ quotation, companyProfile, onTemplateReady }, ref) => {
  React.useEffect(() => {
    if (companyProfile && !companyProfile.logo_url) {
      const timer = setTimeout(() => {
        onTemplateReady?.();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [companyProfile, onTemplateReady]);

  const hasQuotationCurrency =
    quotation.currencies?.code &&
    quotation.exchange_rate &&
    quotation.exchange_rate !== 1;
  const quotationCurrency =
    quotation.currencies?.code ||
    companyProfile?.base_currency?.code ||
    " ";
  const exchangeRate = quotation.exchange_rate || 1;

  const toQuotationCurrency = (baseAmount: number) => {
    if (hasQuotationCurrency) {
      return baseAmount / exchangeRate;
    }
    return baseAmount;
  };

  const subtotal = quotation.quotation_items.reduce(
    (acc, item) => acc + toQuotationCurrency(item.item_total),
    0
  );

  const grandTotal =
    hasQuotationCurrency && quotation.total_price_foreign
      ? quotation.total_price_foreign
      : subtotal;

  const clientTRN = quotation.clients?.tax_number || "-";
  const clientAddress = quotation.clients?.address || "-";
  const clientPhone = quotation.clients?.phone || quotation.phone || "-";

  return (
    <div className="w-[210mm] min-h-[297mm] p-12 bg-white text-slate-900 font-sans mx-auto" ref={ref}>
      {/* HEADER */}
      <div className="flex justify-between items-start mb-12 pb-8 border-b border-slate-200">
        <div className="flex flex-col w-3/5">
          <div className="mb-6 min-h-fit flex items-start">
            {companyProfile?.logo_url ? (
              <img
                src={companyProfile.logo_url}
                alt="Company Logo"
                className="max-h-full max-w-[150px] object-contain"
                onLoad={() => onTemplateReady?.()}
                onError={() => onTemplateReady?.()}
              />
            ) : (
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {companyProfile?.name || ""}
              </div>
            )}
          </div>

          <div className="text-xs space-y-1 leading-relaxed">
            <p className="font-bold text-sm text-slate-900">
              {companyProfile?.name || ""}
            </p>
            <p className="text-slate-500 whitespace-pre-line max-w-[280px]">
              {companyProfile?.address || "-"}
            </p>
            <div className="flex flex-col gap-0.5 text-slate-500">
              {companyProfile?.phone && <span>{companyProfile.phone}</span>}
              {companyProfile?.email && <span>{companyProfile.email}</span>}
            </div>
            {companyProfile?.tax_number && (
              <p className="font-semibold text-slate-900 mt-2">
                TRN: {companyProfile.tax_number}
              </p>
            )}
          </div>
        </div>

        <div className="text-right w-2/5 space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-1">
              Document
            </p>
            <p className="text-xl font-bold tracking-[0.2em]">QUOTATION</p>
          </div>
          <div className="text-xs space-y-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-1">
                Reference
              </p>
              <p className="font-semibold text-slate-900">
                {quotation.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-1">
                Issue Date
              </p>
              <p className="text-slate-900">
                {format(new Date(quotation.created_at), "dd/MM/yyyy")}
              </p>
            </div>
            {quotation.valid_until && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-1">
                  Valid Until
                </p>
                <p className="text-slate-900">
                  {format(new Date(quotation.valid_until), "dd/MM/yyyy")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CUSTOMER DETAILS */}
      <div className="mb-10">
        <h3 className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-4">
          Quotation For
        </h3>
        <div className="text-xs space-y-2">
          <div className="grid grid-cols-[90px_1fr] gap-x-4">
            <span className="text-slate-500">Name</span>
            <span className="font-semibold text-slate-900">
              {quotation.client_name}
            </span>
          </div>
          <div className="grid grid-cols-[90px_1fr] gap-x-4">
            <span className="text-slate-500">Phone</span>
            <span className="text-slate-900">{clientPhone}</span>
          </div>
          <div className="grid grid-cols-[90px_1fr] gap-x-4">
            <span className="text-slate-500">Address</span>
            <span className="text-slate-900 whitespace-pre-wrap">
              {clientAddress}
            </span>
          </div>
          <div className="grid grid-cols-[90px_1fr] gap-x-4">
            <span className="text-slate-500">TRN</span>
            <span className="font-semibold text-slate-900">{clientTRN}</span>
          </div>
        </div>
      </div>

      {/* ITEMS TABLE */}
      <div className="mb-8">
        <div className="grid grid-cols-[40px_3fr_80px_100px_120px] gap-4 py-3 border-b border-slate-200 text-[10px] uppercase tracking-wider font-bold text-slate-500">
          <div className="text-left">#</div>
          <div className="text-left">Item & Description</div>
          <div className="text-right">Quantity</div>
          <div className="text-right">Rate</div>
          <div className="text-right">Amount</div>
        </div>
        <div>
          {quotation.quotation_items.map((item, index) => (
            <div
              key={item.id}
              className="grid grid-cols-[40px_3fr_80px_100px_120px] gap-4 py-4 border-b border-slate-100 text-xs items-center"
            >
              <div className="text-left text-slate-400 font-medium">
                {index + 1}
              </div>
              <div className="text-left flex flex-col">
                <span className="font-semibold text-slate-900">
                  {item.product.name_en}
                </span>
                {item.product.name_ar && (
                  <span className="text-slate-400 text-[10px] mt-0.5">
                    {item.product.name_ar}
                  </span>
                )}
              </div>
              <div className="text-right text-slate-900">{item.quantity}</div>
              <div className="text-right text-slate-900">
                {formatCurrency(
                  toQuotationCurrency(item.unit_price),
                  quotationCurrency
                )}
              </div>
              <div className="text-right font-semibold text-slate-900">
                {formatCurrency(
                  toQuotationCurrency(item.item_total),
                  quotationCurrency
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* TOTALS */}
      <div className="flex justify-end mb-16">
        <div className="w-[320px]">
          <div className="flex justify-between py-3 border-b border-slate-100 text-xs">
            <span className="text-slate-500 font-medium">Subtotal</span>
            <span className="text-slate-900 font-semibold">
              {formatCurrency(subtotal, quotationCurrency)}
            </span>
          </div>
          <div className="flex justify-between py-4 mt-2 bg-slate-50 px-4 rounded text-sm">
            <span className="text-slate-900 font-bold uppercase tracking-wide">
              Total
            </span>
            <span className="text-slate-900 font-bold text-lg">
              {formatCurrency(grandTotal, quotationCurrency)}
            </span>
          </div>
        </div>
      </div>

      {/* FOOTER - simple validity message */}
      <div className="mt-auto space-y-4 pt-8 border-t border-slate-200">
        <p className="text-xs text-slate-600">
          This quotation is valid until the stated validity date above and may
          be subject to change thereafter.
        </p>
        <p className="text-[10px] text-slate-500">
          Thank you for considering our services.
        </p>
      </div>
    </div>
  );
});

QuotationTemplate.displayName = "QuotationTemplate";



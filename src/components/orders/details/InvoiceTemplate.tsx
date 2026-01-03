import React from "react";
import { format } from "date-fns";
import { OrderDetail } from "@/components/orders/types";
import { formatCurrency } from "@/utils/formatCurrency";

// تحديث الواجهة لتشمل كل الحقول الديناميكية الجديدة
export interface CompanyProfile {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    logo_url: string | null;
    website: string | null;
    tax_number?: string | null;    // TRN Number
    invoice_notes?: string | null; // Default invoice notes
    invoice_terms?: string | null; // Terms and conditions
    tax_rate?: number | null;      // Tax/VAT rate percentage
    currency?: string | null;      // Legacy currency code (AED, USD, etc.) - deprecated
    base_currency?: {              // New relation to currencies table
        code: string;
        symbol: string | null;
    };
}

// توسيع واجهة الطلب لتوقع بيانات العميل الإضافية (في حال تم جلبها عبر Join)
interface ExtendedOrderDetail extends OrderDetail {
    clients?: {
        tax_number?: string | null;
        address?: string | null;
        phone?: string | null;
    };
    currencies?: {
        code: string;
        symbol: string | null;
    } | null;
    total_price_foreign?: number | null;
    exchange_rate?: number | null;
}

interface InvoiceTemplateProps {
    order: ExtendedOrderDetail;
    companyProfile: CompanyProfile | null;
    onTemplateReady?: () => void;
}

export const InvoiceTemplate = React.forwardRef<HTMLDivElement, InvoiceTemplateProps>(
    ({ order, companyProfile, onTemplateReady }, ref) => {

        // Notify when ready if no logo is present
        React.useEffect(() => {
            if (companyProfile && !companyProfile.logo_url) {
                // Small timeout to ensure rendering is done
                const timer = setTimeout(() => {
                    onTemplateReady?.();
                }, 100);
                return () => clearTimeout(timer);
            }
        }, [companyProfile, onTemplateReady]);

        // --- 1. Determine Invoice Currency (Order's transaction currency or Company base) ---
        const hasOrderCurrency = order.currencies?.code && order.exchange_rate && order.exchange_rate !== 1;
        const invoiceCurrency = order.currencies?.code || companyProfile?.base_currency?.code || companyProfile?.currency;
        const exchangeRate = order.exchange_rate || 1;

        // --- 2. Helper to convert base currency prices to invoice currency ---
        // Items are stored in base currency, so we divide by exchange_rate to get foreign currency
        const toInvoiceCurrency = (baseAmount: number) => {
            if (hasOrderCurrency) {
                return baseAmount / exchangeRate;
            }
            return baseAmount;
        };

        // --- 3. Financial calculations with dynamic tax rate ---
        const taxPercentage = companyProfile?.tax_rate ?? 0;
        
        // Calculate subtotal in invoice currency
        const subtotal = order.order_items.reduce((acc, item) => acc + toInvoiceCurrency(item.item_total), 0);
        const taxAmount = subtotal * (taxPercentage / 100);
        
        // Use order's total_price_foreign if available, otherwise calculate
        const grandTotal = hasOrderCurrency && order.total_price_foreign 
            ? order.total_price_foreign 
            : subtotal + taxAmount;

        // --- 2. Prepare dynamic data ---
        // Use client data from clients table if available, otherwise fallback to order data
        const clientTRN = order.clients?.tax_number || "-";
        const clientAddress = order.clients?.address || (order.delivery_method === 'delivery' ? "Delivery Address" : "-");
        const clientPhone = order.clients?.phone || order.phone || "-";

        return (
            <div ref={ref} className="w-[210mm] min-h-[297mm] p-12 bg-white text-slate-900 font-sans mx-auto">

                {/* ================= HEADER ================= */}
                <div className="flex justify-between items-start mb-12 pb-8 border-b border-slate-200">
                    {/* Left: Company Info */}
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
                            <p className="font-bold text-sm text-slate-900">{companyProfile?.name || ""}</p>
                            <p className="text-slate-500 whitespace-pre-line max-w-[280px]">{companyProfile?.address || "-"}</p>
                            <div className="flex flex-col gap-0.5 text-slate-500">
                                {companyProfile?.phone && <span>{companyProfile.phone}</span>}
                                {companyProfile?.email && <span>{companyProfile.email}</span>}
                            </div>
                            {companyProfile?.tax_number && (
                                <p className="font-semibold text-slate-900 mt-2">TRN: {companyProfile.tax_number}</p>
                            )}
                        </div>
                    </div>

                    {/* Right: Invoice Information */}
                    <div className="text-right w-2/5">
                        <div className="text-xs space-y-3">
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-1">Order Number</p>
                                <p className="font-semibold text-slate-900">
                                    {order.order_number != null ? `#${String(order.order_number).padStart(4, '0')}` : order.id.slice(0, 8).toUpperCase()}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-1">Issue Date</p>
                                <p className="text-slate-900">{format(new Date(order.created_at), "dd/MM/yyyy")}</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-1">Expiry Date</p>
                                <p className="text-slate-900">{format(new Date(order.delivery_date), "dd/MM/yyyy")}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ================= CUSTOMER DETAILS ================= */}
                <div className="mb-10">
                    <h3 className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-4">Bill To</h3>
                    <div className="text-xs space-y-2">
                        <div className="grid grid-cols-[90px_1fr] gap-x-4">
                            <span className="text-slate-500">Name</span>
                            <span className="font-semibold text-slate-900">{order.client_name}</span>
                        </div>
                        <div className="grid grid-cols-[90px_1fr] gap-x-4">
                            <span className="text-slate-500">Phone</span>
                            <span className="text-slate-900">{clientPhone}</span>
                        </div>
                        <div className="grid grid-cols-[90px_1fr] gap-x-4">
                            <span className="text-slate-500">Address</span>
                            <span className="text-slate-900 whitespace-pre-wrap">{clientAddress}</span>
                        </div>
                        <div className="grid grid-cols-[90px_1fr] gap-x-4">
                            <span className="text-slate-500">TRN</span>
                            <span className="font-semibold text-slate-900">{clientTRN}</span>
                        </div>
                    </div>
                </div>

                {/* ================= TABLE ================= */}
                <div className="mb-8">
                    {/* Headers */}
                    <div className="grid grid-cols-[40px_3fr_80px_100px_80px_120px] gap-4 py-3 border-b border-slate-200 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                        <div className="text-left">#</div>
                        <div className="text-left">Item & Description</div>
                        <div className="text-right">Quantity</div>
                        <div className="text-right">Rate</div>
                        <div className="text-right">Tax ({taxPercentage}%)</div>
                        <div className="text-right">Amount</div>
                    </div>

                    {/* Rows */}
                    <div>
                        {order.order_items.map((item, index) => (
                            <div
                                key={item.id}
                                className="grid grid-cols-[40px_3fr_80px_100px_80px_120px] gap-4 py-4 border-b border-slate-100 text-xs items-center"
                            >
                                <div className="text-left text-slate-400 font-medium">{index + 1}</div>

                                <div className="text-left flex flex-col">
                                    <span className="font-semibold text-slate-900">{item.product.name_en}</span>
                                    {item.product.name_ar && <span className="text-slate-400 text-[10px] mt-0.5">{item.product.name_ar}</span>}
                                </div>

                                <div className="text-right text-slate-900">{item.quantity}</div>
                                <div className="text-right text-slate-900">{formatCurrency(toInvoiceCurrency(item.unit_price), invoiceCurrency)}</div>
                                <div className="text-right text-slate-500">{taxPercentage}%</div>
                                <div className="text-right font-semibold text-slate-900">{formatCurrency(toInvoiceCurrency(item.item_total), invoiceCurrency)}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ================= TOTALS ================= */}
                <div className="flex justify-end mb-16">
                    <div className="w-[320px]">
                        {/* Subtotal */}
                        <div className="flex justify-between py-3 border-b border-slate-100 text-xs">
                            <span className="text-slate-500 font-medium">Subtotal (Excl. VAT)</span>
                            <span className="text-slate-900 font-semibold">{formatCurrency(subtotal, invoiceCurrency)}</span>
                        </div>

                        {/* VAT */}
                        <div className="flex justify-between py-3 border-b border-slate-100 text-xs">
                            <span className="text-slate-500 font-medium">VAT ({taxPercentage}%)</span>
                            <span className="text-slate-900 font-semibold">{formatCurrency(taxAmount, invoiceCurrency)}</span>
                        </div>

                        {/* Grand Total */}
                        <div className="flex justify-between py-4 mt-2 bg-slate-50 px-4 rounded text-sm">
                            <span className="text-slate-900 font-bold uppercase tracking-wide">Total</span>
                            <span className="text-slate-900 font-bold text-lg">{formatCurrency(grandTotal, invoiceCurrency)}</span>
                        </div>
                    </div>
                </div>

                {/* ================= FOOTER ================= */}
                <div className="mt-auto space-y-6 pt-8 border-t border-slate-200">
                    {/* Notes */}
                    <div>
                        <h4 className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">Notes</h4>
                        <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                            {companyProfile?.invoice_notes || "Thank you for your business."}
                        </p>
                    </div>

                    {/* Terms */}
                    <div>
                        <h4 className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">Terms and Conditions</h4>
                        <p className="text-[10px] text-slate-500 whitespace-pre-line leading-relaxed">
                            {companyProfile?.invoice_terms ||
                                "1. Goods once sold cannot be returned.\n2. Payment to be made by Cheque/Cash.\n3. All disputes are subject to UAE jurisdiction."}
                        </p>
                    </div>
                </div>

            </div>
        );
    }
);

InvoiceTemplate.displayName = "InvoiceTemplate";
import { StatusBadge } from "@/components/StatusBadge";
import { PriceDisplay } from "@/components/ui/price-display";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserRole } from "@/hooks/useUserRole";
import { Mail, Calendar, Tag, ChevronRight } from "lucide-react";

interface OrderCardProps {
  id: string;
  order_number?: number | null;
  client_name: string;
  email: string;
  delivery_date: string;
  status: string;
  statusColor?: string;
  total_price: number;
  pricing_tier?: {
    name: string;
    label: string;
  } | null;
  onClick?: () => void;
  showFullId?: boolean;
  currency?: string; // Base currency
  foreignPrice?: number | null;
  basePriceCompany?: number | null; // Price converted to base currency
  currencyCode?: string; // Transaction currency code
}

export function OrderCard({
  id,
  order_number,
  client_name,
  email,
  delivery_date,
  status,
  statusColor,
  total_price,
  pricing_tier,
  onClick,
  showFullId = false,
  currency,
  foreignPrice,
  basePriceCompany,
  currencyCode
}: OrderCardProps) {
  const { role, loading } = useUserRole();

  // Role-based financial visibility
  const canViewFinancials = !loading && ['admin', 'sales', 'accountant'].includes(role || '');
  
  return (
    <div
      className="p-5 rounded-lg border border-muted bg-card text-card-foreground shadow-sm hover:shadow-md transition-all cursor-pointer border-l-4"
      style={statusColor ? { borderLeftColor: statusColor } : undefined}
      onClick={onClick}
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-center">
        {/* Section A: Identity & Status (Cols 1-3) */}
        <div className="md:col-span-3 space-y-2">
          <div>
            <div className="text-2xl font-bold tracking-tight">
              {order_number != null ? `#${String(order_number).padStart(4, '0')}` : `#${id.slice(0, 8)}`}
            </div>
            {order_number != null && (
              <div className="text-xs text-muted-foreground mt-1">
                (Ref: {id.slice(0, 8)})
              </div>
            )}
          </div>
          <div>
            <StatusBadge status={status} color={statusColor} />
          </div>
        </div>

        {/* Section B: Client & Details (Cols 4-8) */}
        <div className="md:col-span-5 space-y-3">
          <div>
            <div className="font-semibold text-lg text-foreground">{client_name}</div>
          </div>
          
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="w-3 h-3" />
              <span>{email}</span>
            </div>
            
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span>{new Date(delivery_date).toLocaleString()}</span>
            </div>
            
            {pricing_tier && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Tag className="w-3 h-3" />
                <span>{pricing_tier.label || pricing_tier.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Section C: Financials & CTA (Cols 9-12) */}
        <div className="md:col-span-4 md:text-right space-y-3">
          {loading ? (
            <div className="flex md:justify-end items-center gap-2">
              <Skeleton className="h-6 w-32" />
            </div>
          ) : canViewFinancials ? (
            <div className="space-y-1">
              <div className="text-xl font-bold text-primary">
                <PriceDisplay
                  amount={foreignPrice || total_price}
                  baseCurrency={currency}
                  foreignCurrency={currencyCode}
                  baseAmount={basePriceCompany || total_price}
                  variant="stacked"
                />
              </div>
            </div>
          ) : null}
          
          <div className="flex md:justify-end items-center">
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>
      </div>
    </div>
  );
}

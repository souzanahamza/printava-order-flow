import { StatusBadge } from "@/components/StatusBadge";
import { PriceDisplay } from "@/components/ui/price-display";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserRole } from "@/hooks/useUserRole";

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
      className="p-6 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-4">
            <div>
              <div className="font-semibold text-lg">{client_name}</div>
              <div className="text-sm text-muted-foreground">{email}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Order:</span>{" "}
              <span className="font-bold text-lg">
                {order_number != null ? `#${String(order_number).padStart(4, '0')}` : `#${id.slice(0, 8)}`}
              </span>
              {order_number != null && (
                <span className="text-xs text-muted-foreground ml-2">
                  (Ref: {id.slice(0, 8)})
                </span>
              )}
            </div>
            <div>
              <span className="text-muted-foreground">Delivery:</span>{" "}
              <span className="font-medium">{new Date(delivery_date).toLocaleDateString()}</span>
            </div>
            {pricing_tier && (
              <div>
                <span className="text-muted-foreground">Tier:</span>{" "}
                <span className="font-medium">{pricing_tier.label || pricing_tier.name}</span>
              </div>
            )}
            {loading ? (
              <div>
                <span className="text-muted-foreground">Total:</span>{" "}
                <Skeleton className="inline-block h-5 w-24" />
              </div>
            ) : canViewFinancials ? (
              <div>
                <span className="text-muted-foreground">Total:</span>{" "}
                <PriceDisplay
                  amount={foreignPrice || total_price}
                  baseCurrency={currency}
                  foreignCurrency={currencyCode}
                  baseAmount={basePriceCompany || total_price}
                  variant="stacked"
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          <StatusBadge status={status} color={statusColor} />
        </div>
      </div>
    </div>
  );
}

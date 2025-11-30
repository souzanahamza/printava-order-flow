import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency } from "@/utils/formatCurrency";

interface OrderCardProps {
  id: string;
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
  currency?: string;
}

export function OrderCard({
  id,
  client_name,
  email,
  delivery_date,
  status,
  statusColor,
  total_price,
  pricing_tier,
  onClick,
  showFullId = false,
  currency = 'AED'
}: OrderCardProps) {
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
              <span className="text-muted-foreground">Order ID:</span>{" "}
              <span className="font-medium">{showFullId ? id : id.slice(0, 8)}</span>
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
            <div>
              <span className="text-muted-foreground">Total:</span>{" "}
              <span className="font-semibold text-primary">{formatCurrency(total_price, currency)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          <StatusBadge status={status} color={statusColor} />
        </div>
      </div>
    </div>
  );
}

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type OrderStatus = "new" | "design" | "production" | "shipping" | "delivered";

interface StatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

const statusConfig: Record<OrderStatus, { label: string; variant: string }> = {
  new: { label: "New", variant: "bg-status-new text-status-new-foreground" },
  design: { label: "Design Approval", variant: "bg-status-design text-status-design-foreground" },
  production: { label: "In Production", variant: "bg-status-production text-status-production-foreground" },
  shipping: { label: "Shipping", variant: "bg-status-shipping text-status-shipping-foreground" },
  delivered: { label: "Delivered", variant: "bg-status-delivered text-status-delivered-foreground" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <Badge className={cn(config.variant, "font-medium", className)}>
      {config.label}
    </Badge>
  );
}

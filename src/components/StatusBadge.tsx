import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const getStatusVariant = (status: string): string => {
  const normalizedStatus = status.toLowerCase().replace(/\s+/g, "-");
  
  const statusMap: Record<string, string> = {
    "new": "bg-status-new text-status-new-foreground",
    "in-design": "bg-status-design text-status-design-foreground",
    "design-approval": "bg-status-design text-status-design-foreground",
    "in-production": "bg-status-production text-status-production-foreground",
    "shipping": "bg-status-shipping text-status-shipping-foreground",
    "delivered": "bg-status-delivered text-status-delivered-foreground",
    "canceled": "bg-destructive text-destructive-foreground",
  };
  
  return statusMap[normalizedStatus] || "bg-muted text-muted-foreground";
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = getStatusVariant(status);
  
  return (
    <Badge className={cn(variant, "font-medium", className)}>
      {status}
    </Badge>
  );
}

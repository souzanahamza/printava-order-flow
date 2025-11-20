import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  color?: string;
  className?: string;
}

export function StatusBadge({ status, color, className }: StatusBadgeProps) {
  const textColor = color ? getContrastColor(color) : undefined;

  return (
    <Badge 
      className={cn("font-medium border-transparent", className)}
      style={color ? { backgroundColor: color, color: textColor } : undefined}
    >
      {status}
    </Badge>
  );
}

// يحدد لون الخط: أبيض تقريبًا دائمًا إلا إذا كان اللون فاتح جدًا
function getContrastColor(hexColor: string): string {
  if (!/^#([A-Fa-f0-9]{6})$/.test(hexColor)) {
    return "#ffffff"; // fallback آمن
  }

  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);

  // relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // العتبة الجديدة: حتى 0.80 نخلي النص أبيض (كان 0.5 بالنسخة القديمة)
  return luminance > 0.7 ? "#000000" : "#ffffff";
}

import { formatCurrency } from "@/utils/formatCurrency";
import { cn } from "@/lib/utils";

interface PriceDisplayProps {
  /** Primary amount (in transaction currency if foreign, else base) */
  amount: number;
  /** Base/company currency code */
  baseCurrency?: string;
  /** Transaction/foreign currency code (if different from base) */
  foreignCurrency?: string;
  /** Amount in base currency (for conversion display) */
  baseAmount?: number;
  /** Base currency symbol from Supabase */
  baseSymbol?: string | null;
  /** Foreign currency symbol from Supabase */
  foreignSymbol?: string | null;
  /** Layout variant */
  variant?: "inline" | "stacked" | "compact";
  /** Show approximate symbol for conversion */
  showApprox?: boolean;
  /** Additional classes for primary price */
  primaryClassName?: string;
  /** Additional classes for secondary/converted price */
  secondaryClassName?: string;
  /** Additional wrapper classes */
  className?: string;
}

/**
 * Unified price display component that handles multi-currency scenarios.
 * Shows primary price in transaction currency with optional base currency conversion.
 */
export function PriceDisplay({
  amount,
  baseCurrency,
  foreignCurrency,
  baseAmount,
  baseSymbol,
  foreignSymbol,
  variant = "inline",
  showApprox = true,
  primaryClassName,
  secondaryClassName,
  className,
}: PriceDisplayProps) {
  const hasForeignCurrency = foreignCurrency && foreignCurrency !== baseCurrency;
  const showConversion = hasForeignCurrency && baseAmount !== undefined;

  // If no foreign currency or same as base, just show the amount in base currency
  if (!showConversion) {
    return (
      <span className={cn("font-semibold text-primary", primaryClassName, className)}>
        {formatCurrency(amount, baseCurrency, baseSymbol)}
      </span>
    );
  }

  // Show both foreign and base currency
  if (variant === "stacked") {
    return (
      <span className={cn("inline-flex flex-col align-top leading-none", className)}>
        <span className={cn("font-semibold text-primary", primaryClassName)}>
          {formatCurrency(amount, foreignCurrency, foreignSymbol)}
        </span>
        <span className={cn("text-[10px] text-muted-foreground font-normal", secondaryClassName)}>
          {showApprox ? "≈ " : ""}{formatCurrency(baseAmount, baseCurrency, baseSymbol)}
        </span>
      </span>
    );
  }

  if (variant === "compact") {
    return (
      <span className={cn("inline-flex items-baseline gap-1", className)}>
        <span className={cn("font-semibold text-primary", primaryClassName)}>
          {formatCurrency(amount, foreignCurrency, foreignSymbol)}
        </span>
        <span className={cn("text-xs text-muted-foreground", secondaryClassName)}>
          ({showApprox ? "≈" : ""}{formatCurrency(baseAmount, baseCurrency, baseSymbol)})
        </span>
      </span>
    );
  }

  // Default: inline
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className={cn(primaryClassName)}>
        {formatCurrency(amount, foreignCurrency, foreignSymbol)}
      </span>
      <span className={cn("text-xs text-muted-foreground ml-1", secondaryClassName)}>
        ({showApprox ? "≈" : ""}{formatCurrency(baseAmount, baseCurrency, baseSymbol)})
      </span>
    </span>
  );
}

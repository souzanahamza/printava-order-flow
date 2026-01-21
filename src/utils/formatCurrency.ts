/**
 * Format currency using symbol from Supabase if provided, otherwise use Intl.NumberFormat
 * Uses smart precision: 4-6 decimals for values < 1, 2 decimals for values >= 1
 * @param amount - The numeric amount to format
 * @param currencyCode - Currency code (e.g., 'AED', 'USD', 'SAR', 'EUR', 'GBP')
 * @param symbol - Optional currency symbol from Supabase (e.g., 'د.إ', '$', '€')
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number, 
  currencyCode: string = ' ', 
  symbol?: string | null
): string {
  // Smart precision: for values less than 1, show 4-6 decimals to handle weak base currencies
  // For values >= 1, use standard 2 decimals
  const isSmallValue = amount > 0 && amount < 1;
  const minimumFractionDigits = isSmallValue ? 4 : 2;
  const maximumFractionDigits = isSmallValue ? 6 : 2;

  // If symbol is provided from Supabase, use it directly
  if (symbol) {
    const formattedNumber = new Intl.NumberFormat('en-US', {
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(amount);
    return `${symbol}${formattedNumber}`;
  }

  // Fallback to Intl.NumberFormat if no symbol provided
  const currencyLocaleMap: Record<string, string> = {
    'AED': 'en-AE',
    'USD': 'en-US',
    'SAR': 'ar-SA',
    'EUR': 'de-DE',
    'GBP': 'en-GB',
  };

  const locale = currencyLocaleMap[currencyCode] || 'en-US';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(amount);
  } catch (error) {
    // Fallback for invalid currency codes - use smart precision in fallback too
    console.warn(`Invalid currency code: ${currencyCode}`, error);
    const decimals = isSmallValue ? 6 : 2;
    return `${amount.toFixed(decimals)} ${currencyCode}`;
  }
}

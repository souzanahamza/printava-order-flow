/**
 * Format currency using Intl.NumberFormat based on currency code
 * @param amount - The numeric amount to format
 * @param currencyCode - Currency code (e.g., 'AED', 'USD', 'SAR', 'EUR', 'GBP')
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currencyCode: string = 'AED'): string {
  // Map common currency codes to their locale for better formatting
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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    // Fallback for invalid currency codes
    console.warn(`Invalid currency code: ${currencyCode}`, error);
    return `${amount.toFixed(2)} ${currencyCode}`;
  }
}

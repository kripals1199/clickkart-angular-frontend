import { Product, Variant } from '@core/models/catalog.model';

/**
 * The variant a listing card should quote.
 *
 * <p>Price lives on the variant, not the product, so "the price" of a listing with three sizes is a
 * choice rather than a fact. This picks the cheapest *active* variant, which is the "from ₹x"
 * convention shoppers expect - and quoting an inactive variant would advertise a price that cannot
 * be added to a basket.
 */
export function cheapestVariant(product: Product): Variant | null {
  const sellable = (product.variants ?? []).filter((variant) => variant.active);
  if (sellable.length === 0) {
    return null;
  }
  return sellable.reduce((cheapest, variant) =>
    variant.sellingPrice < cheapest.sellingPrice ? variant : cheapest,
  );
}

/**
 * Rupees, no decimals. The platform prices in whole rupees and the extra ".00" on every tile is
 * noise; anything with real paise still renders them, so nothing is silently rounded away.
 */
export function formatPrice(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) {
    return '—';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

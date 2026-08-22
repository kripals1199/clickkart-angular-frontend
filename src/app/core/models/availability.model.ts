/**
 * How much stock a SKU has, banded rather than counted.
 *
 * <p>The coarseness is deliberate on the server's side: a precise figure polled over time
 * reconstructs a competitor's sales volume and reorder cadence. `LOW` is the only band that
 * discloses a number, so a client must not infer or display one for the others.
 */
export type AvailabilityBand = 'OUT_OF_STOCK' | 'LOW' | 'IN_STOCK';

export interface Availability {
  sku: string;
  inStock: boolean;
  band: AvailabilityBand;
  /**
   * Populated only in the `LOW` band. Null elsewhere - and null means "not disclosed", not zero.
   */
  quantity: number | null;
}

/**
 * What to render for a band.
 *
 * <p>Note there is no "unknown" case. An unrecognised SKU comes back as OUT_OF_STOCK rather than a
 * 404, deliberately, so that nobody can enumerate which SKUs exist by watching status codes - which
 * means a client cannot tell "no such SKU" from "sold out" and must not pretend to.
 */
export function describeAvailability(
  availability: Availability | undefined,
): { label: string; tone: 'good' | 'low' | 'out' } | null {
  if (!availability) {
    return null;
  }

  switch (availability.band) {
    case 'IN_STOCK':
      return { label: 'In stock', tone: 'good' };
    case 'LOW':
      return {
        label:
          availability.quantity === null
            ? 'Only a few left'
            : `Only ${availability.quantity} left`,
        tone: 'low',
      };
    case 'OUT_OF_STOCK':
      return { label: 'Out of stock', tone: 'out' };
  }
}

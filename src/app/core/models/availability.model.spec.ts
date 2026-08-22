import { Availability, describeAvailability } from './availability.model';

const at = (band: Availability['band'], quantity: number | null = null): Availability => ({
  sku: 'SKU-1',
  inStock: band !== 'OUT_OF_STOCK',
  band,
  quantity,
});

/**
 * The banding is a privacy property, not a display preference. Inventory Service is deliberately
 * coarse above the low threshold because a precise count polled over time reconstructs a seller's
 * sales volume and reorder cadence - so the UI must never render a number the server did not send,
 * and must not invent one.
 */
describe('availability bands', () => {
  it('never shows a count outside the low band', () => {
    // Even if a figure somehow arrives alongside IN_STOCK, it is not ours to display.
    expect(describeAvailability(at('IN_STOCK', 250))!.label).toBe('In stock');
    expect(describeAvailability(at('OUT_OF_STOCK', 0))!.label).toBe('Out of stock');
  });

  it('shows the count only when the server disclosed one', () => {
    expect(describeAvailability(at('LOW', 3))!.label).toBe('Only 3 left');
    // LOW with no figure still has to say something, without inventing a number.
    expect(describeAvailability(at('LOW', null))!.label).toBe('Only a few left');
  });

  it('renders nothing at all when availability is unknown', () => {
    // Absent is "not looked up yet", which must not be drawn as out of stock.
    expect(describeAvailability(undefined)).toBeNull();
  });

  it('gives each band a distinct tone', () => {
    const tones = (['IN_STOCK', 'LOW', 'OUT_OF_STOCK'] as const).map(
      (band) => describeAvailability(at(band))!.tone,
    );
    expect(new Set(tones).size).toBe(3);
  });
});

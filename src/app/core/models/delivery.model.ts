import { FulfilmentStatus } from '@core/models/order.model';

/**
 * One parcel, as the agent carrying it sees it.
 *
 * <p>Mirrors the backend's DeliveryLineResponse, and inherits its omission: there is no money here.
 * A courier has no business knowing what the customer paid, so no line total, order total or
 * discount is sent - and if cash on delivery is ever wired up, the amount to collect must come from
 * Payment Service rather than being inferred from a price this model deliberately does not carry.
 *
 * <p>The unit is a line, not an order. A marketplace order can span sellers, each shipping its own
 * parcel, so two lines of one order can legitimately sit with two different agents.
 */
export interface DeliveryLine {
  orderReference: string;
  deliveryAddress: DeliveryAddress;
  sku: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  fulfilmentStatus: FulfilmentStatus;
  trackingReference: string | null;
  fulfilmentUpdatedAt: string | null;
  placedAt: string;
}

export interface DeliveryAddress {
  recipientName: string;
  contactNumber: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/**
 * The address as one line, for the places that need it inline rather than stacked - a card heading,
 * an aria-label. Skips the blanks rather than leaving ", ," where an optional field was empty.
 */
export function formatAddress(address: DeliveryAddress): string {
  return [address.line1, address.line2, address.landmark, address.city, address.state, address.postalCode]
    .filter((part) => !!part && part.trim().length > 0)
    .join(', ');
}

/**
 * A maps deep link for the parcel's destination.
 *
 * <p>geo: would be the better scheme on Android, but it needs coordinates and this platform stores
 * none - addresses are free text. A search URL is what actually works from a browser on any device.
 */
export function mapsUrlFor(address: DeliveryAddress): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatAddress(address))}`;
}

/**
 * Where an order can be in its life. Worth reading as two groups: `PENDING_PAYMENT` is the only
 * state that holds stock and the only one a customer may cancel from, and the rest of the terminal
 * states differ in *why* it ended - which is exactly what a customer wants told apart.
 */
export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'PAYMENT_FAILED'
  | 'STOCK_UNAVAILABLE'
  | 'EXPIRED';

/** Fulfilment runs per item, not per order - sellers ship their own lines independently. */
export type FulfilmentStatus = 'PENDING' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

/**
 * `items` is optional on purpose: leave it out and the server checks out the caller's basket,
 * pricing every line itself. That is the path this client uses. Sending explicit lines exists for
 * other integrators, and is deliberately not how a browser should ask - a client-supplied price or
 * line-up is not something the server should be asked to trust.
 */
export interface CheckoutRequest {
  items?: { sku: string; quantity: number }[];
  /** Which saved address to ship to. Omitted means the account's default. */
  addressId?: number | null;
}

export interface DeliveryAddressSnapshot {
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

export interface OrderItem {
  sku: string;
  productPublicId: string | null;
  productName: string | null;
  variantName: string | null;
  sellerPublicId: string | null;
  unitPrice: number;
  mrp: number | null;
  quantity: number;
  lineTotal: number;
  fulfilmentStatus: FulfilmentStatus;
  trackingReference: string | null;
  fulfilmentUpdatedAt: string | null;
}

/**
 * The delivery address is a snapshot taken at checkout, not a live reference to the address book.
 * Editing a saved address later must not silently rewrite where a past order was sent.
 */
export interface Order {
  orderReference: string;
  status: OrderStatus;
  /** The order-wide roll-up of its items' individual fulfilment states. */
  fulfilmentStatus: FulfilmentStatus;
  itemsSubtotal: number;
  shippingFee: number;
  totalAmount: number;
  deliveryAddress: DeliveryAddressSnapshot | null;
  items: OrderItem[];
  placedAt: string;
  /** When the stock hold lapses if payment has not landed. Null once the order is resolved. */
  paymentDeadline: string | null;
  resolvedAt: string | null;
  statusReason: string | null;
  refundRequired: boolean;
  refundReason: string | null;
}

/** The lighter shape the history list returns - no items, no address. */
export interface OrderSummary {
  orderReference: string;
  status: OrderStatus;
  fulfilmentStatus: FulfilmentStatus;
  totalAmount: number;
  itemCount: number;
  placedAt: string;
  paymentDeadline: string | null;
  refundRequired: boolean;
}

export interface CancellationRequest {
  reason: string;
}

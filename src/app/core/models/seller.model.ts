import { FulfilmentStatus, DeliveryAddressSnapshot, OrderItem } from '@core/models/order.model';

/**
 * A listing as the seller submits it. Note the SKU rules are deliberately strict - this string ends
 * up on a printed label, gets scanned, and is re-typed by a warehouse operator, and anything
 * ambiguous in that loop costs a mis-picked order.
 */
export interface VariantRequest {
  /** 3-64 letters, digits, hyphens or underscores. */
  sku: string;
  variantName: string;
  mrp: number;
  sellingPrice: number;
  /** Free-form options, e.g. { colour: 'Blue', size: 'M' }. At most 20. */
  attributes: Record<string, string>;
}

export interface ProductRequest {
  name: string;
  /** Lowercase letters, digits and single hyphens. Empty means "derive one from the name". */
  slug: string;
  description: string;
  brand: string;
  /** Must be a leaf category - the server refuses to hang a product off a branch. */
  categoryPublicId: string;
  /** At least one, at most 50. */
  variants: VariantRequest[];
}

/**
 * Per-SKU stock. `reservedQuantity` is held against unpaid orders, so available and reserved answer
 * different questions: what can still be sold, versus what is already spoken for.
 */
export interface Stock {
  sku: string;
  sellerPublicId: string;
  availableQuantity: number;
  reservedQuantity: number;
  /** Zero disables the low-stock warning rather than warning on everything. */
  reorderLevel: number;
  stockTrackingEnabled: boolean;
  lowStock: boolean;
  updatedDate: string;
}

export interface StockLevelRequest {
  availableQuantity: number;
  reorderLevel: number;
  stockTrackingEnabled: boolean;
}

/**
 * Why a stock figure moved outside the normal sell-and-ship path. Required on every adjustment:
 * an unexplained correction is indistinguishable from theft or a counting error, and those need
 * very different responses - so the server refuses to record the change without one.
 */
export type AdjustmentReason =
  | 'STOCK_TAKE'
  | 'RESTOCK'
  | 'DAMAGED'
  | 'CUSTOMER_RETURN'
  | 'CORRECTION';

export interface StockAdjustmentRequest {
  /** Signed: negative writes stock off, positive adds it. */
  delta: number;
  reason: AdjustmentReason;
  note: string;
}

/** An order as its seller sees it - only their own lines, and only their share of the total. */
export interface SellerOrder {
  orderReference: string;
  status: string;
  deliveryAddress: DeliveryAddressSnapshot | null;
  items: OrderItem[];
  sellerSubtotal: number;
  placedAt: string;
}

export interface FulfilmentUpdateRequest {
  status: FulfilmentStatus;
  trackingReference: string;
}

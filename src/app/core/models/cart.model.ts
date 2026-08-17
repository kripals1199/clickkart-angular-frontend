/**
 * One basket line, priced live from the catalog at read time rather than at add time. That is why
 * this carries so much more than a SKU and a quantity: the catalog may have changed its mind since
 * the item went in, and the flags below are how the server says so.
 */
export interface CartItem {
  sku: string;
  quantity: number;
  productPublicId: string | null;
  productName: string | null;
  variantName: string | null;
  sellerPublicId: string | null;
  /**
   * Null when the catalog could not be reached. Null is not zero and not free - a line with no
   * price is un-priced, not priceless, and is excluded from the subtotal.
   */
  unitPrice: number | null;
  mrp: number | null;
  lineTotal: number | null;
  /** False when the catalog will not sell this right now; `unpurchasableReason` says why. */
  purchasable: boolean;
  unpurchasableReason: string | null;
  /** True when the price moved since it was added - worth telling the customer before they pay. */
  priceChanged: boolean;
  priceWhenAdded: number | null;
  availability: string | null;
  addedAt: string;
}

/**
 * The basket as a whole. Note `readyForCheckout` and `pricingDegraded` are computed server-side and
 * mean different things: not-ready is a decision about the items, degraded is an admission that the
 * catalog could not be reached. A UI that collapsed the two would tell someone their item is gone
 * when it is merely unreachable.
 */
export interface Cart {
  items: CartItem[];
  distinctItems: number;
  totalQuantity: number;
  /** Sums purchasable lines only, so it can be lower than what the lines appear to add up to. */
  subtotal: number;
  readyForCheckout: boolean;
  pricingDegraded: boolean;
  lastActivityAt: string | null;
}

export interface AddItemRequest {
  sku: string;
  /** 1-100. */
  quantity: number;
}

export interface SetQuantityRequest {
  /** 0-100. Zero is the documented way to remove a line through this endpoint. */
  quantity: number;
}

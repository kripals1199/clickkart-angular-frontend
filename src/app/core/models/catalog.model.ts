/**
 * Catalog taxonomy. `children` is present only on the tree endpoints - the flat views omit the key
 * entirely rather than sending an empty array, so treat it as optional rather than "always a list".
 */
export interface Category {
  publicId: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentPublicId: string | null;
  depth: number;
  displayOrder: number;
  active: boolean;
  /** A leaf is the only kind of category a product may be assigned to. */
  leaf: boolean;
  createdDate: string;
  updatedDate: string;
  children?: Category[];
}

export type ProductStatus = 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'ARCHIVED';

/**
 * One buyable thing. Price lives on the variant, never on the product - a listing with three sizes
 * has three prices, and the product-level "price" a storefront usually shows is really the cheapest
 * variant's.
 */
export interface Product {
  publicId: string;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  categoryPublicId: string | null;
  sellerPublicId: string;
  status: ProductStatus;
  variants: Variant[];
  /** Moderation detail. Absent from the public catalog view, present for the owning seller. */
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  createdDate: string;
  updatedDate: string;
}

/**
 * The SKU is what the cart, inventory and orders all key on - the product's publicId never appears
 * in a basket. `attributes` is free-form (size, colour, ...) and is what distinguishes variants of
 * the same product from each other.
 */
export interface Variant {
  sku: string;
  variantName: string;
  mrp: number;
  sellingPrice: number;
  discountPercentage: number;
  attributes: Record<string, string>;
  active: boolean;
}

/** Query for the public search endpoint. Every field is optional; omitted ones are not filtered. */
export interface ProductSearchParams {
  query?: string;
  categoryPublicId?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  /** Zero-based, matching Spring's Pageable. */
  page?: number;
  size?: number;
  /** Spring sort syntax, e.g. "createdDate,desc". */
  sort?: string;
}

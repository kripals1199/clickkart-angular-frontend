export type SellerVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

/**
 * A seller's business identity, separate from their login and their customer profile. Verification
 * is what lets them sell - so this is the record an operator is deciding on.
 */
export interface SellerProfile {
  userPublicId: string;
  businessName: string;
  gstin: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  pickupAddressId: number | null;
  verificationStatus: SellerVerificationStatus;
  verificationNote: string | null;
  verificationDecidedAt: string | null;
  createdDate: string;
  updatedDate: string;
}

export interface SellerVerificationDecisionRequest {
  status: SellerVerificationStatus;
  /** The seller reads this. On a rejection it is the only thing telling them what to fix. */
  note: string;
}

/**
 * A moderation decision on a listing. `reason` is optional to the server on an approval and
 * meaningful only on a rejection, where it becomes the seller's `rejectionReason`.
 */
export interface ReviewDecisionRequest {
  approved: boolean;
  reason: string;
}

export interface CategoryRequest {
  name: string;
  /** Lowercase, digits, single hyphens. Empty means "derive one". Becomes a URL segment. */
  slug: string;
  description: string;
  /** Must be https, or empty. */
  imageUrl: string;
  /** Null makes it a root category. */
  parentPublicId: string | null;
  displayOrder: number;
}

export interface CategoryActivationRequest {
  active: boolean;
}

export type RefundStatus = 'INITIATED' | 'COMPLETED' | 'FAILED';

export interface RefundRequest {
  /** At least 0.01, and at most what remains unrefunded on the payment. */
  amount: number;
  /** Required - a refund with no stated cause is not auditable. */
  reason: string;
}

export interface Refund {
  refundReference: string;
  paymentReference: string;
  orderReference: string;
  amount: number;
  status: RefundStatus;
  reason: string;
  gatewayReference: string | null;
  failureReason: string | null;
  /** Which operator asked for it - the accountability half of the audit trail. */
  requestedBy: string | null;
  simulated: boolean;
  requestedAt: string;
  completedAt: string | null;
}

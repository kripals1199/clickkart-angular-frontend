export type PaymentMethod = 'CARD' | 'UPI' | 'NET_BANKING' | 'WALLET' | 'CASH_ON_DELIVERY';

/** Only INITIATED is non-terminal, and only CAPTURED can be refunded. */
export type PaymentStatus = 'INITIATED' | 'CAPTURED' | 'FAILED' | 'ABANDONED';

export type RefundState = 'NONE' | 'PARTIALLY_REFUNDED' | 'FULLY_REFUNDED';

/**
 * `methodToken` is what a real gateway would hand back after collecting the instrument in its own
 * iframe - it is never a card number, and this client must never put one in it. No processor is
 * integrated yet, so today it is an opaque string the simulator accepts.
 */
export interface PaymentRequest {
  orderReference: string;
  method: PaymentMethod;
  methodToken?: string;
}

/**
 * Note `simulated`. No payment processor is integrated on this platform: every capture is faked and
 * stamped so, and Payment Service refuses to start in prod against a fake gateway rather than
 * quietly pretending. A UI that hid the flag would be claiming money moved when none did.
 */
export interface Payment {
  paymentReference: string;
  orderReference: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  /** Safe to display - the last few digits only, never the instrument itself. */
  maskedInstrument: string | null;
  status: PaymentStatus;
  gatewayReference: string | null;
  failureReason: string | null;
  simulated: boolean;
  refundState: RefundState;
  refundedAmount: number | null;
  initiatedAt: string;
  resolvedAt: string | null;
  expiresAt: string | null;
}

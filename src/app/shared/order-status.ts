import { FulfilmentStatus, OrderStatus } from '@core/models/order.model';

/** Drives the badge colour. Kept coarse deliberately - three buckets, not seven. */
export type StatusTone = 'pending' | 'good' | 'bad' | 'neutral';

/**
 * How each order status should read to the customer who placed it.
 *
 * <p>The backend distinguishes seven, and the differences matter to the person waiting: an order
 * that expired, one whose payment was declined, and one that could not be stocked all ended without
 * a delivery, but only one of them is worth retrying the card for. Collapsing them into "failed"
 * would throw away the only thing that tells someone what to do next.
 */
export function describeOrderStatus(status: OrderStatus): { label: string; tone: StatusTone; hint: string } {
  switch (status) {
    case 'PENDING_PAYMENT':
      return {
        label: 'Awaiting payment',
        tone: 'pending',
        hint: 'Stock is held for you until the deadline below. Pay to confirm the order.',
      };
    case 'CONFIRMED':
      return {
        label: 'Confirmed',
        tone: 'good',
        hint: 'Payment received. Sellers are preparing your items.',
      };
    case 'COMPLETED':
      return { label: 'Completed', tone: 'good', hint: 'Every item in this order was delivered.' };
    case 'CANCELLED':
      return { label: 'Cancelled', tone: 'neutral', hint: 'This order was cancelled.' };
    case 'PAYMENT_FAILED':
      return {
        label: 'Payment failed',
        tone: 'bad',
        hint: 'The payment did not go through, so the order was not confirmed.',
      };
    case 'STOCK_UNAVAILABLE':
      return {
        label: 'Out of stock',
        tone: 'bad',
        hint: 'Stock ran out before this order could be confirmed. You have not been charged.',
      };
    case 'EXPIRED':
      return {
        label: 'Expired',
        tone: 'neutral',
        hint: 'Payment did not arrive before the hold lapsed, so the stock was released.',
      };
  }
}

export function describeFulfilment(status: FulfilmentStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Not dispatched yet';
    case 'PACKED':
      return 'Packed';
    case 'SHIPPED':
      return 'Shipped';
    case 'DELIVERED':
      return 'Delivered';
    case 'CANCELLED':
      return 'Cancelled';
  }
}

/** Cancelling is self-service only while the order still holds stock and no money has moved. */
export function isCancellable(status: OrderStatus): boolean {
  return status === 'PENDING_PAYMENT';
}

export function isPayable(status: OrderStatus): boolean {
  return status === 'PENDING_PAYMENT';
}

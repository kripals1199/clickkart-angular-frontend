import { OrderStatus } from '@core/models/order.model';
import { describeOrderStatus, isCancellable, isPayable } from './order-status';

/**
 * The eligibility rules matter more than they look. Offering "cancel" on an order that has already
 * been paid produces a 409 and a confused customer, and offering "pay" on a terminal order invites
 * a second capture attempt against an order nothing can be done with. The server enforces both -
 * these keep the UI from asking in the first place.
 */
describe('order status', () => {
  const allStatuses: OrderStatus[] = [
    'PENDING_PAYMENT',
    'CONFIRMED',
    'COMPLETED',
    'CANCELLED',
    'PAYMENT_FAILED',
    'STOCK_UNAVAILABLE',
    'EXPIRED',
  ];

  it('only allows paying while the order is awaiting payment', () => {
    expect(isPayable('PENDING_PAYMENT')).toBe(true);

    for (const status of allStatuses.filter((s) => s !== 'PENDING_PAYMENT')) {
      expect(isPayable(status)).toBe(false);
    }
  });

  it('only allows self-service cancellation before money has moved', () => {
    expect(isCancellable('PENDING_PAYMENT')).toBe(true);

    // CONFIRMED is the one worth calling out: it is cancellable in principle, but doing so is a
    // refund, which is an operator action. The customer-facing endpoint rejects it.
    expect(isCancellable('CONFIRMED')).toBe(false);

    for (const status of allStatuses.filter((s) => s !== 'PENDING_PAYMENT')) {
      expect(isCancellable(status)).toBe(false);
    }
  });

  it('describes every status, so none can render as blank', () => {
    for (const status of allStatuses) {
      const described = describeOrderStatus(status);
      expect(described.label.length).toBeGreaterThan(0);
      expect(described.hint.length).toBeGreaterThan(0);
      expect(['pending', 'good', 'bad', 'neutral']).toContain(described.tone);
    }
  });

  it('keeps the three "ended without a delivery" cases distinguishable', () => {
    // These are the ones a naive UI collapses into "failed". Only one of them is worth retrying a
    // payment for, so they must not read the same.
    const labels = [
      describeOrderStatus('PAYMENT_FAILED').label,
      describeOrderStatus('STOCK_UNAVAILABLE').label,
      describeOrderStatus('EXPIRED').label,
    ];
    expect(new Set(labels).size).toBe(3);
  });
});

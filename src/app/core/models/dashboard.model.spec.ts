import {
  COUNT_UNREADABLE,
  WorkItem,
  humaniseQueue,
  isUnreadable,
  routeForEndpoint,
  severityTone,
} from './dashboard.model';

function item(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    queue: 'stuckPaymentReports',
    owningService: 'payments',
    count: 3,
    severity: 'CRITICAL',
    endpoint: '/api/v1/payments/admin/unreported',
    description: 'Money moved but the order was never told.',
    ...overrides,
  };
}

/**
 * Admin Service goes to real trouble to distinguish "nothing to do" from "we could not ask" - a
 * count of -1 rather than 0, and a panel that reports unavailable rather than empty. Those are the
 * distinctions a dashboard is most likely to flatten, and flattening them means a queue nobody is
 * working looks like a quiet night.
 */
describe('dashboard model', () => {
  it('treats -1 as unreadable, not as a count', () => {
    expect(isUnreadable(item({ count: COUNT_UNREADABLE }))).toBe(true);
    expect(COUNT_UNREADABLE).toBe(-1);
  });

  it('does not treat an empty queue as unreadable', () => {
    // Zero is a real answer; the server filters these out, but the predicate must still be exact.
    expect(isUnreadable(item({ count: 0 }))).toBe(false);
    expect(isUnreadable(item({ count: 3 }))).toBe(false);
  });

  it('keeps severity independent of count', () => {
    // Urgency belongs to the kind of problem. One stranded payment outranks fifty listings.
    expect(severityTone('CRITICAL')).toBe('bad');
    expect(severityTone('ATTENTION')).toBe('pending');
    expect(severityTone('ROUTINE')).toBe('neutral');

    const tinyCritical = item({ count: 1, severity: 'CRITICAL' });
    const hugeRoutine = item({ count: 5000, severity: 'ROUTINE' });
    expect(severityTone(tinyCritical.severity)).toBe('bad');
    expect(severityTone(hugeRoutine.severity)).toBe('neutral');
  });

  describe('routing a queue to the page that works it', () => {
    it('sends each known queue to its owning view', () => {
      expect(routeForEndpoint('/api/v1/payments/admin/unreported')).toEqual({
        path: '/admin/operations',
        query: { view: 'unreported' },
      });
      expect(routeForEndpoint('/api/v1/orders/admin/refunds-required')).toEqual({
        path: '/admin/operations',
        query: { view: 'refunds' },
      });
      expect(routeForEndpoint('/api/v1/payments/admin/search?status=ABANDONED')).toEqual({
        path: '/admin/operations',
        query: { view: 'payments' },
      });
      expect(routeForEndpoint('/api/v1/products/admin/review-queue')).toEqual({
        path: '/admin/moderation',
      });
    });

    it('returns null for a queue no page owns, rather than guessing', () => {
      // A link that lands somewhere unrelated is worse than no link.
      expect(routeForEndpoint('/api/v1/something/admin/new-queue')).toBeNull();
    });
  });

  it('humanises queue names for display', () => {
    expect(humaniseQueue('stuckPaymentReports')).toBe('Stuck payment reports');
    expect(humaniseQueue('refundsRequired')).toBe('Refunds required');
  });
});

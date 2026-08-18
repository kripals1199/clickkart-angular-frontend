/**
 * One service's contribution to the dashboard, and whether it actually answered.
 *
 * <p>`available` is the field that matters during an incident. Each panel succeeds or fails on its
 * own so that one service being down does not blank the whole page - and a failed panel must be
 * rendered as failed, never as zero. "No payments need refunding" and "we could not ask about
 * payments" look identical on screen and mean opposite things: one is a quiet night, the other is a
 * queue nobody is working.
 */
export interface DashboardPanel {
  service: string;
  available: boolean;
  /** Empty when unavailable - absence of counts, not counts of zero. */
  counts: Record<string, number>;
  unavailableReason: string | null;
}

/**
 * The platform in one call, assembled from six services.
 *
 * <p>`generatedAt` is a snapshot taken over a second or two, not a consistent cut: two panels can
 * legitimately disagree about something that changed while the page was being built. Showing the
 * time says so rather than implying a precision that is not there.
 */
export interface Dashboard {
  panels: DashboardPanel[];
  /** True when any panel failed. Worth showing prominently - see DashboardPanel. */
  degraded: boolean;
  panelsAvailable: number;
  panelsTotal: number;
  generatedAt: string;
}

/**
 * Urgency is a property of the kind of problem, not of how much of it there is. One customer whose
 * money moved against an order that does not know it outranks fifty listings awaiting review, and
 * always will - so this is fixed per queue and must not be re-derived from `count`.
 */
export type WorkItemSeverity = 'CRITICAL' | 'ATTENTION' | 'ROUTINE';

/** A count of -1, not 0, when the owning service could not be reached. */
export const COUNT_UNREADABLE = -1;

export interface WorkItem {
  queue: string;
  owningService: string;
  /** -1 means the queue could not be read. Never render it as a number. */
  count: number;
  severity: WorkItemSeverity;
  /**
   * The API endpoint that owns this queue. Admin Service is read-only and cannot resolve anything
   * itself; naming the owner is what lets a read-only page still send an operator somewhere useful.
   */
  endpoint: string;
  description: string;
}

/**
 * What the discovery registry believes about one service.
 *
 * <p>Read from Eureka, so it answers "is it registered, and with how many instances" - not "is it
 * healthy". A service can be registered and sick. The panels' `available` flag is the better signal
 * for whether something is actually answering, because it comes from having just asked it.
 */
export interface ServiceStatus {
  service: string;
  instances: number;
  instanceIds: string[];
}

export function isUnreadable(item: WorkItem): boolean {
  return item.count === COUNT_UNREADABLE;
}

/** Colour only. The wording carries the detail; three tones is all the eye needs. */
export function severityTone(severity: WorkItemSeverity): 'bad' | 'pending' | 'neutral' {
  switch (severity) {
    case 'CRITICAL':
      return 'bad';
    case 'ATTENTION':
      return 'pending';
    case 'ROUTINE':
      return 'neutral';
  }
}

/**
 * Where in this application an operator can actually work a queue.
 *
 * <p>Keyed off the API endpoint the server names, because that is the stable identifier - the queue
 * name is a label. An unmapped endpoint yields null and the row simply shows no link rather than
 * guessing at a route that may not exist.
 */
export function routeForEndpoint(endpoint: string): { path: string; query?: Record<string, string> } | null {
  if (endpoint.includes('/payments/admin/unreported')) {
    return { path: '/admin/operations', query: { view: 'unreported' } };
  }
  if (endpoint.includes('/orders/admin/refunds-required')) {
    return { path: '/admin/operations', query: { view: 'refunds' } };
  }
  if (endpoint.includes('/payments/admin/search')) {
    return { path: '/admin/operations', query: { view: 'payments' } };
  }
  if (endpoint.includes('/products/admin/review-queue')) {
    return { path: '/admin/moderation' };
  }
  return null;
}

/** Turns "stuckPaymentReports" into "Stuck payment reports". */
export function humaniseQueue(queue: string): string {
  const spaced = queue.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

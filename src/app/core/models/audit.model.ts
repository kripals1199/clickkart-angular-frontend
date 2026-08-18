/**
 * One link in a service's hash chain.
 *
 * <p>`entryHash` covers this row's contents *and* `previousEntryHash`, which is what makes the log
 * tamper-evident: editing any historical row changes its hash, and every hash after it no longer
 * matches. Detecting that is what the verification endpoint does.
 */
export interface AuditEntry {
  id: number;
  occurredAt: string;
  /** Follows one request across every service it touched - the handle for tracing an incident. */
  correlationId: string | null;
  /** Who did it: an account's public id, or "system" for platform-initiated changes. */
  actor: string | null;
  /** The action name. Each service has its own vocabulary; all serialize as plain strings. */
  action: string;
  outcome: 'SUCCESS' | 'FAILURE';
  ipAddress: string | null;
  /** Auth Service records this; the other services do not. */
  userAgent?: string | null;
  details: string | null;
  previousEntryHash: string | null;
  entryHash: string;
}

/**
 * The result of walking a chain end to end. `intact` false is not a server error - it is the
 * finding, and `brokenAtEntryId` is the row where recomputation first disagreed.
 */
export interface ChainIntegrityReport {
  intact: boolean;
  entriesChecked: number;
  brokenAtEntryId: number | null;
  reason: string | null;
}

/**
 * The services that keep a chain, and where each one's endpoints live.
 *
 * <p>`verifyPath` exists because the platform is not uniform here: Auth Service spells its
 * verification endpoint `/audit/verify` while every other service spells it `/audit/verification`.
 * A client that assumed one shape would 404 on whichever it guessed wrong, so the difference is
 * recorded per service rather than derived.
 */
export interface AuditSource {
  key: string;
  label: string;
  /** Collection root, e.g. "/api/v1/orders". */
  base: string;
  verifyPath: string;
}

export const AUDIT_SOURCES: AuditSource[] = [
  { key: 'auth', label: 'Auth', base: '/api/v1/auth', verifyPath: '/audit/verify' },
  { key: 'user', label: 'Users', base: '/api/v1/users', verifyPath: '/audit/verification' },
  { key: 'category', label: 'Categories', base: '/api/v1/categories', verifyPath: '/audit/verification' },
  { key: 'product', label: 'Products', base: '/api/v1/products', verifyPath: '/audit/verification' },
  { key: 'inventory', label: 'Inventory', base: '/api/v1/inventory', verifyPath: '/audit/verification' },
  { key: 'order', label: 'Orders', base: '/api/v1/orders', verifyPath: '/audit/verification' },
  { key: 'payment', label: 'Payments', base: '/api/v1/payments', verifyPath: '/audit/verification' },
];

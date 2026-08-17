/**
 * The envelope every ClickKart endpoint returns, success or failure. Mirrors the ApiResponse
 * record each service duplicates (there is no shared library on the backend by design, so this
 * is the one place the shape is written down on the client).
 */
export interface ApiResponse<T> {
  timestamp: string;
  status: number;
  success: boolean;
  /** Null on failure. */
  data: T | null;
  message: string | null;
  error?: ErrorDetail;
  path: string;
  /**
   * Minted by Auth Service at login and carried in the token, so one id follows a request across
   * every service it touches. Worth surfacing in error toasts - it is the handle support needs to
   * find the request in the logs.
   */
  correlationId: string;
}

export interface ErrorDetail {
  /**
   * Branch on this, never on the envelope's `message`. The code is a stable contract; the message
   * is written for a human and may be reworded at any time.
   */
  code: string;
  /** Populated only for bean-validation failures, keyed by field name. */
  fieldErrors?: Record<string, string>;
  /**
   * Present only where an error carries structured detail the client can act on. The one in use
   * today is `lockedUntil` (an ISO-8601 instant) on ACCOUNT_LOCKED, which is what lets a sign-in
   * form say when the account frees up instead of just refusing.
   */
  metadata?: Record<string, unknown>;
}

/** Paged collections come back wrapped in this, inside `data`. */
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

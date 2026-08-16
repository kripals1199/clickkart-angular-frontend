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
   * Branch on this, never on `message`. The code is a stable contract; the message is written for
   * a human and may be reworded at any time.
   */
  code: string;
  message?: string;
  fieldErrors?: Record<string, string>;
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

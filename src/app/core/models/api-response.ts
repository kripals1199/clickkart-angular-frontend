/**
 * The envelope every ClickKart endpoint returns,
 * success or failure.
 *
 * Mirrors the backend ApiResponse<T>.
 */
export type ApiResponse<T> =
  | ApiSuccessResponse<T>
  | ApiErrorResponse;

/**
 * Successful API response.
 */
export interface ApiSuccessResponse<T> {
  timestamp: string;
  status: number;
  success: true;
  data: T;
  error: null;
  message: string | null;
  path: string;
  correlationId: string;
}

/**
 * Failed API response.
 */
export interface ApiErrorResponse {
  timestamp: string;
  status: number;
  success: false;
  data: null;
  error: ErrorDetail | null;
  message: string | null;
  path: string;
  correlationId: string;
}

/**
 * Structured error returned by the backend.
 */
export interface ErrorDetail {

  /**
   * Stable error code.
   * Branch on this instead of the envelope message.
   */
  code: string;

  /**
   * Populated only for bean-validation failures,
   * keyed by field name.
   */
  fieldErrors?: Record<string, string>;

  /**
   * Structured metadata that the client can act upon.
   *
   * Example:
   * lockedUntil -> ISO-8601 instant for ACCOUNT_LOCKED.
   */
  metadata?: Record<string, unknown>;
}

/**
 * Paged collections come back wrapped in this,
 * inside data.
 */
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}
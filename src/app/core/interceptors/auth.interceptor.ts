import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '@core/services/auth.service';

/**
 * Endpoints where a 401 is a verdict about credentials, not an expired session.
 *
 * <p>Refreshing after one of these would be answering the wrong question: a wrong password is not
 * a stale token, and retrying it with a fresher one fails identically. `/refresh` itself is here to
 * stop a failed refresh from triggering another.
 */
const CREDENTIAL_ENDPOINTS = [
  '/api/v1/auth/refresh',
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/otp/verify',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/logout',
];

function isCredentialEndpoint(request: HttpRequest<unknown>): boolean {
  return CREDENTIAL_ENDPOINTS.some((path) => request.url.includes(path));
}

/**
 * Attaches the bearer token to every call that leaves the app, and keeps the session alive across
 * the access token's expiry.
 *
 * <p>The access token lasts fifteen minutes; the refresh token lasts a week. Until now nothing
 * called refresh, so a 401 signed the user out - which meant being thrown back to the login form
 * every quarter of an hour, potentially mid-checkout, while holding a refresh token good for seven
 * days. A 401 now buys one refresh and a replay of the original request, and only becomes a
 * sign-out if the refresh itself fails.
 *
 * <p>The refresh is single-flight, and that is a correctness requirement rather than a nicety.
 * Tokens rotate, and presenting an already-rotated one is treated as reuse: Auth Service revokes
 * the whole session family and records REFRESH_TOKEN_REUSE_DETECTED. Three requests expiring
 * together would rotate once and then look twice like a stolen token being replayed. AuthService
 * shares one in-flight refresh so that cannot happen.
 *
 * <p>Note what this deliberately does NOT do: send an X-Correlation-Id header. The correlation id
 * is minted by Auth Service at login and travels inside the token; the Gateway reads that claim
 * and sets the header itself on the way through. A client-generated id would either be ignored or
 * compete with the real one, which is exactly the split-trace bug the backend already fixed.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const withToken = (request: HttpRequest<unknown>, token: string | null) =>
    token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;

  return next(withToken(req, auth.getAccessToken())).pipe(
    catchError((error: HttpErrorResponse) => {
      const recoverable =
        error.status === 401 &&
        auth.isAuthenticated() &&
        !isCredentialEndpoint(req) &&
        auth.canRefresh();

      if (!recoverable) {
        // Either not an expiry, or nothing to refresh with. If the session is over, end it.
        if (error.status === 401 && auth.isAuthenticated() && !isCredentialEndpoint(req)) {
          endSession();
        }
        return throwError(() => error);
      }

      return auth.refreshAccessToken().pipe(
        // Replay the original request, not the one that already failed - it carries the stale
        // Authorization header.
        switchMap((token) => next(withToken(req, token))),
        catchError(() => {
          // The refresh failed: expired, revoked, or reuse detected. The session is genuinely over
          // now, so surface the original 401 rather than the refresh's.
          endSession();
          return throwError(() => error);
        }),
      );
    }),
  );

  /**
   * Clears local state and sends them to sign in, carrying where they were so the return trip
   * resumes. No server round trip: the token is already not being honoured, and a logout call
   * would 401 too.
   */
  function endSession(): void {
    auth.endSession();

    const current = router.url;
    const returnUrl =
      current.startsWith('/login') || current.startsWith('/register') ? undefined : current;

    router.navigate(['/login'], { queryParams: { returnUrl } });
  }
};

import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';

/**
 * Attaches the bearer token to every call that leaves the app, and signs the user out when the
 * Gateway says the token is no longer good.
 *
 * <p>Note what this deliberately does NOT do: send an X-Correlation-Id header. The correlation id
 * is minted by Auth Service at login and travels inside the token; the Gateway reads that claim
 * and sets the header itself on the way through. A client-generated id would either be ignored or
 * compete with the real one, which is exactly the split-trace bug the backend just fixed.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.getAccessToken();

  const authorised = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authorised).pipe(
    catchError((error: HttpErrorResponse) => {
      // 401 means the token is missing, expired, or was revoked server-side by a logout
      // elsewhere. Any of those mean this session is over - clearing local state without a
      // server round trip is right here, because the token is already not being honoured.
      if (error.status === 401 && auth.isAuthenticated()) {
        auth.logout().subscribe({ complete: () => router.navigate(['/login']) });
      }
      return throwError(() => error);
    }),
  );
};

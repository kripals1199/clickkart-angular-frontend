import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '@core/services/auth.service';

/**
 * Keeps a whole console out of the navigation of accounts that have no business there.
 *
 * <p>Like {@link authGuard}, this is routing convenience and not access control - it reads roles
 * from an unverified token, and every endpoint behind these pages carries its own
 * `@PreAuthorize("hasRole('SELLER')")` on the server. Forging the claim gets you a console full of
 * 403s, not a seller account.
 *
 * <p>Signed-out visitors go to sign-in with a returnUrl; signed-in ones without the role go home,
 * because sending them to a login form they are already past is a loop, not a fix.
 */
export function roleGuard(role: string): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
    }

    return auth.hasRole(role) ? true : router.createUrlTree(['/']);
  };
}

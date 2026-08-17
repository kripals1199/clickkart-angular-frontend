import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '@core/services/auth.service';

/**
 * Keeps signed-out visitors off the account, cart and order pages, sending them to sign in with a
 * `returnUrl` so they land back where they were aiming.
 *
 * <p>This is a routing convenience, not a security control. It checks only that a token exists -
 * not that it is valid, unexpired or unrevoked, none of which a client can determine. Every one of
 * these pages is useless without data, and that data comes from endpoints the Gateway authorises
 * independently; forging your way past this guard gets you an empty page and a 401.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

// import { Component } from '@angular/core';

// @Component({
//   selector: 'app-navbar',
//   imports: [],
//   templateUrl: './navbar.html',
//   styleUrl: './navbar.scss',
// })
// export class Navbar {}

import {
  Component,
  effect,
  inject,
  signal
} from '@angular/core';

import { Router, RouterLink } from '@angular/router';

import { AuthService } from '@core/services/auth.service';
import { CartService } from '@core/services/cart.service';

import { FormsModule } from '@angular/forms';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSidenavModule } from '@angular/material/sidenav';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatBadgeModule,
    MatSidenavModule
  ],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss'
})
export class Navbar {

  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);

  readonly search = signal('');

  readonly mobileMenuOpen = signal(false);

  /** Drives which side of the menu shows: sign in / create account, or the account itself. */
  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly currentUser = this.auth.currentUser;
  readonly cartCount = this.cart.itemCount;

  constructor() {
    // Load the basket once on arrival if there is already a session, so the badge is right on a
    // cold page load rather than only after the cart page has been visited. There are no guest
    // carts, so asking without a session would just be a guaranteed 401.
    effect(() => {
      if (this.auth.isAuthenticated() && this.cart.current() === null) {
        this.cart.load().subscribe({ error: () => undefined });
      }
    });
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update(value => !value);
  }

  submitSearch(): void {
    const query = this.search().trim();
    this.router.navigate(['/products'], { queryParams: query ? { query } : {} });
    this.mobileMenuOpen.set(false);
  }

  logout(): void {
    // Server-side revocation, not just a local clear - see AuthService. Navigate either way,
    // because the session is over from this browser's point of view regardless.
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/']),
      error: () => this.router.navigate(['/'])
    });
    // Drop the cached basket too, or the next account to sign in inherits this one's badge.
    this.cart.forget();
    this.mobileMenuOpen.set(false);
  }

}

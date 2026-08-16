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
  inject,
  signal
} from '@angular/core';

import { Router, RouterLink } from '@angular/router';

import { AuthService } from '@core/services/auth.service';

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
  private readonly router = inject(Router);

  readonly search = signal('');

  readonly mobileMenuOpen = signal(false);

  /** Drives which side of the menu shows: sign in / create account, or the account itself. */
  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly currentUser = this.auth.currentUser;

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update(value => !value);
  }

  logout(): void {
    // Server-side revocation, not just a local clear - see AuthService. Navigate either way,
    // because the session is over from this browser's point of view regardless.
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/']),
      error: () => this.router.navigate(['/'])
    });
    this.mobileMenuOpen.set(false);
  }

}

import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Navbar } from '@layout/navbar/navbar';
import { Footer } from '@layout/footer/footer';

/**
 * The storefront chrome - navbar above, footer below, routed page in between.
 *
 * <p>It exists so pages stop importing the navbar and footer themselves. When only the home page
 * had chrome that was harmless; across a catalog, cart, account and orders it means every new page
 * has to remember to include both, and the one that forgets is the bug. Auth pages deliberately
 * route outside this shell: a sign-in screen with a "my account" menu on it invites the visitor to
 * click the thing they cannot use yet.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, Navbar, Footer],
  template: `
    <app-navbar />
    <main class="shell__content">
      <router-outlet />
    </main>
    <app-footer />
  `,
  styles: `
    .shell__content {
      display: block;
      min-height: 60vh;
    }
  `,
})
export class Shell {}

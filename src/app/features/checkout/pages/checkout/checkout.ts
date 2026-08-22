import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { CartService } from '@core/services/cart.service';
import { UserService } from '@core/services/user.service';
import { OrderService } from '@core/services/order.service';
import { Address } from '@core/models/user.model';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

/**
 * Choose where it goes, check what is in it, place the order.
 *
 * <p>Payment is deliberately not here. Checkout produces a PENDING_PAYMENT order holding stock
 * against a deadline, and paying is a separate step that the order detail page owns - which means
 * a customer who closes the tab between the two comes back to an order they can still pay for,
 * rather than a half-finished wizard with nowhere to resume.
 *
 * <p>Only the address id is sent. The server reads the basket and prices it, so nothing here can
 * put a line or a price into an order.
 */
@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [RouterLink,
    MatButtonModule,
    MatCardModule,
  ],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Checkout {
  private readonly cart = inject(CartService);
  private readonly users = inject(UserService);
  private readonly orders = inject(OrderService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly addresses = signal<Address[]>([]);
  readonly selectedAddressId = signal<number | null>(null);

  readonly placing = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly basket = this.cart.current;
  readonly items = computed(() => this.basket()?.items ?? []);
  readonly ready = computed(() => this.basket()?.readyForCheckout ?? false);
  readonly hasAddress = computed(() => this.addresses().length > 0);

  readonly canPlace = computed(
    () => this.ready() && this.selectedAddressId() !== null && !this.placing(),
  );

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.cart.load().subscribe({
      next: () => this.loadAddresses(),
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  select(addressId: number): void {
    this.selectedAddressId.set(addressId);
  }

  place(): void {
    if (!this.canPlace()) {
      return;
    }

    this.placing.set(true);
    this.errorMessage.set(null);

    this.orders.checkout(this.selectedAddressId()).subscribe({
      next: (res) => {
        this.placing.set(false);
        const order = res.data;
        if (!order) {
          this.errorMessage.set('The order was placed but could not be read back. Check your orders.');
          return;
        }
        // The basket is consumed server-side, so the cached copy is now stale. Refresh rather than
        // assume it is empty - the server decides what survived checkout.
        this.cart.load().subscribe({ error: () => undefined });
        this.router.navigate(['/orders', order.orderReference], {
          queryParams: { placed: '1' },
        });
      },
      error: (err) => {
        this.placing.set(false);
        this.errorMessage.set(this.describe(err?.error?.error?.code));
        // Stock may have moved under us; re-read so the page shows what is actually buyable now.
        this.cart.load().subscribe({ error: () => undefined });
      },
    });
  }

  private loadAddresses(): void {
    this.users.addresses().subscribe({
      next: (res) => {
        const list = res.data ?? [];
        this.addresses.set(list);
        // Preselect the default, or the only one. Making someone choose between one option is
        // pointless, and the default exists precisely so this decision is already made.
        const preferred = list.find((address) => address.defaultAddress) ?? list[0];
        this.selectedAddressId.set(preferred?.id ?? null);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  private describe(code: string | undefined): string {
    switch (code) {
      case 'CART_EMPTY':
        return 'Your basket is empty, so there is nothing to order.';
      case 'CART_NOT_READY':
        return 'Some items are no longer available. Go back to your basket and remove them.';
      case 'INSUFFICIENT_STOCK':
      case 'OUT_OF_STOCK':
        return 'Stock ran out for one of your items while you were checking out. Your basket has been refreshed.';
      case 'ADDRESS_NOT_FOUND':
        return 'That delivery address could not be found. Pick another one.';
      case 'DOWNSTREAM_UNAVAILABLE':
      case 'SERVICE_UNAVAILABLE':
        return 'We could not reach a service needed to place the order. Nothing was charged — please try again.';
      default:
        return 'The order could not be placed. Nothing was charged — please try again.';
    }
  }
}

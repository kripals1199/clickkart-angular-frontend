import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { CartService } from '@core/services/cart.service';
import { CartItem } from '@core/models/cart.model';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

/**
 * The basket.
 *
 * <p>Its main job beyond arithmetic is to be honest about the three states the server distinguishes
 * and a naive cart would flatten. A line can be un-priced because the catalog was unreachable
 * (`pricingDegraded`), unbuyable because the catalog refused it (`purchasable` false), or simply
 * cheaper or dearer than when it was added (`priceChanged`). Hiding any of those would either
 * mislead someone about what they are about to pay, or tell them an item is gone when the catalog
 * was merely down.
 *
 * <p>Quantity changes are sent one at a time and the whole cart is replaced from each response,
 * because the server clamps quantities and re-prices lines - the returned cart is the truth, not
 * the number that was typed.
 */
@Component({
  selector: 'app-cart-page',
  standalone: true,
  imports: [RouterLink,
    MatButtonModule,
    MatCardModule,
  ],
  templateUrl: './cart-page.html',
  styleUrl: './cart-page.scss',
})
export class CartPage {
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly failed = signal(false);
  /** SKU currently being changed, so only that row shows a busy state. */
  readonly busySku = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly contents = this.cart.current;
  readonly items = computed(() => this.contents()?.items ?? []);
  readonly isEmpty = computed(() => !this.loading() && this.items().length === 0);

  readonly blockedLines = computed(() => this.items().filter((item) => !item.purchasable).length);

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.cart.load().subscribe({
      next: () => this.loading.set(false),
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  /**
   * Guarded by the same flag that disables the button, so a stale click cannot slip past it - the
   * cart can become un-ready between render and click if a line goes out of stock.
   */
  goToCheckout(): void {
    if (this.contents()?.readyForCheckout) {
      this.router.navigate(['/checkout']);
    }
  }

  increase(item: CartItem): void {
    this.change(item.sku, item.quantity + 1);
  }

  decrease(item: CartItem): void {
    // One is the floor for this control. Dropping to zero would silently delete the line, which is
    // a different intention than "I want fewer" - removal has its own button.
    if (item.quantity > 1) {
      this.change(item.sku, item.quantity - 1);
    }
  }

  remove(sku: string): void {
    this.busySku.set(sku);
    this.errorMessage.set(null);
    this.cart.removeItem(sku).subscribe({
      next: () => this.busySku.set(null),
      error: () => {
        this.busySku.set(null);
        this.errorMessage.set('That item could not be removed. Please try again.');
      },
    });
  }

  clear(): void {
    this.errorMessage.set(null);
    this.cart.clear().subscribe({
      error: () => this.errorMessage.set('The basket could not be emptied. Please try again.'),
    });
  }

  private change(sku: string, quantity: number): void {
    this.busySku.set(sku);
    this.errorMessage.set(null);
    this.cart.setQuantity(sku, quantity).subscribe({
      next: () => this.busySku.set(null),
      error: (err) => {
        this.busySku.set(null);
        this.errorMessage.set(this.describe(err?.error?.error?.code));
      },
    });
  }

  private describe(code: string | undefined): string {
    switch (code) {
      case 'OUT_OF_STOCK':
      case 'INSUFFICIENT_STOCK':
        return 'There is not enough stock for that quantity.';
      case 'VARIANT_NOT_PURCHASABLE':
        return 'That item is no longer available to buy.';
      default:
        return 'That change could not be saved. Please try again.';
    }
  }
}

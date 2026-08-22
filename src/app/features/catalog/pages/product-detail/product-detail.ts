import { KeyValuePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CatalogService } from '@core/services/catalog.service';
import { CartService } from '@core/services/cart.service';
import { AuthService } from '@core/services/auth.service';
import { Product, Variant } from '@core/models/catalog.model';
import { AvailabilityService } from '@core/services/availability.service';
import { Availability, describeAvailability } from '@core/models/availability.model';
import { MatButtonModule } from '@angular/material/button';

/**
 * One listing, and the place a basket actually gets filled.
 *
 * <p>The unit of purchase is the variant, not the product - inventory, cart and orders all key on
 * SKU - so there is deliberately no "add this product" path. A visitor must land on a specific
 * variant, and one is preselected when the listing has only a single active option so the common
 * case still takes one click.
 */
@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [RouterLink, KeyValuePipe,
    MatButtonModule,
  ],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.scss',
})
export class ProductDetail {
  private readonly catalog = inject(CatalogService);
  private readonly cart = inject(CartService);
  private readonly availability = inject(AvailabilityService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly product = signal<Product | null>(null);
  readonly selectedSku = signal<string | null>(null);

  /** Keyed by SKU. Absent means "not looked up yet", which is not the same as out of stock. */
  readonly stock = signal<Map<string, Availability>>(new Map());

  readonly adding = signal(false);
  readonly added = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly sellableVariants = computed(() =>
    (this.product()?.variants ?? []).filter((variant) => variant.active),
  );

  readonly selected = computed<Variant | null>(() => {
    const sku = this.selectedSku();
    return this.sellableVariants().find((variant) => variant.sku === sku) ?? null;
  });

  readonly isAuthenticated = this.auth.isAuthenticated;

  readonly selectedStock = computed(() => {
    const sku = this.selectedSku();
    return sku ? this.stock().get(sku) : undefined;
  });

  /**
   * Blocked only on a definite OUT_OF_STOCK. If availability has not loaded, or the lookup failed,
   * the button stays enabled and the server decides - refusing to sell because inventory was
   * briefly unreachable would turn an outage into lost orders.
   */
  readonly outOfStock = computed(() => this.selectedStock()?.band === 'OUT_OF_STOCK');

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      if (slug) {
        this.fetch(slug);
      }
    });
  }

  describeStock(sku: string) {
    return describeAvailability(this.stock().get(sku));
  }

  select(sku: string): void {
    this.selectedSku.set(sku);
    this.added.set(false);
    this.errorMessage.set(null);
  }

  addToCart(): void {
    const variant = this.selected();
    if (!variant || this.adding() || this.outOfStock()) {
      return;
    }

    // There are no guest baskets on this platform, so sending an anonymous visitor to the cart
    // would just produce a 401. Route them through sign-in and bring them back here instead.
    if (!this.isAuthenticated()) {
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }

    this.adding.set(true);
    this.errorMessage.set(null);

    this.cart.addItem(variant.sku, 1).subscribe({
      next: () => {
        this.adding.set(false);
        this.added.set(true);
      },
      error: (err) => {
        this.adding.set(false);
        this.errorMessage.set(this.describe(err?.error?.error?.code));
      },
    });
  }

  private fetch(slug: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.added.set(false);
    this.errorMessage.set(null);

    this.catalog.productBySlug(slug).subscribe({
      next: (res) => {
        this.product.set(res.data);
        this.loading.set(false);

        // Preselect when there is no choice to make. With several options, leaving it unselected is
        // deliberate - guessing a size for someone is worse than asking.
        const sellable = this.sellableVariants();
        this.selectedSku.set(sellable.length === 1 ? sellable[0].sku : null);
        this.loadAvailability(sellable.map((variant) => variant.sku));
      },
      error: (err) => {
        this.loading.set(false);
        this.notFound.set(err?.status === 404);
      },
    });
  }

  /**
   * Availability is a separate service, so a failure here must not take the product page with it -
   * the page is still useful without stock badges, and the server rechecks stock on add anyway.
   */
  private loadAvailability(skus: string[]): void {
    if (skus.length === 0) {
      this.stock.set(new Map());
      return;
    }
    this.availability.forSkus(skus).subscribe({
      next: (map) => this.stock.set(map),
      error: () => this.stock.set(new Map()),
    });
  }

  private describe(code: string | undefined): string {
    switch (code) {
      case 'VARIANT_NOT_PURCHASABLE':
        return 'That option is not available to buy right now.';
      case 'OUT_OF_STOCK':
        return 'That option just went out of stock.';
      case 'CART_LIMIT_EXCEEDED':
        return 'Your basket is at its limit. Remove something before adding more.';
      default:
        return 'That could not be added to your basket. Please try again.';
    }
  }
}

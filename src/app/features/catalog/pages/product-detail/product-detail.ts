import { KeyValuePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CatalogService } from '@core/services/catalog.service';
import { CartService } from '@core/services/cart.service';
import { AuthService } from '@core/services/auth.service';
import { Product, Variant } from '@core/models/catalog.model';

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
  imports: [RouterLink, KeyValuePipe],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.scss',
})
export class ProductDetail {
  private readonly catalog = inject(CatalogService);
  private readonly cart = inject(CartService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly product = signal<Product | null>(null);
  readonly selectedSku = signal<string | null>(null);

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

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      if (slug) {
        this.fetch(slug);
      }
    });
  }

  select(sku: string): void {
    this.selectedSku.set(sku);
    this.added.set(false);
    this.errorMessage.set(null);
  }

  addToCart(): void {
    const variant = this.selected();
    if (!variant || this.adding()) {
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
      },
      error: (err) => {
        this.loading.set(false);
        this.notFound.set(err?.status === 404);
      },
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

import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { HeroBanner } from '@shared/components/hero-banner/hero-banner';
import { CategorySection } from '@shared/components/category-section/category-section';
import { ProductCard } from '@shared/components/product-card/product-card';
import { BrandSection } from '@shared/components/brand-section/brand-section';

import { CatalogService } from '@core/services/catalog.service';
import { AvailabilityService } from '@core/services/availability.service';
import { Product } from '@core/models/catalog.model';
import { Availability } from '@core/models/availability.model';
import { cheapestVariant } from '@shared/pricing';

/**
 * The storefront's front page.
 *
 * <p>It used to render four hardcoded products with Unsplash photographs, which meant the first
 * screen every visitor saw was a mockup: nothing was clickable through to a real product, and the
 * page looked identical whether the catalog had ten thousand products or none.
 *
 * <p>Now it shows a real page of the catalog. That also means it has to handle the three states a
 * mock never has - still loading, nothing published yet, and the catalog being unreachable - and
 * the empty state has to be honest rather than looking like a rendering fault.
 *
 * <p>The navbar and footer come from the shell this page routes inside, not from here.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    RouterLink,
    HeroBanner,
    CategorySection,
    ProductCard,
    BrandSection
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home {
  private readonly catalog = inject(CatalogService);
  private readonly availability = inject(AvailabilityService);

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly products = signal<Product[]>([]);
  readonly stock = signal<Map<string, Availability>>(new Map());

  readonly isEmpty = computed(() => !this.loading() && !this.failed() && this.products().length === 0);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);

    // Newest first: with no recommendation engine on the platform, "what went up most recently" is
    // an honest ordering for a front page, where "trending" would be a claim nothing measures.
    this.catalog.searchProducts({ page: 0, size: 8, sort: 'createdDate,desc' }).subscribe({
      next: (res) => {
        this.products.set(res.data?.content ?? []);
        this.loading.set(false);
        this.loadAvailability();
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  /** The tile quotes one variant, so only that SKU's availability is worth fetching. */
  availabilityFor(product: Product): Availability | undefined {
    const variant = cheapestVariant(product);
    return variant ? this.stock().get(variant.sku) : undefined;
  }

  private loadAvailability(): void {
    const skus = this.products()
      .map((product) => cheapestVariant(product)?.sku)
      .filter((sku): sku is string => !!sku);

    if (skus.length === 0) {
      this.stock.set(new Map());
      return;
    }

    this.availability.forSkus(skus).subscribe({
      // Stock badges are an enhancement; the grid stands without them.
      next: (map) => this.stock.set(map),
      error: () => this.stock.set(new Map()),
    });
  }
}

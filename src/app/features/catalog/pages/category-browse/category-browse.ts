import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { CatalogService } from '@core/services/catalog.service';
import { AvailabilityService } from '@core/services/availability.service';
import { Category, Product } from '@core/models/catalog.model';
import { Availability } from '@core/models/availability.model';
import { PageResponse } from '@core/models/api-response';
import { cheapestVariant } from '@shared/pricing';

/**
 * Browsing the taxonomy, which until now customers could not do at all: the storefront offered a
 * flat dropdown of root categories and nothing else, so every branch below the top level was
 * unreachable however deep an operator had built the tree.
 *
 * <p>The page behaves differently for a branch and a leaf, and it has to. Product search matches
 * `categoryPublicId` exactly rather than across a subtree, and a product can only be assigned to a
 * leaf - so filtering by a branch returns nothing, always. Showing an empty product grid on
 * "Fashion" would look like a broken page reporting an empty shop. A branch therefore offers its
 * children to drill into, and only a leaf lists products.
 */
@Component({
  selector: 'app-category-browse',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './category-browse.html',
  styleUrl: './category-browse.scss',
})
export class CategoryBrowse {
  private readonly catalog = inject(CatalogService);
  private readonly availability = inject(AvailabilityService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly failed = signal(false);

  readonly category = signal<Category | null>(null);
  readonly trail = signal<Category[]>([]);
  readonly children = signal<Category[]>([]);

  readonly productPage = signal<PageResponse<Product> | null>(null);
  readonly loadingProducts = signal(false);
  readonly stock = signal<Map<string, Availability>>(new Map());

  readonly isLeaf = computed(() => this.category()?.leaf ?? false);
  readonly products = computed(() => this.productPage()?.content ?? []);
  readonly total = computed(() => this.productPage()?.totalElements ?? 0);
  readonly pageIndex = computed(() => this.productPage()?.page ?? 0);
  readonly totalPages = computed(() => this.productPage()?.totalPages ?? 0);
  readonly isLast = computed(() => this.productPage()?.last ?? true);

  /** The trail without the current category, which is the heading rather than a link. */
  readonly ancestors = computed(() => {
    const trail = this.trail();
    const here = this.category()?.publicId;
    return trail.filter((entry) => entry.publicId !== here);
  });

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      if (slug) {
        this.load(slug);
      }
    });
  }

  load(slug: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.failed.set(false);
    this.children.set([]);
    this.trail.set([]);
    this.productPage.set(null);

    this.catalog.categoryBySlug(slug).subscribe({
      next: (res) => {
        const category = res.data;
        this.loading.set(false);
        if (!category) {
          this.notFound.set(true);
          return;
        }
        this.category.set(category);
        this.loadTrail(category);

        if (category.leaf) {
          this.fetchProducts(category, 0);
        } else {
          this.loadChildren(category);
        }
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 404) {
          this.notFound.set(true);
        } else {
          this.failed.set(true);
        }
      },
    });
  }

  goToPage(page: number): void {
    const category = this.category();
    if (!category || page < 0 || (this.totalPages() > 0 && page >= this.totalPages())) {
      return;
    }
    this.fetchProducts(category, page);
  }

  fromPrice(product: Product): number | null {
    return cheapestVariant(product)?.sellingPrice ?? null;
  }

  stockFor(product: Product): Availability | undefined {
    const variant = cheapestVariant(product);
    return variant ? this.stock().get(variant.sku) : undefined;
  }

  stockLabel(product: Product): string | null {
    const entry = this.stockFor(product);
    if (!entry) {
      return null;
    }
    // Only the low band discloses a figure; see AvailabilityBand.
    if (entry.band === 'OUT_OF_STOCK') return 'Out of stock';
    if (entry.band === 'LOW') return entry.quantity === null ? 'Only a few left' : `Only ${entry.quantity} left`;
    return null;
  }

  private loadTrail(category: Category): void {
    this.catalog.breadcrumb(category.publicId).subscribe({
      next: (res) => this.trail.set(res.data ?? []),
      // The heading still names where you are; only the trail above it is missing.
      error: () => this.trail.set([]),
    });
  }

  private loadChildren(category: Category): void {
    this.catalog.children(category.publicId).subscribe({
      next: (res) => this.children.set(res.data ?? []),
      error: () => this.children.set([]),
    });
  }

  private fetchProducts(category: Category, page: number): void {
    this.loadingProducts.set(true);
    this.catalog
      .searchProducts({ categoryPublicId: category.publicId, page, size: 12 })
      .subscribe({
        next: (res) => {
          this.productPage.set(res.data);
          this.loadingProducts.set(false);
          this.loadAvailability();
        },
        error: () => {
          this.loadingProducts.set(false);
          this.failed.set(true);
        },
      });
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
      next: (map) => this.stock.set(map),
      error: () => this.stock.set(new Map()),
    });
  }
}

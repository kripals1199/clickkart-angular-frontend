import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CatalogService } from '@core/services/catalog.service';
import { Category, Product, ProductSearchParams } from '@core/models/catalog.model';
import { PageResponse } from '@core/models/api-response';
import { cheapestVariant } from '@shared/pricing';

/**
 * The listing page: search, filters and paging over the public catalog.
 *
 * <p>The query lives in the URL rather than in component state alone, so a filtered listing can be
 * linked, bookmarked and reloaded - and so the browser's back button steps through searches the way
 * a visitor expects. Every fetch is driven off the URL for that reason; the form writes to the URL
 * and the URL writes to the results, never the other way round.
 */
@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './product-list.html',
  styleUrl: './product-list.scss',
})
export class ProductList {
  private readonly catalog = inject(CatalogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly page = signal<PageResponse<Product> | null>(null);
  readonly categories = signal<Category[]>([]);

  readonly products = computed(() => this.page()?.content ?? []);
  readonly total = computed(() => this.page()?.totalElements ?? 0);
  readonly pageIndex = computed(() => this.page()?.page ?? 0);
  readonly totalPages = computed(() => this.page()?.totalPages ?? 0);
  readonly isLast = computed(() => this.page()?.last ?? true);

  readonly filters = this.fb.nonNullable.group({
    query: [''],
    categoryPublicId: [''],
    brand: [''],
    minPrice: [''],
    maxPrice: [''],
  });

  constructor() {
    this.catalog.rootCategories().subscribe({
      next: (res) => this.categories.set(res.data ?? []),
      // A filter dropdown that cannot load is a missing convenience, not a broken page - the
      // listing itself still works, so this failure stays quiet.
      error: () => this.categories.set([]),
    });

    this.route.queryParamMap.subscribe((params) => {
      this.filters.patchValue(
        {
          query: params.get('query') ?? '',
          categoryPublicId: params.get('categoryPublicId') ?? '',
          brand: params.get('brand') ?? '',
          minPrice: params.get('minPrice') ?? '',
          maxPrice: params.get('maxPrice') ?? '',
        },
        { emitEvent: false },
      );
      this.fetch(Number(params.get('page') ?? 0));
    });
  }

  /** Writes the form to the URL. The subscription above is what actually refetches. */
  applyFilters(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...this.cleaned(), page: 0 },
    });
  }

  clearFilters(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  goToPage(page: number): void {
    if (page < 0 || (this.totalPages() > 0 && page >= this.totalPages())) {
      return;
    }
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...this.cleaned(), page },
    });
  }

  /** The price a listing card shows is the cheapest variant's - see the shared helper. */
  displayVariant(product: Product) {
    return cheapestVariant(product);
  }

  private fetch(page: number): void {
    this.loading.set(true);
    this.failed.set(false);

    const params: ProductSearchParams = { ...this.cleaned(), page, size: 12 };

    this.catalog.searchProducts(params).subscribe({
      next: (res) => {
        this.page.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  /**
   * Drops blank fields rather than sending them as empty strings. An empty `brand=` is a filter on
   * the empty brand as far as the server is concerned, which would return nothing.
   */
  private cleaned(): Record<string, string> {
    const raw = this.filters.getRawValue();
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      const trimmed = String(value ?? '').trim();
      if (trimmed !== '') {
        out[key] = trimmed;
      }
    }
    return out;
  }
}

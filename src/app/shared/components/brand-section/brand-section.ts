import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CatalogService } from '@core/services/catalog.service';

/**
 * The brand strip, derived from the catalog.
 *
 * <p>There is no brands endpoint on this platform - brand is a free-text field on each product, not
 * an entity - so there is nothing authoritative to list. This samples a page of the catalog and
 * shows the distinct brands found in it, which makes the strip real, clickable navigation instead
 * of the eight hardcoded names it used to be, none of which matched anything in the catalog.
 *
 * <p>What it is not is exhaustive: a brand with no product in the sample will not appear. That is
 * acceptable for a discovery strip on the front page, and the full set is reachable by searching.
 */
@Component({
  selector: 'app-brand-section',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './brand-section.html',
  styleUrl: './brand-section.scss',
})
export class BrandSection {
  private readonly catalog = inject(CatalogService);

  readonly brands = signal<string[]>([]);

  constructor() {
    // A wider page than the home grid shows, because this is reading one field off each row and a
    // handful of products would make for a thin and arbitrary strip.
    this.catalog.searchProducts({ page: 0, size: 60 }).subscribe({
      next: (res) => {
        const distinct = new Set(
          (res.data?.content ?? [])
            .map((product) => (product.brand ?? '').trim())
            .filter((brand) => brand.length > 0),
        );
        this.brands.set([...distinct].sort((a, b) => a.localeCompare(b)).slice(0, 12));
      },
      // Quietly empty: the strip collapses rather than putting an error above the fold.
      error: () => this.brands.set([]),
    });
  }
}

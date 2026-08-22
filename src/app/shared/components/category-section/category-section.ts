import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CatalogService } from '@core/services/catalog.service';
import { Category } from '@core/models/catalog.model';

/**
 * The category strip along the top of the home page, driven by the real taxonomy.
 *
 * <p>It was a hardcoded list of eight names that matched nothing in the catalog and led nowhere.
 * Now each tile is a real root category and links into the listing filtered by its public id, so
 * the strip is navigation rather than decoration.
 *
 * <p>Roots only, and only active ones - the public endpoint already excludes inactive branches, so
 * a category hidden by an operator disappears from here without this component knowing why.
 */
@Component({
  selector: 'app-category-section',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './category-section.html',
  styleUrl: './category-section.scss',
})
export class CategorySection {
  private readonly catalog = inject(CatalogService);

  readonly categories = signal<Category[]>([]);
  readonly loading = signal(true);

  constructor() {
    this.catalog.rootCategories().subscribe({
      next: (res) => {
        this.categories.set(res.data ?? []);
        this.loading.set(false);
      },
      // A strip that cannot load is a missing convenience, not a broken page. It collapses to
      // nothing rather than showing an error band above the fold on the storefront's front door.
      error: () => {
        this.categories.set([]);
        this.loading.set(false);
      },
    });
  }

  /** First letter, as a stand-in for the image Category Service may not have. */
  initial(category: Category): string {
    return category.name.charAt(0).toUpperCase();
  }
}

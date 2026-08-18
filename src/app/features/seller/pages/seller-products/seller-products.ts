import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SellerService } from '@core/services/seller.service';
import { Product, ProductStatus } from '@core/models/catalog.model';
import { PageResponse } from '@core/models/api-response';
import { describeProductStatus, isArchivable, isSubmittable } from '@shared/seller-rules';

/**
 * A seller's own listings, in every state - not just the ones on sale.
 *
 * <p>The status filter matters more here than on the customer listing: a draft that was never
 * submitted and a listing rejected in review both look like "missing from the catalog" from the
 * outside, and this is the only place the difference is visible.
 */
@Component({
  selector: 'app-seller-products',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './seller-products.html',
  styleUrl: './seller-products.scss',
})
export class SellerProducts {
  private readonly seller = inject(SellerService);

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly page = signal<PageResponse<Product> | null>(null);
  readonly filter = signal<ProductStatus | null>(null);
  readonly busyId = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly products = computed(() => this.page()?.content ?? []);
  readonly pageIndex = computed(() => this.page()?.page ?? 0);
  readonly totalPages = computed(() => this.page()?.totalPages ?? 0);
  readonly isLast = computed(() => this.page()?.last ?? true);

  readonly filters: { value: ProductStatus | null; label: string }[] = [
    { value: null, label: 'All' },
    { value: 'DRAFT', label: 'Drafts' },
    { value: 'PENDING_REVIEW', label: 'In review' },
    { value: 'ACTIVE', label: 'On sale' },
    { value: 'ARCHIVED', label: 'Archived' },
  ];

  constructor() {
    this.fetch(0);
  }

  setFilter(status: ProductStatus | null): void {
    this.filter.set(status);
    this.fetch(0);
  }

  fetch(page: number): void {
    if (page < 0) {
      return;
    }
    this.loading.set(true);
    this.failed.set(false);

    this.seller.listProducts(this.filter(), page).subscribe({
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

  describe(product: Product) {
    return describeProductStatus(product.status);
  }

  canSubmit(product: Product): boolean {
    return isSubmittable(product.status);
  }

  canArchive(product: Product): boolean {
    return isArchivable(product.status);
  }

  /** The price shown is the cheapest variant's, matching what the storefront tile quotes. */
  fromPrice(product: Product): number | null {
    const active = (product.variants ?? []).filter((variant) => variant.active);
    if (active.length === 0) {
      return null;
    }
    return Math.min(...active.map((variant) => variant.sellingPrice));
  }

  submit(product: Product): void {
    this.act(product.publicId, this.seller.submitForReview(product.publicId));
  }

  archive(product: Product): void {
    this.act(product.publicId, this.seller.archive(product.publicId));
  }

  private act(publicId: string, call: ReturnType<SellerService['archive']>): void {
    this.busyId.set(publicId);
    this.errorMessage.set(null);

    call.subscribe({
      next: () => {
        this.busyId.set(null);
        // Refetch rather than patch: the current filter may no longer include this row, and a
        // listing that just changed state should leave the "Drafts" tab it is no longer in.
        this.fetch(this.pageIndex());
      },
      error: (err) => {
        this.busyId.set(null);
        this.errorMessage.set(this.describeError(err?.error?.error?.code));
      },
    });
  }

  private describeError(code: string | undefined): string {
    switch (code) {
      case 'INVALID_PRODUCT_STATE':
        return 'That listing has moved on since this page loaded. Refresh and try again.';
      case 'PRODUCT_INCOMPLETE':
        return 'That listing needs at least one variant before it can go for review.';
      default:
        return 'That action could not be completed. Please try again.';
    }
  }
}

import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { SellerService } from '@core/services/seller.service';
import { AdjustmentReason, Stock } from '@core/models/seller.model';
import { PageResponse } from '@core/models/api-response';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatPaginatorModule } from '@angular/material/paginator';

/**
 * Per-SKU stock, and the two ways of changing it.
 *
 * <p>Adjusting is offered first and set-level second, deliberately. An adjustment records *why* the
 * number moved, and an unexplained correction is indistinguishable from theft or a miscount - which
 * need very different responses. Setting the figure outright is the blunter tool, kept for the case
 * where the true count is known and the history is not.
 *
 * <p>Available and reserved are shown separately because they answer different questions: what can
 * still be sold, versus what is already promised to unpaid orders.
 */
@Component({
  selector: 'app-seller-stock',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatCardModule,
    MatTabsModule,
    RouterLinkActive,
    MatPaginatorModule,
  ],
  templateUrl: './seller-stock.html',
  styleUrl: './seller-stock.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SellerStock {
  private readonly seller = inject(SellerService);

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly page = signal<PageResponse<Stock> | null>(null);
  readonly lowOnly = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly savedMessage = signal<string | null>(null);

  /** SKU whose adjustment panel is open. Only one at a time - two open forms invite mis-clicks. */
  readonly openSku = signal<string | null>(null);
  readonly busySku = signal<string | null>(null);

  readonly delta = signal(0);
  readonly reason = signal<AdjustmentReason>('RESTOCK');
  readonly note = signal('');

  readonly items = computed(() => this.page()?.content ?? []);
  readonly pageIndex = computed(() => this.page()?.page ?? 0);
  /** Total rows and server page size, read off the page envelope for mat-paginator. */
  readonly totalElements = computed(() => this.page()?.totalElements ?? 0);
  readonly pageSize = computed(() => this.page()?.size ?? 20);
  readonly totalPages = computed(() => this.page()?.totalPages ?? 0);
  readonly isLast = computed(() => this.page()?.last ?? true);

  readonly reasons: { value: AdjustmentReason; label: string }[] = [
    { value: 'RESTOCK', label: 'Restock — new units arrived' },
    { value: 'STOCK_TAKE', label: 'Stock take — recount disagreed' },
    { value: 'DAMAGED', label: 'Damaged — unsellable' },
    { value: 'CUSTOMER_RETURN', label: 'Customer return — back on the shelf' },
    { value: 'CORRECTION', label: 'Correction — fixing a system error' },
  ];

  constructor() {
    this.fetch(0);
  }

  toggleLowOnly(): void {
    this.lowOnly.update((value) => !value);
    this.fetch(0);
  }

  fetch(page: number): void {
    if (page < 0) {
      return;
    }
    this.loading.set(true);
    this.failed.set(false);

    const call = this.lowOnly() ? this.seller.lowStock(page) : this.seller.listStock(page);
    call.subscribe({
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

  openAdjustment(sku: string): void {
    this.openSku.set(sku);
    this.delta.set(0);
    this.reason.set('RESTOCK');
    this.note.set('');
    this.errorMessage.set(null);
    this.savedMessage.set(null);
  }

  close(): void {
    this.openSku.set(null);
  }

  adjust(item: Stock): void {
    const delta = Number(this.delta());
    if (!delta) {
      // A zero adjustment records a reason for a change that did not happen. Refuse it here rather
      // than write a meaningless row into the stock history.
      this.errorMessage.set('Enter how many units to add or remove.');
      return;
    }

    this.busySku.set(item.sku);
    this.errorMessage.set(null);

    this.seller
      .adjustStock(item.sku, { delta, reason: this.reason(), note: this.note().trim() })
      .subscribe({
        next: () => {
          this.busySku.set(null);
          this.openSku.set(null);
          this.savedMessage.set(`${item.sku} updated.`);
          this.fetch(this.pageIndex());
        },
        error: (err) => {
          this.busySku.set(null);
          this.errorMessage.set(this.describeError(err?.error?.error?.code));
        },
      });
  }

  toggleTracking(item: Stock): void {
    this.busySku.set(item.sku);
    this.errorMessage.set(null);

    this.seller
      .setStockLevel(item.sku, {
        availableQuantity: item.availableQuantity,
        reorderLevel: item.reorderLevel,
        stockTrackingEnabled: !item.stockTrackingEnabled,
      })
      .subscribe({
        next: () => {
          this.busySku.set(null);
          this.fetch(this.pageIndex());
        },
        error: (err) => {
          this.busySku.set(null);
          this.errorMessage.set(this.describeError(err?.error?.error?.code));
        },
      });
  }

  private describeError(code: string | undefined): string {
    switch (code) {
      case 'INSUFFICIENT_STOCK':
        return 'That would take available stock below zero. Units already reserved cannot be removed.';
      case 'SKU_NOT_FOUND':
        return 'That SKU is not in your inventory.';
      case 'VALIDATION_FAILED':
        return 'Check the amount and reason.';
      default:
        return 'The stock change could not be saved. Please try again.';
    }
  }
}

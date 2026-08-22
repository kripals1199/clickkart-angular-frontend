import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { SellerService } from '@core/services/seller.service';
import { SellerOrder } from '@core/models/seller.model';
import { FulfilmentStatus, OrderItem } from '@core/models/order.model';
import { PageResponse } from '@core/models/api-response';
import { describeFulfilment } from '@shared/order-status';
import { nextFulfilmentOptions } from '@shared/seller-rules';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatPaginatorModule } from '@angular/material/paginator';

/**
 * Orders containing this seller's items, and the place they get marked packed, shipped and
 * delivered.
 *
 * <p>Fulfilment advances one item at a time, not one order at a time. An order can hold several
 * sellers' goods, and each seller ships their own - so there is no "mark this order shipped" here,
 * because no single seller is in a position to say that.
 *
 * <p>The status dropdown offers only the transitions the server would accept: forward, and never
 * out of delivered or cancelled. Listing the rest would be offering choices that reliably 409.
 */
@Component({
  selector: 'app-seller-orders',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
    MatTabsModule,
    RouterLinkActive,
    MatPaginatorModule,
  ],
  templateUrl: './seller-orders.html',
  styleUrl: './seller-orders.scss',
})
export class SellerOrders {
  private readonly seller = inject(SellerService);

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly page = signal<PageResponse<SellerOrder> | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly savedMessage = signal<string | null>(null);

  /** "orderReference|sku" of the row being advanced, so only that row shows a busy state. */
  readonly busyKey = signal<string | null>(null);
  readonly openKey = signal<string | null>(null);
  readonly targetStatus = signal<FulfilmentStatus>('PACKED');
  readonly tracking = signal('');

  readonly orders = computed(() => this.page()?.content ?? []);
  readonly pageIndex = computed(() => this.page()?.page ?? 0);
  /** Total rows and server page size, read off the page envelope for mat-paginator. */
  readonly totalElements = computed(() => this.page()?.totalElements ?? 0);
  readonly pageSize = computed(() => this.page()?.size ?? 20);
  readonly totalPages = computed(() => this.page()?.totalPages ?? 0);
  readonly isLast = computed(() => this.page()?.last ?? true);

  constructor() {
    this.fetch(0);
  }

  fetch(page: number): void {
    if (page < 0) {
      return;
    }
    this.loading.set(true);
    this.failed.set(false);

    this.seller.listOrders(page).subscribe({
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

  key(order: SellerOrder, item: OrderItem): string {
    return `${order.orderReference}|${item.sku}`;
  }

  fulfilment(item: OrderItem): string {
    return describeFulfilment(item.fulfilmentStatus);
  }

  options(item: OrderItem): FulfilmentStatus[] {
    return nextFulfilmentOptions(item.fulfilmentStatus);
  }

  open(order: SellerOrder, item: OrderItem): void {
    const options = this.options(item);
    if (options.length === 0) {
      return;
    }
    this.openKey.set(this.key(order, item));
    this.targetStatus.set(options[0]);
    this.tracking.set(item.trackingReference ?? '');
    this.errorMessage.set(null);
    this.savedMessage.set(null);
  }

  close(): void {
    this.openKey.set(null);
  }

  advance(order: SellerOrder, item: OrderItem): void {
    const key = this.key(order, item);
    this.busyKey.set(key);
    this.errorMessage.set(null);

    this.seller
      .advanceFulfilment(order.orderReference, item.sku, this.targetStatus(), this.tracking().trim())
      .subscribe({
        next: () => {
          this.busyKey.set(null);
          this.openKey.set(null);
          this.savedMessage.set(`${item.sku} marked ${describeFulfilment(this.targetStatus()).toLowerCase()}.`);
          this.fetch(this.pageIndex());
        },
        error: (err) => {
          this.busyKey.set(null);
          this.errorMessage.set(this.describeError(err?.error?.error?.code));
          this.fetch(this.pageIndex());
        },
      });
  }

  label(status: FulfilmentStatus): string {
    return describeFulfilment(status);
  }

  private describeError(code: string | undefined): string {
    switch (code) {
      case 'INVALID_FULFILMENT_TRANSITION':
        return 'That item has already moved on. The list has been refreshed.';
      case 'ORDER_NOT_FULFILLABLE':
        return 'This order is not in a state where items can be dispatched.';
      default:
        return 'That update could not be saved. Please try again.';
    }
  }
}

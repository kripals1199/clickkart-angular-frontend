import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { OrderService } from '@core/services/order.service';
import { OrderSummary } from '@core/models/order.model';
import { PageResponse } from '@core/models/api-response';
import { describeOrderStatus } from '@shared/order-status';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

/**
 * Order history, newest first.
 *
 * <p>The list shows status prominently because the most common reason to open this page is to find
 * out what happened to something - and because an order sitting in PENDING_PAYMENT is one the
 * customer still has to act on before its hold lapses.
 */
@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [RouterLink, DatePipe,
    MatButtonModule,
    MatCardModule,
  ],
  templateUrl: './order-list.html',
  styleUrl: './order-list.scss',
})
export class OrderList {
  private readonly orders = inject(OrderService);

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly page = signal<PageResponse<OrderSummary> | null>(null);

  readonly orderList = computed(() => this.page()?.content ?? []);
  readonly pageIndex = computed(() => this.page()?.page ?? 0);
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

    this.orders.listMine(page).subscribe({
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

  describe(order: OrderSummary) {
    return describeOrderStatus(order.status);
  }
}

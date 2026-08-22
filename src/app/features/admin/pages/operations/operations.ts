import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AdminService } from '@core/services/admin.service';
import { OrderStatus, OrderSummary } from '@core/models/order.model';
import { Payment, PaymentStatus } from '@core/models/payment.model';
import { PageResponse } from '@core/models/api-response';
import { describeOrderStatus } from '@shared/order-status';

type View = 'orders' | 'refunds' | 'payments' | 'unreported';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';

/**
 * Day-to-day operations: finding orders and payments, and the two queues that mean something is
 * owed or unresolved.
 *
 * <p>The two queues are the point of this page. `refunds-required` is money owed back that has not
 * been sent; `unreported` is payments whose outcome never reached Order Service, which is the
 * dangerous one - money may have moved while the order still believes it is unpaid. Both are
 * surfaced as their own views rather than as a filter someone has to know to apply.
 */
@Component({
  selector: 'app-operations',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatCardModule,
  ],
  templateUrl: './operations.html',
  styleUrl: './operations.scss',
})
export class Operations {
  private readonly admin = inject(AdminService);
  private readonly route = inject(ActivatedRoute);

  readonly view = signal<View>('orders');
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly savedMessage = signal<string | null>(null);

  readonly orderPage = signal<PageResponse<OrderSummary> | null>(null);
  readonly paymentPage = signal<PageResponse<Payment> | null>(null);
  readonly orderStatus = signal<OrderStatus | null>(null);
  readonly paymentStatus = signal<PaymentStatus | null>(null);

  readonly busyId = signal<string | null>(null);
  readonly openId = signal<string | null>(null);
  readonly reason = signal('');
  readonly amount = signal<number | null>(null);

  readonly orders = computed(() => this.orderPage()?.content ?? []);
  readonly payments = computed(() => this.paymentPage()?.content ?? []);
  readonly showingOrders = computed(() => this.view() === 'orders' || this.view() === 'refunds');

  readonly views: { value: View; label: string }[] = [
    { value: 'orders', label: 'Orders' },
    { value: 'refunds', label: 'Refunds required' },
    { value: 'payments', label: 'Payments' },
    { value: 'unreported', label: 'Unreported' },
  ];

  readonly orderStatuses: OrderStatus[] = [
    'PENDING_PAYMENT',
    'CONFIRMED',
    'COMPLETED',
    'CANCELLED',
    'PAYMENT_FAILED',
    'STOCK_UNAVAILABLE',
    'EXPIRED',
  ];

  readonly paymentStatuses: PaymentStatus[] = ['INITIATED', 'CAPTURED', 'FAILED', 'ABANDONED'];

  constructor() {
    // The dashboard's worklist links straight at a queue, so honour ?view= rather than always
    // opening on Orders - a link that names a queue and then lands somewhere else is worse than
    // no link. Anything unrecognised falls back to the default rather than showing an empty page.
    const requested = this.route.snapshot.queryParamMap.get('view');
    if (requested && this.views.some((option) => option.value === requested)) {
      this.view.set(requested as View);
    }
    this.fetch();
  }

  setView(view: View): void {
    this.view.set(view);
    this.openId.set(null);
    this.savedMessage.set(null);
    this.errorMessage.set(null);
    this.fetch();
  }

  setOrderStatus(status: OrderStatus | null): void {
    this.orderStatus.set(status);
    this.fetch();
  }

  setPaymentStatus(status: PaymentStatus | null): void {
    this.paymentStatus.set(status);
    this.fetch();
  }

  fetch(): void {
    this.loading.set(true);
    this.failed.set(false);

    const handler = {
      next: (res: { data: unknown }) => {
        if (this.showingOrders()) {
          this.orderPage.set(res.data as PageResponse<OrderSummary>);
        } else {
          this.paymentPage.set(res.data as PageResponse<Payment>);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    };

    switch (this.view()) {
      case 'orders':
        this.admin.searchOrders(this.orderStatus()).subscribe(handler);
        break;
      case 'refunds':
        this.admin.refundsRequired().subscribe(handler);
        break;
      case 'payments':
        this.admin.searchPayments(this.paymentStatus()).subscribe(handler);
        break;
      case 'unreported':
        this.admin.unreported().subscribe(handler);
        break;
    }
  }

  describe(status: OrderStatus) {
    return describeOrderStatus(status);
  }

  /** Only a captured payment can be refunded, and only what has not already gone back. */
  refundable(payment: Payment): boolean {
    return payment.status === 'CAPTURED' && payment.refundState !== 'FULLY_REFUNDED';
  }

  remaining(payment: Payment): number {
    return Math.max(0, payment.amount - (payment.refundedAmount ?? 0));
  }

  openAction(id: string, prefill: number | null = null): void {
    this.openId.set(id);
    this.reason.set('');
    this.amount.set(prefill);
    this.errorMessage.set(null);
  }

  close(): void {
    this.openId.set(null);
  }

  cancelOrder(order: OrderSummary): void {
    const reason = this.reason().trim();
    if (!reason) {
      this.errorMessage.set('Give a reason — an operator cancellation without one is not auditable.');
      return;
    }
    this.busyId.set(order.orderReference);
    this.errorMessage.set(null);

    this.admin.cancelOrder(order.orderReference, reason).subscribe({
      next: () => this.done('Order cancelled.'),
      error: (err) => this.fail(err?.error?.error?.code),
    });
  }

  refund(payment: Payment): void {
    const reason = this.reason().trim();
    const amount = Number(this.amount());

    if (!reason) {
      this.errorMessage.set('Give a reason — a refund with no stated cause is not auditable.');
      return;
    }
    if (!amount || amount <= 0) {
      this.errorMessage.set('Enter the amount to refund.');
      return;
    }
    if (amount > this.remaining(payment)) {
      // The server enforces this too; catching it here saves a round trip and states the ceiling.
      this.errorMessage.set(`At most ₹${this.remaining(payment)} is left to refund on this payment.`);
      return;
    }

    this.busyId.set(payment.paymentReference);
    this.errorMessage.set(null);

    this.admin.refund(payment.paymentReference, { amount, reason }).subscribe({
      next: () => this.done('Refund recorded.'),
      error: (err) => this.fail(err?.error?.error?.code),
    });
  }

  private done(message: string): void {
    this.busyId.set(null);
    this.openId.set(null);
    this.savedMessage.set(message);
    this.fetch();
  }

  private fail(code: string | undefined): void {
    this.busyId.set(null);
    this.errorMessage.set(this.describeError(code));
  }

  private describeError(code: string | undefined): string {
    switch (code) {
      case 'ORDER_NOT_CANCELLABLE':
        return 'That order can no longer be cancelled.';
      case 'REFUND_EXCEEDS_CAPTURED':
        return 'That is more than remains unrefunded on this payment.';
      case 'PAYMENT_NOT_REFUNDABLE':
        return 'Only a captured payment can be refunded.';
      case 'ACCESS_DENIED':
        return 'This account is not allowed to do that.';
      default:
        return 'That action could not be completed. Please try again.';
    }
  }
}

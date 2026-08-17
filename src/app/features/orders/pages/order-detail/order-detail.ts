import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { OrderService } from '@core/services/order.service';
import { PaymentService } from '@core/services/payment.service';
import { CartService } from '@core/services/cart.service';
import { Order, OrderItem } from '@core/models/order.model';
import { Payment, PaymentMethod } from '@core/models/payment.model';
import { describeFulfilment, describeOrderStatus, isCancellable, isPayable } from '@shared/order-status';

/**
 * One order, and the only place a customer pays for one.
 *
 * <p>Payment lives here rather than at the end of checkout so that closing the tab mid-flow is
 * survivable: the order exists, it holds stock until its deadline, and this page is where it can be
 * picked back up. That also means the pay action has to be driven by the order's current status
 * rather than by "did we just arrive from checkout".
 *
 * <p>After a capture the order is re-read instead of being patched from the payment response.
 * Payment Service tells Order Service the outcome over an internal call, and it is Order Service
 * that decides whether the order is CONFIRMED - a captured payment is evidence of that, not proof.
 */
@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule],
  templateUrl: './order-detail.html',
  styleUrl: './order-detail.scss',
})
export class OrderDetail {
  private readonly orders = inject(OrderService);
  private readonly payments = inject(PaymentService);
  private readonly cart = inject(CartService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly order = signal<Order | null>(null);
  /** Set when arriving straight from checkout, so the confirmation only shows the once. */
  readonly justPlaced = signal(false);

  readonly paying = signal(false);
  readonly cancelling = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly payment = signal<Payment | null>(null);

  readonly method = signal<PaymentMethod>('UPI');
  readonly cancelReason = signal('');
  readonly cancelOpen = signal(false);

  readonly methods: { value: PaymentMethod; label: string }[] = [
    { value: 'UPI', label: 'UPI' },
    { value: 'CARD', label: 'Card' },
    { value: 'NET_BANKING', label: 'Net banking' },
    { value: 'WALLET', label: 'Wallet' },
    { value: 'CASH_ON_DELIVERY', label: 'Cash on delivery' },
  ];

  readonly status = computed(() => {
    const order = this.order();
    return order ? describeOrderStatus(order.status) : null;
  });

  readonly canPay = computed(() => {
    const order = this.order();
    return !!order && isPayable(order.status) && !this.paying();
  });

  readonly canCancel = computed(() => {
    const order = this.order();
    return !!order && isCancellable(order.status) && !this.cancelling();
  });

  constructor() {
    this.justPlaced.set(this.route.snapshot.queryParamMap.get('placed') === '1');
    this.route.paramMap.subscribe((params) => {
      const reference = params.get('reference');
      if (reference) {
        this.fetch(reference);
      }
    });
  }

  fulfilment(item: OrderItem): string {
    return describeFulfilment(item.fulfilmentStatus);
  }

  pay(): void {
    const order = this.order();
    if (!order || !this.canPay()) {
      return;
    }

    this.paying.set(true);
    this.errorMessage.set(null);

    this.payments.pay(order.orderReference, this.method()).subscribe({
      next: (res) => {
        this.payment.set(res.data);
        // Re-read the order: Order Service, not this response, decides whether it is confirmed.
        this.fetch(order.orderReference, false);
        this.paying.set(false);

        if (res.data?.status === 'FAILED') {
          this.errorMessage.set(
            res.data.failureReason || 'The payment was declined. Try a different method.',
          );
        }
      },
      error: (err) => {
        this.paying.set(false);
        this.errorMessage.set(this.describePayment(err?.error?.error?.code));
        this.fetch(order.orderReference, false);
      },
    });
  }

  cancel(): void {
    const order = this.order();
    if (!order || !this.canCancel()) {
      return;
    }

    this.cancelling.set(true);
    this.errorMessage.set(null);

    this.orders.cancel(order.orderReference, this.cancelReason().trim() || 'Changed my mind').subscribe({
      next: (res) => {
        this.cancelling.set(false);
        this.cancelOpen.set(false);
        if (res.data) {
          this.order.set(res.data);
        }
        // Cancelling releases the stock hold, which can make a basket buyable again.
        this.cart.load().subscribe({ error: () => undefined });
      },
      error: (err) => {
        this.cancelling.set(false);
        this.errorMessage.set(this.describeCancel(err?.error?.error?.code));
        this.fetch(order.orderReference, false);
      },
    });
  }

  private fetch(reference: string, showSpinner = true): void {
    if (showSpinner) {
      this.loading.set(true);
    }
    this.notFound.set(false);

    this.orders.getMine(reference).subscribe({
      next: (res) => {
        this.order.set(res.data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notFound.set(err?.status === 404);
      },
    });
  }

  private describePayment(code: string | undefined): string {
    switch (code) {
      case 'ORDER_NOT_PAYABLE':
        return 'This order can no longer be paid for — its status has changed.';
      case 'PAYMENT_ALREADY_CAPTURED':
        return 'This order has already been paid for.';
      case 'ORDER_EXPIRED':
        return 'The payment window for this order has closed.';
      case 'RATE_LIMIT_EXCEEDED':
        return 'Too many attempts. Please wait a little and try again.';
      default:
        return 'The payment could not be completed. Nothing was charged — please try again.';
    }
  }

  private describeCancel(code: string | undefined): string {
    switch (code) {
      case 'ORDER_NOT_CANCELLABLE':
        return 'This order can no longer be cancelled — it has moved past payment.';
      default:
        return 'The order could not be cancelled. Please try again.';
    }
  }
}

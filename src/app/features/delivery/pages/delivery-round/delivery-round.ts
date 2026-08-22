import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule } from '@angular/material/paginator';

import { DeliveryService } from '@core/services/delivery.service';
import { DeliveryLine, formatAddress, mapsUrlFor } from '@core/models/delivery.model';
import { PageResponse } from '@core/models/api-response';

/**
 * The delivery agent's round: parcels assigned to them, and the one action they can take.
 *
 * <p>Built for a phone held in one hand at somebody's door, which drives most of the decisions here.
 * The address is the largest thing on each card because it is what the agent is reading; the
 * recipient's phone number is a tel: link rather than text to copy; and "Delivered" asks for
 * confirmation, because it is irreversible - the backend refuses to move a line out of DELIVERED,
 * so a mis-tap cannot be undone from this screen or any other.
 *
 * <p>No money appears anywhere, and that is the server's decision as much as this one: the response
 * carries no price to render. See DeliveryLineResponse.
 */
@Component({
  selector: 'app-delivery-round',
  standalone: true,
  imports: [
    DatePipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatIconModule,
    MatPaginatorModule,
  ],
  templateUrl: './delivery-round.html',
  styleUrl: './delivery-round.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeliveryRound {
  private readonly deliveries = inject(DeliveryService);

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly page = signal<PageResponse<DeliveryLine> | null>(null);

  /** Which parcel is mid-confirmation, keyed the way the server identifies one. */
  readonly confirming = signal<string | null>(null);
  readonly busyKey = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly savedMessage = signal<string | null>(null);

  readonly showDelivered = signal(false);

  readonly lines = computed(() => this.page()?.content ?? []);
  readonly totalElements = computed(() => this.page()?.totalElements ?? 0);
  readonly pageSize = computed(() => this.page()?.size ?? 20);
  readonly pageIndex = computed(() => this.page()?.page ?? 0);
  readonly totalPages = computed(() => this.page()?.totalPages ?? 0);

  /** Outstanding work, which is the number an agent actually wants to see. */
  readonly outstanding = computed(
    () => this.lines().filter((line) => line.fulfilmentStatus !== 'DELIVERED').length,
  );

  readonly formatAddress = formatAddress;
  readonly mapsUrlFor = mapsUrlFor;

  constructor() {
    this.fetch(0);
  }

  /** A line is identified by order plus SKU, matching the server's own path. */
  key(line: DeliveryLine): string {
    return `${line.orderReference}::${line.sku}`;
  }

  fetch(page: number): void {
    if (page < 0) {
      return;
    }
    this.loading.set(true);
    this.failed.set(false);

    this.deliveries.round(page, this.showDelivered()).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.data) {
          this.page.set(res.data);
        }
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  toggleDelivered(include: boolean): void {
    this.showDelivered.set(include);
    // Back to the first page: page 4 of the outstanding queue is not page 4 of the fuller list, and
    // landing on an unrelated slice of it reads as data loss.
    this.fetch(0);
  }

  confirm(line: DeliveryLine): void {
    this.confirming.set(this.key(line));
    this.errorMessage.set(null);
  }

  cancel(): void {
    this.confirming.set(null);
  }

  markDelivered(line: DeliveryLine): void {
    const key = this.key(line);
    if (this.busyKey() === key) {
      return;
    }
    this.busyKey.set(key);
    this.errorMessage.set(null);
    this.savedMessage.set(null);

    this.deliveries.markDelivered(line.orderReference, line.sku).subscribe({
      next: () => {
        this.busyKey.set(null);
        this.confirming.set(null);
        this.savedMessage.set(`${line.productName} marked delivered.`);
        // Refetch rather than patch in place: marking the last line of an order completes it
        // server-side, and the list should show what the server now believes rather than what this
        // screen guessed.
        this.fetch(this.pageIndex());
      },
      error: (err) => {
        this.busyKey.set(null);
        this.errorMessage.set(this.describe(err?.error?.error?.code));
      },
    });
  }

  private describe(code: string | undefined): string {
    switch (code) {
      case 'INVALID_FULFILMENT_TRANSITION':
        // Almost always a stale screen: somebody else moved the line while this list sat open.
        return 'This parcel is no longer out for delivery. Refresh to see its current state.';
      case 'ORDER_NOT_FOUND':
        return 'This delivery is no longer assigned to you.';
      default:
        return 'That could not be saved. Please try again.';
    }
  }
}

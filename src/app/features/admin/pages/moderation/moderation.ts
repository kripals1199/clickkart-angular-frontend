import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Observable } from 'rxjs';

import { AdminService } from '@core/services/admin.service';
import { Product } from '@core/models/catalog.model';
import { SellerProfile, SellerVerificationStatus } from '@core/models/admin.model';
import { ApiResponse, PageResponse } from '@core/models/api-response';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';

/**
 * The two things an operator approves: listings waiting to go on sale, and sellers waiting to be
 * allowed to sell at all.
 *
 * <p>A rejection always requires a reason, and the UI enforces that even though the server accepts
 * a blank one. The reason is written back as the seller's `rejectionReason` - it is the only thing
 * that tells them what to fix, and a silent rejection just produces a resubmission of the same
 * listing.
 */
@Component({
  selector: 'app-moderation',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatCardModule,
    MatTabsModule,
    RouterLinkActive,
  ],
  templateUrl: './moderation.html',
  styleUrl: './moderation.scss',
})
export class Moderation {
  private readonly admin = inject(AdminService);

  readonly tab = signal<'listings' | 'sellers'>('listings');

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly savedMessage = signal<string | null>(null);

  readonly listingPage = signal<PageResponse<Product> | null>(null);
  readonly sellerPage = signal<PageResponse<SellerProfile> | null>(null);
  readonly sellerFilter = signal<SellerVerificationStatus | null>('PENDING');

  readonly busyId = signal<string | null>(null);
  readonly openId = signal<string | null>(null);
  readonly reason = signal('');

  readonly listings = computed(() => this.listingPage()?.content ?? []);
  readonly sellers = computed(() => this.sellerPage()?.content ?? []);

  readonly sellerFilters: { value: SellerVerificationStatus | null; label: string }[] = [
    { value: 'PENDING', label: 'Awaiting review' },
    { value: 'VERIFIED', label: 'Verified' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: null, label: 'All' },
  ];

  constructor() {
    this.fetch();
  }

  switchTab(tab: 'listings' | 'sellers'): void {
    this.tab.set(tab);
    this.openId.set(null);
    this.savedMessage.set(null);
    this.errorMessage.set(null);
    this.fetch();
  }

  setSellerFilter(status: SellerVerificationStatus | null): void {
    this.sellerFilter.set(status);
    this.fetch();
  }

  fetch(): void {
    this.loading.set(true);
    this.failed.set(false);

    const call: Observable<ApiResponse<unknown>> =
      this.tab() === 'listings'
        ? this.admin.reviewQueue()
        : this.admin.browseSellers(this.sellerFilter());

    call.subscribe({
      next: (res: ApiResponse<unknown>) => {
        if (this.tab() === 'listings') {
          this.listingPage.set(res.data as PageResponse<Product>);
        } else {
          this.sellerPage.set(res.data as PageResponse<SellerProfile>);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  /** Badge colour for a verification state - the same three tones the order badges use. */
  sellerTone(seller: SellerProfile): string {
    if (seller.verificationStatus === 'VERIFIED') return 'good';
    if (seller.verificationStatus === 'REJECTED') return 'bad';
    return 'pending';
  }
  openRejection(id: string): void {
    this.openId.set(id);
    this.reason.set('');
    this.errorMessage.set(null);
  }

  close(): void {
    this.openId.set(null);
  }

  approveListing(product: Product): void {
    this.act(product.publicId, this.admin.decide(product.publicId, { approved: true, reason: '' }));
  }

  rejectListing(product: Product): void {
    const reason = this.reason().trim();
    if (!reason) {
      // The server would take a blank one. Refusing here is the point: the seller reads this.
      this.errorMessage.set('Say why it was rejected — the seller sees this and nothing else.');
      return;
    }
    this.act(product.publicId, this.admin.decide(product.publicId, { approved: false, reason }));
  }

  verifySeller(seller: SellerProfile): void {
    this.act(
      seller.userPublicId,
      this.admin.decideVerification(seller.userPublicId, { status: 'VERIFIED', note: '' }),
    );
  }

  rejectSeller(seller: SellerProfile): void {
    const note = this.reason().trim();
    if (!note) {
      this.errorMessage.set('Say why verification was refused — the seller sees this note.');
      return;
    }
    this.act(
      seller.userPublicId,
      this.admin.decideVerification(seller.userPublicId, { status: 'REJECTED', note }),
    );
  }

  private act(id: string, call: Observable<ApiResponse<unknown>>): void {
    this.busyId.set(id);
    this.errorMessage.set(null);

    call.subscribe({
      next: () => {
        this.busyId.set(null);
        this.openId.set(null);
        this.savedMessage.set('Decision recorded.');
        // Refetch: a decided item leaves the queue it was in, so patching the row in place would
        // leave it sitting in a list it no longer belongs to.
        this.fetch();
      },
      error: (err: { error?: { error?: { code?: string } } }) => {
        this.busyId.set(null);
        this.errorMessage.set(this.describe(err?.error?.error?.code));
      },
    });
  }

  private describe(code: string | undefined): string {
    switch (code) {
      case 'INVALID_PRODUCT_STATE':
        return 'That listing is no longer awaiting review — the queue has been refreshed.';
      case 'SELLER_PROFILE_NOT_FOUND':
        return 'That seller profile no longer exists.';
      case 'ACCESS_DENIED':
        return 'This account is not allowed to make that decision.';
      default:
        return 'That decision could not be recorded. Please try again.';
    }
  }
}

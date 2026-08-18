import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AdminService } from '@core/services/admin.service';
import { UserProfile } from '@core/models/user.model';
import { PageResponse } from '@core/models/api-response';

/**
 * Operator lookup across customer profiles, and the one write this surface has: erasure.
 *
 * <p>Read-only otherwise, deliberately. An operator may need to look a customer up for a support
 * case, but editing someone else's profile on their behalf is not a flow this platform has - the
 * change would not be attributable to the customer who supposedly made it.
 *
 * <p>Erasure here is a different act from the soft delete on the Accounts page, and the two are
 * easy to confuse because both sound like "remove this person". This wipes their personal data and
 * leaves them able to sign in; that stops them signing in and leaves their data. Neither implies
 * the other, so the page says so rather than letting an operator assume.
 */
@Component({
  selector: 'app-profiles',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule],
  templateUrl: './profiles.html',
  styleUrl: './profiles.scss',
})
export class Profiles {
  private readonly admin = inject(AdminService);

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly page = signal<PageResponse<UserProfile> | null>(null);
  readonly query = signal('');

  readonly busyId = signal<string | null>(null);
  readonly confirmingErase = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly savedMessage = signal<string | null>(null);

  readonly profiles = computed(() => this.page()?.content ?? []);
  readonly pageIndex = computed(() => this.page()?.page ?? 0);
  readonly totalPages = computed(() => this.page()?.totalPages ?? 0);
  readonly isLast = computed(() => this.page()?.last ?? true);
  readonly total = computed(() => this.page()?.totalElements ?? 0);

  constructor() {
    this.fetch(0);
  }

  search(): void {
    this.fetch(0);
  }

  fetch(page: number): void {
    if (page < 0) {
      return;
    }
    this.loading.set(true);
    this.failed.set(false);

    this.admin.browseProfiles(this.query(), page).subscribe({
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

  /**
   * A name to show. An erased profile has none left, which is the point - so it says so rather than
   * rendering a blank row that looks like a rendering bug.
   */
  displayName(profile: UserProfile): string {
    if (profile.erasedAt) {
      return 'Erased profile';
    }
    const full = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
    return profile.displayName || full || 'No name on file';
  }

  confirmErase(userPublicId: string): void {
    this.confirmingErase.set(userPublicId);
    this.errorMessage.set(null);
  }

  cancelErase(): void {
    this.confirmingErase.set(null);
  }

  erase(profile: UserProfile): void {
    this.busyId.set(profile.userPublicId);
    this.errorMessage.set(null);

    this.admin.eraseProfile(profile.userPublicId).subscribe({
      next: () => {
        this.busyId.set(null);
        this.confirmingErase.set(null);
        this.savedMessage.set('Personal data erased. The account can still sign in.');
        this.fetch(this.pageIndex());
      },
      error: (err) => {
        this.busyId.set(null);
        this.errorMessage.set(this.describe(err?.error?.error?.code));
      },
    });
  }

  private describe(code: string | undefined): string {
    switch (code) {
      case 'PROFILE_NOT_FOUND':
      case 'ACCOUNT_NOT_FOUND':
        return 'That profile no longer exists.';
      case 'ACCESS_DENIED':
        return 'This account is not allowed to do that.';
      default:
        return 'That could not be completed. Please try again.';
    }
  }
}

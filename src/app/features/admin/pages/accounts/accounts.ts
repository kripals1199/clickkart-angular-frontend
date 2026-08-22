import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AdminService } from '@core/services/admin.service';
import { AuthService } from '@core/services/auth.service';
import { UserSummary } from '@core/models/auth.model';
import { PageResponse } from '@core/models/api-response';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';

/**
 * Credential-side account administration: who exists, who is locked, and who has been deleted.
 *
 * <p>This is Auth Service's surface, not User Service's - it deals in roles, lockouts and
 * enablement rather than names and addresses, which is why it lives under /auth/accounts.
 *
 * <p>Deletion here is a soft delete. The row survives, because past orders and audit entries refer
 * to the account and would otherwise point at nothing; the confirmation says so rather than
 * implying the data is destroyed.
 */
@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule,
    MatButtonModule,
    MatInputModule,
    MatCardModule,
  ],
  templateUrl: './accounts.html',
  styleUrl: './accounts.scss',
})
export class Accounts {
  private readonly admin = inject(AdminService);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly page = signal<PageResponse<UserSummary> | null>(null);

  readonly roleFilter = signal<string | null>(null);
  readonly lockedFilter = signal<boolean | null>(null);
  readonly emailQuery = signal('');

  readonly busyId = signal<string | null>(null);
  readonly confirmingDelete = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly savedMessage = signal<string | null>(null);

  readonly accounts = computed(() => this.page()?.content ?? []);
  readonly pageIndex = computed(() => this.page()?.page ?? 0);
  readonly totalPages = computed(() => this.page()?.totalPages ?? 0);
  readonly isLast = computed(() => this.page()?.last ?? true);

  readonly roles: { value: string | null; label: string }[] = [
    { value: null, label: 'Any role' },
    { value: 'ROLE_CUSTOMER', label: 'Customers' },
    { value: 'ROLE_SELLER', label: 'Sellers' },
    { value: 'ROLE_ADMIN', label: 'Admins' },
    { value: 'ROLE_DELIVERY_AGENT', label: 'Delivery agents' },
  ];

  /** The signed-in operator's own id, so the UI can refuse to let them lock themselves out. */
  private readonly me = computed(() => this.auth.currentUser()?.userId ?? null);

  isSelf(account: UserSummary): boolean {
    return this.me() !== null && account.publicId === this.me();
  }

  constructor() {
    this.fetch(0);
  }

  setRole(role: string | null): void {
    this.roleFilter.set(role);
    this.fetch(0);
  }

  setLocked(locked: boolean | null): void {
    this.lockedFilter.set(locked);
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

    this.admin
      .browseAccounts(this.roleFilter(), this.lockedFilter(), this.emailQuery(), page)
      .subscribe({
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

  lock(account: UserSummary): void {
    this.act(account.publicId, this.admin.lockAccount(account.publicId), 'Account locked.');
  }

  unlock(account: UserSummary): void {
    this.act(account.publicId, this.admin.unlockAccount(account.publicId), 'Account unlocked.');
  }

  confirmDelete(publicId: string): void {
    this.confirmingDelete.set(publicId);
    this.errorMessage.set(null);
  }

  cancelDelete(): void {
    this.confirmingDelete.set(null);
  }

  remove(account: UserSummary): void {
    this.act(account.publicId, this.admin.deleteAccount(account.publicId), 'Account deleted.');
  }

  private act(
    publicId: string,
    call: ReturnType<AdminService['lockAccount']>,
    message: string,
  ): void {
    this.busyId.set(publicId);
    this.errorMessage.set(null);

    call.subscribe({
      next: () => {
        this.busyId.set(null);
        this.confirmingDelete.set(null);
        this.savedMessage.set(message);
        // Refetch: a locked account may no longer match the current filter.
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
      case 'ACCOUNT_NOT_FOUND':
        return 'That account no longer exists.';
      case 'ACCESS_DENIED':
        return 'This account is not allowed to do that.';
      default:
        return 'That action could not be completed. Please try again.';
    }
  }
}

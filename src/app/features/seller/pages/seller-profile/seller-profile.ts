import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { UserService } from '@core/services/user.service';
import { Address, SellerProfile as SellerProfileModel } from '@core/models/user.model';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';

/**
 * The seller's own business identity: trading name, GSTIN, support contacts, pickup address.
 *
 * <p>Verification status is shown but never editable. A seller cannot verify themselves - only an
 * operator decides that, on the admin moderation queue - so the field is absent from the request
 * body entirely rather than sent and ignored.
 *
 * <p>A 404 here means no profile exists yet rather than an error: the endpoint creates on first
 * write, so the page opens as a blank form instead of a failure.
 */
@Component({
  selector: 'app-seller-profile',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
    MatTabsModule,
    RouterLinkActive,
  ],
  templateUrl: './seller-profile.html',
  styleUrl: './seller-profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SellerProfile {
  private readonly users = inject(UserService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly profile = signal<SellerProfileModel | null>(null);
  readonly addresses = signal<Address[]>([]);

  readonly saving = signal(false);
  readonly savedMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly isNew = computed(() => this.profile() === null);

  readonly status = computed(() => {
    const profile = this.profile();
    if (!profile) {
      return null;
    }
    switch (profile.verificationStatus) {
      case 'VERIFIED':
        return { label: 'Verified', tone: 'good', hint: 'Your listings can go on sale.' };
      case 'REJECTED':
        return {
          label: 'Rejected',
          tone: 'bad',
          hint: 'An operator refused verification. Fix what they flagged and save again to be re-reviewed.',
        };
      default:
        return {
          label: 'Awaiting review',
          tone: 'pending',
          hint: 'An operator still has to check these details.',
        };
    }
  });

  readonly form = this.fb.nonNullable.group({
    businessName: ['', [Validators.required, Validators.maxLength(150)]],
    // The server's shape check, which catches transposition and truncation at the edge. It is not
    // a substitute for an operator checking the registration - that is what verification is for.
    gstin: [
      '',
      [Validators.required, Validators.pattern(/^[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z][Zz][0-9A-Za-z]$/)],
    ],
    supportEmail: ['', [Validators.email, Validators.maxLength(254)]],
    supportPhone: ['', [Validators.pattern(/^$|^[6-9]\d{9}$/)]],
    pickupAddressId: [''],
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.users.sellerProfile().subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.data) {
          this.absorb(res.data);
        }
        this.loadAddresses();
      },
      error: (err) => {
        this.loading.set(false);
        // No profile yet is the ordinary first-visit case, not a failure.
        if (err?.status === 404) {
          this.profile.set(null);
          this.loadAddresses();
        } else {
          this.failed.set(true);
        }
      },
    });
  }

  save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.savedMessage.set(null);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    this.users
      .upsertSellerProfile({
        businessName: raw.businessName,
        gstin: raw.gstin,
        supportEmail: raw.supportEmail,
        supportPhone: raw.supportPhone,
        // Empty means "nominate none", which is null rather than an id of "".
        pickupAddressId: raw.pickupAddressId ? Number(raw.pickupAddressId) : null,
      })
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          if (res.data) {
            this.absorb(res.data);
          }
          this.savedMessage.set('Business details saved.');
        },
        error: (err) => {
          this.saving.set(false);
          this.errorMessage.set(this.describe(err));
        },
      });
  }

  private absorb(profile: SellerProfileModel): void {
    this.profile.set(profile);
    this.form.patchValue({
      businessName: profile.businessName,
      gstin: profile.gstin ?? '',
      supportEmail: profile.supportEmail ?? '',
      supportPhone: profile.supportPhone ?? '',
      pickupAddressId: profile.pickupAddressId === null ? '' : String(profile.pickupAddressId),
    });
  }

  private loadAddresses(): void {
    this.users.addresses().subscribe({
      // The pickup picker is a convenience; without it the rest of the form still saves.
      next: (res) => this.addresses.set(res.data ?? []),
      error: () => this.addresses.set([]),
    });
  }

  private describe(err: unknown): string {
    const error = (err as { error?: { error?: { code?: string; fieldErrors?: Record<string, string> } } })
      ?.error?.error;

    if (error?.code === 'VALIDATION_FAILED' && error.fieldErrors) {
      const [field, message] = Object.entries(error.fieldErrors)[0] ?? [];
      if (field) {
        return `${field}: ${message}`;
      }
    }
    switch (error?.code) {
      case 'DUPLICATE_GSTIN':
        return 'That GSTIN is already registered to another seller.';
      case 'ADDRESS_NOT_FOUND':
        return 'That pickup address no longer exists. Pick another.';
      case 'ACCESS_DENIED':
        return 'Only a seller account can change these details.';
      default:
        return 'Your business details could not be saved. Please try again.';
    }
  }
}

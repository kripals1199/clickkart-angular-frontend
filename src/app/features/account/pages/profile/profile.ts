import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { UserService } from '@core/services/user.service';
import { AuthService } from '@core/services/auth.service';
import { UserProfile } from '@core/models/user.model';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';

/**
 * The customer's own profile and marketing preferences.
 *
 * <p>Two forms, because the backend has two endpoints: sending the whole profile back to flip a
 * marketing checkbox would resend a name and date of birth nothing asked to change, and would
 * quietly overwrite anything edited elsewhere in between.
 *
 * <p>The email shown is the auth account's, not the profile's - User Service does not own it. It is
 * read-only here for the same reason: changing an email is a verification flow, not a text edit.
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
  ],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile {
  private readonly users = inject(UserService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly profile = signal<UserProfile | null>(null);

  readonly savingProfile = signal(false);
  readonly savingPreferences = signal(false);
  readonly savedMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly accountEmail = this.auth.currentUser;

  /**
   * Once erased, every write to this profile returns 409. The forms are locked rather than left
   * inviting edits that are guaranteed to fail.
   */
  readonly erased = computed(() => !!this.profile()?.erasedAt);

  readonly confirmingErase = signal(false);
  readonly erasing = signal(false);
  readonly eraseError = signal<string | null>(null);

  readonly profileForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.maxLength(60)]],
    lastName: ['', [Validators.maxLength(60)]],
    displayName: ['', [Validators.maxLength(80)]],
    dateOfBirth: [''],
    gender: [''],
    // Empty, or an https URL - the server rejects http, so matching it here saves a round trip.
    avatarUrl: ['', [Validators.pattern(/^$|^https:\/\/.+/)]],
  });

  readonly preferencesForm = this.fb.nonNullable.group({
    marketingEmailOptIn: [false],
    marketingSmsOptIn: [false],
    preferredLanguage: ['en', [Validators.required, Validators.pattern(/^[a-z]{2}(-[A-Z]{2})?$/)]],
    preferredCurrency: ['INR', [Validators.required, Validators.pattern(/^[A-Z]{3}$/)]],
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.users.profile().subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.data) {
          this.absorb(res.data);
        }
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  confirmErase(): void {
    this.confirmingErase.set(true);
    this.eraseError.set(null);
  }

  cancelErase(): void {
    this.confirmingErase.set(false);
  }

  eraseMyData(): void {
    if (this.erasing()) {
      return;
    }
    this.erasing.set(true);
    this.eraseError.set(null);

    this.users.eraseMyData().subscribe({
      next: () => {
        this.erasing.set(false);
        this.confirmingErase.set(false);
        this.savedMessage.set('Your personal data has been erased.');
        // Reload rather than assume: the server decides what survived, and the reload is what
        // puts the page into its locked, erased state.
        this.load();
      },
      error: (err) => {
        this.erasing.set(false);
        this.eraseError.set(this.describeErase(err?.error?.error?.code));
      },
    });
  }

  private describeErase(code: string | undefined): string {
    switch (code) {
      case 'ERASURE_BLOCKED':
        return 'This account has a seller profile, and business records have to be kept for statutory retention. Close the seller account first.';
      default:
        return 'Your data could not be erased. Please try again.';
    }
  }

  saveProfile(): void {
    if (this.profileForm.invalid || this.savingProfile()) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.savingProfile.set(true);
    this.clearBanners();

    const raw = this.profileForm.getRawValue();
    this.users
      .updateProfile({
        ...raw,
        // The server takes null for "not set"; an empty string would be a value of "".
        dateOfBirth: raw.dateOfBirth || null,
        gender: raw.gender ? (raw.gender as UserProfile['gender']) : null,
      })
      .subscribe({
        next: (res) => {
          this.savingProfile.set(false);
          if (res.data) {
            this.absorb(res.data);
          }
          this.savedMessage.set('Profile saved.');
        },
        error: (err) => {
          this.savingProfile.set(false);
          this.errorMessage.set(this.describe(err));
        },
      });
  }

  savePreferences(): void {
    if (this.preferencesForm.invalid || this.savingPreferences()) {
      this.preferencesForm.markAllAsTouched();
      return;
    }

    this.savingPreferences.set(true);
    this.clearBanners();

    this.users.updatePreferences(this.preferencesForm.getRawValue()).subscribe({
      next: (res) => {
        this.savingPreferences.set(false);
        if (res.data) {
          this.absorb(res.data);
        }
        this.savedMessage.set('Preferences saved.');
      },
      error: (err) => {
        this.savingPreferences.set(false);
        this.errorMessage.set(this.describe(err));
      },
    });
  }

  private absorb(profile: UserProfile): void {
    this.profile.set(profile);

    if (profile.erasedAt) {
      // Reads keep working after erasure; writes do not. Disabling says so before the click.
      this.profileForm.disable();
      this.preferencesForm.disable();
    }
    this.profileForm.patchValue({
      firstName: profile.firstName ?? '',
      lastName: profile.lastName ?? '',
      displayName: profile.displayName ?? '',
      dateOfBirth: profile.dateOfBirth ?? '',
      gender: profile.gender ?? '',
      avatarUrl: profile.avatarUrl ?? '',
    });
    this.preferencesForm.patchValue({
      marketingEmailOptIn: profile.marketingEmailOptIn,
      marketingSmsOptIn: profile.marketingSmsOptIn,
      preferredLanguage: profile.preferredLanguage,
      preferredCurrency: profile.preferredCurrency,
    });
  }

  private clearBanners(): void {
    this.savedMessage.set(null);
    this.errorMessage.set(null);
  }

  /**
   * Field-level validation failures carry a `fieldErrors` map. Surfacing the first one beats a
   * generic "check your input" when the server knows exactly which field it rejected.
   */
  private describe(err: unknown): string {
    const error = (err as { error?: { error?: { code?: string; fieldErrors?: Record<string, string> } } })
      ?.error?.error;

    if (error?.code === 'VALIDATION_FAILED' && error.fieldErrors) {
      const [field, message] = Object.entries(error.fieldErrors)[0] ?? [];
      if (field) {
        return `${field}: ${message}`;
      }
    }
    if (error?.code === 'PROFILE_ERASED') {
      // Reachable only from a tab opened before the erasure; the forms are disabled otherwise.
      return 'This profile has been erased and can no longer be edited. Reload the page.';
    }
    return 'That could not be saved. Please try again.';
  }
}

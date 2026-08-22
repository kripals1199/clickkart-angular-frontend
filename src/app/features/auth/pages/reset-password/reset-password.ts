import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '@core/services/auth.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Step two of a password reset: redeem the token for a new password.
 *
 * <p>The token field is a text input the user can paste into, not a hidden field, because the reset
 * email currently carries the raw token as text rather than a link - so pasting is the only way it
 * can be redeemed. A `?token=` query parameter is still read and prefilled, so the page already
 * works unchanged if the email later starts carrying a real link.
 *
 * <p>No captcha here, unlike step one. Holding a valid single-use token already proves more than a
 * challenge would, and an attacker without one cannot get past the token check anyway.
 */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss',
})
export class ResetPassword {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly showPassword = signal(false);
  /** Set once the reset succeeds. Swaps the form for the confirmation. */
  readonly done = signal(false);

  readonly form = this.fb.nonNullable.group(
    {
      token: [this.tokenFromLink(), [Validators.required]],
      // Mirrors the server's PasswordPolicy exactly. Unlike sign-in, this form sets a password, so
      // the rule belongs here - a rejection after the token is spent is a bad place to learn it.
      newPassword: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(100),
          Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/),
        ],
      ],
      // Client-side only; the backend has no such field. It is here because the password is masked
      // and single-use tokens are not reusable - a typo would otherwise set a password the user
      // cannot reproduce, on the account they were in the middle of recovering.
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [passwordsMatch] },
  );

  togglePassword(): void {
    this.showPassword.update((shown) => !shown);
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const { token, newPassword } = this.form.getRawValue();

    this.auth.resetPassword({ token: token.trim(), newPassword }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.done.set(true);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(this.describe(err?.error?.error?.code));
      },
    });
  }

  /**
   * Reads a token out of the link, if there is one. Only ever prefills a form field - it is never
   * submitted without the user pressing the button, so a token arriving this way cannot be redeemed
   * just by loading a URL.
   */
  private tokenFromLink(): string {
    return this.route.snapshot.queryParamMap.get('token') ?? '';
  }

  private describe(code: string | undefined): string {
    switch (code) {
      case 'INVALID_PASSWORD_RESET_TOKEN':
        // Covers expired, already-used and simply wrong. The server does not separate them, and
        // the remedy is the same for all three.
        return 'That token is not valid any more. It may have expired or already been used — request a new one.';
      case 'PASSWORD_REUSED':
        return 'That password has been used on this account before. Choose one you have not used.';
      case 'RATE_LIMIT_EXCEEDED':
        return 'Too many attempts from this network. Please wait a little and try again.';
      case 'VALIDATION_FAILED':
        return 'Check the token and that the new password meets the requirements below.';
      default:
        return 'The password could not be reset. Please try again.';
    }
  }
}

/**
 * Group-level because it compares two controls. Reported on the group rather than on the confirm
 * field so neither control is marked invalid for a problem that belongs to the pair.
 */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('newPassword')?.value;
  const confirmation = group.get('confirmPassword')?.value;
  if (!password || !confirmation || password === confirmation) {
    return null;
  }
  return { passwordsMismatch: true };
}

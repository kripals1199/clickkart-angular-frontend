import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService } from '@core/services/auth.service';
import { OtpChannel } from '@core/models/auth.model';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

/**
 * Account security: change the password, and prove control of the email and mobile already on file.
 *
 * <p>Changing the password needs the current one even though the session is authenticated. That is
 * the point of asking: a stolen token should not be enough to lock the real owner out of their own
 * account.
 *
 * <p>Verification sends a code to what is already on the account - there is no field here for a new
 * address or number, because this endpoint proves control of what is on file rather than changing
 * it. Changing a contact is a different flow that does not exist yet.
 */
@Component({
  selector: 'app-security',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './security.html',
  styleUrl: './security.scss',
})
export class Security {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly changing = signal(false);
  readonly showPasswords = signal(false);
  readonly passwordMessage = signal<string | null>(null);
  readonly passwordError = signal<string | null>(null);

  /** Channel whose code has been sent and is awaiting entry, if any. */
  readonly awaiting = signal<OtpChannel | null>(null);
  readonly sending = signal<OtpChannel | null>(null);
  readonly confirming = signal(false);
  readonly code = signal('');
  readonly verifyMessage = signal<string | null>(null);
  readonly verifyError = signal<string | null>(null);

  readonly currentUser = this.auth.currentUser;

  readonly passwordForm = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      // Mirrors the server's PasswordPolicy. This form sets a password, so the rule belongs here.
      newPassword: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(100),
          Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/),
        ],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [passwordsMatch, mustDiffer] },
  );

  toggleVisibility(): void {
    this.showPasswords.update((shown) => !shown);
  }

  changePassword(): void {
    if (this.passwordForm.invalid || this.changing()) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.changing.set(true);
    this.passwordMessage.set(null);
    this.passwordError.set(null);

    const { currentPassword, newPassword } = this.passwordForm.getRawValue();

    this.auth.changePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.changing.set(false);
        this.passwordForm.reset();
        // The session survives on purpose - the backend does not revoke on a self-service change,
        // so claiming the user has been signed out elsewhere would be untrue.
        this.passwordMessage.set('Password changed. You are still signed in on this device.');
      },
      error: (err) => {
        this.changing.set(false);
        this.passwordError.set(this.describeChange(err?.error?.error?.code));
      },
    });
  }

  sendCode(channel: OtpChannel): void {
    this.sending.set(channel);
    this.verifyMessage.set(null);
    this.verifyError.set(null);
    this.code.set('');

    this.auth.requestContactVerification(channel).subscribe({
      next: () => {
        this.sending.set(null);
        this.awaiting.set(channel);
        this.verifyMessage.set(
          channel === 'EMAIL'
            ? 'A code is on its way to the email on your account.'
            : 'A code is on its way to the mobile number on your account.',
        );
      },
      error: (err) => {
        this.sending.set(null);
        this.verifyError.set(this.describeVerify(err?.error?.error?.code));
      },
    });
  }

  confirmCode(): void {
    const channel = this.awaiting();
    const code = this.code().trim();
    if (!channel || !code || this.confirming()) {
      return;
    }

    this.confirming.set(true);
    this.verifyError.set(null);

    this.auth.confirmContactVerification(channel, code).subscribe({
      next: () => {
        this.confirming.set(false);
        this.awaiting.set(null);
        this.code.set('');
        this.verifyMessage.set(
          channel === 'EMAIL' ? 'Your email is verified.' : 'Your mobile number is verified.',
        );
      },
      error: (err) => {
        this.confirming.set(false);
        this.verifyError.set(this.describeVerify(err?.error?.error?.code));
      },
    });
  }

  cancelVerification(): void {
    this.awaiting.set(null);
    this.code.set('');
    this.verifyError.set(null);
  }

  private describeChange(code: string | undefined): string {
    switch (code) {
      case 'INVALID_CURRENT_PASSWORD':
        return 'That is not your current password.';
      case 'PASSWORD_REUSED':
        return 'You have used that password before. Choose one you have not used.';
      case 'VALIDATION_FAILED':
        return 'The new password does not meet the requirements below.';
      default:
        return 'The password could not be changed. Please try again.';
    }
  }

  private describeVerify(code: string | undefined): string {
    switch (code) {
      case 'INVALID_VERIFICATION_CODE':
        return 'That code is not right, or it has expired. Send a new one.';
      case 'RATE_LIMIT_EXCEEDED':
        return 'Too many attempts. Please wait a little and try again.';
      case 'SERVICE_UNAVAILABLE':
        return 'We could not send the code just now. Please try again shortly.';
      default:
        return 'That did not work. Please try again.';
    }
  }
}

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('newPassword')?.value;
  const confirmation = group.get('confirmPassword')?.value;
  if (!password || !confirmation || password === confirmation) {
    return null;
  }
  return { passwordsMismatch: true };
}

/**
 * Catches the "change" that changes nothing. The server would accept it, but a password reused as
 * its own replacement is almost always a mis-paste rather than an intention.
 */
function mustDiffer(group: AbstractControl): ValidationErrors | null {
  const current = group.get('currentPassword')?.value;
  const next = group.get('newPassword')?.value;
  if (!current || !next || current !== next) {
    return null;
  }
  return { sameAsCurrent: true };
}

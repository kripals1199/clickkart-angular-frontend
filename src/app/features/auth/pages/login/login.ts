import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '@core/services/auth.service';
import { OtpChannel } from '@core/models/auth.model';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

/**
 * Sign-in. Deliberately thinner than registration in two ways.
 *
 * <p>There is no captcha here. Registration has one because creating accounts is the abuse-prone
 * direction; sign-in is guarded instead by per-IP rate limiting at both the Gateway and Auth
 * Service, and by account lockout after repeated failures. Adding a challenge to every sign-in
 * would tax every legitimate return visit to slow an attacker the lockout already stops.
 *
 * <p>And the identifier is not validated as an email, because it does not have to be one - the
 * backend accepts an email, a mobile number, or a public id and resolves which was given. A
 * Validators.email here would reject the two forms the platform supports.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly showPassword = signal(false);

  /**
   * Passwordless mode. A separate mode rather than a separate page, because the identifier is the
   * same thing either way - switching should not make the user retype it.
   */
  readonly mode = signal<'password' | 'otp'>('password');
  readonly otpChannel = signal<OtpChannel>('EMAIL');
  readonly otpSent = signal(false);
  readonly otpCode = signal('');
  readonly sendingOtp = signal(false);

  readonly form = this.fb.nonNullable.group({
    identifier: ['', [Validators.required]],
    // Only `required` - the password policy belongs on the forms that set a password. Enforcing
    // minLength or the character-class rule here would lock out any account created before the
    // policy tightened, and would leak the current rule to anyone guessing at the form.
    password: ['', [Validators.required]],
  });

  togglePassword(): void {
    this.showPassword.update((shown) => !shown);
  }

  /**
   * One submit handler so the Enter key does whatever the visible button does. Without this the
   * form would always attempt a password login, which in one-time-code mode means submitting a
   * password field that is not even on screen.
   */
  onSubmit(): void {
    if (this.mode() === 'password') {
      this.submit();
    } else if (this.otpSent()) {
      this.verifyOtp();
    } else {
      this.sendOtp();
    }
  }

  switchMode(mode: 'password' | 'otp'): void {
    this.mode.set(mode);
    this.errorMessage.set(null);
    this.otpSent.set(false);
    this.otpCode.set('');
  }

  /**
   * Step one. The response is identical whether or not the identifier matches an account, and this
   * says the same - "if there is an account" - rather than confirming one exists.
   */
  sendOtp(): void {
    const identifier = this.form.controls.identifier.value.trim();
    if (!identifier || this.sendingOtp()) {
      this.form.controls.identifier.markAsTouched();
      return;
    }

    this.sendingOtp.set(true);
    this.errorMessage.set(null);

    this.auth.requestOtp(identifier, this.otpChannel()).subscribe({
      next: () => {
        this.sendingOtp.set(false);
        this.otpSent.set(true);
      },
      error: (err) => {
        this.sendingOtp.set(false);
        this.errorMessage.set(this.describe(err?.error?.error));
      },
    });
  }

  /** Step two. Establishes a session exactly as a password login does. */
  verifyOtp(): void {
    const identifier = this.form.controls.identifier.value.trim();
    const code = this.otpCode().trim();
    if (!identifier || !code || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.auth.verifyOtp(identifier, code).subscribe({
      next: () => this.router.navigateByUrl(this.returnUrl()),
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(this.describe(err?.error?.error));
        this.otpCode.set('');
      },
    });
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const { identifier, password } = this.form.getRawValue();

    this.auth.login(identifier.trim(), password).subscribe({
      next: () => this.router.navigateByUrl(this.returnUrl()),
      error: (err) => {
        this.submitting.set(false);
        // Branch on the stable code, never the human-readable message.
        this.errorMessage.set(this.describe(err?.error?.error));
        // Clear only the password. Retyping an email that was correct is pure friction, and the
        // failure does not tell us which of the two was wrong.
        this.form.controls.password.reset();
      },
    });
  }

  /**
   * Where to land after signing in. The 401 interceptor sends expired sessions here, so honouring
   * a `returnUrl` puts the user back where they were rather than on the home page.
   *
   * <p>Only same-site paths are accepted. Redirecting to an arbitrary absolute URL from a query
   * parameter is an open-redirect - an attacker links to /login?returnUrl=https://evil.example and
   * the victim lands on a convincing fake immediately after a real sign-in. A leading "//" is
   * rejected for the same reason: the browser reads it as protocol-relative and leaves the origin.
   */
  private returnUrl(): string {
    const requested = this.route.snapshot.queryParamMap.get('returnUrl');
    if (!requested || !requested.startsWith('/') || requested.startsWith('//')) {
      return '/';
    }
    return requested;
  }

  private describe(error: { code?: string; metadata?: Record<string, unknown> } | undefined): string {
    switch (error?.code) {
      case 'INVALID_CREDENTIALS':
        // One message for a wrong password and for an identifier with no account. The server does
        // not distinguish them either - telling them apart would confirm which accounts exist.
        return 'Those details did not match an account. Check them and try again.';
      case 'ACCOUNT_LOCKED':
        return this.describeLockout(error?.metadata?.['lockedUntil']);
      case 'INVALID_OTP':
        return 'That code is not right, or it has expired. Ask for a new one.';
      case 'RATE_LIMIT_EXCEEDED':
        return 'Too many attempts from this network. Please wait a little and try again.';
      case 'VALIDATION_FAILED':
        return 'Enter both your email, mobile number or ID, and your password.';
      default:
        return 'Sign-in could not be completed. Please try again.';
    }
  }

  /**
   * The lockout carries a `lockedUntil` instant, which is more use to the reader than the bare
   * fact. Both wordings mention the reset, because completing one clears the lockout server-side -
   * so it is a real way out now rather than just a suggestion to wait.
   */
  private describeLockout(lockedUntil: unknown): string {
    const until = typeof lockedUntil === 'string' ? new Date(lockedUntil) : null;
    if (!until || Number.isNaN(until.getTime())) {
      return 'This account is temporarily locked after too many failed attempts. Resetting your password unlocks it.';
    }

    const minutes = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000));
    return `This account is locked after too many failed attempts. Try again in ${minutes} minute${
      minutes === 1 ? '' : 's'
    }, or reset your password to unlock it now.`;
  }
}

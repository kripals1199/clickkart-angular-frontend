import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '@core/services/auth.service';
import { CaptchaService } from '@core/services/captcha.service';
import { CaptchaChallenge } from '@core/models/captcha.model';

/**
 * Validators mirror the backend's RegisterRequest exactly. They are a courtesy that saves a round
 * trip, not a control - the server re-validates everything and is the only thing that decides.
 * Where they must not drift is the rules themselves: a client rule looser than the server's
 * produces a confusing rejection, and one stricter blocks input the platform would have accepted.
 */
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly captcha = inject(CaptchaService);
  private readonly router = inject(Router);

  readonly challenge = signal<CaptchaChallenge | null>(null);
  readonly captchaFailed = signal(false);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly showPassword = signal(false);

  togglePassword(): void {
    this.showPassword.update((shown) => !shown);
  }

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    mobileNumber: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(8),
        Validators.maxLength(100),
        // Same expression the server enforces: a lowercase, an uppercase, a digit and a symbol.
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/),
      ],
    ],
    captchaAnswer: ['', [Validators.required]],
  });

  constructor() {
    this.loadChallenge();
  }

  loadChallenge(): void {
    this.captchaFailed.set(false);
    this.challenge.set(null);
    this.captcha.newChallenge().subscribe({
      next: (res) => res.data && this.challenge.set(res.data),
      // Fail closed. Without a challenge there is no way to submit, which is the correct
      // behaviour on an abuse-prone public endpoint - an outage must not become an open door.
      error: () => this.captchaFailed.set(true),
    });
  }

  submit(): void {
    const challenge = this.challenge();
    if (this.form.invalid || !challenge || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.auth
      .register({ ...this.form.getRawValue(), captchaChallengeId: challenge.challengeId })
      .subscribe({
        next: (res) => {
          // A 2xx is not the same as a session. AuthService only stores tokens when `data` is
          // present, so navigating on status alone could land someone on the home page signed out,
          // which looks like the sign-up silently failed.
          if (!res.data) {
            this.submitting.set(false);
            this.errorMessage.set('Your account was created, but signing you in failed. Try signing in.');
            this.loadChallenge();
            this.form.controls.captchaAnswer.reset();
            return;
          }
          this.router.navigate(['/']);
        },
        error: (err) => {
          this.submitting.set(false);
          // Branch on the stable code, never the human-readable message. Undefined here is normal
          // and expected: a network failure has no envelope at all, and a Gateway 503 answers with
          // `error` as a plain string rather than an object. Both fall through to the default.
          this.errorMessage.set(this.describe(err?.error?.error));
          // A challenge is single-use: whether the answer was wrong or the email was taken, the
          // one on screen is spent and submitting it again would fail for the wrong reason.
          this.loadChallenge();
          this.form.controls.captchaAnswer.reset();
        },
      });
  }

  private describe(error: { code?: string; fieldErrors?: Record<string, string> } | undefined): string {
    // The server names the offending field when it has one. Client validators mirror the server's
    // rules, so this should be rare - but when the two drift, the server's own words are far more
    // use than "registration could not be completed".
    if (error?.code === 'VALIDATION_FAILED') {
      const first = Object.values(error.fieldErrors ?? {})[0];
      // A malformed body also answers VALIDATION_FAILED, with no fieldErrors at all.
      return first ?? 'Some of those details were rejected. Check the form and try again.';
    }

    switch (error?.code) {
      // The server does not say which of the two collided, and deliberately so - confirming
      // "this email exists" to an unauthenticated caller is an account-enumeration oracle.
      case 'DUPLICATE_ACCOUNT':
        return 'That email or mobile number already has an account. Try signing in instead.';
      case 'INVALID_CAPTCHA':
        return 'That captcha answer was not right. Here is a new one.';
      case 'RATE_LIMIT_EXCEEDED':
        return 'Too many attempts from this network. Please wait a little and try again.';
      case 'SERVICE_UNAVAILABLE':
        return 'We could not reach the sign-up service. Nothing was created — please try again.';
      default:
        return 'Registration could not be completed. Please try again.';
    }
  }
}

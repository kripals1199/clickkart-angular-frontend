import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService } from '@core/services/auth.service';
import { CaptchaService } from '@core/services/captcha.service';
import { CaptchaChallenge } from '@core/models/captcha.model';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

/**
 * Step one of a password reset: ask for the token to be emailed.
 *
 * <p>The captcha is not optional decoration. Without one, this endpoint mails an arbitrary address
 * on demand, which makes it an email-bombing tool aimed at someone else's inbox - so it is
 * fail-closed here exactly as on registration, with no enabled path to submit without a challenge.
 *
 * <p>The other rule this page has to hold is that success says nothing about whether the account
 * exists. The server answers 200 either way on purpose; if this page said "no such account" for one
 * and "check your email" for the other, it would hand back the account-enumeration oracle the
 * backend went to the trouble of refusing.
 */
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPassword {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly captcha = inject(CaptchaService);

  readonly challenge = signal<CaptchaChallenge | null>(null);
  readonly captchaFailed = signal(false);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  /** Set once the request is accepted. Swaps the form for the neutral confirmation. */
  readonly sent = signal(false);

  readonly form = this.fb.nonNullable.group({
    identifier: ['', [Validators.required]],
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

    const { identifier, captchaAnswer } = this.form.getRawValue();

    this.auth
      .forgotPassword({
        identifier: identifier.trim(),
        captchaChallengeId: challenge.challengeId,
        captchaAnswer,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.sent.set(true);
        },
        error: (err) => {
          this.submitting.set(false);
          this.errorMessage.set(this.describe(err?.error?.error?.code));
          // A challenge is single-use, so the one on screen is spent either way.
          this.loadChallenge();
          this.form.controls.captchaAnswer.reset();
        },
      });
  }

  private describe(code: string | undefined): string {
    switch (code) {
      case 'INVALID_CAPTCHA':
        return 'That captcha answer was not right. Here is a new one.';
      case 'RATE_LIMIT_EXCEEDED':
        return 'Too many requests from this network. Please wait a little and try again.';
      default:
        return 'The request could not be sent. Please try again.';
    }
  }
}

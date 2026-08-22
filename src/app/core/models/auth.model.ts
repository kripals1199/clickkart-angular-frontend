/** The token pair the platform issues, as it arrives inside {@link LoginResponse}. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Always "Bearer". Sent back so a client does not have to hardcode the scheme. */
  tokenType: string;
  /** Lifetime of the access token, not of the refresh token. */
  expiresInSeconds: number;
}

export interface RegisterRequest {
  email: string;
  /** Indian 10-digit, first digit 6-9. The backend rejects anything else. */
  mobileNumber: string;
  password: string;
  captchaChallengeId: string;
  captchaAnswer: string;
}

/**
 * Note the field name: the backend takes an `identifier`, not an email. One account can be reached
 * by its email, its mobile number, or its public id ("USR-..."), and the server resolves which was
 * given. Sending `email` instead fails bean validation on a @NotBlank identifier, which surfaces as
 * a confusing 400 rather than a credentials error.
 */
export interface LoginRequest {
  identifier: string;
  password: string;
}

/**
 * Carries a captcha for the same reason registration does: without one this endpoint is an
 * email-bombing tool, since anyone can ask it to mail an arbitrary address repeatedly.
 */
export interface ForgotPasswordRequest {
  /** Email, mobile number or public id - same resolution as {@link LoginRequest}. */
  identifier: string;
  captchaChallengeId: string;
  captchaAnswer: string;
}

/**
 * `token` is the raw value from the reset email, never a hash. Note there is no identifier here:
 * the token alone identifies the account, which is why it must be treated as a credential.
 */
export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

/**
 * What both login and register return. The account summary rides along deliberately so a client
 * does not need a follow-up "who am I" call after signing in - see the backend's LoginResponse.
 * `/refresh` is the exception: it returns the bare token pair, since the profile does not change
 * between silent refreshes.
 */
export interface LoginResponse {
  tokens: AuthTokens;
  user: UserSummary;
}

/**
 * The account as the server describes it. This is the only source of the user's email: the access
 * token carries the public id as its subject and the roles claim, but no email, so anything that
 * displays an address has to come from here.
 */
export interface UserSummary {
  publicId: string;
  email: string;
  mobileNumber: string;
  roles: string[];
  enabled: boolean;
  locked: boolean;
  emailVerified: boolean;
  mobileVerified: boolean;
  /** ISO-8601 instant, or null on a first login. */
  lastLoginAt: string | null;
  createdDate: string;
}

/**
 * Who is signed in, held for rendering and routing only - the Gateway is what actually decides
 * whether a request is allowed.
 */
export interface SessionUser {
  userId: string;
  email: string;
  roles: string[];
}

/** Which way a one-time code travels. The account's own address or number is used, never a new one. */
export type OtpChannel = 'EMAIL' | 'SMS';

/**
 * Changing a password requires proving you know the current one, even though the session is already
 * authenticated. A stolen session should not be enough to lock the real owner out of their account.
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/** Verifying a contact you already have on file - the channel says which one. */
export interface RequestContactVerificationRequest {
  channel: OtpChannel;
}

export interface ConfirmContactVerificationRequest {
  channel: OtpChannel;
  code: string;
}

/**
 * Passwordless sign-in. `identifier` resolves the same way as password login - email, mobile or
 * public id - and the request is answered identically whether or not it matches an account.
 */
export interface RequestOtpRequest {
  identifier: string;
  channel: OtpChannel;
}

export interface VerifyOtpRequest {
  identifier: string;
  otp: string;
}

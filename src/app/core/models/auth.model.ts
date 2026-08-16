/** The token pair the platform issues. Both login and register return this. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
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
 * Who is signed in, as read from the access token's claims. Held for rendering and routing only -
 * the Gateway is what actually decides whether a request is allowed.
 */
export interface SessionUser {
  userId: string;
  email: string;
  roles: string[];
}

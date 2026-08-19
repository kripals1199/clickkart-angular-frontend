import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { finalize, map, shareReplay } from 'rxjs/operators';

import { environment } from '@env/environment';
import {
  AuthTokens,
  ChangePasswordRequest,
  ConfirmContactVerificationRequest,
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  OtpChannel,
  RegisterRequest,
  RequestContactVerificationRequest,
  RequestOtpRequest,
  ResetPasswordRequest,
  SessionUser,
  UserSummary,
  VerifyOtpRequest,
} from '@core/models/auth.model';
import { ApiResponse } from '@core/models/api-response';

const ACCESS_TOKEN_KEY = 'clickkart.accessToken';
const REFRESH_TOKEN_KEY = 'clickkart.refreshToken';
const USER_KEY = 'clickkart.user';

/**
 * The roles claim is spelled `roleTypes`, not `roles`, and there is no email claim at all - see
 * the backend's JwtClaimNames. Both matter: reading the wrong key fails silently, because a missing
 * claim is indistinguishable from an account with no roles.
 */
const ROLES_CLAIM = 'roleTypes';

/**
 * Owns the session: the tokens, who the current user is, and the calls that change that.
 *
 * <p>Tokens live in localStorage so a refresh does not sign the user out. That is a deliberate
 * trade with a real cost - localStorage is readable by any script on the origin, so an XSS bug
 * becomes a token theft. The alternative the backend already supports is a httpOnly refresh
 * cookie, which this client cannot read and so cannot leak; moving to it is a backend CORS and
 * cookie-flag change, not a rewrite here.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.gatewayUrl}/api/v1/auth`;

  private readonly accessToken = signal<string | null>(localStorage.getItem(ACCESS_TOKEN_KEY));

  /**
   * The one refresh currently in flight, shared by every caller that asked while it was running.
   * Null when none is.
   */
  private refreshInFlight: Observable<string> | null = null;
  private readonly user = signal<SessionUser | null>(null);

  readonly currentUser = this.user.asReadonly();
  readonly isAuthenticated = computed(() => this.accessToken() !== null);
  readonly roles = computed(() => this.user()?.roles ?? []);

  constructor() {
    const token = this.accessToken();
    if (token) {
      this.user.set(this.restoreSession(token));
    }
  }

  getAccessToken(): string | null {
    return this.accessToken();
  }

  hasRole(role: string): boolean {
    return this.roles().includes(role.startsWith('ROLE_') ? role : `ROLE_${role}`);
  }

  /**
   * Registration returns the same payload as login, so a successful sign-up leaves the user signed
   * in rather than bouncing them to a login form to retype what they just typed.
   */
  register(request: RegisterRequest): Observable<ApiResponse<LoginResponse>> {
    return this.http
      .post<ApiResponse<LoginResponse>>(`${this.baseUrl}/register`, request)
      .pipe(tap((res) => res.data && this.store(res.data)));
  }

  /**
   * `identifier` may be the account's email, its mobile number, or its public id - the server
   * resolves which was given, so the form does not have to guess or offer a picker.
   */
  login(identifier: string, password: string): Observable<ApiResponse<LoginResponse>> {
    const request: LoginRequest = { identifier, password };
    return this.http
      .post<ApiResponse<LoginResponse>>(`${this.baseUrl}/login`, request)
      .pipe(tap((res) => res.data && this.store(res.data)));
  }

  /**
   * Logout is a server call, not just a local clear. The backend revokes the token's jti in Redis,
   * which is the only thing that makes an unexpired access token stop working - discarding it on
   * the client alone would leave a valid token in whatever already copied it.
   */
  logout(): Observable<ApiResponse<void>> {
    return this.http
      .post<ApiResponse<void>>(`${this.baseUrl}/logout`, {})
      .pipe(tap({ next: () => this.clear(), error: () => this.clear() }));
  }

  /**
   * Unlike login, this returns the bare token pair - the account summary is not resent, since it
   * does not change between silent refreshes. The retained email is therefore carried across by
   * hand rather than being reread from a response that does not contain it.
   */
  refresh(): Observable<ApiResponse<AuthTokens>> {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    return this.http
      .post<ApiResponse<AuthTokens>>(`${this.baseUrl}/refresh`, { refreshToken })
      .pipe(
        tap((res) => {
          if (!res.data) {
            return;
          }
          this.storeTokens(res.data);
          this.user.set(this.restoreSession(res.data.accessToken));
        }),
      );
  }

  /**
   * Asks for a reset token to be emailed. Returns 200 whether or not the identifier resolves to an
   * account - deliberately, so the response cannot be used to test which addresses are registered.
   * Callers must keep that property and report success identically either way.
   */
  forgotPassword(request: ForgotPasswordRequest): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/forgot-password`, request);
  }

  /**
   * Redeems the token from that email for a new password. Establishes no session on purpose: the
   * user signs in afterwards with the password they just set, which proves it is the one they
   * meant. It does clear any lockout server-side, so this is also the way out of a locked account.
   */
  resetPassword(request: ResetPasswordRequest): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/reset-password`, request);
  }

  /**
   * Changes the password of the signed-in account. The current one is required even though the
   * session is already authenticated: a stolen token should not be enough to lock the real owner
   * out. Establishes no new session - the existing token keeps working.
   */
  changePassword(request: ChangePasswordRequest): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/change-password`, request);
  }

  /**
   * Sends a code to the address or number already on the account. There is no parameter for a new
   * contact on purpose - this proves you control what is on file, it does not change it.
   */
  requestContactVerification(channel: OtpChannel): Observable<ApiResponse<void>> {
    const request: RequestContactVerificationRequest = { channel };
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/verify-contact/request`, request);
  }

  confirmContactVerification(channel: OtpChannel, code: string): Observable<ApiResponse<void>> {
    const request: ConfirmContactVerificationRequest = { channel, code };
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/verify-contact/confirm`, request);
  }

  /**
   * Step one of passwordless sign-in. Public, and answered identically whether or not the
   * identifier matches an account - so callers must not report "no such account" from it either.
   */
  requestOtp(identifier: string, channel: OtpChannel): Observable<ApiResponse<void>> {
    const request: RequestOtpRequest = { identifier, channel };
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/otp/request`, request);
  }

  /**
   * Step two. Returns the same payload as a password login and therefore establishes a session the
   * same way - which is why it goes through store() rather than being treated as a bare check.
   */
  verifyOtp(identifier: string, otp: string): Observable<ApiResponse<LoginResponse>> {
    const request: VerifyOtpRequest = { identifier, otp };
    return this.http
      .post<ApiResponse<LoginResponse>>(`${this.baseUrl}/otp/verify`, request)
      .pipe(tap((res) => res.data && this.store(res.data)));
  }

  /**
   * Refreshes the access token, at most once at a time.
   *
   * <p>The single-flight is not an optimisation. Refresh tokens rotate, and Auth Service treats a
   * second presentation of an already-rotated token as reuse: it revokes the entire session family
   * and records REFRESH_TOKEN_REUSE_DETECTED. So if three requests expire together and each fires
   * its own refresh, the first rotates the token and the other two look exactly like a stolen one
   * being replayed - the user is hard-signed-out and a security event is logged, which is strictly
   * worse than never refreshing at all. Everyone waits on the same call instead.
   */
  refreshAccessToken(): Observable<string> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    this.refreshInFlight = this.refresh().pipe(
      map((res) => {
        const token = res.data?.accessToken;
        if (!token) {
          throw new Error('Refresh returned no access token');
        }
        return token;
      }),
      // Cleared on success or failure alike, so the next expiry starts a fresh attempt rather than
      // replaying a stale result.
      finalize(() => {
        this.refreshInFlight = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.refreshInFlight;
  }

  /** True when a refresh token exists to attempt with - there is no point trying without one. */
  canRefresh(): boolean {
    return !!localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  /** Ends the session locally, without the server round trip. Used when refresh has already failed. */
  endSession(): void {
    this.clear();
  }

  private store(response: LoginResponse): void {
    this.storeTokens(response.tokens);
    // Persisted because the email is not in the token, so a page reload has no other way to
    // recover it. Nothing secret goes in here - it is the same profile the account can already see.
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    this.user.set({
      userId: response.user.publicId,
      email: response.user.email,
      roles: [...response.user.roles],
    });
  }

  private storeTokens(tokens: AuthTokens): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    this.accessToken.set(tokens.accessToken);
  }

  private clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.accessToken.set(null);
    this.user.set(null);
  }

  /**
   * Rebuilds the identity from the token that survived the page load, plus the stored profile for
   * the one field the token does not carry.
   *
   * <p>Where the two could disagree - the roles - the token wins. It is the copy the Gateway
   * validates and authorises against, so it is the honest answer to "what will this session
   * actually be allowed to do", even when the stored profile is more recent.
   */
  private restoreSession(token: string): SessionUser | null {
    const claims = this.readClaims(token);
    if (!claims) {
      return null;
    }
    return { ...claims, email: this.readStoredUser()?.email ?? '' };
  }

  private readStoredUser(): UserSummary | null {
    const stored = localStorage.getItem(USER_KEY);
    if (!stored) {
      return null;
    }
    try {
      return JSON.parse(stored) as UserSummary;
    } catch {
      return null;
    }
  }

  /**
   * Reads the claims for display and routing only. The signature is deliberately NOT checked here:
   * a client cannot hold the signing secret, so any check it performed would be theatre. The
   * Gateway validates every request; this is just so the UI knows what to render.
   */
  private readClaims(token: string): SessionUser | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      // Minted as a single comma-joined string, not a JSON array.
      const roles: string[] = String(payload[ROLES_CLAIM] ?? '')
        .split(',')
        .map((r: string) => r.trim())
        .filter(Boolean);
      return { userId: payload.sub, email: '', roles };
    } catch {
      return null;
    }
  }
}

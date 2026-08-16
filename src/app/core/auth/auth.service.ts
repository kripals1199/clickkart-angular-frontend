import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SessionUser {
  userId: string;
  email: string;
  roles: string[];
}

const ACCESS_TOKEN_KEY = 'clickkart.accessToken';
const REFRESH_TOKEN_KEY = 'clickkart.refreshToken';

/**
 * Owns the session: the tokens, who the current user is, and the two calls that change that.
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
  private readonly user = signal<SessionUser | null>(null);

  readonly currentUser = this.user.asReadonly();
  readonly isAuthenticated = computed(() => this.accessToken() !== null);
  readonly roles = computed(() => this.user()?.roles ?? []);

  constructor() {
    // Rehydrate the identity from the token that survived the page load. The token is the source
    // of truth the Gateway validates, so the claims in it are what the session actually is.
    const token = this.accessToken();
    if (token) {
      this.user.set(this.readClaims(token));
    }
  }

  getAccessToken(): string | null {
    return this.accessToken();
  }

  hasRole(role: string): boolean {
    return this.roles().includes(role.startsWith('ROLE_') ? role : `ROLE_${role}`);
  }

  login(email: string, password: string): Observable<ApiResponse<AuthTokens>> {
    return this.http
      .post<ApiResponse<AuthTokens>>(`${this.baseUrl}/login`, { email, password })
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

  refresh(): Observable<ApiResponse<AuthTokens>> {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    return this.http
      .post<ApiResponse<AuthTokens>>(`${this.baseUrl}/refresh`, { refreshToken })
      .pipe(tap((res) => res.data && this.store(res.data)));
  }

  private store(tokens: AuthTokens): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken ?? '');
    this.accessToken.set(tokens.accessToken);
    this.user.set(this.readClaims(tokens.accessToken));
  }

  private clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    this.accessToken.set(null);
    this.user.set(null);
  }

  /**
   * Reads the claims for display and routing only. The signature is deliberately NOT checked here:
   * a client cannot hold the signing secret, so any check it performed would be theatre. The
   * Gateway validates every request; this is just so the UI knows what to render.
   */
  private readClaims(token: string): SessionUser | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      const roles: string[] = (payload.roles ?? '')
        .split(',')
        .map((r: string) => r.trim())
        .filter(Boolean);
      return { userId: payload.sub, email: payload.email ?? '', roles };
    } catch {
      return null;
    }
  }
}

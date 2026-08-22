import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';
import { LoginResponse } from '@core/models/auth.model';
import { ApiResponse } from '@core/models/api-response';
import { environment } from '@env/environment';

/**
 * These cover the three places the client and the backend can disagree without anything visibly
 * breaking - a wrong request field, a response read at the wrong depth, and a misspelled claim.
 * Each one had shipped at some point, and none of them threw: the request 400s where a credentials
 * error is expected, the token stores as `undefined`, and a missing claim is indistinguishable from
 * an account that genuinely has no roles.
 */
describe('AuthService', () => {
  const loginUrl = `${environment.gatewayUrl}/api/v1/auth/login`;

  /** A JWT shaped like the real thing: unpadded base64url, and only the claims the server mints. */
  function accessToken(payload: Record<string, unknown>): string {
    const body = btoa(JSON.stringify(payload))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    return `eyJhbGciOiJIUzI1NiJ9.${body}.signature`;
  }

  function loginResponse(token: string): ApiResponse<LoginResponse> {
    return {
      timestamp: '2026-08-17T10:00:00Z',
      status: 200,
      success: true,
      error: null,
      data: {
        tokens: {
          accessToken: token,
          refreshToken: 'opaque-refresh-token',
          tokenType: 'Bearer',
          expiresInSeconds: 900,
        },
        user: {
          publicId: 'USR-1',
          email: 'jane@example.com',
          mobileNumber: '9845550100',
          roles: ['ROLE_CUSTOMER'],
          enabled: true,
          locked: false,
          emailVerified: false,
          mobileVerified: false,
          lastLoginAt: null,
          createdDate: '2026-08-01T10:00:00Z',
        },
      },
      message: null,
      path: '/api/v1/auth/login',
      correlationId: 'corr-1',
    };
  }

  function setUp(): { service: AuthService; http: HttpTestingController } {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    return {
      service: TestBed.inject(AuthService),
      http: TestBed.inject(HttpTestingController),
    };
  }

  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('sends the credentials as `identifier`, which is what the backend validates', () => {
    const { service, http } = setUp();

    service.login('jane@example.com', 'Str0ng!Pass').subscribe();

    const request = http.expectOne(loginUrl);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      identifier: 'jane@example.com',
      password: 'Str0ng!Pass',
    });
    // The old shape. Sending it fails @NotBlank on identifier, so a correct password comes back
    // as a 400 rather than a session.
    expect(request.request.body).not.toHaveProperty('email');
  });

  it('reads the token out of data.tokens, not off data itself', () => {
    const { service, http } = setUp();
    const token = accessToken({ sub: 'USR-1', roleTypes: 'ROLE_CUSTOMER' });

    service.login('jane@example.com', 'Str0ng!Pass').subscribe();
    http.expectOne(loginUrl).flush(loginResponse(token));

    expect(service.getAccessToken()).toBe(token);
    expect(service.isAuthenticated()).toBe(true);
    expect(localStorage.getItem('clickkart.accessToken')).toBe(token);
  });

  it('takes the email from the account summary, since the token has no email claim', () => {
    const { service, http } = setUp();

    service.login('jane@example.com', 'Str0ng!Pass').subscribe();
    http.expectOne(loginUrl).flush(loginResponse(accessToken({ sub: 'USR-1', roleTypes: '' })));

    expect(service.currentUser()?.email).toBe('jane@example.com');
    expect(service.currentUser()?.userId).toBe('USR-1');
  });

  it('restores roles from the roleTypes claim after a reload, and the email from storage', () => {
    // Simulate a page load: the token and summary are already in storage, and the service is
    // constructed fresh from them.
    localStorage.setItem(
      'clickkart.accessToken',
      accessToken({ sub: 'USR-9', roleTypes: 'ROLE_CUSTOMER,ROLE_ADMIN' }),
    );
    localStorage.setItem('clickkart.user', JSON.stringify({ email: 'admin@example.com' }));

    const { service } = setUp();

    expect(service.roles()).toEqual(['ROLE_CUSTOMER', 'ROLE_ADMIN']);
    expect(service.hasRole('ADMIN')).toBe(true);
    expect(service.hasRole('SELLER')).toBe(false);
    expect(service.currentUser()?.email).toBe('admin@example.com');
  });

  it('sends the captcha along with the forgot-password request', () => {
    const { service, http } = setUp();

    service
      .forgotPassword({
        identifier: 'jane@example.com',
        captchaChallengeId: 'chal-1',
        captchaAnswer: 'AB12',
      })
      .subscribe();

    const request = http.expectOne(`${environment.gatewayUrl}/api/v1/auth/forgot-password`);
    expect(request.request.body).toEqual({
      identifier: 'jane@example.com',
      captchaChallengeId: 'chal-1',
      captchaAnswer: 'AB12',
    });
  });

  it('does not start a session when a reset succeeds', () => {
    const { service, http } = setUp();

    service.resetPassword({ token: 'raw-token', newPassword: 'N3wStr0ng!Pass' }).subscribe();
    http.expectOne(`${environment.gatewayUrl}/api/v1/auth/reset-password`).flush({
      timestamp: '2026-08-17T10:00:00Z',
      status: 200,
      success: true,
      error: null,
      data: null,
      message: null,
      path: '/api/v1/auth/reset-password',
      correlationId: 'corr-2',
    });

    // The user signs in afterwards with the password they just set, which is what proves it is the
    // one they meant. A session handed out here would skip that check.
    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('clickkart.accessToken')).toBeNull();
  });

  it('clears the whole session on logout, including the stored profile', () => {
    const { service, http } = setUp();

    service.login('jane@example.com', 'Str0ng!Pass').subscribe();
    http.expectOne(loginUrl).flush(loginResponse(accessToken({ sub: 'USR-1', roleTypes: '' })));

    service.logout().subscribe();
    http.expectOne(`${environment.gatewayUrl}/api/v1/auth/logout`).flush({});

    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(localStorage.getItem('clickkart.user')).toBeNull();
    expect(localStorage.getItem('clickkart.refreshToken')).toBeNull();
  });
});

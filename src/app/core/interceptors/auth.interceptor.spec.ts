import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { authInterceptor } from './auth.interceptor';
import { environment } from '@env/environment';

const API = `${environment.gatewayUrl}/api/v1`;

function token(sub = 'USR-1'): string {
  const body = btoa(JSON.stringify({ sub, roleTypes: 'ROLE_CUSTOMER' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `eyJhbGciOiJIUzI1NiJ9.${body}.sig`;
}

function tokenPair(accessToken: string) {
  return {
    timestamp: '2026-08-19T10:00:00Z',
    status: 200,
    success: true,
    error: null,
    data: { accessToken, refreshToken: 'rotated-refresh', tokenType: 'Bearer', expiresInSeconds: 900 },
    message: null,
    path: '/api/v1/auth/refresh',
    correlationId: 'c1',
  };
}

/**
 * The access token lasts fifteen minutes and the refresh token a week, so a 401 in normal use means
 * "expired", not "signed out". These cover the behaviour that makes that survivable - and in
 * particular the single-flight, which is a correctness requirement: refresh tokens rotate, and
 * presenting an already-rotated one is treated as reuse, which revokes the entire session family.
 * A second concurrent refresh would therefore sign the user out harder than doing nothing.
 */
describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    localStorage.setItem('clickkart.accessToken', token());
    localStorage.setItem('clickkart.refreshToken', 'the-refresh-token');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });

    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('attaches the bearer token', () => {
    http.get(`${API}/cart`).subscribe();
    const request = backend.expectOne(`${API}/cart`);
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${token()}`);
    request.flush({});
  });

  it('refreshes once and replays the request with the new token', () => {
    let body: unknown = null;
    http.get(`${API}/cart`).subscribe((res) => (body = res));

    backend.expectOne(`${API}/cart`).flush({}, { status: 401, statusText: 'Unauthorized' });

    const refresh = backend.expectOne(`${API}/auth/refresh`);
    expect(refresh.request.body).toEqual({ refreshToken: 'the-refresh-token' });
    refresh.flush(tokenPair(token('USR-REFRESHED')));

    // Replayed - and carrying the new token, not the stale one that just failed.
    const retried = backend.expectOne(`${API}/cart`);
    expect(retried.request.headers.get('Authorization')).toBe(`Bearer ${token('USR-REFRESHED')}`);
    retried.flush({ ok: true });

    expect(body).toEqual({ ok: true });
  });

  it('fires exactly one refresh when several requests expire together', () => {
    // The case that would trigger reuse detection if each request refreshed on its own.
    http.get(`${API}/cart`).subscribe({ error: () => undefined });
    http.get(`${API}/orders`).subscribe({ error: () => undefined });
    http.get(`${API}/users/me`).subscribe({ error: () => undefined });

    backend.expectOne(`${API}/cart`).flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(`${API}/orders`).flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(`${API}/users/me`).flush({}, { status: 401, statusText: 'Unauthorized' });

    // One, not three. expectOne throws if a second was issued.
    const refresh = backend.expectOne(`${API}/auth/refresh`);
    refresh.flush(tokenPair(token('USR-REFRESHED')));

    // All three replay off that single refresh.
    backend.expectOne(`${API}/cart`).flush({});
    backend.expectOne(`${API}/orders`).flush({});
    backend.expectOne(`${API}/users/me`).flush({});
  });

  it('signs out when the refresh itself fails', () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    http.get(`${API}/cart`).subscribe({ error: () => undefined });
    backend.expectOne(`${API}/cart`).flush({}, { status: 401, statusText: 'Unauthorized' });

    backend
      .expectOne(`${API}/auth/refresh`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(localStorage.getItem('clickkart.accessToken')).toBeNull();
    // Carries where they were - the test router sits at '/', which is a real page, not an auth screen.
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/' } });
  });

  it('does not refresh when a login is rejected', () => {
    // A wrong password is not an expired session; refreshing would answer the wrong question.
    http.post(`${API}/auth/login`, {}).subscribe({ error: () => undefined });
    backend.expectOne(`${API}/auth/login`).flush({}, { status: 401, statusText: 'Unauthorized' });

    backend.expectNone(`${API}/auth/refresh`);
  });

  it('does not attempt a refresh when there is no refresh token', () => {
    localStorage.removeItem('clickkart.refreshToken');

    http.get(`${API}/cart`).subscribe({ error: () => undefined });
    backend.expectOne(`${API}/cart`).flush({}, { status: 401, statusText: 'Unauthorized' });

    backend.expectNone(`${API}/auth/refresh`);
    expect(localStorage.getItem('clickkart.accessToken')).toBeNull();
  });

  afterEach(() => {
    backend.verify();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { Navbar } from './navbar';

/**
 * The CLI scaffold created this with no providers, which was fine when the navbar was static
 * markup and has been failing since it started injecting AuthService and CartService - the first
 * of which needs HttpClient, and the router for its links.
 *
 * The cart request matters as much as the render: the navbar loads the basket on arrival so the
 * badge is right on a cold page load, and there are no guest carts, so asking without a session
 * would be a guaranteed 401 on every visit by a signed-out visitor.
 */
describe('Navbar', () => {
  let fixture: ComponentFixture<Navbar>;
  let backend: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Navbar);
    backend = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
    localStorage.clear();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('does not ask for a cart when nobody is signed in', () => {
    fixture.detectChanges();
    // expectNone throws if the request was made, which is the whole point: a guest has no cart,
    // so the call could only ever come back 401.
    backend.expectNone((req) => req.url.includes('/cart'));
  });
});

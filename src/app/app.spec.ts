import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';

/**
 * The CLI scaffold also asserted that the app renders `Hello, clickkart-angular-frontend` in an
 * h1. That markup was replaced by the router outlet long ago, so the test had been failing ever
 * since while checking nothing anyone wanted - it has been dropped rather than updated, because
 * "the shell renders the routed page" is what the route specs already cover.
 */
describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the routed page through an outlet rather than markup of its own', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { Home } from './home';

/**
 * Home reads the catalog and stock on construction and renders routerLinks, so it needs an HTTP
 * backend and a router to stand up at all. The testing backend also keeps the constructor's
 * requests from escaping to a real Gateway during a unit test.
 */
describe('Home', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts in a loading state rather than claiming the catalog is empty', () => {
    // The distinction matters: "nothing on sale" and "not loaded yet" look identical if the
    // component reports empty before its first response lands.
    expect(component.loading()).toBe(true);
    expect(component.isEmpty()).toBe(false);
  });
});

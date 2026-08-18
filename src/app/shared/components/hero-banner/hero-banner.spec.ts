import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { HeroBanner } from './hero-banner';

/** The banner's call to action is a routerLink now, so the component needs a router to render. */
describe('HeroBanner', () => {
  let component: HeroBanner;
  let fixture: ComponentFixture<HeroBanner>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeroBanner],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(HeroBanner);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('makes no discount claim the platform cannot honour', () => {
    // There is no promotions service on this platform, so a sitewide "50-80% OFF" banner would be
    // advertising a sale nothing can back. Real discounts are per-variant and render on the tiles.
    const text: string = fixture.nativeElement.textContent;
    expect(text).not.toMatch(/\d+\s*-\s*\d+%\s*OFF/i);
    expect(text).not.toMatch(/mega sale/i);
  });
});

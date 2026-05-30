import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BrandSection } from './brand-section';

describe('BrandSection', () => {
  let component: BrandSection;
  let fixture: ComponentFixture<BrandSection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrandSection],
    }).compileComponents();

    fixture = TestBed.createComponent(BrandSection);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

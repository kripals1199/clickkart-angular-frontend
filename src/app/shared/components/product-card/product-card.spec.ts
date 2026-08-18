import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ProductCard } from './product-card';
import { Product } from '@core/models/catalog.model';

function product(overrides: Partial<Product> = {}): Product {
  return {
    publicId: 'P1',
    name: 'Oversized Cotton Tee',
    slug: 'oversized-cotton-tee',
    description: null,
    brand: 'Roadster',
    categoryPublicId: 'CAT-1',
    sellerPublicId: 'USR-S',
    status: 'ACTIVE',
    variants: [
      { sku: 'SKU-A', variantName: 'M', mrp: 1499, sellingPrice: 799, discountPercentage: 47, attributes: {}, active: true },
    ],
    createdDate: '2026-01-01T00:00:00Z',
    updatedDate: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * `product` is a required input, so the tile cannot be created without one - the previous spec
 * called createComponent with nothing bound and failed on NG0950 before asserting anything.
 */
describe('ProductCard', () => {
  let fixture: ComponentFixture<ProductCard>;

  async function render(value: Product) {
    await TestBed.configureTestingModule({
      imports: [ProductCard],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductCard);
    fixture.componentRef.setInput('product', value);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('should create', async () => {
    expect(await render(product())).toBeTruthy();
  });

  it('quotes the cheapest active variant, and says "from" only when there is a choice', async () => {
    const single = await render(product());
    expect(single.variant()?.sellingPrice).toBe(799);
    expect(single.hasChoice()).toBe(false);

    TestBed.resetTestingModule();

    const multi = await render(
      product({
        variants: [
          { sku: 'A', variantName: 'M', mrp: 4999, sellingPrice: 2499, discountPercentage: 50, attributes: {}, active: true },
          { sku: 'B', variantName: 'L', mrp: 5299, sellingPrice: 1999, discountPercentage: 62, attributes: {}, active: true },
        ],
      }),
    );
    expect(multi.variant()?.sellingPrice).toBe(1999);
    expect(multi.hasChoice()).toBe(true);
  });

  it('never quotes an inactive variant, since it cannot be bought', async () => {
    const card = await render(
      product({
        variants: [
          { sku: 'CHEAP', variantName: 'S', mrp: 999, sellingPrice: 199, discountPercentage: 80, attributes: {}, active: false },
          { sku: 'REAL', variantName: 'M', mrp: 1499, sellingPrice: 799, discountPercentage: 47, attributes: {}, active: true },
        ],
      }),
    );
    expect(card.variant()?.sku).toBe('REAL');
  });

  it('renders no stock line when availability was not supplied', async () => {
    // Absent means "not looked up", which must not be drawn as out of stock.
    const card = await render(product());
    expect(card.stock()).toBeNull();
  });
});

// import { Component } from '@angular/core';

// @Component({
//   selector: 'app-home',
//   standalone: true,
//   imports: [],
//   templateUrl: './home.html',
//   styleUrl: './home.scss',
// })
// export class Home {
  
// }

import { Component, signal } from '@angular/core';

import { Navbar } from '@layout/navbar/navbar';
import { HeroBanner } from '@shared/components/hero-banner/hero-banner';
import { CategorySection } from '@shared/components/category-section/category-section';
import { ProductCard } from '@shared/components/product-card/product-card';
import { Footer } from '@layout/footer/footer';
import { BrandSection } from '@shared/components/brand-section/brand-section';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    Navbar,
    HeroBanner,
    CategorySection,
    ProductCard,
    Footer,
    BrandSection
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home {

  // readonly products = signal([
  //   {
  //     name: 'iPhone 16 Pro',
  //     price: 129999,
  //     image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9'
  //   },
  //   {
  //     name: 'Gaming Laptop',
  //     price: 89999,
  //     image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853'
  //   },
  //   {
  //     name: 'Smart Watch',
  //     price: 9999,
  //     image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30'
  //   },
  //   {
  //     name: 'Headphones',
  //     price: 4999,
  //     image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e'
  //   }
  // ]);

  readonly products = signal([
  {
    name: 'Men Oversized T-Shirt',
    brand: 'Roadster',
    price: 799,
    originalPrice: 1499,
    discount: '47% OFF',
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab'
  },
  {
    name: 'Women Casual Dress',
    brand: 'Tokyo Talkies',
    price: 1299,
    originalPrice: 2499,
    discount: '48% OFF',
    image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c'
  },
  {
    name: 'Denim Jacket',
    brand: 'Levis',
    price: 2499,
    originalPrice: 4999,
    discount: '50% OFF',
    image: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246'
  },
  {
    name: 'Women Ethnic Kurti',
    brand: 'Libas',
    price: 999,
    originalPrice: 1999,
    discount: '50% OFF',
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b'
  }
]);

}

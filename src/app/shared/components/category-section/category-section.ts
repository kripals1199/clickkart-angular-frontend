// import { Component } from '@angular/core';

// @Component({
//   selector: 'app-category-section',
//   imports: [],
//   templateUrl: './category-section.html',
//   styleUrl: './category-section.scss',
// })
// export class CategorySection {}

import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-category-section',
  standalone: true,
  templateUrl: './category-section.html',
  styleUrl: './category-section.scss'
})
export class CategorySection {

  readonly categories = signal([
    'Mobiles',
    'Fashion',
    'Electronics',
    'Appliances',
    'Furniture',
    'Beauty',
    'Grocery',
    'Books'
  ]);

}

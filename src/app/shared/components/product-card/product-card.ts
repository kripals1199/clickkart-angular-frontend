// import { Component } from '@angular/core';

// @Component({
//   selector: 'app-product-card',
//   imports: [],
//   templateUrl: './product-card.html',
//   styleUrl: './product-card.scss',
// })
// export class ProductCard {}

// import {
//   Component,
//   input
// } from '@angular/core';

// import { MatCardModule } from '@angular/material/card';
// import { MatButtonModule } from '@angular/material/button';

// @Component({
//   selector: 'app-product-card',
//   standalone: true,
//   imports: [
//     MatCardModule,
//     MatButtonModule
//   ],
//   templateUrl: './product-card.html',
//   styleUrl: './product-card.scss'
// })
// export class ProductCard {

//   readonly product = input.required<any>();

// }

import {
  Component,
  input
} from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './product-card.html',
  styleUrl: './product-card.scss'
})
export class ProductCard {

  readonly product = input.required<any>();

}
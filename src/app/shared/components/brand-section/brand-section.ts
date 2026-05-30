// import { Component } from '@angular/core';

// @Component({
//   selector: 'app-brand-section',
//   imports: [],
//   templateUrl: './brand-section.html',
//   styleUrl: './brand-section.scss',
// })
// export class BrandSection {}

import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-brand-section',
  standalone: true,
  templateUrl: './brand-section.html',
  styleUrl: './brand-section.scss'
})
export class BrandSection {

  readonly brands = signal([
    'Levis',
    'Nike',
    'Adidas',
    'Puma',
    'Roadster',
    'H&M',
    'Zara',
    'Allen Solly'
  ]);

}

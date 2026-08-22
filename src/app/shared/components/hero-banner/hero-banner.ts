import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * The front-page banner.
 *
 * <p>Its copy used to promise a "Fashion Mega Sale" with "Flat 50-80% OFF". Nothing on this
 * platform backs that: there is no promotions or campaign service, no sitewide discount, and the
 * real per-variant discounts now rendered directly below it are whatever each seller set. A
 * storefront advertising a sale it cannot honour is a false claim, not placeholder copy, so the
 * wording says something true instead and the button goes where it says it does.
 */
@Component({
  selector: 'app-hero-banner',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './hero-banner.html',
  styleUrl: './hero-banner.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroBanner {}

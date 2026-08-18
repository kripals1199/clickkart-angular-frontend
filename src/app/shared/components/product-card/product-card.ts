import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Product } from '@core/models/catalog.model';
import { Availability, describeAvailability } from '@core/models/availability.model';
import { cheapestVariant } from '@shared/pricing';

/**
 * A catalog tile.
 *
 * <p>Previously took an untyped mock object with `image`, `price`, `originalPrice` and `discount`
 * fields, none of which exist on the real Product. Price lives on the variant, so the tile quotes
 * the cheapest active one - the "from ₹x" convention - and says so rather than implying the product
 * has a single price.
 *
 * <p>The action opens the product rather than adding it. The unit of purchase is the SKU, and a
 * listing with three sizes has no single thing to add; picking one on the customer's behalf is
 * worse than asking. That is the same rule the product page follows.
 */
@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './product-card.html',
  styleUrl: './product-card.scss',
})
export class ProductCard {
  readonly product = input.required<Product>();
  /** Optional: the tile renders without it, just with no stock line. */
  readonly availability = input<Availability | undefined>(undefined);

  readonly variant = computed(() => cheapestVariant(this.product()));
  readonly hasChoice = computed(() => (this.product().variants ?? []).filter((v) => v.active).length > 1);
  readonly stock = computed(() => describeAvailability(this.availability()));

  /** Product Service carries no image field, so the tile shows an initial rather than a broken img. */
  readonly initial = computed(() => this.product().name.charAt(0).toUpperCase());
}

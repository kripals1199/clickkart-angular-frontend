import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { SellerService } from '@core/services/seller.service';
import { CatalogService } from '@core/services/catalog.service';
import { Category, Product } from '@core/models/catalog.model';
import { ProductRequest, VariantRequest } from '@core/models/seller.model';
import { describeProductStatus, isEditable } from '@shared/seller-rules';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';

/**
 * Create or edit a listing, including its variants.
 *
 * <p>Only drafts are editable. A listing in review cannot be changed - approving one thing and
 * publishing another is the hole that would open - and an active or archived one is past the point
 * where a free-text edit is the right tool. This page still *opens* for those, read-only, because
 * "view what I submitted" is a real need and bouncing the seller away answers nothing.
 *
 * <p>Categories are filtered to leaves. The server refuses to hang a product off a branch, so
 * offering branches would be offering choices that are guaranteed to fail validation.
 */
@Component({
  selector: 'app-seller-product-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
  ],
  templateUrl: './seller-product-form.html',
  styleUrl: './seller-product-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SellerProductForm {
  private readonly seller = inject(SellerService);
  private readonly catalog = inject(CatalogService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly existing = signal<Product | null>(null);
  readonly categories = signal<Category[]>([]);

  readonly isNew = computed(() => this.existing() === null);
  readonly readOnly = computed(() => {
    const product = this.existing();
    return product !== null && !isEditable(product.status);
  });
  readonly statusHint = computed(() => {
    const product = this.existing();
    return product ? describeProductStatus(product.status) : null;
  });

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    // Empty is allowed and means "derive one from the name" server-side.
    slug: ['', [Validators.pattern(/^$|^[a-z0-9]+(-[a-z0-9]+)*$/), Validators.maxLength(220)]],
    description: ['', [Validators.maxLength(4000)]],
    brand: ['', [Validators.maxLength(120)]],
    categoryPublicId: ['', [Validators.required]],
    variants: this.fb.array<FormGroup>([]),
  });

  get variants(): FormArray<FormGroup> {
    return this.form.controls.variants as FormArray<FormGroup>;
  }

  constructor() {
    this.loadCategories();

    const publicId = this.route.snapshot.paramMap.get('publicId');
    if (publicId) {
      this.loadProduct(publicId);
    } else {
      // A listing needs at least one variant, so a new one starts with an empty row rather than an
      // "add a variant" prompt the seller has to discover.
      this.addVariant();
      this.loading.set(false);
    }
  }

  addVariant(): void {
    this.variants.push(
      this.fb.nonNullable.group({
        // Strict on purpose: this ends up printed on a label and re-typed by a warehouse operator.
        sku: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/)]],
        variantName: ['', [Validators.required, Validators.maxLength(150)]],
        mrp: [null as number | null, [Validators.required, Validators.min(0.01)]],
        sellingPrice: [null as number | null, [Validators.required, Validators.min(0.01)]],
        attributes: [''],
      }),
    );
  }

  removeVariant(index: number): void {
    // The server requires at least one, so the last row cannot be removed - the button is hidden
    // rather than producing a rejection the seller has to interpret.
    if (this.variants.length > 1) {
      this.variants.removeAt(index);
    }
  }

  save(): void {
    if (this.readOnly() || this.saving()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Check the highlighted fields below.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const request = this.toRequest();
    const product = this.existing();
    const call = product
      ? this.seller.updateProduct(product.publicId, request)
      : this.seller.createProduct(request);

    call.subscribe({
      next: (res) => {
        this.saving.set(false);
        const saved = res.data;
        if (saved) {
          this.router.navigate(['/seller/products', saved.publicId]);
          this.existing.set(saved);
        } else {
          this.router.navigate(['/seller/products']);
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(this.describeError(err));
      },
    });
  }

  private toRequest(): ProductRequest {
    const raw = this.form.getRawValue();
    return {
      name: raw.name,
      slug: raw.slug,
      description: raw.description,
      brand: raw.brand,
      categoryPublicId: raw.categoryPublicId,
      variants: this.variants.controls.map((group) => {
        const variant = group.getRawValue() as {
          sku: string;
          variantName: string;
          mrp: number;
          sellingPrice: number;
          attributes: string;
        };
        return {
          sku: variant.sku,
          variantName: variant.variantName,
          mrp: Number(variant.mrp),
          sellingPrice: Number(variant.sellingPrice),
          attributes: parseAttributes(variant.attributes),
        } satisfies VariantRequest;
      }),
    };
  }

  private loadCategories(): void {
    this.catalog.categoryTree().subscribe({
      next: (res) => this.categories.set(flattenLeaves(res.data ?? [])),
      error: () => this.categories.set([]),
    });
  }

  private loadProduct(publicId: string): void {
    this.seller.getProduct(publicId).subscribe({
      next: (res) => {
        const product = res.data;
        this.loading.set(false);
        if (!product) {
          this.failed.set(true);
          return;
        }
        this.existing.set(product);
        this.form.patchValue({
          name: product.name,
          slug: product.slug,
          description: product.description ?? '',
          brand: product.brand ?? '',
          categoryPublicId: product.categoryPublicId ?? '',
        });
        this.variants.clear();
        for (const variant of product.variants) {
          this.addVariant();
          this.variants.at(this.variants.length - 1).patchValue({
            sku: variant.sku,
            variantName: variant.variantName,
            mrp: variant.mrp,
            sellingPrice: variant.sellingPrice,
            attributes: formatAttributes(variant.attributes),
          });
        }
        if (this.variants.length === 0) {
          this.addVariant();
        }
        if (this.readOnly()) {
          this.form.disable();
        }
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  private describeError(err: unknown): string {
    const error = (err as { error?: { error?: { code?: string; fieldErrors?: Record<string, string> } } })
      ?.error?.error;

    if (error?.code === 'VALIDATION_FAILED' && error.fieldErrors) {
      const [field, message] = Object.entries(error.fieldErrors)[0] ?? [];
      if (field) {
        return `${field}: ${message}`;
      }
    }
    switch (error?.code) {
      case 'DUPLICATE_SKU':
        return 'One of those SKUs is already in use. SKUs must be unique across the platform.';
      case 'CATEGORY_NOT_ASSIGNABLE':
        return 'That category cannot hold products directly — pick a more specific one.';
      case 'INVALID_PRODUCT_STATE':
        return 'This listing is no longer editable.';
      default:
        return 'The listing could not be saved. Please try again.';
    }
  }
}

/** Only leaves can hold products, so the branches are dropped rather than shown and rejected. */
function flattenLeaves(categories: Category[]): Category[] {
  const out: Category[] = [];
  const walk = (nodes: Category[]) => {
    for (const node of nodes) {
      if (node.leaf && node.active) {
        out.push(node);
      }
      walk(node.children ?? []);
    }
  };
  walk(categories);
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Attributes are a free-form map, entered as "key: value" per line. A key-value grid would be more
 * guided, but the meaningful keys differ per category and a seller adding twelve of them is better
 * served by a textarea than by twelve rounds of clicking "add row".
 */
function parseAttributes(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of (raw ?? '').split('\n')) {
    const separator = line.indexOf(':');
    if (separator === -1) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key && value) {
      out[key] = value;
    }
  }
  return out;
}

function formatAttributes(attributes: Record<string, string> | null | undefined): string {
  return Object.entries(attributes ?? {})
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
}

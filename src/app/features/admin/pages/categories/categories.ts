import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AdminService } from '@core/services/admin.service';
import { Category } from '@core/models/catalog.model';
import { CategoryRequest } from '@core/models/admin.model';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';

/** A category plus how deep it sits, so the tree can be rendered from a flat list. */
interface FlatCategory {
  category: Category;
  depth: number;
}

/**
 * The catalog taxonomy.
 *
 * <p>The admin tree includes inactive branches, unlike the public one - an operator needs to see
 * what they have hidden in order to unhide it.
 *
 * <p>Deactivating and deleting are deliberately presented as different weights of action.
 * Deactivating hides a branch from the storefront and is reversible. Deleting is not, and on this
 * platform it does not currently refuse a category that still has products hanging off it - so the
 * confirmation says so rather than implying the server will catch it.
 */
@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
    MatTabsModule,
    RouterLinkActive,
  ],
  templateUrl: './categories.html',
  styleUrl: './categories.scss',
})
export class Categories {
  private readonly admin = inject(AdminService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly tree = signal<Category[]>([]);
  readonly errorMessage = signal<string | null>(null);
  readonly savedMessage = signal<string | null>(null);

  readonly formOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly busyId = signal<string | null>(null);
  readonly confirmingDelete = signal<string | null>(null);

  /** Flattened depth-first so the tree renders as indented rows rather than nested components. */
  readonly rows = computed<FlatCategory[]>(() => {
    const out: FlatCategory[] = [];
    const walk = (nodes: Category[], depth: number) => {
      for (const node of nodes) {
        out.push({ category: node, depth });
        walk(node.children ?? [], depth + 1);
      }
    };
    walk(this.tree(), 0);
    return out;
  });

  /** Anything can be a parent, so this is every category including the inactive ones. */
  readonly parentOptions = computed(() =>
    this.rows().filter((row) => row.category.publicId !== this.editingId()),
  );

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    slug: ['', [Validators.pattern(/^$|^[a-z0-9]+(-[a-z0-9]+)*$/), Validators.maxLength(140)]],
    description: ['', [Validators.maxLength(1000)]],
    imageUrl: ['', [Validators.pattern(/^$|^https:\/\/.+/), Validators.maxLength(500)]],
    parentPublicId: [''],
    displayOrder: [0, [Validators.min(0)]],
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.admin.categoryTree().subscribe({
      next: (res) => {
        this.tree.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  startAdd(parentPublicId: string | null = null): void {
    this.form.reset({ parentPublicId: parentPublicId ?? '', displayOrder: 0 });
    this.editingId.set(null);
    this.formOpen.set(true);
    this.errorMessage.set(null);
  }

  startEdit(category: Category): void {
    this.form.reset({
      name: category.name,
      slug: category.slug,
      description: category.description ?? '',
      imageUrl: category.imageUrl ?? '',
      parentPublicId: category.parentPublicId ?? '',
      displayOrder: category.displayOrder,
    });
    this.editingId.set(category.publicId);
    this.formOpen.set(true);
    this.errorMessage.set(null);
  }

  cancel(): void {
    this.formOpen.set(false);
    this.editingId.set(null);
  }

  save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    const request: CategoryRequest = {
      ...raw,
      // Empty string would be a parent id of "", not "no parent".
      parentPublicId: raw.parentPublicId || null,
      displayOrder: Number(raw.displayOrder) || 0,
    };

    const editingId = this.editingId();
    const call = editingId
      ? this.admin.updateCategory(editingId, request)
      : this.admin.createCategory(request);

    call.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.editingId.set(null);
        this.savedMessage.set('Category saved.');
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(this.describe(err));
      },
    });
  }

  toggleActive(category: Category): void {
    this.busyId.set(category.publicId);
    this.errorMessage.set(null);

    this.admin.setCategoryActive(category.publicId, !category.active).subscribe({
      next: () => {
        this.busyId.set(null);
        this.load();
      },
      error: (err) => {
        this.busyId.set(null);
        this.errorMessage.set(this.describe(err));
      },
    });
  }

  confirmDelete(publicId: string): void {
    this.confirmingDelete.set(publicId);
    this.errorMessage.set(null);
  }

  cancelDelete(): void {
    this.confirmingDelete.set(null);
  }

  remove(category: Category): void {
    this.busyId.set(category.publicId);
    this.errorMessage.set(null);

    this.admin.deleteCategory(category.publicId).subscribe({
      next: () => {
        this.busyId.set(null);
        this.confirmingDelete.set(null);
        this.savedMessage.set('Category deleted.');
        this.load();
      },
      error: (err) => {
        this.busyId.set(null);
        this.errorMessage.set(this.describe(err));
      },
    });
  }

  private describe(err: unknown): string {
    const error = (err as { error?: { error?: { code?: string; fieldErrors?: Record<string, string> } } })
      ?.error?.error;

    if (error?.code === 'VALIDATION_FAILED' && error.fieldErrors) {
      const [field, message] = Object.entries(error.fieldErrors)[0] ?? [];
      if (field) {
        return `${field}: ${message}`;
      }
    }
    switch (error?.code) {
      case 'DUPLICATE_SLUG':
        return 'That slug is already in use by another category.';
      case 'CATEGORY_HAS_CHILDREN':
        return 'That category still has sub-categories under it.';
      case 'CATEGORY_IN_USE':
        return 'That category still has products assigned to it.';
      case 'INVALID_PARENT':
        return 'That parent would create a cycle, or is too deep.';
      default:
        return 'That change could not be saved. Please try again.';
    }
  }
}

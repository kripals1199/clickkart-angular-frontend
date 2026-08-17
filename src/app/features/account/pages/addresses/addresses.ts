import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { UserService } from '@core/services/user.service';
import { Address, AddressLabel } from '@core/models/user.model';

/**
 * The shipping address book: list, add, edit, delete, and choose a default.
 *
 * <p>One form serves both adding and editing, switched by `editingId`. Two near-identical forms
 * would drift the moment a validator changed on one and not the other, and the fields are the same
 * either way - only the endpoint differs.
 *
 * <p>Every mutation refetches the list rather than patching it locally. Promoting a default demotes
 * whichever address held it before, server-side, so the row that changed is not the only row that
 * changed - a local patch would leave two addresses both claiming to be the default.
 */
@Component({
  selector: 'app-addresses',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './addresses.html',
  styleUrl: './addresses.scss',
})
export class Addresses {
  private readonly users = inject(UserService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly addresses = signal<Address[]>([]);

  readonly formOpen = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly saving = signal(false);
  readonly busyId = signal<number | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    label: ['HOME' as AddressLabel, [Validators.required]],
    recipientName: ['', [Validators.required, Validators.maxLength(120)]],
    contactNumber: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
    line1: ['', [Validators.required, Validators.maxLength(200)]],
    line2: ['', [Validators.maxLength(200)]],
    landmark: ['', [Validators.maxLength(150)]],
    city: ['', [Validators.required, Validators.maxLength(100)]],
    state: ['', [Validators.required, Validators.maxLength(100)]],
    // Six digits, and an Indian PIN never starts with zero.
    postalCode: ['', [Validators.required, Validators.pattern(/^[1-9]\d{5}$/)]],
    country: ['India', [Validators.required, Validators.maxLength(60)]],
    makeDefault: [false],
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.users.addresses().subscribe({
      next: (res) => {
        this.addresses.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  startAdd(): void {
    this.form.reset({ label: 'HOME', country: 'India', makeDefault: false });
    this.editingId.set(null);
    this.formOpen.set(true);
    this.errorMessage.set(null);
  }

  startEdit(address: Address): void {
    this.form.reset({
      label: address.label,
      recipientName: address.recipientName,
      contactNumber: address.contactNumber,
      line1: address.line1,
      line2: address.line2 ?? '',
      landmark: address.landmark ?? '',
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
      // Not offered while editing the address that already is the default - there is nothing to
      // change, and unticking it would imply the account could have no default at all.
      makeDefault: address.defaultAddress,
    });
    this.editingId.set(address.id);
    this.formOpen.set(true);
    this.errorMessage.set(null);
  }

  cancel(): void {
    this.formOpen.set(false);
    this.editingId.set(null);
    this.errorMessage.set(null);
  }

  save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const request = this.form.getRawValue();
    const editingId = this.editingId();
    const call = editingId === null
      ? this.users.addAddress(request)
      : this.users.updateAddress(editingId, request);

    call.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.editingId.set(null);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(this.describe(err));
      },
    });
  }

  makeDefault(address: Address): void {
    if (address.defaultAddress) {
      return;
    }
    this.busyId.set(address.id);
    this.errorMessage.set(null);
    this.users.makeDefault(address.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.load();
      },
      error: () => {
        this.busyId.set(null);
        this.errorMessage.set('That address could not be made the default.');
      },
    });
  }

  remove(address: Address): void {
    this.busyId.set(address.id);
    this.errorMessage.set(null);
    this.users.deleteAddress(address.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.load();
      },
      error: () => {
        this.busyId.set(null);
        this.errorMessage.set('That address could not be removed.');
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
    if (error?.code === 'ADDRESS_LIMIT_EXCEEDED') {
      return 'You have reached the maximum number of saved addresses.';
    }
    return 'That address could not be saved. Please try again.';
  }
}

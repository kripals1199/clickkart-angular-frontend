import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { environment } from '@env/environment';
import { ApiResponse } from '@core/models/api-response';
import { AddItemRequest, Cart, SetQuantityRequest } from '@core/models/cart.model';

/**
 * The signed-in user's basket. There are no guest carts on this platform - the server keys a cart
 * by the account in the token - so every call here needs a session, and the badge shows nothing
 * until there is one.
 *
 * <p>Every mutating endpoint returns the entire cart rather than just the changed line, so the
 * cached copy below is replaced from each response instead of being patched locally. That is what
 * keeps the badge honest: quantities can be clamped and lines can become unpurchasable server-side,
 * and a client that incremented its own counter would drift from what the cart actually holds.
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.gatewayUrl}/api/v1/cart`;

  private readonly cart = signal<Cart | null>(null);

  readonly current = this.cart.asReadonly();
  /** Drives the navbar badge. Counts units, not lines, so 3 of one SKU reads as 3. */
  readonly itemCount = computed(() => this.cart()?.totalQuantity ?? 0);

  load(): Observable<ApiResponse<Cart>> {
    return this.http.get<ApiResponse<Cart>>(this.baseUrl).pipe(tap((res) => this.absorb(res)));
  }

  addItem(sku: string, quantity = 1): Observable<ApiResponse<Cart>> {
    const body: AddItemRequest = { sku, quantity };
    return this.http
      .post<ApiResponse<Cart>>(`${this.baseUrl}/items`, body)
      .pipe(tap((res) => this.absorb(res)));
  }

  /** Quantity 0 is the documented way to drop a line through this endpoint. */
  setQuantity(sku: string, quantity: number): Observable<ApiResponse<Cart>> {
    const body: SetQuantityRequest = { quantity };
    return this.http
      .put<ApiResponse<Cart>>(`${this.baseUrl}/items/${encodeURIComponent(sku)}`, body)
      .pipe(tap((res) => this.absorb(res)));
  }

  removeItem(sku: string): Observable<ApiResponse<Cart>> {
    return this.http
      .delete<ApiResponse<Cart>>(`${this.baseUrl}/items/${encodeURIComponent(sku)}`)
      .pipe(tap((res) => this.absorb(res)));
  }

  clear(): Observable<ApiResponse<Cart>> {
    return this.http.delete<ApiResponse<Cart>>(this.baseUrl).pipe(tap((res) => this.absorb(res)));
  }

  /** Called on sign-out: the next account to sign in must not inherit this basket's badge. */
  forget(): void {
    this.cart.set(null);
  }

  private absorb(response: ApiResponse<Cart>): void {
    if (response.data) {
      this.cart.set(response.data);
    }
  }
}

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import { ApiResponse, PageResponse } from '@core/models/api-response';
import { CheckoutRequest, Order, OrderSummary } from '@core/models/order.model';

/**
 * Placing and tracking the signed-in customer's orders.
 *
 * <p>Checkout deliberately sends only an address. Omitting `items` tells the server to read the
 * caller's basket and price it itself, which is the only version of this a browser should ask for -
 * lines and prices sent from a client are lines and prices the client chose.
 */
@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.gatewayUrl}/api/v1/orders`;

  /** Places an order from the basket. `addressId` null means the account's default address. */
  checkout(addressId: number | null): Observable<ApiResponse<Order>> {
    const body: CheckoutRequest = { addressId };
    return this.http.post<ApiResponse<Order>>(this.baseUrl, body);
  }

  listMine(page = 0, size = 10): Observable<ApiResponse<PageResponse<OrderSummary>>> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('size', String(size))
      // Newest first: an order history read oldest-first buries the one just placed.
      .set('sort', 'placedAt,desc');
    return this.http.get<ApiResponse<PageResponse<OrderSummary>>>(this.baseUrl, { params });
  }

  getMine(orderReference: string): Observable<ApiResponse<Order>> {
    return this.http.get<ApiResponse<Order>>(
      `${this.baseUrl}/${encodeURIComponent(orderReference)}`,
    );
  }

  /**
   * Only legal while the order is PENDING_PAYMENT - once it is paid, cancelling is a refund, which
   * is an operator action rather than a self-service one. Callers must not offer this otherwise.
   */
  cancel(orderReference: string, reason: string): Observable<ApiResponse<Order>> {
    return this.http.post<ApiResponse<Order>>(
      `${this.baseUrl}/${encodeURIComponent(orderReference)}/cancellation`,
      { reason },
    );
  }
}

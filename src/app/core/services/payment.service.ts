import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import { ApiResponse, PageResponse } from '@core/models/api-response';
import { Payment, PaymentMethod, PaymentRequest } from '@core/models/payment.model';

/**
 * Paying for a placed order.
 *
 * <p>This client never handles an instrument. `methodToken` is the opaque handle a real gateway
 * would return after collecting card details in its own frame; card numbers, CVVs and UPI PINs must
 * never reach this application, and there is deliberately no parameter here that could carry one.
 *
 * <p>Capture is simulated platform-wide - no processor is integrated - and every response says so
 * via `simulated`. Callers are expected to surface that rather than imply money moved.
 */
@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.gatewayUrl}/api/v1/payments`;

  pay(
    orderReference: string,
    method: PaymentMethod,
    methodToken?: string,
  ): Observable<ApiResponse<Payment>> {
    const body: PaymentRequest = { orderReference, method, methodToken };
    return this.http.post<ApiResponse<Payment>>(this.baseUrl, body);
  }

  listMine(page = 0, size = 10): Observable<ApiResponse<PageResponse<Payment>>> {
    const params = new HttpParams().set('page', String(page)).set('size', String(size));
    return this.http.get<ApiResponse<PageResponse<Payment>>>(this.baseUrl, { params });
  }

  getMine(paymentReference: string): Observable<ApiResponse<Payment>> {
    return this.http.get<ApiResponse<Payment>>(
      `${this.baseUrl}/${encodeURIComponent(paymentReference)}`,
    );
  }
}

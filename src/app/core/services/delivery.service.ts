import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import { ApiResponse, PageResponse } from '@core/models/api-response';
import { DeliveryLine } from '@core/models/delivery.model';

/**
 * A delivery agent's own round.
 *
 * <p>Neither call takes an agent id. Both act on the token's subject server-side, so there is no
 * parameter here for one agent to swap for another's - the same shape the seller endpoints use, for
 * the same reason.
 */
@Injectable({ providedIn: 'root' })
export class DeliveryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.gatewayUrl}/api/v1/orders/delivery`;

  /**
   * The round. `includeDelivered` is off by default so the queue shows what is left to do rather
   * than growing forever; the console turns it on when the agent asks to see what they handed over,
   * which is the first thing needed when a customer says a parcel never arrived.
   */
  round(page: number, includeDelivered = false): Observable<ApiResponse<PageResponse<DeliveryLine>>> {
    const params = new HttpParams()
      .set('page', page)
      .set('size', 20)
      .set('includeDelivered', includeDelivered);
    return this.http.get<ApiResponse<PageResponse<DeliveryLine>>>(this.baseUrl, { params });
  }

  /**
   * Handed over. The only fulfilment transition an agent may make - packing and shipping stay with
   * the seller, so there is no status to pass and no body to send.
   */
  markDelivered(orderReference: string, sku: string): Observable<ApiResponse<DeliveryLine>> {
    const url = `${this.baseUrl}/${encodeURIComponent(orderReference)}/items/${encodeURIComponent(sku)}/status`;
    return this.http.put<ApiResponse<DeliveryLine>>(url, {});
  }
}

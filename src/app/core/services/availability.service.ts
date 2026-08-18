import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '@env/environment';
import { ApiResponse } from '@core/models/api-response';
import { Availability } from '@core/models/availability.model';

/** The server truncates a bulk request past this, so the client chunks rather than lose the tail. */
const MAX_BULK_SKUS = 100;

/**
 * Public stock availability, for a product page or a basket. No authentication required, which is
 * why this does not live with the seller's stock management.
 */
@Injectable({ providedIn: 'root' })
export class AvailabilityService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.gatewayUrl}/api/v1/inventory/availability`;

  forSku(sku: string): Observable<ApiResponse<Availability>> {
    return this.http.get<ApiResponse<Availability>>(`${this.baseUrl}/${encodeURIComponent(sku)}`);
  }

  /**
   * Returns a map keyed by SKU, because callers always want to look one up beside the variant they
   * are rendering rather than scan a list.
   *
   * <p>Requests beyond the server's cap are split and recombined. The server silently truncates an
   * over-long list rather than rejecting it, so sending one and trusting the response would quietly
   * drop the tail - which reads as "out of stock" for everything past the hundredth SKU.
   */
  forSkus(skus: string[]): Observable<Map<string, Availability>> {
    const unique = [...new Set(skus.filter(Boolean))];
    if (unique.length === 0) {
      return of(new Map());
    }

    const chunks: string[][] = [];
    for (let i = 0; i < unique.length; i += MAX_BULK_SKUS) {
      chunks.push(unique.slice(i, i + MAX_BULK_SKUS));
    }

    return forkJoin(
      chunks.map((chunk) =>
        this.http.get<ApiResponse<Availability[]>>(this.baseUrl, {
          params: new HttpParams().set('skus', chunk.join(',')),
        }),
      ),
    ).pipe(
      map((responses) => {
        const out = new Map<string, Availability>();
        for (const response of responses) {
          for (const entry of response.data ?? []) {
            out.set(entry.sku, entry);
          }
        }
        return out;
      }),
    );
  }
}

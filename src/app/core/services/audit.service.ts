import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import { ApiResponse, PageResponse } from '@core/models/api-response';
import { AuditEntry, AuditSource, ChainIntegrityReport } from '@core/models/audit.model';

/**
 * Reads the tamper-evident audit chains.
 *
 * <p>Every service keeps its own chain rather than one shared log, which is deliberate on a
 * platform with no shared database - so browsing and verification are always scoped to a chosen
 * service, and there is no combined view to offer.
 *
 * <p>The verification path is taken from the source rather than assembled here, because Auth
 * Service uses "/audit/verify" and the rest use "/audit/verification".
 */
@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly http = inject(HttpClient);

  browse(source: AuditSource, page = 0, size = 25): Observable<ApiResponse<PageResponse<AuditEntry>>> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('size', String(size))
      // Newest first: an incident is investigated backwards from now.
      .set('sort', 'occurredAt,desc');
    return this.http.get<ApiResponse<PageResponse<AuditEntry>>>(
      `${environment.gatewayUrl}${source.base}/audit`,
      { params },
    );
  }

  /**
   * Walks the whole chain server-side. A `intact: false` result is a finding, not a failure - the
   * call still succeeds, and the report says where recomputation first disagreed.
   */
  verify(source: AuditSource): Observable<ApiResponse<ChainIntegrityReport>> {
    return this.http.get<ApiResponse<ChainIntegrityReport>>(
      `${environment.gatewayUrl}${source.base}${source.verifyPath}`,
    );
  }
}

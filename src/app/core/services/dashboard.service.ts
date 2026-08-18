import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import { ApiResponse } from '@core/models/api-response';
import { Dashboard, ServiceStatus, WorkItem } from '@core/models/dashboard.model';

/**
 * Admin Service: read-only, cross-service operator views.
 *
 * <p>It holds no data and can change nothing. It reads the other services' admin endpoints and
 * reports what it saw, which is why every actionable thing it returns names the service that owns
 * it rather than offering to resolve it here.
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.gatewayUrl}/api/v1/admin`;

  /** Per-panel failures are reported inside the payload, so this only errors if the call itself does. */
  dashboard(): Observable<ApiResponse<Dashboard>> {
    return this.http.get<ApiResponse<Dashboard>>(`${this.baseUrl}/dashboard`);
  }

  /** Already filtered to non-empty queues and sorted by severity server-side. */
  worklist(): Observable<ApiResponse<WorkItem[]>> {
    return this.http.get<ApiResponse<WorkItem[]>>(`${this.baseUrl}/worklist`);
  }

  services(): Observable<ApiResponse<ServiceStatus[]>> {
    return this.http.get<ApiResponse<ServiceStatus[]>>(`${this.baseUrl}/services`);
  }
}

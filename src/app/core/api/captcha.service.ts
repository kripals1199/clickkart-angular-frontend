import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response';

export interface CaptchaChallenge {
  challengeId: string;
  /** A PNG, already base64-encoded. Render with `data:image/png;base64,`. */
  imageBase64: string;
  expiresInSeconds: number;
}

/**
 * The platform hosts its own CAPTCHA rather than calling a third party, so this is an ordinary
 * call to the Gateway with no external script to load.
 *
 * <p>Registration is fail-closed behind it: if the challenge cannot be fetched, the form must not
 * offer a way to submit without one. Letting the user through on a captcha outage would turn an
 * availability problem into an open door on an abuse-prone public endpoint.
 */
@Injectable({ providedIn: 'root' })
export class CaptchaService {
  private readonly http = inject(HttpClient);

  newChallenge(): Observable<ApiResponse<CaptchaChallenge>> {
    return this.http.post<ApiResponse<CaptchaChallenge>>(
      `${environment.gatewayUrl}/api/v1/captcha/challenge`,
      {},
    );
  }
}

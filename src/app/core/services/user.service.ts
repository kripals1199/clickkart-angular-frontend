import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import { ApiResponse } from '@core/models/api-response';
import {
  Address,
  AddressRequest,
  UpdatePreferencesRequest,
  UpdateProfileRequest,
  UserProfile,
} from '@core/models/user.model';

/**
 * The signed-in customer's own profile and address book. Every path here is `/me` - the account is
 * taken from the token, never from a parameter, so one customer cannot ask for another's data by
 * changing an id in the URL. The admin endpoints that do take a user id are a separate surface.
 */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly me = `${environment.gatewayUrl}/api/v1/users/me`;

  profile(): Observable<ApiResponse<UserProfile>> {
    return this.http.get<ApiResponse<UserProfile>>(this.me);
  }

  updateProfile(request: UpdateProfileRequest): Observable<ApiResponse<UserProfile>> {
    return this.http.put<ApiResponse<UserProfile>>(this.me, request);
  }

  /**
   * Preferences are a separate endpoint rather than part of the profile, so toggling a marketing
   * opt-in does not have to resend a name and date of birth it was not asked to change.
   */
  updatePreferences(request: UpdatePreferencesRequest): Observable<ApiResponse<UserProfile>> {
    return this.http.put<ApiResponse<UserProfile>>(`${this.me}/preferences`, request);
  }

  addresses(): Observable<ApiResponse<Address[]>> {
    return this.http.get<ApiResponse<Address[]>>(`${this.me}/addresses`);
  }

  addAddress(request: AddressRequest): Observable<ApiResponse<Address>> {
    return this.http.post<ApiResponse<Address>>(`${this.me}/addresses`, request);
  }

  updateAddress(addressId: number, request: AddressRequest): Observable<ApiResponse<Address>> {
    return this.http.put<ApiResponse<Address>>(`${this.me}/addresses/${addressId}`, request);
  }

  deleteAddress(addressId: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.me}/addresses/${addressId}`);
  }

  /** Promotes one address to default; the previous default is demoted server-side. */
  makeDefault(addressId: number): Observable<ApiResponse<Address>> {
    return this.http.put<ApiResponse<Address>>(`${this.me}/addresses/${addressId}/default`, {});
  }
}

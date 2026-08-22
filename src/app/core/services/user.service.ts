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
  SellerProfile,
  UpsertSellerProfileRequest,
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

  /**
   * Erases the signed-in customer's own personal data. Irreversible: profile fields cleared,
   * marketing consent withdrawn, every saved address scrubbed and deleted.
   *
   * <p>Afterwards reads still work and report `erasedAt`, but every write returns 409 - so a
   * caller must stop offering edits once it has happened rather than letting them fail.
   *
   * <p>Refused with 409 while the account has a seller profile: business records carry statutory
   * retention obligations. That is a real reason worth relaying, not a generic failure.
   *
   * <p>Distinct from the account itself, which lives in Auth Service and can still sign in.
   */
  eraseMyData(): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(this.me);
  }

  /**
   * The seller's own business profile. Readable by any authenticated account - it returns 404 when
   * there is no seller profile - while the write additionally requires ROLE_SELLER.
   */
  sellerProfile(): Observable<ApiResponse<SellerProfile>> {
    return this.http.get<ApiResponse<SellerProfile>>(`${this.me}/seller`);
  }

  /**
   * Creates on first call, updates thereafter. Note what is not here: verificationStatus. A seller
   * cannot verify themselves - only an operator decides that - so it is absent from the request
   * rather than present and ignored.
   */
  upsertSellerProfile(request: UpsertSellerProfileRequest): Observable<ApiResponse<SellerProfile>> {
    return this.http.put<ApiResponse<SellerProfile>>(`${this.me}/seller`, request);
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

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import { ApiResponse, PageResponse } from '@core/models/api-response';
import { Category, Product } from '@core/models/catalog.model';
import { Order, OrderStatus, OrderSummary } from '@core/models/order.model';
import { Payment, PaymentStatus } from '@core/models/payment.model';
import { UserProfile } from '@core/models/user.model';
import { UserSummary } from '@core/models/auth.model';
import {
  CategoryRequest,
  Refund,
  RefundRequest,
  ReviewDecisionRequest,
  SellerProfile,
  SellerVerificationDecisionRequest,
  SellerVerificationStatus,
} from '@core/models/admin.model';

/**
 * The operator surface, spanning five services.
 *
 * <p>Grouped by the job rather than by which service answers, the same way SellerService is - an
 * operator chasing a stuck payment does not care that orders and payments are separate deployments.
 *
 * <p>Everything here is `hasRole('ADMIN')` server-side. Nothing in this class is what stops a
 * non-admin: the role guard on the routes is convenience, and these endpoints are the real gate.
 */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly products = `${environment.gatewayUrl}/api/v1/products/admin`;
  private readonly categories = `${environment.gatewayUrl}/api/v1/categories/admin`;
  private readonly orders = `${environment.gatewayUrl}/api/v1/orders/admin`;
  private readonly payments = `${environment.gatewayUrl}/api/v1/payments/admin`;
  private readonly users = `${environment.gatewayUrl}/api/v1/users`;
  private readonly accounts = `${environment.gatewayUrl}/api/v1/auth/accounts`;

  private paged(page: number, size: number): HttpParams {
    return new HttpParams().set('page', String(page)).set('size', String(size));
  }

  // ---- product moderation -------------------------------------------------

  reviewQueue(page = 0, size = 20): Observable<ApiResponse<PageResponse<Product>>> {
    return this.http.get<ApiResponse<PageResponse<Product>>>(`${this.products}/review-queue`, {
      params: this.paged(page, size),
    });
  }

  /** Rejecting without a reason leaves the seller nothing to act on - callers must require one. */
  decide(publicId: string, request: ReviewDecisionRequest): Observable<ApiResponse<Product>> {
    return this.http.put<ApiResponse<Product>>(
      `${this.products}/${encodeURIComponent(publicId)}/review`,
      request,
    );
  }

  // ---- categories ---------------------------------------------------------

  /** The admin tree, unlike the public one, includes inactive branches. */
  categoryTree(): Observable<ApiResponse<Category[]>> {
    return this.http.get<ApiResponse<Category[]>>(`${this.categories}/tree`);
  }

  createCategory(request: CategoryRequest): Observable<ApiResponse<Category>> {
    return this.http.post<ApiResponse<Category>>(this.categories, request);
  }

  updateCategory(publicId: string, request: CategoryRequest): Observable<ApiResponse<Category>> {
    return this.http.put<ApiResponse<Category>>(
      `${this.categories}/${encodeURIComponent(publicId)}`,
      request,
    );
  }

  /** Deactivating hides a branch from the storefront without destroying anything under it. */
  setCategoryActive(publicId: string, active: boolean): Observable<ApiResponse<Category>> {
    return this.http.put<ApiResponse<Category>>(
      `${this.categories}/${encodeURIComponent(publicId)}/activation`,
      { active },
    );
  }

  deleteCategory(publicId: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.categories}/${encodeURIComponent(publicId)}`);
  }

  // ---- orders -------------------------------------------------------------

  searchOrders(
    status: OrderStatus | null,
    page = 0,
    size = 20,
  ): Observable<ApiResponse<PageResponse<OrderSummary>>> {
    let params = this.paged(page, size).set('sort', 'placedAt,desc');
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<ApiResponse<PageResponse<OrderSummary>>>(`${this.orders}/search`, { params });
  }

  /** Orders where money is owed back but the refund has not been issued yet. */
  refundsRequired(page = 0, size = 20): Observable<ApiResponse<PageResponse<OrderSummary>>> {
    return this.http.get<ApiResponse<PageResponse<OrderSummary>>>(`${this.orders}/refunds-required`, {
      params: this.paged(page, size),
    });
  }

  /**
   * Unlike the customer's own cancellation, this one reaches paid orders - which is exactly why it
   * is an operator action: cancelling something already paid for creates a refund obligation.
   */
  cancelOrder(orderReference: string, reason: string): Observable<ApiResponse<Order>> {
    return this.http.post<ApiResponse<Order>>(
      `${this.orders}/${encodeURIComponent(orderReference)}/cancellation`,
      { reason },
    );
  }

  // ---- payments -----------------------------------------------------------

  searchPayments(
    status: PaymentStatus | null,
    page = 0,
    size = 20,
  ): Observable<ApiResponse<PageResponse<Payment>>> {
    let params = this.paged(page, size);
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<ApiResponse<PageResponse<Payment>>>(`${this.payments}/search`, { params });
  }

  /**
   * Payments whose outcome never reached Order Service. These are the dangerous ones: money may
   * have moved while the order still believes it is unpaid, so they need a human.
   */
  unreported(page = 0, size = 20): Observable<ApiResponse<PageResponse<Payment>>> {
    return this.http.get<ApiResponse<PageResponse<Payment>>>(`${this.payments}/unreported`, {
      params: this.paged(page, size),
    });
  }

  refund(paymentReference: string, request: RefundRequest): Observable<ApiResponse<Refund>> {
    return this.http.post<ApiResponse<Refund>>(
      `${this.payments}/${encodeURIComponent(paymentReference)}/refunds`,
      request,
    );
  }

  listRefunds(paymentReference: string): Observable<ApiResponse<Refund[]>> {
    return this.http.get<ApiResponse<Refund[]>>(
      `${this.payments}/${encodeURIComponent(paymentReference)}/refunds`,
    );
  }

  // ---- accounts -----------------------------------------------------------
  // Auth Service owns credentials and roles; User Service owns the profile. These are the
  // credential-side controls, which is why they live under /auth rather than /users.

  browseAccounts(
    roleType: string | null,
    locked: boolean | null,
    email: string,
    page = 0,
    size = 20,
  ): Observable<ApiResponse<PageResponse<UserSummary>>> {
    let params = this.paged(page, size);
    if (roleType) {
      params = params.set('roleType', roleType);
    }
    if (locked !== null) {
      params = params.set('locked', String(locked));
    }
    if (email.trim()) {
      params = params.set('email', email.trim());
    }
    return this.http.get<ApiResponse<PageResponse<UserSummary>>>(this.accounts, { params });
  }

  /**
   * Locking revokes the account's live sessions as well as blocking new sign-ins - blocking only
   * the front door would leave whoever is already inside there.
   */
  lockAccount(publicId: string): Observable<ApiResponse<UserSummary>> {
    return this.http.post<ApiResponse<UserSummary>>(
      `${this.accounts}/${encodeURIComponent(publicId)}/lock`,
      {},
    );
  }

  unlockAccount(publicId: string): Observable<ApiResponse<UserSummary>> {
    return this.http.post<ApiResponse<UserSummary>>(
      `${this.accounts}/${encodeURIComponent(publicId)}/unlock`,
      {},
    );
  }

  /** Soft delete - the row survives so past orders still resolve to someone. */
  deleteAccount(publicId: string): Observable<ApiResponse<UserSummary>> {
    return this.http.post<ApiResponse<UserSummary>>(
      `${this.accounts}/${encodeURIComponent(publicId)}/delete`,
      {},
    );
  }

  // ---- people -------------------------------------------------------------

  browseProfiles(search: string, page = 0, size = 20): Observable<ApiResponse<PageResponse<UserProfile>>> {
    let params = this.paged(page, size);
    if (search.trim()) {
      params = params.set('search', search.trim());
    }
    return this.http.get<ApiResponse<PageResponse<UserProfile>>>(this.users, { params });
  }

  browseSellers(
    status: SellerVerificationStatus | null,
    page = 0,
    size = 20,
  ): Observable<ApiResponse<PageResponse<SellerProfile>>> {
    let params = this.paged(page, size);
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<ApiResponse<PageResponse<SellerProfile>>>(`${this.users}/sellers`, { params });
  }

  decideVerification(
    userPublicId: string,
    request: SellerVerificationDecisionRequest,
  ): Observable<ApiResponse<SellerProfile>> {
    return this.http.put<ApiResponse<SellerProfile>>(
      `${this.users}/${encodeURIComponent(userPublicId)}/seller/verification`,
      request,
    );
  }
}

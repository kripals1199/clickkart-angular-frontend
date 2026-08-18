import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import { ApiResponse, PageResponse } from '@core/models/api-response';
import { Product, ProductStatus } from '@core/models/catalog.model';
import { FulfilmentStatus } from '@core/models/order.model';
import {
  FulfilmentUpdateRequest,
  ProductRequest,
  SellerOrder,
  Stock,
  StockAdjustmentRequest,
  StockLevelRequest,
} from '@core/models/seller.model';

/**
 * Everything a seller does, across the three services that own it: listings in Product Service,
 * stock in Inventory Service, and fulfilment in Order Service.
 *
 * <p>Grouped by who is doing the work rather than by which service answers, because a seller does
 * not care that stock and listings live apart - and because every one of these paths is scoped to
 * the caller's own seller id server-side, which is the property that actually matters here.
 */
@Injectable({ providedIn: 'root' })
export class SellerService {
  private readonly http = inject(HttpClient);
  private readonly products = `${environment.gatewayUrl}/api/v1/products/seller`;
  private readonly inventory = `${environment.gatewayUrl}/api/v1/inventory/seller`;
  private readonly orders = `${environment.gatewayUrl}/api/v1/orders/seller`;

  // ---- listings ----------------------------------------------------------

  listProducts(status: ProductStatus | null, page = 0, size = 20): Observable<ApiResponse<PageResponse<Product>>> {
    let params = new HttpParams().set('page', String(page)).set('size', String(size));
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<ApiResponse<PageResponse<Product>>>(this.products, { params });
  }

  getProduct(publicId: string): Observable<ApiResponse<Product>> {
    return this.http.get<ApiResponse<Product>>(`${this.products}/${encodeURIComponent(publicId)}`);
  }

  createProduct(request: ProductRequest): Observable<ApiResponse<Product>> {
    return this.http.post<ApiResponse<Product>>(this.products, request);
  }

  updateProduct(publicId: string, request: ProductRequest): Observable<ApiResponse<Product>> {
    return this.http.put<ApiResponse<Product>>(
      `${this.products}/${encodeURIComponent(publicId)}`,
      request,
    );
  }

  /** Hands a DRAFT to moderation. It becomes PENDING_REVIEW and is no longer freely editable. */
  submitForReview(publicId: string): Observable<ApiResponse<Product>> {
    return this.http.put<ApiResponse<Product>>(
      `${this.products}/${encodeURIComponent(publicId)}/submission`,
      {},
    );
  }

  /** Withdraws a listing from sale. Archiving is the delete a catalog can afford - past orders
   *  still reference the product, so the row cannot simply go away. */
  archive(publicId: string): Observable<ApiResponse<Product>> {
    return this.http.put<ApiResponse<Product>>(
      `${this.products}/${encodeURIComponent(publicId)}/archive`,
      {},
    );
  }

  // ---- stock -------------------------------------------------------------

  listStock(page = 0, size = 20): Observable<ApiResponse<PageResponse<Stock>>> {
    const params = new HttpParams().set('page', String(page)).set('size', String(size));
    return this.http.get<ApiResponse<PageResponse<Stock>>>(this.inventory, { params });
  }

  lowStock(page = 0, size = 20): Observable<ApiResponse<PageResponse<Stock>>> {
    const params = new HttpParams().set('page', String(page)).set('size', String(size));
    return this.http.get<ApiResponse<PageResponse<Stock>>>(`${this.inventory}/low-stock`, { params });
  }

  /** Sets the figure outright - use for a correction where the true count is known. */
  setStockLevel(sku: string, request: StockLevelRequest): Observable<ApiResponse<Stock>> {
    return this.http.put<ApiResponse<Stock>>(
      `${this.inventory}/${encodeURIComponent(sku)}`,
      request,
    );
  }

  /** Moves the figure by a delta, with a reason. Preferred over setting where a cause is known. */
  adjustStock(sku: string, request: StockAdjustmentRequest): Observable<ApiResponse<Stock>> {
    return this.http.post<ApiResponse<Stock>>(
      `${this.inventory}/${encodeURIComponent(sku)}/adjustment`,
      request,
    );
  }

  // ---- fulfilment --------------------------------------------------------

  listOrders(page = 0, size = 20): Observable<ApiResponse<PageResponse<SellerOrder>>> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('size', String(size))
      .set('sort', 'placedAt,desc');
    return this.http.get<ApiResponse<PageResponse<SellerOrder>>>(this.orders, { params });
  }

  getOrder(orderReference: string): Observable<ApiResponse<SellerOrder>> {
    return this.http.get<ApiResponse<SellerOrder>>(
      `${this.orders}/${encodeURIComponent(orderReference)}`,
    );
  }

  /**
   * Advances one line, not the whole order - sellers ship their own items independently, and an
   * order can contain several sellers' goods.
   */
  advanceFulfilment(
    orderReference: string,
    sku: string,
    status: FulfilmentStatus,
    trackingReference: string,
  ): Observable<ApiResponse<SellerOrder>> {
    const body: FulfilmentUpdateRequest = { status, trackingReference };
    return this.http.put<ApiResponse<SellerOrder>>(
      `${this.orders}/${encodeURIComponent(orderReference)}/items/${encodeURIComponent(sku)}/fulfilment`,
      body,
    );
  }
}

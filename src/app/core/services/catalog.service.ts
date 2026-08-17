import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import { ApiResponse, PageResponse } from '@core/models/api-response';
import { Category, Product, ProductSearchParams } from '@core/models/catalog.model';

/**
 * Browsing the catalog: taxonomy from Category Service, listings from Product Service.
 *
 * <p>Both are public - no token required - which is why nothing here assumes a session. The
 * interceptor will still attach one if the visitor happens to be signed in, which is harmless.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly categories = `${environment.gatewayUrl}/api/v1/categories`;
  private readonly products = `${environment.gatewayUrl}/api/v1/products`;

  /** The whole active tree, nested. Use for navigation menus. */
  categoryTree(): Observable<ApiResponse<Category[]>> {
    return this.http.get<ApiResponse<Category[]>>(`${this.categories}/tree`);
  }

  /** Top-level categories only, flat - cheaper than the tree when that is all that is rendered. */
  rootCategories(): Observable<ApiResponse<Category[]>> {
    return this.http.get<ApiResponse<Category[]>>(`${this.categories}/roots`);
  }

  categoryBySlug(slug: string): Observable<ApiResponse<Category>> {
    return this.http.get<ApiResponse<Category>>(`${this.categories}/slug/${encodeURIComponent(slug)}`);
  }

  children(publicId: string): Observable<ApiResponse<Category[]>> {
    return this.http.get<ApiResponse<Category[]>>(
      `${this.categories}/${encodeURIComponent(publicId)}/children`,
    );
  }

  /** Ancestors of a category, root-first - the trail a listing page shows above its heading. */
  breadcrumb(publicId: string): Observable<ApiResponse<Category[]>> {
    return this.http.get<ApiResponse<Category[]>>(
      `${this.categories}/${encodeURIComponent(publicId)}/breadcrumb`,
    );
  }

  /**
   * Only parameters that were actually supplied are sent. An empty `query=` is not the same as no
   * query to the server, so blank values are dropped rather than passed through as empty strings.
   */
  searchProducts(params: ProductSearchParams): Observable<ApiResponse<PageResponse<Product>>> {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return this.http.get<ApiResponse<PageResponse<Product>>>(`${this.products}/search`, {
      params: httpParams,
    });
  }

  productBySlug(slug: string): Observable<ApiResponse<Product>> {
    return this.http.get<ApiResponse<Product>>(`${this.products}/slug/${encodeURIComponent(slug)}`);
  }

  productById(publicId: string): Observable<ApiResponse<Product>> {
    return this.http.get<ApiResponse<Product>>(`${this.products}/${encodeURIComponent(publicId)}`);
  }
}

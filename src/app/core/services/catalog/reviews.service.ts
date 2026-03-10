import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  Review,
  ReviewsResponse,
  CreateReviewDto,
} from '../../interfaces/review.interface';

export interface ReviewsParams {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'rating' | 'helpful';
  sortOrder?: 'asc' | 'desc';
  minRating?: number;
  verified?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ReviewsService {
  private readonly apiUrl = `${environment.apiUrl}/reviews`;

  constructor(private readonly http: HttpClient) {}

  /** Obtiene reseñas paginadas de un producto con filtros opcionales */
  getByProduct(
    productId: string,
    params: ReviewsParams = {}
  ): Observable<ReviewsResponse> {
    let httpParams = new HttpParams();
    if (params.page)       httpParams = httpParams.set('page',      String(params.page));
    if (params.limit)      httpParams = httpParams.set('limit',     String(params.limit));
    if (params.sortBy)     httpParams = httpParams.set('sortBy',    params.sortBy);
    if (params.sortOrder)  httpParams = httpParams.set('sortOrder', params.sortOrder);
    if (params.minRating)  httpParams = httpParams.set('minRating', String(params.minRating));
    if (params.verified !== undefined) {
      httpParams = httpParams.set('verified', String(params.verified));
    }

    return this.http
      .get<ReviewsResponse>(`${this.apiUrl}/product/${productId}`, {
        params: httpParams,
      })
      .pipe(
        catchError((err) => {
          console.error('Error cargando reseñas:', err);
          return of({ data: [], total: 0, page: 1, limit: params.limit ?? 5 } as ReviewsResponse);
        })
      );
  }

  /** Crea una nueva reseña (requiere autenticación) */
  create(dto: CreateReviewDto): Observable<Review> {
    return this.http.post<Review>(this.apiUrl, dto);
  }

  /** Registra un voto de "útil" en una reseña */
  markHelpful(reviewId: string): Observable<Review> {
    return this.http
      .post<Review>(`${this.apiUrl}/${reviewId}/helpful`, {})
      .pipe(
        catchError((err) => {
          console.error('Error marcando reseña como útil:', err);
          throw err;
        })
      );
  }
}

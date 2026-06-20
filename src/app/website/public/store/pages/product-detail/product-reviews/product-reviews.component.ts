import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { ReviewsService } from '../../../../../../core/services/catalog/reviews.service';
import { AuthService } from '../../../../../../core/services/auth/auth.service';
import { ToastService } from '../../../../../../core/services/ui/toast.service';
import {
  Review,
  RatingDistribution,
  CreateReviewDto,
} from '../../../../../../core/interfaces/review.interface';

@Component({
  selector: 'app-product-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-reviews.component.html',
  styleUrl: './product-reviews.component.css',
})
export class ProductReviewsComponent implements OnInit, OnDestroy {
  @Input({ required: true }) productId!: string;

  private readonly reviewsService = inject(ReviewsService);
  private readonly authService    = inject(AuthService);
  private readonly toast          = inject(ToastService);
  private readonly destroy$       = new Subject<void>();

  // ─── Estado ──────────────────────────────────────────────────────────────────
  reviews: Review[]                         = [];
  loading                                    = true;
  loadingMore                                = false;
  submitting                                 = false;
  helpfulLoading: { [id: string]: boolean } = {};

  totalReviews      = 0;
  currentPage       = 1;
  readonly pageSize = 5;

  // Filtros
  sortBy: 'createdAt' | 'rating' | 'helpful' = 'createdAt';
  sortOrder: 'asc' | 'desc'                   = 'desc';
  onlyVerified                                 = false;

  // Resumen
  averageRating                      = 0;
  distribution: RatingDistribution[] = [];

  // Formulario
  showForm   = false;
  newReview: CreateReviewDto = { productId: '', rating: 0, title: '', comment: '' };
  hoverStar  = 0;

  // ─── Computed ────────────────────────────────────────────────────────────────
  get isLoggedIn(): boolean {
    return !!this.authService.currentUserSubject.value;
  }

  get hasMore(): boolean {
    return this.reviews.length < this.totalReviews;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.newReview.productId = this.productId;
    this.loadReviews(true);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Carga ───────────────────────────────────────────────────────────────────
  loadReviews(reset = false): void {
    if (reset) {
      this.currentPage = 1;
      this.reviews     = [];
      this.loading     = true;
    } else {
      this.loadingMore = true;
    }

    this.reviewsService
      .getByProduct(this.productId, {
        page:      this.currentPage,
        limit:     this.pageSize,
        sortBy:    this.sortBy,
        sortOrder: this.sortOrder,
        verified:  this.onlyVerified || undefined,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        this.reviews      = reset ? res.data : [...this.reviews, ...res.data];
        this.totalReviews = res.total;
        this.loading      = false;
        this.loadingMore  = false;
        this.buildSummary();
      });
  }

  loadMore(): void {
    this.currentPage++;
    this.loadReviews(false);
  }

  applyFilter(): void {
    this.loadReviews(true);
  }

  // ─── Resumen de ratings ──────────────────────────────────────────────────────
  private buildSummary(): void {
    if (!this.reviews.length) {
      this.averageRating = 0;
      this.distribution  = [];
      return;
    }
    const sum = this.reviews.reduce((acc, r) => acc + r.rating, 0);
    this.averageRating = Math.round((sum / this.reviews.length) * 10) / 10;

    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    this.reviews.forEach((r) => counts[r.rating]++);

    this.distribution = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: counts[star],
      pct:   Math.round((counts[star] / this.reviews.length) * 100),
    }));
  }

  // ─── Formulario ──────────────────────────────────────────────────────────────
  setFormRating(star: number): void { this.newReview.rating = star; }
  setHoverStar(star: number): void  { this.hoverStar = star; }

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (!this.showForm) this.resetForm();
  }

  submitReview(): void {
    if (!this.newReview.rating || !this.newReview.title || !this.newReview.comment) {
      this.toast.showError('Completa todos los campos de la reseña');
      return;
    }
    this.submitting = true;
    this.reviewsService
      .create(this.newReview)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.showSuccess('¡Reseña publicada!');
          this.resetForm();
          this.showForm   = false;
          this.submitting = false;
          this.loadReviews(true);
        },
        error: () => {
          this.toast.showError('No se pudo publicar la reseña');
          this.submitting = false;
        },
      });
  }

  private resetForm(): void {
    this.newReview = { productId: this.productId, rating: 0, title: '', comment: '' };
    this.hoverStar = 0;
  }

  // ─── Útil ────────────────────────────────────────────────────────────────────
  markHelpful(review: Review): void {
    if (this.helpfulLoading[review._id]) return;
    this.helpfulLoading[review._id] = true;

    this.reviewsService
      .markHelpful(review._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated: Review) => {
          const idx = this.reviews.findIndex((r) => r._id === updated._id);
          if (idx !== -1) this.reviews[idx] = updated;
          this.helpfulLoading[review._id] = false;
        },
        error: () => {
          this.helpfulLoading[review._id] = false;
        },
      });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  starArray(): number[] {
    return [1, 2, 3, 4, 5];
  }

  getReviewerName(review: Review): string {
    if (typeof review.userId === 'string') return 'Usuario';
    return (review.userId as { name: string; _id: string }).name ?? 'Usuario';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  }
}

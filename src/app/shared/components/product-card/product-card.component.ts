import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Product, ThumbnailEntry } from '../../../core/interfaces/product.interface';
import { CloudinaryPipe } from '../../pipes/cloudinary.pipe';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterLink, CloudinaryPipe],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.css'
})
export class ProductCardComponent {
  @Input({ required: true }) product!: Product;
  @Input() loading: boolean = false;

  @Output() quickAdd = new EventEmitter<Product>();
  @Output() toggleFavorite = new EventEmitter<Product>();

  /** Índice activo en el carrusel de imágenes del producto */
  activeIdx: number = 0;

  get images(): string[] {
    const tg = this.product.thumbnailGallery;
    if (tg && tg.length > 0) return tg.map((t: ThumbnailEntry) => t.image);
    if (this.product.gallery && this.product.gallery.length > 0) return this.product.gallery;
    return ['assets/images/placeholder.svg'];
  }

  cardNext(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.images.length <= 1) return;
    this.activeIdx = (this.activeIdx + 1) % this.images.length;
  }

  cardPrev(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.images.length <= 1) return;
    this.activeIdx = (this.activeIdx - 1 + this.images.length) % this.images.length;
  }

  cardGoTo(event: Event, idx: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.activeIdx = idx;
  }

  get discountPct(): number {
    return this.product.discount ?? 0;
  }

  get originalPrice(): number {
    const d = this.discountPct;
    const finalPrice = this.product.finalPrice ?? this.product.basePrice ?? 0;
    return d <= 0 ? finalPrice : this.product.basePrice;
  }

  get finalPrice(): number {
    return this.product.finalPrice ?? this.product.basePrice ?? 0;
  }

  canPickupFast(): boolean {
    const km = this.product.nearestStoreKm;
    return km !== undefined && km !== null && km <= 5;
  }

  isNewProduct(): boolean {
    if (!this.product.createdAt) return false;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return new Date(this.product.createdAt) > thirtyDaysAgo;
  }

  get installmentsCount(): number {
    const price = this.finalPrice;
    if (price >= 2000) return 24;
    if (price >= 1000) return 12;
    if (price >= 500) return 3;
    return 0;
  }

  get installmentPrice(): number {
    const count = this.installmentsCount;
    return count > 0 ? this.finalPrice / count : 0;
  }

  onQuickAddClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.quickAdd.emit(this.product);
  }

  onFavoriteClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.toggleFavorite.emit(this.product);
  }

  onImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'assets/images/placeholder.svg';
    img.onerror = null;
  }
}

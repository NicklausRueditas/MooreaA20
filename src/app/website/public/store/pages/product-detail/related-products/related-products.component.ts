import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { ProductsService } from '../../../../../../core/services/catalog/products.service';
import { CloudinaryPipe } from '../../../../../../shared/pipes/cloudinary.pipe';
import { Product } from '../../../../../../core/interfaces/product.interface';

@Component({
  selector: 'app-related-products',
  standalone: true,
  imports: [CommonModule, CloudinaryPipe],
  templateUrl: './related-products.component.html',
  styleUrl: './related-products.component.css',
})
export class RelatedProductsComponent implements OnInit, OnDestroy {
  @Input({ required: true }) product!: Product;

  private readonly productsService = inject(ProductsService);
  private readonly router           = inject(Router);
  private readonly destroy$         = new Subject<void>();

  related: Product[] = [];
  loading             = true;

  ngOnInit(): void {
    this.productsService.loadCatalog();
    this.productsService.catalog$
      .pipe(takeUntil(this.destroy$))
      .subscribe((catalog: Product[]) => {
        if (!catalog.length) return;
        this.related = catalog
          .filter(
            (p) =>
              p._id !== this.product._id &&
              p.brand.toLowerCase() === this.product.brand.toLowerCase()
          )
          .slice(0, 8);
        this.loading = false;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  goToProduct(item: Product): void {
    this.router.navigate(['/store', item.code]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  finalPrice(item: Product): number {
    return item.discount > 0
      ? item.basePrice * (1 - item.discount / 100)
      : item.basePrice;
  }

  thumbnail(item: Product): string {
    return item.gallery?.[0] ?? '';
  }
}

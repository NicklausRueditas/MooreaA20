import { Pipe, PipeTransform } from '@angular/core';

/**
 * Transforma URLs de Cloudinary para servir imágenes optimizadas.
 * Si la URL no es de Cloudinary, la devuelve sin modificar.
 *
 * Uso en template:
 *   [src]="imageUrl | cloudinary:'w_800,c_fill'"
 *   [src]="imageUrl | cloudinary"  → usa transformación por defecto (w_600,c_fill,q_auto,f_auto)
 */
@Pipe({
  name: 'cloudinary',
  standalone: true,
  pure: true,
})
export class CloudinaryPipe implements PipeTransform {
  private static readonly CLOUDINARY_HOST = 'res.cloudinary.com';
  private static readonly DEFAULT_TRANSFORM = 'w_600,c_fill,q_auto,f_auto';

  transform(url: string | null | undefined, transform?: string): string {
    if (!url) return 'assets/images/placeholder.svg';

    // Solo modifica URLs de Cloudinary
    if (!url.includes(CloudinaryPipe.CLOUDINARY_HOST)) return url;

    const t = transform ?? CloudinaryPipe.DEFAULT_TRANSFORM;

    // Inserta la transformación justo antes del segmento /upload/
    return url.replace('/upload/', `/upload/${t}/`);
  }
}

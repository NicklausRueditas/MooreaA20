import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';


@Injectable({
  providedIn: 'root'
})
export class ImageService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  // Subir imagen
  uploadImage(file: File): Observable<{
    cloudinaryId: string;
    cloudinaryUrl: string;
    secureUrl: string;
    mimetype: string;
    size: number;
    folder?: string;
    format?: string;
    width?: number;
    height?: number;
  }> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<{
      cloudinaryId: string;
      cloudinaryUrl: string;
      secureUrl: string;
      mimetype: string;
      size: number;
      folder?: string;
      format?: string;
      width?: number;
      height?: number;
    }>(`${this.baseUrl}/image/upload`, formData);
  }

  /**
   * Elimina una imagen de Cloudinary y la base de datos
   * @param cloudinaryId El ID completo de Cloudinary (ej: "tienda-virtual/abc123")
   */
  deleteImage(cloudinaryId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/image/${cloudinaryId}`);
  }
}

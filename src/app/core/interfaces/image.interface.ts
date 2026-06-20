export interface Image {
    file: File | null; // Archivo local (puede ser null si la imagen ya está en el servidor)
    preview: string;   // URL de previsualización o URL de la imagen existente
    url: string;       // URL final de la imagen en el servidor
  }
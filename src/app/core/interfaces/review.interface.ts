/** Usuario resumido dentro de una reseña (populado por la API) */
export interface ReviewUser {
  _id: string;
  name: string;
  email?: string;
}

/** Reseña de producto tal como la devuelve la API */
export interface Review {
  _id: string;
  productId: string;
  userId: ReviewUser | string;
  rating: number;         // 1-5
  title: string;
  comment: string;
  images?: string[];
  verified: boolean;      // compra verificada
  helpful: number;        // votos de útil
  createdAt: string;
  updatedAt?: string;
}

/** Respuesta paginada de reseñas */
export interface ReviewsResponse {
  data: Review[];
  total: number;
  page: number;
  limit: number;
}

/** Distribución de ratings para el resumen (1-5 estrellas) */
export interface RatingDistribution {
  star: number;
  count: number;
  pct: number; // porcentaje calculado en frontend
}

/** DTO para crear una reseña */
export interface CreateReviewDto {
  productId: string;
  rating: number;
  title: string;
  comment: string;
  images?: string[];
}

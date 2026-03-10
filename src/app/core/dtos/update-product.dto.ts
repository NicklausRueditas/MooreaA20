export interface UpdateProductDto {
  code?: string;
  name?: string;
  brand?: string;
  model?: string;
  description?: string;
  specifications?: Record<string, string>;
  basePrice?: number;
  category?: string[];
  gallery?: string[];
  discount?: number;
  isActive?: boolean;
  tags?: string[];
}

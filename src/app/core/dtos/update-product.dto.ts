/**
 * Campos que acepta PATCH /product/:id.
 * NO incluye: code (inmutable), isActive (usa /activate o /deactivate).
 */
export interface UpdateProductDto {
  name?:           string;
  brand?:          string;
  model?:          string;
  description?:    string;
  specifications?: Record<string, string>;
  basePrice?:      number;
  category?:       string[];
  gallery?:        string[];
  discount?:       number;
  tags?:           string[];
  warranty?:       {
    duration?:    number;
    unit?:        string;
    type?:        string;
    description?: string;
    policyUrl?:   string;
  };
}

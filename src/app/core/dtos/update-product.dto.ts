export interface DimensionsDto {
  weight?: {
    value?: number;
    unit?: string;
  };
  size?: {
    type?: string;
    height?: string;
    width?: string;
    depth?: string;
    value?: string;
  };
}

export interface UpdateProductDto {
  [key: string]: string | number | string[] | Record<string, string> | DimensionsDto;
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORÍAS DE PRODUCTOS
// Están organizadas jerárquicamente.
// En el formulario se muestra el grupo como separador visual y se elige la hoja.
// ─────────────────────────────────────────────────────────────────────────────

export interface CategoryGroup {
  group: string;      // Nombre del grupo (para el <optgroup>)
  icon: string;       // Emoji representativo
  options: string[];  // Categorías específicas dentro del grupo
}

/**
 * Árbol de categorías agrupadas para usar en <select> con <optgroup>.
 * Cada item de `options` es la cadena exacta que se guarda en la base de datos.
 */
export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    group: 'Calzado',
    icon: '👟',
    options: [
      'Zapatillas',
      'Zapatos Casuales',
      'Zapatos Formales',
      'Botas',
      'Botines',
      'Sandalias',
      'Ojotas',
      'Mocasines',
      'Deportivos',
      'Calzado Infantil',
    ],
  },
  {
    group: 'Ropa',
    icon: '👕',
    options: [
      'Camisetas',
      'Camisas',
      'Polos',
      'Pantalones',
      'Jeans',
      'Shorts',
      'Vestidos',
      'Faldas',
      'Casacas',
      'Chaquetas',
      'Abrigos',
      'Ropa Interior',
      'Ropa Deportiva',
      'Ropa Infantil',
    ],
  },
  {
    group: 'Accesorios',
    icon: '👜',
    options: [
      'Carteras',
      'Bolsos',
      'Mochilas',
      'Billeteras',
      'Cinturones',
      'Sombreros',
      'Gorras',
      'Gafas de Sol',
      'Relojes',
      'Joyas',
      'Medias y Calcetines',
      'Bufandas',
      'Guantes',
    ],
  },
  {
    group: 'Electrónica',
    icon: '💻',
    options: [
      'Laptops',
      'Computadoras',
      'Tablets',
      'Teléfonos',
      'Audífonos',
      'Parlantes',
      'Cámaras',
      'Accesorios de Cómputo',
      'Cables y Cargadores',
      'Smart TV',
    ],
  },
  {
    group: 'Hogar',
    icon: '🏠',
    options: [
      'Muebles',
      'Comedor',
      'Dormitorio',
      'Cocina',
      'Baño',
      'Decoración',
      'Iluminación',
      'Jardín',
      'Colchones',
      'Almohadas',
    ],
  },
  {
    group: 'Deporte',
    icon: '⚽',
    options: [
      'Ropa Deportiva',
      'Calzado Deportivo',
      'Equipamiento',
      'Fútbol',
      'Natación',
      'Ciclismo',
      'Gimnasio y Fitness',
      'Outdoor y Camping',
    ],
  },
  {
    group: 'Belleza y Salud',
    icon: '💄',
    options: [
      'Skincare',
      'Maquillaje',
      'Fragancias',
      'Cabello',
      'Cuidado Personal',
      'Vitaminas y Suplementos',
    ],
  },
  {
    group: 'Juguetes y Bebés',
    icon: '🧸',
    options: [
      'Juguetes',
      'Juegos de Mesa',
      'Ropa de Bebé',
      'Accesorios de Bebé',
      'Carriolas y Sillas',
    ],
  },
  {
    group: 'Herramientas',
    icon: '🔧',
    options: [
      'Herramientas Manuales',
      'Herramientas Eléctricas',
      'Construcción',
      'Pintura',
      'Seguridad',
    ],
  },
  {
    group: 'Libros y Papelería',
    icon: '📚',
    options: [
      'Libros',
      'Útiles Escolares',
      'Arte y Manualidades',
      'Papelería de Oficina',
    ],
  },
];

/**
 * Lista plana de todas las categorías (para compatibilidad con filtros y búsquedas).
 * Se genera automáticamente desde CATEGORY_GROUPS.
 */
export const CATEGORY_OPTIONS: string[] = CATEGORY_GROUPS.flatMap(g => g.options);

// ─────────────────────────────────────────────────────────────────────────────
// TAGS PREDEFINIDOS POR GRUPO
// Se usan para enriquecer la búsqueda. Cada producto puede tener múltiples tags.
// Se agrupan para facilitar la selección en el formulario.
// ─────────────────────────────────────────────────────────────────────────────

export interface TagGroup {
  group: string;
  icon: string;
  tags: string[];
}

export const TAG_GROUPS: TagGroup[] = [
  {
    group: 'Género',
    icon: '👤',
    tags: ['mujer', 'hombre', 'unisex', 'niña', 'niño', 'infantil', 'adulto'],
  },
  {
    group: 'Estilo',
    icon: '✨',
    tags: ['casual', 'formal', 'deportivo', 'elegante', 'urbano', 'vintage', 'bohemio', 'clásico', 'moderno'],
  },
  {
    group: 'Temporada',
    icon: '🌤️',
    tags: ['verano', 'invierno', 'otoño', 'primavera', 'todo el año', 'temporada'],
  },
  {
    group: 'Ocasión',
    icon: '🎉',
    tags: ['oficina', 'playa', 'fiesta', 'gym', 'outdoor', 'casual', 'diario', 'noche'],
  },
  {
    group: 'Material',
    icon: '🪡',
    tags: ['cuero', 'cuero sintético', 'tela', 'algodón', 'poliéster', 'goma', 'madera', 'metal', 'lona', 'gamuza'],
  },
  {
    group: 'Características',
    icon: '⭐',
    tags: ['nuevo', 'oferta', 'trending', 'exclusivo', 'limitado', 'eco-friendly', 'importado', 'nacional', 'sale'],
  },
  {
    group: 'Calzado',
    icon: '👟',
    tags: ['taco alto', 'taco bajo', 'plataforma', 'taco cuadrado', 'taco aguja', 'sin taco', 'punta redonda', 'punta cuadrada'],
  },
  {
    group: 'Talla (referencia)',
    icon: '📏',
    tags: ['talla única', 'talla extendida', 'plus size', 'petite', 'oversized'],
  },
  {
    group: 'Tecnología',
    icon: '💻',
    tags: ['gaming', 'ultradelgado', 'plegable', 'inalámbrico', 'bluetooth', '4K', 'Full HD'],
  },
  {
    group: 'Marca',
    icon: '🏷️',
    tags: ['call it spring', 'nike', 'adidas', 'puma', 'samsung', 'apple', 'lg', 'sony'],
  },
];

/**
 * Lista plana de todos los tags (para autocompletar y búsquedas).
 */
export const TAG_OPTIONS: string[] = TAG_GROUPS.flatMap(g => g.tags);

// ─────────────────────────────────────────────────────────────────────────────
// COLORES (mejorado con hex)
// ─────────────────────────────────────────────────────────────────────────────

export interface ColorOption {
  name: string;
  hex: string;
  code: string;
}

export const COLOR_OPTIONS: ColorOption[] = [
  { name: 'Blanco',      hex: '#FFFFFF', code: 'WHT' },
  { name: 'Negro',       hex: '#000000', code: 'BLK' },
  { name: 'Gris',        hex: '#9CA3AF', code: 'GRY' },
  { name: 'Gris Oscuro', hex: '#374151', code: 'DGR' },
  { name: 'Beige',       hex: '#D2B48C', code: 'BGE' },
  { name: 'Crema',       hex: '#FFFDD0', code: 'CRM' },
  { name: 'Marrón',      hex: '#8B4513', code: 'BRN' },
  { name: 'Camel',       hex: '#C19A6B', code: 'CML' },
  { name: 'Rojo',        hex: '#EF4444', code: 'RED' },
  { name: 'Burdeos',     hex: '#800020', code: 'BRD' },
  { name: 'Rosa',        hex: '#F9A8D4', code: 'PNK' },
  { name: 'Fucsia',      hex: '#FF00FF', code: 'FCS' },
  { name: 'Naranja',     hex: '#FB923C', code: 'ORG' },
  { name: 'Amarillo',    hex: '#FDE047', code: 'YLW' },
  { name: 'Verde',       hex: '#22C55E', code: 'GRN' },
  { name: 'Verde Oliva', hex: '#808000', code: 'OLV' },
  { name: 'Azul',        hex: '#3B82F6', code: 'BLU' },
  { name: 'Azul Marino', hex: '#1E3A5F', code: 'NVY' },
  { name: 'Celeste',     hex: '#7DD3FC', code: 'SKY' },
  { name: 'Violeta',     hex: '#A78BFA', code: 'VLT' },
  { name: 'Morado',      hex: '#7C3AED', code: 'PRP' },
  { name: 'Dorado',      hex: '#F59E0B', code: 'GLD' },
  { name: 'Plateado',    hex: '#C0C0C0', code: 'SLV' },
  { name: 'Multicolor',  hex: '#FF6B6B', code: 'MUL' },
];

/** Lista plana de nombres de color (para compatibilidad) */
export const COLOR_NAMES: string[] = COLOR_OPTIONS.map(c => c.name);

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS DE VARIANTE (SizeType) — sincronizados con el enum del backend
// Usar el campo `value` (string) al enviar al API — son los únicos aceptados.
// ─────────────────────────────────────────────────────────────────────────────

export type VariantSizeType =
  // Ropa adulto
  | 'clothing'       // XS / S / M / L / XL / XXL / XXXL
  | 'clothing_num'   // 36 / 38 / 40 / 42 (talla numérica Europa)
  | 'clothing_kids'  // 2T / 4 / 6 / 8 / 10 / 12 / 14 / 16 años
  // Calzado
  | 'footwear'       // 36 / 37 … 46 (region: EU / US / UK / CM)
  // Moda / Accesorios
  | 'bra'            // 32A / 34B / 36C / 38D
  | 'ring'           // 6 / 7 / 8 / 9 (US)
  | 'belt'           // 28 / 30 / 32 o S / M / L
  | 'hat'            // 54 / 56 / 58 cm o S / M / L
  // Electrónicos
  | 'screen'         // pulgadas: 13.3" / 15.6" / 27"
  | 'storage'        // GB / TB: "256GB" / "1TB"
  // Hogar / Muebles
  | 'bed_size'       // twin / full / queen / king — o plazas
  | 'diameter_cm'    // ollas, sartenes, relojes (cm)
  | 'area'           // alfombras, cortinas: "140x200 cm"
  // Automotriz
  | 'tire'           // neumáticos: "205/55 R16"
  // Capacidad / Volumen
  | 'volume_l'       // litros: botellas, mochilas, lavadoras
  | 'volume_ml'      // mililitros: perfumes, cremas
  // Peso del producto
  | 'weight_net'     // alimentos, suplementos: "500g" / "1kg"
  // Libros / Papelería
  | 'pages'          // número de páginas
  // Medidas físicas
  | 'dimensions'     // largo × ancho × alto (usa campos del schema)
  // Genérico
  | 'one_size'       // talla única
  | 'custom';        // formato libre — el vendedor define el valor

export interface VariantTypeOption {
  value: VariantSizeType;
  label: string;
  placeholder: string;
  unit?: string;
  requiresDimensions: boolean;
}

export const VARIANT_TYPE_OPTIONS: VariantTypeOption[] = [
  // ── Ropa ────────────────────────────────────────────────────────────────
  { value: 'clothing',       label: '👕 Ropa adulto (XS–XXXL)',        placeholder: 'M',           requiresDimensions: false },
  { value: 'clothing_num',   label: '👔 Ropa numérica (36–48)',         placeholder: '40',          requiresDimensions: false },
  { value: 'clothing_kids',  label: '🧒 Ropa niños (2T–16)',            placeholder: '8',           requiresDimensions: false },
  // ── Calzado ─────────────────────────────────────────────────────────────
  { value: 'footwear',       label: '👟 Calzado (36–46)',               placeholder: '38',          requiresDimensions: false },
  // ── Moda / Accesorios ───────────────────────────────────────────────────
  { value: 'bra',            label: '👙 Brasier (32A–38D)',             placeholder: '34B',         requiresDimensions: false },
  { value: 'ring',           label: '� Anillo (US 6–9)',               placeholder: '7',           requiresDimensions: false },
  { value: 'belt',           label: '👑 Cinturón (pulgadas o S/M/L)',   placeholder: '32',          requiresDimensions: false },
  { value: 'hat',            label: '🎩 Sombrero / Gorra (cm)',         placeholder: '58',          requiresDimensions: false },
  // ── Electrónicos ────────────────────────────────────────────────────────
  { value: 'screen',         label: '📺 Pantalla (pulgadas)',           placeholder: '55"',         unit: '"',   requiresDimensions: false },
  { value: 'storage',        label: '💾 Almacenamiento (GB / TB)',      placeholder: '256GB',       requiresDimensions: false },
  // ── Hogar / Muebles ─────────────────────────────────────────────────────
  { value: 'bed_size',       label: '🛏️ Cama / Sillón (plazas)',       placeholder: '2 plazas',    requiresDimensions: false },
  { value: 'diameter_cm',    label: '⌀ Diámetro (cm)',                  placeholder: '28cm',        unit: 'cm',  requiresDimensions: false },
  { value: 'area',           label: '� Área (L×A cm)',                 placeholder: '140x200 cm',  requiresDimensions: false },
  // ── Automotriz ──────────────────────────────────────────────────────────
  { value: 'tire',           label: '🚗 Neumático (perfil)',            placeholder: '205/55 R16',  requiresDimensions: false },
  // ── Volumen / Capacidad ─────────────────────────────────────────────────
  { value: 'volume_l',       label: '🧴 Volumen en litros (L)',         placeholder: '2L',          unit: 'L',   requiresDimensions: false },
  { value: 'volume_ml',      label: '� Volumen en mililitros (mL)',    placeholder: '200mL',       unit: 'mL',  requiresDimensions: false },
  // ── Peso neto ───────────────────────────────────────────────────────────
  { value: 'weight_net',     label: '⚖️ Peso neto (g / kg)',           placeholder: '500g',        requiresDimensions: false },
  // ── Libros ──────────────────────────────────────────────────────────────
  { value: 'pages',          label: '📚 Páginas',                      placeholder: '342',         requiresDimensions: false },
  // ── Medidas físicas ─────────────────────────────────────────────────────
  { value: 'dimensions',     label: '📦 Dimensiones (L×W×H)',           placeholder: 'ver campos',  requiresDimensions: true  },
  // ── Genérico ────────────────────────────────────────────────────────────
  { value: 'one_size',       label: '🔘 Talla única',                  placeholder: 'One Size',    requiresDimensions: false },
  { value: 'custom',         label: '✏️ Personalizado',                  placeholder: 'valor libre', requiresDimensions: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// TALLAS PREDEFINIDAS POR TIPO (botones de selección rápida en el formulario)
// ─────────────────────────────────────────────────────────────────────────────

export const TALLAS_CLOTHING:      string[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
export const TALLAS_CLOTHING_NUM:  string[] = ['34', '36', '38', '40', '42', '44', '46', '48'];
export const TALLAS_CLOTHING_KIDS: string[] = ['2T', '3T', '4T', '6', '8', '10', '12', '14', '16'];
export const TALLAS_CALZADO:       string[] = ['33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'];
export const TALLAS_CALZADO_US:    string[] = ['5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '12'];
export const TALLAS_BRA:           string[] = ['32A', '32B', '34A', '34B', '34C', '36A', '36B', '36C', '36D', '38B', '38C', '38D'];
export const TALLAS_SCREEN:        string[] = ['14"', '15.6"', '17"', '21.5"', '24"', '27"', '32"', '43"', '50"', '55"', '65"', '75"'];
export const TALLAS_STORAGE:       string[] = ['64GB', '128GB', '256GB', '512GB', '1TB', '2TB', '4TB'];
export const TALLAS_BED_SIZE:      string[] = ['1 plaza', '1.5 plazas', '2 plazas', '2.5 plazas', '3 plazas', 'Twin', 'Full', 'Queen', 'King'];
export const TALLAS_VOLUME_L:      string[] = ['0.5L', '1L', '1.5L', '2L', '3L', '5L', '8L', '10L', '15L', '20L', '50L'];
export const TALLAS_VOLUME_ML:     string[] = ['30mL', '50mL', '100mL', '150mL', '200mL', '250mL', '500mL', '750mL', '1000mL'];

/** Alias para compatibilidad con código anterior */
export const TALLAS_ROPA = TALLAS_CLOTHING;

/**
 * Mapa de acceso rápido: VariantSizeType → tallas predefinidas.
 * Array vacío = el usuario escribe manualmente.
 */
export const TALLAS_POR_TIPO: Record<VariantSizeType, string[]> = {
  clothing:       TALLAS_CLOTHING,
  clothing_num:   TALLAS_CLOTHING_NUM,
  clothing_kids:  TALLAS_CLOTHING_KIDS,
  footwear:       TALLAS_CALZADO,
  bra:            TALLAS_BRA,
  ring:           ['5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10'],
  belt:           ['28', '30', '32', '34', '36', '38', '40', 'S', 'M', 'L', 'XL'],
  hat:            ['54', '56', '57', '58', '59', '60', '61', '62', 'S', 'M', 'L', 'XL'],
  screen:         TALLAS_SCREEN,
  storage:        TALLAS_STORAGE,
  bed_size:       TALLAS_BED_SIZE,
  diameter_cm:    ['20', '22', '24', '26', '28', '30', '32', '36', '40', '42'],
  area:           [],
  tire:           [],
  volume_l:       TALLAS_VOLUME_L,
  volume_ml:      TALLAS_VOLUME_ML,
  weight_net:     ['50g', '100g', '250g', '500g', '750g', '1kg', '2kg', '5kg'],
  pages:          [],
  dimensions:     TALLAS_CLOTHING,  // Para dimensiones se usan tallas de ropa como referencia
  one_size:       ['One Size'],
  custom:         [],
};

// ─────────────────────────────────────────────────────────────────────────────
// UNIDADES — sincronizadas con WeightUnit / LengthUnit / VolumeUnit del backend
// ─────────────────────────────────────────────────────────────────────────────

export type WeightUnit  = 'kg' | 'g' | 'mg' | 'lb' | 'oz';
export type LengthUnit  = 'cm' | 'mm' | 'm' | 'in' | 'ft';
export type VolumeUnit  = 'L'  | 'mL' | 'fl_oz' | 'gal' | 'm3';

export const WEIGHT_UNITS:  WeightUnit[]  = ['kg', 'g', 'mg', 'lb', 'oz'];
export const LENGTH_UNITS:  LengthUnit[]  = ['cm', 'mm', 'm', 'in', 'ft'];
export const VOLUME_UNITS:  VolumeUnit[]  = ['L', 'mL', 'fl_oz', 'gal', 'm3'];

// Compatibilidad con código anterior
export const UNIDAD_OPTIONS: string[] = ['kg', 'g', 'mg', 'lb', 'oz'];

// ─────────────────────────────────────────────────────────────────────────────
// DIMENSIONES FÍSICAS (para type = 'dimensions')
// ─────────────────────────────────────────────────────────────────────────────

export interface DimensionsDto {
  length?: number;
  width?:  number;
  height?: number;
  unit?:   LengthUnit;   // default: 'cm'
  weight?: { value: number; unit: WeightUnit };
}



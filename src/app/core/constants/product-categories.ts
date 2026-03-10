/**
 * Product Categories for E-commerce Store
 * Professional design with SVG icon references
 */

export interface Category {
    id: string;
    name: string;
    icon: string; // SVG path or icon identifier
    subcategories?: Subcategory[];
}

export interface Subcategory {
    id: string;
    name: string;
    parentId: string;
}

export const PRODUCT_CATEGORIES: Category[] = [
    {
        id: 'all',
        name: 'Todos los productos',
        icon: 'grid'
    },
    {
        id: 'electronics',
        name: 'Electrónica',
        icon: 'desktop',
        subcategories: [
            { id: 'laptops', name: 'Laptops', parentId: 'electronics' },
            { id: 'smartphones', name: 'Smartphones', parentId: 'electronics' },
            { id: 'tablets', name: 'Tablets', parentId: 'electronics' },
            { id: 'accessories', name: 'Accesorios', parentId: 'electronics' }
        ]
    },
    {
        id: 'fashion',
        name: 'Moda',
        icon: 'shopping-bag',
        subcategories: [
            { id: 'men', name: 'Hombre', parentId: 'fashion' },
            { id: 'women', name: 'Mujer', parentId: 'fashion' },
            { id: 'kids', name: 'Niños', parentId: 'fashion' },
            { id: 'shoes', name: 'Calzado', parentId: 'fashion' }
        ]
    },
    {
        id: 'home',
        name: 'Hogar y Cocina',
        icon: 'home',
        subcategories: [
            { id: 'furniture', name: 'Muebles', parentId: 'home' },
            { id: 'kitchen', name: 'Cocina', parentId: 'home' },
            { id: 'decor', name: 'Decoración', parentId: 'home' },
            { id: 'appliances', name: 'Electrodomésticos', parentId: 'home' }
        ]
    },
    {
        id: 'sports',
        name: 'Deportes y Fitness',
        icon: 'trophy',
        subcategories: [
            { id: 'gym', name: 'Gimnasio', parentId: 'sports' },
            { id: 'outdoor', name: 'Aire libre', parentId: 'sports' },
            { id: 'sportswear', name: 'Ropa deportiva', parentId: 'sports' }
        ]
    },
    {
        id: 'beauty',
        name: 'Belleza y Cuidado Personal',
        icon: 'sparkles',
        subcategories: [
            { id: 'skincare', name: 'Cuidado de la piel', parentId: 'beauty' },
            { id: 'makeup', name: 'Maquillaje', parentId: 'beauty' },
            { id: 'haircare', name: 'Cuidado del cabello', parentId: 'beauty' }
        ]
    },
    {
        id: 'toys',
        name: 'Juguetes y Juegos',
        icon: 'puzzle',
        subcategories: [
            { id: 'videogames', name: 'Videojuegos', parentId: 'toys' },
            { id: 'board-games', name: 'Juegos de mesa', parentId: 'toys' },
            { id: 'toys-kids', name: 'Juguetes para niños', parentId: 'toys' }
        ]
    },
    {
        id: 'books',
        name: 'Libros',
        icon: 'book',
        subcategories: [
            { id: 'fiction', name: 'Ficción', parentId: 'books' },
            { id: 'non-fiction', name: 'No ficción', parentId: 'books' },
            { id: 'educational', name: 'Educativos', parentId: 'books' }
        ]
    },
    {
        id: 'automotive',
        name: 'Automotriz',
        icon: 'truck',
        subcategories: [
            { id: 'parts', name: 'Repuestos', parentId: 'automotive' },
            { id: 'accessories-auto', name: 'Accesorios', parentId: 'automotive' },
            { id: 'tools', name: 'Herramientas', parentId: 'automotive' }
        ]
    }
];

// Price ranges for filters
export const PRICE_RANGES = [
    { id: 'all', label: 'Todos los precios', min: 0, max: Infinity },
    { id: 'under-50', label: 'Menos de S/ 50', min: 0, max: 50 },
    { id: '50-100', label: 'S/ 50 - S/ 100', min: 50, max: 100 },
    { id: '100-200', label: 'S/ 100 - S/ 200', min: 100, max: 200 },
    { id: '200-500', label: 'S/ 200 - S/ 500', min: 200, max: 500 },
    { id: 'over-500', label: 'Más de S/ 500', min: 500, max: Infinity }
];

// Sort options
export const SORT_OPTIONS = [
    { id: 'newest', label: 'Más recientes', icon: 'clock' },
    { id: 'popular', label: 'Más populares', icon: 'fire' },
    { id: 'price-asc', label: 'Precio: menor a mayor', icon: 'arrow-up' },
    { id: 'price-desc', label: 'Precio: mayor a menor', icon: 'arrow-down' }
];

// Rating filter
export const RATING_OPTIONS = [
    { stars: 5, label: '5 estrellas' },
    { stars: 4, label: '4 estrellas o más' },
    { stars: 3, label: '3 estrellas o más' },
    { stars: 2, label: '2 estrellas o más' }
];

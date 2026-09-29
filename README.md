# 🛒 MooreaA20 — E-Commerce Frontend (Angular 20)

> Plataforma web de comercio electrónico y gestión empresarial construida con **Angular 20**, **TailwindCSS v4**, arquitectura de componentes Standalone y soporte integral para pasarela de pagos con **Izipay**, gestión logística de picking en almacén y notificaciones automatizadas.

[![Angular](https://img.shields.io/badge/Angular-20.3-DD0031?style=for-the-badge&logo=angular&logoColor=white)](https://angular.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.0-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Izipay](https://img.shields.io/badge/Payments-Izipay_Gateway-0099FF?style=for-the-badge)](https://www.izipay.pe/)
[![Cloudinary](https://img.shields.io/badge/Images-Cloudinary-3448C5?style=for-the-badge&logo=cloudinary&logoColor=white)](https://cloudinary.com/)

---

## 📌 Tabla de Contenidos

1. [Características Principales](#-características-principales)
2. [Arquitectura y Tecnologías](#-arquitectura-y-tecnologías)
3. [Módulos del Sistema](#-módulos-del-sistema)
   - [Tienda Pública y Catálogo (Storefront)](#1-tienda-pública-y-catálogo-storefront)
   - [Flujo de Checkout y Pagos](#2-flujo-de-checkout-y-pagos)
   - [Panel de Negocio y Operaciones Logísticas](#3-panel-de-negocio-y-operaciones-logísticas-business)
   - [Portal de Cliente (Mi Cuenta)](#4-portal-de-cliente-mi-cuenta)
4. [Instalación y Ejecución](#-instalación-y-ejecución)
5. [Variables de Entorno](#-variables-de-entorno)
6. [Estructura del Proyecto](#-estructura-del-proyecto)
7. [Scripts Disponibles](#-scripts-disponibles)
8. [Integración con Backend (MooreaN10)](#-integración-con-backend-moorean10)

---

## ✨ Características Principales

- **Diseño Luxury Minimalista**: Interfaz pulida estilo editorial tipo Zara con paleta monocromática (*Obsidian & Slate*), micro-animaciones fluidas y tipografía moderna.
- **Catálogo Dinámico e Interactivo**:
  - Vista en cuadrícula responsiva a pantalla completa con selector de columnas y barra de filtros horizontales.
  - Páginas de Detalle de Producto (PDP) con galería fotográfica interactiva, miniaturas ampliables (*lightbox zoom*), variantes de color/talla y stock en tiempo real por sucursal física.
  - Barra dinámica de meta para envío gratis (umbral de **S/ 500.00** con indicador visual en 3 etapas).
- **Proceso de Checkout Unificado en 4 Pasos**:
  1. Identificación y contacto (validación estricta de teléfono obligatorio y documento de identidad).
  2. Modalidad de entrega (Envío a domicilio vs. Retiro en sucursal física de Perú).
  3. Método de pago (Tarjeta Online con Izipay, Tarjetas guardadas en 1 clic, Billetera Digital Yape QR y Contraentrega).
  4. Revisión y confirmación de la orden con desglose tributario y facturación.
- **Simulador de Sandbox para Tarjetas Izipay**: Panel colapsable de pruebas para simular autorizaciones exitosas, fondos insuficientes, tarjetas bloqueadas o desafíos 3D Secure.
- **Centro de Operaciones y Logística Empresarial**:
  - Control integral del ciclo de vida de pedidos: `pending` ➔ `paid` ➔ `preparing` ➔ `ready_for_pickup` / `shipped` ➔ `delivered` / `cancelled`.
  - **Checklist de Picking Obligatorio**: Sistema de verificación de prendas en mesa de empaque con barra de progreso. Impide marcar como "Listo en Tienda" o "Despachado" si faltan productos por chequear.
  - Modal de validación de entrega con código alfanumérico seguro para retiros en tienda.
  - Generación de **Reportes Corporativos Oficiales en PDF** (formato monocromático de alta fidelidad, resumen financiero, checklist de almacén y doble bloque de firmas físicas).
- **Gestión Avanzada de Catálogo e Inventario**:
  - Diseñador visual de variantes por matriz (SKU, talla, color, precios, stock por tienda).
  - Creador Masivo de Productos (`bulk-product-creator`) con subida por lotes a Cloudinary y previsualización jerárquica.
  - Administración de sucursales físicas con geolocalización y cobertura por distritos/departamentos del Perú.

---

## 🛠️ Arquitectura y Tecnologías

| Componente | Tecnología | Descripción |
|---|---|---|
| **Framework** | Angular 20 (20.3.x) | Componentes Standalone, nuevo Control Flow (`@if`, `@for`), Signals y OnPush |
| **Estilos** | TailwindCSS v4 | Utility-first CSS moderno sin dependencias pesadas y variables CSS nativas |
| **Pasarela de Pagos** | Izipay Embedded / REST | Tokenización de tarjetas, pagos 3DS, pagos directos con tarjetas guardadas |
| **Generación PDF** | jsPDF + AutoTable | Motor de documentos vectoriales para hojas de picking, comprobantes y firmas |
| **Media & CDN** | Cloudinary | Optimización on-the-fly (`f_auto,q_auto`), recorte inteligente y carga diferida |
| **Códigos QR** | qrcode | Generación dinámica de QR para validación de retiro en tienda y comprobantes |
| **Tipado** | TypeScript 5.8 | Tipado estricto en modelos de datos de dominio y contratos de API |

---

## 📦 Módulos del Sistema

### 1. Tienda Pública y Catálogo (Storefront)
- **Home & Banner Principal**: Destacados de temporada y accesos rápidos a colecciones.
- **Catálogo de Productos (`/store`)**:
  - Búsqueda en tiempo real con resaltado de coincidencias.
  - Filtros por categoría, rango de precios, color y disponibilidad de stock.
  - Ordenamiento por novedades, mayor/menor precio y popularidad.
- **Ficha de Producto (`/store/product/:slug`)**:
  - Galería con zoom interactivo y visor a pantalla completa.
  - Selector de variantes vinculado dinámicamente al stock disponible.
  - Barra de progreso para meta de envío gratuito (S/ 500).
- **Cesta de Compras Desplegable (Slide-Over Basket)**:
  - Edición rápida de cantidades con validación de inventario en tiempo real.
  - Resumen de subtotales, costo de envío y cálculo de ahorro por promociones.

### 2. Flujo de Checkout y Pagos
- **Ruta `/checkout`**:
  - Formulario reactivo paso a paso con persistencia de estado y prevención de abandono involuntario.
  - **Fulfillment**: Retiro en tienda física (selección de sucursal) o Envío a domicilio con direcciones guardadas.
  - **Métodos de Pago**:
    - **Izipay Online**: Formulario embebido de tarjeta con detección automática de franquicia (Visa, Mastercard, Amex, Diners) y cuotas.
    - **Tarjetas Guardadas**: Cobro directo en un clic para usuarios autenticados.
    - **Yape / Billetera Digital**: Generación de QR con referencia de orden.
    - **Pago Contraentrega**: Para clientes y zonas habilitadas.

### 3. Panel de Negocio y Operaciones Logísticas (`/business`)
- **Panel de Órdenes (`/business/orders`)**:
  - Pestañas organizadas por estado logístico (*Pendientes, En Preparación, Listos para Retiro, En Camino, Entregados*).
  - Filtros rápidos por número de factura/boleta, cliente y rango de fechas.
  - Acciones contextuales con permisos basados en roles (*Admin, Seller, Worker*).
- **Mesa de Preparación y Picking (`/business/orders/:id`)**:
  - Hoja de recolección de prendas en almacén con miniatura ampliable.
  - **Guardia de Seguridad de Picking**: Impide despachar o completar pedidos sin verificación física previa de cada ítem.
  - Botón de atajo para marcar todas las prendas con un solo clic una vez revisadas.
  - Modal de validación de entrega con código de seguridad alfanumérico.
  - Descarga de **Reporte Oficial de Picking y Despacho en PDF** monocromático corporativo.
- **Gestor de Catálogo y Variantes (`/business/products`, `/business/catalog`)**:
  - Editor modal de variantes con asignación de SKU, stock individual y fotos por color.
  - Creador Masivo de Productos con validación de metadatos e importación por lotes.
- **Administración de Sucursales (`/business/stores`)**:
  - Registro de tiendas físicas, horarios de atención, teléfonos de contacto y direcciones normalizadas.

### 4. Portal de Cliente (Mi Cuenta)
- Historial completo de compras con línea de tiempo interactiva.
- Descarga de comprobantes digitales y código de retiro para recojo presencial.
- Libreta de direcciones de envío frecuentes y gestión de perfil personal.

---

## 🚀 Instalación y Ejecución

### Prerrequisitos
- **Node.js**: `>= 20.x`
- **npm**: `>= 10.x`
- **Angular CLI**: `npm install -g @angular/cli@20`

### Pasos de Instalación

1. Clonar el repositorio:
   ```bash
   git clone https://github.com/NicklausRueditas/MooreaA20.git
   cd MooreaA20
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Iniciar el servidor de desarrollo:
   ```bash
   npm start
   # o alternativamente: ng serve
   ```

4. Abrir en el navegador:
   ```
   http://localhost:4200/
   ```

---

## ⚙️ Variables de Entorno

Configura el archivo `src/environments/environment.ts` para desarrollo local:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000',
  cloudinaryCloudName: 'tu-cloud-name',
  izipayPublicKey: 'tu-public-key-izipay'
};
```

Para despliegues de producción, define los valores en `src/environments/environment.prod.ts`.

---

## 📂 Estructura del Proyecto

```
src/
├── app/
│   ├── core/                          # Servicios singleton, interceptores y modelos
│   │   ├── constants/                 # Constantes de negocio (colores, tallas, opciones)
│   │   ├── guards/                    # Protección de rutas por roles (auth, business)
│   │   ├── interceptors/             # Inyección de JWT y manejo global de errores HTTP
│   │   ├── models/                    # Interfaces de dominio (Order, Product, User, etc.)
│   │   ├── pipes/                     # Pipes utilitarios (Cloudinary, SolCurrency)
│   │   └── services/                  # Servicios de comunicación con la API y UI
│   │       ├── api/                   # Servicios REST por recurso
│   │       └── ui/                    # Reportes PDF, modales y notificaciones toast
│   ├── website/                       # Páginas y vistas de la aplicación
│   │   ├── auth/                      # Login, registro y recuperación de contraseña
│   │   ├── business/                  # Panel administrativo y operativo
│   │   │   ├── catalog/               # Gestión de catálogo y creador masivo
│   │   │   ├── components/            # Header corporativo y navegación ejecutiva
│   │   │   ├── orders/                # Tablero de órdenes y mesa de picking
│   │   │   ├── products/              # Editor de productos y variantes
│   │   │   ├── stores/                # Administración de sucursales físicas
│   │   │   └── users/                 # Gestión de colaboradores y permisos
│   │   └── public/                    # Vistas accesibles al cliente final
│   │       ├── checkout/              # Proceso de compra en 4 pasos e Izipay
│   │       ├── my-account/            # Perfil y seguimiento de compras del usuario
│   │       └── store/                 # Catálogo, PDP y canasta de compras
│   └── shared/                        # Componentes UI reutilizables (botones, modales, spinners)
├── environments/                      # Entornos de desarrollo y producción
└── styles.css                         # Configuración y directivas de TailwindCSS v4
```

---

## 📜 Scripts Disponibles

```bash
# Servidor local de desarrollo
npm start

# Compilación para producción (artefactos optimizados en dist/)
npm run build

# Verificación de tipos estricta sin emitir archivos
npx tsc --noEmit

# Ejecución de pruebas unitarias
npm test
```

---

## 🔗 Integración con Backend (MooreaN10)

Este frontend se comunica directamente con la API REST de **MooreaN10** (desarrollada en NestJS).

- **URL Base:** `http://localhost:3000`
- **Contrato de Endpoints:** [`api-requests.http`](./api-requests.http)
- **Autenticación:** Cabecera `Authorization: Bearer <token_jwt>` gestionada de forma transparente por el interceptor `AuthInterceptor`.

---

© 2026 **Moorea**. Todos los derechos reservados.

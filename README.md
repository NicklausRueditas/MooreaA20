# 🛒 MooreaA20 — Tienda Virtual (Frontend Angular)

> Frontend de la Tienda Virtual construido con **Angular 20**, **TailwindCSS v4** y soporte para pagos con **Izipay**.

---

## 🚀 Inicio rápido

### Servidor de desarrollo

```bash
npm start          # equivalente a: ng serve
```

Navega a `http://localhost:4200/`. La aplicación se recarga automáticamente cuando modificas los archivos fuente.

### Build de producción

```bash
npm run build      # artefactos en dist/
```

---

## 📡 API — Backend REST

- **Base URL:** `http://localhost:3000`
- **Autenticación:** JWT Bearer Token
- **Fuente real de endpoints:** [`api-requests.http`](./api-requests.http)

El archivo `api-requests.http` es el **contrato vivo** entre frontend y backend. Contiene todos los endpoints agrupados por módulo:

| Módulo | Prefijo |
|---|---|
| Auth | `/auth` |
| Sesión (perfil usuario) | `/sesion` |
| Gestión usuarios (admin) | `/manage` |
| Productos maestros | `/product` |
| Variantes de producto | `/product-variants` |
| Inventario | `/inventory` |
| Reseñas | `/reviews` |
| Carrito | `/basket` |
| Órdenes + Izipay | `/orders` |
| Direcciones | `/addresses` |
| Imágenes (Cloudinary) | `/image` |
| Tiendas | `/stores` |
| Tarjetas | `/cards` |
| Configuración | `/config` |

> ⚠️ Siempre verifica `api-requests.http` antes de implementar o modificar llamadas HTTP en los servicios Angular.

---

## 🧪 Pruebas

```bash
npm test           # Unit tests con Karma/Jasmine
ng e2e             # E2E (requiere instalar un runner)
```

---

## 🐳 Docker

```bash
# Desarrollo
docker-compose up

# Producción
docker-compose -f docker-compose.prod.yml up
```

Ver [`DOCKER_README.md`](./DOCKER_README.md) para más detalles.

---

## 🛠️ Angular CLI — Scaffolding útil

```bash
ng generate component components/mi-componente
ng generate service services/mi-servicio
ng generate interface models/mi-modelo
```

Para más ayuda: `ng help` o [Angular CLI Docs](https://angular.dev/tools/cli).

---

## 📁 Estructura relevante

```
src/
├── app/
│   ├── core/          # Guards, interceptors, modelos
│   ├── features/      # Módulos por funcionalidad
│   └── shared/        # Componentes y pipes reutilizables
├── environments/      # Configuración por ambiente
└── styles.css         # Estilos globales (TailwindCSS v4)
```

---

## 🔑 Variables de entorno

Configura `src/environments/environment.ts` con la URL de la API:

```ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000'
};
```

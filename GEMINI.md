# GEMINI.md — Reglas del proyecto Angular17 (Tienda Virtual)

## 🔌 API: Consultar `api-requests.http` PRIMERO

> **IMPORTANTE**: Antes de hacer cualquier llamada HTTP al backend, **verificar el archivo `api-requests.http`** en la raíz del proyecto.
> Contiene todos los endpoints documentados con sus métodos, rutas, headers y body de ejemplo.

### Por qué es obligatorio:

- Cada recurso puede tener **múltiples variantes** del mismo endpoint (ej: soft delete vs hard delete).
- Los endpoints **NO son intuitivos** — ejemplo clásico:
  - `DELETE /product-variants/:id` → **soft delete** (el SKU permanece en DB)
  - `DELETE /product-variants/:id/hard` → **hard delete** (libera el SKU permanentemente)
- Base URL: `http://localhost:3000` (definida en `@baseUrl` dentro del .http)

---

## 🏗️ Arquitectura del frontend

- **Framework**: Angular 17 con componentes standalone
- **Estilos**: Tailwind CSS
- **Control de formularios**: ReactiveFormsModule (`FormGroup`, `FormBuilder`)
- **HTTP**: `HttpClient` vía servicios en `src/app/core/services/`
- **Routing**: Lazy loading con `loadComponent`

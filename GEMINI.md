# GEMINI.md — Instrucciones para el Agente AI

Este archivo contiene reglas y contexto que el agente AI (Gemini / Antigravity) **debe seguir siempre** al trabajar en este proyecto.

---

## 📡 Regla fundamental — Fuente real de endpoints
 
> **OBLIGATORIO:** Antes de implementar, modificar o revisar cualquier llamada HTTP en los servicios Angular, el agente **DEBE** leer y verificar los archivos correspondientes dentro de la carpeta [`../MooreaN10/api-requests/`](../MooreaN10/api-requests/).
 
### ¿Por qué?
 
Los archivos `.http` dentro de `MooreaN10/api-requests/` (`orders.http`, `products.http`, `auth.http`, `whatsapp.http`, `stores.http`, etc.) representan el **contrato vivo y modular** entre el frontend Angular y el backend NestJS. Son la única fuente de verdad para:
 
- Rutas exactas de cada endpoint (`baseUrl`, prefijos, parámetros de ruta)
- Métodos HTTP correctos (`GET`, `POST`, `PATCH`, `DELETE`, `OPTIONS`, etc.)
- Estructura del body (JSON schema de request)
- Headers requeridos (`Authorization: Bearer {{token}}`, `Content-Type`, etc.)
- Parámetros de query (`page`, `limit`, `storeId`, `status`, etc.)
- Flujos de negocio documentados (p.ej. flujo de pago con Izipay, picking, retiros en tienda)


# GEMINI.md — Instrucciones para el Agente AI

Este archivo contiene reglas y contexto que el agente AI (Gemini / Antigravity) **debe seguir siempre** al trabajar en este proyecto.

---

## 📡 Regla fundamental — Fuente real de endpoints

> **OBLIGATORIO:** Antes de implementar, modificar o revisar cualquier llamada HTTP en los servicios Angular, el agente **DEBE** leer y verificar el archivo [`api-requests.http`](./api-requests.http).

### ¿Por qué?

`api-requests.http` es el **contrato vivo** entre el frontend Angular y el backend NestJS. Es la única fuente de verdad para:

- Rutas exactas de cada endpoint (`baseUrl`, prefijos, parámetros de ruta)
- Métodos HTTP correctos (`GET`, `POST`, `PATCH`, `DELETE`)
- Estructura del body (JSON schema de request)
- Headers requeridos (`Authorization: Bearer {{token}}`, `Content-Type`)
- Parámetros de query (`page`, `limit`, `storeId`, `status`, etc.)
- Flujos de negocio documentados (p.ej. flujo de pago con Izipay)


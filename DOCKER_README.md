# Docker Setup para Angular 17 (Angular 19.1.6)

Este proyecto está configurado para ejecutarse con Docker usando Node.js 22 Alpine.

## 📋 Requisitos

- Docker instalado
- Docker Compose instalado

## 🚀 Inicio Rápido

### Desarrollo

```bash
# Construir e iniciar el contenedor de desarrollo
docker-compose up

# O en modo detached (segundo plano)
docker-compose up -d

# Ver logs
docker-compose logs -f
```

La aplicación estará disponible en: **http://localhost:4200**

### Producción

```bash
# Construir e iniciar el contenedor de producción
docker-compose -f docker-compose.prod.yml up --build

# O en modo detached
docker-compose -f docker-compose.prod.yml up -d
```

La aplicación estará disponible en: **http://localhost:80**

## 🛠️ Comandos Útiles

### Reconstruir imagen

```bash
# Desarrollo
docker-compose build --no-cache

# Producción
docker-compose -f docker-compose.prod.yml build --no-cache
```

### Detener contenedores

```bash
# Desarrollo
docker-compose down

# Producción
docker-compose -f docker-compose.prod.yml down
```

### Ejecutar comandos dentro del contenedor

```bash
# Entrar al contenedor
docker-compose exec angular-dev sh

# Ejecutar tests
docker-compose exec angular-dev npm test

# Instalar nueva dependencia
docker-compose exec angular-dev npm install <paquete>
```

### Limpiar todo

```bash
# Detener y eliminar contenedores, redes, volúmenes
docker-compose down -v

# Eliminar imágenes
docker rmi angular17-app angular17-deps angular17-build
```

## 📁 Estructura de Archivos Docker

- **Dockerfile**: Configuración multi-stage para desarrollo y producción
- **docker-compose.yml**: Configuración para entorno de desarrollo
- **docker-compose.prod.yml**: Configuración para entorno de producción
- **.dockerignore**: Archivos excluidos del contexto de Docker
- **nginx.conf**: Configuración de Nginx para producción

## 🔧 Configuración

### Variables de Entorno

Puedes agregar variables de entorno en los archivos `docker-compose.yml`:

```yaml
environment:
  - NODE_ENV=development
  - API_URL=http://localhost:3000
```

### Puertos

- **Desarrollo**: 4200
- **Producción**: 80

Para cambiar los puertos, edita los archivos `docker-compose.yml` o `docker-compose.prod.yml`:

```yaml
ports:
  - "8080:4200"  # <puerto-host>:<puerto-contenedor>
```

## 📦 Dependencias

Las dependencias se instalan usando `npm ci --legacy-peer-deps` para garantizar instalaciones reproducibles basadas en `package-lock.json`.

### Versiones Principales

- **Angular**: 19.1.6
- **Node.js**: 22 (Alpine)
- **TypeScript**: 5.7.3
- **Tailwind CSS**: 4.0.6
- **RxJS**: 7.8.1

## 🐛 Solución de Problemas

### El contenedor no inicia

```bash
# Ver logs detallados
docker-compose logs

# Verificar estado
docker-compose ps
```

### Cambios en el código no se reflejan

```bash
# Reconstruir sin caché
docker-compose build --no-cache
docker-compose up
```

### Error de permisos en node_modules

```bash
# Eliminar volumen y reconstruir
docker-compose down -v
docker-compose up --build
```

### Build de producción falla

Si el build de producción falla debido a errores de CSS con Tailwind 4.0, puedes:

1. **Opción 1**: Ejecutar el build localmente primero
   ```bash
   npm install
   npm run build
   docker-compose -f docker-compose.prod.yml up
   ```

2. **Opción 2**: Usar una versión anterior de Tailwind
   ```bash
   npm install tailwindcss@3.4.1 @tailwindcss/postcss@3.4.1
   ```

## 📝 Notas

- El modo desarrollo usa hot-reload para reflejar cambios automáticamente
- Los `node_modules` se mantienen en un volumen separado para mejor rendimiento
- La imagen de producción usa Nginx para servir archivos estáticos optimizados
- El Dockerfile usa multi-stage builds para reducir el tamaño final de la imagen

## 🔒 Seguridad

La configuración de Nginx incluye:
- Headers de seguridad (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection)
- Compresión Gzip habilitada
- Caché optimizado para assets estáticos
- Soporte para rutas de Angular SPA

## 📚 Recursos

- [Documentación de Angular](https://angular.dev)
- [Documentación de Docker](https://docs.docker.com)
- [Tailwind CSS](https://tailwindcss.com)

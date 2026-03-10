# 🔍 Diagnóstico del Problema del Carrito

## Problema Identificado

El carrito no se carga aunque hay datos en la base de datos.

## Análisis del Flujo

### 1. BasketComponent (basket.component.ts)
```typescript
ngOnInit(): void {
  this.loadBasketData();
}

private loadBasketData(): void {
  this.basketService.basket$
    .pipe(takeUntil(this.destroy$))
    .subscribe((basket) => {
      this.basket = basket;
      // ...
    });
}
```
✅ **Correcto**: Se suscribe a `basket$` observable

---

### 2. BasketService (basket.service.ts)

#### Inicialización
```typescript
constructor() {
  this.initializeBasket(); // ← Se ejecuta al crear el servicio
}

private initializeBasket(): void {
  this.sesionService.user$
    .pipe(
      switchMap((user) => {
        if (user) {
          return this.loadBackendBasket().pipe(
            switchMap(() => this.migrateLocalBasketIfExists())
          );
        } else {
          return this.loadLocalBasket();
        }
      })
    )
    .subscribe();
}
```

#### Carga desde Backend
```typescript
private loadBackendBasket(): Observable<Basket> {
  return this.http.get<Basket>(`${this.apiUrl}/init`).pipe(
    tap((basket) => {
      this.applyBasket(basket, false);
    }),
    catchError((error) => {
      console.error('Error al cargar carrito del backend:', error);
      this.applyBasket(null, true);
      return EMPTY;
    })
  );
}
```

⚠️ **PROBLEMA POTENCIAL**: Depende de `sesionService.user$`

---

### 3. SesionService (sesion.service.ts)

```typescript
constructor() {
  const token = this.authService.getToken();
  if (token) {
    this.getProfile().pipe(
      catchError(() => of(null))
    ).subscribe();
  }
}

getProfile(): Observable<User | null> {
  const headers = this.getAuthHeaders(); // ← Crea headers manualmente
  if (!headers) {
    this.userSubject.next(null);
    return of(null);
  }
  
  return this.http.get<User>(`${this.apiUrl}/profile`, headers).pipe(
    tap(user => {
      this.userSubject.next(user);
    }),
    catchError(error => this.handleAuthError(error))
  );
}

private getAuthHeaders(): { headers: HttpHeaders } | null {
  const token = this.authService.getToken();
  if (!token) {
    return null;
  }
  
  return {
    headers: new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    })
  };
}
```

❌ **PROBLEMA 1**: SesionService agrega headers manualmente
❌ **PROBLEMA 2**: Esto es redundante con el JWT interceptor

---

### 4. JWT Interceptor (jwt.interceptor.ts)

```typescript
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('access_token');
  
  if (req.url.includes('/auth/') || !token) {
    return next(req);
  }
  
  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });
  
  return next(authReq);
};
```

✅ **Correcto**: Agrega automáticamente el token a todas las peticiones

---

## 🐛 Problemas Encontrados

### Problema 1: Headers Duplicados
- **SesionService** agrega headers manualmente
- **JWT Interceptor** también agrega headers
- Esto puede causar conflictos

### Problema 2: Race Condition
```
1. BasketService se crea → llama initializeBasket()
2. initializeBasket() se suscribe a sesionService.user$
3. sesionService.user$ emite null inicialmente
4. BasketService carga carrito local (vacío)
5. SesionService termina de cargar perfil
6. sesionService.user$ emite el usuario
7. ❌ BasketService NO reacciona porque ya se suscribió
```

### Problema 3: Falta de Logging
No hay console.logs en BasketService para debuggear

---

## ✅ Soluciones Propuestas

### Solución 1: Eliminar Headers Manuales de SesionService
El JWT interceptor ya se encarga de esto.

### Solución 2: Usar ReplaySubject en SesionService
Para que emita el último valor a nuevos suscriptores.

### Solución 3: Agregar Logging
Para ver qué está pasando en cada paso.

### Solución 4: Forzar Recarga
Cuando el usuario cambie de null a user, recargar el carrito.

---

## 🔧 Pasos para Debuggear

1. **Abrir DevTools** (F12)
2. **Ir a Console**
3. **Buscar logs de SesionService** (ya tiene logs)
4. **Verificar**:
   - ¿Se obtiene el token?
   - ¿Se carga el perfil?
   - ¿user$ emite el usuario?
5. **Agregar logs a BasketService**
6. **Verificar el flujo completo**

---

## 🎯 Próximos Pasos

1. Agregar logging a BasketService
2. Verificar en consola qué está pasando
3. Aplicar la solución correcta según los logs

# AI Coding Guidelines for Appdarkmode

## Architecture Overview
- **Standalone Angular 19** app with lazy-loaded feature modules
- **Modular structure**: `core/` (services, interceptors, interfaces), `shared/` (pipes, components), `website/` (public/business/company routes), `auth/`
- **State management**: Services use `BehaviorSubject` for reactive user/product state (e.g., `SesionService.user$`, `BasketService.basket$`)
- **Backend**: REST API at `localhost:3000`, MongoDB-style `_id` fields

## Authentication & Security
- **JWT tokens** stored in `localStorage` under `'access_token'`
- **Functional interceptors** (avoid circular dependencies):
  - `jwtInterceptor`: Adds `Authorization: Bearer ${token}` to all requests except `/auth/`
  - `errorInterceptor`: Handles 401 by clearing localStorage and redirecting to `/login`
- **Auth flow**: Google OAuth redirects to `/auth/auth-callback`, traditional login via `AuthService.login()`
- **User state**: Managed by `SesionService` (profile) and `AuthService` (auth status)

## Key Patterns
- **Service methods**: Return `Observable<T>`, use `tap()` for side effects, `catchError()` for error handling
- **API calls**: Base URL from `environment.apiUrl`, headers via `getAuthHeaders()` helper (e.g., in `SesionService`)
- **Error handling**: Show user-friendly messages via `ToastService.showError()`
- **Routing**: Lazy-loaded children for complex sections (e.g., `my-account` sub-routes in `public.routes.ts`)
- **Localization**: Peruvian locale (`es-PE`), Sol currency (`S/${value}` via `SolCurrencyPipe`), Spanish comments/logs
- **Component state**: Subscribe to service observables with `takeUntil(destroy$)` for cleanup (e.g., in `BasketComponent`)
- **Type handling**: Product IDs may be `string` or object with `_id`; access via `item.product._id` if object (e.g., in basket templates)

## Development Workflow
- **Start dev server**: `npm start` (serves at `http://localhost:4200`)
- **Build**: `npm run build` (outputs to `dist/appdarkmode`)
- **Test**: `npm test` (Karma/Jasmine)
- **Environment**: `environment.development.ts` overrides for dev (`production: false`)

## Code Style
- **Imports**: Group Angular core, then third-party (RxJS), then local interfaces/DTOs
- **Naming**: CamelCase for services/components, kebab-case for files/directories
- **Logging**: Use `console.log('[ServiceName] message:', data)` for debugging (e.g., in `SesionService`)
- **DTOs**: Separate interfaces for requests (`CreateUserDto`) and responses (`LoginResponse`)
- **Templates**: Use modern control flow (`@for`, `@if`) over structural directives; handle optional properties with `?.` (e.g., `product.gallery?.[0]`)

## Common Tasks
- **Add new route**: Update `*.routes.ts`, lazy-load components with `loadComponent: () => import(...)`
- **Add API endpoint**: Create method in service, use `HttpClient`, handle errors with `catchError`, update state with `tap`
- **Add user-facing feature**: Check auth state via `AuthService.isAuthenticated()`, redirect if needed
- **Style components**: Use Tailwind classes, custom pipes for formatting (e.g., `solCurrency`, `dateFormat`)
- **Manage state**: Use `BehaviorSubject` in services, subscribe with `takeUntil(destroy$)` for cleanup
- **Handle calculations**: Add getters in components for derived data (e.g., `subtotal`, `finalTotal` in `BasketComponent`)

## File Locations
- **Services**: `src/app/core/services/` (e.g., `AuthService`, `BasketService`)
- **Interfaces**: `src/app/core/interfaces/` (models like `Product`, `Basket`) or `dtos/` (API contracts)
- **Interceptors**: `src/app/core/interceptors/`
- **Routes**: Feature-specific `*.routes.ts` files
- **Constants**: `src/app/core/constants/` for dropdown options (e.g., `CATEGORY_OPTIONS`)
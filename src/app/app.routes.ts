import { Routes } from '@angular/router';

export const appRoutes: Routes = [
  {
    path: '',
    redirectTo: '/home', // Redirigir a /home si no hay una ruta específica
    pathMatch: 'full',
  },
  {
    // Ruta raíz, carga las rutas del módulo 'public'
    path: '',
    loadComponent: () => import('./website/public/public.component'),
    loadChildren: () => import('./website/public/public.routes').then(m => m.publicRoutes),
  },
  {
    // Ruta para la sección de 'business', carga las rutas del módulo 'business'
    path: 'business',
    loadChildren: () => import('./website/business/business.routes').then(m => m.businessRoutes)
  },
  {
    // Ruta para la sección de 'auth', carga las rutas del módulo 'auth'
    path: 'auth',
    loadChildren: () => import('./auth/auth.routes').then(m => m.authRoutes)
  },
  {
    // Ruta para cualquier otra ruta no definida, redirige a la raíz
    path: '**',
    redirectTo: '/home'
  }
]
import { Routes } from '@angular/router';
import { RegisterComponent } from './register/register.component';
import { LoginComponent } from './login/login.component';
import { AuthCallbackComponent } from './auth-callback/auth-callback.component';
import { guestGuard } from '../core/guards/guest.guard';

export const authRoutes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [guestGuard],
    title: 'Iniciar Sesión | Moorea'
  },
  {
    path: 'register',
    component: RegisterComponent,
    canActivate: [guestGuard],
    title: 'Crear Cuenta | Moorea'
  },
  { 
    path: 'auth-callback', 
    component: AuthCallbackComponent,
    title: 'Autenticación | Moorea'
  }
];

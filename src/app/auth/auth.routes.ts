import { Routes } from '@angular/router';
import { RegisterComponent } from './register/register.component';
import { LoginComponent } from './login/login.component';
import { AuthCallbackComponent } from './auth-callback/auth-callback.component';

export const authRoutes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    title: 'Iniciar Sesión | Moorea'
  },
  {
    path: 'register',
    component: RegisterComponent,
    title: 'Crear Cuenta | Moorea'
  },
  { 
    path: 'auth-callback', 
    component: AuthCallbackComponent,
    title: 'Autenticación | Moorea'
  }
];

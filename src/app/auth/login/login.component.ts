import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth/auth.service';
import { ToastService } from '../../core/services/ui/toast.service';

/**
 * Componente de inicio de sesión de usuario
 * Captura y preserva la URL de retorno (returnUrl) para redirigir al usuario a su página previa
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  loading = false;
  showPassword = false;
  returnUrl: string = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private toastService: ToastService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  /**
   * Inicializa el componente capturando la URL de retorno desde los queryParams o el servicio
   */
  ngOnInit(): void {
    const paramUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (paramUrl) {
      this.returnUrl = paramUrl;
      this.authService.setRedirectUrl(paramUrl);
    } else {
      this.returnUrl = this.authService.getRedirectUrl() || '';
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  /**
   * Procesa el formulario de login tradicional con email y contraseña
   */
  onSubmit(): void {
    if (this.loginForm.invalid) {
      Object.keys(this.loginForm.controls).forEach(key => {
        this.loginForm.get(key)?.markAsTouched();
      });
      this.toastService.showError('Por favor, completa todos los campos correctamente');
      return;
    }

    this.loading = true;
    const { email, password } = this.loginForm.value;

    this.authService.login({ email, password }).subscribe({
      next: () => {
        this.toastService.showSuccess('¡Bienvenido! Inicio de sesión exitoso');
        // AuthService handles redirectAfterLogin()
      },
      error: (err) => {
        console.error('Error en login:', err);

        let errorMessage = 'Error al iniciar sesión';
        if (err.error?.message) {
          errorMessage = err.error.message;
        } else if (err.status === 401) {
          errorMessage = '❌ Credenciales incorrectas. Verifica tu email y contraseña';
        } else if (err.status === 404) {
          errorMessage = '📧 Este correo no está registrado. ¿Deseas crear una cuenta?';
        } else if (err.status === 0) {
          errorMessage = '🌐 No se pudo conectar con el servidor. Verifica tu conexión';
        } else if (err.status === 500) {
          errorMessage = '⚠️ Error del servidor. Intenta nuevamente más tarde';
        }

        this.toastService.showError(errorMessage);
        this.loading = false;
      }
    });
  }

  /**
   * Inicia el flujo de autenticación con Google preservando la URL de retorno previa
   */
  loginWithGoogle(): void {
    this.authService.initiateGoogleLogin(this.returnUrl);
  }
}
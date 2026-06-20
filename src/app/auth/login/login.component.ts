import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth/auth.service';
import { ToastService } from '../../core/services/ui/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  loginForm: FormGroup;
  loading = false;
  showPassword = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private toastService: ToastService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

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
        // AuthService handles redirect
      },
      error: (err) => {
        console.error('Error en login:', err);

        // Specific error messages based on API response
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

  loginWithGoogle(): void {
    this.authService.initiateGoogleLogin();
  }
}
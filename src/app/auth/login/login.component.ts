import { Component } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  loginForm: FormGroup;
  isLoading = false;
  googleLoading = false;
  errorMessage: string | null = null;

  constructor(
    private authService: AuthService,
    private fb: FormBuilder,
    private router: Router,
    private toastService: ToastService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  /**
   * Inicio de sesión con Google OAuth
   */
  signInWithGoogle(): void {
    this.googleLoading = true;
    this.errorMessage = null;
    
    try {
      this.authService.initiateGoogleLogin();
    } catch (error) {
      this.handleError('Error al iniciar sesión con Google');
      this.toastService.showError('Error al iniciar sesión con Google');
    } finally {
      this.googleLoading = false;
    }
  }

  /**
   * Inicio de sesión tradicional con email/contraseña
   */
  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.markFormGroupTouched(this.loginForm);
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    const { email, password } = this.loginForm.value;

    this.authService.login({ email, password })
      .pipe(
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: () => {
          this.toastService.showSuccess('Inicio de sesión exitoso');
          this.router.navigate(['/home']);
        },
        error: (error) => {
          this.handleLoginError(error);
        }
      });
  }

  /**
   * Maneja errores de login
   */
  private handleLoginError(error: any): void {
    const errorMessage = this.getErrorMessage(error);
    this.errorMessage = errorMessage;
    this.toastService.showError(errorMessage);
    this.authService.removeToken();
  }

  /**
   * Marca todos los campos del formulario como touched para mostrar errores
   */
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  /**
   * Obtiene mensajes de error amigables para el usuario
   */
  private getErrorMessage(error: any): string {
    if (error.error?.message) {
      return error.error.message;
    }
    if (error.status === 401) {
      return 'Credenciales incorrectas. Por favor verifique su email y contraseña';
    }
    if (error.status === 0) {
      return 'No se pudo conectar con el servidor. Verifique su conexión a internet';
    }
    return 'Ocurrió un error al iniciar sesión. Por favor intente nuevamente';
  }

  /**
   * Maneja errores generales
   */
  private handleError(message: string): void {
    this.errorMessage = message;
    this.isLoading = false;
    this.googleLoading = false;
  }
}
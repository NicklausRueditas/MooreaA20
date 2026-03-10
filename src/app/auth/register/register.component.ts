import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth/auth.service';
import { ToastService } from '../../core/services/ui/toast.service';
import { CreateUserDto } from '../../core/dtos/auth.interfaces';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  registerForm: FormGroup;
  loading = false;
  showPassword = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private toastService: ToastService,
    private router: Router
  ) {
    this.registerForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      ]],
      displayName: ['', [Validators.required, Validators.minLength(3)]],
      phone: ['', [Validators.required, Validators.pattern(/^\+?[0-9]{9,15}$/)]],
      dni: ['', [Validators.required, Validators.pattern(/^[0-9]{8}$/)]]
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  getPasswordStrength(): number {
    const password = this.registerForm.get('password')?.value || '';
    let strength = 0;

    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[@$!%*?&]/.test(password)) strength++;

    return strength;
  }

  getPasswordStrengthLabel(): string {
    const strength = this.getPasswordStrength();
    if (strength <= 2) return 'Débil';
    if (strength <= 3) return 'Media';
    if (strength <= 4) return 'Fuerte';
    return 'Muy fuerte';
  }

  getPasswordStrengthColor(): string {
    const strength = this.getPasswordStrength();
    if (strength <= 2) return 'bg-red-500';
    if (strength <= 3) return 'bg-yellow-500';
    if (strength <= 4) return 'bg-blue-500';
    return 'bg-green-500';
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      Object.keys(this.registerForm.controls).forEach(key => {
        this.registerForm.get(key)?.markAsTouched();
      });
      this.toastService.showError('Por favor, completa todos los campos correctamente');
      return;
    }

    this.loading = true;
    const userData: CreateUserDto = {
      ...this.registerForm.value,
      roles: ['user']
    };

    this.authService.register(userData).subscribe({
      next: () => {
        this.toastService.showSuccess('✅ Registro exitoso. Iniciando sesión...');

        // Auto-login after registration
        this.authService.login({
          email: userData.email,
          password: userData.password
        }).subscribe({
          next: () => {
            this.toastService.showSuccess('¡Bienvenido a Moorea!');
            this.router.navigate(['/home']);
          },
          error: (err) => {
            console.error('Error en auto-login:', err);
            this.toastService.showError('Registro exitoso. Por favor, inicia sesión');
            this.router.navigate(['/auth/login']);
            this.loading = false;
          }
        });
      },
      error: (err) => {
        console.error('Error en registro:', err);

        // Specific error messages based on API response
        let errorMessage = 'Error al registrar usuario';

        if (err.error?.message) {
          errorMessage = err.error.message;
        } else if (err.status === 409 || err.error?.statusCode === 409) {
          errorMessage = '📧 Este correo ya está registrado. ¿Deseas iniciar sesión?';
        } else if (err.status === 400) {
          errorMessage = '⚠️ Datos inválidos. Verifica todos los campos';
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

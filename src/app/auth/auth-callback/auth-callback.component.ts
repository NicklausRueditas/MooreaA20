import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth/auth.service';
import { ToastService } from '../../core/services/ui/toast.service';

@Component({
  selector: 'app-auth-callback',
  templateUrl: './auth-callback.component.html',
  styleUrls: ['./auth-callback.component.css']
})
export class AuthCallbackComponent implements OnInit {

 constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
  this.route.fragment.subscribe(fragment => {
    if (!fragment) {
      this.handleError('missing_token');
      return;
    }

    // Guarda el token y redirige
    this.authService.handleGoogleAuth(fragment).subscribe({
  next: () => {
    this.toastService.showSuccess('Autenticación exitosa');
  },
  error: (err) => {
    this.toastService.showError(`Error: ${err.message}`);
    this.router.navigate(['/login']);
  }
});
  });
}
private handleError(errorMessage: string): void {
    console.error(errorMessage);
    // Redirige a login u otra página de error si es necesario
  }
}
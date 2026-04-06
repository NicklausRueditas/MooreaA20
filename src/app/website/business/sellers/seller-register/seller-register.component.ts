import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { SellersService } from '../../../../core/services/catalog/sellers.service';
import { ToastService } from '../../../../core/services/ui/toast.service';
import { CreateSellerProfileDto } from '../../../../core/interfaces/seller.interface';

/**
 * Formulario de registro de perfil de tienda para el seller autenticado.
 * Llama a POST /sellers/profile con storeName, description y bankInfo.
 * Una vez creado el perfil, el admin puede aprobar al seller.
 */
@Component({
  selector: 'app-seller-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './seller-register.component.html',
})
export class SellerRegisterComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  profileForm!: FormGroup;
  isSaving = false;
  /** true si el perfil ya fue creado (respuesta del backend) */
  profileCreated = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly sellersService: SellersService,
    private readonly toastService: ToastService,
    private readonly router: Router,
  ) { }

  ngOnInit(): void { this.buildForm(); }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  // ─── Formulario ────────────────────────────────────────────────────────────

  private buildForm(): void {
    this.profileForm = this.fb.group({
      storeName: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      // Datos bancarios (opcionales en el DTO)
      bank: [''],
      account: [''],
      cci: [''],
    });
  }

  // ─── Submit ────────────────────────────────────────────────────────────────

  /**
   * Envía el perfil de tienda al backend (POST /sellers/profile).
   * Construye el DTO solo con los campos que tengan valor.
   */
  submit(): void {
    if (this.profileForm.invalid) { this.profileForm.markAllAsTouched(); return; }
    this.isSaving = true;

    const v = this.profileForm.value;
    const dto: CreateSellerProfileDto = {
      storeName: v.storeName.trim(),
      description: v.description?.trim() || undefined,
    };

    // Incluye bankInfo solo si al menos un campo fue completado
    if (v.bank || v.account || v.cci) {
      dto.bankInfo = {
        bank: v.bank?.trim() ?? '',
        account: v.account?.trim() ?? '',
        cci: v.cci?.trim() ?? '',
      };
    }

    this.sellersService.createProfile(dto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.profileCreated = true;
          this.toastService.showSuccess('Perfil de tienda creado ✅ — Un administrador revisará tu solicitud.');
        },
        error: (err) => {
          this.isSaving = false;
          this.toastService.showError(err?.error?.message ?? 'Error al crear el perfil');
        },
      });
  }

  /** Verifica si el control es inválido y fue tocado. */
  isInvalid(field: string): boolean {
    const c = this.profileForm.get(field);
    return !!(c?.invalid && c?.touched);
  }
}

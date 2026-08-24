import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { SellersService } from '../../../../core/services/catalog/sellers.service';
import { ToastService }   from '../../../../core/services/ui/toast.service';
import { AuthService }    from '../../../../core/services/auth/auth.service';
import { ApprovalStatus, SellerProfile } from '../../../../core/interfaces/seller.interface';

/**
 * Componente de afiliación y estado de vendedor.
 *
 * Ruta: /my-account/become-seller
 *
 * Flujo:
 *   1. Al cargar consulta el estado actual del perfil de seller del usuario.
 *   2. Si está 'pending': Muestra el estado en revisión con los datos enviados.
 *   3. Si está 'approved': Muestra que ya es vendedor activo con accesos directos.
 *   4. Si está 'rejected': Muestra que fue denegada y permite volver a enviar la solicitud.
 *   5. Si no tiene solicitud: Muestra el formulario de primera postulación.
 */
@Component({
  selector: 'app-become-seller',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './become-seller.component.html',
})
export class BecomeSellerComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  // ── Estado de la solicitud ────────────────────────────────────────────────
  currentProfile: SellerProfile | null = null;
  isLoadingStatus = true;
  isEditingReapply = false;

  // ── Estado del formulario ─────────────────────────────────────────────────
  form!: FormGroup;
  isSubmitting = false;
  showBankInfo = false;

  /** Pasos del proceso para mostrar en la UI */
  readonly steps = [
    { key: 'apply',  title: 'Solicita',  desc: 'Rellena los datos de tu negocio' },
    { key: 'review', title: 'Revisión',  desc: 'El equipo Moorea revisa tu solicitud' },
    { key: 'active', title: '¡Activo!',  desc: 'Empieza a vender en la plataforma' },
  ];

  /** Beneficios de ser seller en Moorea */
  readonly benefits = [
    {
      key: 'shop',
      title: 'Tu propio negocio',
      desc: 'Espacio exclusivo con tu marca y catálogo propio',
      bgClass: 'bg-violet-100 text-violet-600',
    },
    {
      key: 'products',
      title: 'Gestión de productos',
      desc: 'Sube, edita y organiza tu inventario fácilmente',
      bgClass: 'bg-indigo-100 text-indigo-600',
    },
    {
      key: 'payments',
      title: 'Cobros automáticos',
      desc: 'Recibe pagos directamente en tu cuenta bancaria',
      bgClass: 'bg-emerald-100 text-emerald-600',
    },
    {
      key: 'analytics',
      title: 'Panel de control',
      desc: 'Métricas de ventas, stock y pedidos en tiempo real',
      bgClass: 'bg-blue-100 text-blue-600',
    },
  ];

  constructor(
    private readonly fb:             FormBuilder,
    private readonly router:         Router,
    private readonly sellersService: SellersService,
    private readonly toastService:   ToastService,
    private readonly authService:    AuthService,
  ) {}

  ngOnInit(): void {
    this.buildForm();
    this.loadApplicationStatus();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Consulta de estado actual ─────────────────────────────────────────────

  /**
   * Consulta si el usuario ya tiene un perfil o solicitud de seller registrada.
   */
  loadApplicationStatus(): void {
    this.isLoadingStatus = true;
    this.sellersService.getMyProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (profile) => {
          if (Array.isArray(profile)) {
            this.currentProfile = profile.length > 0 ? profile[0] : null;
          } else {
            this.currentProfile = profile || null;
          }
          this.isLoadingStatus = false;
          if (this.currentProfile && this.currentProfile.approvalStatus === 'rejected') {
            this.prefillForm(this.currentProfile);
          }
        },
        error: () => {
          this.currentProfile = null;
          this.isLoadingStatus = false;
        },
      });
  }

  // ── Formulario ────────────────────────────────────────────────────────────

  private buildForm(): void {
    this.form = this.fb.group({
      shopName:    ['', [Validators.required, Validators.minLength(3), Validators.maxLength(60)]],
      description: ['', [Validators.maxLength(250)]],
      logoUrl:     [''],
      bank:        [''],
      account:     [''],
      cci:         [''],
    });
  }

  /**
   * Pre-llena el formulario con los datos del perfil rechazado para facilitar correcciones.
   */
  private prefillForm(profile: SellerProfile): void {
    this.form.patchValue({
      shopName:    profile.shopName || '',
      description: profile.description || '',
      logoUrl:     profile.logoUrl || '',
      bank:        profile.bankInfo?.bank || '',
      account:     profile.bankInfo?.account || '',
      cci:         profile.bankInfo?.cci || '',
    });
    if (profile.bankInfo?.bank || profile.bankInfo?.account) {
      this.showBankInfo = true;
    }
  }

  startReapplying(): void {
    this.isEditingReapply = true;
  }

  cancelReapplying(): void {
    this.isEditingReapply = false;
  }

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  toggleBankInfo(): void {
    this.showBankInfo = !this.showBankInfo;
    if (!this.showBankInfo) {
      this.form.patchValue({ bank: '', account: '', cci: '' });
    }
  }

  // ── Envío / Re-envío ──────────────────────────────────────────────────────

  onSubmit(): void {
    if (this.form.invalid || this.isSubmitting) return;
    this.isSubmitting = true;

    const { shopName, description, logoUrl, bank, account, cci } = this.form.value;

    const dto: any = { shopName, description: description || undefined };
    if (logoUrl)  dto.logoUrl = logoUrl;
    if (bank && account) {
      dto.bankInfo = { bank, account };
      if (cci) dto.bankInfo.cci = cci;
    }

    this.sellersService.applyAsSeller(dto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (savedProfile) => {
          this.isSubmitting = false;
          this.currentProfile = savedProfile;
          this.isEditingReapply = false;
          this.toastService.showSuccess('¡Solicitud enviada! El equipo Moorea revisará tu perfil.');
        },
        error: (err) => {
          this.isSubmitting = false;
          const msg = err?.error?.message ?? 'Error al enviar la solicitud';
          this.toastService.showError(msg);
        },
      });
  }
}

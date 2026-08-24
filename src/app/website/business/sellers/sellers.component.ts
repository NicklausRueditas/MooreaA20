import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { SellersService } from '../../../core/services/catalog/sellers.service';
import { UsersService }   from '../../../core/services/auth/users.service';
import { ToastService }   from '../../../core/services/ui/toast.service';
import { ApprovalStatus, SellerUser, CreateSellerUserDto } from '../../../core/interfaces/seller.interface';

/** Filtro de estado para la lista de sellers */
export type StatusFilter = 'all' | ApprovalStatus | 'inactive';

@Component({
  selector: 'app-sellers',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './sellers.component.html',
})
export class SellersComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  // ── Estado de la lista ────────────────────────────────────────────────────
  sellers:         SellerUser[] = [];
  filteredSellers: SellerUser[] = [];
  isLoading        = false;
  statusFilter: StatusFilter = 'all';
  searchTerm       = '';

  /** Opciones del filtro de estado para renderizar los botones en el toolbar */
  readonly filterOptions: { value: StatusFilter; label: string; iconKey: string }[] = [
    { value: 'all',      label: 'Todos',       iconKey: 'all' },
    { value: 'pending',  label: 'Pendientes',  iconKey: 'pending' },
    { value: 'approved', label: 'Aprobados',   iconKey: 'approved' },
    { value: 'rejected', label: 'Denegados',   iconKey: 'rejected' },
    { value: 'inactive', label: 'Inactivos',   iconKey: 'inactive' },
  ];

  // ── Modal de creación de seller ───────────────────────────────────────────
  isModalOpen      = false;
  isSaving         = false;
  createForm!:     FormGroup;

  // ── Estadísticas rápidas ──────────────────────────────────────────────────
  get totalPending():  number {
    return this.sellers.filter(s =>
      s.sellerProfiles?.some(p => p.approvalStatus === 'pending')
    ).length;
  }

  get totalApproved(): number {
    return this.sellers.filter(s =>
      s.isActive !== false && s.sellerProfiles?.some(p => p.approvalStatus === 'approved' && p.isActive !== false)
    ).length;
  }

  get totalRejected(): number {
    return this.sellers.filter(s =>
      s.sellerProfiles?.some(p => p.approvalStatus === 'rejected')
    ).length;
  }

  get totalInactive(): number {
    return this.sellers.filter(s =>
      s.isActive === false || s.sellerProfiles?.every(p => p.isActive === false)
    ).length;
  }

  constructor(
    private readonly fb:             FormBuilder,
    private readonly sellersService: SellersService,
    private readonly usersService:   UsersService,
    private readonly toastService:   ToastService,
  ) {}

  ngOnInit(): void {
    this.buildForm();
    this.loadSellers();
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  // ─── Formulario de creación ────────────────────────────────────────────────

  private buildForm(): void {
    this.createForm = this.fb.group({
      email:       ['', [Validators.required, Validators.email]],
      password:    ['', [Validators.required, Validators.minLength(8)]],
      displayName: ['', Validators.required],
      phone:       [''],
      dni:         [''],
    });
  }

  // ─── Carga de datos ────────────────────────────────────────────────────────

  /**
   * Carga todos los sellers desde el backend y aplica los filtros locales.
   */
  loadSellers(forceRefresh = false): void {
    this.isLoading = true;
    this.sellersService.getAllSellers(undefined, forceRefresh)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.sellers = data;
          this.applyFilters();
          this.isLoading = false;
        },
        error: () => {
          this.toastService.showError('Error al cargar sellers');
          this.isLoading = false;
        },
      });
  }

  // ─── Filtros ───────────────────────────────────────────────────────────────

  /**
   * Aplica filtros de búsqueda y estado sobre la lista en memoria.
   */
  applyFilters(): void {
    let list = [...this.sellers];

    if (this.searchTerm.trim()) {
      const t = this.searchTerm.toLowerCase();
      list = list.filter(s =>
        s.displayName?.toLowerCase().includes(t) ||
        s.email.toLowerCase().includes(t) ||
        s.sellerProfiles?.some(p => p.shopName?.toLowerCase().includes(t))
      );
    }

    if (this.statusFilter === 'inactive') {
      list = list.filter(s =>
        s.isActive === false || s.sellerProfiles?.every(p => p.isActive === false)
      );
    } else if (this.statusFilter !== 'all') {
      list = list.filter(s =>
        s.sellerProfiles?.some(p => p.approvalStatus === this.statusFilter && p.isActive !== false)
      );
    }

    this.filteredSellers = list;
  }

  setFilter(f: StatusFilter): void {
    this.statusFilter = f;
    this.applyFilters();
  }

  // ─── Acciones de aprobación ────────────────────────────────────────────────

  /**
   * Aprueba el seller y actualiza su estado en memoria sin recargar.
   * @param seller El SellerUser a aprobar
   */
  approve(seller: SellerUser): void {
    this.sellersService.approveSeller(seller._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedProfiles) => {
          const idx = this.sellers.findIndex(s => s._id === seller._id);
          if (idx !== -1) this.sellers[idx].sellerProfiles = updatedProfiles;
          this.applyFilters();
          this.toastService.showSuccess('Seller ' + seller.displayName + ' aprobado');
        },
        error: () => this.toastService.showError('Error al aprobar seller'),
      });
  }

  /**
   * Rechaza/suspende el seller y actualiza su estado en memoria sin recargar.
   * @param seller El SellerUser a rechazar
   */
  reject(seller: SellerUser): void {
    if (!confirm('¿Rechazar/suspender a ' + seller.displayName + '?')) return;
    this.sellersService.rejectSeller(seller._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedProfiles) => {
          const idx = this.sellers.findIndex(s => s._id === seller._id);
          if (idx !== -1) this.sellers[idx].sellerProfiles = updatedProfiles;
          this.applyFilters();
          this.toastService.showSuccess('Seller ' + seller.displayName + ' rechazado');
        },
        error: () => this.toastService.showError('Error al rechazar seller'),
      });
  }

  /**
   * Devuelve el approvalStatus consolidado del seller:
   * - 'approved' si tiene al menos una tienda aprobada
   * - 'pending'  si todas las tiendas están pendientes
   * - 'rejected' si todas están rechazadas
   * - undefined  si no tiene tiendas
   */
  getSellerStatus(seller: SellerUser): ApprovalStatus | undefined {
    const profiles = seller.sellerProfiles;
    if (!profiles || profiles.length === 0) return undefined;
    if (profiles.some(p => p.approvalStatus === 'approved')) return 'approved';
    if (profiles.some(p => p.approvalStatus === 'pending'))  return 'pending';
    return 'rejected';
  }

  // ─── Modal de creación ─────────────────────────────────────────────────────

  openModal():  void { this.isModalOpen = true; this.createForm.reset(); }
  closeModal(): void { this.isModalOpen = false; }

  /**
   * Envía el formulario para crear un usuario con rol seller.
   */
  submitCreate(): void {
    if (this.createForm.invalid) { this.createForm.markAllAsTouched(); return; }
    this.isSaving = true;

    const dto: CreateSellerUserDto = {
      ...this.createForm.value,
      roles: ['seller'] as ['seller'],
    };

    this.usersService.createUser(dto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (newUser) => {
          this.sellers.unshift(newUser);
          this.applyFilters();
          this.isSaving = false;
          this.closeModal();
          this.toastService.showSuccess('Seller ' + newUser.displayName + ' creado');
        },
        error: (err) => {
          this.isSaving = false;
          this.toastService.showError(err?.error?.message ?? 'Error al crear seller');
        },
      });
  }

  // ─── Helpers de template ───────────────────────────────────────────────────

  /**
   * Devuelve las clases CSS del badge según el status del seller.
   * @param status Estado del perfil del seller
   */
  statusClasses(status?: ApprovalStatus): string {
    switch (status) {
      case 'approved': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'rejected': return 'bg-red-50 text-red-600 border-red-200';
      case 'pending':  return 'bg-amber-50 text-amber-700 border-amber-200';
      default:         return 'bg-gray-100 text-gray-500 border-gray-200';
    }
  }

  /**
   * Devuelve la etiqueta legible del status del seller.
   * @param status Estado del perfil del seller
   */
  statusLabel(status?: ApprovalStatus): string {
    switch (status) {
      case 'approved': return 'Aprobado';
      case 'rejected': return 'Denegado';
      case 'pending':  return 'Pendiente';
      default:         return 'Sin perfil';
    }
  }

  /** Verifica si el campo del formulario es inválido y fue tocado. */
  isInvalid(field: string): boolean {
    const c = this.createForm.get(field);
    return !!(c?.invalid && c?.touched);
  }
}

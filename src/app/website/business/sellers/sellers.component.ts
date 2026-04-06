import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { SellersService } from '../../../core/services/catalog/sellers.service';
import { UsersService }   from '../../../core/services/auth/users.service';
import { ToastService }   from '../../../core/services/ui/toast.service';
import { SellerUser, CreateSellerUserDto } from '../../../core/interfaces/seller.interface';

/** Filtro de estado para la lista de sellers */
type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

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

  // ── Modal de creación de seller ───────────────────────────────────────────
  isModalOpen      = false;
  isSaving         = false;
  createForm!:     FormGroup;

  // ── Estadísticas rápidas ──────────────────────────────────────────────────
  get totalPending():  number { return this.sellers.filter(s => s.sellerProfile?.status === 'pending').length;  }
  get totalApproved(): number { return this.sellers.filter(s => s.sellerProfile?.status === 'approved').length; }
  get totalRejected(): number { return this.sellers.filter(s => s.sellerProfile?.status === 'rejected').length; }

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
  loadSellers(): void {
    this.isLoading = true;
    this.sellersService.getAllSellers()
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
        s.displayName.toLowerCase().includes(t) ||
        s.email.toLowerCase().includes(t) ||
        s.sellerProfile?.storeName?.toLowerCase().includes(t)
      );
    }

    if (this.statusFilter !== 'all') {
      list = list.filter(s => s.sellerProfile?.status === this.statusFilter);
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
        next: (updated) => {
          this.patchSeller(updated);
          this.toastService.showSuccess(`✅ ${seller.displayName} aprobado`);
        },
        error: () => this.toastService.showError('Error al aprobar seller'),
      });
  }

  /**
   * Rechaza/suspende el seller y actualiza su estado en memoria sin recargar.
   * @param seller El SellerUser a rechazar
   */
  reject(seller: SellerUser): void {
    if (!confirm(`¿Rechazar/suspender a ${seller.displayName}?`)) return;
    this.sellersService.rejectSeller(seller._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.patchSeller(updated);
          this.toastService.showSuccess(`⭕ ${seller.displayName} rechazado`);
        },
        error: () => this.toastService.showError('Error al rechazar seller'),
      });
  }

  /**
   * Actualiza localmente el seller sin recargar la lista completa.
   * @param updated Seller actualizado devuelto por el backend
   */
  private patchSeller(updated: SellerUser): void {
    const idx = this.sellers.findIndex(s => s._id === updated._id);
    if (idx !== -1) this.sellers[idx] = updated;
    this.applyFilters();
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
          this.toastService.showSuccess(`Seller ${newUser.displayName} creado ✅`);
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
  statusClasses(status?: string): string {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-700';
      case 'rejected': return 'bg-red-100 text-red-600';
      case 'pending':  return 'bg-amber-100 text-amber-700';
      default:         return 'bg-gray-100 text-gray-500';
    }
  }

  /**
   * Devuelve la etiqueta legible del status del seller.
   * @param status Estado del perfil del seller
   */
  statusLabel(status?: string): string {
    switch (status) {
      case 'approved': return '✅ Aprobado';
      case 'rejected': return '⭕ Rechazado';
      case 'pending':  return '⏳ Pendiente';
      default:         return '— Sin perfil';
    }
  }

  /** Verifica si el campo del formulario es inválido y fue tocado. */
  isInvalid(field: string): boolean {
    const c = this.createForm.get(field);
    return !!(c?.invalid && c?.touched);
  }
}

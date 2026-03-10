import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { StoresService } from '../../../../core/services/catalog/stores.service';
import { Store, StoreWorker } from '../../../../core/interfaces/store.interface';

interface User {
  _id: string;
  name: string;
  email: string;
}

@Component({
  selector: 'app-store-workers',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './store-workers.component.html',
  styleUrls: ['./store-workers.component.css']
})
export class StoreWorkersComponent implements OnInit {
  store: Store | null = null;
  storeId: string = '';
  workers: StoreWorker[] = [];

  // Mock users - In production, fetch from UserService
  availableUsers: User[] = [
    { _id: '1', name: 'Juan Pérez', email: 'juan@example.com' },
    { _id: '2', name: 'María García', email: 'maria@example.com' },
    { _id: '3', name: 'Carlos López', email: 'carlos@example.com' },
    { _id: '4', name: 'Ana Martínez', email: 'ana@example.com' }
  ];

  // UI State
  showAddModal: boolean = false;
  addWorkerForm: FormGroup;

  // Role options
  roles = [
    { value: 'manager', label: 'Gerente', icon: '👔', color: 'blue' },
    { value: 'cashier', label: 'Cajero', icon: '💰', color: 'green' },
    { value: 'stock_keeper', label: 'Almacenero', icon: '📦', color: 'purple' }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private storesService: StoresService,
    private fb: FormBuilder
  ) {
    this.addWorkerForm = this.fb.group({
      userId: ['', Validators.required],
      role: ['cashier', Validators.required]
    });
  }

  ngOnInit(): void {
    this.storeId = this.route.snapshot.paramMap.get('id') || '';
    if (this.storeId) {
      this.loadStore();
    }
  }

  /**
   * Load store data
   */
  loadStore(): void {
    this.storesService.getStoreById(this.storeId).subscribe({
      next: (store) => {
        this.store = store;
        this.workers = store.workers || [];
      },
      error: (err) => console.error('Error loading store:', err)
    });
  }

  /**
   * Get user by ID
   */
  getUserById(userId: string): User | undefined {
    return this.availableUsers.find(u => u._id === userId);
  }

  /**
   * Get role info
   */
  getRoleInfo(role: string) {
    return this.roles.find(r => r.value === role) || this.roles[1];
  }

  /**
   * Open add worker modal
   */
  openAddModal(): void {
    this.addWorkerForm.reset({ role: 'cashier' });
    this.showAddModal = true;
  }

  /**
   * Close add worker modal
   */
  closeAddModal(): void {
    this.showAddModal = false;
    this.addWorkerForm.reset();
  }

  /**
   * Add worker to store
   */
  onAddWorker(): void {
    if (this.addWorkerForm.valid) {
      const worker: StoreWorker = this.addWorkerForm.value;

      this.storesService.addWorker(this.storeId, worker).subscribe({
        next: (updated) => {
          console.log('✅ Worker added to store');
          this.store = updated;
          this.workers = updated.workers || [];
          this.closeAddModal();
        },
        error: (err) => console.error('❌ Error adding worker:', err)
      });
    }
  }

  /**
   * Remove worker from store
   */
  removeWorker(worker: StoreWorker): void {
    const user = this.getUserById(worker.userId);
    const confirmDelete = confirm(`¿Eliminar a "${user?.name}" de esta tienda?`);

    if (confirmDelete) {
      this.workers = this.workers.filter(w => w.userId !== worker.userId);
      console.log('✅ Worker removed from store');

      // You'll need to add a DELETE endpoint to your service
    }
  }

  /**
   * Get available users (not assigned to this store)
   */
  get unassignedUsers(): User[] {
    const workerUserIds = this.workers.map(w => w.userId);
    return this.availableUsers.filter(u => !workerUserIds.includes(u._id));
  }

  /**
   * Go back to stores list
   */
  goBack(): void {
    this.router.navigate(['/business/stores']);
  }
}

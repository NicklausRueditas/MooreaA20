import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { StoresService } from '../../../../core/services/catalog/stores.service';
import { Store, CoverageZone } from '../../../../core/interfaces/store.interface';

@Component({
  selector: 'app-coverage-zones',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './coverage-zones.component.html',
  styleUrls: ['./coverage-zones.component.css']
})
export class CoverageZonesComponent implements OnInit {
  store: Store | null = null;
  storeId: string = '';
  zones: CoverageZone[] = [];

  // UI State
  showAddModal: boolean = false;
  addZoneForm: FormGroup;
  coordinatesInput: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private storesService: StoresService,
    private fb: FormBuilder
  ) {
    this.addZoneForm = this.fb.group({
      name: ['', Validators.required],
      deliveryFee: [0, [Validators.required, Validators.min(0)]]
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
        this.zones = store.coverageZones || [];
      },
      error: (err) => console.error('Error loading store:', err)
    });
  }

  /**
   * Open add zone modal
   */
  openAddModal(): void {
    this.addZoneForm.reset({ deliveryFee: 5.0 });
    this.coordinatesInput = '';
    this.showAddModal = true;
  }

  /**
   * Close add zone modal
   */
  closeAddModal(): void {
    this.showAddModal = false;
    this.addZoneForm.reset();
    this.coordinatesInput = '';
  }

  /**
   * Parse coordinates from input
   */
  parseCoordinates(): number[][] {
    try {
      // Expected format: "-77.042754,-12.046373; -77.042754,-12.056373; ..."
      const pairs = this.coordinatesInput.split(';').map(s => s.trim()).filter(s => s);
      return pairs.map(pair => {
        const [lng, lat] = pair.split(',').map(s => parseFloat(s.trim()));
        return [lng, lat];
      });
    } catch (error) {
      console.error('Error parsing coordinates:', error);
      return [];
    }
  }

  /**
   * Add coverage zone
   */
  onAddZone(): void {
    if (this.addZoneForm.valid && this.coordinatesInput) {
      const coordinates = this.parseCoordinates();

      if (coordinates.length < 3) {
        alert('Se necesitan al menos 3 puntos para formar un polígono');
        return;
      }

      const zone: CoverageZone = {
        name: this.addZoneForm.value.name,
        coordinates: coordinates,
        deliveryFee: this.addZoneForm.value.deliveryFee
      };

      this.storesService.addCoverageZone(this.storeId, zone).subscribe({
        next: (updated) => {
          console.log('✅ Coverage zone added');
          this.store = updated;
          this.zones = updated.coverageZones || [];
          this.closeAddModal();
        },
        error: (err) => console.error('❌ Error adding zone:', err)
      });
    }
  }

  /**
   * Delete coverage zone
   */
  deleteZone(zone: CoverageZone): void {
    const confirmDelete = confirm(`¿Eliminar zona "${zone.name}"?`);

    if (confirmDelete) {
      this.zones = this.zones.filter(z => z._id !== zone._id);
      console.log('✅ Zone deleted');

      // You'll need to add a DELETE endpoint to your service
    }
  }

  /**
   * Format coordinates for display
   */
  formatCoordinates(coordinates: number[][]): string {
    return `${coordinates.length} puntos`;
  }

  /**
   * Go back to stores list
   */
  goBack(): void {
    this.router.navigate(['/business/stores']);
  }
}

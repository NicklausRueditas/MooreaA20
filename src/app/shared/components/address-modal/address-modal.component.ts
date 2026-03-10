import {
  Component, OnChanges, OnDestroy,
  Input, Output, EventEmitter, ViewChild, ElementRef,
  SimpleChanges,
} from '@angular/core';
import {
  FormBuilder, FormGroup, ReactiveFormsModule, Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

import { AddressService } from '../../../core/services/utils/address.service';
import { ToastService } from '../../../core/services/ui/toast.service';

import {
  AddressData,
  UpdateAddressDto,
  AddressResponse,
  CreateAddressResponse,
} from '../../../core/interfaces/address.interface';
import { Location, PERU_LOCATIONS } from '../../../core/constants/peru-locations';

declare const google: any;

/**
 * Modal reutilizable para crear o editar una dirección.
 *
 * Uso:
 * ```html
 * <app-address-modal
 *   [isOpen]="showModal"
 *   [editAddress]="addressToEdit"
 *   (closed)="showModal = false"
 *   (addressSaved)="onAddressSaved($event)">
 * </app-address-modal>
 * ```
 */
@Component({
  selector: 'app-address-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './address-modal.component.html',
  styleUrl: './address-modal.component.css',
})
export class AddressModalComponent implements OnChanges, OnDestroy {
  /** Controla la visibilidad del modal */
  @Input() isOpen = false;
  /** Si se proporciona, entra en modo edición */
  @Input() editAddress: AddressData | null = null;
  /** API key de Google Maps — pasarla desde el componente padre */
  @Input() googleMapsApiKey = '';

  /** Emitido al cerrar el modal (backdrop o botón Cancelar) */
  @Output() closed = new EventEmitter<void>();
  /** Emitido cuando la dirección fue guardada exitosamente */
  @Output() addressSaved = new EventEmitter<AddressData>();

  // ─── Maps ────────────────────────────────────────────────────────────────
  @ViewChild('mapContainer') mapContainer!: ElementRef;
  map: any;
  marker: any;

  // ─── Selects en cascada ──────────────────────────────────────────────────
  departments: Location[] = PERU_LOCATIONS;
  provinces: Location[]   = [];
  districts: Location[]   = [];

  // ─── Estado interno ───────────────────────────────────────────────────────
  get editMode(): boolean { return !!this.editAddress; }
  private currentAddressId: string | null = null;
  private subscriptions = new Subscription();

  addressForm: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly addressService: AddressService,
    private readonly toastService: ToastService,
  ) {
    this.addressForm = this.fb.group({
      alias:             ['', [Validators.required, Validators.maxLength(50)]],
      street:            ['', [Validators.required, Validators.maxLength(100)]],
      streetNumber:      ['', [Validators.required, Validators.maxLength(20)]],
      apartment:         ['', [Validators.maxLength(20)]],
      district:          ['', [Validators.required, Validators.maxLength(50)]],
      province:          ['', [Validators.required, Validators.maxLength(50)]],
      department:        ['', [Validators.required, Validators.maxLength(50)]],
      postalCode:        ['', [Validators.required, Validators.maxLength(20)]],
      country:           ['PE', [Validators.required, Validators.pattern(/^[A-Z]{2}$/)]],
      references:        ['', [Validators.maxLength(200)]],
      isDefault:         [false],
      lat:               [null as number | null, [Validators.required]],
      lng:               [null as number | null, [Validators.required]],
      placeId:           [''],
      distanceFromStore: [null],
    });
  }

  // ngOnInit no es necesario; la API key llega como @Input()

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']) {
      if (this.isOpen) {
        this.setupModal();
      } else {
        this.resetForm();
      }
    }
    if (changes['editAddress'] && this.isOpen) {
      this.setupModal();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // ─── Setup ────────────────────────────────────────────────────────────────

  private setupModal(): void {
    if (this.editAddress) {
      // Modo edición
      this.currentAddressId = this.editAddress._id ?? null;
      this.addressForm.patchValue(this.editAddress);
      this.loadDependentLists(this.editAddress);
    } else {
      // Modo creación
      this.currentAddressId = null;
      this.resetForm();
    }
    // Pequeño delay para que el DOM renderice el #mapContainer
    setTimeout(() => this.initMap(), 50);
  }

  private resetForm(): void {
    this.addressForm.reset({ country: 'PE', isDefault: false });
    this.provinces = [];
    this.districts = [];
  }

  private loadDependentLists(address: AddressData): void {
    const dep = this.departments.find(d => d.name === address.department);
    if (dep) {
      this.provinces = dep.children ?? [];
      const prov = this.provinces.find(p => p.name === address.province);
      if (prov) {
        this.districts = prov.children ?? [];
      }
    }
  }

  // ─── Google Maps ─────────────────────────────────────────────────────────

  private initMap(): void {
    if (!this.googleMapsApiKey) return;
    if (typeof google !== 'undefined') {
      this.renderMap();
      return;
    }
    // Evitar inyectar el script más de una vez
    if (document.querySelector('script[src*="maps.googleapis.com"]')) return;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${this.googleMapsApiKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => this.renderMap();
    document.body.appendChild(script);
  }

  renderMap(): void {
    setTimeout(() => {
      if (!this.mapContainer?.nativeElement) return;
      const lat = this.addressForm.get('lat')?.value ?? -12.0667;
      const lng = this.addressForm.get('lng')?.value ?? -75.2333;
      const location = { lat: Number(lat), lng: Number(lng) };
      const mapOptions = {
        center: location, zoom: 13,
        mapTypeControl: false, streetViewControl: false,
      };
      this.map = new google.maps.Map(this.mapContainer.nativeElement, mapOptions);
      this.marker = new google.maps.Marker({
        position: location, map: this.map, draggable: true,
        animation: google.maps.Animation.DROP,
      });
      this.map.addListener('click', (e: any) => this.updateMarkerPosition(e.latLng));
      this.marker.addListener('dragend', (e: any) => this.updateMarkerPosition(e.latLng));
    }, 100);
  }

  private updateMarkerPosition(latLng: any): void {
    const lat = latLng.lat();
    const lng = latLng.lng();
    this.marker.setPosition(latLng);
    this.map.panTo(latLng);
    this.addressForm.patchValue({ lat, lng });
    this.addressForm.get('lat')?.markAsTouched();
    this.addressForm.get('lng')?.markAsTouched();
  }

  private updateMapCenter(lat: number, lng: number): void {
    if (this.map && this.marker) {
      const pos = { lat, lng };
      this.map.panTo(pos);
      this.map.setZoom(13);
      this.marker.setPosition(pos);
      this.addressForm.patchValue({ lat, lng });
    }
  }

  // ─── Selects en cascada ───────────────────────────────────────────────────

  onDepartmentChange(event: Event): void {
    const name = (event.target as HTMLSelectElement).value;
    const dep = this.departments.find(d => d.name === name);
    this.provinces = [];
    this.districts = [];
    this.addressForm.patchValue({ province: '', district: '' });
    if (dep) {
      this.provinces = dep.children ?? [];
      this.updateMapCenter(dep.lat ?? -12.0667, dep.lng ?? -75.2333);
    }
  }

  onProvinceChange(event: Event): void {
    const name = (event.target as HTMLSelectElement).value;
    const prov = this.provinces.find(p => p.name === name);
    this.districts = [];
    this.addressForm.patchValue({ district: '' });
    if (prov) {
      this.districts = prov.children ?? [];
      if (prov.lat && prov.lng) this.updateMapCenter(prov.lat, prov.lng);
    }
  }

  onDistrictChange(event: Event): void {
    const name = (event.target as HTMLSelectElement).value;
    const dist = this.districts.find(d => d.name === name);
    if (dist?.lat && dist.lng) this.updateMapCenter(dist.lat, dist.lng);
  }

  // ─── Acciones del modal ───────────────────────────────────────────────────

  close(): void { this.closed.emit(); }

  onSubmit(): void {
    if (this.addressForm.invalid) {
      this.markAllTouched(this.addressForm);
      this.toastService.showWarning('Por favor complete todos los campos requeridos');
      return;
    }

    const formData = { ...this.addressForm.value };
    if (!formData.placeId)     delete formData.placeId;
    if (!formData.apartment)   delete formData.apartment;
    if (!formData.references)  delete formData.references;
    formData.lat = Number(formData.lat);
    formData.lng = Number(formData.lng);
    if (formData.distanceFromStore == null || formData.distanceFromStore === '') {
      delete formData.distanceFromStore;
    } else {
      formData.distanceFromStore = Number(formData.distanceFromStore);
    }

    if (this.editMode && this.currentAddressId) {
      this.doUpdate(this.currentAddressId, formData);
    } else {
      this.doCreate(formData);
    }
  }

  private doCreate(data: Omit<AddressData, '_id' | 'createdAt' | 'updatedAt' | 'userId'>): void {
    this.addressService.createAddress(data).subscribe({
      next: (res: CreateAddressResponse) => {
        const saved: AddressData = (res as any).address ?? (res as any);
        this.toastService.showSuccess('Dirección creada exitosamente!');
        this.addressSaved.emit(saved);
        this.closed.emit();
      },
      error: (err) => {
        this.toastService.showError('Error al crear: ' + (err.error?.message ?? err.message ?? 'Error'));
      },
    });
  }

  private doUpdate(id: string, data: UpdateAddressDto): void {
    this.addressService.updateAddress(id, data).subscribe({
      next: (res: AddressResponse) => {
        const saved: AddressData = (res as any).address ?? (res as any);
        this.toastService.showSuccess('Dirección actualizada exitosamente!');
        this.addressSaved.emit(saved);
        this.closed.emit();
      },
      error: (err) => {
        this.toastService.showError('Error al actualizar: ' + (err.error?.message ?? err.message ?? 'Error'));
      },
    });
  }

  private markAllTouched(fg: FormGroup): void {
    Object.values(fg.controls).forEach(c => {
      c.markAsTouched();
      if (c instanceof FormGroup) this.markAllTouched(c);
    });
  }
}

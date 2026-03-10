import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild, ElementRef, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { StoresService } from '../../../../core/services/catalog/stores.service';
import { ConfigService } from '../../../../core/services/utils/config.service';
import { Store, BusinessHours } from '../../../../core/interfaces/store.interface';
import { Subscription } from 'rxjs';

declare const google: any;

@Component({
  selector: 'app-form-store',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './form-store.component.html',
  styleUrls: ['./form-store.component.css']
})
export class FormStoreComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() selectedStore: Store | null = null;
  @Input() isEditMode: boolean = false;
  @Output() closeModal = new EventEmitter<void>();
  @Output() storeSaved = new EventEmitter<Store>();
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  storeForm: FormGroup;
  map: any;
  marker: any;
  googleMapsApiKey: string = '';
  private subscriptions: Subscription = new Subscription();

  // Days of week for business hours
  daysOfWeek = [
    { value: 0, label: 'Domingo' },
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sábado' }
  ];

  constructor(
    private fb: FormBuilder,
    private storesService: StoresService,
    private configService: ConfigService
  ) {
    this.storeForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      address: ['', [Validators.required]],
      lat: [-12.046374, [Validators.required]],
      lng: [-77.042793, [Validators.required]],
      phone: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      isActive: [true],
      businessHours: this.fb.array([])
    });

    // Initialize with default business hours (Monday-Friday 9:00-18:00)
    this.initializeDefaultBusinessHours();

    // Subscribe to config for Google Maps API key
    this.subscriptions.add(
      this.configService.config$.subscribe(config => {
        if (config) {
          this.googleMapsApiKey = config.googleMapsApiKey;
        }
      })
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedStore'] && this.selectedStore) {
      this.loadStoreData();
    }
  }

  /**
   * Get business hours FormArray
   */
  get businessHoursArray(): FormArray {
    return this.storeForm.get('businessHours') as FormArray;
  }

  /**
   * Initialize default business hours (Monday-Friday)
   */
  private initializeDefaultBusinessHours(): void {
    if (this.businessHoursArray.length === 0) {
      // Add Monday to Friday (1-5)
      for (let day = 1; day <= 5; day++) {
        this.businessHoursArray.push(this.createBusinessHourGroup({
          dayOfWeek: day,
          openTime: '09:00',
          closeTime: '18:00',
          isOpen: true
        }));
      }
    }
  }

  /**
   * Create a FormGroup for business hours
   */
  private createBusinessHourGroup(data?: Partial<BusinessHours>): FormGroup {
    return this.fb.group({
      dayOfWeek: [data?.dayOfWeek || 0, Validators.required],
      openTime: [data?.openTime || '09:00', Validators.required],
      closeTime: [data?.closeTime || '18:00', Validators.required],
      isOpen: [data?.isOpen !== undefined ? data.isOpen : true]
    });
  }

  /**
   * Load store data into form
   */
  private loadStoreData(): void {
    if (!this.selectedStore) return;

    this.storeForm.patchValue({
      name: this.selectedStore.name,
      address: this.selectedStore.address,
      lat: this.selectedStore.lat,
      lng: this.selectedStore.lng,
      phone: this.selectedStore.phone,
      email: this.selectedStore.email,
      isActive: this.selectedStore.isActive
    });

    // Load business hours
    this.businessHoursArray.clear();
    if (this.selectedStore.businessHours && this.selectedStore.businessHours.length > 0) {
      this.selectedStore.businessHours.forEach(bh => {
        this.businessHoursArray.push(this.createBusinessHourGroup(bh));
      });
    } else {
      this.initializeDefaultBusinessHours();
    }
  }

  /**
   * Add a new business hour entry
   */
  addBusinessHour(): void {
    this.businessHoursArray.push(this.createBusinessHourGroup());
  }

  /**
   * Remove business hour entry
   */
  removeBusinessHour(index: number): void {
    this.businessHoursArray.removeAt(index);
  }

  /**
   * Get day label by value
   */
  getDayLabel(dayValue: number): string {
    return this.daysOfWeek.find(d => d.value === dayValue)?.label || '';
  }

  /**
   * Submit form
   */
  onSubmit(): void {
    if (this.storeForm.valid) {
      const storeData = this.storeForm.value;

      if (this.isEditMode && this.selectedStore?._id) {
        // Update existing store
        this.storesService.updateStore(this.selectedStore._id, storeData).subscribe({
          next: (updated) => {
            console.log('✅ Store updated:', updated);
            this.storeSaved.emit(updated);
          },
          error: (err) => console.error('❌ Error updating store:', err)
        });
      } else {
        // Create new store
        this.storesService.createStore(storeData).subscribe({
          next: (created) => {
            console.log('✅ Store created:', created);
            this.storeSaved.emit(created);
          },
          error: (err) => console.error('❌ Error creating store:', err)
        });
      }
    } else {
      console.warn('⚠️ Form is invalid');
      this.storeForm.markAllAsTouched();
    }
  }

  /**
   * Close modal
   */
  onClose(): void {
    this.closeModal.emit();
  }

  /**
   * Lifecycle hook - Initialize map after view init
   */
  ngAfterViewInit(): void {
    if (this.isEditMode && this.selectedStore) {
      setTimeout(() => this.initMap(), 100);
    } else {
      setTimeout(() => this.initMap(), 100);
    }
  }

  /**
   * Lifecycle hook - Cleanup subscriptions
   */
  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /**
   * Initialize Google Maps
   */
  initMap(): void {
    if (!this.googleMapsApiKey) return;

    // If Google Maps API is already loaded
    if (typeof google !== 'undefined') {
      this.renderMap();
    } else {
      // Load Google Maps script
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${this.googleMapsApiKey}`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        this.renderMap();
      };
      document.body.appendChild(script);
    }
  }

  /**
   * Render the map
   */
  renderMap(): void {
    if (!this.mapContainer) return;

    setTimeout(() => {
      const lat = this.storeForm.get('lat')?.value || -12.046374;
      const lng = this.storeForm.get('lng')?.value || -77.042793;

      // Create map
      this.map = new google.maps.Map(this.mapContainer.nativeElement, {
        center: { lat, lng },
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        gestureHandling: 'cooperative' // Requires Ctrl+scroll to zoom
      });

      // Create marker (non-draggable)
      this.marker = new google.maps.Marker({
        position: { lat, lng },
        map: this.map,
        draggable: false,
        title: 'Ubicación de la tienda'
      });

      // Map click event to place marker
      this.map.addListener('click', (event: any) => {
        this.updateMarkerPosition(event.latLng);
      });

    }, 100);
  }

  /**
   * Update marker position and form values
   */
  updateMarkerPosition(latLng: any): void {
    const lat = latLng.lat();
    const lng = latLng.lng();

    this.marker.setPosition(latLng);
    this.map.panTo(latLng);

    // Update form
    this.storeForm.patchValue({
      lat: lat,
      lng: lng
    });

    // Mark as touched
    this.storeForm.get('lat')?.markAsTouched();
    this.storeForm.get('lng')?.markAsTouched();
  }
}

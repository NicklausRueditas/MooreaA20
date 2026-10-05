import {
  Component, OnInit, OnChanges, OnDestroy,
  Input, Output, EventEmitter, ViewChild, ElementRef,
  SimpleChanges, ChangeDetectorRef,
} from '@angular/core';
import {
  FormBuilder, FormGroup, ReactiveFormsModule, Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

import { AddressService } from '../../../core/services/utils/address.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { ConfigService } from '../../../core/services/utils/config.service';

import {
  AddressData,
  UpdateAddressDto,
  AddressResponse,
  CreateAddressResponse,
} from '../../../core/interfaces/address.interface';
import { LocationsService, Location } from '../../../core/services/utils/locations.service';

declare const google: any;

/** Coordenadas predeterminadas de Lima, Perú */
const DEFAULT_LIMA_COORDS = { lat: -12.046374, lng: -77.042793 };

/**
 * Modal reutilizable para crear o editar una dirección.
 * Integra Google Maps con carga asíncrona robusta y selector en cascada de ubicaciones de Perú.
 *
 * Uso:
 * ```html
 * <app-address-modal
 *   [isOpen]="showModal"
 *   [editAddress]="addressToEdit"
 *   [googleMapsApiKey]="googleMapsApiKey"
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
export class AddressModalComponent implements OnInit, OnChanges, OnDestroy {
  /** Controla la visibilidad del modal */
  @Input() isOpen = false;
  /** Si se proporciona, entra en modo edición */
  @Input() editAddress: AddressData | null = null;
  /** API key de Google Maps — opcional, si no se provee se obtiene de ConfigService */
  @Input() googleMapsApiKey = '';

  /** Emitido al cerrar el modal (backdrop o botón Cancelar) */
  @Output() closed = new EventEmitter<void>();
  /** Emitido cuando la dirección fue guardada exitosamente */
  @Output() addressSaved = new EventEmitter<AddressData>();

  // ─── Maps ────────────────────────────────────────────────────────────────
  @ViewChild('mapContainer') mapContainer!: ElementRef;
  map: any;
  marker: any;
  isMapLoading = false;
  mapLoadError = false;
  private mapInitialized = false;

  // ─── Selects en cascada ──────────────────────────────────────────────────
  departments: Location[] = [];
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
    private readonly locationsService: LocationsService,
    private readonly configService: ConfigService,
    private readonly cd: ChangeDetectorRef,
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

    // Cargar departamentos desde assets/data/peru-locations.json
    this.subscriptions.add(
      this.locationsService.getLocations().subscribe(locations => {
        this.departments = locations;
        if (this.editAddress) {
          this.loadDependentLists(this.editAddress);
        }
      })
    );
  }

  /**
   * Ciclo de vida OnInit: escucha la configuración global de la API key de Maps
   * como fallback automático si el padre no la pasó a tiempo.
   *
   * @returns void
   */
  ngOnInit(): void {
    this.subscriptions.add(
      this.configService.config$.subscribe(config => {
        if (config?.googleMapsApiKey) {
          if (!this.googleMapsApiKey) {
            this.googleMapsApiKey = config.googleMapsApiKey;
          }
          if (this.isOpen && !this.mapInitialized) {
            this.initMap();
          }
        }
      })
    );
  }

  /**
   * Ciclo de vida OnChanges: detecta aperturas/cierres y cambios en inputs
   * para reconfigurar el formulario y reintentar inicializar el mapa si la key llega tarde.
   *
   * @param changes Cambios detectados en las propiedades @Input()
   * @returns void
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']) {
      if (this.isOpen) {
        this.mapInitialized = false;
        this.setupModal();
      } else {
        this.resetForm();
        this.map = null;
        this.marker = null;
      }
    }
    if (changes['editAddress'] && this.isOpen) {
      this.mapInitialized = false;
      this.setupModal();
    }
    if (changes['googleMapsApiKey'] && this.isOpen && this.googleMapsApiKey && !this.mapInitialized) {
      this.initMap();
    }
  }

  /**
   * Ciclo de vida OnDestroy: desuscribe todos los observables activos.
   *
   * @returns void
   */
  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // ─── Setup ────────────────────────────────────────────────────────────────

  /**
   * Configura los valores del modal al abrirlo, distinguiendo entre modo edición
   * y modo creación con coordenadas iniciales por defecto de Lima, Perú.
   *
   * @returns void
   */
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
      // Inicializar coordenadas predeterminadas de Lima
      this.addressForm.patchValue({
        lat: DEFAULT_LIMA_COORDS.lat,
        lng: DEFAULT_LIMA_COORDS.lng,
      });
    }

    this.mapLoadError = false;
    this.isMapLoading = true;
    this.cd.detectChanges();

    // Pequeño delay para permitir que el DOM renderice el #mapContainer tras el @if (isOpen)
    setTimeout(() => this.initMap(), 80);
  }

  /**
   * Restablece el formulario a sus valores iniciales en blanco.
   *
   * @returns void
   */
  private resetForm(): void {
    this.addressForm.reset({ country: 'PE', isDefault: false });
    this.provinces = [];
    this.districts = [];
  }

  /**
   * Carga las listas dependientes de provincias y distritos según el departamento de la dirección.
   *
   * @param address Dirección cargada en modo edición
   * @returns void
   */
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

  /**
   * Inicializa la carga del script de Google Maps o procede a renderizar el mapa
   * si el SDK ya se encuentra disponible globalmente en window.google.
   *
   * @returns void
   */
  private initMap(): void {
    const apiKey = this.googleMapsApiKey || this.configService.getGoogleMapsApiKey();
    if (!apiKey) {
      this.isMapLoading = false;
      return;
    }

    if (typeof google !== 'undefined' && google.maps?.Map) {
      this.renderMap();
      return;
    }

    // Verificar si el script ya fue inyectado en el DOM
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => this.renderMap());
      existingScript.addEventListener('error', () => {
        this.isMapLoading = false;
        this.mapLoadError = true;
        this.cd.detectChanges();
      });

      // Polling de seguridad en caso de que el evento 'load' ya haya disparado
      const checkInterval = setInterval(() => {
        if (typeof google !== 'undefined' && google.maps?.Map) {
          clearInterval(checkInterval);
          this.renderMap();
        }
      }, 150);
      setTimeout(() => clearInterval(checkInterval), 4000);
      return;
    }

    // Inyectar el script con la API key activa
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker`;
    script.async = true;
    script.defer = true;
    script.onload = () => this.renderMap();
    script.onerror = () => {
      this.isMapLoading = false;
      this.mapLoadError = true;
      this.cd.detectChanges();
    };
    document.body.appendChild(script);
  }

  /**
   * Renderiza la instancia de Google Maps en el contenedor del DOM `#mapContainer`
   * y añade el marcador interactivo (arrastrable y con clic).
   *
   * @param retries Cantidad de reintentos restantes si el contenedor no está listo en el DOM
   * @returns void
   */
  renderMap(retries = 3): void {
    setTimeout(() => {
      if (!this.mapContainer?.nativeElement) {
        if (retries > 0) {
          this.renderMap(retries - 1);
        } else {
          this.isMapLoading = false;
        }
        return;
      }

      let lat = this.addressForm.get('lat')?.value;
      let lng = this.addressForm.get('lng')?.value;

      if (lat == null || lng == null || isNaN(Number(lat)) || isNaN(Number(lng))) {
        lat = DEFAULT_LIMA_COORDS.lat;
        lng = DEFAULT_LIMA_COORDS.lng;
        this.addressForm.patchValue({ lat, lng });
      }

      const location = { lat: Number(lat), lng: Number(lng) };
      const mapOptions = {
        center: location,
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      };

      this.map = new google.maps.Map(this.mapContainer.nativeElement, mapOptions);
      this.marker = new google.maps.Marker({
        position: location,
        map: this.map,
        draggable: true,
        animation: google.maps.Animation.DROP,
      });

      this.map.addListener('click', (e: any) => this.updateMarkerPosition(e.latLng));
      this.marker.addListener('dragend', (e: any) => this.updateMarkerPosition(e.latLng));

      this.isMapLoading = false;
      this.mapLoadError = false;
      this.mapInitialized = true;
      this.cd.detectChanges();

      // Disparar recálculo de tamaño tras la animación de entrada del modal
      setTimeout(() => {
        if (this.map && typeof google !== 'undefined') {
          google.maps.event.trigger(this.map, 'resize');
          this.map.setCenter(location);
        }
      }, 250);
    }, 60);
  }

  /**
   * Actualiza la posición del marcador y los campos de latitud y longitud del formulario
   * cuando el usuario hace clic en el mapa o arrastra el pin.
   *
   * @param latLng Objeto LatLng provisto por Google Maps
   * @returns void
   */
  private updateMarkerPosition(latLng: any): void {
    const lat = latLng.lat();
    const lng = latLng.lng();
    this.marker.setPosition(latLng);
    this.map.panTo(latLng);
    this.addressForm.patchValue({ lat, lng });
    this.addressForm.get('lat')?.markAsTouched();
    this.addressForm.get('lng')?.markAsTouched();
    this.cd.detectChanges();
  }

  /**
   * Centra el mapa y actualiza la posición del marcador a partir de valores numéricos de coordenadas.
   *
   * @param lat Latitud numérica
   * @param lng Longitud numérica
   * @returns void
   */
  private updateMapCenter(lat: number, lng: number): void {
    if (this.map && this.marker) {
      const pos = { lat, lng };
      this.map.panTo(pos);
      this.map.setZoom(15);
      this.marker.setPosition(pos);
      this.addressForm.patchValue({ lat, lng });
      this.cd.detectChanges();
    }
  }

  // ─── Selects en cascada ───────────────────────────────────────────────────

  /**
   * Manejador del cambio de selección de Departamento.
   * Actualiza las provincias disponibles y centra el mapa en el departamento elegido.
   *
   * @param event Evento Change del elemento select
   * @returns void
   */
  onDepartmentChange(event: Event): void {
    const name = (event.target as HTMLSelectElement).value;
    const dep = this.departments.find(d => d.name === name);
    this.provinces = [];
    this.districts = [];
    this.addressForm.patchValue({ province: '', district: '' });
    if (dep) {
      this.provinces = dep.children ?? [];
      this.updateMapCenter(dep.lat ?? DEFAULT_LIMA_COORDS.lat, dep.lng ?? DEFAULT_LIMA_COORDS.lng);
    }
  }

  /**
   * Manejador del cambio de selección de Provincia.
   * Actualiza los distritos disponibles y centra el mapa en la provincia elegida.
   *
   * @param event Evento Change del elemento select
   * @returns void
   */
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

  /**
   * Manejador del cambio de selección de Distrito.
   * Centra el mapa en las coordenadas del distrito seleccionado.
   *
   * @param event Evento Change del elemento select
   * @returns void
   */
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

import {
  Component, EventEmitter, Input, OnChanges, Output,
  SimpleChanges, OnDestroy, AfterViewInit, ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, takeUntil, finalize } from 'rxjs';

import { StoresService }  from '../../../../core/services/catalog/stores.service';
import { AuthService }    from '../../../../core/services/auth/auth.service';
import { ToastService }   from '../../../../core/services/ui/toast.service';
import { ConfigService }  from '../../../../core/services/utils/config.service';
import {
  Store, DayKey, CreateStoreDto, UpdateStoreDto
} from '../../../../core/interfaces/store.interface';
import {
  PERU_LOCATIONS, Location as PeruLocation
} from '../../../../core/constants/peru-locations';

/** Hack para que TypeScript no se queje de la variable global de Google Maps */
declare const google: any;

// ─── Metadatos de los días de la semana ───────────────────────────────────────

export const DAYS: { key: DayKey; label: string }[] = [
  { key: 'monday',    label: 'Lunes'     },
  { key: 'tuesday',   label: 'Martes'    },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday',  label: 'Jueves'    },
  { key: 'friday',    label: 'Viernes'   },
  { key: 'saturday',  label: 'Sábado'    },
  { key: 'sunday',    label: 'Domingo'   },
];

@Component({
  selector: 'app-form-store',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './form-store.component.html',
  styleUrls: ['./form-store.component.css']
})
export class FormStoreComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() selectedStore: Store | null = null;
  @Input() isEditMode    = false;
  @Output() closeModal   = new EventEmitter<void>();
  @Output() storeSaved   = new EventEmitter<Store>();

  /** Contenedor del mapa Google Maps */
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  readonly days    = DAYS;
  storeForm!:      FormGroup;
  isSaving         = false;
  googleMapsApiKey = '';

  // ─── Selectores de ubicación (Perú) ─────────────────────────────────────
  /** Lista completa de departamentos */
  readonly departments: PeruLocation[] = PERU_LOCATIONS;
  /** Provincias del departamento seleccionado */
  provinces:  PeruLocation[] = [];
  /** Distritos de la provincia seleccionada */
  districts:  PeruLocation[] = [];

  /** Departamento seleccionado (sincronizado con storeForm.location.state) */
  selectedDept:     PeruLocation | null = null;
  /** Provincia seleccionada (sincronizado con storeForm.location.city) */
  selectedProvince: PeruLocation | null = null;

  /** Instancias internas de Google Maps */
  private map:    any;
  private marker: any;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly fb:            FormBuilder,
    private readonly storesService: StoresService,
    private readonly authService:   AuthService,
    private readonly toastService:  ToastService,
    private readonly configService: ConfigService,
  ) {
    this.buildForm();
    this.subscribeToCodeGeneration();

    // Suscribirse a la clave de API de Google Maps desde la configuración global
    this.configService.config$
      .pipe(takeUntil(this.destroy$))
      .subscribe(config => {
        if (config?.googleMapsApiKey) {
          this.googleMapsApiKey = config.googleMapsApiKey;
        }
      });
  }

  // ─── Ciclo de vida ────────────────────────────────────────────────────────

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedStore'] && this.selectedStore) {
      this.patchForm(this.selectedStore);
    }
  }

  ngAfterViewInit(): void {
    // Inicializar el mapa después de que la vista esté lista
    setTimeout(() => this.initMap(), 150);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Formulario ───────────────────────────────────────────────────────────

  /**
   * Construye el FormGroup con la estructura que espera el backend.
   * businessHours: un control por día con { enabled, open, close }
   */
  private buildForm(): void {
    // Sub-grupo de horarios (un FormGroup por día de la semana)
    const hoursGroup: Record<string, FormGroup> = {};
    for (const day of DAYS) {
      hoursGroup[day.key] = this.fb.group({
        enabled: [false],
        open:    ['09:00'],
        close:   ['18:00'],
      });
    }
    // Lunes a viernes habilitados por defecto
    ['monday','tuesday','wednesday','thursday','friday'].forEach(k => {
      hoursGroup[k].get('enabled')!.setValue(true);
    });

    this.storeForm = this.fb.group({
      name:     ['', [Validators.required, Validators.minLength(3)]],
      code:     ['', Validators.required],
      type:     ['physical', Validators.required],
      isActive: [true],
      location: this.fb.group({
        address:    ['', Validators.required],
        city:       ['', Validators.required],
        state:      ['', Validators.required],
        country:    ['Peru', Validators.required],
        postalCode: [''],
        lng: [-77.042793, Validators.required],
        lat: [-12.046374, Validators.required],
      }),
      contact: this.fb.group({
        phone: [''],
        email: ['', Validators.email],
      }),
      businessHours: this.fb.group(hoursGroup),
      capabilities: this.fb.group({
        hasPickup:      [true],
        hasDelivery:    [true],
        deliveryRadius: [0],
        acceptsReturns: [false],
      }),
    });
  }

  /**
   * Rellena el formulario con los datos de una tienda existente.
   * @param store Tienda a editar
   */
  private patchForm(store: Store): void {
    const lng = store.location?.coordinates?.coordinates[0] ?? -77.042793;
    const lat = store.location?.coordinates?.coordinates[1] ?? -12.046374;

    this.storeForm.patchValue({
      name:     store.name,
      code:     store.code     ?? '',
      type:     store.type     ?? 'physical',
      isActive: store.isActive ?? true,
      location: {
        address:    store.location?.address    ?? '',
        city:       store.location?.city       ?? '',
        state:      store.location?.state      ?? '',
        country:    store.location?.country    ?? 'Peru',
        postalCode: store.location?.postalCode ?? '',
        lng, lat,
      },
      contact: {
        phone: store.contact?.phone ?? '',
        email: store.contact?.email ?? '',
      },
      capabilities: {
        hasPickup:      store.capabilities?.hasPickup      ?? false,
        hasDelivery:    store.capabilities?.hasDelivery    ?? false,
        deliveryRadius: store.capabilities?.deliveryRadius ?? 0,
        acceptsReturns: store.capabilities?.acceptsReturns ?? false,
      },
    });

    // Actualizar pin del mapa si ya estaba cargado
    if (this.map && this.marker) {
      const pos = { lat, lng };
      this.marker.setPosition(pos);
      this.map.panTo(pos);
    }

    // Horarios: reset todos → activar los que vengan del backend
    const bhGroup = this.storeForm.get('businessHours') as FormGroup;
    for (const day of DAYS) {
      bhGroup.get(day.key)?.patchValue({ enabled: false, open: '09:00', close: '18:00' });
    }
    if (store.businessHours) {
      for (const [key, schedule] of Object.entries(store.businessHours)) {
        if (schedule) {
          bhGroup.get(key)?.patchValue({ enabled: true, open: schedule.open, close: schedule.close });
        }
      }
    }
  }

  // ─── Google Maps ──────────────────────────────────────────────────────────

  /**
   * Inicializa el mapa. Si la API ya está cargada, renderiza directamente.
   * Si no, carga el script dinámicamente y renderiza al terminar.
   */
  initMap(): void {
    if (!this.googleMapsApiKey || !this.mapContainer) return;

    if (typeof google !== 'undefined') {
      this.renderMap();
    } else {
      // Verificar si el script ya fue inyectado
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        // Script ya cargándose — esperar
        existingScript.addEventListener('load', () => this.renderMap());
        return;
      }
      const script = document.createElement('script');
      script.src   = `https://maps.googleapis.com/maps/api/js?key=${this.googleMapsApiKey}`;
      script.async = true;
      script.defer = true;
      script.onload = () => this.renderMap();
      document.body.appendChild(script);
    }
  }

  /**
   * Renderiza el mapa usando las coordenadas actuales del formulario.
   * El usuario puede hacer clic en el mapa para mover el pin.
   */
  renderMap(): void {
    if (!this.mapContainer?.nativeElement) return;

    setTimeout(() => {
      const lat = this.storeForm.get('location.lat')?.value ?? -12.046374;
      const lng = this.storeForm.get('location.lng')?.value ?? -77.042793;

      this.map = new google.maps.Map(this.mapContainer.nativeElement, {
        center: { lat, lng },
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        gestureHandling: 'cooperative',
      });

      this.marker = new google.maps.Marker({
        position:  { lat, lng },
        map:       this.map,
        draggable: true,
        title:     'Ubicación de la tienda',
      });

      // Click en el mapa → mover pin
      this.map.addListener('click', (event: any) => {
        this.updateMarkerPosition(event.latLng);
      });

      // Arrastrar pin → actualizar formulario
      this.marker.addListener('dragend', (event: any) => {
        this.updateMarkerPosition(event.latLng);
      });
    }, 100);
  }

  /**
   * Actualiza la posición del marcador y sincroniza el formulario.
   * @param latLng Objeto LatLng de Google Maps
   */
  updateMarkerPosition(latLng: any): void {
    const lat = latLng.lat();
    const lng = latLng.lng();

    this.marker.setPosition(latLng);
    this.map.panTo(latLng);

    this.storeForm.get('location')?.patchValue({ lat, lng });
    this.storeForm.get('location.lat')?.markAsTouched();
    this.storeForm.get('location.lng')?.markAsTouched();
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  /**
   * Construye el payload según el schema del backend y lo envía.
   * POST /stores  → admin crea tienda Moorea
   * PATCH /stores/:id → admin actualiza cualquier tienda
   */
  onSubmit(): void {
    if (this.storeForm.invalid) {
      this.storeForm.markAllAsTouched();
      this.toastService.showError('Completa los campos requeridos');
      return;
    }

    this.isSaving = true;
    const raw     = this.storeForm.value;

    // Construir businessHours como objeto { monday: {open, close}, ... }
    const businessHours: Record<string, { open: string; close: string }> = {};
    for (const day of DAYS) {
      const ctrl = raw.businessHours[day.key];
      if (ctrl.enabled) {
        businessHours[day.key] = { open: ctrl.open, close: ctrl.close };
      }
    }

    const payload: CreateStoreDto = {
      name: raw.name,
      code: raw.code,
      type: raw.type,
      location: {
        address:    raw.location.address,
        city:       raw.location.city,
        state:      raw.location.state,
        country:    raw.location.country,
        postalCode: raw.location.postalCode || undefined,
        coordinates: {
          type:        'Point',
          coordinates: [raw.location.lng, raw.location.lat],
        },
      },
      contact: {
        phone: raw.contact.phone || undefined,
        email: raw.contact.email || undefined,
      },
      businessHours,
      capabilities: {
        hasPickup:      raw.capabilities.hasPickup,
        hasDelivery:    raw.capabilities.hasDelivery,
        deliveryRadius: raw.capabilities.deliveryRadius || undefined,
        acceptsReturns: raw.capabilities.acceptsReturns,
      },
    };

    const isSeller = this.authService.hasRole('seller') && !this.authService.hasRole('admin');
    let obs$;
    if (this.isEditMode && this.selectedStore?._id) {
      obs$ = isSeller
        ? this.storesService.updateMyStore(this.selectedStore._id, { ...payload, isActive: raw.isActive } as UpdateStoreDto)
        : this.storesService.updateStore(this.selectedStore._id, { ...payload, isActive: raw.isActive } as UpdateStoreDto);
    } else {
      obs$ = isSeller
        ? this.storesService.createMyStore(payload)
        : this.storesService.createStore(payload);
    }

    obs$.pipe(takeUntil(this.destroy$), finalize(() => { this.isSaving = false; }))
      .subscribe({
        next: (saved) => {
          this.toastService.showSuccess(this.isEditMode ? 'Tienda actualizada ✅' : 'Tienda creada ✅');
          this.storeSaved.emit(saved);
        },
        error: (err) => {
          this.toastService.showError(err?.error?.message ?? 'Error al guardar la tienda');
        },
      });
  }

  /** Cierra el modal sin guardar. */
  onClose(): void {
    this.closeModal.emit();
  }

  // ─── Helpers para el template ─────────────────────────────────────────────

  // ─── Selectores de ubicación ──────────────────────────────────────────────

  /**
   * Maneja el cambio de departamento.
   * Carga las provincias y resetea los niveles inferiores.
   * @param deptId ID del departamento
   */
  onDeptChange(deptId: string): void {
    this.selectedDept     = this.departments.find(d => d.id === deptId) ?? null;
    this.provinces        = this.selectedDept?.children ?? [];
    this.selectedProvince = null;
    this.districts        = [];
    const lat = this.selectedDept?.lat ?? -12.046;
    const lng = this.selectedDept?.lng ?? -77.042;
    this.storeForm.get('location')?.patchValue({ state: this.selectedDept?.name ?? '', city: '', lat, lng });
    this.updateMapCenter(lat, lng);
    this.generateCode();
  }

  /**
   * Maneja el cambio de provincia.
   * Carga los distritos de la provincia seleccionada.
   * @param provId ID de la provincia
   */
  onProvinceChange(provId: string): void {
    this.selectedProvince = this.provinces.find(p => p.id === provId) ?? null;
    this.districts        = this.selectedProvince?.children ?? [];
    const lat = this.selectedProvince?.lat ?? this.selectedDept?.lat ?? -12.046;
    const lng = this.selectedProvince?.lng ?? this.selectedDept?.lng ?? -77.042;
    this.storeForm.get('location')?.patchValue({ city: this.selectedProvince?.name ?? '', lat, lng });
    this.updateMapCenter(lat, lng);
    this.generateCode();
  }

  /**
   * Maneja el cambio de distrito.
   * Actualiza las coordenadas con la posición exacta del distrito.
   * @param distId ID del distrito
   */
  onDistrictChange(distId: string): void {
    const dist = this.districts.find(d => d.id === distId);
    if (!dist) return;
    this.storeForm.get('location')?.patchValue({ lat: dist.lat, lng: dist.lng });
    this.updateMapCenter(dist.lat, dist.lng);
  }

  /**
   * Genera el código de tienda automáticamente:
   * PE-{DEPTO_3}-{NOMBRE_12} todo en mayúsculas separado por guiones.
   * El campo code queda readonly y se actualiza en tiempo real.
   */
  generateCode(): void {
    const loc   = this.storeForm.get('location');
    const name  = (this.storeForm.get('name')?.value  as string) ?? '';
    const state = (loc?.get('state')?.value           as string) ?? '';

    /** Quita tildes, pasa a mayúsculas y reemplaza espacios por guiones */
    const slugify = (str: string): string =>
      str.normalize('NFD')
         .replace(/[\u0300-\u036f]/g, '')
         .toUpperCase()
         .replace(/[^A-Z0-9\s]/g, '')
         .trim()
         .replace(/\s+/g, '-');

    const deptSlug = slugify(state).substring(0, 3);
    const nameSlug = slugify(name).substring(0, 12);
    const parts    = ['PE', deptSlug, nameSlug].filter(Boolean);
    this.storeForm.get('code')?.setValue(parts.join('-'), { emitEvent: false });
  }

  /**
   * Mueve el mapa y el pin a las coordenadas indicadas.
   * @param lat Latitud
   * @param lng Longitud
   */
  private updateMapCenter(lat: number, lng: number): void {
    if (!this.map || !this.marker) return;
    const pos = { lat, lng };
    this.map.setCenter(pos);
    this.marker.setPosition(pos);
  }

  /**
   * Suscribe el campo name para regenerar el código en tiempo real.
   * Debe llamarse tras buildForm().
   */
  private subscribeToCodeGeneration(): void {
    this.storeForm.get('name')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.generateCode());
  }

  /**
   * Devuelve el FormGroup del día indicado (para binding en el template).
   * @param dayKey Clave del día (monday, tuesday, ...)
   */
  getDayGroup(dayKey: DayKey): FormGroup {
    return this.storeForm.get(['businessHours', dayKey]) as FormGroup;
  }
}


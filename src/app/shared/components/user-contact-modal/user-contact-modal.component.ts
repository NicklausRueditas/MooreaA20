import {
  Component,
  OnInit,
  OnChanges,
  Input,
  Output,
  EventEmitter,
  SimpleChanges,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { User } from '../../../core/interfaces/user.interface';

/**
 * Modal interactivo para completar o actualizar los datos obligatorios
 * de contacto (Teléfono / WhatsApp) y facturación legal (Boleta con DNI o Factura con RUC)
 * antes de culminar el proceso de compra.
 */
@Component({
  selector: 'app-user-contact-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './user-contact-modal.component.html',
  styleUrl: './user-contact-modal.component.css',
})
export class UserContactModalComponent implements OnInit, OnChanges {
  /** Controla la visibilidad del modal */
  @Input() isOpen = false;

  /** Usuario autenticado actual cuyos datos se precargarán o actualizarán */
  @Input() user: User | null = null;

  /** Si permite cerrar el modal sin guardar datos (por defecto true) */
  @Input() canCancel = true;

  /** Título personalizado para la cabecera */
  @Input() title = 'Datos de Contacto y Facturación';

  /** Mensaje descriptivo para el cliente */
  @Input() subtitle =
    'Elige tu tipo de comprobante de pago e ingresa tus datos para la entrega y emisión legal del comprobante.';

  /** Evento emitido al cancelar o cerrar el diálogo */
  @Output() closed = new EventEmitter<void>();

  /** Evento emitido cuando los datos de usuario fueron actualizados exitosamente en backend */
  @Output() saved = new EventEmitter<User>();

  contactForm: FormGroup;
  isSaving = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly toastService: ToastService,
    private readonly cd: ChangeDetectorRef,
  ) {
    this.contactForm = this.fb.group({
      invoiceType: ['boleta', [Validators.required]],
      displayName: ['', [Validators.required, Validators.minLength(3)]],
      phone: [
        '',
        [
          Validators.required,
          Validators.pattern(/^(?:\+?51\s*)?9\d{8}$|^\+?\d{9,15}$/),
        ],
      ],
      dni: ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
      ruc: ['', [Validators.pattern(/^\d{11}$/)]],
      businessName: [''],
      fiscalAddress: [''],
    });

    // Escuchar cambios en invoiceType para alternar validaciones
    this.contactForm.get('invoiceType')?.valueChanges.subscribe((type) => {
      this.updateConditionalValidators(type);
    });
  }

  /**
   * Actualiza las reglas de validación según el tipo de comprobante seleccionado (Boleta o Factura).
   *
   * @param type 'boleta' o 'factura'
   * @returns void
   */
  private updateConditionalValidators(type: 'boleta' | 'factura'): void {
    const dniCtrl = this.contactForm.get('dni');
    const rucCtrl = this.contactForm.get('ruc');
    const bNameCtrl = this.contactForm.get('businessName');
    const fAddrCtrl = this.contactForm.get('fiscalAddress');

    if (type === 'factura') {
      dniCtrl?.clearValidators();
      rucCtrl?.setValidators([Validators.required, Validators.pattern(/^\d{11}$/)]);
      bNameCtrl?.setValidators([Validators.required, Validators.minLength(3)]);
      fAddrCtrl?.setValidators([Validators.required, Validators.minLength(5)]);
    } else {
      dniCtrl?.setValidators([Validators.required, Validators.pattern(/^\d{8}$/)]);
      rucCtrl?.clearValidators();
      bNameCtrl?.clearValidators();
      fAddrCtrl?.clearValidators();
    }

    dniCtrl?.updateValueAndValidity();
    rucCtrl?.updateValueAndValidity();
    bNameCtrl?.updateValueAndValidity();
    fAddrCtrl?.updateValueAndValidity();
    this.cd.detectChanges();
  }

  /**
   * Permite al usuario cambiar entre Boleta o Factura haciendo clic en los botones de tipo pill.
   *
   * @param type Tipo de comprobante seleccionado
   */
  selectInvoiceType(type: 'boleta' | 'factura'): void {
    this.contactForm.patchValue({ invoiceType: type });
    this.updateConditionalValidators(type);
  }

  get currentInvoiceType(): 'boleta' | 'factura' {
    return this.contactForm.get('invoiceType')?.value || 'boleta';
  }

  /**
   * Ciclo de vida OnInit: inicializa los valores del formulario según el usuario disponible.
   *
   * @returns void
   */
  ngOnInit(): void {
    this.populateForm();
  }

  /**
   * Ciclo de vida OnChanges: detecta cambios en la apertura del modal o cambios en el usuario
   * para refrescar los controles del formulario reactivo.
   *
   * @param changes Cambios detectados en las propiedades @Input()
   * @returns void
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.populateForm();
    }
    if (changes['user'] && this.user) {
      this.populateForm();
    }
  }

  /**
   * Carga los valores actuales del usuario en el formulario reactivo.
   *
   * @returns void
   */
  private populateForm(): void {
    if (!this.user) return;

    let phoneValue = this.user.phone || '';
    if (phoneValue.startsWith('+51') && phoneValue.length === 12) {
      phoneValue = phoneValue.substring(3).trim();
    }

    const preferredType =
      this.user.invoicePreference ||
      (this.user.ruc && this.user.businessName ? 'factura' : 'boleta');

    this.contactForm.patchValue({
      invoiceType: preferredType,
      displayName: this.user.displayName || '',
      phone: phoneValue,
      dni: this.user.dni || '',
      ruc: this.user.ruc || '',
      businessName: this.user.businessName || '',
      fiscalAddress: this.user.fiscalAddress || '',
    });

    this.updateConditionalValidators(preferredType);
    this.cd.detectChanges();
  }

  /**
   * Cierra el modal emitiendo el evento correspondiente si está habilitada la cancelación.
   *
   * @returns void
   */
  close(): void {
    if (!this.canCancel) return;
    this.closed.emit();
  }

  /**
   * Envía los datos actualizados a la API (`PATCH /sesion/profile`) y emite el usuario actualizado.
   *
   * @returns void
   */
  onSubmit(): void {
    if (this.contactForm.invalid) {
      this.markAllTouched(this.contactForm);
      this.toastService.showWarning('Por favor completa todos los campos requeridos con formato válido.');
      return;
    }

    const {
      invoiceType,
      displayName,
      phone,
      dni,
      ruc,
      businessName,
      fiscalAddress,
    } = this.contactForm.value;

    // Normalizar formato de celular
    const cleanPhoneDigits = String(phone).replace(/\D/g, '');
    let normalizedPhone = String(phone).trim();
    if (cleanPhoneDigits.length === 9 && cleanPhoneDigits.startsWith('9')) {
      normalizedPhone = `+51${cleanPhoneDigits}`;
    } else if (cleanPhoneDigits.length === 11 && cleanPhoneDigits.startsWith('519')) {
      normalizedPhone = `+${cleanPhoneDigits}`;
    }

    const payload: Partial<User> = {
      displayName: String(displayName).trim(),
      phone: normalizedPhone,
      invoicePreference: invoiceType,
    };

    if (invoiceType === 'factura') {
      payload.ruc = String(ruc).replace(/\D/g, '');
      payload.businessName = String(businessName).trim();
      payload.fiscalAddress = String(fiscalAddress).trim();
    } else {
      payload.dni = String(dni).replace(/\D/g, '');
    }

    this.isSaving = true;
    this.cd.detectChanges();

    this.authService.updateProfile(payload).subscribe({
      next: (updatedUser: User) => {
        this.isSaving = false;
        this.toastService.showSuccess('Datos de contacto y facturación actualizados correctamente.');
        this.saved.emit(updatedUser);
        this.closed.emit();
        this.cd.detectChanges();
      },
      error: (err: any) => {
        this.isSaving = false;
        const msg = err?.error?.message || err?.message || 'Error al guardar datos';
        this.toastService.showError(`No se pudieron guardar los datos: ${msg}`);
        this.cd.detectChanges();
      },
    });
  }

  /**
   * Marca recursivamente todos los controles de un FormGroup como tocados para disparar mensajes de error visuales.
   *
   * @param fg Formulario reactivo
   * @returns void
   */
  private markAllTouched(fg: FormGroup): void {
    Object.values(fg.controls).forEach((ctrl) => {
      ctrl.markAsTouched();
      if (ctrl instanceof FormGroup) {
        this.markAllTouched(ctrl);
      }
    });
  }
}

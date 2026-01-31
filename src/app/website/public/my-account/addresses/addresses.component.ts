import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AddressService } from '../../../../core/services/address.service';
import { CommonModule } from '@angular/common';
import { 
  AddressData, 
  UpdateAddressDto,
  AddressResponse,
  CreateAddressResponse,
  ListAddressesResponse,
  DefaultAddressResponse
} from '../../../../core/interfaces/address.interface';

@Component({
  selector: 'app-addresses',
  templateUrl: './addresses.component.html',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  styleUrls: ['./addresses.component.scss'],
})
export class AddressesComponent implements OnInit {
  addresses: AddressData[] = [];
  isLoading = false;
  showModal = false;
  editMode = false;
  currentAddressId: string | null = null;
  defaultAddress: AddressData | null = null;

  // Formulario con validaciones actualizadas
  addressForm: FormGroup = this.fb.group({
    alias: ['', [Validators.required, Validators.maxLength(50)]],
    street: ['', [Validators.required, Validators.maxLength(100)]],
    streetNumber: ['', [Validators.required, Validators.maxLength(20)]],
    apartment: ['', [Validators.maxLength(20)]],
    district: ['', [Validators.required, Validators.maxLength(50)]],
    province: ['', [Validators.required, Validators.maxLength(50)]],
    department: ['', [Validators.required, Validators.maxLength(50)]],
    postalCode: ['', [Validators.required, Validators.maxLength(20)]],
    country: ['PE', [
      Validators.required, 
      Validators.maxLength(2), 
      Validators.pattern(/^[A-Z]{2}$/)
    ]],
    references: ['', [Validators.maxLength(200)]],
    isDefault: [false],
    lat: [null, [Validators.pattern(/^-?\d{1,3}\.\d{1,6}$/)]],
    lng: [null, [Validators.pattern(/^-?\d{1,3}\.\d{1,6}$/)]],
    placeId: [''],
    distanceFromStore: [null, [Validators.min(0)]]
  });

  constructor(
    private addressService: AddressService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.loadAddresses();
    this.loadDefaultAddress();
  }

  /**
   * Carga las direcciones del usuario
   */
  loadAddresses(): void {
    this.isLoading = true;
    this.addressService.getUserAddresses().subscribe({
      next: (response: ListAddressesResponse) => {
        this.addresses = response.addresses || [];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar direcciones:', error);
        this.isLoading = false;
      },
    });
  }

  /**
   * Carga la dirección predeterminada del usuario
   */
  loadDefaultAddress(): void {
    this.addressService.getDefaultAddress().subscribe({
      next: (response: DefaultAddressResponse) => {
        this.defaultAddress = response.address || null;
      },
      error: (error) => {
        console.error('Error al cargar dirección predeterminada:', error);
      },
    });
  }

  /**
   * Abre el modal para agregar una nueva dirección
   */
  openAddAddressModal(): void {
    this.editMode = false;
    this.currentAddressId = null;
    this.addressForm.reset({ 
      country: 'PE',
      isDefault: false 
    });
    this.showModal = true;
  }

  /**
   * Abre el modal para editar una dirección existente
   * @param address Datos de la dirección a editar
   */
  openEditModal(address: AddressData): void {
    this.editMode = true;
    this.currentAddressId = address._id || null;
    this.addressForm.patchValue(address);
    this.showModal = true;
  }

  /**
   * Cierra el modal y resetea el formulario
   */
  closeModal(): void {
    this.showModal = false;
    this.addressForm.reset({ 
      country: 'PE',
      isDefault: false 
    });
  }

  /**
   * Maneja el envío del formulario
   */
  onSubmit(): void {
    if (this.addressForm.invalid) {
      this.markFormGroupTouched(this.addressForm);
      return;
    }

    const formData = this.addressForm.value;

    if (this.editMode && this.currentAddressId) {
      this.updateAddress(this.currentAddressId, formData);
    } else {
      this.createAddress(formData);
    }
  }

  /**
   * Crea una nueva dirección
   * @param addressData Datos de la dirección a crear
   */
  createAddress(addressData: Omit<AddressData, '_id' | 'createdAt' | 'updatedAt' | 'userId'>): void {
    this.addressService.createAddress(addressData).subscribe({
      next: (response: CreateAddressResponse) => {
        if (response.address) {
          this.addresses.push(response.address);
          if (response.address.isDefault) {
            this.defaultAddress = response.address;
          }
          alert('Dirección creada exitosamente!');
          this.closeModal();
        }
      },
      error: (error) => {
        console.error('Error al crear dirección:', error);
        alert('Error al crear dirección');
      },
    });
  }

  /**
   * Actualiza una dirección existente
   * @param addressId ID de la dirección a actualizar
   * @param updateData Datos actualizados
   */
  updateAddress(addressId: string, updateData: UpdateAddressDto): void {
    this.addressService.updateAddress(addressId, updateData).subscribe({
      next: (response: AddressResponse) => {
        if (response.address) {
          const index = this.addresses.findIndex(a => a._id === addressId);
          if (index !== -1) {
            this.addresses[index] = response.address;
          }
          if (response.address.isDefault) {
            this.defaultAddress = response.address;
          }
          alert('Dirección actualizada exitosamente!');
          this.closeModal();
        }
      },
      error: (error) => {
        console.error('Error al actualizar dirección:', error);
        alert('Error al actualizar dirección');
      },
    });
  }

  /**
   * Establece una dirección como predeterminada
   * @param addressId ID de la dirección a establecer como predeterminada
   */
  setAsDefault(addressId: string): void {
    if (confirm('¿Establecer esta dirección como predeterminada?')) {
      this.addressService.setDefaultAddress(addressId).subscribe({
        next: (response: DefaultAddressResponse) => {
          if (response.address) {
            this.defaultAddress = response.address;
            this.addresses.forEach(a => {
              a.isDefault = a._id === addressId;
            });
            alert('Dirección predeterminada actualizada!');
          }
        },
        error: (error) => {
          console.error('Error al establecer dirección predeterminada:', error);
          alert('Error al establecer dirección predeterminada');
        },
      });
    }
  }

  /**
   * Elimina una dirección
   * @param addressId ID de la dirección a eliminar
   */
  deleteAddress(addressId: string): void {
    if (confirm('¿Estás seguro de eliminar esta dirección?')) {
      this.addressService.deleteAddress(addressId).subscribe({
        next: () => {
          this.addresses = this.addresses.filter(a => a._id !== addressId);
          if (this.defaultAddress?._id === addressId) {
            this.defaultAddress = null;
          }
          alert('Dirección eliminada exitosamente!');
        },
        error: (error) => {
          console.error('Error al eliminar dirección:', error);
          alert('Error al eliminar dirección');
        },
      });
    }
  }

  /**
   * Marca todos los controles de un FormGroup como touched
   * @param formGroup FormGroup a marcar
   */
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }
}
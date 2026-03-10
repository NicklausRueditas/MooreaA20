import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

import { AddressService } from '../../../../core/services/utils/address.service';
import { ToastService } from '../../../../core/services/ui/toast.service';
import { ConfigService } from '../../../../core/services/utils/config.service';
import { ToastComponent } from '../../../../shared/components/toast/toast.component';
import { AddressModalComponent } from '../../../../shared/components/address-modal/address-modal.component';

import {
  AddressData,
  ListAddressesResponse,
  DefaultAddressResponse,
} from '../../../../core/interfaces/address.interface';

@Component({
  selector: 'app-addresses',
  templateUrl: './addresses.component.html',
  standalone: true,
  imports: [CommonModule, ToastComponent, AddressModalComponent],
  styleUrls: ['./addresses.component.scss'],
})
export class AddressesComponent implements OnInit, OnDestroy {
  addresses: AddressData[] = [];
  isLoading = false;
  defaultAddress: AddressData | null = null;
  /** API key para las thumbnails del mapa estático en las cards de la lista */
  googleMapsApiKey = '';

  // ─── Modal ──────────────────────────────────────────────────────────────
  showAddressModal = false;
  addressToEdit: AddressData | null = null;

  private subscriptions = new Subscription();

  constructor(
    private readonly addressService: AddressService,
    private readonly toastService: ToastService,
    private readonly configService: ConfigService,
    private readonly cd: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadAddresses();
    this.subscriptions.add(
      this.configService.config$.subscribe(config => {
        if (config) this.googleMapsApiKey = config.googleMapsApiKey;
      })
    );
  }
  ngOnDestroy(): void { this.subscriptions.unsubscribe(); }

  // ─── Apertura del modal ───────────────────────────────────────────────────
  openAddAddressModal(): void {
    this.addressToEdit = null;
    this.showAddressModal = true;
  }

  openEditModal(address: AddressData): void {
    this.addressToEdit = address;
    this.showAddressModal = true;
  }

  onModalClosed(): void {
    this.showAddressModal = false;
    this.addressToEdit = null;
  }

  onAddressSaved(saved: AddressData): void {
    this.loadAddresses();
  }

  loadAddresses(): void {
    this.isLoading = true;
    this.addressService.getUserAddresses().subscribe({
      next: (response: ListAddressesResponse | AddressData[]) => {
        if (Array.isArray(response)) {
          this.addresses = response;
        } else if (response && 'address' in response && Array.isArray(response.address)) {
          this.addresses = response.address ?? [];
        } else if (response && 'addresses' in response) {
          this.addresses = response.addresses ?? [];
        } else {
          this.addresses = [];
        }
        this.isLoading = false;
        this.cd.detectChanges();
        if (this.addresses.length > 0) this.loadDefaultAddress();
      },
      error: () => { this.isLoading = false; this.cd.detectChanges(); },
    });
  }

  loadDefaultAddress(): void {
    this.addressService.getDefaultAddress().subscribe({
      next: (res: DefaultAddressResponse) => { this.defaultAddress = res.address ?? null; },
      error: () => {},
    });
  }

  setAsDefault(addressId: string): void {
    this.toastService.showConfirm(
      '¿Establecer esta dirección como predeterminada?',
      () => {
        this.addressService.setDefaultAddress(addressId).subscribe({
          next: (res: DefaultAddressResponse) => {
            if (res.address) {
              this.defaultAddress = res.address;
              this.addresses.forEach(a => { a.isDefault = a._id === addressId; });
              this.toastService.showSuccess('Dirección predeterminada actualizada!');
            }
          },
          error: () => this.toastService.showError('Error al establecer dirección predeterminada'),
        });
      },
      undefined, 'Sí, establecer', 'Cancelar'
    );
  }

  deleteAddress(addressId: string): void {
    this.toastService.showConfirm(
      '¿Estás seguro de eliminar esta dirección?',
      () => {
        this.addressService.deleteAddress(addressId).subscribe({
          next: () => {
            this.addresses = this.addresses.filter(a => a._id !== addressId);
            if (this.defaultAddress?._id === addressId) this.defaultAddress = null;
            this.toastService.showSuccess('Dirección eliminada exitosamente!');
          },
          error: () => this.toastService.showError('Error al eliminar dirección'),
        });
      },
      undefined, 'Sí, eliminar', 'Cancelar'
    );
  }
}
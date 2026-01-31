import { ChangeDetectorRef, Component, OnInit, Input } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { User } from '../../../../core/interfaces/user.interface';

import { firstValueFrom } from 'rxjs';
import { SesionService } from '../../../../core/services/sesion.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  userData: Partial<User> | null = null;
  userForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private sesionService: SesionService,

    private cdr: ChangeDetectorRef
  ) {
    this.initForm();
  }

   /** 📌 Inicializa el formulario con validaciones */
  private initForm() {
    this.userForm = this.fb.group({
      displayName: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      dni: [''],
      addresses: this.fb.array([]), // 📌 Arreglo de direcciones (ObjectId)
      cards: this.fb.array([]), // 📌 Arreglo de tarjetas (ObjectId)
    });
  }

  /** 🔄 Obtiene el perfil del usuario al iniciar */
  async ngOnInit() {
    try {
      this.userData = await firstValueFrom(this.sesionService.getProfile());
      if (this.userData) {
        this.populateForm();
      }
    } catch (error) {
      console.error('❌ Error al cargar el perfil del usuario:', error);
    }
  }

  /** 📌 Rellena el formulario con los datos del usuario */
  private populateForm() {
    this.userForm.patchValue({
      displayName: this.userData?.displayName || '',
      email: this.userData?.email || '',
      dni: this.userData?.dni || '',
      phone: this.userData?.phone|| '',
    });

    this.cdr.detectChanges(); // 🔄 Forzar actualización de la vista
  }

  /** 📌 Agrega valores a un FormArray */
  private setFormArray(field: string, values: string[]) {
    const formArray = this.userForm.get(field) as FormArray;
    formArray.clear(); // 🔄 Limpia el array antes de agregar nuevos valores

    values.forEach((value) =>
      formArray.push(this.fb.control(value, [Validators.required]))
    );
  }
}

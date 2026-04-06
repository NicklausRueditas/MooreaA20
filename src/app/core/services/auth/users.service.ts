import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SellerUser, CreateSellerUserDto } from '../../interfaces/seller.interface';

/**
 * Servicio de gestión de usuarios (Admin).
 * Cubre los endpoints bajo /manage/user/.
 */
@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly manageUrl = `${environment.apiUrl}/manage/user`;

  constructor(private readonly http: HttpClient) {}

  /**
   * Crea un nuevo usuario con el rol indicado.
   * @param dto Datos del usuario + roles (ej. ['seller'])
   * @returns El usuario creado
   */
  createUser(dto: CreateSellerUserDto): Observable<SellerUser> {
    return this.http.post<SellerUser>(`${this.manageUrl}/create`, dto);
  }
}

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, shareReplay, catchError } from 'rxjs/operators';

export interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
  children?: Location[];
}

@Injectable({
  providedIn: 'root'
})
export class LocationsService {
  private readonly jsonUrl = 'assets/data/peru-locations.json';
  private locations$: Observable<Location[]> | null = null;

  constructor(private readonly http: HttpClient) {}

  /**
   * Carga y cachea la jerarquía completa de ubicaciones de Perú (Departamentos -> Provincias -> Distritos).
   * Usa shareReplay(1) para garantizar que la solicitud HTTP se ejecute solo una vez durante la sesión.
   */
  getLocations(): Observable<Location[]> {
    if (!this.locations$) {
      this.locations$ = this.http.get<Location[]>(this.jsonUrl).pipe(
        shareReplay(1),
        catchError(err => {
          console.error('Error al cargar assets/data/peru-locations.json:', err);
          return of([]);
        })
      );
    }
    return this.locations$;
  }

  /**
   * Retorna la lista de departamentos disponibles.
   */
  getDepartments(): Observable<Location[]> {
    return this.getLocations();
  }

  /**
   * Retorna las provincias del departamento indicado (por ID o nombre).
   */
  getProvinces(deptIdOrName: string): Observable<Location[]> {
    return this.getLocations().pipe(
      map(depts => {
        const dept = depts.find(d => d.id === deptIdOrName || d.name.toLowerCase() === deptIdOrName.toLowerCase());
        return dept?.children ?? [];
      })
    );
  }

  /**
   * Retorna los distritos de la provincia indicada.
   */
  getDistricts(deptIdOrName: string, provIdOrName: string): Observable<Location[]> {
    return this.getProvinces(deptIdOrName).pipe(
      map(provinces => {
        const prov = provinces.find(p => p.id === provIdOrName || p.name.toLowerCase() === provIdOrName.toLowerCase());
        return prov?.children ?? [];
      })
    );
  }
}

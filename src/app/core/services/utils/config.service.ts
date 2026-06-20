import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export interface AppConfig {
    googleMapsApiKey: string;
}

@Injectable({
    providedIn: 'root'
})
export class ConfigService {
    private apiUrl = `${environment.apiUrl}/config`;
    private configSubject = new BehaviorSubject<AppConfig | null>(null);
    config$ = this.configSubject.asObservable();

    constructor(private http: HttpClient) {
        this.loadConfig();
    }

    loadConfig(): void {
        this.http.get<AppConfig>(this.apiUrl).pipe(
            tap(config => {
                console.log('App Config Loaded:', config);
                this.configSubject.next(config);
            }),
            catchError(error => {
                console.error('Error loading config:', error);
                return of(null);
            })
        ).subscribe();
    }

    getGoogleMapsApiKey(): string {
        return this.configSubject.value?.googleMapsApiKey || '';
    }
}

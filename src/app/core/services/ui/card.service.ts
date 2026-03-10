import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Card, CreateCardDto, UpdateCardDto, CardResponse } from '../../interfaces/card.interface';

@Injectable({
    providedIn: 'root'
})
export class CardService {
    private apiUrl = `${environment.apiUrl}/cards`;

    constructor(private http: HttpClient) { }

    /**
     * Obtener todas las tarjetas del usuario
     */
    getCards(): Observable<Card[] | CardResponse> {
        return this.http.get<Card[] | CardResponse>(this.apiUrl);
    }

    /**
     * Obtener una tarjeta por ID
     * @param id ID de la tarjeta
     */
    getCard(id: string): Observable<Card | CardResponse> {
        return this.http.get<Card | CardResponse>(`${this.apiUrl}/${id}`);
    }

    /**
     * Crear una nueva tarjeta
     * @param card Datos de la tarjeta
     */
    createCard(card: CreateCardDto): Observable<CardResponse | Card> {
        return this.http.post<CardResponse | Card>(this.apiUrl, card);
    }

    /**
     * Actualizar una tarjeta
     * @param id ID de la tarjeta
     * @param card Datos a actualizar
     */
    updateCard(id: string, card: UpdateCardDto): Observable<CardResponse | Card> {
        return this.http.patch<CardResponse | Card>(`${this.apiUrl}/${id}`, card);
    }

    /**
     * Eliminar una tarjeta
     * @param id ID de la tarjeta
     */
    deleteCard(id: string): Observable<any> {
        return this.http.delete(`${this.apiUrl}/${id}`);
    }
}

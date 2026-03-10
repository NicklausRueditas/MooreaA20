import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Store, StoreWorker, CoverageZone, InventoryItem } from '../../interfaces/store.interface';

@Injectable({
    providedIn: 'root'
})
export class StoresService {
    private apiUrl = 'http://localhost:3000/stores';
    private inventoryUrl = 'http://localhost:3000/inventory';

    constructor(private http: HttpClient) { }

    // ─── TIENDAS ────────────────────────────────────────────────────────────────

    /** Crear una nueva tienda */
    createStore(store: Partial<Store>): Observable<Store> {
        return this.http.post<Store>(this.apiUrl, store);
    }

    /** Obtener todas las tiendas */
    getAllStores(): Observable<Store[]> {
        return this.http.get<Store[]>(this.apiUrl);
    }

    /** Obtener solo tiendas activas */
    getActiveStores(): Observable<Store[]> {
        return this.http.get<Store[]>(`${this.apiUrl}/active`);
    }

    /** Obtener tienda por ID */
    getStoreById(id: string): Observable<Store> {
        return this.http.get<Store>(`${this.apiUrl}/${id}`);
    }

    /** Actualizar tienda */
    updateStore(id: string, updates: Partial<Store>): Observable<Store> {
        return this.http.patch<Store>(`${this.apiUrl}/${id}`, updates);
    }

    /** Eliminar tienda */
    deleteStore(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }

    // ─── TRABAJADORES ────────────────────────────────────────────────────────────

    /** Agregar trabajador a la tienda */
    addWorker(storeId: string, worker: StoreWorker): Observable<Store> {
        return this.http.post<Store>(`${this.apiUrl}/${storeId}/workers`, worker);
    }

    // ─── ZONAS DE COBERTURA ──────────────────────────────────────────────────────

    /** Agregar zona de cobertura */
    addCoverageZone(storeId: string, zone: CoverageZone): Observable<Store> {
        return this.http.post<Store>(`${this.apiUrl}/${storeId}/coverage-zones`, zone);
    }

    // ─── INVENTARIO (/inventory) ─────────────────────────────────────────────────

    /** Obtener inventario de una tienda */
    getInventoryByStore(storeId: string): Observable<InventoryItem[]> {
        return this.http.get<InventoryItem[]>(`${this.inventoryUrl}/store/${storeId}`);
    }

    /** Crear registro de inventario (variante + tienda) */
    createInventoryItem(item: Partial<InventoryItem>): Observable<InventoryItem> {
        return this.http.post<InventoryItem>(this.inventoryUrl, item);
    }

    /** Incrementar stock (reabastecimiento) */
    increaseStock(variantId: string, storeId: string, quantity: number): Observable<InventoryItem> {
        return this.http.patch<InventoryItem>(
            `${this.inventoryUrl}/increase/${variantId}/${storeId}`,
            { quantity }
        );
    }

    /** Reducir stock (venta completada) */
    reduceStock(variantId: string, storeId: string, quantity: number): Observable<InventoryItem> {
        return this.http.patch<InventoryItem>(
            `${this.inventoryUrl}/reduce/${variantId}/${storeId}`,
            { quantity }
        );
    }

    /** Actualizar registro de inventario */
    updateInventoryItem(id: string, updates: Partial<InventoryItem>): Observable<InventoryItem> {
        return this.http.patch<InventoryItem>(`${this.inventoryUrl}/${id}`, updates);
    }

    /** Eliminar registro de inventario */
    deleteInventoryItem(id: string): Observable<void> {
        return this.http.delete<void>(`${this.inventoryUrl}/${id}`);
    }

    /** Verificar disponibilidad de stock */
    checkAvailability(variantId: string, storeId: string, quantity: number): Observable<{ available: boolean }> {
        return this.http.get<{ available: boolean }>(
            `${this.inventoryUrl}/availability/${variantId}/${storeId}?quantity=${quantity}`
        );
    }

    /** Buscar productos con stock bajo */
    getLowStock(storeId?: string): Observable<InventoryItem[]> {
        const url = storeId
            ? `${this.inventoryUrl}/low-stock?storeId=${storeId}`
            : `${this.inventoryUrl}/low-stock`;
        return this.http.get<InventoryItem[]>(url);
    }
}

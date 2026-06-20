import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
    Store, StoreWorker, CoverageZone, InventoryItem,
    CreateStoreDto, UpdateStoreDto
} from '../../interfaces/store.interface';

@Injectable({ providedIn: 'root' })
export class StoresService {
    private readonly apiUrl      = `${environment.apiUrl}/stores`;
    private readonly inventoryUrl = `${environment.apiUrl}/inventory`;

    constructor(private readonly http: HttpClient) { }

    // ─── TIENDAS ──────────────────────────────────────────────────────────────

    /** [Admin] Crear tienda Moorea → POST /stores */
    createStore(dto: CreateStoreDto): Observable<Store> {
        return this.http.post<Store>(this.apiUrl, dto);
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

    /** [Admin] Actualizar cualquier tienda → PATCH /stores/:id */
    updateStore(id: string, updates: UpdateStoreDto): Observable<Store> {
        return this.http.patch<Store>(`${this.apiUrl}/${id}`, updates);
    }

    /** Eliminar tienda */
    deleteStore(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }

    // ─── TRABAJADORES ─────────────────────────────────────────────────────────

    /** Agregar trabajador a la tienda → POST /stores/:storeId/workers */
    addWorker(storeId: string, worker: StoreWorker): Observable<Store> {
        return this.http.post<Store>(`${this.apiUrl}/${storeId}/workers`, worker);
    }

    // ─── ZONAS DE COBERTURA ───────────────────────────────────────────────────

    /** Agregar zona de cobertura → POST /stores/:storeId/coverage-zones */
    addCoverageZone(storeId: string, zone: CoverageZone): Observable<Store> {
        return this.http.post<Store>(`${this.apiUrl}/${storeId}/coverage-zones`, zone);
    }

    // ─── INVENTARIO (/inventory) ──────────────────────────────────────────────
    // Contratos: api-requests.http L486-607

    /**
     * [Seller] Inventario de la propia tienda del seller autenticado.
     * GET /inventory/my-store
     */
    getMyStoreInventory(): Observable<InventoryItem[]> {
        return this.http.get<InventoryItem[]>(`${this.inventoryUrl}/my-store`);
    }

    /**
     * Obtener inventario de una tienda específica.
     * GET /inventory/store/:storeId
     */
    getInventoryByStore(storeId: string): Observable<InventoryItem[]> {
        return this.http.get<InventoryItem[]>(`${this.inventoryUrl}/store/${storeId}`);
    }

    /**
     * Obtener el stock de una variante en todas las tiendas.
     * GET /inventory/variant/:variantId
     */
    getInventoryByVariant(variantId: string): Observable<InventoryItem[]> {
        return this.http.get<InventoryItem[]>(`${this.inventoryUrl}/variant/${variantId}`);
    }

    /**
     * Crear registro de inventario (variante + tienda).
     * POST /inventory — body tipado según .http L532-546
     * Incluye location (aisle/shelf/bin) que antes estaba ausente.
     *
     * @param item Datos del registro a crear
     */
    createInventoryItem(item: {
        variantId:         string;
        storeId:           string;
        quantity:          number;
        reservedQuantity?: number;
        location?: {
            aisle?: string;
            shelf?: string;
            bin?:   string;
        };
        reorderPoint?:    number;
        reorderQuantity?: number;
        cost?:            number;
        wholesalePrice?:  number;
    }): Observable<InventoryItem> {
        return this.http.post<InventoryItem>(this.inventoryUrl, item);
    }

    /**
     * Reservar stock para un carrito.
     * POST /inventory/reserve — body: { variantId, storeId, quantity }
     *
     * @param variantId ID de la variante
     * @param storeId   ID de la tienda
     * @param quantity  Cantidad a reservar
     */
    reserveStock(variantId: string, storeId: string, quantity: number): Observable<InventoryItem> {
        return this.http.post<InventoryItem>(`${this.inventoryUrl}/reserve`, {
            variantId, storeId, quantity
        });
    }

    /**
     * Liberar stock reservado.
     * POST /inventory/release — body: { variantId, storeId, quantity }
     *
     * @param variantId ID de la variante
     * @param storeId   ID de la tienda
     * @param quantity  Cantidad a liberar
     */
    releaseStock(variantId: string, storeId: string, quantity: number): Observable<InventoryItem> {
        return this.http.post<InventoryItem>(`${this.inventoryUrl}/release`, {
            variantId, storeId, quantity
        });
    }

    /**
     * Incrementar stock (reabastecimiento).
     * PATCH /inventory/increase/:variantId/:storeId — body: { quantity }
     */
    increaseStock(variantId: string, storeId: string, quantity: number): Observable<InventoryItem> {
        return this.http.patch<InventoryItem>(
            `${this.inventoryUrl}/increase/${variantId}/${storeId}`,
            { quantity }
        );
    }

    /**
     * Reducir stock (venta completada).
     * PATCH /inventory/reduce/:variantId/:storeId — body: { quantity }
     */
    reduceStock(variantId: string, storeId: string, quantity: number): Observable<InventoryItem> {
        return this.http.patch<InventoryItem>(
            `${this.inventoryUrl}/reduce/${variantId}/${storeId}`,
            { quantity }
        );
    }

    /**
     * Actualizar registro de inventario.
     * PATCH /inventory/:id — acepta reorderPoint, reorderQuantity, location (.http L588-601)
     *
     * @param id      ID del registro de inventario
     * @param updates Campos a actualizar
     */
    updateInventoryItem(id: string, updates: {
        reorderPoint?:    number;
        reorderQuantity?: number;
        location?: { aisle?: string; shelf?: string; bin?: string };
    }): Observable<InventoryItem> {
        return this.http.patch<InventoryItem>(`${this.inventoryUrl}/${id}`, updates);
    }

    /**
     * Eliminar registro de inventario.
     * DELETE /inventory/:id
     */
    deleteInventoryItem(id: string): Observable<void> {
        return this.http.delete<void>(`${this.inventoryUrl}/${id}`);
    }

    /**
     * Verificar disponibilidad de stock.
     * GET /inventory/availability/:variantId/:storeId?quantity=N
     *
     * @param variantId ID de la variante
     * @param storeId   ID de la tienda
     * @param quantity  Cantidad a verificar
     */
    checkAvailability(variantId: string, storeId: string, quantity: number): Observable<{ available: boolean }> {
        return this.http.get<{ available: boolean }>(
            `${this.inventoryUrl}/availability/${variantId}/${storeId}?quantity=${quantity}`
        );
    }

    /**
     * Buscar productos con stock bajo.
     * GET /inventory/low-stock               → global
     * GET /inventory/low-stock?storeId=<id>  → filtrado por tienda
     *
     * @param storeId Opcional — ID de la tienda a filtrar
     */
    getLowStock(storeId?: string): Observable<InventoryItem[]> {
        const url = storeId
            ? `${this.inventoryUrl}/low-stock?storeId=${storeId}`
            : `${this.inventoryUrl}/low-stock`;
        return this.http.get<InventoryItem[]>(url);
    }

    /**
     * Buscar productos completamente sin stock.
     * GET /inventory/out-of-stock
     * ⚠️ Es un GET — NO enviar body en la petición.
     */
    getOutOfStock(): Observable<InventoryItem[]> {
        return this.http.get<InventoryItem[]>(`${this.inventoryUrl}/out-of-stock`);
    }
}

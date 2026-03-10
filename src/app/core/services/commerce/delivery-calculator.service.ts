import { Injectable } from '@angular/core';
import { Product } from '../../interfaces/product.interface';

// Definimos tipos para las unidades y dimensiones
export type WeightUnit = 'kg' | 'g';
export type DimensionType =
  | 'DIMS' // Productos con dimensiones
  | 'TALLA' // Prendas de vestir
  | 'SHOES' // Calzado
  | 'PULGADAS' // Dispositivos electrónicos
  | 'LITROS' // Capacidad en litros
  | 'PLAZAS' // Camas
  | 'PERFIL' // Neumáticos
  | 'PAGINAS' // Libros
  | 'DIAMETRO'; // Reloj


@Injectable({
  providedIn: 'root',
})
export class DeliveryCalculatorService {
  // Precios base por tipo de producto (en soles)
  private basePrices: Record<DimensionType, number> = {
    DIMS: 18,
    TALLA: 7,
    SHOES: 8,
    PULGADAS: 10,
    LITROS: 12,
    PLAZAS: 45,
    PERFIL: 35,
    PAGINAS: 7,
    DIAMETRO: 5,
  };

  private distanceFactor = 0.5; // Soles por km adicional
  private minDistance = 5; // Distancia mínima para cálculo

  // Factores de peso
  private weightFactors = {
    kg: {
      base: 1,
      threshold: 3,
      extra: 2,
    },
    g: {
      base: 0.001,
      threshold: 5000,
      extra: 0.002,
    },
  };

  /**
   * Calcula el costo de envío para un producto
   * Nota: dimensions ya no existe en el producto maestro.
   * Se usa una tarifa plana basada en el precio base.
   */
  calculateShippingCost(product: Product, distance: number): number {
    // Tarifa plana simple basada en distancia
    const baseRate = 7; // Tarifa base en soles
    const adjustedDistance = Math.max(distance, this.minDistance);
    const cost = baseRate + (adjustedDistance - this.minDistance) * this.distanceFactor;
    return this.roundToDecimals(cost, 2);
  }

  /**
   * Calcula el costo total de envío dado un número de items y distancia.
   */
  calculateTotalShippingCost(itemCount: number, distance: number): number {
    const baseRate = 7;
    const adjustedDistance = Math.max(distance, this.minDistance);
    const costPerItem = baseRate + (adjustedDistance - this.minDistance) * this.distanceFactor;
    return this.roundToDecimals(costPerItem * itemCount, 2);
  }

  /**
   * Redondea un número a X decimales
   */
  private roundToDecimals(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
}

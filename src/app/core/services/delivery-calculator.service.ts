import { Injectable } from '@angular/core';
import { Product } from '../interfaces/product.interface';

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

// Interfaz para items con cantidad
interface ShippingItem {
  product: Product;
  quantity: number;
}

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
   */
  calculateShippingCost(product: Product, distance: number): number {
    // Verificamos que tenga dimensiones válidas
    if (!product.dimensions?.size?.type || !product.dimensions?.weight?.unit) {
      return 0;
    }

    // Validamos el tipo de dimensión
    const dimensionType = product.dimensions.size.type as DimensionType;
    if (!this.basePrices[dimensionType]) return 0;

    // Validamos la unidad de peso
    const weightUnit = product.dimensions.weight.unit as WeightUnit;
    if (!this.weightFactors[weightUnit]) return 0;

    // 1. Precio base según tipo de producto
    let cost = this.basePrices[dimensionType];

    // 2. Ajuste por distancia
    const adjustedDistance = Math.max(distance, this.minDistance);
    cost += (adjustedDistance - this.minDistance) * this.distanceFactor;

    // 3. Ajuste por peso
    const weightData = this.weightFactors[weightUnit];
    const weight = product.dimensions.weight.value * weightData.base;

    if (weight > weightData.threshold) {
      cost += (weight - weightData.threshold) * weightData.extra;
    }

    return this.roundToDecimals(cost, 2);
  }

  /**
   * Calcula el costo total de envío para múltiples productos
   */
  calculateTotalShippingCost(items: ShippingItem[], distance: number): number {
    return items.reduce((total, item) => {
      return (
        total +
        this.calculateShippingCost(item.product, item.quantity) * item.quantity
      );
    }, 0);
  }

  /**
   * Redondea un número a X decimales
   */
  private roundToDecimals(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
}

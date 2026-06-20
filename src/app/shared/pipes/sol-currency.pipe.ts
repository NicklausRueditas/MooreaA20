import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'solCurrency',
})
export class SolCurrencyPipe implements PipeTransform {
  transform(value: number | string): string {
    // Convertir a número si es string
    const numericValue = typeof value === 'string' ? parseFloat(value) : value;

    // Validar si es un número válido
    if (isNaN(numericValue)) {
      return 'S/0.00';
    }

    // Formatear a 2 decimales, separador de miles y decimal con punto
    const formattedValue = numericValue.toLocaleString('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    // Devolver con símbolo S/ (estándar peruano)
    return `S/${formattedValue}`;
  }
}

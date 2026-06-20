import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'dateFormat'
})
export class DateFormatPipe implements PipeTransform {
  transform(value: Date | string, format: string = 'mediumDate'): string {
    if (!value) return '';
    
    const date = typeof value === 'string' ? new Date(value) : value;
    
    const options: Intl.DateTimeFormatOptions = {};
    const locale = 'es-ES'; // Para español
    
    if (format.includes('d')) options.day = 'numeric';
    if (format.includes('MM')) options.month = '2-digit';
    if (format.includes('MMM')) options.month = 'short';
    if (format.includes('MMMM')) options.month = 'long';
    if (format.includes('yy')) options.year = '2-digit';
    if (format.includes('yyyy')) options.year = 'numeric';
    if (format.includes('EEEE')) options.weekday = 'long';
    if (format.includes('EEE')) options.weekday = 'short';
    
    return date.toLocaleDateString(locale, options);
  }
}

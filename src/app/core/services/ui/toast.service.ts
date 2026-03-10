import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

export interface Toast {
  message: string;
  type: ToastType;
  duration?: number;
  id?: number;
  // Propiedades para confirmación
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastsSubject = new BehaviorSubject<Toast[]>([]);
  toasts$ = this.toastsSubject.asObservable();
  private currentId = 0;

  private defaultDuration = 5000; // 5 segundos

  /**
   * Muestra un toast de éxito
   * @param message Mensaje a mostrar
   * @param duration Duración en milisegundos (opcional)
   */
  showSuccess(message: string, duration?: number): void {
    this.addToast({
      message,
      type: 'success',
      duration: duration || this.defaultDuration
    });
  }

  /**
   * Muestra un toast de error
   * @param message Mensaje a mostrar
   * @param duration Duración en milisegundos (opcional)
   */
  showError(message: string, duration?: number): void {
    this.addToast({
      message,
      type: 'error',
      duration: duration || this.defaultDuration
    });
  }

  /**
   * Muestra un toast de advertencia
   * @param message Mensaje a mostrar
   * @param duration Duración en milisegundos (opcional)
   */
  showWarning(message: string, duration?: number): void {
    this.addToast({
      message,
      type: 'warning',
      duration: duration || this.defaultDuration
    });
  }

  /**
   * Muestra un toast informativo
   * @param message Mensaje a mostrar
   * @param duration Duración en milisegundos (opcional)
   */
  showInfo(message: string, duration?: number): void {
    this.addToast({
      message,
      type: 'info',
      duration: duration || this.defaultDuration
    });
  }

  /**
   * Muestra un toast de confirmación
   * @param message Mensaje de la pregunta
   * @param onConfirm Callback al confirmar
   * @param onCancel Callback al cancelar (opcional)
   * @param confirmText Texto del botón confirmar (opcional)
   * @param cancelText Texto del botón cancelar (opcional)
   */
  showConfirm(message: string, onConfirm: () => void, onCancel?: () => void, confirmText = 'Confirmar', cancelText = 'Cancelar'): void {
    this.addToast({
      message,
      type: 'confirm',
      duration: 0, // No se cierra solo
      onConfirm,
      onCancel,
      confirmText,
      cancelText
    });
  }

  /**
   * Muestra un toast personalizado
   * @param toast Configuración completa del toast
   */
  showToast(toast: Toast): void {
    this.addToast({
      ...toast,
      duration: toast.duration || this.defaultDuration
    });
  }

  /**
   * Elimina un toast específico
   * @param toast Toast a eliminar
   */
  removeToast(toast: Toast): void {
    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next(currentToasts.filter(t => t.id !== toast.id));
  }

  /**
   * Limpia todos los toasts
   */
  clearAll(): void {
    this.toastsSubject.next([]);
  }

  private addToast(toast: Toast): void {
    const newToast = {
      ...toast,
      id: this.currentId++
    };

    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next([...currentToasts, newToast]);

    // Eliminación automática después de la duración especificada (solo si no es confirm)
    if (toast.duration && toast.duration > 0 && toast.type !== 'confirm') {
      setTimeout(() => {
        this.removeToast(newToast);
      }, toast.duration);
    }
  }
}
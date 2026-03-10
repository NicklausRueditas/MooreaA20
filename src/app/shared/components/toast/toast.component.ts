import { Component } from '@angular/core';

import { animate, style, transition, trigger } from '@angular/animations';
import { Toast, ToastService } from '../../../core/services/ui/toast.service';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-toast',
  templateUrl: './toast.component.html',
  imports: [AsyncPipe],
  animations: [
    trigger('toastAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px) scale(0.95)' }),
        animate('300ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 1, transform: 'translateY(0) scale(1)' }))
      ]),
      transition(':leave', [
        animate('200ms cubic-bezier(0.4, 0, 1, 1)', style({ opacity: 0, transform: 'translateY(-10px) scale(0.95)' }))
      ])
    ])
  ]
})
export class ToastComponent {
  constructor(public toastService: ToastService) { }

  getToastClasses(type: string) {
    const baseClasses = 'flex flex-col p-4 rounded-xl shadow-xl max-w-sm w-full border border-opacity-20 backdrop-blur-md transition-all';
    switch (type) {
      case 'success':
        return `${baseClasses} bg-white border-green-200 shadow-green-100/50`;
      case 'error':
        return `${baseClasses} bg-white border-red-200 shadow-red-100/50`;
      case 'warning':
        return `${baseClasses} bg-white border-amber-200 shadow-amber-100/50`;
      case 'info':
        return `${baseClasses} bg-white border-blue-200 shadow-blue-100/50`;
      case 'confirm':
        return `${baseClasses} bg-white border-gray-200 shadow-gray-200/50`;
      default:
        return `${baseClasses} bg-white border-gray-200 shadow-gray-100/50`;
    }
  }

  getIconContainerClasses(type: string) {
    const baseClasses = 'flex items-center justify-center w-10 h-10 rounded-full mr-3 shrink-0';
    switch (type) {
      case 'success':
        return `${baseClasses} bg-green-100 text-green-600`;
      case 'error':
        return `${baseClasses} bg-red-100 text-red-600`;
      case 'warning':
        return `${baseClasses} bg-amber-100 text-amber-600`;
      case 'info':
        return `${baseClasses} bg-blue-100 text-blue-600`;
      case 'confirm':
        return `${baseClasses} bg-indigo-100 text-indigo-600`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-600`;
    }
  }

  onConfirm(toast: Toast) {
    if (toast.onConfirm) {
      toast.onConfirm();
    }
    this.toastService.removeToast(toast);
  }

  onCancel(toast: Toast) {
    if (toast.onCancel) {
      toast.onCancel();
    }
    this.toastService.removeToast(toast);
  }
}

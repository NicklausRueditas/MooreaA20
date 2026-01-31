import { Component } from '@angular/core';

import { animate, style, transition, trigger } from '@angular/animations';
import { ToastService } from '../../../core/services/toast.service';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-toast',
  templateUrl: './toast.component.html',
  imports: [AsyncPipe],
  animations: [
    trigger('toastAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0, transform: 'scale(0.9)' }))
      ])
    ])
  ]
})
export class ToastComponent {
  constructor(public toastService: ToastService) {}

  getToastClasses(type: string) {
    const baseClasses = 'flex items-start p-4 rounded-lg shadow-lg max-w-xs border-l-4';
    switch (type) {
      case 'success':
        return `${baseClasses} bg-green-50 border-green-500 text-green-700`;
      case 'error':
        return `${baseClasses} bg-red-50 border-red-500 text-red-700`;
      case 'warning':
        return `${baseClasses} bg-yellow-50 border-yellow-500 text-yellow-700`;
      case 'info':
        return `${baseClasses} bg-blue-50 border-blue-500 text-blue-700`;
      default:
        return `${baseClasses} bg-gray-50 border-gray-500 text-gray-700`;
    }
  }

  getIconClasses(type: string) {
    switch (type) {
      case 'success':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      case 'warning':
        return 'text-yellow-500';
      case 'info':
        return 'text-blue-500';
      default:
        return 'text-gray-500';
    }
  }

  getIcon(type: string) {
    switch (type) {
      case 'success':
        return 'check-circle';
      case 'error':
        return 'x-circle';
      case 'warning':
        return 'exclamation';
      case 'info':
        return 'information-circle';
      default:
        return 'bell';
    }
  }
}

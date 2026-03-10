import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {

  features = [
    {
      icon: 'M5 13l4 4L19 7',
      title: 'Calidad Garantizada',
      description: 'Productos de la más alta calidad con garantía de satisfacción'
    },
    {
      icon: 'M13 10V3L4 14h7v7l9-11h-7z',
      title: 'Envío Rápido',
      description: 'Entrega en 24-48 horas en todo el país'
    },
    {
      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      title: 'Mejores Precios',
      description: 'Precios competitivos y ofertas exclusivas'
    },
    {
      icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      title: 'Pago Seguro',
      description: 'Transacciones 100% seguras y protegidas'
    }
  ];

  categories = [
    { name: 'Electrónica', image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400', link: '/store' },
    { name: 'Moda', image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400', link: '/store' },
    { name: 'Hogar', image: 'https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=400', link: '/store' },
    { name: 'Deportes', image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400', link: '/store' }
  ];
}
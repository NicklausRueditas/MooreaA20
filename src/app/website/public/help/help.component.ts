import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../../core/services/ui/toast.service';

export interface FaqItem {
  id: number;
  category: 'shipping' | 'pickup' | 'returns' | 'warranty' | 'payments' | 'seller';
  categoryLabel: string;
  categoryIcon: string;
  question: string;
  answer: string;
  isOpen?: boolean;
}

export interface SupportCategory {
  id: string;
  title: string;
  icon: string;
  description: string;
  count: number;
}

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './help.component.html',
  styleUrl: './help.component.css'
})
export class HelpComponent {
  searchQuery: string = '';
  selectedCategory: string = 'all';
  contactForm: FormGroup;
  isSubmitting = false;

  readonly supportCategories: SupportCategory[] = [
    {
      id: 'shipping',
      title: 'Envíos y Delivery',
      icon: '🚚',
      description: 'Costos de envío, tiempos de entrega y cobertura geográfica.',
      count: 3
    },
    {
      id: 'pickup',
      title: 'Retiro en Tienda',
      icon: '🏪',
      description: 'Cómo recoger tu pedido gratis con tu código QR o código de retiro.',
      count: 2
    },
    {
      id: 'returns',
      title: 'Cambios y Devoluciones',
      icon: '🔄',
      description: 'Política de 30 días, requisitos y proceso de cambio de talla.',
      count: 2
    },
    {
      id: 'warranty',
      title: 'Garantías y Respaldo',
      icon: '🛡️',
      description: 'Coberturas de fabricante, garantía de tienda y pólizas oficiales.',
      count: 2
    },
    {
      id: 'payments',
      title: 'Pagos y Facturación',
      icon: '💳',
      description: 'Tarjetas de crédito/débito, pasarela segura Izipay y comprobantes.',
      count: 2
    },
    {
      id: 'seller',
      title: 'Vender en Moorea',
      icon: '💼',
      description: 'Cómo registrar tu tienda, publicar productos y gestionar inventarios.',
      count: 2
    }
  ];

  faqs: FaqItem[] = [
    {
      id: 1,
      category: 'shipping',
      categoryLabel: 'Envíos y Delivery',
      categoryIcon: '🚚',
      question: '¿Cómo funciona el Delivery Gratuito y el cálculo de distancia?',
      answer: 'Moorea calcula automáticamente la distancia entre tu ubicación y la tienda con stock más cercana. El delivery es 100% GRATIS si la distancia es de hasta 2.5 km, tu compra es igual o superior a S/ 200 y el peso del pedido no excede los 3 kg. Para distancias mayores, se aplica una tarifa fija accesible por kilómetro adicional.',
      isOpen: true
    },
    {
      id: 2,
      category: 'shipping',
      categoryLabel: 'Envíos y Delivery',
      categoryIcon: '🚚',
      question: '¿Cuánto tiempo tarda en llegar mi pedido a domicilio?',
      answer: 'Para envíos locales dentro de la misma ciudad, los pedidos se entregan generalmente el mismo día o en un plazo de 24 a 48 horas hábiles. En la ficha de cada producto y en el checkout verás el estimado exacto de días según tu ubicación.',
      isOpen: false
    },
    {
      id: 3,
      category: 'shipping',
      categoryLabel: 'Envíos y Delivery',
      categoryIcon: '🚚',
      question: '¿Qué sucede si un producto tiene recargo por peso volumétrico?',
      answer: 'Productos voluminosos o pesados (superiores a 3 kg) pueden tener un pequeño recargo de transporte por peso adicional. Este valor se desglosa transparentemente en tu carrito antes de procesar el pago.',
      isOpen: false
    },
    {
      id: 4,
      category: 'pickup',
      categoryLabel: 'Retiro en Tienda',
      categoryIcon: '🏪',
      question: '¿Cómo recojo mi compra en una tienda física?',
      answer: 'Al finalizar tu compra seleccionando la opción "Retiro en Tienda", recibirás en tu pantalla de confirmación y en tu correo un Código de Retiro único y un Código QR. Solo acércate a la sucursal seleccionada, muestra tu código en caja y te entregarán tu paquete inmediatamente sin costo adicional.',
      isOpen: false
    },
    {
      id: 5,
      category: 'pickup',
      categoryLabel: 'Retiro en Tienda',
      categoryIcon: '🏪',
      question: '¿Cuánto tiempo tengo para recoger mi pedido en la sucursal?',
      answer: 'Dispones de hasta 7 días hábiles a partir de la confirmación del pedido para recoger tu producto en la tienda física elegida.',
      isOpen: false
    },
    {
      id: 6,
      category: 'returns',
      categoryLabel: 'Cambios y Devoluciones',
      categoryIcon: '🔄',
      question: '¿Cuál es el plazo para cambios o devoluciones?',
      answer: 'Cuentas con 30 días calendario desde la fecha de recepción para solicitar un cambio de talla, modelo o devolución. El producto debe encontrarse sin uso, con sus etiquetas intactas y en su empaque original.',
      isOpen: false
    },
    {
      id: 7,
      category: 'returns',
      categoryLabel: 'Cambios y Devoluciones',
      categoryIcon: '🔄',
      question: '¿El cambio de talla tiene costo adicional?',
      answer: 'El primer cambio de talla en cualquiera de nuestras tiendas físicas asociadas es 100% gratuito. Para cambios con envío a domicilio, solo se abona el costo del transporte del repartidor.',
      isOpen: false
    },
    {
      id: 8,
      category: 'warranty',
      categoryLabel: 'Garantías y Respaldo',
      categoryIcon: '🛡️',
      question: '¿Qué cubre la garantía de los productos en Moorea?',
      answer: 'Todos los productos cuentan con respaldo oficial. Las garantías de fabricante cubren fallas de manufactura, costuras o defectos de materiales (desde 3 meses hasta 1 año según la marca). En la ficha de detalle de cada producto podrás consultar la duración exacta y el tipo de garantía.',
      isOpen: false
    },
    {
      id: 9,
      category: 'warranty',
      categoryLabel: 'Garantías y Respaldo',
      categoryIcon: '🛡️',
      question: '¿Cómo solicito la aplicación de una garantía?',
      answer: 'Puedes contactar a nuestro equipo de soporte enviando una foto o video del defecto junto a tu número de pedido. Evaluaremos tu caso en menos de 24 horas para coordinar la reparación, cambio o reembolso.',
      isOpen: false
    },
    {
      id: 10,
      category: 'payments',
      categoryLabel: 'Pagos y Facturación',
      categoryIcon: '💳',
      question: '¿Qué métodos de pago son aceptados?',
      answer: 'Aceptamos tarjetas de crédito y débito (Visa, Mastercard, American Express, Diners Club) procesadas a través de la pasarela segura Izipay con estándares de seguridad PCI-DSS y encriptación de nivel bancario. También admitimos pagos con Yape y Plin.',
      isOpen: false
    },
    {
      id: 11,
      category: 'payments',
      categoryLabel: 'Pagos y Facturación',
      categoryIcon: '💳',
      question: '¿Puedo solicitar Boleta o Factura electrónica?',
      answer: 'Sí. Durante el paso de pago puedes seleccionar si requieres Boleta de Venta o Factura ingresando tu número de DNI o RUC y razón social. Tu comprobante electrónico será emitido automáticamente y enviado a tu correo.',
      isOpen: false
    },
    {
      id: 12,
      category: 'seller',
      categoryLabel: 'Vender en Moorea',
      categoryIcon: '💼',
      question: '¿Cómo puedo empezar a vender mis productos en Moorea?',
      answer: 'Puedes registrarte como vendedor desde el enlace "Vender en Moorea". Tras una breve verificación de tu negocio o RUC, tendrás acceso al Panel de Administración donde podrás cargar tus productos, gestionar variantes, controlar tu inventario por tienda y recibir pedidos.',
      isOpen: false
    }
  ];

  constructor(
    private readonly fb: FormBuilder,
    private readonly toastService: ToastService
  ) {
    this.contactForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      orderNumber: [''],
      category: ['general', Validators.required],
      message: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  get filteredFaqs(): FaqItem[] {
    return this.faqs.filter(faq => {
      const matchesCategory = this.selectedCategory === 'all' || faq.category === this.selectedCategory;
      const q = this.searchQuery.trim().toLowerCase();
      const matchesSearch = !q || 
        faq.question.toLowerCase().includes(q) || 
        faq.answer.toLowerCase().includes(q) ||
        faq.categoryLabel.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }

  setCategory(catId: string): void {
    this.selectedCategory = catId;
  }

  toggleFaq(faq: FaqItem): void {
    faq.isOpen = !faq.isOpen;
  }

  submitTicket(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      this.toastService.showError('Por favor completa todos los campos requeridos correctamente.');
      return;
    }

    this.isSubmitting = true;
    setTimeout(() => {
      this.isSubmitting = false;
      this.toastService.showSuccess('¡Consulta enviada con éxito! Un asesor te responderá a la brevedad.');
      this.contactForm.reset({ category: 'general' });
    }, 1000);
  }
}

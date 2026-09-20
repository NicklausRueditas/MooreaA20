import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastService } from '../../../core/services/ui/toast.service';

export interface FaqItem {
  id: number;
  category: 'shipping' | 'pickup' | 'returns' | 'warranty' | 'payments' | 'seller';
  categoryLabel: string;
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
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
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
      icon: 'shipping',
      description: 'Costos de envío, tiempos de entrega y cobertura geográfica.',
      count: 3
    },
    {
      id: 'pickup',
      title: 'Retiro en Tienda',
      icon: 'pickup',
      description: 'Cómo recoger tu pedido gratis con tu código QR o código de retiro.',
      count: 2
    },
    {
      id: 'returns',
      title: 'Cambios y Devoluciones',
      icon: 'returns',
      description: 'Política de 30 días, requisitos y proceso de cambio de talla.',
      count: 2
    },
    {
      id: 'warranty',
      title: 'Garantías y Respaldo',
      icon: 'warranty',
      description: 'Coberturas de fabricante, garantía de tienda y pólizas oficiales.',
      count: 2
    },
    {
      id: 'payments',
      title: 'Pagos y Facturación',
      icon: 'payments',
      description: 'Tarjetas de crédito/débito, pasarela segura Izipay y comprobantes.',
      count: 2
    },
    {
      id: 'seller',
      title: 'Vender en Moorea',
      icon: 'seller',
      description: 'Cómo registrar tu tienda, publicar productos y gestionar inventarios.',
      count: 2
    }
  ];

  faqs: FaqItem[] = [
    {
      id: 1,
      category: 'shipping',
      categoryLabel: 'Envíos y Delivery',
      question: '¿Cómo funciona el Delivery Gratuito y el cálculo de distancia?',
      answer: 'Moorea calcula automáticamente la distancia entre tu ubicación y la tienda con stock más cercana. El delivery es 100% GRATIS si la distancia es de hasta 2.5 km, tu compra es igual o superior a S/ 500 y el peso del pedido no excede los 3 kg. Para distancias mayores, se aplica una tarifa fija accesible por kilómetro adicional.',
      isOpen: true
    },
    {
      id: 2,
      category: 'shipping',
      categoryLabel: 'Envíos y Delivery',
      question: '¿Cuánto tiempo tarda en llegar mi pedido a domicilio?',
      answer: 'Para envíos locales dentro de la misma ciudad, los pedidos se entregan generalmente el mismo día o en un plazo de 24 a 48 horas hábiles. En la ficha de cada producto y en el checkout verás el estimado exacto de días según tu ubicación.',
      isOpen: false
    },
    {
      id: 3,
      category: 'shipping',
      categoryLabel: 'Envíos y Delivery',
      question: '¿Qué sucede si un producto tiene recargo por peso volumétrico?',
      answer: 'Productos voluminosos o pesados (superiores a 3 kg) pueden tener un pequeño recargo de transporte por peso adicional. Este valor se desglosa transparentemente en tu carrito antes de procesar el pago.',
      isOpen: false
    },
    {
      id: 4,
      category: 'pickup',
      categoryLabel: 'Retiro en Tienda',
      question: '¿Cómo recojo mi compra en una tienda física?',
      answer: 'Al finalizar tu compra seleccionando la opción "Retiro en Tienda", recibirás en tu pantalla de confirmación y en tu correo un Código de Retiro único y un Código QR. Solo acércate a la sucursal seleccionada, muestra tu código en caja y te entregarán tu paquete inmediatamente sin costo adicional.',
      isOpen: false
    },
    {
      id: 5,
      category: 'pickup',
      categoryLabel: 'Retiro en Tienda',
      question: '¿Cuánto tiempo tengo para recoger mi pedido en la sucursal?',
      answer: 'Dispones de hasta 7 días hábiles a partir de la confirmación del pedido para recoger tu producto en la tienda física elegida.',
      isOpen: false
    },
    {
      id: 6,
      category: 'returns',
      categoryLabel: 'Cambios y Devoluciones',
      question: '¿Cuál es el plazo para cambios o devoluciones?',
      answer: 'Cuentas con 30 días calendario desde la fecha de recepción para solicitar un cambio de talla, modelo o devolución. El producto debe encontrarse sin uso, con sus etiquetas intactas y en su empaque original.',
      isOpen: false
    },
    {
      id: 7,
      category: 'returns',
      categoryLabel: 'Cambios y Devoluciones',
      question: '¿El cambio de talla tiene costo adicional?',
      answer: 'El primer cambio de talla en cualquiera de nuestras tiendas físicas asociadas es 100% gratuito. Para cambios con envío a domicilio, solo se abona el costo del transporte del repartidor.',
      isOpen: false
    },
    {
      id: 8,
      category: 'warranty',
      categoryLabel: 'Garantías y Respaldo',
      question: '¿Qué cubre la garantía de los productos en Moorea?',
      answer: 'Todos los productos cuentan con respaldo oficial. Las garantías de fabricante cubren fallas de manufactura, costuras o defectos de materiales (desde 3 meses hasta 1 año según la marca). En la ficha de detalle de cada producto podrás consultar la duración exacta y el tipo de garantía.',
      isOpen: false
    },
    {
      id: 9,
      category: 'warranty',
      categoryLabel: 'Garantías y Respaldo',
      question: '¿Cómo solicito la aplicación de una garantía?',
      answer: 'Puedes contactar a nuestro equipo de soporte enviando una foto o video del defecto junto a tu número de pedido. Evaluaremos tu caso en menos de 24 horas para coordinar la reparación, cambio o reembolso.',
      isOpen: false
    },
    {
      id: 10,
      category: 'payments',
      categoryLabel: 'Pagos y Facturación',
      question: '¿Qué métodos de pago son aceptados?',
      answer: 'Aceptamos tarjetas de crédito y débito (Visa, Mastercard, American Express, Diners Club) procesadas a través de la pasarela segura Izipay con estándares de seguridad PCI-DSS y encriptación de nivel bancario. También admitimos pagos con Yape y Plin.',
      isOpen: false
    },
    {
      id: 11,
      category: 'payments',
      categoryLabel: 'Pagos y Facturación',
      question: '¿Puedo solicitar Boleta o Factura electrónica?',
      answer: 'Sí. Durante el paso de pago puedes seleccionar si requieres Boleta de Venta o Factura ingresando tu número de DNI o RUC y razón social. Tu comprobante electrónico será emitido automáticamente y enviado a tu correo.',
      isOpen: false
    },
    {
      id: 12,
      category: 'seller',
      categoryLabel: 'Vender en Moorea',
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

  getCategorySvgPath(catId: string): string {
    const paths: Record<string, string> = {
      shipping: 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375A1.125 1.125 0 012.25 17.625V6.375A1.125 1.125 0 013.375 5.25h11.25c.621 0 1.125.504 1.125 1.125v4.125m-12.375 8.25H3.375m12.375 0a1.5 1.5 0 013 0m-3 0a1.5 1.5 0 003 0m-3 0h2.625A1.125 1.125 0 0021 17.625V13.5a1.5 1.5 0 00-.44-1.06l-2.56-2.56A1.5 1.5 0 0016.94 9.5H15.75',
      pickup: 'M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009 9.35c.694 0 1.343-.236 1.868-.636a3.002 3.002 0 004.264 0A2.993 2.993 0 0017 9.35c.694 0 1.343-.236 1.868-.636a3.002 3.002 0 003.75.616m-19.118 0L4.5 3h15l.992 6.35',
      returns: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99',
      warranty: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
      payments: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-6.75-11.25h16.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6.75A2.25 2.25 0 013.75 4.5z',
      seller: 'M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v1.081m7.5 0a48.667 48.667 0 00-7.5 0',
    };
    return paths[catId] ?? paths['shipping'];
  }

  getCategoryBadgeClass(catId: string): string {
    const classes: Record<string, string> = {
      shipping: 'bg-sky-50 text-sky-600 border border-sky-200/60',
      pickup:   'bg-amber-50 text-amber-600 border border-amber-200/60',
      returns:  'bg-emerald-50 text-emerald-600 border border-emerald-200/60',
      warranty: 'bg-indigo-50 text-indigo-600 border border-indigo-200/60',
      payments: 'bg-rose-50 text-rose-600 border border-rose-200/60',
      seller:   'bg-purple-50 text-purple-600 border border-purple-200/60',
    };
    return classes[catId] ?? 'bg-slate-50 text-slate-600 border border-slate-200/60';
  }

  getCategoryIconClass(catId: string): string {
    const classes: Record<string, string> = {
      shipping: 'bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white',
      pickup:   'bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white',
      returns:  'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white',
      warranty: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white',
      payments: 'bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white',
      seller:   'bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white',
    };
    return classes[catId] ?? 'bg-slate-50 text-slate-600 group-hover:bg-slate-900 group-hover:text-white';
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

import { Routes } from '@angular/router';
import { StoreComponent } from './store/store.component';
import { HomeComponent } from './home/home.component';
import { MyAccountComponent } from './my-account/my-account.component';
import { HelpComponent } from './help/help.component';
import { BasketComponent } from './basket/basket.component';
import { PaymentComponent } from './payment/payment.component';

export const publicRoutes: Routes = [
  {
    path: 'home',
    component: HomeComponent,
    title: 'Inicio | Moorea'
  },
  {
    path: 'store',
    component: StoreComponent,
    title: 'Tienda | Moorea'
  },
  {
    path: 'product/:id',
    loadComponent: () => import('./store/pages/product-detail/product-detail.component').then(m => m.ProductDetailComponent),
    title: 'Detalle de Producto | Moorea'
  },
  {
    path: 'help',
    component: HelpComponent,
    title: 'Centro de Ayuda | Moorea'
  },
  {
    path: 'basket',
    component: BasketComponent,
    title: 'Mi Carrito | Moorea'
  },
  {
    path: 'my-account',
    component: MyAccountComponent,
    title: 'Mi Cuenta | Moorea',
    children: [
      {
        path: '',
        redirectTo: 'profile',
        pathMatch: 'full'
      },
      {
        path: 'profile',
        loadComponent: () => import('./my-account/profile/profile.component').then(m => m.ProfileComponent),
        title: 'Mi Perfil | Moorea'
      },
      {
        path: 'addresses',
        loadComponent: () => import('./my-account/addresses/addresses.component').then(m => m.AddressesComponent),
        title: 'Mis Direcciones | Moorea'
      },
      {
        path: 'cards',
        loadComponent: () => import('./my-account/cards/cards.component').then(m => m.CardsComponent),
        title: 'Mis Tarjetas | Moorea'
      },
      {
        path: 'orders',
        loadComponent: () => import('./my-account/orders/orders.component').then(m => m.OrdersComponent),
        title: 'Mis Pedidos | Moorea'
      },
      {
        path: 'become-seller',
        loadComponent: () => import('./my-account/become-seller/become-seller.component').then(m => m.BecomeSellerComponent),
        title: 'Vender en Moorea | Moorea'
      },
    ]
  },
  {
    path: 'payment',
    component: PaymentComponent,
    title: 'Finalizar Pago | Moorea'
  },
  {
    path: 'orders/:id/success',
    loadComponent: () => import('./order-success/order-success.component').then(m => m.OrderSuccessComponent),
    title: '¡Compra Confirmada! | Moorea'
  },
];

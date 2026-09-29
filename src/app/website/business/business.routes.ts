import { Routes } from '@angular/router';
import { BusinessComponent } from './business.component';
import { adminGuard } from '../../core/guards/admin.guard';
import { sellerGuard } from '../../core/guards/seller.guard';

export const businessRoutes: Routes = [
  {
    path: '',
    component: BusinessComponent,
    children: [
      {
        path: 'products',
        loadComponent: () => import('./products/products.component').then(m => m.ProductsComponent),
        canActivate: [sellerGuard],
        title: 'Mis Productos | Moorea Business'
      },
      {
        path: 'products/new',
        loadComponent: () => import('./product-editor/product-editor.component').then(m => m.ProductEditorComponent),
        canActivate: [sellerGuard],
        title: 'Nuevo Producto | Moorea Business'
      },
      {
        path: 'products/:id/edit',
        loadComponent: () => import('./product-editor/product-editor.component').then(m => m.ProductEditorComponent),
        canActivate: [sellerGuard],
        title: 'Editar Producto | Moorea Business'
      },
      {
        path: 'stores',
        loadComponent: () => import('./stores/stores.component').then(m => m.StoresComponent),
        canActivate: [sellerGuard],
        title: 'Mis Tiendas | Moorea Business'
      },
      {
        path: 'stores/:id/inventory',
        loadComponent: () => import('./stores/store-inventory/store-inventory.component').then(m => m.StoreInventoryComponent),
        canActivate: [sellerGuard],
        title: 'Inventario de Tienda | Moorea Business'
      },
      {
        path: 'stores/:id/workers',
        loadComponent: () => import('./stores/store-workers/store-workers.component').then(m => m.StoreWorkersComponent),
        canActivate: [sellerGuard],
        title: 'Colaboradores | Moorea Business'
      },
      {
        path: 'stores/:id/coverage',
        loadComponent: () => import('./stores/coverage-zones/coverage-zones.component').then(m => m.CoverageZonesComponent),
        canActivate: [sellerGuard],
        title: 'Zonas de Cobertura | Moorea Business'
      },
      {
        path: 'orders',
        loadComponent: () => import('./orders/orders.component').then(m => m.OrdersComponent),
        title: 'Gestión de Pedidos | Moorea Business'
      },
      {
        path: 'orders/:id',
        loadComponent: () => import('./orders/order-detail/order-detail.component').then(m => m.OrderDetailComponent),
        title: 'Detalle de Pedido | Moorea Business'
      },
      {
        path: 'pickup-scanner',
        loadComponent: () => import('./pickup-scanner/pickup-scanner.component').then(m => m.PickupScannerComponent),
        title: 'Escanear Retiro QR | Moorea Business'
      },
      {
        path: 'users',
        loadComponent: () => import('./users/users.component').then(m => m.UsersComponent),
        canActivate: [adminGuard],
        title: 'Gestión de Usuarios | Moorea Business'
      },
      {
        path: 'sellers',
        loadComponent: () => import('./sellers/sellers.component').then(m => m.SellersComponent),
        canActivate: [adminGuard],
        title: 'Directorio de Vendedores | Moorea Business'
      },
      {
        path: 'sellers/register',
        loadComponent: () => import('./sellers/seller-register/seller-register.component').then(m => m.SellerRegisterComponent),
        canActivate: [adminGuard],
        title: 'Registro de Vendedor | Moorea Business'
      },
      {
        path: 'sellers/:id',
        loadComponent: () => import('./sellers/seller-detail/seller-detail.component').then(m => m.SellerDetailComponent),
        canActivate: [adminGuard],
        title: 'Perfil de Vendedor | Moorea Business'
      },
      {
        path: 'profile',
        loadComponent: () => import('./business-profile/business-profile.component').then(m => m.BusinessProfileComponent),
        title: 'Perfil de Negocio | Moorea Business'
      },
      {
        path: 'my-shop',
        loadComponent: () => import('./business-profile/business-profile.component').then(m => m.BusinessProfileComponent),
        title: 'Perfil de Negocio | Moorea Business'
      },
      {
        path: '',
        redirectTo: 'products',
        pathMatch: 'full'
      }
    ]
  }
];

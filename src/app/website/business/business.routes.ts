import { Routes } from '@angular/router';
import { BusinessComponent } from './business.component';

export const businessRoutes: Routes = [
  {
    path: '',
    component: BusinessComponent,
    children: [
      {
        path: 'products',
        loadComponent: () => import('./products/products.component').then(m => m.ProductsComponent),
        title: 'Mis Productos | Moorea Business'
      },
      {
        path: 'products/new',
        loadComponent: () => import('./product-editor/product-editor.component').then(m => m.ProductEditorComponent),
        title: 'Nuevo Producto | Moorea Business'
      },
      {
        path: 'products/:id/edit',
        loadComponent: () => import('./product-editor/product-editor.component').then(m => m.ProductEditorComponent),
        title: 'Editar Producto | Moorea Business'
      },
      {
        path: 'stores',
        loadComponent: () => import('./stores/stores.component').then(m => m.StoresComponent),
        title: 'Mis Tiendas | Moorea Business'
      },
      {
        path: 'stores/:id/inventory',
        loadComponent: () => import('./stores/store-inventory/store-inventory.component').then(m => m.StoreInventoryComponent),
        title: 'Inventario de Tienda | Moorea Business'
      },
      {
        path: 'stores/:id/workers',
        loadComponent: () => import('./stores/store-workers/store-workers.component').then(m => m.StoreWorkersComponent),
        title: 'Colaboradores | Moorea Business'
      },
      {
        path: 'stores/:id/coverage',
        loadComponent: () => import('./stores/coverage-zones/coverage-zones.component').then(m => m.CoverageZonesComponent),
        title: 'Zonas de Cobertura | Moorea Business'
      },
      {
        path: 'orders',
        loadComponent: () => import('./orders-admin/orders-admin.component').then(m => m.OrdersAdminComponent),
        title: 'Administración de Pedidos | Moorea Business'
      },
      {
        path: 'pickup-scanner',
        loadComponent: () => import('./pickup-scanner/pickup-scanner.component').then(m => m.PickupScannerComponent),
        title: 'Escanear Retiro QR | Moorea Business'
      },
      {
        path: 'sellers',
        loadComponent: () => import('./sellers/sellers.component').then(m => m.SellersComponent),
        title: 'Directorio de Vendedores | Moorea Business'
      },
      {
        path: 'sellers/register',
        loadComponent: () => import('./sellers/seller-register/seller-register.component').then(m => m.SellerRegisterComponent),
        title: 'Registro de Vendedor | Moorea Business'
      },
      {
        path: 'sellers/:id',
        loadComponent: () => import('./sellers/seller-detail/seller-detail.component').then(m => m.SellerDetailComponent),
        title: 'Perfil de Vendedor | Moorea Business'
      },
      {
        path: 'profile',
        loadComponent: () => import('./seller-profile/seller-profile.component').then(m => m.SellerProfileComponent),
        title: 'Mi Tienda | Moorea Business'
      },
      {
        path: 'my-shop',
        loadComponent: () => import('./seller-profile/seller-profile.component').then(m => m.SellerProfileComponent),
        title: 'Mi Tienda | Moorea Business'
      },
      {
        path: '',
        redirectTo: 'products',
        pathMatch: 'full'
      }
    ]
  }
];

import { Routes } from '@angular/router';

export const businessRoutes: Routes = [
  {
    path: 'products',
    loadComponent: () => import('./products/products.component').then(m => m.ProductsComponent)
  },
  {
    path: 'products/new',
    loadComponent: () => import('./product-editor/product-editor.component').then(m => m.ProductEditorComponent)
  },
  {
    path: 'products/:id/edit',
    loadComponent: () => import('./product-editor/product-editor.component').then(m => m.ProductEditorComponent)
  },
  {
    path: 'stores',
    loadComponent: () => import('./stores/stores.component').then(m => m.StoresComponent)
  },
  {
    path: 'stores/:id/inventory',
    loadComponent: () => import('./stores/store-inventory/store-inventory.component').then(m => m.StoreInventoryComponent)
  },
  {
    path: 'stores/:id/workers',
    loadComponent: () => import('./stores/store-workers/store-workers.component').then(m => m.StoreWorkersComponent)
  },
  {
    path: 'stores/:id/coverage',
    loadComponent: () => import('./stores/coverage-zones/coverage-zones.component').then(m => m.CoverageZonesComponent)
  },
  {
    path: 'orders',
    loadComponent: () => import('./orders-admin/orders-admin.component').then(m => m.OrdersAdminComponent)
  },
  {
    path: 'pickup-scanner',
    loadComponent: () => import('./pickup-scanner/pickup-scanner.component').then(m => m.PickupScannerComponent)
  },
  {
    path: 'sellers',
    loadComponent: () => import('./sellers/sellers.component').then(m => m.SellersComponent)
  },
  {
    path: 'sellers/register',
    loadComponent: () => import('./sellers/seller-register/seller-register.component').then(m => m.SellerRegisterComponent)
  },
  {
    path: 'sellers/:id',
    loadComponent: () => import('./sellers/seller-detail/seller-detail.component').then(m => m.SellerDetailComponent)
  },
  {
    // Perfil del Seller autenticado — resumen con accesos directos a Catálogo, Tiendas y Pedidos
    path: 'profile',
    loadComponent: () => import('./seller-profile/seller-profile.component').then(m => m.SellerProfileComponent)
  },
  {
    // Alias de perfil del seller
    path: 'my-shop',
    loadComponent: () => import('./seller-profile/seller-profile.component').then(m => m.SellerProfileComponent)
  },
  {
    path: '',
    redirectTo: 'products',
    pathMatch: 'full'
  }
];

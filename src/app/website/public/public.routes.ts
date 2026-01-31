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
  },
  {
    path: 'store',
    component: StoreComponent,
  },
  {
    path: 'help',
    component: HelpComponent,
  },
  {
    path: 'basket',
    component: BasketComponent,
  },
  {
    path: 'myaccount',
    component: MyAccountComponent,
    children: [
      {
        path: 'addresses',
        loadComponent: () => import('./my-account/addresses/addresses.component').then(m => m.AddressesComponent)
      },
      {
        path: 'cards',
        loadComponent: () => import('./my-account/cards/cards.component').then(m => m.CardsComponent)
      },
      {
        path: 'profile',
        loadComponent: () => import('./my-account/profile/profile.component').then(m => m.ProfileComponent)
      }
    ]
  },
  {
    path: 'payment',
    component: PaymentComponent,
  }
];

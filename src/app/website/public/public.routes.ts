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
  },
  {
    path: 'payment',
    component: PaymentComponent,
  }
];

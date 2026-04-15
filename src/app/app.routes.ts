import { Routes } from '@angular/router';
import { OrdersPageComponent } from './orders/orders-page.component';

export const routes: Routes = [
  { path: '', component: OrdersPageComponent },
  { path: '**', redirectTo: '' }
];

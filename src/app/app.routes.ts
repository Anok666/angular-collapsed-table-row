import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./orders/orders-page.component').then((m) => m.OrdersPageComponent)
  },
  { path: '**', redirectTo: '' }
];

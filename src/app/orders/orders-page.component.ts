import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from '@angular/core';
import { OrdersService } from './orders.service';
import { ThemeService } from '../core/theme.service';
import { OrdersTableComponent } from './components/orders-table/orders-table.component';
import { ThemeControlsComponent } from './components/theme-controls/theme-controls.component';

@Component({
  selector: 'app-orders-page',
  imports: [ThemeControlsComponent, OrdersTableComponent],
  templateUrl: './orders-page.component.html',
  styleUrl: './orders-page.component.css',
  providers: [OrdersService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrdersPageComponent {
  protected readonly ordersService = inject(OrdersService);
  protected readonly themeService = inject(ThemeService);

  protected readonly isDarkMode = computed(() => this.themeService.themeMode() === 'dark');
  protected readonly showTable = computed(
    () => !this.ordersService.isLoading() && !this.ordersService.errorMessage() && this.ordersService.groups().length > 0
  );
  protected readonly showEmpty = computed(
    () => !this.ordersService.isLoading() && !this.ordersService.errorMessage() && this.ordersService.groups().length === 0
  );
  protected readonly showDiagnostics = computed(
    () => !this.ordersService.isLoading() && !this.ordersService.errorMessage() && !!this.ordersService.diagnostics()
  );
  protected readonly diagnosticsLabel = computed(
    () => (this.ordersService.diagnostics()?.level === 'critical' ? 'CRITICAL' : 'WARNING')
  );

  constructor() {
    this.themeService.init();
    this.ordersService.init();
    inject(DestroyRef).onDestroy(() => this.themeService.destroy());
  }
}

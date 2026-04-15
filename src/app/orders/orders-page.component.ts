import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { QuotesService } from '../core/quotes.service';
import { ThemeService } from '../core/theme.service';
import { OrdersService } from './orders.service';
import { OrdersTableComponent } from './components/orders-table/orders-table.component';
import { ThemeControlsComponent } from './components/theme-controls/theme-controls.component';

@Component({
  selector: 'app-orders-page',
  imports: [ThemeControlsComponent, OrdersTableComponent],
  templateUrl: './orders-page.component.html',
  styleUrl: './orders-page.component.css',
  providers: [QuotesService, OrdersService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrdersPageComponent {
  protected readonly ordersService = inject(OrdersService);
  protected readonly themeService = inject(ThemeService);

  protected readonly isDarkMode = computed(() => this.themeService.themeMode() === 'dark');

  private readonly isReady = computed(
    () => !this.ordersService.isLoading() && !this.ordersService.errorMessage()
  );
  protected readonly showTable = computed(
    () => this.isReady() && this.ordersService.groups().length > 0
  );
  protected readonly showEmpty = computed(
    () => this.isReady() && this.ordersService.groups().length === 0
  );
  protected readonly showDiagnostics = computed(
    () => this.isReady() && !!this.ordersService.diagnostics()
  );
  protected readonly diagnosticsLabel = computed(
    () => (this.ordersService.diagnostics()?.level === 'critical' ? 'CRITICAL' : 'WARNING')
  );
  protected readonly isDiagnosticCritical = computed(
    () => this.ordersService.diagnostics()?.level === 'critical'
  );

  constructor() {
    this.ordersService.init();
  }
}

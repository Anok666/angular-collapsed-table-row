import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiOrder, SymbolGroup, ThemePreference } from './orders.types';
import {
  applyBidUpdates,
  buildCloseMessage,
  getOrderIdsBySymbol,
  getOrderSymbols,
  hasOrderById,
  isThemePreference,
  removeGroupOrders,
  removeSingleOrder
} from './app.helpers';
import {
  DIAGNOSTICS_DEFINITIONS,
  DiagnosticsCode,
  DiagnosticsEntry,
  DiagnosticsLevel
} from './diagnostics';
import { buildGroupsFromOrders, extractOrders, InvalidOrderInfo } from './orders.utils';
import { OrdersTableComponent } from './orders-table.component';
import { QuotesService, QuotesServiceDiagnostic } from './quotes.service';
import { ThemeService } from './theme.service';
import { ThemeControlsComponent } from './theme-controls.component';

@Component({
  selector: 'app-root',
  imports: [ThemeControlsComponent, OrdersTableComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly quotesService = inject(QuotesService);
  private readonly themeService = inject(ThemeService);

  private readonly ordersUrl = 'https://geeksoft.pl/assets/order-data.json';
  private readonly quotesSocketUrl = 'wss://webquotes.geeksoft.pl/websocket/quotes';

  private ordersData: ApiOrder[] = [];
  private readonly bidBySymbol = new Map<string, number>();
  private snackbarTimerId: ReturnType<typeof setTimeout> | null = null;

  /** Symbole z rozwiniętymi szczegółami — źródło prawdy zamiast mutacji `group.expanded`. */
  private readonly expandedSymbolKeys = signal<ReadonlySet<string>>(new Set<string>());

  readonly groups = signal<SymbolGroup[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly diagnostics = signal<DiagnosticsEntry | null>(null);

  readonly isSnackbarVisible = signal(false);
  readonly snackbarMessage = signal('');

  readonly themePreference = this.themeService.themePreference;
  readonly themeMode = this.themeService.themeMode;

  ngOnInit(): void {
    this.themeService.init();
    this.quotesService.bidUpdates$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((updates) => this.handleQuoteUpdates(updates));
    this.quotesService.diagnostics$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((diagnostic) => this.handleQuotesDiagnostic(diagnostic));
    this.quotesService.connect(this.quotesSocketUrl);
    this.loadOrders();
  }

  ngOnDestroy(): void {
    this.themeService.destroy();
    this.quotesService.destroy();
    this.snackbarTimerId = this.clearTimer(this.snackbarTimerId);
  }

  protected toggleGroup(symbol: string): void {
    this.expandedSymbolKeys.update((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
      } else {
        next.add(symbol);
      }
      return next;
    });
    this.rebuildGroups();
  }

  protected removeGroup(symbol: string, event: Event): void {
    event.stopPropagation();

    const orderIds = getOrderIdsBySymbol(this.ordersData, symbol);

    if (orderIds.length === 0) {
      return;
    }

    this.ordersData = removeGroupOrders(this.ordersData, symbol);
    this.expandedSymbolKeys.update((prev) => {
      const next = new Set(prev);
      next.delete(symbol);
      return next;
    });
    this.afterOrdersDataChange();
    this.showCloseMessage(orderIds);
  }

  protected removeOrder(symbol: string, orderId: number): void {
    if (!hasOrderById(this.ordersData, symbol, orderId)) {
      return;
    }

    this.ordersData = removeSingleOrder(this.ordersData, symbol, orderId);
    this.afterOrdersDataChange();
    this.showCloseMessage([orderId]);
  }

  protected retryLoad(): void {
    this.loadOrders();
  }

  protected closeSnackbar(): void {
    this.isSnackbarVisible.set(false);
    this.snackbarTimerId = this.clearTimer(this.snackbarTimerId);
  }

  protected toggleLightDark(): void {
    this.themeService.toggleLightDark();
  }

  protected setThemePreference(mode: ThemePreference): void {
    this.themeService.setThemePreference(mode);
  }

  protected onThemePreferenceChange(event: Event): void {
    const mode = (event.target as HTMLSelectElement | null)?.value;
    if (isThemePreference(mode)) {
      this.setThemePreference(mode);
    }
  }

  private loadOrders(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.diagnostics.set(null);

    this.http
      .get<unknown>(this.ordersUrl)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          let invalidOrdersCount = 0;
          this.ordersData = extractOrders(response, (invalidOrder) => {
            invalidOrdersCount += 1;
            this.reportDiagnosticsByCode('DATA_VALIDATION_WARNING', invalidOrder);
          });
          this.rebuildGroups({ resetExpansion: true });
          this.isLoading.set(false);

          if (invalidOrdersCount > 0) {
            this.reportDiagnosticsByCode(
              'DATA_PARTIAL_VALIDATION',
              `Pominieto ${invalidOrdersCount} niepoprawnych rekordow z API.`
            );
          }

          if (this.ordersData.length === 0 && !this.errorMessage()) {
            this.reportDiagnosticsByCode('DATA_EMPTY_AFTER_VALIDATION');
          }

          this.syncQuoteSubscriptions();
        },
        error: (error) => {
          this.reportDiagnosticsByCode('HTTP_FETCH_FAILED', error);
          this.errorMessage.set('Nie udało się pobrać danych zleceń. Spróbuj ponownie.');
          this.isLoading.set(false);
        }
      });
  }

  private rebuildGroups(options: { resetExpansion?: boolean } = {}): void {
    if (options.resetExpansion) {
      this.expandedSymbolKeys.set(new Set());
    }

    this.groups.set(
      buildGroupsFromOrders(this.ordersData, this.bidBySymbol, this.expandedSymbolKeys())
    );
  }

  private syncQuoteSubscriptions(): void {
    const desiredSymbols = getOrderSymbols(this.ordersData);
    for (const symbol of this.bidBySymbol.keys()) {
      if (!desiredSymbols.has(symbol)) {
        this.bidBySymbol.delete(symbol);
      }
    }
    this.quotesService.setDesiredSymbols(desiredSymbols);
  }

  private handleQuoteUpdates(updates: Array<{ symbol: string; bid: number }>): void {
    const didChange = applyBidUpdates(this.bidBySymbol, updates);
    if (!didChange) {
      return;
    }

    this.rebuildGroups();
  }

  private handleQuotesDiagnostic(diagnostic: QuotesServiceDiagnostic): void {
    if (diagnostic.type === 'connection-error') {
      this.reportDiagnosticsByCode('WS_CONNECTION_ERROR', diagnostic.error);
      return;
    }

    this.reportDiagnosticsByCode('WS_PAYLOAD_INVALID', diagnostic.issue);
  }

  private showCloseMessage(orderIds: number[]): void {
    this.showSnackbar(buildCloseMessage(orderIds));
  }

  private showSnackbar(message: string): void {
    this.snackbarMessage.set(message);
    this.isSnackbarVisible.set(true);

    this.snackbarTimerId = this.clearTimer(this.snackbarTimerId);

    this.snackbarTimerId = setTimeout(() => {
      this.isSnackbarVisible.set(false);
      this.snackbarTimerId = null;
    }, 3500);
  }

  private afterOrdersDataChange(): void {
    this.rebuildGroups();
    this.syncQuoteSubscriptions();
  }

  private reportDiagnosticsByCode(
    code: DiagnosticsCode,
    messageOrContext?: string | InvalidOrderInfo | unknown,
    maybeContext?: InvalidOrderInfo | unknown
  ): void {
    const definition = DIAGNOSTICS_DEFINITIONS[code];
    const message =
      typeof messageOrContext === 'string' ? messageOrContext : definition.defaultMessage;
    const context = typeof messageOrContext === 'string' ? maybeContext : messageOrContext;

    this.reportDiagnostics(code, definition.level, message, context);
  }

  private reportDiagnostics(
    code: DiagnosticsCode,
    level: DiagnosticsLevel,
    message: string,
    context?: InvalidOrderInfo | unknown
  ): void {
    const entry: DiagnosticsEntry = {
      code,
      level,
      message,
      timestamp: this.getDiagnosticsTimestamp()
    };

    this.diagnostics.set(entry);

    const logPayload = `[Orders diagnostics][${code}][${entry.timestamp}] ${message}`;
    if (level === 'critical') {
      console.error(logPayload, context);
      return;
    }

    console.warn(logPayload, context);
  }

  private getDiagnosticsTimestamp(): string {
    return new Date().toISOString();
  }

  private clearTimer(timerId: ReturnType<typeof setTimeout> | null): null {
    if (timerId !== null) {
      clearTimeout(timerId);
    }

    return null;
  }
}

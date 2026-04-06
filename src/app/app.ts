import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { WebSocketSubject, webSocket } from 'rxjs/webSocket';
import {
  ApiOrder,
  BrowserStorage,
  ResolvedThemeMode,
  SymbolGroup,
  ThemePreference
} from './orders.types';
import {
  applyBidUpdates,
  buildCloseMessage,
  diffSymbolSubscriptions,
  getOrderIdsBySymbol,
  getOrderSymbols,
  hasOrderById,
  isThemePreference,
  parseQuoteBidUpdates,
  removeGroupOrders,
  removeSingleOrder
} from './app.helpers';
import { buildGroupsFromOrders, extractOrders } from './orders.utils';

@Component({
  selector: 'app-root',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  private readonly ordersUrl = 'https://geeksoft.pl/assets/order-data.json';
  private readonly quotesSocketUrl = 'wss://webquotes.geeksoft.pl/websocket/quotes';
  private readonly themeStorageKey = 'orders-theme-preference';

  private ordersData: ApiOrder[] = [];
  private readonly bidBySymbol = new Map<string, number>();

  private quotesSocket: WebSocketSubject<unknown> | null = null;
  private quotesSubscription: Subscription | null = null;
  private readonly subscribedSymbols = new Set<string>();
  private reconnectTimerId: ReturnType<typeof setTimeout> | null = null;
  private snackbarTimerId: ReturnType<typeof setTimeout> | null = null;

  private isDestroyed = false;
  private mediaQueryList: MediaQueryList | null = null;
  private mediaQueryListener: ((event: MediaQueryListEvent) => void) | null = null;

  /** Symbole z rozwiniętymi szczegółami — źródło prawdy zamiast mutacji `group.expanded`. */
  private readonly expandedSymbolKeys = signal<ReadonlySet<string>>(new Set<string>());

  readonly groups = signal<SymbolGroup[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal('');

  readonly isSnackbarVisible = signal(false);
  readonly snackbarMessage = signal('');

  readonly themePreference = signal<ThemePreference>(this.readStoredThemePreference());
  private readonly systemPrefersDark = signal(this.readSystemPrefersDark());

  readonly themeMode = computed<ResolvedThemeMode>(() => {
    const pref = this.themePreference();
    if (pref === 'system') {
      return this.systemPrefersDark() ? 'dark' : 'light';
    }
    return pref;
  });

  private readonly syncDocumentTheme = effect(() => {
    const mode = this.themeMode();
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.style.colorScheme = mode;
  });

  ngOnInit(): void {
    this.initSystemThemeListener();
    this.loadOrders();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.detachSystemThemeListener();
    this.closeQuotesSocket();

    this.reconnectTimerId = this.clearTimer(this.reconnectTimerId);
    this.snackbarTimerId = this.clearTimer(this.snackbarTimerId);
    this.quotesSubscription?.unsubscribe();
    this.quotesSubscription = null;
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
    const next: ThemePreference = this.themeMode() === 'dark' ? 'light' : 'dark';
    this.setThemePreference(next);
  }

  protected setThemePreference(mode: ThemePreference): void {
    this.themePreference.set(mode);
    this.getBrowserStorage()?.setItem(this.themeStorageKey, mode);
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

    this.http
      .get<unknown>(this.ordersUrl)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.ordersData = extractOrders(response);
          this.rebuildGroups({ resetExpansion: true });
          this.isLoading.set(false);

          this.connectQuotesSocket();
          this.syncQuoteSubscriptions();
        },
        error: () => {
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

  private connectQuotesSocket(): void {
    if (typeof WebSocket === 'undefined') {
      return;
    }

    if (this.quotesSocket && !this.quotesSocket.closed) {
      return;
    }

    const socket$ = webSocket<unknown>({
      url: this.quotesSocketUrl,
      openObserver: {
        next: () => this.syncQuoteSubscriptions()
      },
      closeObserver: {
        next: () => {
          if (this.quotesSocket === socket$) {
            this.quotesSocket = null;
          }
          this.subscribedSymbols.clear();
          this.scheduleReconnect();
        }
      }
    });

    this.quotesSocket = socket$;
    this.quotesSubscription?.unsubscribe();
    this.quotesSubscription = socket$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (message) => this.handleQuoteMessage(message),
        error: (error) => {
          if (error && typeof error === 'object' && Object.keys(error as object).length > 0) {
            console.error('WebSocket quotes connection error', error);
          }
        }
      });
  }

  private closeQuotesSocket(): void {
    if (this.quotesSocket && !this.quotesSocket.closed) {
      this.sendSocketEvent('/subscribe/removelist', Array.from(this.subscribedSymbols));
    }

    this.subscribedSymbols.clear();

    if (!this.quotesSocket) {
      return;
    }

    this.quotesSocket.complete();
    this.quotesSocket = null;
  }

  private scheduleReconnect(): void {
    if (this.isDestroyed || this.ordersData.length === 0 || this.reconnectTimerId !== null) {
      return;
    }

    this.reconnectTimerId = setTimeout(() => {
      this.reconnectTimerId = null;
      this.connectQuotesSocket();
    }, 2000);
  }

  private syncQuoteSubscriptions(): void {
    const desiredSymbols = getOrderSymbols(this.ordersData);

    if (!this.quotesSocket || this.quotesSocket.closed) {
      return;
    }

    const { symbolsToAdd, symbolsToRemove } = diffSymbolSubscriptions(
      desiredSymbols,
      this.subscribedSymbols
    );

    this.sendSocketEvent('/subscribe/addlist', symbolsToAdd);
    this.sendSocketEvent('/subscribe/removelist', symbolsToRemove);

    for (const symbol of symbolsToAdd) {
      this.subscribedSymbols.add(symbol);
    }

    for (const symbol of symbolsToRemove) {
      this.subscribedSymbols.delete(symbol);
      this.bidBySymbol.delete(symbol);
    }
  }

  private sendSocketEvent(
    path: '/subscribe/addlist' | '/subscribe/removelist',
    symbols: string[]
  ): void {
    if (!this.quotesSocket || this.quotesSocket.closed || symbols.length === 0) {
      return;
    }

    this.quotesSocket.next({
      p: path,
      d: symbols
    });
  }

  private handleQuoteMessage(message: unknown): void {
    const updates = parseQuoteBidUpdates(JSON.stringify(message));
    if (updates.length === 0) {
      return;
    }

    const didChange = applyBidUpdates(this.bidBySymbol, updates);
    if (!didChange) {
      return;
    }

    this.rebuildGroups();
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

  private readStoredThemePreference(): ThemePreference {
    if (typeof window === 'undefined') {
      return 'system';
    }

    const storedTheme = this.getBrowserStorage()?.getItem(this.themeStorageKey);
    if (isThemePreference(storedTheme)) {
      return storedTheme;
    }

    return 'system';
  }

  private readSystemPrefersDark(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private initSystemThemeListener(): void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    this.mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaQueryListener = () => {
      this.systemPrefersDark.set(window.matchMedia('(prefers-color-scheme: dark)').matches);
    };

    if (typeof this.mediaQueryList.addEventListener === 'function') {
      this.mediaQueryList.addEventListener('change', this.mediaQueryListener);
      return;
    }

    const legacyMediaQueryList = this.mediaQueryList as MediaQueryList & {
      addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
    };
    legacyMediaQueryList.addListener?.(this.mediaQueryListener);
  }

  private detachSystemThemeListener(): void {
    if (!this.mediaQueryList || !this.mediaQueryListener) {
      return;
    }

    if (typeof this.mediaQueryList.removeEventListener === 'function') {
      this.mediaQueryList.removeEventListener('change', this.mediaQueryListener);
      return;
    }

    const legacyMediaQueryList = this.mediaQueryList as MediaQueryList & {
      removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
    };
    legacyMediaQueryList.removeListener?.(this.mediaQueryListener);
  }

  private getBrowserStorage(): BrowserStorage | null {
    if (typeof window === 'undefined') {
      return null;
    }

    let storage: Partial<BrowserStorage> | undefined;
    try {
      storage = (window as Window & { localStorage?: unknown }).localStorage as
        | Partial<BrowserStorage>
        | undefined;
    } catch {
      return null;
    }

    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
      return null;
    }

    return storage as BrowserStorage;
  }

  private afterOrdersDataChange(): void {
    this.rebuildGroups();
    this.syncQuoteSubscriptions();
  }

  private clearTimer(timerId: ReturnType<typeof setTimeout> | null): null {
    if (timerId !== null) {
      clearTimeout(timerId);
    }

    return null;
  }
}

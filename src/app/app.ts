import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
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
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);

  private readonly ordersUrl = 'https://geeksoft.pl/assets/order-data.json';
  private readonly quotesSocketUrl = 'wss://webquotes.geeksoft.pl/websocket/quotes';
  private readonly themeStorageKey = 'orders-theme-preference';

  private ordersData: ApiOrder[] = [];
  private readonly bidBySymbol = new Map<string, number>();

  private quotesSocket: WebSocket | null = null;
  private readonly subscribedSymbols = new Set<string>();
  private reconnectTimerId: ReturnType<typeof setTimeout> | null = null;
  private snackbarTimerId: ReturnType<typeof setTimeout> | null = null;

  private isDestroyed = false;
  private mediaQueryList: MediaQueryList | null = null;
  private mediaQueryListener: ((event: MediaQueryListEvent) => void) | null = null;

  protected groups: SymbolGroup[] = [];
  protected isLoading = true;
  protected errorMessage = '';

  protected isSnackbarVisible = false;
  protected snackbarMessage = '';

  protected themePreference: ThemePreference = this.getInitialThemePreference();
  protected themeMode: ResolvedThemeMode = 'light';

  ngOnInit(): void {
    this.initSystemThemeListener();
    this.applyThemePreference(this.themePreference);
    this.loadOrders();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.detachSystemThemeListener();
    this.closeQuotesSocket();

    this.reconnectTimerId = this.clearTimer(this.reconnectTimerId);
    this.snackbarTimerId = this.clearTimer(this.snackbarTimerId);
  }

  protected toggleGroup(symbol: string): void {
    const group = this.groups.find((item) => item.symbol === symbol);
    if (!group) {
      return;
    }

    group.expanded = !group.expanded;
  }

  protected removeGroup(symbol: string, event: Event): void {
    event.stopPropagation();

    const orderIds = getOrderIdsBySymbol(this.ordersData, symbol);

    if (orderIds.length === 0) {
      return;
    }

    this.ordersData = removeGroupOrders(this.ordersData, symbol);
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
    this.isSnackbarVisible = false;
    this.snackbarTimerId = this.clearTimer(this.snackbarTimerId);
  }

  protected toggleLightDark(): void {
    const nextMode: ResolvedThemeMode = this.themeMode === 'dark' ? 'light' : 'dark';
    this.setThemePreference(nextMode);
  }

  protected setThemePreference(mode: ThemePreference): void {
    this.themePreference = mode;
    this.applyThemePreference(mode);
    this.getBrowserStorage()?.setItem(this.themeStorageKey, mode);
  }

  protected onThemePreferenceChange(event: Event): void {
    const mode = (event.target as HTMLSelectElement | null)?.value;
    if (isThemePreference(mode)) {
      this.setThemePreference(mode);
    }
  }

  private loadOrders(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.http.get<unknown>(this.ordersUrl).subscribe({
      next: (response) => {
        this.ordersData = extractOrders(response);
        this.rebuildGroups(false);
        this.isLoading = false;

        this.connectQuotesSocket();
        this.syncQuoteSubscriptions();
        this.requestViewUpdate();
      },
      error: () => {
        this.errorMessage = 'Nie udało się pobrać danych zleceń. Spróbuj ponownie.';
        this.isLoading = false;
        this.requestViewUpdate();
      }
    });
  }

  private rebuildGroups(preserveExpansion: boolean): void {
    const expandedBySymbol = preserveExpansion
      ? new Map(this.groups.map((group) => [group.symbol, group.expanded] as const))
      : new Map<string, boolean>();

    this.groups = buildGroupsFromOrders(this.ordersData, this.bidBySymbol);

    if (!preserveExpansion) {
      return;
    }

    for (const group of this.groups) {
      group.expanded = expandedBySymbol.get(group.symbol) ?? false;
    }
  }

  private connectQuotesSocket(): void {
    if (typeof WebSocket === 'undefined') {
      return;
    }

    if (this.quotesSocket && (
      this.quotesSocket.readyState === WebSocket.OPEN
      || this.quotesSocket.readyState === WebSocket.CONNECTING
    )) {
      return;
    }

    const socket = new WebSocket(this.quotesSocketUrl);
    this.quotesSocket = socket;

    socket.onopen = () => {
      this.syncQuoteSubscriptions();
    };

    socket.onmessage = (event: MessageEvent<string>) => {
      this.handleQuoteMessage(event.data);
    };

    socket.onclose = () => {
      if (this.quotesSocket === socket) {
        this.quotesSocket = null;
      }

      this.subscribedSymbols.clear();
      this.scheduleReconnect();
    };

    socket.onerror = () => {
      // keep silent; reconnect is handled on close
    };
  }

  private closeQuotesSocket(): void {
    if (this.quotesSocket && this.quotesSocket.readyState === WebSocket.OPEN) {
      this.sendSocketEvent('/subscribe/removelist', Array.from(this.subscribedSymbols));
    }

    this.subscribedSymbols.clear();

    if (!this.quotesSocket) {
      return;
    }

    this.quotesSocket.close();
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

    if (!this.quotesSocket || this.quotesSocket.readyState !== WebSocket.OPEN) {
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

  private sendSocketEvent(path: '/subscribe/addlist' | '/subscribe/removelist', symbols: string[]): void {
    if (!this.quotesSocket || this.quotesSocket.readyState !== WebSocket.OPEN || symbols.length === 0) {
      return;
    }

    this.quotesSocket.send(JSON.stringify({
      p: path,
      d: symbols
    }));
  }

  private handleQuoteMessage(rawData: string): void {
    const updates = parseQuoteBidUpdates(rawData);
    if (updates.length === 0) {
      return;
    }

    const didChange = applyBidUpdates(this.bidBySymbol, updates);
    if (!didChange) {
      return;
    }

    this.rebuildGroups(true);
    this.requestViewUpdate();
  }

  private showCloseMessage(orderIds: number[]): void {
    this.showSnackbar(buildCloseMessage(orderIds));
  }

  private showSnackbar(message: string): void {
    this.snackbarMessage = message;
    this.isSnackbarVisible = true;

    this.snackbarTimerId = this.clearTimer(this.snackbarTimerId);

    this.snackbarTimerId = setTimeout(() => {
      this.isSnackbarVisible = false;
      this.snackbarTimerId = null;
      this.requestViewUpdate();
    }, 3500);
  }

  private getInitialThemePreference(): ThemePreference {
    if (typeof window === 'undefined') {
      return 'system';
    }

    const storedTheme = this.getBrowserStorage()?.getItem(this.themeStorageKey);
    if (isThemePreference(storedTheme)) {
      return storedTheme;
    }

    return 'system';
  }

  private getSystemThemeMode(): ResolvedThemeMode {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    return 'light';
  }

  private applyThemePreference(mode: ThemePreference): void {
    const resolvedMode = mode === 'system' ? this.getSystemThemeMode() : mode;
    this.applyTheme(resolvedMode);
  }

  private applyTheme(mode: ResolvedThemeMode): void {
    this.themeMode = mode;

    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.style.colorScheme = mode;
  }

  private initSystemThemeListener(): void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    this.mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaQueryListener = () => {
      if (this.themePreference === 'system') {
        this.applyTheme(this.getSystemThemeMode());
      }
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
      storage = (window as Window & { localStorage?: unknown }).localStorage as Partial<BrowserStorage> | undefined;
    } catch {
      return null;
    }

    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
      return null;
    }

    return storage as BrowserStorage;
  }

  private requestViewUpdate(): void {
    if (this.isDestroyed) {
      return;
    }

    // In zoneless mode async callbacks may not refresh UI automatically.
    queueMicrotask(() => {
      if (!this.isDestroyed) {
        this.cdr.detectChanges();
      }
    });
  }

  private afterOrdersDataChange(): void {
    this.rebuildGroups(true);
    this.syncQuoteSubscriptions();
  }

  private clearTimer(timerId: ReturnType<typeof setTimeout> | null): null {
    if (timerId !== null) {
      clearTimeout(timerId);
    }

    return null;
  }
}

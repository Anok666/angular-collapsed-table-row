import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EMPTY, Subject } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { ApiOrder } from './orders.types';
import {
  buildCloseMessage,
  getOrderSymbols,
  hasOrderById,
  removeGroupOrders,
  removeSingleOrder
} from './utils/orders.helpers';
import { DIAGNOSTICS_DEFINITIONS, DiagnosticsCode, DiagnosticsEntry } from '../core/diagnostics';
import { buildGroupsFromOrders, buildTableSummary, extractOrders } from './utils/orders.utils';
import { QuotesService, QuotesServiceDiagnostic } from '../core/quotes.service';
import { QuoteBidUpdate } from '../core/quotes.helpers';

@Injectable()
export class OrdersService {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly quotesService = inject(QuotesService);
  private readonly snackBar = inject(MatSnackBar);

  private readonly ordersUrl = 'https://geeksoft.pl/assets/order-data.json';
  private readonly quotesSocketUrl = 'wss://webquotes.geeksoft.pl/websocket/quotes';

  private readonly _orders = signal<ApiOrder[]>([]);
  private readonly _bidBySymbol = signal<Map<string, number>>(new Map());
  private readonly _expandedSymbols = signal<ReadonlySet<string>>(new Set());
  private readonly loadTrigger$ = new Subject<void>();

  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly diagnostics = signal<DiagnosticsEntry | null>(null);

  readonly groups = computed(() =>
    buildGroupsFromOrders(this._orders(), this._bidBySymbol(), this._expandedSymbols())
  );
  readonly summary = computed(() => buildTableSummary(this.groups()));

  constructor() {
    this.loadTrigger$
      .pipe(
        switchMap(() =>
          this.http.get<unknown>(this.ordersUrl).pipe(
            catchError((err) => {
              this.report('HTTP_FETCH_FAILED', err);
              this.errorMessage.set('Nie udało się pobrać danych zleceń. Spróbuj ponownie.');
              this.isLoading.set(false);
              return EMPTY;
            })
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        let invalidCount = 0;
        this._orders.set(
          extractOrders(response, (info) => {
            invalidCount++;
            this.report('DATA_VALIDATION_WARNING', info);
          })
        );
        this._expandedSymbols.set(new Set());
        this.isLoading.set(false);

        if (invalidCount > 0) {
          this.report('DATA_PARTIAL_VALIDATION', `Pominieto ${invalidCount} niepoprawnych rekordow z API.`);
        }
        if (this._orders().length === 0) {
          this.report('DATA_EMPTY_AFTER_VALIDATION');
        }
        this.syncQuoteSubscriptions();
      });

    this.quotesService.bidUpdates$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((updates) => this.onBidUpdates(updates));

    this.quotesService.diagnostics$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((d) => this.onQuotesDiagnostic(d));
  }

  init(): void {
    this.quotesService.connect(this.quotesSocketUrl);
    this.loadOrders();
  }

  retryLoad(): void {
    this.loadOrders();
  }

  toggleGroup(symbol: string): void {
    this._expandedSymbols.update((prev) => {
      const next = new Set(prev);
      next.has(symbol) ? next.delete(symbol) : next.add(symbol);
      return next;
    });
  }

  removeGroup(symbol: string): void {
    const { updatedOrders, removedIds } = removeGroupOrders(this._orders(), symbol);
    if (removedIds.length === 0) return;

    this._orders.set(updatedOrders);
    this._expandedSymbols.update((prev) => {
      const next = new Set(prev);
      next.delete(symbol);
      return next;
    });
    this.syncQuoteSubscriptions();
    this.snackBar.open(buildCloseMessage(removedIds), 'Zamknij', { duration: 3500 });
  }

  removeOrder(symbol: string, orderId: number): void {
    if (!hasOrderById(this._orders(), symbol, orderId)) return;

    this._orders.update((orders) => removeSingleOrder(orders, symbol, orderId));
    this.syncQuoteSubscriptions();
    this.snackBar.open(buildCloseMessage([orderId]), 'Zamknij', { duration: 3500 });
  }

  private loadOrders(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.diagnostics.set(null);
    this.loadTrigger$.next();
  }

  private onBidUpdates(updates: QuoteBidUpdate[]): void {
    const current = this._bidBySymbol();
    const next = new Map(current);
    let changed = false;

    for (const { symbol, bid } of updates) {
      if (current.get(symbol) !== bid) {
        next.set(symbol, bid);
        changed = true;
      }
    }

    if (changed) this._bidBySymbol.set(next);
  }

  private syncQuoteSubscriptions(): void {
    const desired = getOrderSymbols(this._orders());
    const current = this._bidBySymbol();
    const stale = Array.from(current.keys()).filter((s) => !desired.has(s));

    if (stale.length > 0) {
      const next = new Map(current);
      stale.forEach((s) => next.delete(s));
      this._bidBySymbol.set(next);
    }

    this.quotesService.setDesiredSymbols(desired);
  }

  private onQuotesDiagnostic(diagnostic: QuotesServiceDiagnostic): void {
    this.report(
      diagnostic.type === 'connection-error' ? 'WS_CONNECTION_ERROR' : 'WS_PAYLOAD_INVALID',
      diagnostic.type === 'connection-error' ? diagnostic.error : diagnostic.issue
    );
  }

  private report(code: DiagnosticsCode, context?: unknown): void {
    const def = DIAGNOSTICS_DEFINITIONS[code];
    const message = typeof context === 'string' ? context : def.defaultMessage;
    const logContext = typeof context !== 'string' ? context : undefined;

    const entry: DiagnosticsEntry = {
      code,
      level: def.level,
      message,
      timestamp: new Date().toISOString()
    };

    this.diagnostics.set(entry);

    const log = `[Orders][${code}][${entry.timestamp}] ${message}`;
    def.level === 'critical' ? console.error(log, logContext) : console.warn(log, logContext);
  }
}

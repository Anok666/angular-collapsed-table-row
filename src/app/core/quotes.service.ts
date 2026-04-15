import { DestroyRef, Injectable, inject } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { WebSocketSubject, webSocket } from 'rxjs/webSocket';
import { ParseQuoteIssue, QuoteBidUpdate, diffSymbolSubscriptions, parseQuoteBidUpdates } from './quotes.helpers';

export type QuotesServiceDiagnostic =
  | { type: 'connection-error'; error: unknown }
  | { type: 'payload-warning'; issue: ParseQuoteIssue };

@Injectable()
export class QuotesService {
  private readonly destroyRef = inject(DestroyRef);

  readonly bidUpdates$ = new Subject<QuoteBidUpdate[]>();
  readonly diagnostics$ = new Subject<QuotesServiceDiagnostic>();

  private socketUrl = '';
  private quotesSocket: WebSocketSubject<unknown> | null = null;
  private quotesSubscription: Subscription | null = null;
  private reconnectTimerId: ReturnType<typeof setTimeout> | null = null;

  private readonly subscribedSymbols = new Set<string>();
  private desiredSymbols = new Set<string>();

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.reconnectTimerId = this.clearTimer(this.reconnectTimerId);
      this.closeSocket();
      this.quotesSubscription?.unsubscribe();
      this.quotesSubscription = null;
    });
  }

  connect(socketUrl: string): void {
    this.socketUrl = socketUrl;
    this.connectSocket();
  }

  setDesiredSymbols(symbols: Set<string>): void {
    this.desiredSymbols = new Set(symbols);
    this.syncSubscriptions();
  }

  private connectSocket(): void {
    if (typeof WebSocket === 'undefined') {
      return;
    }

    if (!this.socketUrl || (this.quotesSocket && !this.quotesSocket.closed)) {
      return;
    }

    const socket$ = webSocket<unknown>({
      url: this.socketUrl,
      openObserver: { next: () => this.syncSubscriptions() },
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
    this.quotesSubscription = socket$.subscribe({
      next: (message) => this.handleQuoteMessage(message),
      error: (error) => {
        if (!this.hasUsefulErrorContext(error)) {
          return;
        }

        this.diagnostics$.next({ type: 'connection-error', error });
      }
    });
  }

  private closeSocket(): void {
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
    if (this.desiredSymbols.size === 0 || this.reconnectTimerId !== null) {
      return;
    }

    this.reconnectTimerId = setTimeout(() => {
      this.reconnectTimerId = null;
      this.connectSocket();
    }, 2000);
  }

  private syncSubscriptions(): void {
    if (!this.quotesSocket || this.quotesSocket.closed) {
      return;
    }

    const { symbolsToAdd, symbolsToRemove } = diffSymbolSubscriptions(
      this.desiredSymbols,
      this.subscribedSymbols
    );

    this.sendSocketEvent('/subscribe/addlist', symbolsToAdd);
    this.sendSocketEvent('/subscribe/removelist', symbolsToRemove);

    for (const symbol of symbolsToAdd) {
      this.subscribedSymbols.add(symbol);
    }

    for (const symbol of symbolsToRemove) {
      this.subscribedSymbols.delete(symbol);
    }
  }

  private sendSocketEvent(
    path: '/subscribe/addlist' | '/subscribe/removelist',
    symbols: string[]
  ): void {
    if (!this.quotesSocket || this.quotesSocket.closed || symbols.length === 0) {
      return;
    }

    this.quotesSocket.next({ p: path, d: symbols });
  }

  private handleQuoteMessage(message: unknown): void {
    const updates = parseQuoteBidUpdates(message, (issue) =>
      this.diagnostics$.next({ type: 'payload-warning', issue })
    );
    if (updates.length === 0) {
      return;
    }

    this.bidUpdates$.next(updates);
  }

  private hasUsefulErrorContext(error: unknown): boolean {
    if (error === null || typeof error === 'undefined') {
      return false;
    }

    if (typeof error !== 'object') {
      return true;
    }

    return Object.keys(error as object).length > 0;
  }

  private clearTimer(timerId: ReturnType<typeof setTimeout> | null): null {
    if (timerId !== null) {
      clearTimeout(timerId);
    }

    return null;
  }
}

import { ApiOrder, QuoteSocketEvent, ThemePreference } from './orders.types';

export type QuoteBidUpdate = {
  symbol: string;
  bid: number;
};

export type ParseQuoteIssue = {
  reason: string;
  payload?: unknown;
};

export function hasOrderById(orders: ApiOrder[], symbol: string, orderId: number): boolean {
  return orders.some((order) => order.symbol === symbol && order.id === orderId);
}

export function removeGroupOrders(
  orders: ApiOrder[],
  symbol: string
): { updatedOrders: ApiOrder[]; removedIds: number[] } {
  const removedIds: number[] = [];
  const updatedOrders = orders.filter((order) => {
    if (order.symbol === symbol) {
      removedIds.push(order.id);
      return false;
    }
    return true;
  });
  return { updatedOrders, removedIds };
}

export function removeSingleOrder(orders: ApiOrder[], symbol: string, orderId: number): ApiOrder[] {
  return orders.filter((order) => !(order.symbol === symbol && order.id === orderId));
}

export function getOrderSymbols(orders: ApiOrder[]): Set<string> {
  return new Set(orders.map((order) => order.symbol));
}

export function diffSymbolSubscriptions(desiredSymbols: Set<string>, subscribedSymbols: Set<string>): {
  symbolsToAdd: string[];
  symbolsToRemove: string[];
} {
  return {
    symbolsToAdd: Array.from(desiredSymbols).filter((symbol) => !subscribedSymbols.has(symbol)),
    symbolsToRemove: Array.from(subscribedSymbols).filter((symbol) => !desiredSymbols.has(symbol))
  };
}

export function parseQuoteBidUpdates(
  message: unknown,
  onIssue?: (issue: ParseQuoteIssue) => void
): QuoteBidUpdate[] {
  const payload = message as QuoteSocketEvent | null;

  if (!payload || typeof payload.p !== 'string') {
    onIssue?.({ reason: 'Websocket message is not a valid event object.', payload: message });
    return [];
  }

  if (payload.p !== '/quotes/subscribed') {
    return [];
  }

  if (!Array.isArray(payload.d)) {
    onIssue?.({ reason: 'Expected array in "d" field of /quotes/subscribed event.', payload });
    return [];
  }

  const updates: QuoteBidUpdate[] = [];
  for (const quote of payload.d) {
    if (typeof quote?.s === 'string' && typeof quote?.b === 'number') {
      updates.push({ symbol: quote.s, bid: quote.b });
      continue;
    }

    onIssue?.({
      reason: 'Quote item has invalid shape.',
      payload: quote
    });
  }

  return updates;
}

export function applyBidUpdates(bidBySymbol: Map<string, number>, updates: QuoteBidUpdate[]): boolean {
  let didChange = false;

  for (const update of updates) {
    if (bidBySymbol.get(update.symbol) !== update.bid) {
      bidBySymbol.set(update.symbol, update.bid);
      didChange = true;
    }
  }

  return didChange;
}

export function buildCloseMessage(orderIds: number[]): string {
  return `Zamknięto zlecenie nr ${orderIds.join(', ')}`;
}

export function isThemePreference(mode: string | null | undefined): mode is ThemePreference {
  return mode === 'light' || mode === 'dark' || mode === 'system';
}

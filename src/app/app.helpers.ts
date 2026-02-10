import { ApiOrder, QuoteMessage, ThemePreference } from './orders.types';

type QuoteBidUpdate = {
  symbol: string;
  bid: number;
};

export function getOrderIdsBySymbol(orders: ApiOrder[], symbol: string): number[] {
  return orders
    .filter((order) => order.symbol === symbol)
    .map((order) => order.id);
}

export function hasOrderById(orders: ApiOrder[], symbol: string, orderId: number): boolean {
  return orders.some((order) => order.symbol === symbol && order.id === orderId);
}

export function removeGroupOrders(orders: ApiOrder[], symbol: string): ApiOrder[] {
  return orders.filter((order) => order.symbol !== symbol);
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

export function parseQuoteBidUpdates(rawData: string): QuoteBidUpdate[] {
  let payload: QuoteMessage | null = null;
  try {
    payload = JSON.parse(rawData) as QuoteMessage;
  } catch {
    return [];
  }

  if (!payload || payload.p !== '/quotes/subscribed' || !Array.isArray(payload.d)) {
    return [];
  }

  const updates: QuoteBidUpdate[] = [];
  for (const quote of payload.d) {
    if (typeof quote?.s === 'string' && typeof quote?.b === 'number') {
      updates.push({ symbol: quote.s, bid: quote.b });
    }
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

export type OrderSide = 'BUY' | 'SELL';

export interface ApiOrder {
  id: number;
  symbol: string;
  side: OrderSide;
  openTime: number;
  openPrice: number;
  swap: number;
  size: number;
}

export type QuotesSubscribedEvent = {
  p: '/quotes/subscribed';
  d: Array<{
    s: string;
    b: number;
    a: number;
    t: number;
  }>;
};

export type QuoteSocketEvent = QuotesSubscribedEvent | {
  p: string;
  d?: unknown;
};

export interface Order extends ApiOrder {
  profit: number;
}

export interface SymbolGroup {
  symbol: string;
  orders: Order[];
  count: number;
  openPriceAvg: number;
  swapSum: number;
  profitAvg: number;
  sizeSum: number;
  expanded: boolean;
}

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedThemeMode = 'light' | 'dark';

export type BrowserStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

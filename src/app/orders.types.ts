export interface ApiOrder {
  id: number;
  symbol: string;
  side: string;
  openTime: number;
  openPrice: number;
  swap: number;
  size: number;
}

export interface QuoteMessage {
  p: string;
  d: Array<{
    s: string;
    b: number;
    a: number;
    t: number;
  }>;
}

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

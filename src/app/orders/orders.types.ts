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

export interface TableSummary {
  totalCount: number;
  openPriceAvg: number;
  swapSum: number;
  profitAvg: number;
  sizeSum: number;
}

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedThemeMode = 'light' | 'dark';

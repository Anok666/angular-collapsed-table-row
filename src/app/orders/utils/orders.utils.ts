import { ApiOrder, Order, SymbolGroup, TableSummary } from '../orders.types';

export type InvalidOrderInfo = {
  reason: string;
  rawOrder: unknown;
};

export const MULTIPLIER_EXPONENT_BY_SYMBOL: Record<string, number> = {
  BTCUSD: 2,
  ETHUSD: 3,
  'TTWO.US': 1
};

export function extractOrders(
  response: unknown,
  onInvalidOrder?: (invalidOrder: InvalidOrderInfo) => void
): ApiOrder[] {
  const payload = response as { data?: unknown; orders?: unknown } | unknown[];
  const rawOrders = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.orders)
        ? payload.orders
        : [];

  return rawOrders
    .map((rawOrder) => toApiOrder(rawOrder, onInvalidOrder))
    .filter((order): order is ApiOrder => order !== null);
}

export function buildGroupsFromOrders(
  ordersData: ApiOrder[],
  bidBySymbol: Map<string, number>,
  expandedSymbols: ReadonlySet<string> = new Set(),
  exponentBySymbol: Record<string, number> = MULTIPLIER_EXPONENT_BY_SYMBOL
): SymbolGroup[] {
  const groupedOrders = new Map<string, Order[]>();

  for (const order of ordersData) {
    if (!groupedOrders.has(order.symbol)) {
      groupedOrders.set(order.symbol, []);
    }

    groupedOrders.get(order.symbol)?.push(normalizeOrder(order, bidBySymbol, exponentBySymbol));
  }

  return Array.from(groupedOrders.entries()).map(([symbol, orders]) =>
    createGroup(symbol, orders, expandedSymbols.has(symbol))
  );
}

export function buildTableSummary(groups: SymbolGroup[]): TableSummary {
  const totalCount = groups.reduce((acc, g) => acc + g.count, 0);

  if (totalCount === 0) {
    return { totalCount: 0, openPriceAvg: 0, swapSum: 0, profitAvg: 0, sizeSum: 0 };
  }

  return {
    totalCount,
    openPriceAvg: groups.reduce((acc, g) => acc + g.openPriceAvg * g.count, 0) / totalCount,
    swapSum: groups.reduce((acc, g) => acc + g.swapSum, 0),
    profitAvg: groups.reduce((acc, g) => acc + g.profitAvg * g.count, 0) / totalCount,
    sizeSum: groups.reduce((acc, g) => acc + g.sizeSum, 0)
  };
}

export function calculateProfit(
  order: ApiOrder,
  bidBySymbol: Map<string, number>,
  exponentBySymbol: Record<string, number> = MULTIPLIER_EXPONENT_BY_SYMBOL
): number {
  // API does not provide closePrice. We use order price as closePrice for the required formula.
  const closePrice = order.openPrice;
  const priceBid = bidBySymbol.get(order.symbol) ?? closePrice;
  const sideMultiplier = order.side === 'BUY' ? 1 : -1;
  const multiplier = getMultiplier(order.symbol, exponentBySymbol);

  return ((closePrice - priceBid) * multiplier * sideMultiplier) / 100;
}

function normalizeOrder(
  order: ApiOrder,
  bidBySymbol: Map<string, number>,
  exponentBySymbol: Record<string, number>
): Order {
  return {
    ...order,
    profit: calculateProfit(order, bidBySymbol, exponentBySymbol)
  };
}

function createGroup(symbol: string, orders: Order[], expanded: boolean): SymbolGroup {
  const count = orders.length;
  const openPriceAvg = count === 0
    ? 0
    : orders.reduce((acc, order) => acc + order.openPrice, 0) / count;
  const profitAvg = count === 0
    ? 0
    : orders.reduce((acc, order) => acc + order.profit, 0) / count;

  return {
    symbol,
    orders,
    count,
    openPriceAvg,
    profitAvg,
    swapSum: orders.reduce((acc, order) => acc + order.swap, 0),
    sizeSum: orders.reduce((acc, order) => acc + order.size, 0),
    expanded
  };
}

function getMultiplier(symbol: string, exponentBySymbol: Record<string, number>): number {
  const exponent = exponentBySymbol[symbol];
  if (typeof exponent !== 'number') {
    return 1;
  }

  return 10 ** exponent;
}

function toApiOrder(
  rawOrder: unknown,
  onInvalidOrder?: (invalidOrder: InvalidOrderInfo) => void
): ApiOrder | null {
  const raw = rawOrder as Record<string, unknown>;

  const id = Number(raw['id']);
  const symbol = typeof raw['symbol'] === 'string' ? raw['symbol'] : '';
  const side = raw['side'] === 'BUY' || raw['side'] === 'SELL' ? raw['side'] : '';
  const openTime = Number(raw['openTime']);
  const openPrice = Number(raw['openPrice'] ?? raw['price'] ?? raw['closePrice']);
  const swap = Number(raw['swap']);
  const size = Number(raw['size']);

  if (
    !Number.isFinite(id)
    || !symbol
    || !side
    || !Number.isFinite(openTime)
    || !Number.isFinite(openPrice)
    || !Number.isFinite(swap)
    || !Number.isFinite(size)
  ) {
    onInvalidOrder?.({
      reason: 'Invalid order payload shape or numeric fields.',
      rawOrder
    });
    return null;
  }

  return {
    id,
    symbol,
    side,
    openTime,
    openPrice,
    swap,
    size
  };
}

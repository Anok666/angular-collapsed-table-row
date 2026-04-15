import { ApiOrder } from '../orders.types';

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

export function buildCloseMessage(orderIds: number[]): string {
  return `Zamknięto zlecenie nr ${orderIds.join(', ')}`;
}

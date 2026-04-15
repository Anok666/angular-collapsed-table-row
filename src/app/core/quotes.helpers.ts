export type QuotesSubscribedEvent = {
  p: '/quotes/subscribed';
  d: Array<{
    s: string;
    b: number;
    a: number;
    t: number;
  }>;
};

export type QuoteSocketEvent = QuotesSubscribedEvent | { p: string; d?: unknown };

export type QuoteBidUpdate = {
  symbol: string;
  bid: number;
};

export type ParseQuoteIssue = {
  reason: string;
  payload?: unknown;
};

export function diffSymbolSubscriptions(
  desiredSymbols: Set<string>,
  subscribedSymbols: Set<string>
): { symbolsToAdd: string[]; symbolsToRemove: string[] } {
  return {
    symbolsToAdd: Array.from(desiredSymbols).filter((s) => !subscribedSymbols.has(s)),
    symbolsToRemove: Array.from(subscribedSymbols).filter((s) => !desiredSymbols.has(s))
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

    onIssue?.({ reason: 'Quote item has invalid shape.', payload: quote });
  }

  return updates;
}

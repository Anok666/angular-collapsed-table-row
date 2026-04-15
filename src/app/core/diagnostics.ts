export type DiagnosticsLevel = 'warning' | 'critical';

export type DiagnosticsCode =
  | 'DATA_VALIDATION_WARNING'
  | 'DATA_PARTIAL_VALIDATION'
  | 'DATA_EMPTY_AFTER_VALIDATION'
  | 'HTTP_FETCH_FAILED'
  | 'WS_CONNECTION_ERROR'
  | 'WS_PAYLOAD_INVALID';

export type DiagnosticsEntry = {
  code: DiagnosticsCode;
  level: DiagnosticsLevel;
  message: string;
  timestamp: string;
};

export const DIAGNOSTICS_DEFINITIONS: Record<
  DiagnosticsCode,
  { level: DiagnosticsLevel; defaultMessage: string }
> = {
  DATA_VALIDATION_WARNING: {
    level: 'warning',
    defaultMessage: 'Wykryto niepoprawny rekord danych z API.'
  },
  DATA_PARTIAL_VALIDATION: {
    level: 'warning',
    defaultMessage: 'Wykryto niepoprawne rekordy danych z API.'
  },
  DATA_EMPTY_AFTER_VALIDATION: {
    level: 'critical',
    defaultMessage: 'Brak poprawnych danych z API. Tabela moze byc pusta.'
  },
  HTTP_FETCH_FAILED: {
    level: 'critical',
    defaultMessage: 'Nie udalo sie pobrac danych zlecen. Sprobuj ponownie.'
  },
  WS_CONNECTION_ERROR: {
    level: 'critical',
    defaultMessage: 'Wystapil blad polaczenia WebSocket. Notowania moga byc nieaktualne.'
  },
  WS_PAYLOAD_INVALID: {
    level: 'warning',
    defaultMessage: 'Odebrano niepoprawny format notowan WebSocket. Czesci danych mogla zostac pominieta.'
  }
};

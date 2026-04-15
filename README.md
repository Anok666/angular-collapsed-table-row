# Angular Collapsed Table Row

Aplikacja Angular (TypeScript) wyświetlająca tabelę zleceń z grupowaniem, live kwotowaniami i motywem jasnym/ciemnym.

## Funkcjonalności

- pobieranie zleceń przez HTTP z `https://geeksoft.pl/assets/order-data.json`
- grupowanie zleceń po polu `symbol`
- wiersze grup z wartościami agregowanymi (avg open price, Σ swap, avg profit, Σ size)
- rozwijanie szczegółów grupy po kliknięciu
- live obliczanie `profit` na podstawie kwotowań z WebSocket (`wss://webquotes.geeksoft.pl/websocket/quotes`)
- usuwanie pojedynczych zleceń i całych grup z komunikatem snackbar
- wiersz podsumowania (agregacja wszystkich grup)
- motyw `light / dark / system` z automatycznym wykrywaniem preferencji urządzenia

## Stack

- **Angular 21** — standalone components, zoneless (`provideZonelessChangeDetection`), `ChangeDetectionStrategy.OnPush`, signals
- **Angular Material 21** — `MatSnackBar`, `MatButtonToggleGroup`, `MatIconButton`
- **RxJS** — `WebSocketSubject`, `takeUntilDestroyed`
- **Vitest** — testy jednostkowe i e2e-style

## Wymagania

- Node.js 20.x lub 22.x (zalecane LTS)
- npm

## Instalacja

```bash
npm install
```

## Uruchomienie

```bash
npm run start
```

Na konkretnym porcie:

```bash
npm run start -- --host 0.0.0.0 --port 4333
```

## Testy

```bash
npm test -- --watch=false
```

Pokrycie testami:
- grupowanie i przeliczanie `profit`
- subskrypcja WebSocket i aktualizacje kwotowań
- usuwanie zleceń/grup i komunikat snackbar
- scenariusze e2e-style: renderowanie DOM, rozwijanie grup, live update profit

## Struktura projektu

```
src/app/
├── app.ts                          # orkiestrator — HTTP, WebSocket, stan UI, motyw
├── app.html / app.css              # szablon i style komponentu App
├── orders-table.component.*        # tabela zleceń (prezentacyjna, @Input/@Output)
├── theme-controls.component.*      # przełącznik motywu (mat-button-toggle-group)
├── quotes.service.ts               # WebSocket — połączenie, subskrypcje, reconnect
├── theme.service.ts                # motyw light/dark/system, localStorage, matchMedia
├── orders.utils.ts                 # grupowanie, obliczenia profit, agregacje
├── app.helpers.ts                  # pure functions: operacje na zleceniach, parsowanie WS
├── orders.types.ts                 # typy domenowe
├── diagnostics.ts                  # kody i poziomy diagnostyczne
└── testing/                        # MockWebSocket, mock danych API
```

## Checklista wymagań

### Funkcjonalna

- [x] 1. Dane pobierane przez HTTP z `https://geeksoft.pl/assets/order-data.json`
- [x] 2. Grupowanie po `symbol`
- [x] 3. Startowo tylko wiersze grup
- [x] 4. Wiersz grupy: `symbol (count)`, avg open price, Σ swap, avg profit, Σ size
- [x] 5. Kliknięcie rozwija szczegóły; `openTime` w formacie `dd.MM.yyyy HH:mm:ss`
- [x] 6. Przycisk usuń przy każdym wierszu (grupy i zlecenia)
- [x] 7. Komunikat `Zamknięto zlecenie nr xxx` (dla grupy — lista ID po przecinku)
- [x] 8. Snackbar — `MatSnackBar` z Angular Material
- [x] 9. `profit = (closePrice - priceBid) * multiplier * sideMultiplier / 100` z WebSocket

### Motyw

- [x] Light: `rgb(233,237,241)` / `rgb(14,15,26)` / `rgb(220,225,229)` / `rgb(201,209,216)`
- [x] Dark: `rgb(42,56,71)` / `rgb(198,210,219)` / `rgba(14,15,26,.25)` / `rgba(53,71,89,.5)`
- [x] Profit+: `rgb(60,193,149)` / Profit−: `rgb(249,76,76)` (oba motywy)
- [x] Automatyczne wykrywanie motywu systemowego (`prefers-color-scheme`)
- [x] Ręczne przełączanie light / dark / system

## Szybka weryfikacja ręczna

1. Uruchom: `npm run start -- --host 127.0.0.1 --port 4311`
2. Otwórz [http://127.0.0.1:4311](http://127.0.0.1:4311)
3. Sprawdź grupowanie i wartości agregowane w wierszach grup
4. Rozwiń grupę — zweryfikuj format daty i kolumny szczegółów
5. Usuń zlecenie i grupę — potwierdź treść snackbara
6. Zmień motyw (light / dark / system) i zweryfikuj kolory
7. Uruchom testy: `npm test -- --watch=false`

## Kompatybilność

Chrome · Opera · Safari (najnowsze wersje)

## Najczęstsze problemy

**`ERR_CONNECTION_REFUSED`**
1. Sprawdź czy serwer działa (`npm run start`)
2. Uruchom na innym porcie (`--port 4333`)
3. Hard refresh (`Cmd/Ctrl + Shift + R`)

**Brak aktualizacji kwotowań**
1. Sprawdź zakładkę Network → WS w DevTools
2. Upewnij się że nie działa stara instancja na innym porcie

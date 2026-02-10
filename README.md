# Angular Collapsed Table Row

Prosta aplikacja Angular (TypeScript), która:
- pobiera zlecenia przez HTTP,
- grupuje je po `symbol`,
- rozwija szczegóły po kliknięciu w grupę,
- liczy `profit` na podstawie aktualnych kwotowań z WebSocket,
- pozwala usuwać pojedyncze zlecenia i całe grupy,
- pokazuje komunikat `Zamknięto zlecenie nr ...`,
- obsługuje motyw `light / dark / system`.

## Wymagania
- Node.js 20.x lub 22.x (zalecane LTS)
- npm

## Instalacja
```bash
npm install
```

## Uruchomienie
Standardowo:
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

Testy obejmują:
- logikę grupowania i przeliczania `profit`,
- subskrypcję WebSocket,
- usuwanie zleceń/grup i snackbar,
- scenariusze e2e-style na DOM (widoczność tabeli po load, rozwijanie grup, aktualizacje po quote).

## Struktura
- `src/app/app.ts` - orchestration komponentu (UI state, HTTP, WebSocket, theme)
- `src/app/orders.types.ts` - typy domenowe
- `src/app/orders.utils.ts` - parsowanie API, grupowanie, wyliczenia
- `src/app/app.spec.ts` - testy logiki
- `src/app/app.e2e.spec.ts` - testy przepływów użytkownika (e2e-style)

## Checklista pod oddanie
### Funkcjonalna (1-9)
- [ ] 1. Dane tabeli są pobierane requestem HTTP z `https://geeksoft.pl/assets/order-data.json`.
- [ ] 2. Tabela grupuje zlecenia po polu `symbol`.
- [ ] 3. Startowo widoczne są tylko wiersze grup (bez wierszy szczegółów).
- [ ] 4. Wiersz grupy pokazuje: `symbol (liczba zleceń)`, `open price` (średnia), `swap` (suma), `profit` (średnia), `size` (suma).
- [ ] 5. Kliknięcie w grupę rozwija pełne dane zleceń; `openTime` ma format `dd.MM.yyyy HH:mm:ss`.
- [ ] 6. Każdy wiersz (grupy i szczegółu) ma przycisk zamknięcia/usunięcia.
- [ ] 7. Po zamknięciu pokazuje się komunikat `Zamknięto zlecenie nr xxx` (dla grupy lista ID po przecinku).
- [ ] 8. Komunikat działa jako snackbar/alert (w projekcie: snackbar custom).
- [ ] 9. `profit` liczony jest wg wzoru `(closePrice - priceBid) * multiplier * sideMultiplier / 100`, gdzie `priceBid` pochodzi z WebSocket `wss://webquotes.geeksoft.pl/websocket/quotes`.

### Must-have (motywy)
- [ ] Light theme: tło główne `rgb(233, 237, 241)`, tekst `rgb(14, 15, 26)`, tło wiersza `rgb(220, 225, 229)`, hover `rgb(201, 209, 216)`, profit + `rgb(60, 193, 149)`, profit - `rgb(249, 76, 76)`.
- [ ] Dark theme: tło główne `rgb(42, 56, 71)`, tekst `rgb(198, 210, 219)`, tło wiersza `rgba(14, 15, 26, .25)`, hover `rgba(53, 71, 89, .5)`, profit + `rgb(60, 193, 149)`, profit - `rgb(249, 76, 76)`.
- [ ] Aplikacja rozpoznaje motyw systemu (`system`) i pozwala ręcznie przełączyć `light/dark`.
- [ ] Działanie sprawdzone na najnowszych przeglądarkach: Chrome, Opera, Safari.

### Szybka weryfikacja ręczna
1. Uruchom aplikację: `npm run start -- --host 127.0.0.1 --port 4311`.
2. Otwórz [http://127.0.0.1:4311/](http://127.0.0.1:4311/).
3. Rozwiń grupy i sprawdź format daty oraz wartości agregowane.
4. Usuń pojedynczy wiersz i całą grupę, potwierdź treść snackbara.
5. Zmień motyw na `light`, `dark`, `system` i zweryfikuj kolory.
6. Uruchom testy: `npm test -- --watch=false`.

## Kompatybilność
Implementacja jest przygotowana pod najnowsze wersje:
- Chrome
- Opera
- Safari

## Najczęstsze problemy
`ERR_CONNECTION_REFUSED`:
1. sprawdź, czy serwer działa (`npm run start`),
2. uruchom na innym porcie (`--port 4333`),
3. zrób hard refresh (`Cmd/Ctrl + Shift + R`).

Brak odświeżenia danych:
1. sprawdź tab Network i WebSocket w DevTools,
2. upewnij się, że nie jest uruchomiona stara instancja aplikacji na innym porcie.

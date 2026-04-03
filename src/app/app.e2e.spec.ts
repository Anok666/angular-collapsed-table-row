import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { mockOrdersResponse } from './testing/mock-orders-response';
import { flushMicrotasks, MockWebSocket } from './testing/mock-websocket';

describe('App E2E-style flows', () => {
  let httpMock: HttpTestingController;
  let originalWebSocket: typeof WebSocket | undefined;

  beforeEach(async () => {
    MockWebSocket.instances = [];
    originalWebSocket = (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;
    (globalThis as { WebSocket?: typeof WebSocket }).WebSocket = MockWebSocket as unknown as typeof WebSocket;

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    if (originalWebSocket) {
      (globalThis as { WebSocket?: typeof WebSocket }).WebSocket = originalWebSocket;
    }
    httpMock.verify();
  });

  async function renderApp() {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges(false);

    const request = httpMock.expectOne('https://geeksoft.pl/assets/order-data.json');
    request.flush(mockOrdersResponse);

    await flushMicrotasks();
    fixture.detectChanges(false);

    return fixture;
  }

  it('renders grouped rows right after data load', async () => {
    const fixture = await renderApp();
    const root = fixture.nativeElement as HTMLElement;

    const groupRows = root.querySelectorAll('tr.group-row');
    expect(groupRows.length).toBe(3);
    expect(root.querySelector('.table-wrapper')).toBeTruthy();
  });

  it('expands group rows on click and shows detail rows', async () => {
    const fixture = await renderApp();
    const root = fixture.nativeElement as HTMLElement;
    const firstGroupRow = root.querySelector('tr.group-row') as HTMLTableRowElement;

    firstGroupRow.click();
    fixture.detectChanges(false);

    const detailRows = root.querySelectorAll('tr.detail-row');
    expect(detailRows.length).toBe(3);
    expect(detailRows[0]?.textContent).toContain('BTCUSD');
  });

  it('shows snackbar message after removing an order from table UI', async () => {
    const fixture = await renderApp();
    const root = fixture.nativeElement as HTMLElement;

    const firstGroupRow = root.querySelector('tr.group-row') as HTMLTableRowElement;
    firstGroupRow.click();
    fixture.detectChanges(false);

    const removeOrderButton = root.querySelector('tr.detail-row .delete-btn') as HTMLButtonElement;
    removeOrderButton.click();
    fixture.detectChanges(false);

    const snackbar = root.querySelector('.snackbar');
    expect(snackbar?.textContent).toContain('Zamknięto zlecenie nr');
  });

  it('updates profit cells after receiving websocket quotes', async () => {
    const fixture = await renderApp();
    const root = fixture.nativeElement as HTMLElement;
    const socket = MockWebSocket.instances[0];

    const groupRowsBefore = root.querySelectorAll('tr.group-row');
    const ethGroupProfitCellBefore = groupRowsBefore[1]?.querySelector('td:nth-child(4)') as HTMLElement;
    expect(ethGroupProfitCellBefore.classList.contains('profit-positive')).toBe(false);
    expect(ethGroupProfitCellBefore.classList.contains('profit-negative')).toBe(false);

    socket.emitMessage({
      p: '/quotes/subscribed',
      d: [
        { s: 'BTCUSD', b: 100000, a: 100100, t: 1770283819 },
        { s: 'ETHUSD', b: 2000, a: 2005, t: 1770283819 },
        { s: 'AUDCHF', b: 0.5, a: 0.52, t: 1770283819 }
      ]
    });

    await flushMicrotasks();
    fixture.detectChanges(false);

    const groupRowsAfter = root.querySelectorAll('tr.group-row');
    const ethGroupProfitCellAfter = groupRowsAfter[1]?.querySelector('td:nth-child(4)') as HTMLElement;
    expect(ethGroupProfitCellAfter.classList.contains('profit-positive')).toBe(true);
  });
});

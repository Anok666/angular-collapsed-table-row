import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { vi } from 'vitest';
import { OrdersPageComponent } from './orders-page.component';
import { mockOrdersResponse } from '../testing/mock-orders-response';
import { flushMicrotasks, MockWebSocket } from '../testing/mock-websocket';

describe('OrdersPageComponent', () => {
  let httpMock: HttpTestingController;
  let originalWebSocket: typeof WebSocket | undefined;

  beforeEach(async () => {
    const storage = window.localStorage as { removeItem?: (key: string) => void };
    if (typeof storage.removeItem === 'function') {
      storage.removeItem('orders-theme-preference');
    }
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';

    MockWebSocket.instances = [];
    originalWebSocket = (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;
    (globalThis as { WebSocket?: typeof WebSocket }).WebSocket = MockWebSocket as unknown as typeof WebSocket;

    await TestBed.configureTestingModule({
      imports: [OrdersPageComponent],
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

  async function createAndFlushComponent() {
    const fixture = TestBed.createComponent(OrdersPageComponent);
    fixture.detectChanges(false);

    const req = httpMock.expectOne('https://geeksoft.pl/assets/order-data.json');
    expect(req.request.method).toBe('GET');
    req.flush(mockOrdersResponse);
    await flushMicrotasks();

    return fixture;
  }

  it('should group orders by symbol after HTTP response', async () => {
    const fixture = await createAndFlushComponent();
    const { ordersService } = fixture.componentInstance as any;

    expect(ordersService.groups().length).toBe(3);
    expect(ordersService.groups()[0].symbol).toBe('BTCUSD');
    expect(ordersService.groups()[0].count).toBe(3);
    expect(ordersService.groups()[1].symbol).toBe('ETHUSD');
    expect(ordersService.groups()[1].count).toBe(2);
    expect(ordersService.groups()[2].symbol).toBe('AUDCHF');
    expect(ordersService.groups()[2].count).toBe(1);
  });

  it('should subscribe websocket for all loaded symbols', async () => {
    await createAndFlushComponent();
    const socket = MockWebSocket.instances[0];

    expect(socket).toBeTruthy();

    const subscribeMessage = socket.sentMessages
      .map((message) => JSON.parse(message))
      .find((message) => message.p === '/subscribe/addlist');

    expect(subscribeMessage).toBeTruthy();
    expect(subscribeMessage.d.sort()).toEqual(['AUDCHF', 'BTCUSD', 'ETHUSD']);
  });

  it('should calculate profit using quote bid values', async () => {
    const fixture = await createAndFlushComponent();
    const { ordersService } = fixture.componentInstance as any;
    const socket = MockWebSocket.instances[0];

    socket.emitMessage({
      p: '/quotes/subscribed',
      d: [
        { s: 'BTCUSD', b: 100000, a: 100100, t: 1770283819 },
        { s: 'ETHUSD', b: 2000, a: 2005, t: 1770283819 },
        { s: 'AUDCHF', b: 0.5, a: 0.52, t: 1770283819 }
      ]
    });

    const btcGroup = ordersService.groups().find((g: any) => g.symbol === 'BTCUSD');
    const ethGroup = ordersService.groups().find((g: any) => g.symbol === 'ETHUSD');

    const btcBuyOrder = btcGroup.orders.find((o: any) => o.id === 1203384);
    const btcSellOrder = btcGroup.orders.find((o: any) => o.id === 1226230);
    const ethBuyOrder = ethGroup.orders.find((o: any) => o.id === 1226254);

    expect(btcBuyOrder.profit).toBeCloseTo(4837.47, 2);
    expect(btcSellOrder.profit).toBeCloseTo(18463.98, 2);
    expect(ethBuyOrder.profit).toBeCloseTo(1321.9, 2);
  });

  it('should show close message for removed order and group', async () => {
    const snackBar = TestBed.inject(MatSnackBar);
    const openSpy = vi.spyOn(snackBar, 'open');
    const fixture = await createAndFlushComponent();
    const { ordersService } = fixture.componentInstance as any;

    ordersService.removeOrder('BTCUSD', 1203384);
    expect(openSpy).toHaveBeenCalledWith('Zamknięto zlecenie nr 1203384', 'Zamknij', expect.any(Object));

    ordersService.removeGroup('ETHUSD');
    expect(openSpy).toHaveBeenCalledWith(
      'Zamknięto zlecenie nr 1226254, 1226256',
      'Zamknij',
      expect.any(Object)
    );
  });

  it('should toggle dark/light and support system mode', async () => {
    const fixture = await createAndFlushComponent();
    const { themeService } = fixture.componentInstance as any;

    themeService.setThemePreference('light');
    expect(themeService.themePreference()).toBe('light');
    expect(themeService.themeMode()).toBe('light');

    themeService.toggleLightDark();
    TestBed.tick();
    expect(themeService.themePreference()).toBe('dark');
    expect(themeService.themeMode()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    themeService.setThemePreference('system');
    expect(themeService.themePreference()).toBe('system');
    expect(['light', 'dark']).toContain(themeService.themeMode());
  });
});

import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { ResolvedThemeMode, ThemePreference } from '../orders/orders.types';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  private readonly themeStorageKey = 'orders-theme-preference';
  private mediaQueryList: MediaQueryList | null = null;
  private mediaQueryListener: (() => void) | null = null;

  readonly themePreference = signal<ThemePreference>(this.readStoredThemePreference());
  private readonly systemPrefersDark = signal(this.readSystemPrefersDark());

  readonly themeMode = computed<ResolvedThemeMode>(() => {
    const pref = this.themePreference();
    return pref === 'system' ? (this.systemPrefersDark() ? 'dark' : 'light') : pref;
  });

  private readonly syncDocumentTheme = effect(() => {
    if (!isPlatformBrowser(this.platformId)) return;
    const mode = this.themeMode();
    this.document.documentElement.setAttribute('data-theme', mode);
    this.document.documentElement.style.colorScheme = mode;
  });

  constructor() {
    this.initSystemThemeListener();
    this.destroyRef.onDestroy(() => this.detachSystemThemeListener());
  }

  toggleLightDark(): void {
    this.setThemePreference(this.themeMode() === 'dark' ? 'light' : 'dark');
  }

  setThemePreference(mode: ThemePreference): void {
    this.themePreference.set(mode);
    this.getLocalStorage()?.setItem(this.themeStorageKey, mode);
  }

  private isThemePreference(value: string | null | undefined): value is ThemePreference {
    return value === 'light' || value === 'dark' || value === 'system';
  }

  private readStoredThemePreference(): ThemePreference {
    if (!isPlatformBrowser(this.platformId)) return 'system';
    const stored = this.getLocalStorage()?.getItem(this.themeStorageKey);
    return this.isThemePreference(stored) ? stored : 'system';
  }

  private readSystemPrefersDark(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    const win = this.document.defaultView;
    if (!win || typeof win.matchMedia !== 'function') return false;
    return win.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private initSystemThemeListener(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const win = this.document.defaultView;
    if (!win || typeof win.matchMedia !== 'function') return;

    this.mediaQueryList = win.matchMedia('(prefers-color-scheme: dark)');
    this.mediaQueryListener = () => {
      this.systemPrefersDark.set(
        win.matchMedia('(prefers-color-scheme: dark)').matches
      );
    };
    this.mediaQueryList.addEventListener('change', this.mediaQueryListener);
  }

  private detachSystemThemeListener(): void {
    if (!this.mediaQueryList || !this.mediaQueryListener) return;
    this.mediaQueryList.removeEventListener('change', this.mediaQueryListener);
    this.mediaQueryList = null;
    this.mediaQueryListener = null;
  }

  private getLocalStorage(): Storage | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const storage = this.document.defaultView?.localStorage;
      if (!storage || typeof storage.getItem !== 'function') return null;
      return storage;
    } catch {
      return null;
    }
  }
}

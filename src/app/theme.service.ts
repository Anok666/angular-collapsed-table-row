import { Injectable, computed, effect, signal } from '@angular/core';
import { BrowserStorage, ResolvedThemeMode, ThemePreference } from './orders.types';
import { isThemePreference } from './app.helpers';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly themeStorageKey = 'orders-theme-preference';
  private mediaQueryList: MediaQueryList | null = null;
  private mediaQueryListener: ((event: MediaQueryListEvent) => void) | null = null;

  readonly themePreference = signal<ThemePreference>(this.readStoredThemePreference());
  private readonly systemPrefersDark = signal(this.readSystemPrefersDark());

  readonly themeMode = computed<ResolvedThemeMode>(() => {
    const pref = this.themePreference();
    if (pref === 'system') {
      return this.systemPrefersDark() ? 'dark' : 'light';
    }
    return pref;
  });

  private readonly syncDocumentTheme = effect(() => {
    const mode = this.themeMode();
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.style.colorScheme = mode;
  });

  init(): void {
    this.initSystemThemeListener();
  }

  destroy(): void {
    this.detachSystemThemeListener();
  }

  toggleLightDark(): void {
    const next: ThemePreference = this.themeMode() === 'dark' ? 'light' : 'dark';
    this.setThemePreference(next);
  }

  setThemePreference(mode: ThemePreference): void {
    this.themePreference.set(mode);
    this.getBrowserStorage()?.setItem(this.themeStorageKey, mode);
  }

  private readStoredThemePreference(): ThemePreference {
    // Guard for non-browser environments (SSR/tests/prerender).
    if (typeof window === 'undefined') {
      return 'system';
    }

    const storedTheme = this.getBrowserStorage()?.getItem(this.themeStorageKey);
    if (isThemePreference(storedTheme)) {
      return storedTheme;
    }

    return 'system';
  }

  private readSystemPrefersDark(): boolean {
    // Guard for non-browser environments (SSR/tests/prerender).
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private initSystemThemeListener(): void {
    // Guard for non-browser environments (SSR/tests/prerender).
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    this.mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaQueryListener = () => {
      this.systemPrefersDark.set(window.matchMedia('(prefers-color-scheme: dark)').matches);
    };

    if (typeof this.mediaQueryList.addEventListener === 'function') {
      this.mediaQueryList.addEventListener('change', this.mediaQueryListener);
      return;
    }

    const legacyMediaQueryList = this.mediaQueryList as MediaQueryList & {
      addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
    };
    legacyMediaQueryList.addListener?.(this.mediaQueryListener);
  }

  private detachSystemThemeListener(): void {
    if (!this.mediaQueryList || !this.mediaQueryListener) {
      return;
    }

    if (typeof this.mediaQueryList.removeEventListener === 'function') {
      this.mediaQueryList.removeEventListener('change', this.mediaQueryListener);
      return;
    }

    const legacyMediaQueryList = this.mediaQueryList as MediaQueryList & {
      removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
    };
    legacyMediaQueryList.removeListener?.(this.mediaQueryListener);
  }

  private getBrowserStorage(): BrowserStorage | null {
    // Guard for non-browser environments (SSR/tests/prerender).
    if (typeof window === 'undefined') {
      return null;
    }

    let storage: Partial<BrowserStorage> | undefined;
    try {
      storage = (window as Window & { localStorage?: unknown }).localStorage as
        | Partial<BrowserStorage>
        | undefined;
    } catch {
      return null;
    }

    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
      return null;
    }

    return storage as BrowserStorage;
  }
}

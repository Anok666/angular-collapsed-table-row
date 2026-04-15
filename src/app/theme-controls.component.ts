import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ResolvedThemeMode, ThemePreference } from './orders.types';

@Component({
  selector: 'app-theme-controls',
  templateUrl: './theme-controls.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThemeControlsComponent {
  @Input({ required: true }) themeMode: ResolvedThemeMode = 'light';
  @Input({ required: true }) themePreference: ThemePreference = 'system';

  @Output() readonly toggleTheme = new EventEmitter<void>();
  @Output() readonly preferenceChange = new EventEmitter<ThemePreference>();

  onPreferenceChange(event: Event): void {
    const mode = (event.target as HTMLSelectElement | null)?.value;
    if (mode === 'light' || mode === 'dark' || mode === 'system') {
      this.preferenceChange.emit(mode);
    }
  }
}

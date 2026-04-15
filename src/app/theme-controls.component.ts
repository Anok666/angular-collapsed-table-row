import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ResolvedThemeMode, ThemePreference } from './orders.types';

@Component({
  selector: 'app-theme-controls',
  imports: [MatButtonModule, MatButtonToggleModule, MatIconModule, MatTooltipModule],
  templateUrl: './theme-controls.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThemeControlsComponent {
  @Input({ required: true }) themeMode: ResolvedThemeMode = 'light';
  @Input({ required: true }) themePreference: ThemePreference = 'system';

  @Output() readonly toggleTheme = new EventEmitter<void>();
  @Output() readonly preferenceChange = new EventEmitter<ThemePreference>();

  onToggleChange(value: ThemePreference): void {
    this.preferenceChange.emit(value);
  }
}

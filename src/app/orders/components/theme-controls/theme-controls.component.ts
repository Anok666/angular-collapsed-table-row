import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ThemePreference } from '../../orders.types';

@Component({
  selector: 'app-theme-controls',
  imports: [MatButtonToggleModule, MatIconModule, MatTooltipModule],
  templateUrl: './theme-controls.component.html',
  styleUrl: './theme-controls.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThemeControlsComponent {
  readonly themePreference = input.required<ThemePreference>();
  readonly preferenceChange = output<ThemePreference>();

  onToggleChange(value: ThemePreference): void {
    this.preferenceChange.emit(value);
  }
}

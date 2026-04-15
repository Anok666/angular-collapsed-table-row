import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SymbolGroup, TableSummary } from '../../orders.types';

@Component({
  selector: 'app-orders-table',
  imports: [DatePipe, DecimalPipe, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './orders-table.component.html',
  styleUrl: './orders-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrdersTableComponent {
  readonly groups = input.required<SymbolGroup[]>();
  readonly summary = input.required<TableSummary>();

  readonly toggleGroup = output<string>();
  readonly removeGroup = output<string>();
  readonly removeOrder = output<{ symbol: string; orderId: number }>();
}

import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SymbolGroup } from './orders.types';
import { TableSummary } from './orders.utils';

@Component({
  selector: 'app-orders-table',
  imports: [DatePipe, DecimalPipe, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './orders-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrdersTableComponent {
  @Input({ required: true }) groups: SymbolGroup[] = [];
  @Input({ required: true }) summary!: TableSummary;

  @Output() readonly toggleGroup = new EventEmitter<string>();
  @Output() readonly removeGroup = new EventEmitter<string>();
  @Output() readonly removeOrder = new EventEmitter<{ symbol: string; orderId: number }>();
}

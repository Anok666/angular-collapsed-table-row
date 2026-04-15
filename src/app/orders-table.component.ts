import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { SymbolGroup } from './orders.types';
import { TableSummary } from './orders.utils';

@Component({
  selector: 'app-orders-table',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './orders-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrdersTableComponent {
  @Input({ required: true }) groups: SymbolGroup[] = [];
  @Input({ required: true }) summary!: TableSummary;

  @Output() readonly toggleGroup = new EventEmitter<string>();
  @Output() readonly removeGroup = new EventEmitter<{ symbol: string; event: Event }>();
  @Output() readonly removeOrder = new EventEmitter<{ symbol: string; orderId: number }>();
}

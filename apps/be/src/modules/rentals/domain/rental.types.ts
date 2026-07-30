import { Money } from '../../../libs/ddd/money.value-object';
import { RentalItemEntity } from './rental-item.entity';
import { RentalPeriod } from './rental-period.value-object';

export type RentalStatus = 'booked' | 'out' | 'returned' | 'cancelled';

export interface RentalProps {
  customerName: string;
  customerPhone: string;
  period: RentalPeriod;
  status: RentalStatus;
  notes: string | null;
  items: RentalItemEntity[];
}

export interface CreateRentalProps {
  customerName: string;
  customerPhone: string;
  period: RentalPeriod;
  notes: string | null;
  /** Item ids come from the application layer, like the aggregate id. */
  items: { id: string; dressId: string; price: Money }[];
}

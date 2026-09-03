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
  /**
   * FR-RENT-11: what the shop takes OFF the rental fee for this customer, in VND. Rental-level
   * (not per item) and never above the sum of the item prices. Zero = no discount.
   */
  discount: Money;
  items: RentalItemEntity[];
}

export interface CreateRentalProps {
  customerName: string;
  customerPhone: string;
  period: RentalPeriod;
  notes: string | null;
  discount: Money;
  /** Item ids come from the application layer, like the aggregate id. */
  items: { id: string; dressId: string; price: Money }[];
}

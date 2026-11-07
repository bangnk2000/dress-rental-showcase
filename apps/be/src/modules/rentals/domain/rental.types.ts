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
  /**
   * rentals/cancel-with-refund: why the rental was cancelled — mandatory when money was kept, and
   * stored on the RENTAL so it survives a cancel that writes no refund row (everything kept).
   * Absent/null on every rental that was never cancelled with a reason.
   */
  cancelReason?: string | null;
}

export interface UpdateRentalItemProps {
  /** A kept dress carries its CURRENT item id; an added dress a fresh one (application layer decides). */
  id: string;
  dressId: string;
  price: Money;
}

/**
 * FR-RENT-13: what the owner may rewrite on an open rental. `undefined` = keep as is. Status is
 * deliberately absent — pickup/return/cancel own it.
 */
export interface UpdateRentalProps {
  customerName?: string;
  customerPhone?: string;
  period?: RentalPeriod;
  /** `null` clears the notes. */
  notes?: string | null;
  discount?: Money;
  /** The FULL new item list — items whose id is not in it are dropped. */
  items?: UpdateRentalItemProps[];
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

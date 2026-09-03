import { z } from 'zod';
import { toDate } from '../../../libs/utils/date';
import { DressSnapshot } from '../application/ports/dress-lookup.port';
import { fromDateRangeLiteral } from '../database/daterange';
import {
  RentalListItemDto,
} from './list-rentals/list-rentals.response.dto';

/** One page row of the rentals list (the rentals table only — items ride separately). */
export const rentalListRowSchema = z.object({
  id: z.string(),
  customer_name: z.string(),
  customer_phone: z.string(),
  status: z.enum(['booked', 'out', 'returned', 'cancelled']),
  period: z.string(),
  notes: z.string().nullable(),
  discount_amount: z.number().int(),
  created_at: z.union([z.number(), z.string(), z.date()]),
});

export const rentalListItemRowSchema = z.object({
  rental_id: z.string(),
  dress_id: z.string(),
  price: z.number().int(),
});

export type RentalListRow = z.infer<typeof rentalListRowSchema>;
export type RentalListItemRow = z.infer<typeof rentalListItemRowSchema>;

/**
 * Joins the page's rentals with their item rows and dress snapshots.
 * Rental order (the SQL's ORDER BY) is preserved; dresses sort by code.
 */
export function toRentalListItemDtos(
  rentals: readonly RentalListRow[],
  items: readonly RentalListItemRow[],
  dresses: readonly DressSnapshot[],
): RentalListItemDto[] {
  const dressById = new Map(dresses.map((dress) => [dress.id, dress]));
  const itemsByRental = new Map<string, RentalListItemRow[]>();
  for (const item of items) {
    const bucket = itemsByRental.get(item.rental_id) ?? [];
    bucket.push(item);
    itemsByRental.set(item.rental_id, bucket);
  }

  return rentals.map((rental) => {
    const period = fromDateRangeLiteral(rental.period);
    const rentalDresses = (itemsByRental.get(rental.id) ?? []).map((item) => {
      const dress = dressById.get(item.dress_id);
      if (!dress) {
        // rental_items.dress_id is a FK — a miss means the lookup was fed wrong ids.
        throw new Error(`Dress ${item.dress_id} missing from lookup`);
      }
      return {
        dressId: dress.id,
        code: dress.code,
        name: dress.name,
        depositAmount: dress.depositAmount,
        // The agreed price lives on the ITEM row, not on the dress: the catalog price may have
        // moved since this rental was booked.
        agreedPrice: item.price,
      };
    });
    rentalDresses.sort((a, b) => a.code.localeCompare(b.code));

    return Object.assign(new RentalListItemDto(), {
      rentalId: rental.id,
      customerName: rental.customer_name,
      customerPhone: rental.customer_phone,
      status: rental.status,
      startDate: period.start,
      endDate: period.endInclusive,
      notes: rental.notes,
      discountAmount: rental.discount_amount,
      createdAt: toDate(rental.created_at).toISOString(),
      dresses: rentalDresses,
    });
  });
}

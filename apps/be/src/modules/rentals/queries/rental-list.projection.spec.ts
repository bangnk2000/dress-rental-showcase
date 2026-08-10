import { DressSnapshot } from '../application/ports/dress-lookup.port';
import {
  RentalListRow,
  toRentalListItemDtos,
} from './rental-list.projection';

const DRESS_A = '00000000-0000-4000-8000-00000000000a';
const DRESS_B = '00000000-0000-4000-8000-00000000000b';
const RENTAL_1 = '00000000-0000-4000-8000-000000000101';
const RENTAL_2 = '00000000-0000-4000-8000-000000000102';

const dresses: DressSnapshot[] = [
  {
    id: DRESS_A,
    code: 'VD-002',
    name: 'Đầm dạ hội đỏ',
    retired: false,
    rentalPrice: 1_200_000,
    depositAmount: 2_000_000,
  },
  {
    id: DRESS_B,
    code: 'VD-001',
    name: 'Váy cưới ren trắng',
    retired: false,
    rentalPrice: 1_500_000,
    depositAmount: 3_000_000,
  },
];

function makeRow(overrides: Partial<RentalListRow>): RentalListRow {
  return {
    id: RENTAL_1,
    customer_name: 'Nguyễn Thị Hoa',
    customer_phone: '0903123456',
    status: 'booked',
    period: '[2026-08-01,2026-08-04)',
    notes: null,
    created_at: '2026-07-30T09:00:00.000Z',
    ...overrides,
  };
}

test('joins items + dress snapshots per rental, dresses sorted by code', () => {
  const items = toRentalListItemDtos(
    [
      makeRow({}),
      makeRow({ id: RENTAL_2, customer_name: 'Trần Văn B', status: 'returned' }),
    ],
    [
      { rental_id: RENTAL_1, dress_id: DRESS_A, price: 1_200_000 },
      // Agreed BELOW the catalog's 1.500.000 — the list must show what was agreed, not the price
      // the catalog carries today.
      { rental_id: RENTAL_1, dress_id: DRESS_B, price: 1_400_000 },
      { rental_id: RENTAL_2, dress_id: DRESS_B, price: 1_500_000 },
    ],
    dresses,
  );

  expect(items.map((item) => item.rentalId)).toEqual([RENTAL_1, RENTAL_2]);
  expect(items[0]).toMatchObject({
    customerName: 'Nguyễn Thị Hoa',
    startDate: '2026-08-01',
    endDate: '2026-08-03', // half-open [..,08-04) → inclusive last day
    createdAt: '2026-07-30T09:00:00.000Z',
  });
  expect(items[0]!.dresses.map((dress) => dress.code)).toEqual(['VD-001', 'VD-002']);
  // The agreed price rides from the ITEM row, so VD-001 shows 1.400.000 here and 1.500.000 in
  // the other rental — the same dress, two agreements.
  expect(items[0]!.dresses.map((dress) => dress.agreedPrice)).toEqual([1_400_000, 1_200_000]);
  expect(items[1]!.dresses.map((dress) => dress.agreedPrice)).toEqual([1_500_000]);
  expect(items[1]!.dresses.map((dress) => dress.code)).toEqual(['VD-001']);
  expect(items[1]!.status).toBe('returned');
});

test('a rental with no matching item rows yields an empty dress list, not a crash', () => {
  const items = toRentalListItemDtos([makeRow({})], [], dresses);

  expect(items).toHaveLength(1);
  expect(items[0]!.dresses).toEqual([]);
});

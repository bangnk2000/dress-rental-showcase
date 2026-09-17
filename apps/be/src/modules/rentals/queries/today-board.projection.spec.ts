import { DressSnapshot } from '../application/ports/dress-lookup.port';
import { TodayBoardRow, toTodayBoardDto } from './today-board.projection';

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

function makeRow(overrides: Partial<TodayBoardRow>): TodayBoardRow {
  return {
    rental_id: RENTAL_1,
    customer_name: 'Nguyễn Thị Hoa',
    customer_phone: '0903123456',
    status: 'booked',
    period: '[2026-08-01,2026-08-04)',
    dress_id: DRESS_A,
    price: 1_200_000,
    due_out: true,
    due_back: false,
    overdue: false,
    ...overrides,
  };
}

test('groups item rows into one entry per rental, dresses sorted by code', () => {
  const board = toTodayBoardDto(
    '2026-08-01',
    [
      makeRow({ dress_id: DRESS_A }),
      makeRow({ dress_id: DRESS_B, price: 1_400_000 }),
    ],
    dresses,
  );

  expect(board.date).toBe('2026-08-01');
  expect(board.dueBack).toEqual([]);
  expect(board.dueOut).toHaveLength(1);
  expect(board.dueOut[0]).toMatchObject({
    rentalId: RENTAL_1,
    customerName: 'Nguyễn Thị Hoa',
    startDate: '2026-08-01',
    endDate: '2026-08-03', // half-open [.. ,08-04) → inclusive last day 08-03
  });
  expect(board.dueOut[0]!.dresses.map((dress) => dress.code)).toEqual(['VD-001', 'VD-002']);
  // The STANDARD deposit rides along per dress: the return dialog sums it to suggest a refund,
  // and no other read gives the board that number.
  expect(board.dueOut[0]!.dresses.map((dress) => dress.depositAmount)).toEqual([
    3_000_000, 2_000_000,
  ]);
  // The agreed price comes from the ITEM row (1.400.000 for VD-001 here), not from the dress
  // snapshot's catalog price (1.500.000).
  expect(board.dueOut[0]!.dresses.map((dress) => dress.agreedPrice)).toEqual([
    1_400_000, 1_200_000,
  ]);
});

test('splits rentals over the two lists by the SQL membership flags', () => {
  const board = toTodayBoardDto(
    '2026-08-03',
    [
      makeRow({ rental_id: RENTAL_1, due_out: false, due_back: true }),
      makeRow({
        rental_id: RENTAL_2,
        customer_name: 'Trần Văn B',
        period: '[2026-08-03,2026-08-06)',
        due_out: true,
        due_back: false,
      }),
    ],
    dresses,
  );

  expect(board.dueOut.map((rental) => rental.rentalId)).toEqual([RENTAL_2]);
  expect(board.dueBack.map((rental) => rental.rentalId)).toEqual([RENTAL_1]);
});

test('an overdue rental lands on the overdue list only', () => {
  const board = toTodayBoardDto(
    '2026-08-10',
    [
      makeRow({
        status: 'out',
        due_out: false,
        due_back: false,
        overdue: true,
      }),
    ],
    dresses,
  );

  expect(board.dueOut).toEqual([]);
  expect(board.dueBack).toEqual([]);
  expect(board.overdue).toHaveLength(1);
  expect(board.overdue[0]).toMatchObject({ rentalId: RENTAL_1, status: 'out' });
});

test('a single-day rental appears on BOTH lists (hand out and take back)', () => {
  const board = toTodayBoardDto(
    '2026-08-01',
    [makeRow({ period: '[2026-08-01,2026-08-02)', due_out: true, due_back: true })],
    dresses,
  );

  expect(board.dueOut).toHaveLength(1);
  expect(board.dueBack).toHaveLength(1);
  expect(board.dueOut[0]!.rentalId).toBe(board.dueBack[0]!.rentalId);
  expect(board.dueOut[0]!.startDate).toBe('2026-08-01');
  expect(board.dueOut[0]!.endDate).toBe('2026-08-01');
});

test('a rental already handed out stays on due-out, after the ones still to hand out', () => {
  const board = toTodayBoardDto(
    '2026-08-01',
    [
      // handed out first thing in the morning — created earlier, so SQL order puts it first
      makeRow({ rental_id: RENTAL_1, status: 'out', due_out: true }),
      makeRow({
        rental_id: RENTAL_2,
        customer_name: 'Trần Văn B',
        status: 'booked',
        due_out: true,
      }),
    ],
    dresses,
  );

  // pending hand-outs first: that is what the morning glance is for
  expect(board.dueOut.map((rental) => [rental.rentalId, rental.status])).toEqual([
    [RENTAL_2, 'booked'],
    [RENTAL_1, 'out'],
  ]);
  expect(board.dueBack).toEqual([]);
  expect(board.overdue).toEqual([]);
});

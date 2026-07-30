import { DressSnapshot } from '../application/ports/dress-lookup.port';
import { TodayBoardRow, toTodayBoardDto } from './today-board.projection';

const DRESS_A = '00000000-0000-4000-8000-00000000000a';
const DRESS_B = '00000000-0000-4000-8000-00000000000b';
const RENTAL_1 = '00000000-0000-4000-8000-000000000101';
const RENTAL_2 = '00000000-0000-4000-8000-000000000102';

const dresses: DressSnapshot[] = [
  { id: DRESS_A, code: 'VD-002', name: 'Đầm dạ hội đỏ', retired: false, rentalPrice: 1_200_000 },
  { id: DRESS_B, code: 'VD-001', name: 'Váy cưới ren trắng', retired: false, rentalPrice: 1_500_000 },
];

function makeRow(overrides: Partial<TodayBoardRow>): TodayBoardRow {
  return {
    rental_id: RENTAL_1,
    customer_name: 'Nguyễn Thị Hoa',
    customer_phone: '0903123456',
    status: 'booked',
    period: '[2026-08-01,2026-08-04)',
    dress_id: DRESS_A,
    due_out: true,
    due_back: false,
    ...overrides,
  };
}

test('groups item rows into one entry per rental, dresses sorted by code', () => {
  const board = toTodayBoardDto(
    '2026-08-01',
    [makeRow({ dress_id: DRESS_A }), makeRow({ dress_id: DRESS_B })],
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

/**
 * MSW handlers for the rentals tag. Tests mark dresses as unavailable through
 * seedBlockedDresses; the handler then answers with the same outcome body the real API renders —
 * `{ status: 'rejected_dress_unavailable', dressIds }` at 422 (ADR 0001) — otherwise 201 with an
 * IdResponse. Rejections of pickup/return/cancel are seeded per test via server.use overrides.
 */
import { http, HttpResponse, type HttpHandler } from 'msw';

import type {
  AvailabilityResponseDto,
  BookedRangeDto,
  BookedRangeListResponseDto,
  CreateRentalRequestDto,
  IdResponse,
  LateFeeQuoteResponseDto,
  PaymentDto,
  PaymentListResponseDto,
  RentalListItemDto,
  RentalListResponseDto,
  ReturnRentalRequestDto,
  TodayBoardRentalDto,
  TodayBoardResponseDto,
} from '@/api/generated/model';
import {
  BookedRangeDtoStatus,
  RentalListItemDtoStatus,
  TodayBoardRentalDtoStatus,
} from '@/api/generated/model';

/** Mirrors the dev CLEANING_BUFFER_DAYS=2 the real API applies. */
const CLEANING_BUFFER_DAYS = 2;

type TodayBoardLists = Pick<TodayBoardResponseDto, 'dueOut' | 'dueBack' | 'overdue'>;

const emptyBoard = (): TodayBoardLists => ({ dueOut: [], dueBack: [], overdue: [] });

let blockedDressIds = new Set<string>();
let lastCreateRentalBody: CreateRentalRequestDto | null = null;
let bookedRanges = new Map<string, BookedRangeDto[]>();
let todayBoard: TodayBoardLists = emptyBoard();
let lastTodayBoardDate: string | null = null;
let lastPickupRentalId: string | null = null;
let lastReturnRentalId: string | null = null;
let lastReturnBody: ReturnRentalRequestDto | null = null;
let rentalList: RentalListItemDto[] = [];
let rentalListCount: number | null = null;
let lastRentalListParams: Record<string, string> | null = null;
let lastCancelRentalId: string | null = null;
let rentalPayments = new Map<string, PaymentDto[]>();
let lateFeeQuotes = new Map<string, LateFeeQuoteResponseDto>();

/** Dresses that already have an overlapping booking — POST /rentals answers 409. */
export function seedBlockedDresses(dressIds: string[]): void {
  blockedDressIds = new Set(dressIds);
}

/** The body of the most recent POST /rentals — lets tests assert the mapping. */
export function getLastCreateRentalBody(): CreateRentalRequestDto | null {
  return lastCreateRentalBody;
}

export function makeBookedRange(overrides: Partial<BookedRangeDto> = {}): BookedRangeDto {
  return {
    rentalId: 'rental-1',
    startDate: '2099-08-01',
    endDate: '2099-08-03',
    blockedUntilDate: '2099-08-05',
    status: BookedRangeDtoStatus.booked,
    ...overrides,
  };
}

/** Blocking bookings served for GET booked-ranges and tested by GET availability. */
export function seedBookedRanges(dressId: string, ranges: BookedRangeDto[]): void {
  bookedRanges.set(dressId, [...ranges]);
}

export function makeTodayRental(
  overrides: Partial<TodayBoardRentalDto> = {},
): TodayBoardRentalDto {
  return {
    rentalId: 'rental-1',
    customerName: 'Nguyễn Thị Hoa',
    customerPhone: '0903123456',
    status: TodayBoardRentalDtoStatus.booked,
    startDate: '2099-08-01',
    endDate: '2099-08-03',
    dresses: [
      { dressId: 'd1', code: 'VD-001', name: 'Váy cưới ren trắng', depositAmount: 3_000_000 },
    ],
    ...overrides,
  };
}

/** The board served for GET today-board, whatever date is asked. */
export function seedTodayBoard(board: Partial<TodayBoardLists>): void {
  todayBoard = { ...emptyBoard(), ...board };
}

/** The late-fee suggestion the server would answer for a rental (FR-RENT-09). */
export function seedLateFeeQuote(
  rentalId: string,
  overrides: Partial<LateFeeQuoteResponseDto> = {},
): void {
  lateFeeQuotes.set(rentalId, {
    rentalId,
    dueDate: '2026-08-03',
    referenceDate: '2026-08-06',
    daysLate: 3,
    dressCount: 1,
    dailyRateAmount: 200_000,
    suggestedLateFee: 600_000,
    ...overrides,
  });
}

/** The date param of the most recent GET today-board — asserts the FE sends its own day. */
export function getLastTodayBoardDate(): string | null {
  return lastTodayBoardDate;
}

/** The rental id of the most recent POST pickup. */
export function getLastPickupRentalId(): string | null {
  return lastPickupRentalId;
}

/** The id + body of the most recent POST return — asserts the settlement mapping. */
export function getLastReturn(): { rentalId: string | null; body: ReturnRentalRequestDto | null } {
  return { rentalId: lastReturnRentalId, body: lastReturnBody };
}

export function makeRentalListItem(
  overrides: Partial<RentalListItemDto> = {},
): RentalListItemDto {
  return {
    rentalId: 'rental-1',
    customerName: 'Nguyễn Thị Hoa',
    customerPhone: '0903123456',
    status: RentalListItemDtoStatus.booked,
    startDate: '2099-08-01',
    endDate: '2099-08-03',
    notes: null,
    createdAt: '2099-07-30T09:00:00.000Z',
    dresses: [
      { dressId: 'd1', code: 'VD-001', name: 'Váy cưới ren trắng', depositAmount: 3_000_000 },
    ],
    ...overrides,
  };
}

/** The page served for GET /rentals; count defaults to the seeded length. */
export function seedRentalList(items: RentalListItemDto[], count?: number): void {
  rentalList = [...items];
  rentalListCount = count ?? null;
}

/** The query params of the most recent GET /rentals — asserts filters/pagination. */
export function getLastRentalListParams(): Record<string, string> | null {
  return lastRentalListParams;
}

/** The rental id of the most recent POST cancel. */
export function getLastCancelRentalId(): string | null {
  return lastCancelRentalId;
}

export function makePayment(overrides: Partial<PaymentDto> = {}): PaymentDto {
  return {
    id: 'payment-1',
    kind: 'deposit_refund',
    amount: 2_800_000,
    note: null,
    createdAt: '2099-08-04T10:00:00.000Z',
    ...overrides,
  };
}

/** Movements served for GET /rentals/:id/payments. */
export function seedRentalPayments(rentalId: string, payments: PaymentDto[]): void {
  rentalPayments.set(rentalId, [...payments]);
}

/** Reset the in-memory rentals state — call from beforeEach. */
export function resetRentals(): void {
  blockedDressIds = new Set();
  lastCreateRentalBody = null;
  bookedRanges = new Map();
  todayBoard = emptyBoard();
  lastTodayBoardDate = null;
  lastPickupRentalId = null;
  lastReturnRentalId = null;
  lastReturnBody = null;
  lateFeeQuotes = new Map();
  rentalList = [];
  rentalListCount = null;
  lastRentalListParams = null;
  lastCancelRentalId = null;
  rentalPayments = new Map();
}

function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export const rentalsHandlers: HttpHandler[] = [
  // GET /api/v1/dresses/:dressId/booked-ranges — the seeded blocking bookings.
  http.get('/api/v1/dresses/:dressId/booked-ranges', ({ params }) => {
    const body: BookedRangeListResponseDto = {
      data: bookedRanges.get(params.dressId as string) ?? [],
    };
    return HttpResponse.json(body);
  }),

  // GET /api/v1/dresses/:dressId/availability — same buffer semantics as the
  // real API: the asked period is extended by the cleaning buffer before the
  // overlap test against the seeded blocked intervals.
  http.get('/api/v1/dresses/:dressId/availability', ({ params, request }) => {
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate') ?? '';
    const endDate = url.searchParams.get('endDate') ?? '';
    const blockedEnd = addDaysIso(endDate, CLEANING_BUFFER_DAYS);
    const conflicts = (bookedRanges.get(params.dressId as string) ?? []).filter(
      (range) => range.startDate <= blockedEnd && startDate <= range.blockedUntilDate,
    );
    const body: AvailabilityResponseDto = {
      dressId: params.dressId as string,
      startDate,
      endDate,
      available: conflicts.length === 0,
      conflicts,
    };
    return HttpResponse.json(body);
  }),

  // GET /api/v1/rentals/today-board — the seeded board, echoing the asked date.
  http.get('/api/v1/rentals/today-board', ({ request }) => {
    const url = new URL(request.url);
    lastTodayBoardDate = url.searchParams.get('date');
    const body: TodayBoardResponseDto = {
      date: lastTodayBoardDate ?? '2099-01-01',
      dueOut: todayBoard.dueOut,
      dueBack: todayBoard.dueBack,
      overdue: todayBoard.overdue,
    };
    return HttpResponse.json(body);
  }),

  // GET /api/v1/rentals — the seeded page, capturing the asked filters.
  http.get('/api/v1/rentals', ({ request }) => {
    const url = new URL(request.url);
    lastRentalListParams = Object.fromEntries(url.searchParams.entries());
    const page = Number(url.searchParams.get('page') ?? '1');
    const body: RentalListResponseDto = {
      data: rentalList,
      count: rentalListCount ?? rentalList.length,
      limit: 20,
      page,
    };
    return HttpResponse.json(body);
  }),

  // GET /api/v1/rentals/:id/late-fee — the server-owned suggestion the return dialog reads
  // (FR-RENT-09). Tests seed it with seedLateFeeQuote; default = returned on time.
  http.get('/api/v1/rentals/:id/late-fee', ({ params }) => {
    const rentalId = params.id as string;
    const seeded = lateFeeQuotes.get(rentalId);
    const body: LateFeeQuoteResponseDto = seeded ?? {
      rentalId,
      dueDate: '2026-08-03',
      referenceDate: '2026-08-03',
      daysLate: 0,
      dressCount: 1,
      dailyRateAmount: 200_000,
      suggestedLateFee: 0,
    };
    return HttpResponse.json(body);
  }),

  // GET /api/v1/rentals/:id/payments — the seeded movements (payments tag).
  http.get('/api/v1/rentals/:id/payments', ({ params }) => {
    const body: PaymentListResponseDto = {
      data: rentalPayments.get(params.id as string) ?? [],
    };
    return HttpResponse.json(body);
  }),

  // POST /api/v1/rentals/:id/cancel — 200 IdResponse, capturing the id.
  http.post('/api/v1/rentals/:id/cancel', ({ params }) => {
    lastCancelRentalId = params.id as string;
    const response: IdResponse = { id: params.id as string };
    return HttpResponse.json(response);
  }),

  // POST /api/v1/rentals/:id/pickup — 200 IdResponse, capturing the id.
  http.post('/api/v1/rentals/:id/pickup', ({ params }) => {
    lastPickupRentalId = params.id as string;
    const response: IdResponse = { id: params.id as string };
    return HttpResponse.json(response);
  }),

  // POST /api/v1/rentals/:id/return — 200 IdResponse, capturing id + settlement body.
  http.post('/api/v1/rentals/:id/return', async ({ params, request }) => {
    lastReturnRentalId = params.id as string;
    lastReturnBody = (await request.json()) as ReturnRentalRequestDto;
    const response: IdResponse = { id: params.id as string };
    return HttpResponse.json(response);
  }),

  // POST /api/v1/rentals — 201 IdResponse, or the rejected_dress_unavailable outcome naming the
  // offending dresses (ADR 0001 §3).
  http.post('/api/v1/rentals', async ({ request }) => {
    const body = (await request.json()) as CreateRentalRequestDto;
    lastCreateRentalBody = body;
    const blocked = body.items
      .map((item) => item.dressId)
      .filter((dressId) => blockedDressIds.has(dressId));
    if (blocked.length > 0) {
      return HttpResponse.json(
        { status: 'rejected_dress_unavailable', dressIds: blocked },
        { status: 422 },
      );
    }
    const response: IdResponse = { id: 'rental-1' };
    return HttpResponse.json(response, { status: 201 });
  }),
];

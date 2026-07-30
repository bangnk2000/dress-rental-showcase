/**
 * MSW handlers for the rentals tag. Tests mark dresses as unavailable through
 * seedBlockedDresses; the handler answers 409 like the real API (which has no
 * contract-typed error body), otherwise 201 with an IdResponse.
 */
import { http, HttpResponse, type HttpHandler } from 'msw';

import type {
  AvailabilityResponseDto,
  BookedRangeDto,
  BookedRangeListResponseDto,
  CreateRentalRequestDto,
  IdResponse,
} from '@/api/generated/model';
import { BookedRangeDtoStatus } from '@/api/generated/model';

/** Mirrors the dev CLEANING_BUFFER_DAYS=2 the real API applies. */
const CLEANING_BUFFER_DAYS = 2;

let blockedDressIds = new Set<string>();
let lastCreateRentalBody: CreateRentalRequestDto | null = null;
let bookedRanges = new Map<string, BookedRangeDto[]>();

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

/** Reset the in-memory rentals state — call from beforeEach. */
export function resetRentals(): void {
  blockedDressIds = new Set();
  lastCreateRentalBody = null;
  bookedRanges = new Map();
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

  // POST /api/v1/rentals — 201 IdResponse, or 409 when a dress is blocked.
  http.post('/api/v1/rentals', async ({ request }) => {
    const body = (await request.json()) as CreateRentalRequestDto;
    lastCreateRentalBody = body;
    if (body.items.some((item) => blockedDressIds.has(item.dressId))) {
      return new HttpResponse(null, { status: 409 });
    }
    const response: IdResponse = { id: 'rental-1' };
    return HttpResponse.json(response, { status: 201 });
  }),
];

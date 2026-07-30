/**
 * MSW handlers for the rentals tag. Tests mark dresses as unavailable through
 * seedBlockedDresses; the handler answers 409 like the real API (which has no
 * contract-typed error body), otherwise 201 with an IdResponse.
 */
import { http, HttpResponse, type HttpHandler } from 'msw';

import type { CreateRentalRequestDto, IdResponse } from '@/api/generated/model';

let blockedDressIds = new Set<string>();
let lastCreateRentalBody: CreateRentalRequestDto | null = null;

/** Dresses that already have an overlapping booking — POST /rentals answers 409. */
export function seedBlockedDresses(dressIds: string[]): void {
  blockedDressIds = new Set(dressIds);
}

/** The body of the most recent POST /rentals — lets tests assert the mapping. */
export function getLastCreateRentalBody(): CreateRentalRequestDto | null {
  return lastCreateRentalBody;
}

/** Reset the in-memory rentals state — call from beforeEach. */
export function resetRentals(): void {
  blockedDressIds = new Set();
  lastCreateRentalBody = null;
}

export const rentalsHandlers: HttpHandler[] = [
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

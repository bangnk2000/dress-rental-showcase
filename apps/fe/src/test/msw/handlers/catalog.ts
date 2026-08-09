/**
 * MSW handlers for the catalog tag — a stateful in-memory dress store so
 * tests control the data through seedDresses/resetCatalog.
 */
import { http, HttpResponse, type HttpHandler } from 'msw';

import type {
  CreateDressRequestDto,
  DressListResponseDto,
  DressResponseDto,
  IdResponse,
  UpdateDressRequestDto,
} from '@/api/generated/model';
import { DressResponseDtoStatus } from '@/api/generated/model';

const DEFAULT_LIMIT = 20;

let dresses: DressResponseDto[] = [];
let nextId = 1;

export function makeDress(overrides: Partial<DressResponseDto> = {}): DressResponseDto {
  const id = nextId++;
  return {
    id: `dress-${id}`,
    code: `DR-${String(id).padStart(3, '0')}`,
    name: `Váy ${id}`,
    sizeLabel: null,
    rentalPrice: 500_000,
    depositAmount: 1_000_000,
    status: DressResponseDtoStatus.active,
    notes: null,
    photoUrls: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Replace the in-memory catalog with the given dresses. */
export function seedDresses(seed: DressResponseDto[]): void {
  dresses = [...seed];
}

/** Empty the in-memory catalog — call from beforeEach. */
export function resetCatalog(): void {
  dresses = [];
  nextId = 1;
}

export const catalogHandlers: HttpHandler[] = [
  // PATCH /api/v1/dresses/:id — partial update; both rejections are outcome bodies (ADR 0001 §3).
  http.patch('/api/v1/dresses/:id', async ({ params, request }) => {
    const dress = dresses.find((candidate) => candidate.id === params.id);
    if (!dress) {
      return HttpResponse.json({ status: 'rejected_dress_not_found' }, { status: 422 });
    }
    const body = (await request.json()) as UpdateDressRequestDto;
    if (
      body.code !== undefined &&
      dresses.some(
        (candidate) =>
          candidate.id !== dress.id &&
          candidate.code.toLowerCase() === body.code!.toLowerCase(),
      )
    ) {
      return HttpResponse.json(
        { status: 'rejected_dress_code_taken', dressCode: body.code.toUpperCase() },
        { status: 422 },
      );
    }
    if (body.code !== undefined) dress.code = body.code.toUpperCase();
    if (body.name !== undefined) dress.name = body.name;
    if (body.sizeLabel !== undefined) dress.sizeLabel = body.sizeLabel;
    if (body.rentalPrice !== undefined) dress.rentalPrice = body.rentalPrice;
    if (body.depositAmount !== undefined) dress.depositAmount = body.depositAmount;
    if (body.notes !== undefined) dress.notes = body.notes;
    if (body.photoUrls !== undefined) dress.photoUrls = [...body.photoUrls];
    const response: IdResponse = { id: dress.id };
    return HttpResponse.json(response);
  }),

  // POST /api/v1/dresses/:id/retire — both rejections are outcome bodies.
  http.post('/api/v1/dresses/:id/retire', ({ params }) => {
    const dress = dresses.find((candidate) => candidate.id === params.id);
    if (!dress) {
      return HttpResponse.json({ status: 'rejected_dress_not_found' }, { status: 422 });
    }
    if (dress.status === DressResponseDtoStatus.retired) {
      return HttpResponse.json({ status: 'rejected_dress_already_retired' }, { status: 422 });
    }
    dress.status = DressResponseDtoStatus.retired;
    const response: IdResponse = { id: dress.id };
    return HttpResponse.json(response);
  }),

  // GET /api/v1/dresses/:id — one dress, or the 404 fault envelope like the real API (a read that
  // finds nothing is THROWN server-side, so it stays an envelope — never an outcome).
  http.get('/api/v1/dresses/:id', ({ params }) => {
    const dress = dresses.find((candidate) => candidate.id === params.id);
    if (!dress) {
      return HttpResponse.json(
        { error: { code: 'GENERIC.NOT_FOUND', message: 'Dress not found' } },
        { status: 404 },
      );
    }
    return HttpResponse.json(dress);
  }),

  // GET /api/v1/dresses — respects q / status / page / limit like the real API.
  http.get('/api/v1/dresses', ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.toLowerCase();
    const status = url.searchParams.get('status');
    const page = Number(url.searchParams.get('page') ?? '1');
    const limit = Number(url.searchParams.get('limit') ?? String(DEFAULT_LIMIT));

    let filtered = dresses;
    if (q) {
      filtered = filtered.filter(
        (dress) =>
          dress.code.toLowerCase().includes(q) || dress.name.toLowerCase().includes(q),
      );
    }
    if (status) {
      filtered = filtered.filter((dress) => dress.status === status);
    }

    const start = (page - 1) * limit;
    const body: DressListResponseDto = {
      data: filtered.slice(start, start + limit),
      count: filtered.length,
      limit,
      page,
    };
    return HttpResponse.json(body);
  }),

  // POST /api/v1/dresses — 201 IdResponse, or the rejected_dress_code_taken outcome.
  http.post('/api/v1/dresses', async ({ request }) => {
    const body = (await request.json()) as CreateDressRequestDto;
    if (dresses.some((dress) => dress.code.toLowerCase() === body.code.toLowerCase())) {
      return HttpResponse.json(
        { status: 'rejected_dress_code_taken', dressCode: body.code.toUpperCase() },
        { status: 422 },
      );
    }
    const dress = makeDress({
      code: body.code,
      name: body.name,
      sizeLabel: body.sizeLabel ?? null,
      rentalPrice: body.rentalPrice,
      depositAmount: body.depositAmount,
      notes: body.notes ?? null,
    });
    dresses.push(dress);
    const response: IdResponse = { id: dress.id };
    return HttpResponse.json(response, { status: 201 });
  }),
];

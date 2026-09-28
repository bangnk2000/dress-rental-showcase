/**
 * MSW handlers for the catalog tag — a stateful in-memory dress store so
 * tests control the data through seedDresses/resetCatalog.
 */
import { http, HttpResponse, type HttpHandler } from 'msw';

import type {
  CategoryDto,
  CreateCategoryRequestDto,
  CreateDressRequestDto,
  CreatePhotoUploadUrlsRequestDto,
  CreatePhotoUploadUrlsResponseDto,
  DressListResponseDto,
  DressResponseDto,
  DuplicateDressRequestDto,
  DuplicateDressResponseDto,
  IdResponse,
  PriceHistoryEntryDto,
  UpdateDressRequestDto,
} from '@/api/generated/model';
import {
  DressResponseDtoStatus,
  PhotoUploadUrlDtoMethod,
} from '@/api/generated/model';

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
    categoryId: null,
    listings: [],
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
  categories = [];
  priceHistory = [];
  lastDuplicate = null;
  lastUpdateDressBody = null;
  photoUploadUrlRequests = [];
  photoPuts = [];
  nextId = 1;
}

let categories: CategoryDto[] = [];

export function seedCategories(seed: CategoryDto[]): void {
  categories = [...seed];
}

/** The most recent POST /categories body, for assertions. */
let lastCreatedCategory: string | null = null;
export function getLastCreatedCategory(): string | null {
  return lastCreatedCategory;
}

/** The most recent PATCH /dresses/:id body, for key-level assertions (FR-CAT-05). */
let lastUpdateDressBody: UpdateDressRequestDto | null = null;
export function getLastUpdateDressBody(): UpdateDressRequestDto | null {
  return lastUpdateDressBody;
}

/** The most recent POST /dresses/:id/duplicate, for assertions (FR-CAT-08). */
let lastDuplicate: { dressId: string; body: DuplicateDressRequestDto } | null = null;
export function getLastDuplicate(): { dressId: string; body: DuplicateDressRequestDto } | null {
  return lastDuplicate;
}

let priceHistory: PriceHistoryEntryDto[] = [];

/** Newest-first entries served by GET /dresses/:id/price-history (one shared log per test). */
export function seedPriceHistory(seed: PriceHistoryEntryDto[]): void {
  priceHistory = [...seed];
}

/**
 * Direct-to-R2 photo upload (catalog/dress-photo-upload). The fake storage lives at PHOTO_STORAGE_ORIGIN
 * (the presigned PUT target) and serves public URLs under PHOTO_PUBLIC_BASE. The key is derived
 * from the declared contentLength, so a test can tell which file became which URL regardless of
 * the order requests arrive in.
 */
export const PHOTO_STORAGE_ORIGIN = 'https://r2.test';
export const PHOTO_PUBLIC_BASE = 'https://img.test';

export function photoPublicUrl(contentLength: number): string {
  return `${PHOTO_PUBLIC_BASE}/photos/2026/09/${contentLength}.jpg`;
}

export interface RecordedPhotoPut {
  url: string;
  contentType: string | null;
  cacheControl: string | null;
  authorization: string | null;
}

let photoUploadUrlRequests: CreatePhotoUploadUrlsRequestDto[] = [];
let photoPuts: RecordedPhotoPut[] = [];

/** Bodies of every POST /photos/upload-urls (one per Save), in arrival order. */
export function getPhotoUploadUrlRequests(): CreatePhotoUploadUrlsRequestDto[] {
  return photoUploadUrlRequests;
}

/** Every PUT that reached the fake storage, in arrival order. */
export function getPhotoPuts(): RecordedPhotoPut[] {
  return photoPuts;
}

/** Default PUT behaviour, reusable by tests that wrap it (delay / fail first attempt). */
export function recordPhotoPut(request: Request): Response {
  photoPuts.push({
    url: request.url,
    contentType: request.headers.get('content-type'),
    cacheControl: request.headers.get('cache-control'),
    authorization: request.headers.get('authorization'),
  });
  return new HttpResponse(null, { status: 200 });
}

export const catalogHandlers: HttpHandler[] = [
  // POST /api/v1/photos/upload-urls — the presign; errors are envelopes (ADR 0001 §3 PHOTO.*).
  http.post('/api/v1/photos/upload-urls', async ({ request }) => {
    const body = (await request.json()) as CreatePhotoUploadUrlsRequestDto;
    photoUploadUrlRequests.push(body);
    const response: CreatePhotoUploadUrlsResponseDto = {
      uploads: body.files.map((file) => {
        const key = `photos/2026/09/${file.contentLength}.jpg`;
        return {
          uploadUrl: `${PHOTO_STORAGE_ORIGIN}/bucket/${key}?X-Amz-Signature=test-${photoUploadUrlRequests.length}`,
          method: PhotoUploadUrlDtoMethod.PUT,
          headers: {
            'Content-Type': file.contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
          url: photoPublicUrl(file.contentLength),
          expiresAt: '2026-09-25T00:05:00.000Z',
        };
      }),
    };
    return HttpResponse.json(response, { status: 201 });
  }),

  // PUT <presigned uploadUrl> — the fake R2 bucket.
  http.put(`${PHOTO_STORAGE_ORIGIN}/*`, ({ request }) => recordPhotoPut(request)),

  // PATCH /api/v1/dresses/:id — partial update; both rejections are outcome bodies (ADR 0001 §3).
  http.patch('/api/v1/dresses/:id', async ({ params, request }) => {
    const dress = dresses.find((candidate) => candidate.id === params.id);
    if (!dress) {
      return HttpResponse.json({ status: 'rejected_dress_not_found' }, { status: 422 });
    }
    const body = (await request.json()) as UpdateDressRequestDto;
    lastUpdateDressBody = body;
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

  // POST /api/v1/dresses/:id/duplicate — a copy under the next free <base>_<n>, n from 1 (FR-CAT-08),
  // numbered the way the real service does it: the highest existing copy + 1.
  http.post('/api/v1/dresses/:id/duplicate', async ({ params, request }) => {
    const source = dresses.find((candidate) => candidate.id === params.id);
    if (!source) {
      return HttpResponse.json({ status: 'rejected_dress_not_found' }, { status: 422 });
    }
    const body = (await request.json()) as DuplicateDressRequestDto;
    lastDuplicate = { dressId: source.id, body };
    const base = source.code.replace(/_[0-9]+$/, '');
    const numbers = dresses
      .map((dress) => dress.code)
      .filter((code) => code.startsWith(`${base}_`) && /^[0-9]+$/.test(code.slice(base.length + 1)))
      .map((code) => Number(code.slice(base.length + 1)));
    const copy = makeDress({
      code: `${base}_${numbers.length > 0 ? Math.max(...numbers) + 1 : 1}`,
      name: source.name,
      sizeLabel: body.sizeLabel === undefined ? source.sizeLabel : body.sizeLabel,
      rentalPrice: source.rentalPrice,
      depositAmount: source.depositAmount,
      notes: source.notes,
      photoUrls: [...source.photoUrls],
      categoryId: source.categoryId,
    });
    dresses.push(copy);
    const response: DuplicateDressResponseDto = { id: copy.id, code: copy.code };
    return HttpResponse.json(response, { status: 201 });
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
    const categoryId = url.searchParams.get('categoryId');
    if (categoryId) {
      filtered = filtered.filter((dress) => dress.categoryId === categoryId);
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

  // GET /api/v1/dresses/:id/price-history — the append-only version log (FR-CAT-06).
  http.get('/api/v1/dresses/:id/price-history', () =>
    HttpResponse.json({ data: priceHistory }),
  ),

  // GET /api/v1/categories — the tiny cached list dress rows join names from.
  http.get('/api/v1/categories', () => HttpResponse.json({ data: categories })),

  // POST /api/v1/categories — 201, or the rejected_category_name_taken outcome.
  http.post('/api/v1/categories', async ({ request }) => {
    const body = (await request.json()) as CreateCategoryRequestDto;
    const name = body.name.trim();
    if (categories.some((category) => category.name.toLowerCase() === name.toLowerCase())) {
      return HttpResponse.json(
        { status: 'rejected_category_name_taken', name },
        { status: 422 },
      );
    }
    lastCreatedCategory = name;
    const created: CategoryDto = { id: `category-${categories.length + 1}`, name, dressCount: 0 };
    categories.push(created);
    return HttpResponse.json({ id: created.id }, { status: 201 });
  }),

  // PATCH /api/v1/categories/:id — rename.
  http.patch('/api/v1/categories/:id', async ({ params, request }) => {
    const category = categories.find((candidate) => candidate.id === params.id);
    if (!category) {
      return HttpResponse.json({ status: 'rejected_category_not_found' }, { status: 422 });
    }
    const body = (await request.json()) as CreateCategoryRequestDto;
    category.name = body.name.trim();
    return HttpResponse.json({ id: category.id });
  }),

  // DELETE /api/v1/categories/:id — refused with the count while dresses hold it.
  http.delete('/api/v1/categories/:id', ({ params }) => {
    const category = categories.find((candidate) => candidate.id === params.id);
    if (!category) {
      return HttpResponse.json({ status: 'rejected_category_not_found' }, { status: 422 });
    }
    if (category.dressCount > 0) {
      return HttpResponse.json(
        { status: 'rejected_category_in_use', dressCount: category.dressCount },
        { status: 422 },
      );
    }
    categories = categories.filter((candidate) => candidate.id !== params.id);
    return HttpResponse.json({ id: params.id });
  }),
];

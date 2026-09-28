import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { useState } from 'react';
import { afterEach, beforeEach, expect, onTestFinished, test, vi } from 'vitest';

import { usePhotoUploader } from '@/api/use-photo-uploader';
import {
  PHOTO_PUBLIC_BASE,
  PHOTO_STORAGE_ORIGIN,
  getPhotoPuts,
  getPhotoUploadUrlRequests,
  photoPublicUrl,
  recordPhotoPut,
  resetCatalog,
} from '@/test/msw/handlers/catalog';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';

import { toPhotoItems, uploadLocalPhotos, type PhotoItem } from './photo-items';
import { PhotoListField } from './photo-list-field';

/**
 * The field plus the dress form's Save step, wired to the REAL uploader (generated client + XHR
 * PUT) against MSW — the same `uploadLocalPhotos` call the dialog makes.
 */
function Harness({ initial = [] }: { initial?: string[] }) {
  const [photos, setPhotos] = useState<PhotoItem[]>(() => toPhotoItems(initial));
  const [progress, setProgress] = useState<Record<string, number> | null>(null);
  const [saved, setSaved] = useState<boolean | null>(null);
  const upload = usePhotoUploader();

  async function save() {
    setProgress({});
    const result = await uploadLocalPhotos(photos, upload, {
      onProgress: (id, percent) => setProgress((prev) => (prev ? { ...prev, [id]: percent } : prev)),
    });
    setProgress(null);
    setPhotos(result.items);
    setSaved(result.ok);
  }

  return (
    <>
      <span id="photos-label">Ảnh</span>
      <PhotoListField
        value={photos}
        onChange={setPhotos}
        progress={progress}
        aria-labelledby="photos-label"
      />
      <button type="button" onClick={() => void save()}>
        Lưu
      </button>
      <output data-testid="value">
        {JSON.stringify(
          photos.map((photo) => (photo.kind === 'stored' ? photo.url : `local:${photo.file.size}`)),
        )}
      </output>
      <output data-testid="saved">{String(saved)}</output>
    </>
  );
}

function jpeg(bytes: number, name = `photo-${bytes}.jpg`): File {
  return new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' });
}

/** A file that REPORTS a size without allocating it. */
function sizedFile(name: string, type: string, size: number): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

const fileInput = () => screen.getByLabelText('Chọn ảnh để tải lên');
const saveButton = () => screen.getByRole('button', { name: 'Lưu' });
const currentValue = (): string[] =>
  JSON.parse(screen.getByTestId('value').textContent ?? '[]') as string[];
const saved = () => screen.getByTestId('saved').textContent;

beforeEach(() => {
  resetCatalog();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test('choosing files uploads NOTHING; they wait as "not saved yet" until Save', async () => {
  const user = userEvent.setup();
  renderWithProviders(<Harness />);

  await user.upload(fileInput(), [jpeg(111), jpeg(222)]);

  expect(currentValue()).toEqual(['local:111', 'local:222']);
  expect(screen.getAllByText('Chờ lưu')).toHaveLength(2);
  expect(screen.getByText('Bìa')).toBeInTheDocument();
  expect(getPhotoUploadUrlRequests()).toHaveLength(0);
  expect(getPhotoPuts()).toHaveLength(0);
});

test('Save signs every chosen file in ONE request, PUTs each, and keeps the chosen order', async () => {
  // The FIRST file's PUT is slower, so it finishes second: the order must still follow the list.
  server.use(
    http.put(`${PHOTO_STORAGE_ORIGIN}/*`, async ({ request }) => {
      if (request.url.includes('/111.jpg')) await delay(40);
      return recordPhotoPut(request);
    }),
  );
  const user = userEvent.setup();
  renderWithProviders(<Harness />);

  await user.upload(fileInput(), [jpeg(111), jpeg(222)]);
  await user.click(saveButton());

  await waitFor(() => expect(saved()).toBe('true'));
  expect(currentValue()).toEqual([photoPublicUrl(111), photoPublicUrl(222)]);
  expect(getPhotoUploadUrlRequests()).toEqual([
    {
      files: [
        { contentType: 'image/jpeg', contentLength: 111 },
        { contentType: 'image/jpeg', contentLength: 222 },
      ],
    },
  ]);
  const puts = getPhotoPuts();
  expect(puts).toHaveLength(2);
  for (const put of puts) {
    // exactly the signed headers, and never our bearer token
    expect(put.contentType).toBe('image/jpeg');
    expect(put.cacheControl).toBe('public, max-age=31536000, immutable');
    expect(put.authorization).toBeNull();
  }
  // (The body itself is not asserted: jsdom's File is not a Blob to Node's Request, so MSW sees it
  // stringified. The signed Content-Length makes R2 refuse any other body anyway.)
  expect(puts.map((put) => new URL(put.url).pathname).sort()).toEqual([
    '/bucket/photos/2026/09/111.jpg',
    '/bucket/photos/2026/09/222.jpg',
  ]);
});

test('stored photos and chosen files reorder together; Save keeps that order and signs only the files', async () => {
  const user = userEvent.setup();
  renderWithProviders(<Harness initial={['https://a.test/old.jpg']} />);

  await user.upload(fileInput(), [jpeg(333)]);
  await user.click(screen.getByRole('button', { name: 'Đưa ảnh 2 sang trái' }));
  expect(currentValue()).toEqual(['local:333', 'https://a.test/old.jpg']);

  await user.click(saveButton());

  await waitFor(() => expect(saved()).toBe('true'));
  expect(currentValue()).toEqual([photoPublicUrl(333), 'https://a.test/old.jpg']);
  expect(getPhotoUploadUrlRequests()).toEqual([
    { files: [{ contentType: 'image/jpeg', contentLength: 333 }] },
  ]);
});

test('an uploaded photo keeps showing its local preview — it is not fetched back from storage', async () => {
  vi.stubEnv('VITE_IMAGE_BASE_URL', PHOTO_PUBLIC_BASE);
  // jsdom cannot make object URLs from its File; give the field one so there IS a preview to keep.
  const original = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  Object.defineProperty(URL, 'createObjectURL', {
    value: () => 'blob:local-preview',
    configurable: true,
    writable: true,
  });
  onTestFinished(() => {
    if (original) Object.defineProperty(URL, 'createObjectURL', original);
    else Reflect.deleteProperty(URL, 'createObjectURL');
  });
  const user = userEvent.setup();
  const { container } = renderWithProviders(<Harness />);

  await user.upload(fileInput(), [jpeg(444)]);
  await user.click(saveButton());

  await waitFor(() => expect(saved()).toBe('true'));
  expect(currentValue()).toEqual([photoPublicUrl(444)]);
  const sources = Array.from(container.querySelectorAll('img')).map((img) => img.getAttribute('src'));
  expect(sources).toEqual(['blob:local-preview']);
});

test('a GIF and an 11 MB file are refused on the spot, never sent, and only removable', async () => {
  const user = userEvent.setup({ applyAccept: false });
  renderWithProviders(<Harness />);

  await user.upload(fileInput(), [
    sizedFile('anim.gif', 'image/gif', 1000),
    sizedFile('huge.jpg', 'image/jpeg', 11 * 1024 * 1024),
  ]);

  expect(await screen.findByText('Chỉ nhận ảnh JPG, PNG, WebP')).toBeInTheDocument();
  expect(screen.getByText('Ảnh quá lớn (tối đa 10 MB)')).toBeInTheDocument();
  expect(getPhotoUploadUrlRequests()).toHaveLength(0);
  await user.click(screen.getByRole('button', { name: 'Xoá ảnh 1' }));
  await user.click(screen.getByRole('button', { name: 'Xoá ảnh 1' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(currentValue()).toEqual([]);
});

test('400 PHOTO.TOO_LARGE blames the file named in details and shows the server limit', async () => {
  server.use(
    http.post('/api/v1/photos/upload-urls', () =>
      HttpResponse.json(
        {
          error: {
            code: 'PHOTO.TOO_LARGE',
            message: 'too large',
            details: [
              {
                field: 'files.1.contentLength',
                rule: 'max',
                message: 'too large',
                maxBytes: 5_242_880,
              },
            ],
            correlationId: 'c-1',
          },
        },
        { status: 400 },
      ),
    ),
  );
  const user = userEvent.setup();
  renderWithProviders(<Harness />);

  await user.upload(fileInput(), [jpeg(300), jpeg(301)]);
  await user.click(saveButton());

  await waitFor(() => expect(saved()).toBe('false'));
  const tiles = screen.getAllByRole('listitem');
  expect(within(tiles[1] as HTMLElement).getByText('Ảnh quá lớn (tối đa 5 MB)')).toBeInTheDocument();
  expect(
    within(tiles[0] as HTMLElement).getByText('Tải ảnh lên thất bại. Vui lòng thử lại.'),
  ).toBeInTheDocument();
  expect(getPhotoPuts()).toHaveLength(0);
});

test('503 PHOTO.STORAGE_UNAVAILABLE marks the files; the next Save signs again and succeeds', async () => {
  let attempts = 0;
  server.use(
    http.post('/api/v1/photos/upload-urls', () => {
      attempts += 1;
      if (attempts > 1) return undefined; // fall through to the default (success) handler
      return HttpResponse.json(
        { error: { code: 'PHOTO.STORAGE_UNAVAILABLE', message: 'not configured', correlationId: 'c-2' } },
        { status: 503 },
      );
    }),
  );
  const user = userEvent.setup();
  renderWithProviders(<Harness />);

  await user.upload(fileInput(), [jpeg(400)]);
  await user.click(saveButton());
  expect(
    await screen.findByText('Kho ảnh chưa sẵn sàng. Thử lại sau hoặc dùng Thêm link.'),
  ).toBeInTheDocument();
  expect(saved()).toBe('false');

  await user.click(saveButton());

  await waitFor(() => expect(saved()).toBe('true'));
  expect(currentValue()).toEqual([photoPublicUrl(400)]);
  expect(attempts).toBe(2);
  expect(getPhotoPuts()).toHaveLength(1);
});

test('one PUT refused by storage: the other photo is kept, and the next Save re-signs ONLY the failed one', async () => {
  let refused = false;
  server.use(
    http.put(`${PHOTO_STORAGE_ORIGIN}/*`, ({ request }) => {
      if (request.url.includes('/502.jpg') && !refused) {
        refused = true;
        return new HttpResponse('<Error><Code>ExpiredRequest</Code></Error>', { status: 403 });
      }
      return recordPhotoPut(request);
    }),
  );
  const user = userEvent.setup();
  renderWithProviders(<Harness />);

  await user.upload(fileInput(), [jpeg(501), jpeg(502)]);
  await user.click(saveButton());

  await waitFor(() => expect(saved()).toBe('false'));
  expect(currentValue()).toEqual([photoPublicUrl(501), 'local:502']);
  expect(screen.getByText('Tải ảnh lên thất bại. Vui lòng thử lại.')).toBeInTheDocument();

  await user.click(saveButton());

  await waitFor(() => expect(saved()).toBe('true'));
  expect(currentValue()).toEqual([photoPublicUrl(501), photoPublicUrl(502)]);
  expect(getPhotoUploadUrlRequests().map((request) => request.files)).toEqual([
    [
      { contentType: 'image/jpeg', contentLength: 501 },
      { contentType: 'image/jpeg', contentLength: 502 },
    ],
    [{ contentType: 'image/jpeg', contentLength: 502 }],
  ]);
});

test('while Save uploads, each file shows its progress and the list is read-only', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.put(`${PHOTO_STORAGE_ORIGIN}/*`, async ({ request }) => {
      await gate;
      return recordPhotoPut(request);
    }),
  );
  const user = userEvent.setup();
  renderWithProviders(<Harness />);

  await user.upload(fileInput(), [jpeg(600)]);
  await user.click(saveButton());

  expect(await screen.findByText(/^Đang tải \d+%$/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Xoá ảnh 1' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Tải ảnh lên' })).toBeDisabled();

  release();
  await waitFor(() => expect(saved()).toBe('true'));
  expect(currentValue()).toEqual([photoPublicUrl(600)]);
  expect(screen.queryByText(/^Đang tải/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Xoá ảnh 1' })).toBeEnabled();
});

test('←/→ reorder, ✕ removes, and the cover label follows the first photo', async () => {
  const user = userEvent.setup();
  renderWithProviders(
    <Harness initial={['https://a.test/1.jpg', 'https://a.test/2.jpg', 'https://a.test/3.jpg']} />,
  );

  expect(screen.getByRole('button', { name: 'Đưa ảnh 1 sang trái' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Đưa ảnh 3 sang phải' })).toBeDisabled();

  await user.click(screen.getByRole('button', { name: 'Đưa ảnh 2 sang trái' }));
  expect(currentValue()).toEqual(['https://a.test/2.jpg', 'https://a.test/1.jpg', 'https://a.test/3.jpg']);

  await user.click(screen.getByRole('button', { name: 'Đưa ảnh 2 sang phải' }));
  expect(currentValue()).toEqual(['https://a.test/2.jpg', 'https://a.test/3.jpg', 'https://a.test/1.jpg']);

  await user.click(screen.getByRole('button', { name: 'Xoá ảnh 1' }));
  expect(currentValue()).toEqual(['https://a.test/3.jpg', 'https://a.test/1.jpg']);
  // exactly one cover badge, on the first tile
  const tiles = screen.getAllByRole('listitem');
  expect(within(tiles[0] as HTMLElement).getByText('Bìa')).toBeInTheDocument();
  expect(screen.getAllByText('Bìa')).toHaveLength(1);
});

test('a pasted link is added with the button or Enter; a non-http link is refused', async () => {
  const user = userEvent.setup();
  renderWithProviders(<Harness />);
  const linkInput = screen.getByLabelText('Link ảnh');

  await user.type(linkInput, 'khong-phai-link');
  await user.click(screen.getByRole('button', { name: 'Thêm link' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Link phải bắt đầu bằng http:// hoặc https://');
  expect(currentValue()).toEqual([]);

  await user.clear(linkInput);
  await user.type(linkInput, 'https://example.com/a.jpg');
  await user.click(screen.getByRole('button', { name: 'Thêm link' }));
  await user.type(linkInput, 'https://example.com/b.jpg{Enter}');

  expect(currentValue()).toEqual(['https://example.com/a.jpg', 'https://example.com/b.jpg']);
  expect(linkInput).toHaveValue('');
});

test('at 10 photos the upload and link inputs give way to the limit notice', () => {
  renderWithProviders(
    <Harness initial={Array.from({ length: 10 }, (_, i) => `https://a.test/${i}.jpg`)} />,
  );

  expect(screen.getByText('Tối đa 10 ảnh')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Tải ảnh lên' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Chọn ảnh để tải lên')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Link ảnh')).not.toBeInTheDocument();
});

test('thumbnails of R2 photos use the Cloudflare Images variant; foreign links stay untouched', () => {
  vi.stubEnv('VITE_IMAGE_BASE_URL', PHOTO_PUBLIC_BASE);
  const r2 = `${PHOTO_PUBLIC_BASE}/photos/2026/09/abc.webp`;
  const foreign = 'https://example.com/legacy.jpg';
  const { container } = renderWithProviders(<Harness initial={[r2, foreign]} />);

  const sources = Array.from(container.querySelectorAll('img')).map((img) => img.getAttribute('src'));
  expect(sources).toEqual([
    `${PHOTO_PUBLIC_BASE}/cdn-cgi/image/width=160,quality=80,format=auto,fit=scale-down/photos/2026/09/abc.webp`,
    foreign,
  ]);
});

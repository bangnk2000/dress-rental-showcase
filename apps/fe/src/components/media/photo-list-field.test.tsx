import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { useState } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

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

import { PhotoListField } from './photo-list-field';

/** The field wired to the REAL uploader (generated client + XHR PUT) against MSW. */
function Harness({ initial = [] }: { initial?: string[] }) {
  const [urls, setUrls] = useState<string[]>(initial);
  const [uploading, setUploading] = useState(false);
  const upload = usePhotoUploader();
  return (
    <>
      <span id="photos-label">Ảnh</span>
      <PhotoListField
        value={urls}
        onChange={setUrls}
        upload={upload}
        onUploadingChange={setUploading}
        aria-labelledby="photos-label"
      />
      <output data-testid="value">{JSON.stringify(urls)}</output>
      <output data-testid="uploading">{String(uploading)}</output>
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
const currentValue = (): string[] =>
  JSON.parse(screen.getByTestId('value').textContent ?? '[]') as string[];

beforeEach(() => {
  resetCatalog();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test('choosing two files → two upload URLs + two PUTs → value in the order the files were chosen', async () => {
  // The FIRST file's PUT is slower, so it finishes second: the value must still follow selection order.
  server.use(
    http.put(`${PHOTO_STORAGE_ORIGIN}/*`, async ({ request }) => {
      if (request.url.includes('/111.jpg')) await delay(40);
      return recordPhotoPut(request);
    }),
  );
  const user = userEvent.setup();
  renderWithProviders(<Harness />);

  await user.upload(fileInput(), [jpeg(111), jpeg(222)]);

  await waitFor(() => expect(currentValue()).toEqual([photoPublicUrl(111), photoPublicUrl(222)]));
  expect(getPhotoUploadUrlRequests()).toEqual([
    { contentType: 'image/jpeg', contentLength: 111 },
    { contentType: 'image/jpeg', contentLength: 222 },
  ]);
  const puts = getPhotoPuts();
  expect(puts).toHaveLength(2);
  for (const put of puts) {
    // exactly the signed headers, the exact bytes, and never our bearer token
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
  expect(screen.getByTestId('uploading')).toHaveTextContent('false');
  expect(screen.getByText('Bìa')).toBeInTheDocument();
});

test('a GIF and an 11 MB file are refused on the spot without calling the API', async () => {
  const user = userEvent.setup({ applyAccept: false });
  renderWithProviders(<Harness />);

  await user.upload(fileInput(), [
    sizedFile('anim.gif', 'image/gif', 1000),
    sizedFile('huge.jpg', 'image/jpeg', 11 * 1024 * 1024),
  ]);

  expect(await screen.findByText('Chỉ nhận ảnh JPG, PNG, WebP')).toBeInTheDocument();
  expect(screen.getByText('Ảnh quá lớn (tối đa 10 MB)')).toBeInTheDocument();
  expect(getPhotoUploadUrlRequests()).toHaveLength(0);
  expect(getPhotoPuts()).toHaveLength(0);
  // a wrong file never uploads, so there is nothing to retry — only remove
  expect(screen.queryByRole('button', { name: /^Thử lại/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Xoá ảnh 1' }));
  await user.click(screen.getByRole('button', { name: 'Xoá ảnh 1' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(currentValue()).toEqual([]);
});

test('400 PHOTO.TOO_LARGE shows the limit the server sent in details[0].maxBytes', async () => {
  server.use(
    http.post('/api/v1/photos/upload-urls', () =>
      HttpResponse.json(
        {
          error: {
            code: 'PHOTO.TOO_LARGE',
            message: 'too large',
            details: [{ field: 'contentLength', rule: 'max', message: 'too large', maxBytes: 5_242_880 }],
            correlationId: 'c-1',
          },
        },
        { status: 400 },
      ),
    ),
  );
  const user = userEvent.setup();
  renderWithProviders(<Harness />);

  await user.upload(fileInput(), [jpeg(300)]);

  expect(await screen.findByText('Ảnh quá lớn (tối đa 5 MB)')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Thử lại ảnh 1' })).not.toBeInTheDocument();
  expect(getPhotoPuts()).toHaveLength(0);
});

test('503 PHOTO.STORAGE_UNAVAILABLE offers retry, and retry requests a NEW upload URL', async () => {
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
  expect(
    await screen.findByText('Kho ảnh chưa sẵn sàng. Thử lại sau hoặc dùng Thêm link.'),
  ).toBeInTheDocument();
  expect(currentValue()).toEqual([]);

  await user.click(screen.getByRole('button', { name: 'Thử lại ảnh 1' }));

  await waitFor(() => expect(currentValue()).toEqual([photoPublicUrl(400)]));
  expect(attempts).toBe(2);
  expect(getPhotoPuts()).toHaveLength(1);
});

test('a PUT refused by storage (403 expired) shows upload-failed; retry signs again and re-PUTs', async () => {
  let puts = 0;
  server.use(
    http.put(`${PHOTO_STORAGE_ORIGIN}/*`, ({ request }) => {
      puts += 1;
      if (puts === 1) return new HttpResponse('<Error><Code>ExpiredRequest</Code></Error>', { status: 403 });
      return recordPhotoPut(request);
    }),
  );
  const user = userEvent.setup();
  renderWithProviders(<Harness />);

  await user.upload(fileInput(), [jpeg(500)]);
  expect(await screen.findByText('Tải ảnh lên thất bại. Vui lòng thử lại.')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Thử lại ảnh 1' }));

  await waitFor(() => expect(currentValue()).toEqual([photoPublicUrl(500)]));
  expect(getPhotoUploadUrlRequests()).toHaveLength(2); // a new URL per attempt
});

test('while a photo uploads it shows its progress and reports uploading', async () => {
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

  expect(await screen.findByText(/^Đang tải \d+%$/)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByTestId('uploading')).toHaveTextContent('true'));

  release();
  await waitFor(() => expect(screen.getByTestId('uploading')).toHaveTextContent('false'));
  expect(currentValue()).toEqual([photoPublicUrl(600)]);
  expect(screen.queryByText(/^Đang tải/)).not.toBeInTheDocument();
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

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Suspense } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { clearTokens, setTokens } from '@/api/mutator/auth-tokens';
import { Toaster } from '@/components/ui/sonner';
import {
  getListingRequests,
  getListings,
  getPhotoUploadUrlRequests,
  makeDress,
  makeListing,
  photoPublicUrl,
  resetCatalog,
  seedDresses,
  seedListings,
} from '@/test/msw/handlers/catalog';
import { testTokenPair, testUser } from '@/test/msw/handlers/identity';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';

import { EditListingRoute } from './edit-listing-route';
import { ListingsRoute } from './listings-route';
import { NewListingRoute } from './new-listing-route';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

/** The three routes as the router mounts them; a local Suspense stands in for RouteBoundary. */
function renderAt(route: string) {
  return renderWithProviders(
    <>
      <Suspense fallback={<output>loading</output>}>
        <Routes>
          <Route path="/website" element={<ListingsRoute />} />
          <Route path="/website/new" element={<NewListingRoute />} />
          <Route path="/website/:id" element={<EditListingRoute />} />
        </Routes>
      </Suspense>
      <LocationProbe />
      <Toaster />
    </>,
    { route },
  );
}

function signInAsStaff() {
  server.use(http.get('*/api/v1/auth/me', () => HttpResponse.json({ ...testUser, role: 'staff' })));
}

beforeEach(() => {
  resetCatalog();
  clearTokens();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ── /website list ────────────────────────────────────────────────────────────

test('list: loading skeleton first, then the empty state offers Tạo mẫu', async () => {
  renderAt('/website');

  expect(screen.getByRole('status', { name: 'Đang tải danh sách mẫu' })).toBeInTheDocument();
  expect(await screen.findByText('Chưa có mẫu nào trên website')).toBeInTheDocument();
  const createLinks = screen.getAllByRole('link', { name: 'Tạo mẫu' });
  expect(createLinks.length).toBeGreaterThanOrEqual(2); // header + empty state
  expect(createLinks[0]).toHaveAttribute('href', '/website/new');
});

test('list: rows show occasions, available sizes and the three badges; a click opens the edit page', async () => {
  seedDresses([
    makeDress({ id: 'd1', code: 'DR-001', sizeLabel: 'M' }),
    makeDress({ id: 'd2', code: 'DR-002', sizeLabel: 'S' }),
    makeDress({ id: 'd3', code: 'DR-003', status: 'retired' }),
  ]);
  seedListings([
    makeListing({ id: 'l1', name: 'Mẫu nháp', occasions: ['gala', 'birthday'] }),
    makeListing({
      id: 'l2',
      name: 'Mẫu đang đăng',
      publishedAt: '2026-09-20T00:00:00.000Z',
      firstPublishedAt: '2026-09-20T00:00:00.000Z',
      dressIds: ['d1', 'd2'],
    }),
    makeListing({
      id: 'l3',
      name: 'Mẫu hết váy',
      publishedAt: '2026-09-20T00:00:00.000Z',
      firstPublishedAt: '2026-09-20T00:00:00.000Z',
      dressIds: ['d3'],
    }),
  ]);
  const user = userEvent.setup();
  renderAt('/website');

  const draftRow = (await screen.findByRole('link', { name: 'Mẫu nháp' })).closest('tr')!;
  expect(within(draftRow).getByText('Nháp')).toBeInTheDocument();
  expect(within(draftRow).getByText('Gala & Red Carpet, Birthday & Prom')).toBeInTheDocument();
  const liveRow = screen.getByRole('link', { name: 'Mẫu đang đăng' }).closest('tr')!;
  expect(within(liveRow).getByText('Đã đăng')).toBeInTheDocument();
  expect(within(liveRow).getByText('2 size còn')).toBeInTheDocument();
  const hiddenRow = screen.getByRole('link', { name: 'Mẫu hết váy' }).closest('tr')!;
  expect(within(hiddenRow).getByText('Ẩn (hết váy)')).toBeInTheDocument();
  expect(within(hiddenRow).getByText('0 size còn')).toBeInTheDocument();

  await user.click(within(liveRow).getByText('Đã đăng'));
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/website/l2'));
});

// ── form: create ─────────────────────────────────────────────────────────────

test('create: the slug follows the name (Vietnamese stripped), then the listing opens for dresses', async () => {
  const user = userEvent.setup();
  renderAt('/website/new');

  await user.type(await screen.findByLabelText('Tên mẫu'), 'Đầm dạ hội Ánh Trăng');
  expect(screen.getByLabelText('Đường link (slug)')).toHaveValue('dam-da-hoi-anh-trang');
  await user.click(screen.getByRole('button', { name: 'Gala & Red Carpet' }));
  await user.click(screen.getByRole('button', { name: 'Chụp Ảnh Kỷ Yếu' }));
  await user.type(screen.getByLabelText('Giá bán tham khảo (VND)'), '3500000');
  await user.type(screen.getByLabelText('Chất liệu'), 'Lụa');
  await user.click(screen.getByRole('switch', { name: 'Hot' }));
  await user.click(screen.getByRole('button', { name: 'Tạo mẫu' }));

  expect(await screen.findByText('Đã tạo mẫu — giờ gắn váy ở mục Size & váy')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/website/listing-1'));
  expect(getListingRequests().create).toEqual([
    {
      name: 'Đầm dạ hội Ánh Trăng',
      slug: 'dam-da-hoi-anh-trang',
      tagline: '',
      description: '',
      occasions: ['gala', 'yearbook'],
      retailPrice: 3_500_000,
      specs: { material: 'Lụa', silhouette: null, length: null, color: null, occasionsText: null },
      photoUrls: [],
      isHot: true,
    },
  ]);
  // The edit page it lands on has the dress section.
  expect(await screen.findByRole('heading', { name: 'Size & váy' })).toBeInTheDocument();
});

test('create: a slug typed by hand stops following the name; no occasion blocks Save', async () => {
  const user = userEvent.setup();
  renderAt('/website/new');

  const slug = await screen.findByLabelText('Đường link (slug)');
  await user.type(slug, 'vay-rieng');
  await user.type(screen.getByLabelText('Tên mẫu'), 'Váy khác');
  expect(slug).toHaveValue('vay-rieng');

  await user.click(screen.getByRole('button', { name: 'Tạo mẫu' }));
  expect(await screen.findByText('Chọn ít nhất một dịp')).toBeInTheDocument();
  expect(getListingRequests().create).toHaveLength(0);
});

test('create: a chosen photo uploads only on Save, then rides in the create body', async () => {
  const user = userEvent.setup();
  renderAt('/website/new');

  await user.upload(
    await screen.findByLabelText('Chọn ảnh để tải lên'),
    new File([new Uint8Array(700)], 'cover.jpg', { type: 'image/jpeg' }),
  );
  expect(screen.getByText('Chờ lưu')).toBeInTheDocument();
  expect(getPhotoUploadUrlRequests()).toHaveLength(0);

  await user.type(screen.getByLabelText('Tên mẫu'), 'Váy ảnh');
  await user.click(screen.getByRole('button', { name: 'Gala & Red Carpet' }));
  await user.click(screen.getByRole('button', { name: 'Tạo mẫu' }));

  await waitFor(() => expect(getListingRequests().create).toHaveLength(1));
  expect(getPhotoUploadUrlRequests()).toHaveLength(1);
  expect(getListingRequests().create[0]?.photoUrls).toEqual([photoPublicUrl(700)]);
});

test('create: rejected_listing_slug_taken lands under the slug field with the slug', async () => {
  seedListings([makeListing({ slug: 'vay-do' })]);
  const user = userEvent.setup();
  renderAt('/website/new');

  await user.type(await screen.findByLabelText('Tên mẫu'), 'Váy đỏ');
  await user.click(screen.getByRole('button', { name: 'Gala & Red Carpet' }));
  await user.click(screen.getByRole('button', { name: 'Tạo mẫu' }));

  expect(
    await screen.findByText('Link vay-do đã được mẫu khác dùng — chọn slug khác'),
  ).toBeInTheDocument();
  expect(screen.getByTestId('location')).toHaveTextContent('/website/new');
});

// ── form: edit ───────────────────────────────────────────────────────────────

test('edit: a listing that was ever published shows the slug read-only and never sends it', async () => {
  seedListings([
    makeListing({
      id: 'l1',
      name: 'Váy cũ',
      slug: 'vay-cu',
      photoUrls: ['https://example.com/a.jpg'],
      firstPublishedAt: '2026-09-01T00:00:00.000Z',
    }),
  ]);
  const user = userEvent.setup();
  renderAt('/website/l1');

  const slug = await screen.findByLabelText('Đường link (slug)');
  expect(slug).toHaveAttribute('readonly');
  expect(screen.getByText('Đã đăng — không đổi được link')).toBeInTheDocument();

  const name = screen.getByLabelText('Tên mẫu');
  await user.clear(name);
  await user.type(name, 'Váy mới');
  expect(slug).toHaveValue('vay-cu');
  await user.click(screen.getByRole('button', { name: 'Lưu' }));

  expect(await screen.findByText('Đã lưu mẫu')).toBeInTheDocument();
  const body = getListingRequests().update[0];
  expect(body?.name).toBe('Váy mới');
  expect(body).not.toHaveProperty('slug');
});

test('edit: rejected_listing_slug_taken renders under the slug field', async () => {
  seedListings([
    makeListing({ id: 'l1', slug: 'vay-mot' }),
    makeListing({ id: 'l2', slug: 'vay-hai' }),
  ]);
  const user = userEvent.setup();
  renderAt('/website/l1');

  const slug = await screen.findByLabelText('Đường link (slug)');
  await user.clear(slug);
  await user.type(slug, 'vay-hai');
  await user.click(screen.getByRole('button', { name: 'Lưu' }));

  expect(
    await screen.findByText('Link vay-hai đã được mẫu khác dùng — chọn slug khác'),
  ).toBeInTheDocument();
});

test('edit: rejected_listing_slug_locked (published meanwhile) errors on the slug and refetches it read-only', async () => {
  seedListings([makeListing({ id: 'l1', slug: 'vay-mot' })]);
  server.use(
    http.patch('/api/v1/listings/:id', () => {
      // Someone published it between load and save.
      const listing = getListings()[0]!;
      listing.firstPublishedAt = '2026-09-29T00:00:00.000Z';
      return HttpResponse.json({ status: 'rejected_listing_slug_locked' }, { status: 422 });
    }),
  );
  const user = userEvent.setup();
  renderAt('/website/l1');

  const slug = await screen.findByLabelText('Đường link (slug)');
  expect(slug).not.toHaveAttribute('readonly');
  await user.clear(slug);
  await user.type(slug, 'vay-khac');
  await user.click(screen.getByRole('button', { name: 'Lưu' }));

  expect(
    await screen.findByText('Mẫu đã được đăng — không đổi được link nữa'),
  ).toBeInTheDocument();
  await waitFor(() => expect(screen.getByLabelText('Đường link (slug)')).toHaveAttribute('readonly'));
});

test('edit: rejected_listing_photo_required lands on the photo field', async () => {
  seedListings([
    makeListing({
      id: 'l1',
      photoUrls: ['https://example.com/a.jpg'],
      publishedAt: '2026-09-01T00:00:00.000Z',
      firstPublishedAt: '2026-09-01T00:00:00.000Z',
    }),
  ]);
  const user = userEvent.setup();
  renderAt('/website/l1');

  await user.click(await screen.findByRole('button', { name: 'Xoá ảnh 1' }));
  await user.click(screen.getByRole('button', { name: 'Lưu' }));

  expect(await screen.findByText('Mẫu đang đăng phải giữ ít nhất một ảnh')).toBeInTheDocument();
});

test('edit: rejected_listing_not_found toasts and goes back to /website', async () => {
  seedListings([makeListing({ id: 'l1' })]);
  server.use(
    http.patch('/api/v1/listings/:id', () =>
      HttpResponse.json({ status: 'rejected_listing_not_found' }, { status: 422 }),
    ),
  );
  const user = userEvent.setup();
  renderAt('/website/l1');

  await user.click(await screen.findByRole('button', { name: 'Lưu' }));

  expect(await screen.findByText('Mẫu không còn tồn tại')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/website$/));
});

test('edit: Save is disabled with a spinner while the request is in flight', async () => {
  seedListings([makeListing({ id: 'l1' })]);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.patch('/api/v1/listings/:id', async () => {
      await gate;
      return HttpResponse.json({ id: 'l1' });
    }),
  );
  const user = userEvent.setup();
  renderAt('/website/l1');

  await user.click(await screen.findByRole('button', { name: 'Lưu' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Lưu' })).toBeDisabled());
  expect(screen.getByRole('button', { name: 'Về danh sách' })).toBeDisabled();
  release();
  expect(await screen.findByText('Đã lưu mẫu')).toBeInTheDocument();
});

// ── Size & váy ───────────────────────────────────────────────────────────────

test('dresses: "Gắn cả nhóm mã" adds <code> and every <code>_n, then saves the FULL list', async () => {
  seedDresses([
    makeDress({ id: 'd1', code: 'DR-010', sizeLabel: 'M' }),
    makeDress({ id: 'd2', code: 'DR-010_1', sizeLabel: 'S' }),
    makeDress({ id: 'd3', code: 'DR-010_2', sizeLabel: null, status: 'retired' }),
    makeDress({ id: 'd4', code: 'DR-011', sizeLabel: 'L' }),
  ]);
  seedListings([makeListing({ id: 'l1' })]);
  const user = userEvent.setup();
  renderAt('/website/l1');

  await user.type(await screen.findByLabelText('Tìm váy theo mã hoặc tên'), 'DR-010_1');
  await user.click(await screen.findByRole('button', { name: 'Gắn cả nhóm mã DR-010' }));

  const table = await screen.findByRole('table');
  await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(4)); // header + 3
  expect(within(table).getByText('DR-010')).toBeInTheDocument();
  expect(within(table).getByText('DR-010_1')).toBeInTheDocument();
  expect(within(table).getByText('DR-010_2')).toBeInTheDocument();
  expect(within(table).queryByText('DR-011')).not.toBeInTheDocument();
  // Size table: Freesize for no size, retired status shown.
  expect(within(table).getByText('Freesize')).toBeInTheDocument();
  expect(within(table).getByText('Ngừng khai thác')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Lưu size & váy' }));
  expect(await screen.findByText('Đã cập nhật váy của mẫu')).toBeInTheDocument();
  expect(getListingRequests().setDresses).toEqual([{ dressIds: ['d1', 'd2', 'd3'] }]);
});

test('dresses: removing a row and saving sends the remaining list', async () => {
  seedDresses([
    makeDress({ id: 'd1', code: 'DR-001' }),
    makeDress({ id: 'd2', code: 'DR-002' }),
  ]);
  seedListings([makeListing({ id: 'l1', dressIds: ['d1', 'd2'] })]);
  const user = userEvent.setup();
  renderAt('/website/l1');

  await user.click(await screen.findByRole('button', { name: 'Bỏ DR-001' }));
  await user.click(screen.getByRole('button', { name: 'Lưu size & váy' }));

  await waitFor(() => expect(getListingRequests().setDresses).toEqual([{ dressIds: ['d2'] }]));
});

test('dresses: differing rental prices raise the yellow non-blocking warning', async () => {
  seedDresses([
    makeDress({ id: 'd1', code: 'DR-001', rentalPrice: 500_000 }),
    makeDress({ id: 'd2', code: 'DR-001_1', rentalPrice: 500_000 }),
    makeDress({ id: 'd3', code: 'DR-002', rentalPrice: 700_000 }),
  ]);
  seedListings([makeListing({ id: 'l1', dressIds: ['d1', 'd2'] })]);
  const user = userEvent.setup();
  renderAt('/website/l1');

  await screen.findByText('DR-001_1');
  expect(
    screen.queryByText('Các size đang khác giá — web hiện giá thấp nhất'),
  ).not.toBeInTheDocument();

  await user.type(screen.getByLabelText('Tìm váy theo mã hoặc tên'), 'DR-002');
  await user.click(await screen.findByRole('button', { name: 'Gắn DR-002' }));

  expect(screen.getByText('Các size đang khác giá — web hiện giá thấp nhất')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Lưu size & váy' })).toBeEnabled();
});

test('dresses: rejected_dress_not_found toasts, drops the vanished dress and refetches the picker', async () => {
  seedDresses([
    makeDress({ id: 'd1', code: 'DR-001' }),
    makeDress({ id: 'd2', code: 'DR-002' }),
  ]);
  seedListings([makeListing({ id: 'l1', dressIds: ['d1'] })]);
  const user = userEvent.setup();
  renderAt('/website/l1');

  const search = await screen.findByLabelText('Tìm váy theo mã hoặc tên');
  await user.type(search, 'DR-002');
  await user.click(await screen.findByRole('button', { name: 'Gắn DR-002' }));
  // DR-002 is deleted from the catalog before Save.
  seedDresses([makeDress({ id: 'd1', code: 'DR-001' })]);
  await user.click(screen.getByRole('button', { name: 'Lưu size & váy' }));

  expect(
    await screen.findByText(
      'Có váy không còn trong danh mục — đã bỏ khỏi danh sách, kiểm tra rồi lưu lại',
    ),
  ).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Bỏ DR-002' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Bỏ DR-001' })).toBeInTheDocument();

  // The picker was refetched: the vanished dress is no longer offered.
  await user.type(search, 'DR-002');
  expect(await screen.findByText('Không tìm thấy váy phù hợp')).toBeInTheDocument();
});

// ── publish / unpublish ──────────────────────────────────────────────────────

test('publish: rejected_listing_not_publishable toasts every missing item', async () => {
  seedListings([makeListing({ id: 'l1' })]);
  const user = userEvent.setup();
  renderAt('/website/l1');

  await user.click(await screen.findByRole('button', { name: 'Đăng lên web' }));

  expect(
    await screen.findByText('Chưa đăng được — còn thiếu ảnh, váy đang cho thuê'),
  ).toBeInTheDocument();
  expect(screen.getByText('Nháp')).toBeInTheDocument();
});

test('publish: success shows the badge, the web link and the hide button', async () => {
  vi.stubEnv('VITE_WEB_ORIGIN', 'https://web.test/');
  seedDresses([makeDress({ id: 'd1', code: 'DR-001' })]);
  seedListings([
    makeListing({
      id: 'l1',
      slug: 'vay-do',
      photoUrls: ['https://example.com/a.jpg'],
      dressIds: ['d1'],
    }),
  ]);
  const user = userEvent.setup();
  renderAt('/website/l1');

  expect(await screen.findByText('Nháp')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Xem trên web' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Đăng lên web' }));

  expect(await screen.findByText('Đã đăng mẫu lên web')).toBeInTheDocument();
  expect(await screen.findByText('Đã đăng')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Xem trên web' })).toHaveAttribute(
    'href',
    'https://web.test/bo-suu-tap/vay-do',
  );
  // Published once → the slug is locked from now on.
  expect(screen.getByLabelText('Đường link (slug)')).toHaveAttribute('readonly');

  await user.click(screen.getByRole('button', { name: 'Ẩn khỏi web' }));
  expect(await screen.findByText('Đã ẩn mẫu khỏi web')).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: 'Đăng lên web' })).toBeInTheDocument();
});

test('publish: the web link is hidden when VITE_WEB_ORIGIN is not set', async () => {
  vi.stubEnv('VITE_WEB_ORIGIN', '');
  seedDresses([makeDress({ id: 'd1' })]);
  seedListings([
    makeListing({
      id: 'l1',
      photoUrls: ['https://example.com/a.jpg'],
      dressIds: ['d1'],
      publishedAt: '2026-09-01T00:00:00.000Z',
      firstPublishedAt: '2026-09-01T00:00:00.000Z',
    }),
  ]);
  renderAt('/website/l1');

  expect(await screen.findByText('Đã đăng')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Xem trên web' })).not.toBeInTheDocument();
});

test('publish: rejected_listing_not_found toasts and goes back to /website', async () => {
  seedListings([makeListing({ id: 'l1' })]);
  server.use(
    http.post('/api/v1/listings/:id/publish', () =>
      HttpResponse.json({ status: 'rejected_listing_not_found' }, { status: 422 }),
    ),
  );
  const user = userEvent.setup();
  renderAt('/website/l1');

  await user.click(await screen.findByRole('button', { name: 'Đăng lên web' }));

  expect(await screen.findByText('Mẫu không còn tồn tại')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/website$/));
});

// ── delete ───────────────────────────────────────────────────────────────────

test('delete (owner, live listing): the confirmation warns the link becomes 404, then deletes', async () => {
  setTokens(testTokenPair);
  seedDresses([makeDress({ id: 'd1' })]);
  seedListings([
    makeListing({
      id: 'l1',
      name: 'Váy đỏ',
      photoUrls: ['https://example.com/a.jpg'],
      dressIds: ['d1'],
      publishedAt: '2026-09-01T00:00:00.000Z',
      firstPublishedAt: '2026-09-01T00:00:00.000Z',
    }),
  ]);
  const user = userEvent.setup();
  renderAt('/website/l1');

  await user.click(await screen.findByRole('button', { name: 'Xoá mẫu' }));
  const dialog = await screen.findByRole('alertdialog');
  expect(within(dialog).getByText('Xoá mẫu Váy đỏ?')).toBeInTheDocument();
  expect(
    within(dialog).getByText(/Mẫu đang hiện trên website, link sẽ thành 404\./),
  ).toBeInTheDocument();
  await user.click(within(dialog).getByRole('button', { name: 'Xoá mẫu' }));

  expect(await screen.findByText('Đã xoá mẫu')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/website$/));
  expect(getListingRequests().remove).toEqual(['l1']);
});

test('delete (owner, draft): the confirmation carries no 404 warning', async () => {
  setTokens(testTokenPair);
  seedListings([makeListing({ id: 'l1', name: 'Váy nháp' })]);
  const user = userEvent.setup();
  renderAt('/website/l1');

  await user.click(await screen.findByRole('button', { name: 'Xoá mẫu' }));
  const dialog = await screen.findByRole('alertdialog');
  expect(within(dialog).queryByText(/link sẽ thành 404/)).not.toBeInTheDocument();
});

test('delete (staff, ever published): the button is disabled with the owner-only tooltip', async () => {
  signInAsStaff();
  seedListings([
    makeListing({ id: 'l1', firstPublishedAt: '2026-09-01T00:00:00.000Z' }),
  ]);
  renderAt('/website/l1');

  // The role arrives with the me query; wait for the gate to close.
  await waitFor(() => expect(screen.getByRole('button', { name: 'Xoá mẫu' })).toBeDisabled());
  expect(screen.getByTitle('Mẫu đã từng đăng — chỉ chủ tiệm được xoá')).toBeInTheDocument();
});

test('delete (staff): a 403 listing_published_owner_only still lands as the named toast', async () => {
  signInAsStaff();
  seedListings([makeListing({ id: 'l1' })]);
  server.use(
    http.delete('/api/v1/listings/:id', () =>
      HttpResponse.json(
        { status: 'forbidden', reason: 'listing_published_owner_only' },
        { status: 403 },
      ),
    ),
  );
  const user = userEvent.setup();
  renderAt('/website/l1');

  await user.click(await screen.findByRole('button', { name: 'Xoá mẫu' }));
  const dialog = await screen.findByRole('alertdialog');
  await user.click(within(dialog).getByRole('button', { name: 'Xoá mẫu' }));

  expect(
    await screen.findByText('Mẫu đã từng đăng — chỉ chủ tiệm được xoá'),
  ).toBeInTheDocument();
  expect(screen.getByTestId('location')).toHaveTextContent('/website/l1');
});

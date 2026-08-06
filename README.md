# dress-rental

Ứng dụng nội bộ cho tiệm cho thuê váy (khoảng 200 váy), thay thế quy trình Google
Sheets. Giao diện chính dành cho nhân viên, tiếng Việt là ngôn ngữ ưu tiên.

Chức năng hiện có: quản lý danh mục váy, lịch và lượt thuê (bao gồm khoảng đệm
giặt), đặt cọc/phí, bảng việc trong ngày, và QR URL Admin cho chủ tiệm.

## Kiến trúc

- `apps/be` — NestJS API, PostgreSQL và OpenAPI là nguồn hợp đồng duy nhất.
- `apps/fe` — React SPA cho vận hành cửa hàng.
- `apps/qr-admin` — React SPA độc lập để owner tạo, xem lại và tải QR URL dạng SVG.
- `packages/contract` — OpenAPI được sinh từ backend; không chỉnh sửa thủ công.

```text
apps/be ── pnpm openapi:emit ──> packages/contract/openapi.json
                                      │
                                      └── pnpm generate:api ──> apps/fe và apps/qr-admin
```

## Yêu cầu

- Node.js `>= 22.18`
- pnpm
- Docker Desktop hoặc Docker Engine có Docker Compose

## Chạy toàn bộ project ở máy local

Các lệnh dưới đây chạy từ thư mục gốc của repository.

1. Cài dependencies và tạo cấu hình backend. Chỉ sao chép file `.env` nếu máy
   chưa có `apps/be/.env`, để không ghi đè cấu hình hoặc bí mật hiện có.

   ```bash
   pnpm install
   test -f apps/be/.env || cp apps/be/.env.example apps/be/.env
   ```

2. Mở `apps/be/.env` và đặt các giá trị bí mật phù hợp, tối thiểu:

   ```dotenv
   JWT_SECRET=<mot-chuoi-bi-mat-dai>
   JWT_REFRESH_SECRET=<mot-chuoi-bi-mat-khac-dai>
   SEED_OWNER_PASSWORD=<mat-khau-owner>
   ```

   Có thể giữ nguyên `DATABASE_URL` mặc định khi dùng PostgreSQL từ Compose.

3. Khởi động database, áp dụng migration, rồi tạo tài khoản owner ban đầu:

   ```bash
   docker compose up -d
   pnpm --filter be migrate
   pnpm --filter be seed
   ```

   Lệnh seed dùng `SEED_OWNER_EMAIL` và `SEED_OWNER_PASSWORD` trong `.env`; mặc
   định email là `owner@example.com`. Lệnh này an toàn khi chạy lại, nhưng không
   đổi mật khẩu của owner đã tồn tại.

4. Mở ba terminal riêng và chạy:

   ```bash
   pnpm --filter be start:dev
   ```

   ```bash
   pnpm --filter fe dev
   ```

   ```bash
   pnpm --filter qr-admin dev -- --port 5174
   ```

Sau đó truy cập:

| Dịch vụ | URL |
| --- | --- |
| API và Swagger (development) | `http://localhost:3000` · `http://localhost:3000/docs` |
| Ứng dụng vận hành cửa hàng | `http://localhost:5173` |
| QR URL Admin | `http://localhost:5174` |

Hai ứng dụng Vite chuyển tiếp các request `/api` đến backend ở cổng `3000`, nên
không cần đặt `VITE_API_BASE_URL` khi chạy theo các lệnh trên.

## Chạy QR URL Admin

QR Admin cần backend, database và tài khoản có vai trò `owner` đang hoạt động.
Sau khi thực hiện phần khởi động ở trên, mở `http://localhost:5174` và đăng nhập
bằng `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD`. Tại đây owner có thể:

- tạo QR cho một URL tuyệt đối `http://` hoặc `https://`;
- xem lịch sử QR mới nhất trước;
- xem trước hoặc tải QR SVG.

Mỗi QR URL là một bản ghi bất biến: cần thay URL đã in thì tạo một QR mới. Tài
khoản `staff` không có quyền truy cập QR Admin.

### Database cho QR

Không có database riêng cho QR Admin. QR dùng cùng PostgreSQL của backend; migration
`apps/be/migrations/1754300000000_qr_links.js` được chạy bởi lệnh
`pnpm --filter be migrate` ở bước 3 và tạo bảng `qr_links`.

| Bảng | Dữ liệu lưu |
| --- | --- |
| `qr_links` | URL đích, nhãn tùy chọn, owner đã tạo và thời gian tạo/cập nhật của mỗi QR. |

Kiểm tra nhanh migration đã tạo bảng sau khi khởi động Compose:

```bash
docker compose exec db psql -U dress -d dress_rental -c '\d qr_links'
```

Nếu chỉ cần chạy QR Admin sau khi backend đã sẵn sàng:

```bash
pnpm --filter qr-admin dev -- --port 5174
```

Tùy chọn, nếu không dùng Vite proxy, tạo `apps/qr-admin/.env` với:

```dotenv
VITE_API_BASE_URL=http://localhost:3000
```

## Lệnh thường dùng

| Lệnh | Mục đích |
| --- | --- |
| `pnpm contract` | Sinh OpenAPI từ backend và sinh lại client cho cả hai frontend sau thay đổi API. |
| `pnpm contract:check` | Kiểm tra contract/client không bị lệch với Git. |
| `pnpm check` | Build backend và kiểm tra TypeScript cho hai frontend. |
| `pnpm lint` / `pnpm arch` / `pnpm test` | Chạy lint, kiểm tra kiến trúc và test toàn workspace. |
| `pnpm build` | Tạo production build cho tất cả workspace. |
| `pnpm --filter fe e2e` | Chạy Playwright cho luồng chính; cần DB, backend và FE đang chạy. |
| `bash init.sh` | Chạy chuỗi kiểm tra đầy đủ của harness. |

Khi thay đổi API, luôn chạy `pnpm contract`; không chỉnh sửa trực tiếp
`packages/contract/openapi.json`, `apps/fe/src/api/generated/` hoặc
`apps/qr-admin/src/api/generated/`.

## Tài liệu dự án

- [Hướng dẫn làm việc cho agent](AGENTS.md)
- [Yêu cầu sản phẩm](docs/SRS-dress-rental.md)
- [Tactical design](docs/design/README.md)
- [Hợp đồng monorepo](docs/spec/init-monorepo-contract/README.md)

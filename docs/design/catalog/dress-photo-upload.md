# Upload ảnh váy thẳng lên Cloudflare R2 + tối ưu bằng Cloudflare Images — Feature Spec

## Header

| | |
| --- | --- |
| Bounded context | `catalog` — port mới `PhotoUploadSignerPort`, adapter R2 · package mới `packages/image-url` |
| Status | **as-built 2026-09-25** — duyệt sau 3 vòng hỏi đáp (§6); spike §7.1 xác nhận R2 thực thi header được ký; upload thật trên bucket dev qua trình duyệt (§8) |
| AC source | Chủ tiệm 2026-09-25: *"thêm chức năng upload ảnh lên R2 trong cms khi tạo váy hoặc sửa váy"*; vòng 2: *"upload thẳng từ cms react lên R2 không qua backend"* + *"dùng Cloudflare Images để optimize image khi lấy ra từ R2"*. FR đề xuất: **FR-CAT-10** (upload) + **FR-CAT-11** (phân phối ảnh tối ưu) |
| Rules approved by | Chủ tiệm — §6 "Đã chốt" |
| Contract approved by | Chủ tiệm 2026-09-25 |
| Liên quan | [public-listing.md](./public-listing.md) — form mẫu dùng lại ô ảnh · catalog-aggregate.md §Persistence ("Ảnh là LINK, không upload — ngoài phạm vi MVP") → dòng đó được thay khi as-built |

> Vì sao là design-tier: tích hợp hạ tầng mới (SDK S3 chỉ được nằm trong adapter — luật hexagonal),
> bí mật mới trên server, trình duyệt ghi thẳng vào storage (bề mặt bảo mật mới), một package dùng
> chung mới giữa `apps/fe` và `apps/web`, và một pattern tương tác FE mới (ô ảnh upload/sắp xếp).
> Không có aggregate/invariant DB mới — `photo_urls` giữ nguyên.

### "Không qua backend" — nghĩa chính xác

**Byte ảnh không đi qua BE**: trình duyệt `PUT` file thẳng lên R2. Nhưng để ghi được vào R2 phải có
chữ ký bằng secret key của bucket, và **secret đó không bao giờ được nằm trong bundle React** (ai mở
DevTools cũng lấy được → ghi/xoá toàn bucket). Vì vậy BE chỉ làm một việc nhỏ: **ký một URL tạm**
(presigned PUT, hết hạn sau 5 phút, chỉ cho đúng một key, đúng loại file, đúng dung lượng khai báo).
Không cần thêm Worker hay dịch vụ nào khác.

```text
CMS ── POST /photos/upload-urls {contentType, contentLength} ──▶ BE (ký, ~ms, không I/O mạng)
CMS ◀── { uploadUrl, headers, url } ──────────────────────────── BE
CMS ── PUT uploadUrl (byte ảnh, ~2 MB) ─────────────────────────▶ R2   (không qua VPS)
CMS ── POST/PATCH /dresses … photoUrls: [..., url] ─────────────▶ BE   (như hiện nay)
Web/CMS hiển thị: https://<img-domain>/cdn-cgi/image/width=…,format=auto/<key> ◀── Cloudflare Images
```

## 1. Glossary slice

| Term | Meaning | Notes |
| --- | --- | --- |
| URL tải lên (`uploadUrl`) | Presigned PUT tới R2 cho MỘT key, hết hạn 5 phút | BE ký bằng `@aws-sdk/s3-request-presigner`; không lưu gì |
| Ảnh gốc | File đúng như người dùng chọn (~2 MB), lưu ở R2, không thu nhỏ khi upload | chủ tiệm: ảnh ~2 MB/ảnh — giữ gốc, tối ưu lúc phát |
| URL ảnh | `<IMAGE_PUBLIC_BASE_URL>/<key>` — lưu vào `photo_urls` như mọi link | model dữ liệu không đổi |
| Biến thể (`variant`) | `<base>/cdn-cgi/image/width=<w>,quality=<q>,format=auto,fit=scale-down/<key>` — Cloudflare Images (Transformations) sinh và cache ở edge | chỉ áp cho URL thuộc `IMAGE_PUBLIC_BASE_URL`; link ngoài giữ nguyên |
| Ô ảnh (`PhotoListField`) | Component CMS: lưới thumbnail, **Tải ảnh lên** (chọn nhiều), **Thêm link**, đổi thứ tự, xoá; ảnh đầu = bìa | dùng ở form váy (tạo + sửa) và form mẫu công khai |
| Key | `photos/<yyyy>/<mm>/<uuid>.<jpg\|png\|webp>` | BE sinh; không dùng tên file của người dùng |

## 2. Use-case specification

```text
Use case: CreatePhotoUploadUrl (command, không ghi DB)
Actor: mọi nhân viên đã đăng nhập (policy `photo:upload` — ai tạo/sửa váy được thì tải ảnh được)
Trigger: POST /photos/upload-urls  { contentType, contentLength }  — FE gọi MỘT lần cho MỖI ảnh
Response: 201 { uploadUrl, method: 'PUT', headers: { 'Content-Type', 'Cache-Control' }, url, expiresAt }
  (Content-Length KHÔNG nằm trong headers: trình duyệt không được đặt header này — nó lấy từ
   `File.size`, nên FE phải PUT đúng File đã khai báo; R2 vẫn thực thi độ dài đã ký — spike 2026-09-25)

Flow:
  1. Guard photo:upload                                   → 403 envelope
  2. contentType ∉ {image/jpeg, image/png, image/webp}    → 400 envelope `PHOTO.UNSUPPORTED_TYPE`
     contentLength ≤ 0 hoặc > MAX_PHOTO_BYTES (10 MB)     → 400 envelope `PHOTO.TOO_LARGE` { maxBytes }
  3. Chưa cấu hình R2 (thiếu env)                          → 503 envelope `PHOTO.STORAGE_UNAVAILABLE`
  4. Sinh key; ký PUT với Content-Type + Content-Length là HEADER ĐƯỢC KÝ, hết hạn 300 s,
     Cache-Control `public, max-age=31536000, immutable` (key không bao giờ bị ghi đè)
  5. 201 — BE không lưu gì; URL không dùng thì hết hạn, không để lại rác

Phía CMS:
  a. Chọn file → kiểm tại chỗ loại + cỡ (cùng luật bước 2) → sai thì báo ngay, không gọi BE
  b. Xin uploadUrl → PUT file với đúng headers → 200 thì thêm `url` vào danh sách
  c. PUT lỗi (403 hết hạn / mạng) → nút thử lại: xin URL MỚI rồi PUT lại
  d. Nút **Lưu** của form khoá cho tới khi mọi ảnh đang tải xong
  e. Lưu váy: POST /dresses | PATCH /dresses/:id như hiện nay; link dán tay vẫn được

Domain rules:
  R1 Chỉ JPEG/PNG/WebP, ≤ 10 MB — kiểm ở CMS VÀ ở BE lúc ký VÀ ở R2 (Content-Type/Length là
     header được ký: file khác loại/khác cỡ khai báo → R2 từ chối chữ ký). Xác minh bằng spike (§7.1).
  R2 Secret R2 chỉ nằm ở BE (env); `@aws-sdk/*` chỉ được import trong adapter
     `r2-photo-upload-signer.adapter.ts` (depcruise).
  R3 Ký là tính toán cục bộ — không kết nối lúc boot, `openapi:emit` chạy không cần env R2;
     thiếu env → riêng endpoint này 503.
  R4 Tối đa 10 ảnh/váy (giữ `@ArrayMaxSize(10)` hiện có).
  R5 Xoá ảnh khỏi váy KHÔNG xoá file trên R2 (chủ tiệm chốt) — ảnh có thể đang dùng ở bản sao / mẫu.
  R6 Bucket chỉ nhận PUT từ origin CMS (CORS); đọc công khai qua custom domain.

Idempotency: không cần — mỗi lần xin URL là một key mới.
Concurrency: không có trạng thái chung.
```

### Outcome catalog

Không có từ chối **nghiệp vụ** — mọi lỗi là validation/kỹ thuật, đi envelope (ADR 0001 §2):

| Envelope code | HTTP | Khi nào | FE hiển thị (key) |
| --- | --- | --- | --- |
| `PHOTO.UNSUPPORTED_TYPE` | 400 | không phải JPEG/PNG/WebP | `media:errors.unsupportedType` — "Chỉ nhận ảnh JPG, PNG, WebP" |
| `PHOTO.TOO_LARGE` | 400 | > 10 MB | `media:errors.tooLarge` — "Ảnh quá lớn (tối đa 10 MB)" |
| `PHOTO.STORAGE_UNAVAILABLE` | 503 | chưa cấu hình R2 | `media:errors.storageUnavailable` + thử lại |
| (R2) 403 trên PUT | — | URL hết hạn / sai header | `media:errors.uploadFailed` + thử lại (xin URL mới) |

## 3. Phân phối ảnh — Cloudflare Images (Transformations)

Ảnh gốc ~2 MB không bao giờ được gửi thẳng cho khách. Cả web lẫn CMS hiển thị qua **biến thể** do
Cloudflare sinh ở edge từ ảnh gốc trong R2 (`format=auto` → AVIF/WebP theo trình duyệt).

| Nơi | Cách | Kích thước |
| --- | --- | --- |
| `packages/image-url` (MỚI, TS thuần, không dependency) | `imageUrl(src, { width, quality? }, { base })` → biến thể nếu `src` bắt đầu bằng `base`, ngược lại trả `src` nguyên vẹn (link cũ) | — |
| `apps/web` | `next.config` `images.loader: 'custom'` + `loaderFile` gọi `imageUrl` → **Next không tự tối ưu ảnh** (VPS 2 GB không phải gánh `sharp`) | `images.deviceSizes = [320, 640, 960, 1280, 1600]`, `imageSizes = [160]` — **tập width cố định** để số biến thể có giới hạn |
| `apps/fe` (CMS) | `PhotoThumbnail` / bảng váy / picker / chi tiết dùng `imageUrl(…, { width: 160 \| 640 })` | 160 (thumbnail), 640 (xem lớn) |
| Link cũ (không thuộc R2) | Giữ nguyên: web `unoptimized` cho ảnh đó, CMS hiện như hiện nay | — |

Chi phí: gói Free có 5.000 biến thể duy nhất/tháng; ~200 váy × ~5 ảnh × tối đa 6 width ≈ 6.000 trong
tháng đầu nếu MỌI width đều được xem — thực tế ít hơn nhiều, và biến thể đã sinh được cache. Vượt
thì ~0,5 USD/1.000. Tập width cố định là thứ giữ con số này có giới hạn.

## 4. UI state matrix — `PhotoListField` (form váy tạo/sửa; form mẫu)

| State | Condition | Display / action |
| --- | --- | --- |
| empty | 0 ảnh | ô kéo-thả / nút **Tải ảnh lên** + **Thêm link** |
| uploading | mỗi ảnh | thumbnail (object URL cục bộ) mờ + % tiến trình (XHR `upload.onprogress`) riêng từng ảnh; **Lưu** khoá |
| uploaded | PUT 200 | thumbnail qua biến thể 160; ←/→ đổi thứ tự, ✕ xoá; nhãn "Bìa" ở ảnh đầu |
| sai loại / quá cỡ | kiểm tại chỗ hoặc 400 | thumbnail đỏ + thông báo, nút xoá |
| upload lỗi | 503 / PUT 403 / mạng | thumbnail đỏ + **Thử lại** (xin URL mới) |
| limit | đủ 10 ảnh | ẩn nút tải lên, hiện "Tối đa 10 ảnh" |
| submit | form lưu | như hiện nay (`photoUrls` là mảng url) |

Vị trí: `apps/fe/src/components/media/` (cạnh `photo-thumbnail.tsx` đã có) — hai feature dùng chung,
không import chéo feature.

## 5. Cấu hình & hạ tầng (điều kiện tiên quyết — agent KHÔNG tự tạo trên Cloudflare)

| Mục | Cần | Ai |
| --- | --- | --- |
| Bucket R2 | dev: `dress-rental-dev-media` (đã có, account `82fb2b83…e839`) · prod: bucket riêng, vd `dress-rental-media` | chủ tiệm |
| Custom domain cho bucket | vd `img.example.com` — **phải nằm trên một zone Cloudflare** (§6.Q7) | chủ tiệm |
| Bật Transformations | Dashboard → Images → Transformations → bật cho zone đó | chủ tiệm |
| CORS bucket | `AllowedOrigins: https://cms.example.com, http://localhost:5173` · `AllowedMethods: PUT` · `AllowedHeaders: Content-Type, Cache-Control` | chủ tiệm (agent đưa JSON sẵn) |
| API token R2 | Object Read & Write, CHỈ bucket đó | chủ tiệm → `/root/.dress-secrets` |
| Env BE | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `IMAGE_PUBLIC_BASE_URL`, `MAX_PHOTO_BYTES` | agent: `.env.example` + validate config |
| Env FE / web | `VITE_IMAGE_BASE_URL`, `NEXT_PUBLIC_IMAGE_BASE_URL` (= `IMAGE_PUBLIC_BASE_URL`) | agent |

## 6. Owner decisions

### Đã chốt (chủ tiệm, 2026-09-25)

| # | Câu hỏi | Chốt |
| --- | --- | --- |
| 1 | Tài khoản Cloudflare / R2 | **Đã có** |
| 2 | Đường tải lên | **Thẳng từ CMS React lên R2**, không qua BE (BE chỉ ký URL — xem "nghĩa chính xác" ở trên) |
| 3 | Xoá ảnh khỏi váy có xoá file R2? | **Không xoá** |
| 4 | Ô dán link cũ | **Giữ** |
| 5 | Chuyển ảnh link cũ sang R2 | **Không** trong feature này |
| 6 | Cỡ ảnh | Ảnh thực tế **~2 MB/ảnh** → giữ ảnh gốc, giới hạn 10 MB, tối ưu lúc phát bằng **Cloudflare Images** |
| 7 | DNS `example.com` nằm trên Cloudflare? | **Có** |
| 9 | Phí Transformations nếu vượt 5.000 biến thể/tháng | **Chấp nhận** |
| 8 | Domain đọc ảnh công khai | **Custom domain**: `img.example.com` → bucket prod, `img-dev.example.com` → `dress-rental-dev-media`. URL `https://82fb2b83….r2.cloudflarestorage.com/dress-rental-dev-media` là **endpoint S3 API** (chỉ nhận request có chữ ký) — BE dùng để KÝ, không bao giờ lưu vào `photo_urls`; `r2.dev` không dùng (giới hạn tốc độ, không Transformations) |

### CORS cho bucket (R2 → bucket → Settings → CORS Policy)

```json
[
  {
    "AllowedOrigins": ["https://cms.example.com", "http://localhost:5173"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type", "Cache-Control"],
    "MaxAgeSeconds": 3600
  }
]
```

Bucket prod chỉ giữ `https://cms.example.com`. Đọc ảnh qua custom domain không cần CORS (`<img>` không phải request CORS).

## Contract check (02-contract-check.md) — chạy trên draft

| Severity | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- |
| ~~major~~ đóng | R2 có **thực thi** `Content-Length` được ký không? | R1 | **Spike 2026-09-25 (bucket dev): CÓ** — ký 1000 gửi 5000 → 403 `SignatureDoesNotMatch`; sai Content-Type → 403; URL hết hạn → 403 `ExpiredRequest`; CORS origin lạ → 403; Transformations `width=320` từ PNG 5,6 MB → AVIF 10,7 KB. Không cần dọn object quá cỡ |
| major (spike) | `Cache-Control` bị SDK coi là header KHÔNG ký → object lưu không có header, GET trả `max-age=14400` mặc định | §2 bước 4 | ký cả `cache-control` (`signableHeaders: content-type, content-length, cache-control`), trả nó trong `headers` để trình duyệt gửi đúng giá trị; **CORS `AllowedHeaders` phải có `Cache-Control`** (preflight thiếu → 403) |
| minor (spike) | SDK 3.11xx tự thêm `x-amz-checksum-crc32` vào URL ký | adapter | `requestChecksumCalculation: 'WHEN_REQUIRED'`; `forcePathStyle: true` |
| major | Trình duyệt ghi thẳng vào bucket: BE không đọc magic bytes nên file không-phải-ảnh có thể lên với `Content-Type: image/*` | R1 | chấp nhận (chỉ nhân viên đã đăng nhập xin được URL; R2 phục vụ đúng Content-Type đã ký; Transformations từ chối file không phải ảnh) + Transform Rule `X-Content-Type-Options: nosniff` trên domain ảnh |
| major | Ô ảnh dùng ở `features/dresses` VÀ `features/listings` — cấm import chéo feature | init-react | `PhotoListField` + hook upload ở `src/components/media/` |
| minor | Cross-app sharing chỉ qua `packages/*` — URL builder dùng ở fe VÀ web | Invariant #4 | `packages/image-url` (TS thuần), thêm vào arch check của cả hai app |
| minor | PUT lên R2 là request cross-origin ngoài mutator Orval (không phải API của ta) | §2 | helper upload riêng dùng XHR (cần progress), KHÔNG gắn bearer token |
| minor | Code envelope mới `PHOTO.*` → thêm vào ADR 0001 §3 + key vi/en | §2 | — |

Mục 1, 2 (response chỉ có URL + headers, không lộ bucket/secret), 5, 7 (chỉ thêm endpoint),
8: không có finding.

## 7. Kế hoạch triển khai (sau khi duyệt)

1. **Spike** (không commit code): ký một PUT bằng SDK với bucket dev → thử đúng / sai loại /
   lớn hơn khai báo / hết hạn; thử một URL `cdn-cgi/image` trên domain ảnh. Kết quả ghi vào §Contract check.
2. **BE**: port `PhotoUploadSignerPort` + adapter R2 + adapter `disabled` (thiếu env → 503);
   `POST /photos/upload-urls`; policy `photo:upload`; config validate; unit (luật loại/cỡ, key),
   e2e (201 shape + header được ký, 400 từng code, 403 không token, 503 khi thiếu env).
3. `pnpm contract`.
4. **`packages/image-url`** + test.
5. **CMS**: `PhotoListField` thay textarea link trong form váy (tạo + sửa); thumbnail qua biến thể;
   vitest (chọn 2 ảnh → 2 PUT → mảng đúng thứ tự; Lưu khoá khi đang tải; lỗi từng loại; thêm link).
6. Web dùng loader ở entry `web:public-catalog-live` (sau `catalog/public-listing`).

## 8. Re-sync as-built (2026-09-25)

Đã làm đủ §7.1–§7.5 trên nhánh `feat/dress-photo-upload`, merge vào master qua PR #15
(`50893c2`, 2026-09-26). Chỗ lệch so với spec và lý do:

| Chỗ lệch | Vì sao |
| --- | --- |
| `PHOTO.TOO_LARGE` mang `maxBytes` trong `error.details[0].maxBytes` (không phải `details { maxBytes }`); `ApiErrorDetailDto` thêm field tuỳ chọn `maxBytes` → cả ba client sinh lại | `details` của envelope dùng chung là MẢNG — không mở một shape envelope thứ hai cho một code |
| Response `headers` = `{ Content-Type, Cache-Control }`, không có `Content-Length` | trình duyệt không được đặt Content-Length; R2 vẫn thực thi độ dài đã ký (spike) |
| Hook upload ở `apps/fe/src/api/use-photo-uploader.ts`, truyền vào `PhotoListField` qua prop `upload` (không nằm trong `src/components/media/`) | ring kernel `src/components` không được import `src/api` (init-react 02 §4); luật file (loại/cỡ) + component vẫn ở kernel |
| Không có kéo-thả; nút "Tải ảnh lên" chọn nhiều file | đủ cho điện thoại/máy tiệm; kéo-thả thêm sau nếu cần |
| `libs/exceptions`: thêm `ServiceUnavailableException` (503) và cho subclass `ArgumentInvalidException` đặt code riêng | cần cho `PHOTO.*` |
| Config đọc ảnh: `VITE_IMAGE_BASE_URL` đóng vào lúc BUILD FE | build prod phải đặt `https://img.example.com` |

Guardrail mới: depcruise `aws-sdk-only-in-r2-adapter` (BE); fe arch (a3) XHR chỉ trong `src/api/`,
(g1) không tự dựng URL `cdn-cgi/image`, (g2) chỉ `src/lib/photo-url.ts` đọc `VITE_IMAGE_BASE_URL`.
Phát hiện kèm (chưa sửa): luật depcruise cũ neo `^node_modules/` (`domain-stays-pure`,
`commands-no-sql-driver`) không bao giờ khớp dưới pnpm (`../../node_modules/.pnpm/…`).

## 9. Sửa đổi 2026-09-29 — upload khi bấm Lưu, ký một lần, đọc ít hơn

Chủ tiệm 2026-09-29: *"khi submit form thì mới upload toàn bộ ảnh lên R2 và tối ưu lại luồng upload
và đọc dữ liệu trên R2 hiện tại đang bị lặp lại nhiều quá"*. Chốt 3 câu (cùng ngày): ký gộp một
request · có ảnh lỗi thì dừng, không lưu váy · link xem ảnh mở biến thể 1280.

Vấn đề của bản §8: chọn file là PUT ngay → đóng dialog / xoá ảnh vẫn để lại object rác trên R2
(R5 không bao giờ xoá); mỗi ảnh một `POST /photos/upload-urls`; upload xong ô ảnh bỏ preview cục bộ
và tải lại chính ảnh đó từ R2 (thêm một lần đọc + một biến thể); trang chi tiết hiện ô 112 px bằng
biến thể 640 và link mở ảnh gốc ~2 MB.

| Mục | Trước (§2, §4) | Sau |
| --- | --- | --- |
| Lúc upload | chọn file → ký + PUT ngay (CMS flow b) | chọn file → chỉ preview cục bộ, nhãn "Chờ lưu"; **Lưu** → upload rồi mới `POST/PATCH /dresses` |
| Ký URL | `{ contentType, contentLength }` → một URL, mỗi ảnh một request | `{ files: [{ contentType, contentLength }] }` (1–10) → `{ uploads: [...] }` cùng thứ tự; MỘT request mỗi lần Lưu. Một file sai → cả lô 400, `details[0].field = files.<i>.…` |
| Lỗi PUT | ảnh đỏ + nút **Thử lại** riêng | dừng, váy KHÔNG được lưu, toast; ảnh đã lên giữ URL, ảnh lỗi đỏ; bấm **Lưu** lần nữa chỉ ký + PUT lại ảnh lỗi |
| Ảnh sai loại/cỡ | đỏ + xoá | như cũ, và schema chặn Lưu tới khi xoá (`form.errors.photoInvalid`) |
| Nút Lưu (flow d) | khoá khi có ảnh đang tải | khoá trong lúc Lưu (`isSubmitting`), nhãn "Đang tải ảnh…"; danh sách ảnh chỉ-đọc trong lúc đó |
| Huỷ / đóng dialog | PUT đang chạy bị huỷ, ảnh đã lên thành rác | chưa có gì lên R2; đang upload lúc Lưu → huỷ PUT, không lưu váy; request POST/PATCH váy ĐÃ gửi thì không rút lại được → Huỷ/✕/Esc bị chặn tới khi có kết quả (Codex review PR #16, C1) |
| Ảnh vừa upload trong form | tải lại biến thể 160 từ R2 | giữ object URL cục bộ (`StoredPhoto.previewUrl`) — không đọc lại |
| Thứ tự | ảnh mới luôn nối sau ảnh cũ | ảnh cũ và ảnh chờ đổi chỗ chung một danh sách |
| Trang chi tiết | ô = biến thể 640, link = ảnh gốc | ô = biến thể **160** (trùng cache với danh sách), link = biến thể **1280** |
| Key React ô ảnh | `${index}-${url}` (đổi thứ tự = remount `<img>`) | id ổn định |

Code: BE `create-photo-upload-url/*` (DTO mảng, service kiểm hết rồi mới ký); FE
`components/media/photo-items.ts` (`PhotoItem`, `uploadLocalPhotos`), `photo-list-field.tsx` (không
còn upload), `api/use-photo-uploader.ts` (uploader theo lô, không bao giờ reject — kết quả từng
file), `features/dresses/components/dress-form-dialog.tsx` (bước upload trong `onSubmit`),
`lib/photo-url.ts` (`large` = 1280). CORS bucket không đổi (vẫn chỉ PUT).

As-built 2026-09-29: PR #16 → master `a1881f0` (Codex round 0 C1 — dismissal blocked while the dress request is in flight — fixed in `f94f458`). Not yet run against the real dev bucket in a browser.

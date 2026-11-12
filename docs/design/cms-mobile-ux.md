# CMS dùng tốt trên điện thoại — UX design (apps/fe)

## Header

| | |
| --- | --- |
| App | `apps/fe` (CMS nhân viên, `cms.example.com`) — không chạm BE, không đổi contract |
| Status | **as-built** 2026-11-12 (§6) · D1–D6 chủ tiệm chốt theo đề xuất 2026-11-12 (§3) · design 2026-11-11 — chủ tiệm yêu cầu "điều chỉnh và cải thiện UI/UX của phần cms và tương thích tối với giao diện điện thoại", làm và merge trong một lượt; các lựa chọn §3 do agent đề xuất, chủ tiệm chốt nguyên văn |
| Requirement | **NFR-06** (SRS §5) — CMS dùng được trọn vẹn trên điện thoại 360–414px |
| Rules approved by | bangnk 2026-11-12 (D1–D6 như đề xuất) |

> Vì sao là design-tier: đổi **pattern tương tác FE** dùng chung cho mọi màn hình — header/nav,
> bảng dữ liệu, dialog, kích thước chạm — chứ không phải một slice CRUD.

## 1. Hiện trạng (audit 2026-11-11, viewport 390px)

- Header một dòng không wrap (logo + 4–5 link + ngôn ngữ + đăng xuất ≈ 600px) → **cả trang tràn
  ngang**, kể cả trang đăng nhập.
- `PageHeader` để actions `shrink-0` → tiêu đề bị ép một chữ một dòng; thanh ngày của bảng hôm nay,
  header chi tiết váy/đơn tràn.
- `Dialog`/`AlertDialog` căn giữa, không `max-height`, không cuộn → dialog trả váy, huỷ có hoàn tiền,
  tạo nhân viên bị cắt khi bàn phím bật.
- Bảng (đơn thuê 6 cột, váy 9 cột, website, nhân viên) cuộn ngang trong khung riêng → nút hành động
  nằm ngoài màn hình.
- Nút mặc định 32–36px, nút ảnh 24px; nhãn nav ~20px — dưới mức 44px cho ngón tay.
- Hàng hành động thẻ "Giao váy" trên bảng hôm nay tràn sang **trái** (không cuộn tới được).
- Không có safe-area (`viewport-fit=cover`) cho PWA standalone; prompt cập nhật PWA đè toast.

## 2. Nguyên tắc

1. **Một DOM** cho mọi kích thước — chỉ đổi bằng class responsive. Không render song song
   bảng + `md:hidden` thẻ, không hai nav: jsdom không áp Tailwind nên test sẽ thấy hai bản, và
   Playwright `getByText(...).toHaveCount(n)` đếm cả node ẩn. Role/tên accessible giữ nguyên.
2. Sửa ở **kernel trước** (`components/ui/*`, `components/layout/*`) để mọi màn hình hưởng một lần;
   feature chỉ opt-in.
3. Desktop (≥ `md`) không đổi về bố cục; thay đổi kích thước chạm chỉ áp cho `pointer: coarse`.

## 3. Quyết định (agent đề xuất — chủ tiệm chốt nguyên văn 2026-11-12)

Quyết định bởi chủ tiệm (bangnk) 2026-11-12: *"Chốt theo đề xuất"* (cùng lý do với E1–E5 của rental-form-ux: *"đây chỉ là thay đổi giao diện nên cũng có thể rollback dễ không cần tôi check kĩ"*). Đổi một dòng dưới đây từ nay là việc mới.

| # | Quyết định | Phương án bị loại | Chỗ sửa nếu chủ tiệm bác |
| --- | --- | --- | --- |
| D1 | **Nav**: header giữ một khối, **dính trên đầu (sticky)**; dưới `md` nav xuống dòng riêng thành dải link cuộn ngang, mỗi link cao ≥ 44px | Thanh tab dưới đáy; menu hamburger (thêm một lần chạm, ẩn vị trí hiện tại) | `app/layouts/root-layout.tsx` |
| D2 | **Bảng** dưới `md` (768px) hiển thị mỗi hàng thành **khối xếp chồng** (nhãn cột in nhỏ phía trên giá trị), hành động thành hàng nút đầy đủ; cùng một `<table>` (opt-in `stacked` của kernel `Table`) | Danh sách thẻ riêng cho mobile (DOM đôi); giữ cuộn ngang | `components/ui/table.tsx` + từng `*-table.tsx` |
| D3 | Bảng váy trên điện thoại **ẩn cột Danh mục và Tiền cọc** (vẫn xem được ở chi tiết váy) | Hiện đủ 9 trường | `features/dresses/components/dress-table.tsx` |
| D4 | **Dialog** không vượt quá chiều cao màn hình (`100dvh` trừ lề), nội dung cuộn bên trong; nút đóng X 44px. Không đổi sang bottom-sheet | Bottom-sheet trên điện thoại | `components/ui/dialog.tsx`, `alert-dialog.tsx` |
| D5 | **Vùng chạm**: trên màn hình cảm ứng (`pointer: coarse`) mọi nút/ô chọn tối thiểu 44px; desktop giữ kích thước cũ | Phóng to cho mọi thiết bị | `components/ui/button.tsx`, `select.tsx` |
| D6 | **PWA/safe-area**: `viewport-fit=cover` + inset đáy cho prompt cập nhật và toast; toast chuyển lên **giữa trên** trên điện thoại | Giữ góc dưới phải | `index.html`, `components/feedback/pwa-update-prompt.tsx`, `components/ui/sonner.tsx` |

## 4. UX flow / URL state / invalidation

Không đổi: không route mới, không query key mới, không mutation mới, URL state các bộ lọc giữ
nguyên (`use-rental-filters`, bộ lọc váy). Chỉ bố cục.

## 5. Proof

- vitest toàn bộ giữ xanh (một DOM ⇒ test hiện có không phải sửa locator).
- Playwright **project `phone`** (Chromium, viewport Pixel 7 — CI chỉ có Chromium) chạy spec
  `e2e/phone-layout.spec.ts`: đăng nhập, mở từng màn hình chính, khẳng định
  `document.documentElement.scrollWidth <= innerWidth` và nav chạm tới được; CI job `e2e` chạy nó.

## 6. As-built 2026-11-12

- Kernel: `root-layout` (header sticky, nav thành dải cuộn ngang dưới `md`, link ≥ 44px, gạch chân
  trang hiện tại), `page-header` (xếp chồng dưới `sm`), `dialog`/`alert-dialog`
  (`max-h-[calc(100dvh-2rem)]` + cuộn, X 44px), `button`/`select`/`input` (`pointer-coarse:` 44px),
  `table` (`<Table stacked>` + `TableCell label|stack`, role tường minh để Safari không mất ngữ nghĩa
  bảng), `sonner` (giữa-trên dưới 768px, đo một lần lúc tải), `pwa-update-prompt`, `index.html`
  (`viewport-fit=cover`, meta standalone, apple-touch-icon có sẵn).
- Feature: bảng đơn thuê, váy (3 cột trên điện thoại; D3 ẩn Danh mục + Cọc), website, váy-của-mẫu,
  nhân viên, lịch sử giá đều `stacked`; thanh ngày + hàng nút thẻ bảng hôm nay wrap (hết tràn trái);
  dress picker 2 dòng (giá không bị cắt); bộ lọc full-width; chi tiết váy/đơn header wrap; ô ảnh 112px
  trên cảm ứng (144px để 3 nút 44px vừa dưới ảnh); nút xoá mẫu bị khoá hiện lý do bằng chữ (thay `title`).
- Bàn phím (Codex review vòng 0, C3): viewport `interactive-widget=resizes-content` — trên Android
  Chrome bàn phím thu nhỏ layout viewport nên `100dvh` co theo và nút cuối dialog vẫn tới được.
  iOS Safari bỏ qua thuộc tính này; ở đó trình duyệt tự cuộn ô đang nhập vào tầm nhìn, nội dung
  dialog vẫn cuộn được — chưa thử trên máy iOS thật.
- Proof: Playwright `phone` 14/14 + `chromium` happy path 1/1 (local, DB tạm); vitest toàn bộ xanh
  không đổi locator (trừ test lý do-xoá: `getByTitle` → `toHaveAccessibleDescription`).
- Còn để ngỏ: safe-area trái/phải khi xoay ngang iPhone có tai thỏ; toast không đổi vị trí khi xoay.

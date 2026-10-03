# web/search-dresses — Tìm mẫu trên Bộ sưu tập

> Status: **as-built 2026-10-02 — chủ tiệm duyệt trước khi code** · SRS: FR-WEB-06
> Tier: **design** (tương tác tìm kiếm + URL state mới) · Ledger: `web:search-dresses`
> Phạm vi đã duyệt: tên mẫu + mô tả ngắn (`tagline`), debounce 300 ms.

## 0. UX flow

Khách mở `/bo-suu-tap`, nhập từ khóa vào ô tìm phía trên chip loại váy; danh sách
lọc tại trình duyệt sau **debounce 300 ms** kể từ lần gõ cuối. Ô nhập phản hồi ngay. Có thể chọn loại để thu hẹp kết quả; từ khóa và loại kết hợp AND.
Nhấn nút xóa từ khóa giữ nguyên loại đang chọn; nhấn bỏ toàn bộ bộ lọc trở về mọi mẫu.
Nhấn thẻ mở chi tiết như hiện tại. Tìm kiếm áp dụng trên trang Bộ sưu tập đầy đủ.

```text
Bộ Sưu Tập
[ Tìm theo tên mẫu hoặc mô tả ngắn…             × ]
[ Tất cả ] [ Váy ngắn ] [ Váy lụa ] [ Áo dài ] …
Tìm thấy N mẫu
[ thẻ mẫu ] [ thẻ mẫu ] …
```

Ô tìm chiếm toàn chiều rộng trên mobile; chip và grid giữ layout hiện tại.
Nhãn input dùng `catalog.search.label`, placeholder chỉ là gợi ý; nút xóa có tên accessible,
vùng bấm 44px; thông báo số kết quả có `role="status"`. Giữ focus input khi gõ/xóa.
Màu, chữ, khoảng cách dùng token hiện có; icon từ lucide-react; copy qua next-intl.

## 1. Routes & URL state

Route hiện có `/[locale]/(public)/bo-suu-tap`, anonymous.
URL chứa `q` (từ khóa) và `style` (mã chip); bỏ tham số rỗng/default `all`.
Mở link có tham số khôi phục tìm kiếm; reload và Back/Forward khôi phục đúng bộ lọc.
Sau debounce, cập nhật từ khóa đã áp dụng lên URL bằng replace để không tạo một bước history cho mỗi ký tự; không điều hướng
RSC hay gọi API mỗi lần gõ. Giữ các query parameter không thuộc search khi cập nhật.
Loại không hợp lệ được xử lý như `all`. URL là trạng thái có thể chia sẻ;
input giữ giá trị đang nhập (`draftQuery`), còn URL và kết quả dùng từ khóa đã áp dụng (`appliedQuery`).
Hai giá trị có thể khác nhau trong cửa sổ debounce; không lưu bản sao catalogue.

## 1a. Rendering & caching

`/bo-suu-tap` giữ ISR 300 giây, chủ cache là Next Data Cache với tag `public-dresses`.
Page Server Component tiếp tục gọi `listPublicDresses()` một lần; `CatalogBrowser`
là client leaf nhận DTO rồi đọc URL sau hydration và lọc tại chỗ. Server page không đọc
`searchParams`, nên URL search không tạo một chế độ render động mới.
HTML trước hydration chứa catalogue đầy đủ; link có từ khóa áp dụng bộ lọc sau hydration.
Canonical vẫn `/bo-suu-tap`; không thêm trang search vào sitemap; metadata hiện tại giữ nguyên.
Không có mutation hay thay đổi chính sách revalidation (CMS vẫn có độ trễ hiện tại).

## 2. Data map & quy tắc khớp

Dùng `listPublicDressesHttpControllerList` qua cửa server-only `src/api/public-catalog.ts`.
Không thêm API/field: summary có `name` và `tagline`, không có mô tả dài hay mã váy vật lý.
Không fetch chi tiết từng mẫu để tìm kiếm. Catalogue không truyền limit trên route này.

Chuẩn hóa tên, tagline và từ khóa: Unicode decomposition, bỏ dấu kết hợp,
`đ/Đ` → `d`, chữ thường, trim và tách từ theo whitespace.
Mỗi từ phải xuất hiện trong tên hoặc tagline, không phân biệt thứ tự; ví dụ
`AO DAI` khớp `Áo dài`, `dam do` khớp tên `Đầm đỏ`.
Tìm substring literal, không regex từ input. Từ khóa rỗng/toàn khoảng trắng giữ toàn bộ
kết quả của chip. Giữ thứ tự catalogue BE trả về. Không tìm trong slug hay field nội bộ.

| Ràng buộc | Cơ chế enforcement | Proof dự kiến |
| --- | --- | --- |
| Chỉ mẫu trong catalogue công khai được tìm thấy | Filter thuần trên DTO props từ endpoint public; không đọc endpoint staff | Unit: kết quả là tập con input; RTL: chỉ card từ fixture props |
| Search và chip cùng áp dụng | Một pipeline derive kết quả từ `q` + `style`, không giữ result state riêng | Unit + RTL: đổi chip khi có từ khóa, xóa từ khóa vẫn giữ chip |
| Xóa lọc không thay đổi dữ liệu gốc/thứ tự | Filter thuần, không mutate props | Unit: thứ tự ổn định và input không đổi |
| Debounce không áp dụng từ khóa cũ sau thao tác mới | Hủy timer trước mỗi lần gõ, xóa, reset, đổi chip, navigation và unmount | RTL fake timers: gõ liên tiếp chỉ áp dụng lần cuối sau 300 ms; clear/navigation không bị timer cũ ghi đè |
| URL và UI đồng bộ khi Back/Forward | Một adapter URL với cập nhật và subscription navigation; default xác định | RTL: link ban đầu, URL update, navigation khôi phục, query lạ vẫn được giữ |

Đây là read/filter UI thuần, không có bất biến DB mới và không có business rejection;
không cần outcome catalog hoặc lane init-feature-spec.

## 3. Interaction state machine

Trạng thái gồm catalogue props, từ khóa đang nhập, từ khóa đã áp dụng và loại; grid/count
là dẫn xuất từ từ khóa đã áp dụng + loại:
- `idle`: từ khóa rỗng, lọc theo chip.
- `debouncing`: input đổi ngay; grid/count và URL giữ từ khóa đã áp dụng trong 300 ms.
- `matched`: từ khóa có ít nhất một kết quả.
- `no-match`: không có kết quả cho bộ lọc hiện tại; có hành động xóa từ khóa/bỏ bộ lọc.

Gõ lại hủy timer cũ và bắt đầu 300 ms mới; timer hết hạn áp dụng giá trị cuối lên grid/count và URL.
Enter áp dụng ngay từ khóa đang nhập. Đổi chip hủy timer, áp dụng ngay từ khóa đang nhập
và chip mới. Xóa/reset hủy timer và áp dụng ngay (xóa giữ chip; reset về `all`).
Back/Forward hoặc mở link khôi phục cả hai giá trị ngay, hủy timer đang chờ; unmount cũng hủy timer.
Không có submitting, request race, optimistic update hay server mutation.
Chỉ hiện nút xóa khi input có giá trị.

## 4. Screen states & error policy

- Count: `catalog.search.count` → “Tìm thấy {count} mẫu”, vùng status polite.
- Không khớp: `catalog.search.empty` → “Không tìm thấy mẫu phù hợp. Thử từ khóa khác nhé.”
- Bỏ mọi lọc: `catalog.search.reset` → “Bỏ bộ lọc”.
- Catalogue gốc rỗng: `catalog.search.catalogEmpty` → “Bộ sưu tập đang được cập nhật. Nhắn Zalo để được gợi ý nhé.”
- Gõ tại client không phát sinh loading/network error; lỗi tải catalogue vẫn đi qua error boundary
  hiện có. Build khi BE unreachable và runtime cache giữ chính sách hiện tại.

## 5. Form ↔ DTO mapping

Input `q` ánh xạ tới tìm substring trong `PublicDressSummary.name` và `.tagline`.
Chip `style` ánh xạ tới `styles` theo `filterDresses` hiện có. Không body request,
không Server Action, không store mới. Nội dung mô tả dài và mã váy không thuộc bản đề xuất này.

## 6. Acceptance & proof plan

- AC1: Tìm tên + tagline, không phân biệt hoa thường/dấu, kể cả đ; nhiều từ, whitespace,
  từ khóa không khớp và ký tự đặc biệt xử lý đúng (unit filter).
- AC2: Tìm kiếm kết hợp chip; xóa từ khóa giữ chip, bỏ mọi lọc trả lại catalogue (RTL).
- AC3: Chia sẻ/reload URL và Back/Forward khôi phục bộ lọc; không gọi API lúc gõ (RTL + runtime).
- AC4: Count, empty, catalogue rỗng và keyboard/accessibility hoạt động trên mobile/desktop (RTL + runtime).
- AC6: Debounce 300 ms: input đổi ngay, grid/count/URL giữ nguyên trước hạn; gõ liên tiếp
  chỉ áp dụng giá trị cuối. Enter, clear/reset, đổi chip và navigation áp dụng ngay, hủy timer cũ;
  unmount không cập nhật state/URL trễ (RTL fake timers).
- AC5: ISR/canonical giữ đúng; không sửa generated clients (web build route table + runtime HTML + git diff).

Sau khi duyệt: kiểm baseline `bash init.sh`; triển khai một entry, chạy gates theo root AGENTS.md,
ít nhất web check/lint/arch/test/build và runtime `pnpm --filter web start`.
Chưa có Playwright cho web (apps/web/AGENTS.md deviation #4); ghi rõ runtime proof của
URL/SEO/rendering, không coi unit test là bằng chứng RSC.

## 7. Scaffold INPUT CONTRACT (từ thiết kế đã duyệt)

```yaml
feature: catalog
capability: search-public-dresses
segments: /[locale]/(public)/bo-suu-tap
rendering: ISR 300s; Next Data Cache tag public-dresses; client filtering
apiTags: [catalog]
operations: [listPublicDressesHttpControllerList via listPublicDresses server door]
useCaseSpec: none — pure public read/filter, no business rejection
outcomes: []
form: search input q (string), style chip (StyleFilter); no request body
clientState: draftQuery local; appliedQuery and style in URL; debounce 300ms
i18nNamespace: catalog.search
guard: public
seo: catalog.meta.title/description; canonical /bo-suu-tap; existing sitemap
isNewFeature: false
```

## 8. As-built 2026-10-02

- Chủ tiệm duyệt thiết kế kèm debounce rồi yêu cầu triển khai trước khi entry vào in-progress.
- `CatalogBrowser` thêm ô search, count/live region, clear/reset và phân biệt catalogue rỗng
  với không khớp; `useCatalogSearch` quản lý input/applied query, timer và native URL history.
  Gõ/Enter/clear dùng replace; chọn chip/reset tạo history entry để Back/Forward có thể khôi phục.
- Filter thuần trên name/tagline kết hợp chip, không thêm API, không đổi generated clients.
  URL được khôi phục sau hydration; grid server vẫn đầy đủ. Home featured collection giữ hành vi hiện có.
- Proof: web Vitest 44/44 (11 test mới); root contract:check/check/lint/arch/test và build
  FE/QR-admin đều xanh. Chromium chạy trên production next start với 8 fixture summaries:
  Back/Forward thật, reload, Enter, clear/reset, timer cancellation, link chi tiết, canonical,
  cached full HTML và viewport 390/768/1440px đều pass, không lỗi browser.
- Build route table: `/vi/bo-suu-tap` vẫn prerendered, revalidate 5m.
  Default Turbopack build bị giới hạn cổng nội bộ trong môi trường; webpack build với
  network permission để tải fonts exit 0. Không đổi build config của repo.
- `bash init.sh` baseline chạy tới web build; các gate trước đó xanh; invariant e2e có
  WARN skip vì không có compose PostgreSQL. Không có BE thay đổi trong slice này.
  Runtime dùng API fixture, chưa kiểm tra hoặc deploy trên production.

### Follow-up as-built 2026-10-03 — Featured → collection

Chủ tiệm yêu cầu đổi CTA của Bộ Sưu Tập Nổi Bật thành “Xem thêm” và giữ loại đã chọn.
FeaturedCollection truyền `style` qua link `/bo-suu-tap?style=<code>`; `all` dẫn
`/bo-suu-tap` không tham số. Trang Bộ sưu tập dùng URL restoration hiện có, kể cả reload.
Mechanical follow-up, không có URL contract/interaction pattern mới. Ledger `web:featured-filter-link`.
Proof: web test 44/44 (cập nhật assertions short/ao-dai/all), check/lint/arch xanh;
Chromium click-through trên dev server đang chạy xác nhận short/ao-dai/all + reload.
Generated layers không đổi; chưa deploy.

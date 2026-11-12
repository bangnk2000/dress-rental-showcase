# Form tạo / sửa đơn thuê — bố cục mới (apps/fe)

## Header

| | |
| --- | --- |
| App | `apps/fe` — `/rentals/new` và `/rentals/:id/edit` (một `components/rental-form.tsx`); không chạm BE, không đổi contract |
| Status | **as-built** 2026-11-12 · **approved** P1–P4 — chủ tiệm 2026-11-12: *"làm luôn theo đề xuất của bạn"* · E1–E5 chủ tiệm chốt theo đề xuất 2026-11-12 (§3) |
| Requirement | FR-RENT-01 (tạo đơn), FR-RENT-13 (sửa đơn), FR-RENT-14 (tiền khi đặt), NFR-06 (điện thoại) |

> Vì sao là design-tier: pattern tương tác FE mới — bảng tóm tắt dính cạnh (PC) / thanh tóm tắt cố định
> đáy (điện thoại) giữ nút gửi form. Logic form, outcome catalog và invalidation KHÔNG đổi.

## 1. Vấn đề (form trước 2026-11-12)

- PC: một cột `max-w-2xl`, nửa phải trống; các trường nối thành một dải không nhóm.
- Tiền rải rác: tạm tính + giảm giá ở cuối danh sách váy, tiền thuê + cọc ở khối khác bên dưới —
  báo giá cho khách phải cuộn lên xuống.
- Điện thoại: form dài, nút "Tạo lượt thuê" ở tận cuối, không thấy số khách phải trả khi đang nhập;
  ghi chú là ô một dòng; không thấy số ngày thuê.

## 2. Quyết định của chủ tiệm (approved)

| # | Quyết định |
| --- | --- |
| P1 | Form chia 4 khối có tiêu đề: **Khách hàng** · **Ngày thuê** (hiện số ngày, gợi ý thời gian vệ sinh cạnh đó) · **Váy** · **Thanh toán** (giảm giá, tiền thuê, cọc, ghi chú nhiều dòng) |
| P2 | PC: form cột trái, **bảng tóm tắt dính khi cuộn** cột phải — váy đã chọn, tạm tính, giảm giá, khách trả, tiền cọc, nút Tạo/Lưu |
| P3 | Điện thoại: **thanh cố định dưới đáy** hiện số khách trả + nút gửi, chạm để mở chi tiết tính tiền |
| P4 | Logic giữ nguyên (kiểm tra lịch trống, rejection, cọc khi giao); không đổi BE/contract |

## 3. Chi tiết do agent đề xuất — chủ tiệm chốt nguyên văn 2026-11-12

Quyết định bởi chủ tiệm (bangnk) 2026-11-12: *"làm như bạn đề xuất đi đây chỉ là thay đổi giao diện nên cũng có thể rollback dễ không cần tôi check kĩ"*. Đổi một dòng dưới đây từ nay là việc mới, không phải sửa doc.

| # | Mặc định | Chỗ sửa nếu bác |
| --- | --- | --- |
| E1 | Hai cột từ `lg` (1024px); dưới `lg` tóm tắt thành thanh đáy — tablet dọc cũng dùng thanh đáy | `rental-form.tsx` (class `lg:`) |
| E2 | Thanh đáy: "Khách trả" + số váy + nút gửi; chi tiết tính tiền mở/đóng ngay trên thanh (disclosure, không phải dialog) | `rental-summary.tsx` |
| E3 | Số ngày thuê tính **bao gồm cả hai đầu** (FR-RENT-01: khoảng ngày inclusive) — 12→14 = 3 ngày | `rental-form.tsx` |
| E4 | Nút "Huỷ" nằm cùng nút gửi trong khối tóm tắt; trên điện thoại nằm trong phần chi tiết mở rộng | `rental-summary.tsx` |
| E5 | Ghi chú đổi từ ô một dòng sang ô nhiều dòng (`Textarea`), vẫn tuỳ chọn | `rental-form.tsx` |

## 4. Ràng buộc kỹ thuật

- **Một DOM** (apps/fe/AGENTS.md §Screen rules): khối tóm tắt là MỘT phần tử — PC thì `lg:sticky`
  trong cột phải, điện thoại thì `fixed bottom-0`; không render hai bản. Chỉ có MỘT nút submit
  (tên giữ nguyên "Tạo lượt thuê" / nhãn lưu của edit) nằm trong `<form>`.
- Nhãn trường giữ nguyên (e2e happy path + vitest dùng `getByLabel`).
- Thanh đáy không che nội dung: form có padding đáy bằng chiều cao thanh + safe-area; không đè toast/PWA prompt.
- Số tiền trên tóm tắt là con số người dùng KHÔNG gõ → hiện phép tính (tạm tính − giảm giá = khách trả;
  cọc tách riêng), đúng screen rule.

## 5. Proof

- vitest rentals xanh, locator không đổi (trừ chỗ tổng tiền chuyển vào tóm tắt — ghi rõ trong PR).
- Playwright `phone`: form tạo đơn không tràn ngang; thanh đáy luôn trong màn hình, nút gửi ≥ 44px và
  bấm được khi đang ở đầu form; mở chi tiết thấy phép tính. Desktop: tóm tắt nằm cột phải, vẫn thấy sau
  khi cuộn xuống cuối form. Happy path desktop vẫn xanh.

## 6. As-built (2026-11-12)

Shipped as designed (P1–P4, E1–E5) in `apps/fe/src/features/rentals/components/rental-form.tsx` +
`rental-summary.tsx`: one summary element (`lg:sticky` right column / `fixed bottom-0` bar), breakdown behind an
`aria-expanded` toggle, form-level rejection shown next to the submit, submit-time field errors scroll to and focus
their field (`lib/form-field-ids.ts`), PWA update prompt lifted above the bar. Proof: ledger `fe:rental-form-ux` evidence.

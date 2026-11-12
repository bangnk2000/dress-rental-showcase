# Version cho mỗi lần deploy + rút về nhanh (infra/deploy)

## Header

| | |
| --- | --- |
| Phạm vi | `.github/workflows/deploy.yml` + workflow mới `rollback.yml`, `infra/deploy/*.sh`, `infra/deploy/remote/build-remote.sh`, nhãn version trong `apps/fe` (build-time). Không chạm BE source, không đổi contract, không migration |
| Status | **draft — chờ chủ tiệm duyệt** · O1–O6 chủ tiệm chọn 2026-11-12 · A1–A9 là agent-default (bác được từng dòng) |
| Requirement | NFR-07 (mới, cùng PR với doc này) |
| Ledger | `infra/deploy-versioning`, `tier: design`; A1–A9 + xác nhận gốc `v1.0.0` là `ownerPending` của entry (`node scripts/ledger.mjs pending`). Code bắt đầu sau khi form đơn thuê mới xong (một entry đang làm mỗi lúc) |

> Vì sao là design-tier: đổi cách rollback production hoạt động (state mới trên VPS: slot build trước,
> lịch sử deploy) và thêm một luồng vận hành mới (workflow `rollback`). Sai ở đây là sai lúc đang có sự cố.

## 1. Hiện trạng (master `6a66546`, 2026-11-12)

- **Không có version.** Repo không có git tag nào. `/opt/dress-rental/.deployed` chỉ giữ SHA của lần deploy
  đầy đủ gần nhất và bị **ghi đè** mỗi lần — trên VPS không còn lịch sử. Muốn biết "hôm qua chạy bản nào"
  phải lục Actions hoặc dòng Production (sửa tay) trong `AGENTS.md`.
- **Rollback = build lại.** `infra/deploy/README.md` §Rollback: chạy `deploy` với `ref=<SHA cũ>, only=all`.
  Nghĩa là pnpm install + nest build trên VPS (API dừng 1–2 phút), Vite build, `next build` prerender từ
  catalogue thật — vài phút, và hỏng được theo đúng những cách một lần deploy tiến có thể hỏng.
- **Bản build cũ bị huỷ chủ động:** `fe.sh` `rm -rf dist.old`, `web.sh` `rm -rf run.old`; BE có
  `deleteOutDir: true` nên `nest build` xoá `apps/be/dist` trước khi build.
- Rollback qua migration: `plan.sh` đã **từ chối** (build-remote chỉ migrate lên) — giữ nguyên quy tắc này.

## 2. Quyết định của chủ tiệm (2026-11-12)

| # | Quyết định |
| --- | --- |
| O1 | Version kiểu **SemVer `vX.Y.Z`**, là git tag (annotated) gắn lên SHA vừa deploy thành công |
| O2 | Số version: workflow có input **`bump: patch\|minor\|major`, mặc định `patch`**, tính từ tag cao nhất. Quy ước: có migration hoặc tính năng mới → `minor`; chỉ sửa lỗi/UI → `patch`; thay đổi lớn → `major` |
| O3 | Bản đầu tiên: **`v1.0.0` = production hiện tại `1067bc1`** (tag tay một lần, xem §6 bước 1) |
| O4 | Rút về nhanh (không build) cho **FE + web luôn; BE có điều kiện** (§3.4) — không đủ điều kiện thì quay về đường build lại |
| O5 | Giữ **2 bản** trên VPS: bản đang chạy + 1 bản trước |
| O6 | Hiện version trong **CMS (`apps/fe`), nhúng lúc build** — không thêm endpoint BE |

## 3. Thiết kế

### 3.1 Tính version (trong bước Plan, trước mọi build)

```
EXISTING = tag v* đã trỏ vào TARGET_SHA (lấy cao nhất)    # deploy lại / quay về một bản đã có tên
LATEST   = tag vX.Y.Z cao nhất toàn repo (sort -V)        # không chỉ tổ tiên: v1.3.0 → rút về v1.2.0 → bản sửa = v1.3.1
nếu EXISTING           → VERSION = EXISTING, mint = false
nếu record = false     → VERSION = LATEST+<sha7>, mint = false   # run một phần: không được có tên
ngược lại              → VERSION = bump(LATEST, input bump), mint = true
không có tag v* nào    → dừng, báo "tag v1.0.0 trước" (không tự bịa gốc)
```

`VERSION` ra `$GITHUB_OUTPUT`, được fe.sh / be.sh / web.sh ghi vào metadata của bản build (§3.3).

### 3.2 Ghi nhận (bước Record, chỉ khi mọi bước + verify đã xanh)

1. `.deployed` — giữ nguyên dòng cũ, **thêm `version=<VERSION>` ở cuối**. `deployed_sha()` (regex `^sha=`) và
   WSL `status.sh` (chỉ `cat`) vẫn đọc được.
2. `.deploy-history` (mới, chỉ append, một dòng mỗi lần):
   `version= sha= kind=deploy|rollback parts=be,fe,web date= by= run=`.
3. Nếu `mint`: `git tag -a vX.Y.Z <TARGET_SHA> -m "<run url, parts>"` + `git push origin vX.Y.Z`, rồi
   `gh release create vX.Y.Z --generate-notes --notes-start-tag <version trước>` (A6).
   Tag + release chạy ở **job riêng `tag`** (`needs: deploy`, `permissions: contents: write`); job `deploy` giữ
   `contents: read` và checkout `target/` với `persist-credentials: false` — để script lifecycle của
   `pnpm install` trên cây target không bao giờ chạm được token có quyền ghi. Push tag không kích hoạt `ci`
   (ci chỉ `push: branches: [master]`). Job `tag` đỏ sau khi deploy đã sống → lời nhắn "production đã chạy
   vX, tag tay", không rollback.
4. Mỗi `.built` và mỗi dòng history ghi thêm `ops=<github.sha>` — commit của script đã deploy bản đó (khác
   `sha=` khi rollback/deploy một target cũ hơn workflow). §3.4 cần nó.

### 3.3 Slot: bản đang chạy + 1 bản trước (O5)

| Phần | Đang chạy | Bản trước | Metadata trong mỗi slot |
| --- | --- | --- | --- |
| FE | `apps/fe/dist` (nginx `root`) | `apps/fe/dist.prev` | `version.json` `{version, sha, date}` |
| Web | `apps/web/run` (pm2 `dress-web` cwd) | `apps/web/run.prev` | `.built` (đã có) + `version=` |
| BE | `apps/be/dist` (pm2 `dress-api`) | `apps/be/dist.prev` | `dist/.built` `sha= version= lock=<sha256 pnpm-lock.yaml>` |

- FE/web: thay `rm -rf X.old` bằng `rm -rf X.prev && mv X X.prev && mv X.new X`. Đường dẫn nginx/pm2 không đổi
  → không phải sửa `serve.sh` hay nginx.
- BE: `build-remote.sh` `mv dist dist.prev` **trước** `nest build` (thay cho deleteOutDir xoá mất). Bonus: nest
  build hỏng → `mv dist.prev dist` và khởi động lại API như cũ thay vì để API chết (chỉ khi chưa migrate).
  be.sh truyền `TARGET_SHA VERSION OPS_SHA` vào `bash -s`; chạy từ WSL `build.sh` không có biến → `sha=unknown`
  (slot đó không rút nhanh được, an toàn).
- Deploy lại đúng SHA đang chạy (`only=all` cùng target) **không xoay slot** của phần có `sha=` trùng target
  — nếu không, `.prev` thành bản sao của bản hiện tại và mất đường rút.

### 3.4 Workflow `rollback` (nút bấm khi có sự cố)

Actions → **rollback** → Run (không có input bắt buộc). Cùng `concurrency: group: deploy-production`,
`cancel-in-progress: false` với `deploy` — bấm khi một lần deploy đang chạy thì **xếp hàng sau nó**, không
bao giờ đổi slot song song.

"Hiện tại" đọc từ **metadata của từng slot đang chạy**, không từ history. Đích **T**:

- có slot đang chạy **mới hơn** `.deployed` (deploy đỏ giữa chừng: BE đã đổi + migrate, web/verify hỏng nên
  chưa ghi history) → **T = `.deployed`** (bản tốt cuối cùng);
- ngược lại → **T = dòng history ngay trước dòng cuối** (bản chạy ngay trước bản hiện tại).

Quyết định toàn bộ **trước** khi đụng vào bất cứ thứ gì:

1. Khoảng giữa T và **`sha=` của slot BE đang chạy** (cái đã thực sự migrate, không phải `.deployed`) có
   `apps/be/migrations/` → **từ chối** (giống plan.sh), hướng dẫn rollback tay.
2. Với mỗi phần (be/fe/web), dùng chung bảng đường dẫn của plan.sh (tách vào `lib.sh` `part_changed`):
   - slot **trước** tương đương T (cùng SHA, hoặc không có thay đổi của phần đó giữa hai SHA) → **đổi slot**;
   - slot **đang chạy** đã tương đương T → **để nguyên**;
   - còn lại → **từ chối cả lần rút**, in lệnh fallback: `deploy ref=vT only=all`.
3. Điều kiện riêng — so giữa **`ops=`** của slot đang chạy và slot được đổi vào (script nằm ở commit của
   workflow, có thể mới hơn target):
   - BE: `lock=` hai slot bằng nhau (node_modules đang cài dùng được cho dist cũ) **và**
     `infra/deploy/remote/build-remote.sh` không đổi giữa hai `ops=` (`.env` đang có đúng là `.env` của T);
   - web: `infra/deploy/web.sh` không đổi giữa hai `ops=` (nó viết lại env pm2 trong `dress-web.config.cjs`).

Thực hiện: BE `mv` đổi `dist`↔`dist.prev` + `pm2 restart dress-api` (API gián đoạn vài giây, không build) →
FE đổi slot → web đổi slot + `pm2 restart dress-web` → `verify.sh` → Record (`kind=rollback`, version = của T,
không tạo tag). Mục tiêu: dưới 1 phút từ lúc bấm đến verify xanh.

Sau khi rút, slot "trước" là bản lỗi → bấm `rollback` lần nữa = quay lại bản vừa rút (cố ý, A3).
Lần `deploy` kế tiếp so với `.deployed` (= T) như bình thường.

### 3.5 Nhãn version trong CMS (O6)

- fe.sh export `VITE_APP_VERSION` + `VITE_APP_SHA`; khai báo kiểu trong `vite-env.d.ts`; dev/CI không có biến →
  hiện `dev`.
- Hiện chữ nhỏ, mờ `v1.3.0 · abc1234` ở cuối menu trong `app/layouts/root-layout.tsx` (A7).
- Khi có version mới được tạo (`mint`), FE **luôn build lại** dù FE không đổi code (A5) — build trên runner,
  đổi slot nguyên tử, không downtime — để nhãn luôn khớp version production và slot `dist.prev` luôn là
  bản ngay trước.

## 4. Chi tiết do agent chốt (agent-default — bác được từng dòng)

| # | Mặc định | Chỗ sửa nếu bác |
| --- | --- | --- |
| A1 | Tag cao nhất toàn repo làm gốc bump (không chỉ tổ tiên của target) — tránh trùng tên sau một lần rút | §3.1, plan.sh |
| A2 | Run một phần (`record=false`) không có tên: nhãn `vX.Y.Z+sha7`, không tag, không ghi history | §3.1 |
| A3 | `rollback` không nhận input; đích là bản liền trước trong history; bấm hai lần = quay lại | §3.4, rollback.yml |
| A4 | Workflow riêng `rollback.yml` (nút khẩn cấp), không phải chế độ của `deploy` | §3.4 |
| A5 | Có version mới → FE luôn build lại — chỉ khi `only=auto`; `only=be`/`web` tôn trọng lựa chọn (run đó thường là `record=false`) | §3.5, plan.sh |
| A6 | Mỗi version có GitHub Release, ghi chú tự sinh từ PR | §3.2 |
| A7 | Nhãn ở cuối menu, chữ nhỏ; không i18n (chuỗi kỹ thuật) | root-layout.tsx |
| A8 | `version.json` nằm trong `dist` nên ai mở `cms.example.com/version.json` cũng đọc được version + sha — chấp nhận (cùng thông tin với nhãn, không bí mật) | §3.3 |
| A9 | Fallback WSL (`sync.sh`, `build.sh`) không tạo version: ghi history `version=unversioned`; README "Keep in step" ghi rõ | §6 bước 5 |

## 5. Rủi ro / giới hạn

| # | Rủi ro | Xử lý |
| --- | --- | --- |
| R1 | Đĩa VPS: thêm một bản web standalone + FE + BE dist | Đo `df` + `du` trước khi code (§6 bước 0); verify.sh đã in `disk /` |
| R2 | PWA (`registerType: 'prompt'`): sau khi rút FE, máy đang mở CMS vẫn chạy bản cũ trong cache đến khi bấm "cập nhật" | Giữ nguyên hành vi prompt; ghi vào RUNBOOK: rút FE xong nhắc nhân viên bấm cập nhật / tải lại |
| R3 | Rút qua migration vẫn là việc tay | Không đổi — đúng như plan.sh hiện nay; không tự chạy `down` trên production |
| R4 | `.env` do build-remote.sh viết cho bản mới; dist cũ chạy với `.env` mới | §3.4 bước 3: `build-remote.sh` đổi giữa hai `ops=` → BE không rút nhanh, quay về `deploy ref=vT only=all` |
| R5 | Mã nguồn `/opt/dress-rental` (git archive) vẫn là bản mới sau khi rút BE | Runtime chỉ dùng `dist` + `node_modules`; lần deploy sau giải nén lại toàn bộ |
| R6 | Bản build đang chạy hôm nay không có metadata → sau deploy versioned đầu tiên, slot `.prev` không rút được — đúng lần cần lưới an toàn nhất | §6 bước 1 gieo metadata `v1.0.0` vào slot đang chạy trước deploy đầu tiên; nếu bước đó bị bỏ, rollback từ chối với lời nhắn rõ |

## 6. Kế hoạch triển khai + bằng chứng

0. Đo đĩa VPS (`df -h /`, `du -sh` các thư mục build) — chỉ đọc.
1. Gốc `v1.0.0` (sau khi chủ tiệm duyệt O3), một lần, có kiểm tra:
   - ssh đọc `.deployed` → phải là `sha=1067bc1…`; khác thì dừng, hỏi chủ tiệm gốc nào đúng;
   - `git tag -a v1.0.0 <sha đó> -m "production 2026-11-07, run 42363551332"` + push;
   - gieo metadata vào slot **đang chạy**: `apps/fe/dist/version.json`, `apps/be/dist/.built`
     (`sha= version=v1.0.0 lock=<sha256 pnpm-lock.yaml hiện có trên VPS> ops=1067bc1`), `version=v1.0.0` vào
     `apps/web/run/.built`; ghi dòng đầu `.deploy-history`. Nhờ vậy deploy versioned đầu tiên rút được ngay.
2. `lib.sh` `part_changed` + plan.sh dùng nó; tính VERSION (§3.1). Bằng chứng: `bats`/shell test hoặc chạy
   plan.sh khô với `GITHUB_OUTPUT` tạm trên các cặp SHA thật (EXISTING, mới, run một phần, không tag).
3. Slot hoá fe.sh / web.sh / build-remote.sh + metadata; record.sh ghi history + tag + release.
4. `rollback.sh` + `rollback.yml`. Bằng chứng: chạy `deploy` (vX) → `rollback` → verify xanh, thời gian đo
   được; bấm `rollback` lần hai quay lại; thử một khoảng có migration → bị từ chối.
5. Nhãn FE + `vite-env.d.ts`; `pnpm --filter fe build` + unit test hiển thị `dev` khi thiếu biến.
6. Docs: `infra/deploy/README.md` (Rollback viết lại), RUNBOOK §7 (WSL), `AGENTS.md` dòng Production ghi
   version thay vì chỉ SHA, as-built note ở doc này.

## 7. Ngoài phạm vi

- Version cho `apps/qr-admin` và `apps/web` hiển thị cho khách (web giữ `.built`).
- Endpoint BE `/version` (O6 chọn nhúng build-time).
- Rollback tự động khi verify đỏ — con người quyết định có bấm `rollback` hay không.
- Rút qua migration, chạy migration `down`.

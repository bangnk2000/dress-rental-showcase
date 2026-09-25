# Responsive system — Home + Contact + Product detail (mobile → tablet → desktop)

Status: **proposal, 2026-09-25** — owner answered the open questions (§9); layout review pending. Reference-only like `stitch/`; porting
to `src/` stays FR-WEB-traced, design-tier work (`../AGENTS.md` §Where do I add a public page).

- **Primary visual reference:** the approved mobile screens `stitch/home.jpg` (`b31d3512…`) and
  `stitch/contact.jpg` (`2c26e8ea…`). Visual direction is frozen; this doc only adds breakpoints.
- **Design system:** `../DESIGN.md`. Every value below is a DESIGN.md role token; no new tokens,
  no arbitrary values. Stitch→token translation rules: `stitch/README.md`.
- **Tablet/desktop renders:** a working HTML prototype in `prototype/` (§8); Stitch variants of the approved
  mobile screens could not be generated (Stitch timed out).

---

## 1. What the approved mobile screens are made of

| # | Home (top → bottom) | Contact (top → bottom) |
| - | --- | --- |
| 1 | Top bar: logo lockup | Top bar: logo lockup + bag + account icons |
| 2 | Hero: full-bleed photo, overlapping white card (eyebrow, 2-line serif H1 with italic 2nd line, lead, primary pill CTA) | Eyebrow pill + centered serif H1 + lead |
| 3 | Store-info card: title + "Đang mở cửa" badge, info rows (address + `Chỉ đường`, hotline + call/Zalo, hours), social strip | Store photo (≈4:5) with overlaid status dot, serif address, caption |
| 4 | Category chips (horizontal scroll) | CTA pair: `Gọi ngay` (primary) + `Mở Google Maps` (secondary-container) |
| 5 | Section header (eyebrow + serif H2 + `Xem tất cả`) + 2×2 dress cards (3:4) | Info card: address (+ copy chip), hours (2 tinted rows), social links (4 rows) |
| 6 | Perks strip: 3 icon-top cells in a tinted card | Privileges: title + 3 icon-left rows in a tinted card |
| 7 | Promo gradient card "Thử Váy Miễn Phí" | — |
| 8 | Footer card: thumbnail + brand, 3 info rows, © | — |
| 9 | Bottom tab bar (4 items: Trang chủ · Bộ sưu tập · Địa chỉ · Liên hệ) | Bottom tab bar (4 items: Trang chủ · Bộ sưu tập · Đặt lịch thử · Địa chỉ) |

### Layout rules extracted (hold at every breakpoint)

1. **Canvas → tinted module → white card.** Page on `surface`; modules on `surface-container-low`
   / `-high`; interactive content on `surface-container-lowest`. Depth by tone, never by heavy shadow.
2. **One primary pill per viewport-screen.** `primary` fill is reserved for the main action;
   secondary actions are `secondary-container` or outlined pills.
3. **Eyebrow → serif heading → sans body.** Eyebrow `label-sm` uppercase `tracking-widest`
   (`secondary` or `outline`), heading Playfair in `primary`, body Plus Jakarta in `on-surface-variant`.
4. **Info row pattern.** Round icon badge (tinted fill) + `label-sm` uppercase label + value in
   `body-md`/`title-md`; optional trailing pill action.
5. **Imagery is framed, not bled** (except the Home hero): `rounded-lg`/`rounded-xl`, 3:4 for
   dresses, ≈4:5 for the store photo, text overlays on a bottom gradient.
6. **Radii:** cards `rounded-xl` (Stitch) → `rounded-md` (ours); rows `rounded-lg` → `rounded`;
   all buttons/chips/badges `rounded-full`.
7. **Rhythm:** inside a module `space-sm`/`space-md`; between modules `space-lg` (mobile).

---

## 2. Grid, containers, breakpoints

Tailwind defaults map exactly: `md` = 768, `xl` = 1280. Layout uses **only `md:` and `xl:`** —
no `sm:`/`lg:` for layout, so there are exactly three layouts to reason about.

| | Mobile `< 768` | Tablet `768–1279` | Desktop `≥ 1280` |
| --- | --- | --- | --- |
| Columns | 4 | 8 | 12 |
| Gutter | `gutter-mobile` 12px | `gutter` 20px | `gutter` 20px |
| Side margin | `margin-mobile` 20px | `space-lg` 32px | `margin` 48px |
| Container | fluid | fluid | **max 1200px content**, centered (1296 incl. margins) |
| Reading measure | fluid | ≤ 6 cols (~480px) | ≤ 6 cols (~590px) |
| Section gap | `space-lg` 32px | `space-xl` 56px | `space-xl` 56px (hero → first section: 2 × `space-xl`) |
| Module padding | `space-md` 20px | `space-lg` 32px | `space-lg` 32px |

Anything wider than 1296px only grows the `surface` margins; full-bleed exceptions: the Home
hero photo on mobile, and the desktop footer band's background.

### Typography scaling (role → role, never a custom size)

| Use | Mobile | Tablet | Desktop |
| --- | --- | --- | --- |
| Page H1 (hero / Contact title) | `headline-lg-mobile` 30 | `headline-lg` 40 | `display-lg` 56 |
| Section H2 | `headline-sm` 22 | `headline-md` 28 | `headline-md` 28 |
| Module title (store card, privileges) | `title-md` 18 | `headline-sm` 22 | `headline-sm` 22 |
| Lead paragraph | `body-md` 14 | `body-lg` 16 | `body-lg` 16 |
| Body / card meta | `body-md` / `body-sm` | same | same |
| Eyebrow, tags, prices unit | `label-sm` 11 | `label-sm` | `label-lg` for section eyebrows |
| Buttons | `label-lg` 13 | `label-lg` | `label-lg` |

Stitch's `text-[10px]` tags/units snap **up** to `label-sm` 11 (nothing below 11px anywhere).
The italic second line of the hero H1 is kept at every size.

### Image aspect ratios

| Image | Mobile | Tablet | Desktop |
| --- | --- | --- | --- |
| Home hero | 4:5 full-bleed, card overlaps bottom 25% | 16:9 inside margins, `rounded-xl`, card overlaps bottom-left | cols 7–12, 4:5, **arched top** (`rounded-t-full`, DESIGN.md §Shapes), card overlaps its left edge |
| Dress card | 3:4 | 3:4 | 3:4 |
| Contact store photo | 4:5 | 3:2 | 4:5, sticky |
| Footer store thumbnail | 1:1 64px | 1:1 64px | 1:1 80px |

---

## 3. Navigation (shared by every page)

| Breakpoint | Behaviour |
| --- | --- |
| Mobile | Slim top bar (logo lockup only) that scrolls away; **fixed bottom tab bar**, 3 items (each ≥ 1/3 width, 64px tall + safe-area), frosted `surface/85` + `backdrop-blur`. Page gets bottom padding = bar height. |
| Tablet | **Bottom bar collapses into the top bar.** Sticky 72px frosted top bar: logo left, the same 3 items as inline text links (`label-lg`, 44px hit area) right-aligned. No drawer — 3 items fit at 768 with room to spare. |
| Desktop | Sticky 80px top bar in the 1200 container: logo left, 3 links centered, **`Nhắn Zalo` outlined secondary pill right** → `https://zalo.me/0901000000` (the only place the header carries a CTA; owner 2026-09-25). Outlined, not `primary`, so the page's own primary action (hero CTA / `Gọi ngay`) stays the one filled pill in view (rule 2). |

- **One item set everywhere** (mobile currently differs between the two pages — a usability bug):
  `Trang chủ` · `Bộ sưu tập` · `Liên hệ`. `Địa chỉ` is dropped (the address lives on `Liên hệ`);
  `Đặt lịch thử` is dropped — there is no booking feature (owner 2026-09-25). Adding one later is
  a design-tier feature that also brings the tab back.
- Active item: `primary` + `font-semibold` (+ 2px underline on md+). `aria-current="page"`.
- **Bag + account icons are removed** from Contact at all sizes: the site has no session and no
  cart (`../AGENTS.md` Deviation 1). They return only with a design-tier sign-in feature.
- A drawer/sheet becomes the pattern only if the nav grows past 5 items (mobile) / 6 (tablet).

---

## 4. Component transformations

Verb legend: **scale** · **stack** · **collapse** · **reorder** · **hide** · **drawer** ·
**h→v / v→h** (orientation change) · **keep**.

### Shared components

| Component | Mobile (approved) | Tablet | Desktop | Verbs |
| --- | --- | --- | --- | --- |
| Top bar / bottom tab bar | top logo + bottom tabs | single sticky top bar with inline links | + `Nhắn Zalo` pill | collapse (bottom→top), reorder |
| Logo lockup | 40px mark + wordmark + tagline | same | 48px mark | scale |
| Eyebrow pill / label | `label-sm` | same | `label-lg` on section eyebrows | scale |
| Section header (eyebrow + H2 + text link) | stacked left, link right | same row | same row + chips join the row (Home) | keep → reorder |
| Primary / secondary pill button | full-width in cards, 48px tall | auto width, min 160px | auto width | stack → v→h (pairs sit side by side) |
| Icon badge (round tinted) | 32–40px | 40px | 40px | keep |
| Info row (icon + label + value + action) | full width | 2 per row | 2 per row (Home band: 4 per row) | stack → h |
| Tinted module card | full width, `space-md` pad | `space-lg` pad | `space-lg` pad, may become an un-carded band | scale |
| Perks / privileges items | icon-top (Home) / icon-left rows (Contact) | 3 across, icon-left | 3 across, icon-left, divider rules | v→h |
| Footer | card inside margins | card, 2 columns | full-width band, 4 columns | h, reorder |

### Home-only

| Component | Mobile | Tablet | Desktop | Verbs |
| --- | --- | --- | --- | --- |
| Hero | photo full-bleed, card overlaps below | 16:9 framed photo, card (6 of 8 cols) overlaps bottom-left | 12-col split: text card cols 1–7 overlapping arched photo cols 7–12 | h, reorder (text left of image) |
| Store-info card | stacked rows | 2×2 info rows + social strip below | horizontal band of 4 cells (address · hotline · hours · social) directly under hero; each cell stacks its action pill under the value | stack → h |
| Category chips | horizontal scroll, edge fade | wrap, no scroll (4 fit) | moved **into the section header row**, right-aligned | reorder |
| Dress grid | 2 cols, 4 cards | 3 cols, 6 cards | 4 cols, 8 cards | scale (cols); hide extra cards on smaller sizes |
| Dress card | 3:4, tag + heart overlay | same | same + hover: image zoom 1.05, heart appears on hover (always visible on touch) | keep; interaction change |
| Perks strip | 3 icon-top cells in card | 3 cells icon-left | un-carded band with thin `outline-variant` rules between cells | v→h |
| Promo "Thử váy miễn phí" | gradient card, stacked, `Nhắn Zalo` pill full-width | text left (5 cols) + `Nhắn Zalo` right (3 cols) | 12-col card: text 7 cols + `Nhắn Zalo`; decorative orb larger | v→h |
| Footer | card | card, 2 cols | band, 4 cols (brand · địa chỉ/hotline · giờ mở cửa · mạng xã hội) | h |

Card counts: the section fetches 8 and renders 4 / 6 / 8 (CSS `hidden` on the extras). A
partially filled last row is not allowed at any breakpoint.

### Contact-only

| Component | Mobile | Tablet | Desktop | Verbs |
| --- | --- | --- | --- | --- |
| Title block (eyebrow + H1 + lead) | centered | centered, measure 6 cols | **left-aligned** in left column (cols 1–5) | reorder (alignment) |
| Store photo | 4:5 after title | 3:2 after title | right column cols 7–12, 4:5, `position: sticky` under the header | reorder (beside, not below) |
| CTA pair | 2 pills side by side | 2 pills side by side, auto width, left-aligned under photo | under the lead in left column | reorder |
| Info card (address · hours · social) | single card, 3 blocks with dividers | 2 cols: address + hours │ social | left column; social list becomes 2×2 grid | stack → h |
| Social links | 4 full-width rows | 1 col in its half | 2×2 | v→h |
| Privileges | title + 3 stacked rows | 3 across | full-width band under both columns, 3 across | v→h |

---

### Product detail (`/bo-suu-tap/<slug>`) — added 2026-09-25, no approved mobile screen

Designed mobile-first from the Home/Contact components (dress card, info rows, perks, pills);
no new component or token. Owner delegated the UX calls; the ones that matter:

- **No booking** (§9): sizes are **information, not a picker**; the conversion is `Nhắn Zalo giữ
  váy` (primary) + call (secondary). No date picker, no cart.
- **Mobile tab bar → sticky action bar on this page** (price + call icon + `Nhắn Zalo giữ váy`),
  DESIGN.md "sticky booking bars". Navigation back is the `‹ Bộ sưu tập` link under the header.
- **H1 steps down one role vs other pages** (`headline-lg-mobile` → `headline-md` → `headline-lg`)
  because it sits in a half-width column; the price is the second-loudest element.
- **Photos:** one carousel at every size — the DOM never changes, only its controls.

| Component | Mobile | Tablet | Desktop | Verbs |
| --- | --- | --- | --- | --- |
| Breadcrumb | `‹ Bộ sưu tập` back link (44px) | full trail | full trail | collapse |
| Layout | stacked: gallery → info | gallery cols 1–4 · info cols 5–8, **info sticky** | gallery cols 1–7 · info cols 8–12, info sticky | stack → h |
| Gallery | full-bleed swipe carousel, 3:4, counter `1 / 4` | framed, thumbnail strip below | thumbnail **rail on the left** + image | reorder (thumbs below → left) |
| Tag + heart | overlay on photo; heart 44px | same | same | keep |
| Price | serif `headline-sm` between rules | `headline-md` | `headline-md` | scale |
| Sizes | info pills; sold-out = outlined + struck + sr-only "Hết size" | same | same | keep |
| Actions | **sticky bottom bar** (tab bar hidden) | inline, full-width pills in info column | same | reorder (fixed → inline) |
| Perks (3 lines) | tinted list | same | same | keep |
| Details (thiết kế, cách thuê) | **accordions**, closed | always open | always open | collapse → expand |
| Related | 2×2 | 3×1 | 4×1 | scale (cols), hide 4th on tablet |

Every dress card (Home, related) is now a single link to the product (stretched link on the
name; the heart stays a separate button above it).

## 5. Mobile corrections (usability only — visual direction untouched)

| Problem on the approved mobile | Fix |
| --- | --- |
| Heart buttons 28px, chips ~32px, `Zalo`/`Chỉ đường` pills ~28px — below 44px | Keep the visual size, extend the **hit area** to 44×44 (padding / `::after` inset). |
| Bottom-nav items differ between Home and Contact | One set (§3). |
| `Gọi ngay: 0901 000 000` wraps to 2 lines at 390px | Label `Gọi ngay`; the number is already in the info card. Desktop header shows the number. |
| Promo card has an empty action row | Add a pill `Nhắn Zalo` → `https://zalo.me/0901000000` (new tab), light pill on the gradient (`surface-container-lowest` fill, `primary` text) — owner 2026-09-25. |
| Bag + account icons with no session | Remove (§3). |
| ~500px empty space at the bottom of Contact (leftover from the removed booking form) | Remove; bottom padding = tab-bar height + `space-lg`. |
| `text-[10px]` tags and units | Snap to `label-sm` 11px. |

## 6. Interaction changes by breakpoint

- **Hover effects** (card zoom, heart reveal, link underline grow) only under
  `@media (hover: hover)`. Touch devices get the static state with the heart always visible.
- **`tel:` / Zalo** links on every breakpoint. Zalo is the site's single conversion channel: header
  pill (desktop), promo card, Contact social row. Calling stays on Contact (`Gọi ngay`) and in the
  info rows; the number is shown as text wherever `tel:` is not useful (desktop).
- **Maps:** `Mở Google Maps` is an outbound link at every size. No embedded iframe (third-party
  script and cost; revisit only on request).
- **Copy address** chip: clipboard + a toast, every breakpoint.
- **Sticky:** bottom bar (mobile), top bar (md+), store photo (Contact desktop). Nothing else sticks.
- **Chip scroll** (mobile only): `overflow-x-auto`, scroll-snap, fade mask on the right edge;
  the page itself never scrolls horizontally (`overflow-x: clip` on `body` is NOT used to hide
  bugs — each component must fit).

## 7. Wireframes

```
HOME — tablet (8 col, margin 32)            HOME — desktop (12 col, 1200 max)
┌──────────────────────────────────┐        ┌──────────────────────────────────────────────┐
│ logo         Trang chủ  BST  LH  │        │ logo        Trang chủ  BST  LH      (Nhắn Zalo) │
├──────────────────────────────────┤        ├──────────────────────────────────────────────┤
│ ┌──────── hero 16:9 ──────────┐  │        │ ┌──── text card ────┐ ╭──── arched ────╮      │
│ │                             │  │        │ │ eyebrow           │ │  hero 4:5      │      │
│ ├─card(6 col)───────┐         │  │        │ │ H1 display-lg     │ │  cols 6–12     │      │
│ │ H1 / lead / CTA   │─────────┘  │        │ │ lead · CTA        │ │                │      │
│ └───────────────────┘            │        │ └───────────────────┘ ╰────────────────╯      │
│ ┌ store info: 2×2 rows ────────┐ │        │ [addr] [hotline] [hours] [social]   ← band   │
│ └ social strip ────────────────┘ │        │ eyebrow/H2 ...........  (chips)  Xem tất cả │
│ (chips wrap)                     │        │ [card][card][card][card]                     │
│ eyebrow / H2        Xem tất cả › │        │ [card][card][card][card]                     │
│ [card] [card] [card]             │        │ perk │ perk │ perk                            │
│ [card] [card] [card]             │        │ ┌ promo: text 7 col ....... [Zalo] ────────┐ │
│ [perk]  [perk]  [perk]           │        │ └──────────────────────────────────────────┘ │
│ ┌ promo: text ....... [Zalo] ──┐ │        ├══════ footer band: 4 columns ════════════════┤
│ └ footer card: 2 cols ─────────┘ │        └──────────────────────────────────────────────┘
└──────────────────────────────────┘

CONTACT — tablet                            CONTACT — desktop
┌──────────────────────────────────┐        ┌──────────────────────────────────────────────┐
│ logo         Trang chủ  BST  LH  │        │ logo        Trang chủ  BST  LH      (Nhắn Zalo) │
│          (eyebrow pill)          │        │ (eyebrow)                ┌────────────────┐  │
│         Ghé Thăm Atelier Demo         │        │ Ghé Thăm Atelier Demo         │ store photo    │  │
│              lead                │        │ lead                     │ 4:5, sticky    │  │
│ ┌──── store photo 3:2 ────────┐  │        │ [Gọi ngay] [Google Maps] │ cols 7–12      │  │
│ └─────────────────────────────┘  │        │ ┌ info card ─────────┐   │                │  │
│ [Gọi ngay] [Mở Google Maps]      │        │ │ address / hours    │   │                │  │
│ ┌ address+hours ┬ social ─────┐  │        │ │ social 2×2         │   └────────────────┘  │
│ └───────────────┴─────────────┘  │        │ └────────────────────┘                       │
│ [privilege][privilege][privilege]│        │ [privilege]   [privilege]   [privilege]      │
└──────────────────────────────────┘        ├══════ footer band ═══════════════════════════┤
```

## 8. Renders — `prototype/`

Stitch could not produce the tablet/desktop screens (2026-09-25: 5 × `generate_variants` and
1 × `generate_screen_from_text` in project `7415812222170294338` all timed out with no screen
created). The renders are instead a **working responsive prototype** — ONE page per screen that
switches layout at 768 / 1280, so the three layouts cannot drift apart:

| File | What |
| --- | --- |
| `prototype/index.html` | review board: Home, Contact, Product at 390 / 834 / 1440 side by side |
| `prototype/home.html`, `contact.html`, `product.html` | the pages (generated — edit the `*.src.html`, then `node build.mjs`) |
| `prototype/tw.js` | Tailwind config = DESIGN.md frontmatter + OUR radius scale (1:1 with `globals.css`) |
| `prototype/proto.css` | `.hit` (44px targets), `.frosted`, chip scroll, hover-only heart reveal |

Verified 2026-09-25 with Playwright at 390 / 834 / 1440: no horizontal overflow and no
interactive element under 44×44 on any of the three pages. Reference-only like `stitch/`: it uses Tailwind
Play CDN, lucide UMD and Stitch image hot-links, none of which are allowed in `src/`. A few layout
sizes are still arbitrary (`md:h-[72px]` header, `max-h-[500px]` mobile hero) — port them as
spacing tokens, never as arbitrary values. Where the prototype disagrees with §2–§6, **this doc
wins**.

## 9. Owner decisions (2026-09-25)

1. Promo card action → **Zalo directly** (`Nhắn Zalo`, §5).
2. **No booking feature** → `Đặt lịch thử` is not a nav item; nav = 3 items (§3).
3. Desktop header pill → **`Nhắn Zalo`** (§3).

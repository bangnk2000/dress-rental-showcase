# Stitch export — "Website Cho Thuê Váy Tiệc"

Reference-only material pulled from Google Stitch (project `7415812222170294338`,
last updated 2026-09-24) on 2026-09-25. **Not built, not imported by `src/`.**
Visual truth stays `../../DESIGN.md` → `src/app/globals.css` tokens; porting any of this
into a page is FR-WEB-traced, design-tier work (see `../../AGENTS.md`).

| File | Stitch screen | Notes |
| --- | --- | --- |
| `home.html` / `home.jpg` | Trang Chủ - Atelier Demo Cho Thuê Đồ Xinh (`b31d3512…`) | mobile, 780w |
| `contact.html` / `contact.jpg` | Liên Hệ & Cửa Hàng - 12 Phố Mẫu (`2c26e8ea…`) | mobile, 780w |
| `hero-banner.jpg` | hero banner image (`0538e5c8…`) | 1376×768 |
| `bg-silk-texture.jpg` | silk background texture (`b6ed853c…`) | 1376×768 |
| `logo.jpg` | Atelier Demo Logo (`b8d450c3…`) | 1024×1024 |
| `ref-86179E14.png`, `ref-F369D77B.png` | uploaded reference screenshots | |

The HTML files are Stitch's raw output (Tailwind CDN + Google Fonts) — open them in a browser.

## Stitch vs `DESIGN.md` (checked 2026-09-25)

Same system ("Romantic Parisian Muse"). Porting a Stitch class list 1:1 is NOT safe — translate:

| Area | Stitch export | Our tokens (`globals.css`) | Port rule |
| --- | --- | --- | --- |
| Colors | 49 roles, same hexes | same 49 roles | identical — keep `bg-primary`, `text-on-surface`, … |
| Type scale / fonts | 12 roles, Playfair + Plus Jakarta | same 12 roles | identical; Stitch `font-headline-sm` → `font-display`, body roles → `font-sans` |
| Spacing | 9 roles | same 9 | identical |
| **Radius** | `DEFAULT .25` · `lg .5` · `xl .75` (no sm/md) | `sm .25` · `DEFAULT .5` · `md .75` · `lg 1` · `xl 1.5` | **shifted:** Stitch `rounded` → `rounded-sm`, `rounded-lg` → `rounded`, `rounded-xl` → `rounded-md` |
| Buttons | `rounded-full` pills (home 8, contact 2) | pills (owner, 2026-09-25) | keep `rounded-full` |
| Shadows | 3 arbitrary `shadow-[…rgba(138,79,88,…)]` | one `shadow-ambient` | map all to `shadow-ambient` (add a token in DESIGN.md first if a second level is really needed) |
| Arbitrary text sizes | home 61×, contact 30× `text-[9–22px]` | forbidden | snap to the nearest role (mostly `label-sm` / `body-sm` / icon sizes) |
| Icons | Material Symbols web font (~24 per page) | `lucide-react` (owner, 2026-09-25) | map each symbol to the nearest lucide icon; no icon font |
| Dark mode | `darkMode: "class"`, no `dark:` used | `prefers-color-scheme` token override | nothing to port |
| Images | `lh3.googleusercontent.com` hot-links | — | ship local assets via `next/image`; never hot-link Stitch URLs |
| Copy | hard-coded Vietnamese | next-intl `messages/vi/*.json` | move every string to a namespace |

interface ImportMetaEnv {
  /** Empty string in every environment — the app calls the API same-origin under /api. */
  readonly VITE_API_BASE_URL: string;
  /**
   * Public origin of the R2 photo bucket (= BE `IMAGE_PUBLIC_BASE_URL`), e.g.
   * `https://img-dev.example.com`. Read ONLY by `src/lib/photo-url.ts`. Unset → photos render
   * from their stored URL unchanged (no Cloudflare Images variants).
   */
  readonly VITE_IMAGE_BASE_URL?: string;
  /**
   * Public origin of the website (`apps/web`), e.g. `https://example.com`. The CMS links a
   * published listing to `<origin>/bo-suu-tap/<slug>`; unset → the "Xem trên web" link is hidden.
   */
  readonly VITE_WEB_ORIGIN?: string;
  /**
   * The deploy's version (`v1.4.2`, or `v1.4.1+abc1234` for a partial deploy) and the built commit —
   * set ONLY by `infra/deploy/fe.sh`. Read ONLY by `src/lib/app-version.ts`; unset → the footer says `dev`.
   */
  readonly VITE_APP_VERSION?: string;
  readonly VITE_APP_SHA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

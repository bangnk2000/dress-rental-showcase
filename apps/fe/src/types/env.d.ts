interface ImportMetaEnv {
  /** Empty string in every environment — the app calls the API same-origin under /api. */
  readonly VITE_API_BASE_URL: string;
  /**
   * Public origin of the R2 photo bucket (= BE `IMAGE_PUBLIC_BASE_URL`), e.g.
   * `https://img-dev.example.com`. Read ONLY by `src/lib/photo-url.ts`. Unset → photos render
   * from their stored URL unchanged (no Cloudflare Images variants).
   */
  readonly VITE_IMAGE_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ImportMetaEnv {
  /** Empty string in every environment — the app calls the API same-origin under /api. */
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

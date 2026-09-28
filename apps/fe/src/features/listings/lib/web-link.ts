/**
 * The public page of a listing on the website (`apps/web`), or null when the build has no
 * `VITE_WEB_ORIGIN` — the "Xem trên web" link is then hidden rather than pointing nowhere.
 * Read per call (not at module load) so tests can `vi.stubEnv` it.
 */
export function listingWebUrl(slug: string): string | null {
  const origin = import.meta.env.VITE_WEB_ORIGIN?.trim();
  if (!origin) return null;
  return `${origin.replace(/\/+$/, '')}/bo-suu-tap/${slug}`;
}

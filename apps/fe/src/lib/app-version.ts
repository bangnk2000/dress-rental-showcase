/**
 * The name of the running CMS build for the footer label (docs/design/deploy-versioning.md §3.5):
 * `v1.4.2 · abc1234`. `infra/deploy/fe.sh` inlines both values at build time; a dev or CI build has
 * neither and says `dev`. A technical string, deliberately not translated (A7).
 *
 * Read per call, not captured at module load, so tests can `vi.stubEnv` it.
 */
export function appVersionLabel(): string {
  const version = import.meta.env.VITE_APP_VERSION?.trim();
  if (!version) return 'dev';
  const sha = import.meta.env.VITE_APP_SHA?.trim();
  return sha ? `${version} · ${sha.slice(0, 7)}` : version;
}

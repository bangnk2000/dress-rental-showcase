/**
 * DELIBERATE, CONTAINED EXCEPTION to "components never inspect status codes"
 * (04-data-layer.md §3), same as the dresses feature: the create-rental 409
 * (dress retired / period unavailable) carries no typed error body in the
 * contract (generated TError = void), so surfacing it as a form-level message
 * requires branching on the transport status. Feature-local on purpose —
 * features must not import other features, and axios imports are banned here.
 */
export function isConflictError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const response = (error as { response?: { status?: unknown } }).response;
  return (
    typeof response === 'object' && response !== null && response.status === 409
  );
}

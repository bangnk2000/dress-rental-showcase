/**
 * DELIBERATE, CONTAINED EXCEPTION to "components never inspect status codes"
 * (04-data-layer.md §3), same as the dresses and rentals features: the
 * pickup/return 409 (already handed out / already returned) carries no typed
 * error body in the contract, so telling it apart from a generic failure
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

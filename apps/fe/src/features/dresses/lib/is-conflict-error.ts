/**
 * DELIBERATE, CONTAINED EXCEPTION to "components never inspect status codes"
 * (04-data-layer.md §3): the create-dress 409 (duplicate code) carries no
 * typed error body in the contract (generated TError = void), so mapping it
 * to a field error requires branching on the transport status. This helper is
 * the ONE place in the feature allowed to look, via a structural check —
 * importing axios here is banned (HTTP lives in src/api).
 */
export function isConflictError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const response = (error as { response?: { status?: unknown } }).response;
  return (
    typeof response === 'object' && response !== null && response.status === 409
  );
}

import { registerPolicy } from '../../libs/authz/policy-registry';

/**
 * ABAC policies for the rentals context. Reads need authentication only (no entry here);
 * unlisted write permissions are DENIED (fail-closed registry).
 */
registerPolicy('rental:create', () => true); // any authenticated staff
registerPolicy('rental:pickup', () => true); // any authenticated staff
registerPolicy('rental:return', () => true); // any authenticated staff
registerPolicy('rental:cancel', () => true); // any authenticated staff
// FR-RENT-13: owner decision 2026-11-07 — every staff member may edit an open rental (all fields,
// money terms included); it was owner-only from 2026-09-18 until then.
registerPolicy('rental:update', () => true); // any authenticated staff

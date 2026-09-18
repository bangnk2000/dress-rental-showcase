import { registerPolicy } from '../../libs/authz/policy-registry';

/**
 * ABAC policies for the rentals context. Reads need authentication only (no entry here);
 * unlisted write permissions are DENIED (fail-closed registry).
 */
registerPolicy('rental:create', () => true); // any authenticated staff
registerPolicy('rental:pickup', () => true); // any authenticated staff
registerPolicy('rental:return', () => true); // any authenticated staff
registerPolicy('rental:cancel', () => true); // any authenticated staff
// FR-RENT-13: rewriting an order after the fact (dates, dresses, money terms) is a high-risk act
// and stays with the owner — the first owner-only WRITE of this context.
registerPolicy('rental:update', ({ subject }) => subject.role === 'owner');

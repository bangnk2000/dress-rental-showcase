import { registerPolicy } from '../../libs/authz/policy-registry';

/**
 * ABAC policies for the rentals context. Reads need authentication only (no entry here);
 * unlisted write permissions are DENIED (fail-closed registry).
 */
registerPolicy('rental:create', () => true); // any authenticated staff
registerPolicy('rental:pickup', () => true); // any authenticated staff
registerPolicy('rental:return', () => true); // any authenticated staff

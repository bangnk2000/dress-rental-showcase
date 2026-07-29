import { registerPolicy } from '../../libs/authz/policy-registry';

/**
 * ABAC policies for the catalog context. Reads need authentication only (no entry here);
 * unlisted write permissions are DENIED (fail-closed registry).
 */
registerPolicy('dress:create', () => true); // any authenticated staff
registerPolicy('dress:update', () => true);
registerPolicy('dress:retire', ({ subject }) => subject.role === 'owner');

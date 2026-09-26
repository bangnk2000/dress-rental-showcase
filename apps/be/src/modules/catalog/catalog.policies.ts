import { registerPolicy } from '../../libs/authz/policy-registry';

/**
 * ABAC policies for the catalog context. Reads need authentication only (no entry here);
 * unlisted write permissions are DENIED (fail-closed registry).
 */
registerPolicy('dress:create', () => true); // any authenticated staff
registerPolicy('dress:update', () => true);
registerPolicy('dress:retire', ({ subject }) => subject.role === 'owner');
// Categories are a daily cleanup tool (FR-CAT-07 §6.Q1): staff create and rename freely;
// DELETING one is the destructive act and stays with the owner.
registerPolicy('category:create', () => true);
registerPolicy('category:update', () => true);
registerPolicy('category:delete', ({ subject }) => subject.role === 'owner');
// FR-CAT-10: whoever may create/edit a dress may upload its photos (dress-photo-upload.md §2).
registerPolicy('photo:upload', () => true);

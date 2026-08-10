import { registerPolicy } from '../../libs/authz/policy-registry';

/**
 * ABAC policies for the identity context. ONE permission covers all four account-management
 * actions on purpose (manage-users spec §6 derived #8): four keys for one owner-only screen is
 * decorative ABAC — split only when a third role appears. Login/refresh are @Public.
 */
registerPolicy('user:manage', ({ subject }) => subject.role === 'owner');

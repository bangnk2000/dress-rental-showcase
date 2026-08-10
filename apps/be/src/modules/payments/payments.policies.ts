import { registerPolicy } from '../../libs/authz/policy-registry';

/**
 * ABAC policies for the payments context. Reads need authentication only (no entry here);
 * unlisted write permissions are DENIED (fail-closed registry).
 *
 * Recording money is STAFF work on purpose: the person holding the cash is the one at the
 * counter. Owner-only rules exist where money is given AWAY below the computed amount
 * (`late_fee_waiver_requires_owner`), not where it is written down as received.
 */
registerPolicy('payment:collect', () => true); // any authenticated staff

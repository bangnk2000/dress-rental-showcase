import { PermissionKey, Policy, PolicyInput } from './authz.types';

/**
 * Central ABAC policy table. Each bounded context registers its own policies from a
 * `<context>.policies.ts` file (imported by the context module). Evaluation is
 * fail-closed: a permission without a registered policy is DENIED.
 */
const policies = new Map<PermissionKey, Policy>();

export function registerPolicy(key: PermissionKey, policy: Policy): void {
  if (policies.has(key)) {
    throw new Error(`Policy already registered for '${key}'`);
  }
  policies.set(key, policy);
}

export function evaluatePolicy(key: PermissionKey, input: PolicyInput): boolean {
  const policy = policies.get(key);
  if (!policy) return false; // fail-closed
  return policy(input);
}

/** Test-only escape hatch. */
export function clearPolicies(): void {
  policies.clear();
}

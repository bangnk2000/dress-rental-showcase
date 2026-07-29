export type StaffRole = 'owner' | 'staff';

/** Subject attributes, sourced from the verified JWT — never from request body. */
export interface SubjectAttributes {
  staffId: string;
  role: StaffRole;
}

/**
 * ABAC policy input: subject attributes + resource attributes.
 * `resource` carries route params (e.g. { id }) by default; handlers may enrich it.
 */
export interface PolicyInput {
  subject: SubjectAttributes;
  resource: Record<string, unknown>;
}

/** A permission key is `<resource>:<action>`, e.g. 'dress:create', 'deposit:settle'. */
export type PermissionKey = `${string}:${string}`;

export type Policy = (input: PolicyInput) => boolean;

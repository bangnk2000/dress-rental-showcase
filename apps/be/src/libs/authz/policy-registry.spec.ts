import { clearPolicies, evaluatePolicy, registerPolicy } from './policy-registry';
import { SubjectAttributes } from './authz.types';

const owner: SubjectAttributes = { staffId: 's1', role: 'owner' };
const staff: SubjectAttributes = { staffId: 's2', role: 'staff' };

describe('ABAC policy registry', () => {
  beforeEach(() => clearPolicies());

  it('evaluates attribute-based policies', () => {
    registerPolicy('dress:retire', ({ subject }) => subject.role === 'owner');

    expect(evaluatePolicy('dress:retire', { subject: owner, resource: {} })).toBe(true);
    expect(evaluatePolicy('dress:retire', { subject: staff, resource: {} })).toBe(false);
  });

  it('is fail-closed: an unregistered permission is denied', () => {
    expect(evaluatePolicy('deposit:settle', { subject: owner, resource: {} })).toBe(false);
  });

  it('rejects duplicate registrations', () => {
    registerPolicy('dress:create', () => true);
    expect(() => registerPolicy('dress:create', () => true)).toThrow();
  });
});

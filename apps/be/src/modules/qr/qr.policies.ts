import { registerPolicy } from '../../libs/authz/policy-registry';

registerPolicy('qr:create', ({ subject }) => subject.role === 'owner');
registerPolicy('qr:list', ({ subject }) => subject.role === 'owner');
registerPolicy('qr:read', ({ subject }) => subject.role === 'owner');

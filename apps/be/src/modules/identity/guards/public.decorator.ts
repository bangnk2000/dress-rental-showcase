// Moved to the shared kernel (catalog's `/public/*` routes need it too); re-exported so the
// identity imports keep their path.
export { IS_PUBLIC_KEY, Public } from '../../../libs/authz/public.decorator';

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'is_public';

/**
 * Skip JWT authentication for this endpoint (login, refresh, the anonymous `/public/*` catalogue).
 * Lives in the shared kernel because more than one context declares public routes and contexts
 * may not import each other; identity's JwtAuthGuard reads the key.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

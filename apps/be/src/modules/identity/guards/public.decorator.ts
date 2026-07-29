import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'is_public';

/** Skip JWT authentication for this endpoint (login, refresh, health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler';

/** Loopback = a process on this same host (the web's ISR server), never an internet client. */
export function isLoopback(ip: string | undefined): boolean {
  if (!ip) return false;
  return ip === '::1' || ip.startsWith('127.') || ip.startsWith('::ffff:127.');
}

interface TrackedRequest {
  ip?: string;
}

/**
 * Rate limit for the anonymous `/public/*` API — the first endpoints of this BE with no session
 * (docs/design/catalog/public-listing.md §Contract check, major finding). It is NOT a global guard:
 * only controllers that declare `@UseGuards(ThrottlerGuard)` are throttled, so staff routes are
 * never affected. The key is `req.ip`, which is the X-Forwarded-For client once main.ts trusts
 * the loopback nginx. In-memory storage: one API process (PM2 fork mode) — revisit if that changes.
 */
export const PublicThrottleModule = ThrottlerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService): ThrottlerModuleOptions => {
    const skipLoopback = config.get<boolean>('PUBLIC_THROTTLE_SKIP_LOOPBACK') ?? true;
    return {
      throttlers: [
        {
          name: 'public',
          ttl: (config.get<number>('PUBLIC_THROTTLE_TTL_SEC') ?? 60) * 1000,
          limit: config.get<number>('PUBLIC_THROTTLE_LIMIT') ?? 60,
        },
      ],
      getTracker: (req: TrackedRequest) => req.ip ?? 'unknown',
      skipIf: (context: ExecutionContext) =>
        skipLoopback && isLoopback(context.switchToHttp().getRequest<TrackedRequest>().ip),
    };
  },
});

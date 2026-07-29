import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPool, DatabasePool } from 'slonik';
import { DB_POOL } from './db.di-tokens';

/**
 * OPENAPI_EMIT=1 boots the app WITHOUT touching infrastructure (offline-boot rule,
 * docs/spec/init-monorepo-contract/02 §2): the pool is replaced by a stub that throws
 * on first use. Emit only reads controller/DTO metadata, so it never gets that far.
 */
const poolProvider = {
  provide: DB_POOL,
  inject: [ConfigService],
  useFactory: async (config: ConfigService): Promise<DatabasePool | object> => {
    if (process.env.OPENAPI_EMIT === '1') {
      return new Proxy(
        {},
        {
          get(_target, prop) {
            // `await`, DI plumbing and Nest lifecycle probing touch these — stay silent for them.
            const probes = [
              'then',
              'catch',
              'finally',
              'constructor',
              'onModuleInit',
              'onModuleDestroy',
              'onApplicationBootstrap',
              'onApplicationShutdown',
              'beforeApplicationShutdown',
            ];
            if (typeof prop === 'symbol' || probes.includes(prop)) {
              return undefined;
            }
            throw new Error(
              `DB access ('${String(prop)}') attempted during openapi:emit (offline-boot violation)`,
            );
          },
        },
      );
    }
    return createPool(config.getOrThrow<string>('DATABASE_URL'));
  },
};

@Global()
@Module({
  providers: [poolProvider],
  exports: [DB_POOL],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DB_POOL) private readonly pool: DatabasePool | object) {}

  async onApplicationShutdown(): Promise<void> {
    if (process.env.OPENAPI_EMIT === '1') return;
    await (this.pool as DatabasePool).end();
  }
}

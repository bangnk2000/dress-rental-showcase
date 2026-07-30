import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { validateConfig } from './libs/config/config.schema';
import { DatabaseModule } from './libs/db/database.module';
import { LoggingModule } from './libs/logging/logging.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { IdentityModule } from './modules/identity/identity.module';
import { RentalsModule } from './modules/rentals/rentals.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateConfig }),
    EventEmitterModule.forRoot(),
    LoggingModule,
    DatabaseModule,
    IdentityModule,
    CatalogModule,
    RentalsModule,
  ],
})
export class AppModule {}

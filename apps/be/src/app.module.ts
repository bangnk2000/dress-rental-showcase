import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { validateConfig } from './libs/config/config.schema';
import { DatabaseModule } from './libs/db/database.module';
import { LoggingModule } from './libs/logging/logging.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { IdentityModule } from './modules/identity/identity.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { RentalsModule } from './modules/rentals/rentals.module';
import { QrModule } from './modules/qr/qr.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateConfig }),
    EventEmitterModule.forRoot(),
    LoggingModule,
    DatabaseModule,
    IdentityModule,
    CatalogModule,
    RentalsModule,
    PaymentsModule,
    QrModule,
  ],
})
export class AppModule {}

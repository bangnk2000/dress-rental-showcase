import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { DRESS_LOOKUP } from './application/ports/dress-lookup.port';
import { RENTAL_REPOSITORY } from './application/ports/rental.repository.port';
import { CreateRentalHttpController } from './commands/create-rental/create-rental.http.controller';
import { CreateRentalService } from './commands/create-rental/create-rental.service';
import { DressLookupAdapter } from './database/dress-lookup.adapter';
import { RentalMapper } from './database/rental.mapper';
import { RentalRepository } from './database/rental.repository';
import './rentals.policies';

@Module({
  imports: [CqrsModule],
  controllers: [CreateRentalHttpController],
  providers: [
    RentalMapper,
    CreateRentalService,
    { provide: RENTAL_REPOSITORY, useClass: RentalRepository },
    { provide: DRESS_LOOKUP, useClass: DressLookupAdapter },
  ],
})
export class RentalsModule {}

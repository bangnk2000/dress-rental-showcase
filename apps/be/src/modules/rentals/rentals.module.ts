import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { DRESS_LOOKUP } from './application/ports/dress-lookup.port';
import { RENTAL_REPOSITORY } from './application/ports/rental.repository.port';
import { CreateRentalHttpController } from './commands/create-rental/create-rental.http.controller';
import { CreateRentalService } from './commands/create-rental/create-rental.service';
import { DressLookupAdapter } from './database/dress-lookup.adapter';
import { RentalMapper } from './database/rental.mapper';
import { RentalRepository } from './database/rental.repository';
import { CheckAvailabilityHttpController } from './queries/check-availability/check-availability.http.controller';
import { CheckAvailabilityQueryHandler } from './queries/check-availability/check-availability.query-handler';
import { GetTodayBoardHttpController } from './queries/get-today-board/get-today-board.http.controller';
import { GetTodayBoardQueryHandler } from './queries/get-today-board/get-today-board.query-handler';
import { ListBookedRangesHttpController } from './queries/list-booked-ranges/list-booked-ranges.http.controller';
import { ListBookedRangesQueryHandler } from './queries/list-booked-ranges/list-booked-ranges.query-handler';
import './rentals.policies';

@Module({
  imports: [CqrsModule],
  controllers: [
    CreateRentalHttpController,
    CheckAvailabilityHttpController,
    GetTodayBoardHttpController,
    ListBookedRangesHttpController,
  ],
  providers: [
    RentalMapper,
    CreateRentalService,
    CheckAvailabilityQueryHandler,
    GetTodayBoardQueryHandler,
    ListBookedRangesQueryHandler,
    { provide: RENTAL_REPOSITORY, useClass: RentalRepository },
    { provide: DRESS_LOOKUP, useClass: DressLookupAdapter },
  ],
})
export class RentalsModule {}

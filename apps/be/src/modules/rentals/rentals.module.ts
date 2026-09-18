import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { DRESS_LOOKUP } from './application/ports/dress-lookup.port';
import { PAYMENT_RECORDER } from './application/ports/payment-recorder.port';
import { RENTAL_REPOSITORY } from './application/ports/rental.repository.port';
import { CancelRentalHttpController } from './commands/cancel-rental/cancel-rental.http.controller';
import { CancelRentalService } from './commands/cancel-rental/cancel-rental.service';
import { CreateRentalHttpController } from './commands/create-rental/create-rental.http.controller';
import { CreateRentalService } from './commands/create-rental/create-rental.service';
import { PickupRentalHttpController } from './commands/pickup-rental/pickup-rental.http.controller';
import { PickupRentalService } from './commands/pickup-rental/pickup-rental.service';
import { ReturnRentalHttpController } from './commands/return-rental/return-rental.http.controller';
import { ReturnRentalService } from './commands/return-rental/return-rental.service';
import { UpdateRentalHttpController } from './commands/update-rental/update-rental.http.controller';
import { UpdateRentalService } from './commands/update-rental/update-rental.service';
import { DressLookupAdapter } from './database/dress-lookup.adapter';
import { PaymentRecorderAdapter } from './database/payment-recorder.adapter';
import { RentalMapper } from './database/rental.mapper';
import { RentalRepository } from './database/rental.repository';
import { CheckAvailabilityHttpController } from './queries/check-availability/check-availability.http.controller';
import { CheckAvailabilityQueryHandler } from './queries/check-availability/check-availability.query-handler';
import { GetRentalHttpController } from './queries/get-rental/get-rental.http.controller';
import { GetRentalQueryHandler } from './queries/get-rental/get-rental.query-handler';
import { GetTodayBoardHttpController } from './queries/get-today-board/get-today-board.http.controller';
import { GetTodayBoardQueryHandler } from './queries/get-today-board/get-today-board.query-handler';
import { ListBookedRangesHttpController } from './queries/list-booked-ranges/list-booked-ranges.http.controller';
import { ListBookedRangesQueryHandler } from './queries/list-booked-ranges/list-booked-ranges.query-handler';
import { ListRentalsHttpController } from './queries/list-rentals/list-rentals.http.controller';
import { ListRentalsQueryHandler } from './queries/list-rentals/list-rentals.query-handler';
import { QuoteLateFeeHttpController } from './queries/quote-late-fee/quote-late-fee.http.controller';
import { QuoteLateFeeQueryHandler } from './queries/quote-late-fee/quote-late-fee.query-handler';
import './rentals.policies';

@Module({
  imports: [CqrsModule],
  controllers: [
    CreateRentalHttpController,
    CancelRentalHttpController,
    PickupRentalHttpController,
    ReturnRentalHttpController,
    UpdateRentalHttpController,
    CheckAvailabilityHttpController,
    GetTodayBoardHttpController,
    ListBookedRangesHttpController,
    ListRentalsHttpController,
    QuoteLateFeeHttpController,
    // LAST on purpose: its `GET rentals/:id` would otherwise shadow `GET rentals/today-board`
    // (Express matches in registration order; ParseUUIDPipe would 400 the board).
    GetRentalHttpController,
  ],
  providers: [
    RentalMapper,
    CreateRentalService,
    CancelRentalService,
    PickupRentalService,
    ReturnRentalService,
    UpdateRentalService,
    GetRentalQueryHandler,
    CheckAvailabilityQueryHandler,
    GetTodayBoardQueryHandler,
    ListBookedRangesQueryHandler,
    ListRentalsQueryHandler,
    QuoteLateFeeQueryHandler,
    { provide: RENTAL_REPOSITORY, useClass: RentalRepository },
    { provide: DRESS_LOOKUP, useClass: DressLookupAdapter },
    { provide: PAYMENT_RECORDER, useClass: PaymentRecorderAdapter },
  ],
})
export class RentalsModule {}

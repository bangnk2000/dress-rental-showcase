import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  RENTAL_REPOSITORY,
  RentalRepositoryPort,
} from '../../application/ports/rental.repository.port';
import { shopToday } from '../../../../libs/utils/date';
import { LateFeeQuoteResponseDto } from './quote-late-fee.response.dto';
import { QuoteLateFeeQuery } from './quote-late-fee.query';

@QueryHandler(QuoteLateFeeQuery)
export class QuoteLateFeeQueryHandler
  implements IQueryHandler<QuoteLateFeeQuery, LateFeeQuoteResponseDto | null>
{
  constructor(
    @Inject(RENTAL_REPOSITORY) private readonly rentalRepo: RentalRepositoryPort,
    private readonly config: ConfigService,
  ) {}

  /**
   * Loads the aggregate instead of hand-rolling SQL: the fee rule lives in the domain
   * (`RentalEntity.lateFeeQuote`), and the read side MUST NOT grow a second copy of it — that is
   * exactly how the number on the screen starts disagreeing with the number that gets charged.
   * Null = unknown rental (the controller maps it to the 404 envelope).
   */
  async execute(query: QuoteLateFeeQuery): Promise<LateFeeQuoteResponseDto | null> {
    const rental = await this.rentalRepo.findOneById(query.rentalId);
    if (!rental) return null;

    const quote = rental.lateFeeQuote(
      shopToday(),
      this.config.getOrThrow<number>('LATE_FEE_PER_DRESS_PER_DAY'),
    );

    return Object.assign(new LateFeeQuoteResponseDto(), {
      rentalId: rental.id,
      ...quote.toJSON(),
    });
  }
}

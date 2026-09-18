import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  DRESS_LOOKUP,
  DressLookupPort,
} from '../../application/ports/dress-lookup.port';
import {
  RENTAL_REPOSITORY,
  RentalRepositoryPort,
} from '../../application/ports/rental.repository.port';
import { RentalDetailDto } from './get-rental.response.dto';
import { GetRentalQuery } from './get-rental.query';

@QueryHandler(GetRentalQuery)
export class GetRentalQueryHandler
  implements IQueryHandler<GetRentalQuery, RentalDetailDto | null>
{
  constructor(
    @Inject(RENTAL_REPOSITORY) private readonly rentalRepo: RentalRepositoryPort,
    @Inject(DRESS_LOOKUP) private readonly dressLookup: DressLookupPort,
  ) {}

  /**
   * Loads the aggregate (one rental — no page, no filter, so the repository read IS the
   * projection) and decorates its items with catalog snapshots, like the list does. Null =
   * unknown rental (the controller maps it to the 404 envelope).
   */
  async execute(query: GetRentalQuery): Promise<RentalDetailDto | null> {
    const rental = await this.rentalRepo.findOneById(query.rentalId);
    if (!rental) return null;
    const props = rental.getProps();

    const dresses = await this.dressLookup.findByIds(props.items.map((item) => item.dressId));
    const dressById = new Map(dresses.map((dress) => [dress.id, dress]));
    const items = props.items.map((item) => {
      const dress = dressById.get(item.dressId);
      if (!dress) {
        // rental_items.dress_id is a FK — a miss means the lookup was fed wrong ids.
        throw new Error(`Dress ${item.dressId} missing from lookup`);
      }
      return {
        dressId: dress.id,
        code: dress.code,
        name: dress.name,
        depositAmount: dress.depositAmount,
        // The agreed price lives on the ITEM, not on the dress (the catalog may have moved).
        agreedPrice: item.price.amount,
        blockedUntilDate: item.blockedPeriod.end,
        blocking: item.blocking,
      };
    });
    items.sort((a, b) => a.code.localeCompare(b.code));

    return Object.assign(new RentalDetailDto(), {
      rentalId: props.id,
      customerName: props.customerName,
      customerPhone: props.customerPhone,
      status: props.status,
      startDate: props.period.start,
      endDate: props.period.end,
      notes: props.notes,
      discountAmount: props.discount.amount,
      createdAt: props.createdAt.toISOString(),
      updatedAt: props.updatedAt.toISOString(),
      dresses: items,
    });
  }
}

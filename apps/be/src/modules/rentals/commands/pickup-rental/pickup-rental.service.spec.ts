import { Money } from '../../../../libs/ddd/money.value-object';
import { RentalRepositoryPort } from '../../application/ports/rental.repository.port';
import { RentalEntity } from '../../domain/rental.entity';
import { RentalPeriod } from '../../domain/rental-period.value-object';
import {
  RentalNotFoundError,
  RentalPickupNotAllowedError,
} from '../../domain/rental.errors';
import { PickupRentalCommand } from './pickup-rental.command';
import { PickupRentalService } from './pickup-rental.service';

const RENTAL_ID = '00000000-0000-4000-8000-000000000100';

function makeRental(): RentalEntity {
  return RentalEntity.create(
    {
      customerName: 'Nguyễn Thị Hoa',
      customerPhone: '0903123456',
      period: RentalPeriod.create('2026-08-01', '2026-08-03'),
      notes: null,
      items: [
        {
          id: '00000000-0000-4000-8000-000000000101',
          dressId: '00000000-0000-4000-8000-00000000000a',
          price: Money.create(1_500_000),
        },
      ],
    },
    RENTAL_ID,
    new Date('2026-07-01T00:00:00Z'),
    2,
  );
}

function makeRepo(rental: RentalEntity | null): RentalRepositoryPort {
  return {
    insert: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
    findOneById: jest.fn().mockResolvedValue(rental),
    findBlockedDressIds: jest.fn().mockResolvedValue([]),
    nextId: jest.fn(() => 'unused'),
  };
}

const command = new PickupRentalCommand({ rentalId: RENTAL_ID });

test('books → out: saves and returns the rental id', async () => {
  const rental = makeRental();
  const repo = makeRepo(rental);

  const result = await new PickupRentalService(repo).execute(command);

  expect(result.isOk()).toBe(true);
  expect(result.unwrap()).toBe(RENTAL_ID);
  expect(rental.status).toBe('out');
  expect(repo.save).toHaveBeenCalledWith(rental);
});

test('an already handed-out rental cannot be handed out again', async () => {
  const rental = makeRental();
  rental.markPickedUp(new Date('2026-08-01T02:00:00Z'));
  const repo = makeRepo(rental);

  const result = await new PickupRentalService(repo).execute(command);

  expect(result.isErr()).toBe(true);
  expect(result.unwrapErr()).toBeInstanceOf(RentalPickupNotAllowedError);
  expect(repo.save).not.toHaveBeenCalled();
});

test('unknown rental → RentalNotFoundError', async () => {
  const result = await new PickupRentalService(makeRepo(null)).execute(command);

  expect(result.isErr()).toBe(true);
  expect(result.unwrapErr()).toBeInstanceOf(RentalNotFoundError);
});

import { Money } from '../../../../libs/ddd/money.value-object';
import { LedgerNotEmptyError } from '../../application/ports/ledger-not-empty.error';
import { RentalRepositoryPort } from '../../application/ports/rental.repository.port';
import { RentalEntity } from '../../domain/rental.entity';
import { RentalPeriod } from '../../domain/rental-period.value-object';
import {
  RentalCancelHasPaymentsError,
  RentalCancelNotAllowedError,
  RentalNotFoundError,
} from '../../domain/rental.errors';
import { CancelRentalCommand } from './cancel-rental.command';
import { CancelRentalService } from './cancel-rental.service';

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
        {
          id: '00000000-0000-4000-8000-000000000102',
          dressId: '00000000-0000-4000-8000-00000000000b',
          price: Money.create(1_200_000),
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
    saveReturned: jest.fn().mockResolvedValue(undefined),
    saveCancelled: jest.fn().mockResolvedValue(undefined),
    findOneById: jest.fn().mockResolvedValue(rental),
    findBlockedDressIds: jest.fn().mockResolvedValue([]),
    nextId: jest.fn(() => 'unused'),
  };
}

const command = new CancelRentalCommand({ rentalId: RENTAL_ID });

test('booked → cancelled: EVERY item stops blocking, saved through the ledger guard', async () => {
  const rental = makeRental();
  const repo = makeRepo(rental);

  const result = await new CancelRentalService(repo).execute(command);

  expect(result.isOk()).toBe(true);
  expect(rental.status).toBe('cancelled');
  expect(rental.items.every((item) => !item.blocking)).toBe(true);
  expect(repo.saveCancelled).toHaveBeenCalledWith(rental);
  expect(repo.save).not.toHaveBeenCalled(); // never the unguarded write
});

test('an OUT rental with an empty ledger cancels too — the born-out escape hatch (FR-RENT-10 §6.Q2)', async () => {
  const rental = makeRental();
  rental.markPickedUp(new Date('2026-08-01T02:00:00Z'));
  const repo = makeRepo(rental);

  const result = await new CancelRentalService(repo).execute(command);

  expect(result.isOk()).toBe(true);
  expect(rental.status).toBe('cancelled');
  expect(rental.items.every((item) => !item.blocking)).toBe(true);
});

test('recorded money refuses the cancel with its own outcome — settle through return instead', async () => {
  const rental = makeRental();
  const repo = makeRepo(rental);
  (repo.saveCancelled as jest.Mock).mockRejectedValue(new LedgerNotEmptyError());

  const result = await new CancelRentalService(repo).execute(command);

  expect(result.isErr()).toBe(true);
  expect(result.unwrapErr()).toBeInstanceOf(RentalCancelHasPaymentsError);
});

test('a returned rental cannot be cancelled', async () => {
  const rental = makeRental();
  rental.markPickedUp(new Date('2026-08-01T02:00:00Z'));
  rental.markReturned(new Date('2026-08-03T10:00:00Z'));

  const result = await new CancelRentalService(makeRepo(rental)).execute(command);

  expect(result.isErr()).toBe(true);
  expect(result.unwrapErr()).toBeInstanceOf(RentalCancelNotAllowedError);
});

test('unknown rental → RentalNotFoundError', async () => {
  const result = await new CancelRentalService(makeRepo(null)).execute(command);

  expect(result.isErr()).toBe(true);
  expect(result.unwrapErr()).toBeInstanceOf(RentalNotFoundError);
});

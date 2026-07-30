import { Money } from '../../../../libs/ddd/money.value-object';
import { PaymentRecorderPort } from '../../application/ports/payment-recorder.port';
import { RentalRepositoryPort } from '../../application/ports/rental.repository.port';
import { RentalEntity } from '../../domain/rental.entity';
import { RentalPeriod } from '../../domain/rental-period.value-object';
import {
  RentalNotFoundError,
  RentalReturnNotAllowedError,
} from '../../domain/rental.errors';
import { ReturnRentalCommand } from './return-rental.command';
import { ReturnRentalService } from './return-rental.service';

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

function makeRecorder(): PaymentRecorderPort {
  return { recordSettlement: jest.fn().mockResolvedValue(undefined) };
}

function makeCommand(overrides: Partial<ReturnRentalCommand> = {}): ReturnRentalCommand {
  return new ReturnRentalCommand({
    rentalId: RENTAL_ID,
    lateFee: null,
    damageFee: null,
    depositRefund: null,
    note: null,
    ...overrides,
  });
}

test('out → returned: records the nonzero movements with the note', async () => {
  const rental = makeRental();
  rental.markPickedUp(new Date('2026-08-01T02:00:00Z'));
  const repo = makeRepo(rental);
  const recorder = makeRecorder();

  const result = await new ReturnRentalService(repo, recorder).execute(
    makeCommand({
      lateFee: 200_000,
      damageFee: 0,
      depositRefund: 2_800_000,
      note: 'Trễ 1 ngày',
    }),
  );

  expect(result.isOk()).toBe(true);
  expect(rental.status).toBe('returned');
  expect(repo.save).toHaveBeenCalledWith(rental);
  // zero-amount damage fee is NOT recorded; the note rides on every row
  expect(recorder.recordSettlement).toHaveBeenCalledWith(RENTAL_ID, [
    { kind: 'late_fee', amount: 200_000, note: 'Trễ 1 ngày' },
    { kind: 'deposit_refund', amount: 2_800_000, note: 'Trễ 1 ngày' },
  ]);
});

test('a booked rental may be returned directly (pickup tap skipped)', async () => {
  const rental = makeRental();
  const recorder = makeRecorder();

  const result = await new ReturnRentalService(makeRepo(rental), recorder).execute(
    makeCommand(),
  );

  expect(result.isOk()).toBe(true);
  expect(rental.status).toBe('returned');
  // nothing to settle → no payments written at all
  expect(recorder.recordSettlement).toHaveBeenCalledWith(RENTAL_ID, []);
});

test('an already returned rental cannot be returned again', async () => {
  const rental = makeRental();
  rental.markReturned(new Date('2026-08-03T10:00:00Z'));
  const repo = makeRepo(rental);
  const recorder = makeRecorder();

  const result = await new ReturnRentalService(repo, recorder).execute(makeCommand());

  expect(result.isErr()).toBe(true);
  expect(result.unwrapErr()).toBeInstanceOf(RentalReturnNotAllowedError);
  expect(repo.save).not.toHaveBeenCalled();
  expect(recorder.recordSettlement).not.toHaveBeenCalled();
});

test('unknown rental → RentalNotFoundError', async () => {
  const result = await new ReturnRentalService(makeRepo(null), makeRecorder()).execute(
    makeCommand(),
  );

  expect(result.isErr()).toBe(true);
  expect(result.unwrapErr()).toBeInstanceOf(RentalNotFoundError);
});

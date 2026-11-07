import { CommandProps } from '../../../../libs/ddd/command.base';
import { Money } from '../../../../libs/ddd/money.value-object';
import { LedgerBasisChangedError } from '../../application/ports/ledger-basis-changed.error';
import { LedgerNotEmptyError } from '../../application/ports/ledger-not-empty.error';
import { RentalStateChangedError } from '../../application/ports/rental-state-changed.error';
import { RentalRepositoryPort } from '../../application/ports/rental.repository.port';
import { RentalEntity } from '../../domain/rental.entity';
import { RentalPeriod } from '../../domain/rental-period.value-object';
import {
  CancelBasisChangedError,
  CancelRetentionNotAllowedError,
  CancelRetentionNoteRequiredError,
  RefundExceedsCollectedError,
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
      discount: Money.create(0),
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
    saveUpdated: jest.fn().mockResolvedValue(undefined),
    findOneById: jest.fn().mockResolvedValue(rental),
    findBlockedDressIds: jest.fn().mockResolvedValue([]),
    nextId: jest.fn(() => 'unused'),
  };
}

type CancelInput = Partial<Omit<CommandProps<CancelRentalCommand>, 'rentalId'>>;

function cancelCommand(input: CancelInput = {}): CancelRentalCommand {
  return new CancelRentalCommand({
    rentalId: RENTAL_ID,
    expectedDepositCollected: null,
    expectedRentalFeeCollected: null,
    depositRefund: null,
    rentalFeeRefund: null,
    note: null,
    actorRole: 'staff',
    ...input,
  });
}

const command = cancelCommand();

test('booked → cancelled: EVERY item stops blocking, saved through the ledger guard', async () => {
  const rental = makeRental();
  const repo = makeRepo(rental);

  const result = await new CancelRentalService(repo).execute(command);

  expect(result.isOk()).toBe(true);
  expect(rental.status).toBe('cancelled');
  expect(rental.items.every((item) => !item.blocking)).toBe(true);
  expect(repo.saveCancelled).toHaveBeenCalledWith(rental, null); // no claim = empty-ledger cancel
  expect(repo.save).not.toHaveBeenCalled(); // never the unguarded write
});

describe('cancel with refunds (rentals/cancel-with-refund)', () => {
  const PAID = { expectedDepositCollected: 3_000_000, expectedRentalFeeCollected: 1_500_000 };

  test('staff refunding in full: settlement carries the basis and both refund rows', async () => {
    const rental = makeRental();
    const repo = makeRepo(rental);

    const result = await new CancelRentalService(repo).execute(
      cancelCommand({ ...PAID, depositRefund: 3_000_000, rentalFeeRefund: 1_500_000 }),
    );

    expect(result.isOk()).toBe(true);
    expect(repo.saveCancelled).toHaveBeenCalledWith(rental, {
      ...PAID,
      refunds: [
        { kind: 'deposit_refund', amount: 3_000_000, note: null },
        { kind: 'rental_fee_refund', amount: 1_500_000, note: null },
      ],
    });
  });

  test('a zero refund writes no row (BR-4) — owner keeps the fee with a note', async () => {
    const rental = makeRental();
    const repo = makeRepo(rental);

    const result = await new CancelRentalService(repo).execute(
      cancelCommand({ ...PAID, depositRefund: 3_000_000, note: 'Huỷ sát ngày', actorRole: 'owner' }),
    );

    expect(result.isOk()).toBe(true);
    expect(repo.saveCancelled).toHaveBeenCalledWith(rental, {
      ...PAID,
      refunds: [{ kind: 'deposit_refund', amount: 3_000_000, note: 'Huỷ sát ngày' }],
    });
  });

  test('refund above what was collected → RefundExceedsCollectedError, nothing saved', async () => {
    const repo = makeRepo(makeRental());

    const result = await new CancelRentalService(repo).execute(
      cancelCommand({ ...PAID, depositRefund: 3_000_001, rentalFeeRefund: 1_500_000 }),
    );

    const error = result.unwrapErr() as RefundExceedsCollectedError;
    expect(error).toBeInstanceOf(RefundExceedsCollectedError);
    expect([error.kind, error.collected, error.submitted]).toEqual(['deposit', 3_000_000, 3_000_001]);
    expect(repo.saveCancelled).not.toHaveBeenCalled();
  });

  test('staff keeping money → CancelRetentionNotAllowedError (403 forbidden)', async () => {
    const repo = makeRepo(makeRental());

    const result = await new CancelRentalService(repo).execute(
      cancelCommand({ ...PAID, depositRefund: 3_000_000, rentalFeeRefund: 1_000_000, note: 'x' }),
    );

    const error = result.unwrapErr() as CancelRetentionNotAllowedError;
    expect(error).toBeInstanceOf(CancelRetentionNotAllowedError);
    expect(error.retainedAmount).toBe(500_000);
    expect(repo.saveCancelled).not.toHaveBeenCalled();
  });

  test('owner keeping money without a note → CancelRetentionNoteRequiredError', async () => {
    const repo = makeRepo(makeRental());

    const result = await new CancelRentalService(repo).execute(
      cancelCommand({ ...PAID, depositRefund: 0, rentalFeeRefund: 0, note: '  ', actorRole: 'owner' }),
    );

    const error = result.unwrapErr() as CancelRetentionNoteRequiredError;
    expect(error).toBeInstanceOf(CancelRetentionNoteRequiredError);
    expect(error.retainedAmount).toBe(4_500_000);
  });

  test('basis moved under the lock → CancelBasisChangedError with what IS on file', async () => {
    const repo = makeRepo(makeRental());
    (repo.saveCancelled as jest.Mock).mockRejectedValue(
      new LedgerBasisChangedError(2_000_000, 1_500_000),
    );

    const result = await new CancelRentalService(repo).execute(
      cancelCommand({ ...PAID, depositRefund: 3_000_000, rentalFeeRefund: 1_500_000 }),
    );

    const error = result.unwrapErr() as CancelBasisChangedError;
    expect(error).toBeInstanceOf(CancelBasisChangedError);
    expect([error.collectedDeposit, error.collectedRentalFee]).toEqual([2_000_000, 1_500_000]);
  });

  test('closed between load and lock → the same rejected_cancel_not_allowed', async () => {
    const repo = makeRepo(makeRental());
    (repo.saveCancelled as jest.Mock).mockRejectedValue(new RentalStateChangedError('returned'));

    const result = await new CancelRentalService(repo).execute(command);

    const error = result.unwrapErr() as RentalCancelNotAllowedError;
    expect(error).toBeInstanceOf(RentalCancelNotAllowedError);
    expect(error.currentStatus).toBe('returned');
  });
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

test('an OUT rental with recorded money refuses the cancel — settle through return instead', async () => {
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

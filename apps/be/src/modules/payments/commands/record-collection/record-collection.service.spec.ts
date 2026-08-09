import { CollectionConflictError } from '../../application/ports/collection-conflict.error';
import {
  PaymentRepositoryPort,
  RecordedCollection,
} from '../../application/ports/payment.repository.port';
import {
  RentalLookupPort,
  RentalStatusSnapshot,
} from '../../application/ports/rental-lookup.port';
import { PaymentEntity } from '../../domain/payment.entity';
import {
  CollectionAlreadyRecordedError,
  CollectionRentalNotFoundError,
  NothingToRecordError,
  RentalClosedError,
} from '../../domain/payment.errors';
import { RecordCollectionCommand } from './record-collection.command';
import { RecordCollectionService } from './record-collection.service';

const RENTAL_ID = '00000000-0000-4000-8000-000000000100';

function makeLookup(status: RentalStatusSnapshot | null): RentalLookupPort {
  return { findStatus: jest.fn().mockResolvedValue(status) };
}

/** `collected` may be a single answer or one answer per call (pre-check, then the race re-read). */
function makeRepo(
  collected: RecordedCollection[] | RecordedCollection[][],
  recordCollection: jest.Mock = jest.fn().mockResolvedValue(undefined),
): PaymentRepositoryPort {
  const findCollected = Array.isArray(collected[0])
    ? jest.fn().mockImplementation(() => {
        const answers = collected as RecordedCollection[][];
        return Promise.resolve(answers.shift() ?? []);
      })
    : jest.fn().mockResolvedValue(collected);

  let seq = 0;
  return {
    nextId: jest.fn(() => `00000000-0000-4000-8000-00000000020${seq++}`),
    findCollected,
    recordCollection,
  };
}

function command(props: Partial<RecordCollectionCommand> = {}): RecordCollectionCommand {
  return new RecordCollectionCommand({
    rentalId: RENTAL_ID,
    deposit: null,
    rentalFee: null,
    note: null,
    ...props,
  });
}

/** The entities handed to the repository — what would actually hit the table. */
function written(recordCollection: jest.Mock): Array<{ kind: string; amount: number }> {
  const payments = recordCollection.mock.calls[0]![0] as PaymentEntity[];
  return payments.map((payment) => ({ kind: payment.kind, amount: payment.amount }));
}

test('AC1: deposit and rental fee are recorded together, both carrying the note', async () => {
  const recordCollection = jest.fn().mockResolvedValue(undefined);
  const repo = makeRepo([], recordCollection);

  const result = await new RecordCollectionService(repo, makeLookup('booked')).execute(
    command({ deposit: 3_000_000, rentalFee: 1_500_000, note: 'Khách chuyển khoản' }),
  );

  expect(result.isOk()).toBe(true);
  expect(result.unwrap()).toBe(RENTAL_ID);
  expect(written(recordCollection)).toEqual([
    { kind: 'deposit', amount: 3_000_000 },
    { kind: 'rental_fee', amount: 1_500_000 },
  ]);
  const payments = recordCollection.mock.calls[0]![0] as PaymentEntity[];
  expect(payments.map((payment) => payment.getProps().note)).toEqual([
    'Khách chuyển khoản',
    'Khách chuyển khoản',
  ]);
});

test('AC1: only the amount that was sent becomes a row — the other is not a 0₫ movement', async () => {
  const recordCollection = jest.fn().mockResolvedValue(undefined);
  const repo = makeRepo([], recordCollection);

  const result = await new RecordCollectionService(repo, makeLookup('out')).execute(
    command({ deposit: 3_000_000 }),
  );

  expect(result.isOk()).toBe(true);
  expect(written(recordCollection)).toEqual([{ kind: 'deposit', amount: 3_000_000 }]);
});

test('AC2: a deposit already on file is refused with the amount that is there', async () => {
  const recordCollection = jest.fn();
  const repo = makeRepo([{ kind: 'deposit', amount: 2_500_000 }], recordCollection);

  const result = await new RecordCollectionService(repo, makeLookup('booked')).execute(
    command({ deposit: 3_000_000 }),
  );

  expect(result.isErr()).toBe(true);
  const error = result.unwrapErr() as CollectionAlreadyRecordedError;
  expect(error).toBeInstanceOf(CollectionAlreadyRecordedError);
  expect(error.kind).toBe('deposit');
  expect(error.recordedAmount).toBe(2_500_000);
  expect(recordCollection).not.toHaveBeenCalled();
});

test('AC2: the rental fee clashes on its own — a recorded deposit does not block it', async () => {
  const recordCollection = jest.fn().mockResolvedValue(undefined);
  const repo = makeRepo([{ kind: 'deposit', amount: 3_000_000 }], recordCollection);

  const result = await new RecordCollectionService(repo, makeLookup('booked')).execute(
    command({ rentalFee: 1_500_000 }),
  );

  expect(result.isOk()).toBe(true);
  expect(written(recordCollection)).toEqual([{ kind: 'rental_fee', amount: 1_500_000 }]);
});

test('AC2: losing the UNIQUE race answers the SAME outcome as the pre-check, with fresh numbers', async () => {
  // Pre-check sees an empty ledger; by the time we write, a concurrent request has recorded.
  const recordCollection = jest.fn().mockRejectedValue(new CollectionConflictError());
  const repo = makeRepo([[], [{ kind: 'deposit', amount: 3_000_000 }]], recordCollection);

  const result = await new RecordCollectionService(repo, makeLookup('booked')).execute(
    command({ deposit: 3_000_000 }),
  );

  expect(result.isErr()).toBe(true);
  const error = result.unwrapErr() as CollectionAlreadyRecordedError;
  expect(error).toBeInstanceOf(CollectionAlreadyRecordedError);
  expect(error.recordedAmount).toBe(3_000_000);
});

test.each(['returned', 'cancelled'] as const)(
  'AC3: a %s rental takes no money, and nothing is written',
  async (status) => {
    const recordCollection = jest.fn();
    const repo = makeRepo([], recordCollection);

    const result = await new RecordCollectionService(repo, makeLookup(status)).execute(
      command({ deposit: 3_000_000 }),
    );

    expect(result.isErr()).toBe(true);
    const error = result.unwrapErr() as RentalClosedError;
    expect(error).toBeInstanceOf(RentalClosedError);
    expect(error.currentStatus).toBe(status);
    expect(recordCollection).not.toHaveBeenCalled();
  },
);

test('AC4: a call with no amount at all is a business rejection, not a write', async () => {
  const recordCollection = jest.fn();
  const repo = makeRepo([], recordCollection);

  const result = await new RecordCollectionService(repo, makeLookup('booked')).execute(command());

  expect(result.isErr()).toBe(true);
  expect(result.unwrapErr()).toBeInstanceOf(NothingToRecordError);
  expect(recordCollection).not.toHaveBeenCalled();
});

test('an unknown rental is refused before anything is read from the ledger', async () => {
  const repo = makeRepo([]);

  const result = await new RecordCollectionService(repo, makeLookup(null)).execute(
    command({ deposit: 3_000_000 }),
  );

  expect(result.isErr()).toBe(true);
  expect(result.unwrapErr()).toBeInstanceOf(CollectionRentalNotFoundError);
  expect(repo.findCollected).not.toHaveBeenCalled();
});

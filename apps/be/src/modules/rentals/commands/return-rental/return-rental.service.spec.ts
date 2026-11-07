import { ConfigService } from '@nestjs/config';
import { Money } from '../../../../libs/ddd/money.value-object';
import { PaymentRecorderPort } from '../../application/ports/payment-recorder.port';
import { RentalRepositoryPort } from '../../application/ports/rental.repository.port';
import { RentalEntity } from '../../domain/rental.entity';
import { RentalPeriod } from '../../domain/rental-period.value-object';
import {
  LateFeeWaiverNotAllowedError,
  LateFeeWaiverNoteRequiredError,
  RentalNotFoundError,
  RentalReturnNotAllowedError,
  ReturnDepositBasisChangedError,
} from '../../domain/rental.errors';
import { DepositBasisChangedError } from '../../application/ports/deposit-basis-changed.error';
import { ReturnRentalCommand } from './return-rental.command';
import { ReturnRentalService } from './return-rental.service';

const RENTAL_ID = '00000000-0000-4000-8000-000000000100';
const DRESS_A = '00000000-0000-4000-8000-00000000000a';
const DRESS_B = '00000000-0000-4000-8000-00000000000b';

/** Rental of `dressCount` dresses due 2026-08-03 (inclusive). */
function makeRental(dressCount = 1): RentalEntity {
  const dressIds = [DRESS_A, DRESS_B].slice(0, dressCount);
  return RentalEntity.create(
    {
      customerName: 'Nguyễn Thị Hoa',
      customerPhone: '0903123456',
      period: RentalPeriod.create('2026-08-01', '2026-08-03'),
      notes: null,
      discount: Money.create(0),
      items: dressIds.map((dressId, index) => ({
        id: `00000000-0000-4000-8000-00000000010${index}`,
        dressId,
        price: Money.create(1_500_000),
      })),
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
    savePickedUp: jest.fn().mockResolvedValue(undefined),
    saveUpdated: jest.fn().mockResolvedValue(undefined),
    findOneById: jest.fn().mockResolvedValue(rental),
    findBlockedDressIds: jest.fn().mockResolvedValue([]),
    nextId: jest.fn(() => 'unused'),
  };
}

function makeRecorder(): PaymentRecorderPort {
  return { recordSettlement: jest.fn().mockResolvedValue(undefined) };
}

/** LATE_FEE_PER_DRESS_PER_DAY = 200.000₫, the rate the shop owner approved (FR-RENT-09 §6.Q1). */
const config = { getOrThrow: jest.fn().mockReturnValue(200_000) } as unknown as ConfigService;

function makeCommand(overrides: Partial<ReturnRentalCommand> = {}): ReturnRentalCommand {
  return new ReturnRentalCommand({
    rentalId: RENTAL_ID,
    lateFee: null,
    damageFee: null,
    depositRefund: null,
    expectedDepositCollected: null,
    note: null,
    actorRole: 'staff',
    ...overrides,
  });
}

function makeService(rental: RentalEntity | null): {
  service: ReturnRentalService;
  repo: RentalRepositoryPort;
  recorder: PaymentRecorderPort;
} {
  const repo = makeRepo(rental);
  const recorder = makeRecorder();
  return { service: new ReturnRentalService(repo, recorder, config), repo, recorder };
}

/** The late fee depends on the shop's TODAY, so every test pins it. */
function freezeShopDay(isoDate: string): void {
  jest.useFakeTimers().setSystemTime(new Date(`${isoDate}T05:00:00+07:00`));
}

afterEach(() => {
  jest.useRealTimers();
});

test('out → returned: records the nonzero movements with the note', async () => {
  freezeShopDay('2026-08-04'); // one day late × 1 dress → suggested 200.000
  const rental = makeRental();
  rental.markPickedUp(new Date('2026-08-01T02:00:00Z'));
  const { service, repo, recorder } = makeService(rental);

  const result = await service.execute(
    makeCommand({
      lateFee: 200_000,
      damageFee: 0,
      depositRefund: 2_800_000,
      note: 'Trễ 1 ngày',
    }),
  );

  expect(result.isOk()).toBe(true);
  expect(rental.status).toBe('returned');
  // The settlement path writes through saveReturned: the deposit basis is verified in the same
  // transaction as the status flip (FR-PAY-02).
  expect(repo.saveReturned).toHaveBeenCalledWith(rental, null);
  // zero-amount damage fee is NOT recorded; the note rides on every row
  expect(recorder.recordSettlement).toHaveBeenCalledWith(RENTAL_ID, [
    { kind: 'late_fee', amount: 200_000, note: 'Trễ 1 ngày' },
    { kind: 'deposit_refund', amount: 2_800_000, note: 'Trễ 1 ngày' },
  ]);
});

test('FR-RENT-10 R1: a booked rental CANNOT be returned — nothing was handed over yet', async () => {
  freezeShopDay('2026-08-03');
  const rental = makeRental();
  const { service, repo, recorder } = makeService(rental);

  const result = await service.execute(makeCommand());

  expect(result.isErr()).toBe(true);
  const error = result.unwrapErr();
  expect(error).toBeInstanceOf(RentalReturnNotAllowedError);
  expect((error as RentalReturnNotAllowedError).currentStatus).toBe('booked');
  expect(rental.status).toBe('booked');
  // No status flip, no money: the settlement never starts.
  expect(repo.saveReturned).not.toHaveBeenCalled();
  expect(recorder.recordSettlement).not.toHaveBeenCalled();
});

test('AC2: omitting lateFee charges the SUGGESTED fee, per dress per late day', async () => {
  freezeShopDay('2026-08-06'); // 3 days late × 2 dresses × 200.000 = 1.200.000
  const rental = makeRental(2);
  rental.markPickedUp(new Date('2026-08-01T02:00:00Z'));
  const { service, recorder } = makeService(rental);

  const result = await service.execute(makeCommand({ note: 'Khách trả muộn 3 ngày' }));

  expect(result.isOk()).toBe(true);
  expect(recorder.recordSettlement).toHaveBeenCalledWith(RENTAL_ID, [
    { kind: 'late_fee', amount: 1_200_000, note: 'Khách trả muộn 3 ngày' },
  ]);
});

test('AC3: staff charging LESS than suggested is refused, and nothing is written', async () => {
  freezeShopDay('2026-08-06');
  const rental = makeRental();
  rental.markPickedUp(new Date('2026-08-01T02:00:00Z'));
  const { service, repo, recorder } = makeService(rental);

  const result = await service.execute(
    makeCommand({ lateFee: 100_000, note: 'Khách quen, bớt cho' }),
  );

  expect(result.isErr()).toBe(true);
  const error = result.unwrapErr();
  expect(error).toBeInstanceOf(LateFeeWaiverNotAllowedError);
  expect((error as LateFeeWaiverNotAllowedError).suggestedLateFee).toBe(600_000);
  expect((error as LateFeeWaiverNotAllowedError).submittedLateFee).toBe(100_000);
  expect(repo.saveReturned).not.toHaveBeenCalled();
  expect(recorder.recordSettlement).not.toHaveBeenCalled();
});

test('AC3: an owner waiver without a reason is refused', async () => {
  freezeShopDay('2026-08-06');
  const pickedUp = makeRental();
  pickedUp.markPickedUp(new Date('2026-08-01T02:00:00Z'));
  const { service, repo } = makeService(pickedUp);

  const result = await service.execute(
    makeCommand({ actorRole: 'owner', lateFee: 0, note: '   ' }),
  );

  expect(result.unwrapErr()).toBeInstanceOf(LateFeeWaiverNoteRequiredError);
  expect(repo.saveReturned).not.toHaveBeenCalled();
});

test('AC3: an owner waiver WITH a reason records the reduced amount', async () => {
  freezeShopDay('2026-08-06');
  const rental = makeRental();
  rental.markPickedUp(new Date('2026-08-01T02:00:00Z'));
  const { service, recorder } = makeService(rental);

  const result = await service.execute(
    makeCommand({ actorRole: 'owner', lateFee: 100_000, note: 'Khách quen, chủ tiệm giảm' }),
  );

  expect(result.isOk()).toBe(true);
  expect(rental.status).toBe('returned');
  expect(recorder.recordSettlement).toHaveBeenCalledWith(RENTAL_ID, [
    { kind: 'late_fee', amount: 100_000, note: 'Khách quen, chủ tiệm giảm' },
  ]);
});

test('charging MORE than suggested is a private arrangement and stays allowed for staff', async () => {
  freezeShopDay('2026-08-04'); // suggested 200.000
  const overpaid = makeRental();
  overpaid.markPickedUp(new Date('2026-08-01T02:00:00Z'));
  const { service, recorder } = makeService(overpaid);

  const result = await service.execute(
    makeCommand({ lateFee: 500_000, note: 'Khách đồng ý bù thêm' }),
  );

  expect(result.isOk()).toBe(true);
  expect(recorder.recordSettlement).toHaveBeenCalledWith(RENTAL_ID, [
    { kind: 'late_fee', amount: 500_000, note: 'Khách đồng ý bù thêm' },
  ]);
});

test('the lifecycle rule wins over the fee rule: already returned → not-allowed', async () => {
  freezeShopDay('2026-08-06');
  const rental = makeRental();
  rental.markReturned(new Date('2026-08-03T10:00:00Z'));
  const { service, repo, recorder } = makeService(rental);

  // A staff waiver on an already-returned rental must not be reported as a fee problem.
  const result = await service.execute(makeCommand({ lateFee: 0 }));

  expect(result.unwrapErr()).toBeInstanceOf(RentalReturnNotAllowedError);
  expect(repo.saveReturned).not.toHaveBeenCalled();
  expect(recorder.recordSettlement).not.toHaveBeenCalled();
});

test('unknown rental → RentalNotFoundError', async () => {
  freezeShopDay('2026-08-06');
  const { service } = makeService(null);

  const result = await service.execute(makeCommand());

  expect(result.isErr()).toBe(true);
  expect(result.unwrapErr()).toBeInstanceOf(RentalNotFoundError);
});

test('FR-PAY-02: a deposit recorded during the write refuses the settlement and states what is on file', async () => {
  freezeShopDay('2026-08-03');
  const rental = makeRental();
  rental.markPickedUp(new Date('2026-08-01T02:00:00Z'));
  const { service, repo, recorder } = makeService(rental);
  // The repository verified the basis under the rental's row lock and found a different number.
  (repo.saveReturned as jest.Mock).mockRejectedValue(new DepositBasisChangedError(2_000_000));

  const result = await service.execute(
    makeCommand({ expectedDepositCollected: 0, depositRefund: 3_000_000 }),
  );

  expect(result.isErr()).toBe(true);
  const error = result.unwrapErr() as ReturnDepositBasisChangedError;
  expect(error).toBeInstanceOf(ReturnDepositBasisChangedError);
  expect(error.collectedDeposit).toBe(2_000_000);
  // Nothing settled: no movement may be written against a refund the basis no longer supports.
  expect(recorder.recordSettlement).not.toHaveBeenCalled();
});

test('FR-PAY-02: the expected basis is passed to the write, so the check happens under its lock', async () => {
  freezeShopDay('2026-08-03');
  const rental = makeRental();
  rental.markPickedUp(new Date('2026-08-01T02:00:00Z'));
  const { service, repo } = makeService(rental);

  await service.execute(makeCommand({ expectedDepositCollected: 2_000_000 }));

  expect(repo.saveReturned).toHaveBeenCalledWith(rental, 2_000_000);
});

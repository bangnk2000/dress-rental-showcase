import { ConfigService } from '@nestjs/config';
import { CreateRentalCommand } from './create-rental.command';
import { CreateRentalService } from './create-rental.service';
import { DressLookupPort, DressSnapshot } from '../../application/ports/dress-lookup.port';
import { RentalRepositoryPort } from '../../application/ports/rental.repository.port';
import { RentalEntity } from '../../domain/rental.entity';
import {
  DressUnavailableError,
  RentalDressNotFoundError,
  RentalDressRetiredError,
} from '../../domain/rental.errors';

const DRESS_A = '00000000-0000-4000-8000-00000000000a';
const DRESS_B = '00000000-0000-4000-8000-00000000000b';

function makeRentalRepo(overrides: Partial<RentalRepositoryPort> = {}): RentalRepositoryPort {
  let seq = 0;
  return {
    insert: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
    saveReturned: jest.fn().mockResolvedValue(undefined),
    saveCancelled: jest.fn().mockResolvedValue(undefined),
    findOneById: jest.fn().mockResolvedValue(null),
    findBlockedDressIds: jest.fn().mockResolvedValue([]),
    nextId: jest.fn(() => `00000000-0000-4000-8000-00000000010${seq++}`),
    ...overrides,
  };
}

function makeDressLookup(snapshots: DressSnapshot[]): DressLookupPort {
  return { findByIds: jest.fn().mockResolvedValue(snapshots) };
}

/** CLEANING_BUFFER_DAYS = 2, like the config default. */
const config = { getOrThrow: jest.fn().mockReturnValue(2) } as unknown as ConfigService;

const baseCommand = new CreateRentalCommand({
  customerName: 'Nguyễn Thị Hoa',
  customerPhone: '0903123456',
  startDate: '2026-08-01',
  endDate: '2026-08-03',
  notes: null,
  items: [
    { dressId: DRESS_A, price: null },
    { dressId: DRESS_B, price: 900_000 },
  ],
});

const snapshotA: DressSnapshot = {
  id: DRESS_A,
  code: 'VD-001',
  name: 'Váy cưới ren trắng',
  retired: false,
  rentalPrice: 1_500_000,
  depositAmount: 3_000_000,
};
const snapshotB: DressSnapshot = {
  id: DRESS_B,
  code: 'VD-002',
  name: 'Đầm dạ hội đỏ',
  retired: false,
  rentalPrice: 1_200_000,
  depositAmount: 2_000_000,
};
const bothDresses: DressSnapshot[] = [snapshotA, snapshotB];

describe('CreateRentalService', () => {
  // FR-RENT-10 compares period.start against the SHOP's today, so every test pins the clock.
  // 2026-07-15 makes the base command's 2026-08-01 a FUTURE booking (born booked).
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-15T05:00:00+07:00'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a booked rental; items block period + cleaning buffer and default the price', async () => {
    const repo = makeRentalRepo();
    const service = new CreateRentalService(repo, makeDressLookup(bothDresses), config);

    const result = await service.execute(baseCommand);

    expect(result.isOk()).toBe(true);
    expect(repo.insert).toHaveBeenCalledTimes(1);
    const rental = (repo.insert as jest.Mock).mock.calls[0][0] as RentalEntity;
    const props = rental.getProps();
    expect(props.status).toBe('booked');
    expect(props.period.start).toBe('2026-08-01');
    expect(props.period.end).toBe('2026-08-03');
    const [first, second] = props.items;
    expect(props.items).toHaveLength(2);
    // blocked = rental period + 2 buffer days, for every item
    expect(first?.blockedPeriod.end).toBe('2026-08-05');
    // omitted price falls back to the dress standard price; explicit price wins
    expect(first?.price.amount).toBe(1_500_000);
    expect(second?.price.amount).toBe(900_000);
    expect(rental.domainEvents).toHaveLength(1); // RentalCreatedDomainEvent queued
  });

  it('FR-RENT-10 R2: a rental starting TODAY (shop day) is born delivered — status out, both events', async () => {
    jest.setSystemTime(new Date('2026-08-01T05:00:00+07:00')); // shopToday = period.start
    const repo = makeRentalRepo();
    const service = new CreateRentalService(repo, makeDressLookup(bothDresses), config);

    const result = await service.execute(baseCommand);

    expect(result.isOk()).toBe(true);
    const rental = (repo.insert as jest.Mock).mock.calls[0][0] as RentalEntity;
    expect(rental.getProps().status).toBe('out');
    // Created + PickedUp queued together: no consumer ever sees an out rental without its event.
    expect(rental.domainEvents).toHaveLength(2);
    // Auto-pickup changes STATUS only — the calendar block is untouched.
    expect(rental.getProps().items[0]?.blockedPeriod.end).toBe('2026-08-05');
  });

  it('FR-RENT-10 §6.Q1: a BACKDATED create is born delivered too — the handover already happened', async () => {
    jest.setSystemTime(new Date('2026-08-09T05:00:00+07:00')); // period is fully in the past
    const repo = makeRentalRepo();
    const service = new CreateRentalService(repo, makeDressLookup(bothDresses), config);

    const result = await service.execute(baseCommand);

    expect(result.isOk()).toBe(true);
    const rental = (repo.insert as jest.Mock).mock.calls[0][0] as RentalEntity;
    expect(rental.getProps().status).toBe('out');
  });

  it('the shop timezone decides, not UTC: late evening in Hanoi is already the next day', async () => {
    // 2026-07-31T18:00Z = 2026-08-01 01:00 Asia/Ho_Chi_Minh → start IS today at the shop.
    jest.setSystemTime(new Date('2026-07-31T18:00:00Z'));
    const repo = makeRentalRepo();
    const service = new CreateRentalService(repo, makeDressLookup(bothDresses), config);

    await service.execute(baseCommand);

    const rental = (repo.insert as jest.Mock).mock.calls[0][0] as RentalEntity;
    expect(rental.getProps().status).toBe('out');
  });

  it('checks availability for the buffered period, not just the rental days', async () => {
    const repo = makeRentalRepo();
    const service = new CreateRentalService(repo, makeDressLookup(bothDresses), config);

    await service.execute(baseCommand);

    expect(repo.findBlockedDressIds).toHaveBeenCalledWith(
      [DRESS_A, DRESS_B],
      expect.objectContaining({ props: { start: '2026-08-01', end: '2026-08-05' } }),
    );
  });

  it('returns Err(RentalDressNotFoundError) when a dress id does not exist', async () => {
    const repo = makeRentalRepo();
    const service = new CreateRentalService(repo, makeDressLookup([snapshotA]), config);

    const result = await service.execute(baseCommand);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(RentalDressNotFoundError);
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('returns Err(RentalDressRetiredError) when a dress is retired', async () => {
    const repo = makeRentalRepo();
    const snapshots = [snapshotA, { ...snapshotB, retired: true }];
    const service = new CreateRentalService(repo, makeDressLookup(snapshots), config);

    const result = await service.execute(baseCommand);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(RentalDressRetiredError);
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('returns Err(DressUnavailableError) when a dress has an overlapping blocking item', async () => {
    const repo = makeRentalRepo({
      findBlockedDressIds: jest.fn().mockResolvedValue([DRESS_B]),
    });
    const service = new CreateRentalService(repo, makeDressLookup(bothDresses), config);

    const result = await service.execute(baseCommand);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(DressUnavailableError);
    expect(repo.insert).not.toHaveBeenCalled();
  });
});

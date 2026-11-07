import { ConfigService } from '@nestjs/config';
import { Money } from '../../../../libs/ddd/money.value-object';
import { DressLookupPort, DressSnapshot } from '../../application/ports/dress-lookup.port';
import { RentalItemsOverlapError } from '../../application/ports/rental-overlap.error';
import { RentalStateChangedError } from '../../application/ports/rental-state-changed.error';
import { RentalRepositoryPort } from '../../application/ports/rental.repository.port';
import { RentalEntity } from '../../domain/rental.entity';
import { RentalPeriod } from '../../domain/rental-period.value-object';
import {
  DressUnavailableError,
  RentalDressNotFoundError,
  RentalDressRetiredError,
  RentalNotFoundError,
  RentalUpdateNotAllowedError,
} from '../../domain/rental.errors';
import { UpdateRentalCommand } from './update-rental.command';
import { UpdateRentalService } from './update-rental.service';

const RENTAL_ID = '00000000-0000-4000-8000-000000000100';
const ITEM_A = '00000000-0000-4000-8000-000000000101';
const ITEM_B = '00000000-0000-4000-8000-000000000102';
const DRESS_A = '00000000-0000-4000-8000-00000000000a';
const DRESS_B = '00000000-0000-4000-8000-00000000000b';
const DRESS_C = '00000000-0000-4000-8000-00000000000c';

/** Booked 2026-08-01..03 with A (agreed 1.500.000) and B (agreed 900.000), buffer 2 → blocked to 08-05. */
function makeRental(): RentalEntity {
  return RentalEntity.create(
    {
      customerName: 'Nguyễn Thị Hoa',
      customerPhone: '0903123456',
      period: RentalPeriod.create('2026-08-01', '2026-08-03'),
      notes: 'Khách quen',
      discount: Money.create(0),
      items: [
        { id: ITEM_A, dressId: DRESS_A, price: Money.create(1_500_000) },
        { id: ITEM_B, dressId: DRESS_B, price: Money.create(900_000) },
      ],
    },
    RENTAL_ID,
    new Date('2026-07-01T00:00:00Z'),
    2,
  );
}

function makeRepo(
  rental: RentalEntity | null,
  overrides: Partial<RentalRepositoryPort> = {},
): RentalRepositoryPort {
  let seq = 0;
  return {
    insert: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
    saveReturned: jest.fn().mockResolvedValue(undefined),
    saveCancelled: jest.fn().mockResolvedValue(undefined),
    savePickedUp: jest.fn().mockResolvedValue(undefined),
    saveUpdated: jest.fn().mockResolvedValue(undefined),
    findOneById: jest.fn().mockResolvedValue(rental),
    findBlockedDressIds: jest.fn().mockResolvedValue([]),
    nextId: jest.fn(() => `00000000-0000-4000-8000-00000000020${seq++}`),
    ...overrides,
  };
}

const snapshotA: DressSnapshot = {
  id: DRESS_A,
  code: 'VD-001',
  name: 'Váy cưới ren trắng',
  retired: false,
  rentalPrice: 1_700_000, // the catalog moved since the booking — the agreed price must survive
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
const snapshotC: DressSnapshot = {
  id: DRESS_C,
  code: 'VD-003',
  name: 'Đầm xanh',
  retired: false,
  rentalPrice: 800_000,
  depositAmount: 1_000_000,
};

function makeDressLookup(snapshots: DressSnapshot[]): DressLookupPort {
  return { findByIds: jest.fn().mockResolvedValue(snapshots) };
}

/** CLEANING_BUFFER_DAYS = 2, like the config default. */
const config = { getOrThrow: jest.fn().mockReturnValue(2) } as unknown as ConfigService;

function command(overrides: Partial<UpdateRentalCommand> = {}): UpdateRentalCommand {
  return new UpdateRentalCommand({
    rentalId: RENTAL_ID,
    customerName: undefined,
    customerPhone: undefined,
    startDate: undefined,
    endDate: undefined,
    notes: undefined,
    discountAmount: undefined,
    items: undefined,
    ...overrides,
  });
}

describe('UpdateRentalService (FR-RENT-13)', () => {
  it('a field-only edit keeps every item (id, price) and writes through the locked save', async () => {
    const rental = makeRental();
    const repo = makeRepo(rental);
    const service = new UpdateRentalService(repo, makeDressLookup([snapshotA, snapshotB]), config);

    const result = await service.execute(command({ customerPhone: '0909999999' }));

    expect(result.isOk()).toBe(true);
    const props = rental.getProps();
    expect(props.customerPhone).toBe('0909999999');
    expect(props.customerName).toBe('Nguyễn Thị Hoa');
    expect(props.status).toBe('booked');
    expect(props.items.map((item) => item.id)).toEqual([ITEM_A, ITEM_B]);
    expect(props.items.map((item) => item.price.amount)).toEqual([1_500_000, 900_000]);
    expect(repo.saveUpdated).toHaveBeenCalledWith(rental);
    expect(repo.save).not.toHaveBeenCalled(); // never the unguarded write
    expect(rental.domainEvents.map((event) => event.constructor.name)).toContain(
      'RentalUpdatedDomainEvent',
    );
  });

  it('R2: the availability question is asked about the NEW buffered period, this rental excluded', async () => {
    const rental = makeRental();
    const repo = makeRepo(rental);
    const service = new UpdateRentalService(repo, makeDressLookup([snapshotA, snapshotB]), config);

    await service.execute(command({ endDate: '2026-08-06' }));

    expect(repo.findBlockedDressIds).toHaveBeenCalledWith(
      [DRESS_A, DRESS_B],
      expect.objectContaining({ props: { start: '2026-08-01', end: '2026-08-08' } }),
      { excludeRentalId: RENTAL_ID },
    );
  });

  it('moving the dates re-blocks EVERY item to the new period + buffer', async () => {
    const rental = makeRental();
    const service = new UpdateRentalService(
      makeRepo(rental),
      makeDressLookup([snapshotA, snapshotB]),
      config,
    );

    const result = await service.execute(
      command({ startDate: '2026-08-10', endDate: '2026-08-12' }),
    );

    expect(result.isOk()).toBe(true);
    expect(rental.period.start).toBe('2026-08-10');
    expect(rental.period.end).toBe('2026-08-12');
    for (const item of rental.items) {
      expect(item.blockedPeriod.start).toBe('2026-08-10');
      expect(item.blockedPeriod.end).toBe('2026-08-14');
      expect(item.blocking).toBe(true);
    }
  });

  it('one date merges with the other current one; an inverted range is an argument error', async () => {
    const rental = makeRental();
    const service = new UpdateRentalService(
      makeRepo(rental),
      makeDressLookup([snapshotA, snapshotB]),
      config,
    );

    const result = await service.execute(command({ endDate: '2026-08-04' }));
    expect(result.isOk()).toBe(true);
    expect(rental.period.start).toBe('2026-08-01');
    expect(rental.period.end).toBe('2026-08-04');

    await expect(service.execute(command({ startDate: '2026-08-09' }))).rejects.toThrow(
      /must not end before it starts/,
    );
  });

  it('R3: replacing the list keeps a dress (same id, AGREED price), adds one at the standard price, drops the rest', async () => {
    const rental = makeRental();
    const repo = makeRepo(rental);
    const service = new UpdateRentalService(
      repo,
      makeDressLookup([snapshotA, snapshotC]),
      config,
    );

    const result = await service.execute(
      command({
        items: [
          { dressId: DRESS_A, price: null },
          { dressId: DRESS_C, price: null },
        ],
      }),
    );

    expect(result.isOk()).toBe(true);
    const items = rental.getProps().items;
    expect(items).toHaveLength(2);
    const [kept, added] = items;
    expect(kept?.id).toBe(ITEM_A);
    expect(kept?.dressId).toBe(DRESS_A);
    expect(kept?.price.amount).toBe(1_500_000); // NOT the catalog's 1.700.000
    expect(added?.dressId).toBe(DRESS_C);
    expect(added?.id).not.toBe(ITEM_B);
    expect(added?.price.amount).toBe(800_000); // catalog standard
    expect(added?.blockedPeriod.end).toBe('2026-08-05');
    expect(items.some((item) => item.dressId === DRESS_B)).toBe(false);
  });

  it('R3: an explicit price wins for kept and added dresses alike', async () => {
    const rental = makeRental();
    const service = new UpdateRentalService(
      makeRepo(rental),
      makeDressLookup([snapshotA, snapshotC]),
      config,
    );

    await service.execute(
      command({
        items: [
          { dressId: DRESS_A, price: 1_000_000 },
          { dressId: DRESS_C, price: 750_000 },
        ],
      }),
    );

    expect(rental.getProps().items.map((item) => item.price.amount)).toEqual([
      1_000_000, 750_000,
    ]);
  });

  it('§6.Q4: a KEPT dress retired after booking is fine; an ADDED retired dress is refused', async () => {
    const rental = makeRental();
    const retiredA = { ...snapshotA, retired: true };
    const okService = new UpdateRentalService(
      makeRepo(rental),
      makeDressLookup([retiredA, snapshotB]),
      config,
    );
    expect((await okService.execute(command({ customerName: 'Hoa' }))).isOk()).toBe(true);

    const repo = makeRepo(makeRental());
    const refusing = new UpdateRentalService(
      repo,
      makeDressLookup([snapshotA, { ...snapshotC, retired: true }]),
      config,
    );
    const result = await refusing.execute(
      command({
        items: [
          { dressId: DRESS_A, price: null },
          { dressId: DRESS_C, price: null },
        ],
      }),
    );
    expect(result.isErr()).toBe(true);
    const error = result.unwrapErr();
    expect(error).toBeInstanceOf(RentalDressRetiredError);
    expect((error as RentalDressRetiredError).dressIds).toEqual([DRESS_C]);
    expect(repo.saveUpdated).not.toHaveBeenCalled();
  });

  it('an unknown dress id is refused by name and nothing is written', async () => {
    const repo = makeRepo(makeRental());
    const service = new UpdateRentalService(repo, makeDressLookup([snapshotA]), config);

    const result = await service.execute(
      command({
        items: [
          { dressId: DRESS_A, price: null },
          { dressId: DRESS_C, price: null },
        ],
      }),
    );

    expect(result.unwrapErr()).toBeInstanceOf(RentalDressNotFoundError);
    expect((result.unwrapErr() as RentalDressNotFoundError).dressIds).toEqual([DRESS_C]);
    expect(repo.saveUpdated).not.toHaveBeenCalled();
  });

  it('an overlap found by the pre-check refuses the edit with the offending dresses', async () => {
    const repo = makeRepo(makeRental(), {
      findBlockedDressIds: jest.fn().mockResolvedValue([DRESS_B]),
    });
    const service = new UpdateRentalService(repo, makeDressLookup([snapshotA, snapshotB]), config);

    const result = await service.execute(command({ endDate: '2026-08-06' }));

    expect(result.unwrapErr()).toBeInstanceOf(DressUnavailableError);
    expect((result.unwrapErr() as DressUnavailableError).dressIds).toEqual([DRESS_B]);
    expect(repo.saveUpdated).not.toHaveBeenCalled();
  });

  it('losing the race at the EXCLUDE constraint yields the SAME outcome, re-queried', async () => {
    const repo = makeRepo(makeRental(), {
      saveUpdated: jest.fn().mockRejectedValue(new RentalItemsOverlapError()),
      findBlockedDressIds: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([DRESS_A]),
    });
    const service = new UpdateRentalService(repo, makeDressLookup([snapshotA, snapshotB]), config);

    const result = await service.execute(command({ endDate: '2026-08-06' }));

    expect(result.unwrapErr()).toBeInstanceOf(DressUnavailableError);
    expect((result.unwrapErr() as DressUnavailableError).dressIds).toEqual([DRESS_A]);
  });

  it('R1: a closed rental is refused BEFORE any dress is looked up', async () => {
    const rental = makeRental();
    rental.markPickedUp(new Date('2026-08-01T02:00:00Z'));
    rental.markReturned(new Date('2026-08-03T10:00:00Z'));
    const lookup = makeDressLookup([snapshotA, snapshotB]);
    const repo = makeRepo(rental);

    const result = await new UpdateRentalService(repo, lookup, config).execute(
      command({ customerName: 'Hoa' }),
    );

    expect(result.unwrapErr()).toBeInstanceOf(RentalUpdateNotAllowedError);
    expect((result.unwrapErr() as RentalUpdateNotAllowedError).currentStatus).toBe('returned');
    expect(lookup.findByIds).not.toHaveBeenCalled();
    expect(repo.saveUpdated).not.toHaveBeenCalled();
  });

  it('R1: a close that lands under the row lock is the same outcome, with the status that closed it', async () => {
    const repo = makeRepo(makeRental(), {
      saveUpdated: jest.fn().mockRejectedValue(new RentalStateChangedError('cancelled')),
    });
    const service = new UpdateRentalService(repo, makeDressLookup([snapshotA, snapshotB]), config);

    const result = await service.execute(command({ customerName: 'Hoa' }));

    expect(result.unwrapErr()).toBeInstanceOf(RentalUpdateNotAllowedError);
    expect((result.unwrapErr() as RentalUpdateNotAllowedError).currentStatus).toBe('cancelled');
  });

  it('R1: an OUT rental is editable, and an edit never touches the status', async () => {
    const rental = makeRental();
    rental.markPickedUp(new Date('2026-08-01T02:00:00Z'));
    const service = new UpdateRentalService(
      makeRepo(rental),
      makeDressLookup([snapshotA, snapshotB]),
      config,
    );

    // Start moved into the PAST: create would be born-out, an edit is not a handover (§6.Q3).
    const result = await service.execute(
      command({ startDate: '2026-07-20', endDate: '2026-08-06' }),
    );

    expect(result.isOk()).toBe(true);
    expect(rental.status).toBe('out');
  });

  it('unknown rental → RentalNotFoundError', async () => {
    const service = new UpdateRentalService(
      makeRepo(null),
      makeDressLookup([snapshotA, snapshotB]),
      config,
    );

    const result = await service.execute(command({ customerName: 'Hoa' }));

    expect(result.unwrapErr()).toBeInstanceOf(RentalNotFoundError);
  });

  it('notes: null clears, a string replaces, undefined keeps; the discount is replaced', async () => {
    const rental = makeRental();
    const service = new UpdateRentalService(
      makeRepo(rental),
      makeDressLookup([snapshotA, snapshotB]),
      config,
    );

    await service.execute(command({ discountAmount: 300_000 }));
    expect(rental.getProps().notes).toBe('Khách quen');
    expect(rental.discount.amount).toBe(300_000);

    await service.execute(command({ notes: null }));
    expect(rental.getProps().notes).toBeNull();

    await service.execute(command({ notes: 'Hẹn 9h' }));
    expect(rental.getProps().notes).toBe('Hẹn 9h');
  });

  it('R4: a discount above the NEW item total is an argument error and nothing is written', async () => {
    const repo = makeRepo(makeRental());
    const service = new UpdateRentalService(repo, makeDressLookup([snapshotA]), config);

    // Dropping B leaves Σ = 1.500.000; the old discount bound (2.400.000) no longer applies.
    await expect(
      service.execute(
        command({ items: [{ dressId: DRESS_A, price: null }], discountAmount: 1_500_001 }),
      ),
    ).rejects.toThrow(/Discount must not exceed/);
    expect(repo.saveUpdated).not.toHaveBeenCalled();
  });
});

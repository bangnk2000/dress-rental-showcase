import { Money } from '../../../../libs/ddd/money.value-object';
import { DressRepositoryPort } from '../../application/ports/dress.repository.port';
import { DressCode } from '../../domain/dress-code.value-object';
import { DressEntity } from '../../domain/dress.entity';
import { DressAlreadyRetiredError, DressNotFoundError } from '../../domain/dress.errors';
import { RetireDressCommand } from './retire-dress.command';
import { RetireDressService } from './retire-dress.service';

const DRESS_ID = '00000000-0000-4000-8000-000000000001';

function makeDress(): DressEntity {
  return DressEntity.create(
    {
      code: DressCode.create('VD-012'),
      name: 'Váy cưới đuôi cá',
      sizeLabel: null,
      rentalPrice: Money.create(1_500_000),
      depositAmount: Money.create(3_000_000),
      notes: null,
      photoUrls: [],
      categoryId: null,
      purchasePrice: null,
    },
    DRESS_ID,
    new Date('2026-01-01'),
  );
}

function makeRepo(overrides: Partial<DressRepositoryPort> = {}): DressRepositoryPort {
  return {
    insert: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
    findOneById: jest.fn().mockResolvedValue(makeDress()),
    findOneByCode: jest.fn().mockResolvedValue(null),
    insertWithHistory: jest.fn().mockResolvedValue(undefined),
    saveWithPriceHistory: jest.fn().mockResolvedValue(undefined),
    nextId: jest.fn().mockReturnValue(DRESS_ID),
    ...overrides,
  };
}

it('returns Err(DressNotFoundError) for an unknown dress', async () => {
  const repo = makeRepo({ findOneById: jest.fn().mockResolvedValue(null) });
  const service = new RetireDressService(repo);

  const result = await service.execute(new RetireDressCommand({ dressId: DRESS_ID }));

  expect(result.isErr()).toBe(true);
  expect(result.unwrapErr()).toBeInstanceOf(DressNotFoundError);
  expect(repo.save).not.toHaveBeenCalled();
});

it('retires an active dress and saves it (DressRetiredDomainEvent queued)', async () => {
  const repo = makeRepo();
  const service = new RetireDressService(repo);

  const result = await service.execute(new RetireDressCommand({ dressId: DRESS_ID }));

  expect(result.isOk()).toBe(true);
  const saved = (repo.save as jest.Mock).mock.calls[0][0] as DressEntity;
  expect(saved.status).toBe('retired');
  expect(saved.domainEvents.some((e) => e.constructor.name === 'DressRetiredDomainEvent')).toBe(
    true,
  );
});

it('retiring twice returns Err(DressAlreadyRetiredError) without saving', async () => {
  const dress = makeDress();
  dress.retire(new Date('2026-02-01'));
  const repo = makeRepo({ findOneById: jest.fn().mockResolvedValue(dress) });
  const service = new RetireDressService(repo);

  const result = await service.execute(new RetireDressCommand({ dressId: DRESS_ID }));

  expect(result.isErr()).toBe(true);
  expect(result.unwrapErr()).toBeInstanceOf(DressAlreadyRetiredError);
  expect(repo.save).not.toHaveBeenCalled();
});

import { Money } from '../../../../libs/ddd/money.value-object';
import { CategoryRepositoryPort } from '../../application/ports/category.repository.port';
import { DressRepositoryPort } from '../../application/ports/dress.repository.port';
import { DressCode } from '../../domain/dress-code.value-object';
import { DressEntity } from '../../domain/dress.entity';
import {
  DressCodeAlreadyExistsError,
  DressNotFoundError,
  PurchasePriceOwnerOnlyError,
} from '../../domain/dress.errors';
import { UpdateDressCommand } from './update-dress.command';
import { UpdateDressService } from './update-dress.service';

const DRESS_ID = '00000000-0000-4000-8000-000000000001';

function makeDress(): DressEntity {
  return DressEntity.create(
    {
      code: DressCode.create('VD-012'),
      name: 'Váy cưới đuôi cá',
      sizeLabel: 'M',
      rentalPrice: Money.create(1_500_000),
      depositAmount: Money.create(3_000_000),
      notes: 'ghi chú cũ',
      photoUrls: ['https://example.com/a.jpg'],
      categoryId: null,
      purchasePrice: null,
    },
    DRESS_ID,
    new Date('2026-01-01'),
  );
}

function makeCategoryRepo(): CategoryRepositoryPort {
  return {
    insert: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
    findOneById: jest.fn().mockResolvedValue({} as never), // category exists unless overridden
    findOneByName: jest.fn().mockResolvedValue(null),
    countDresses: jest.fn().mockResolvedValue(0),
    deleteById: jest.fn().mockResolvedValue(undefined),
    nextId: jest.fn().mockReturnValue('00000000-0000-4000-8000-0000000000c1'),
  };
}

function makeRepo(overrides: Partial<DressRepositoryPort> = {}): DressRepositoryPort {
  return {
    insert: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
    findOneById: jest.fn().mockResolvedValue(makeDress()),
    findOneByCode: jest.fn().mockResolvedValue(null),
    nextId: jest.fn().mockReturnValue(DRESS_ID),
    ...overrides,
  };
}

it('returns Err(DressNotFoundError) for an unknown dress', async () => {
  const repo = makeRepo({ findOneById: jest.fn().mockResolvedValue(null) });
  const service = new UpdateDressService(repo, makeCategoryRepo());

  const result = await service.execute(
    new UpdateDressCommand({ dressId: DRESS_ID, name: 'Tên mới', actorRole: 'staff' }),
  );

  expect(result.isErr()).toBe(true);
  expect(result.unwrapErr()).toBeInstanceOf(DressNotFoundError);
  expect(repo.save).not.toHaveBeenCalled();
});

it('merges: sent fields change, omitted fields are kept', async () => {
  const repo = makeRepo();
  const service = new UpdateDressService(repo, makeCategoryRepo());

  const result = await service.execute(
    new UpdateDressCommand({ dressId: DRESS_ID, name: 'Tên mới', rentalPrice: 2_000_000, actorRole: 'staff' }),
  );

  expect(result.isOk()).toBe(true);
  const saved = (repo.save as jest.Mock).mock.calls[0][0] as DressEntity;
  const props = saved.getProps();
  expect(props.name).toBe('Tên mới');
  expect(props.rentalPrice.amount).toBe(2_000_000);
  expect(props.code.unpack()).toBe('VD-012'); // kept
  expect(props.depositAmount.amount).toBe(3_000_000); // kept
  expect(props.notes).toBe('ghi chú cũ'); // kept
  expect(props.photoUrls).toEqual(['https://example.com/a.jpg']); // kept
});

it('explicit null clears the nullable fields; photoUrls replaces the list', async () => {
  const repo = makeRepo();
  const service = new UpdateDressService(repo, makeCategoryRepo());

  await service.execute(
    new UpdateDressCommand({
      dressId: DRESS_ID,
      sizeLabel: null,
      notes: null,
      photoUrls: ['https://example.com/b.jpg', 'https://example.com/c.jpg'],
      actorRole: 'staff',
    }),
  );

  const saved = (repo.save as jest.Mock).mock.calls[0][0] as DressEntity;
  const props = saved.getProps();
  expect(props.sizeLabel).toBeNull();
  expect(props.notes).toBeNull();
  expect(props.photoUrls).toEqual(['https://example.com/b.jpg', 'https://example.com/c.jpg']);
});

it('changing to a taken code returns Err(DressCodeAlreadyExistsError)', async () => {
  const repo = makeRepo({ findOneByCode: jest.fn().mockResolvedValue(makeDress()) });
  const service = new UpdateDressService(repo, makeCategoryRepo());

  const result = await service.execute(
    new UpdateDressCommand({ dressId: DRESS_ID, code: 'VD-099', actorRole: 'staff' }),
  );

  expect(result.isErr()).toBe(true);
  expect(result.unwrapErr()).toBeInstanceOf(DressCodeAlreadyExistsError);
  expect(repo.save).not.toHaveBeenCalled();
});

it('re-sending the same code (any case) skips the uniqueness check', async () => {
  const repo = makeRepo();
  const service = new UpdateDressService(repo, makeCategoryRepo());

  const result = await service.execute(
    new UpdateDressCommand({ dressId: DRESS_ID, code: 'vd-012', name: 'Tên mới', actorRole: 'staff' }),
  );

  expect(result.isOk()).toBe(true);
  expect(repo.findOneByCode).not.toHaveBeenCalled();
});

it('FR-CAT-05: a STAFF request carrying purchasePrice (even null) is refused by name', async () => {
  const repo = makeRepo();
  const service = new UpdateDressService(repo, makeCategoryRepo());

  const result = await service.execute(
    new UpdateDressCommand({ dressId: DRESS_ID, purchasePrice: 5_000_000, actorRole: 'staff' }),
  );

  expect(result.isErr()).toBe(true);
  expect(result.unwrapErr()).toBeInstanceOf(PurchasePriceOwnerOnlyError);
  expect(repo.findOneById).not.toHaveBeenCalled(); // refused before the row is even loaded
  expect(repo.save).not.toHaveBeenCalled();

  const clearAttempt = await service.execute(
    new UpdateDressCommand({ dressId: DRESS_ID, purchasePrice: null, actorRole: 'staff' }),
  );
  expect(clearAttempt.unwrapErr()).toBeInstanceOf(PurchasePriceOwnerOnlyError);
});

it('FR-CAT-05: the OWNER sets, keeps (omit) and clears (null) the purchase price', async () => {
  const repo = makeRepo();
  const service = new UpdateDressService(repo, makeCategoryRepo());

  await service.execute(
    new UpdateDressCommand({ dressId: DRESS_ID, purchasePrice: 5_000_000, actorRole: 'owner' }),
  );
  let saved = (repo.save as jest.Mock).mock.calls[0][0] as DressEntity;
  expect(saved.getProps().purchasePrice?.amount).toBe(5_000_000);

  await service.execute(
    new UpdateDressCommand({ dressId: DRESS_ID, purchasePrice: null, actorRole: 'owner' }),
  );
  saved = (repo.save as jest.Mock).mock.calls[1][0] as DressEntity;
  expect(saved.getProps().purchasePrice).toBeNull();
});

it('FR-CAT-05: a staff edit WITHOUT the field keeps the stored value untouched', async () => {
  const withPrice = makeDress();
  withPrice.updateDetails(
    { ...withPrice.getProps(), purchasePrice: Money.create(4_000_000) },
    new Date('2026-01-02'),
  );
  const repo = makeRepo({ findOneById: jest.fn().mockResolvedValue(withPrice) });
  const service = new UpdateDressService(repo, makeCategoryRepo());

  const result = await service.execute(
    new UpdateDressCommand({ dressId: DRESS_ID, name: 'Tên mới', actorRole: 'staff' }),
  );

  expect(result.isOk()).toBe(true);
  const saved = (repo.save as jest.Mock).mock.calls[0][0] as DressEntity;
  expect(saved.getProps().purchasePrice?.amount).toBe(4_000_000);
});

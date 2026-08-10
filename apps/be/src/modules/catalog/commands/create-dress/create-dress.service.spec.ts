import { CreateDressCommand } from './create-dress.command';
import { CreateDressService } from './create-dress.service';
import { DressCodeAlreadyExistsError } from '../../domain/dress.errors';
import { DressEntity } from '../../domain/dress.entity';
import { DressCodeConflictError } from '../../application/ports/dress-code-conflict.error';
import { CategoryRepositoryPort } from '../../application/ports/category.repository.port';
import { DressRepositoryPort } from '../../application/ports/dress.repository.port';

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
    findOneById: jest.fn().mockResolvedValue(null),
    findOneByCode: jest.fn().mockResolvedValue(null),
    nextId: jest.fn().mockReturnValue('00000000-0000-4000-8000-000000000001'),
    ...overrides,
  };
}

const baseCommand = new CreateDressCommand({
  code: 'vd-012',
  name: 'Váy cưới đuôi cá',
  sizeLabel: 'M',
  rentalPrice: 1_500_000,
  depositAmount: 3_000_000,
  notes: null,
  photoUrls: [],
  categoryId: null,
});

describe('CreateDressService', () => {
  it('creates a dress, normalizes the code, and returns its id', async () => {
    const repo = makeRepo();
    const service = new CreateDressService(repo, makeCategoryRepo());

    const result = await service.execute(baseCommand);

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe('00000000-0000-4000-8000-000000000001');
    expect(repo.insert).toHaveBeenCalledTimes(1);
    const inserted = (repo.insert as jest.Mock).mock.calls[0][0] as DressEntity;
    expect(inserted.getProps().code.unpack()).toBe('VD-012'); // uppercased by the VO
    expect(inserted.getProps().status).toBe('active');
    expect(inserted.domainEvents).toHaveLength(1); // DressCreatedDomainEvent queued
  });

  it('answers the SAME rejection when the UNIQUE index catches the duplicate, not the pre-check', async () => {
    // The pre-check saw a free code; a concurrent create took it first and the constraint refused
    // this insert. Staff must get the field error either way — not a generic conflict.
    const repo = makeRepo({
      insert: jest.fn().mockRejectedValue(new DressCodeConflictError()),
    });

    const result = await new CreateDressService(repo, makeCategoryRepo()).execute(baseCommand);

    expect(result.isErr()).toBe(true);
    const error = result.unwrapErr();
    expect(error).toBeInstanceOf(DressCodeAlreadyExistsError);
    expect((error as DressCodeAlreadyExistsError).dressCode).toBe('VD-012');
  });

  it('returns Err(DressCodeAlreadyExistsError) when the code is taken', async () => {
    const existing = DressEntity.create(
      {
        code: (await import('../../domain/dress-code.value-object')).DressCode.create('VD-012'),
        name: 'x',
        sizeLabel: null,
        rentalPrice: (await import('../../../../libs/ddd/money.value-object')).Money.create(1),
        depositAmount: (await import('../../../../libs/ddd/money.value-object')).Money.create(1),
        notes: null,
        photoUrls: [],
        categoryId: null,
      },
      '00000000-0000-4000-8000-000000000002',
      new Date('2026-01-01'),
    );
    const repo = makeRepo({ findOneByCode: jest.fn().mockResolvedValue(existing) });
    const service = new CreateDressService(repo, makeCategoryRepo());

    const result = await service.execute(baseCommand);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(DressCodeAlreadyExistsError);
    expect(repo.insert).not.toHaveBeenCalled();
  });
});

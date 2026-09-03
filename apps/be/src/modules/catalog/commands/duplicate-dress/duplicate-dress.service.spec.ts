import { Money } from '../../../../libs/ddd/money.value-object';
import { DressCodeConflictError } from '../../application/ports/dress-code-conflict.error';
import { DressRepositoryPort } from '../../application/ports/dress.repository.port';
import { DressCode } from '../../domain/dress-code.value-object';
import { DressEntity } from '../../domain/dress.entity';
import { DressCodeAlreadyExistsError, DressNotFoundError } from '../../domain/dress.errors';
import { DuplicateDressCommand } from './duplicate-dress.command';
import { DuplicateDressService } from './duplicate-dress.service';

const SOURCE_ID = '00000000-0000-4000-8000-000000000001';
const COPY_ID = '00000000-0000-4000-8000-000000000002';
const ACTOR_ID = '00000000-0000-4000-8000-0000000000a1';

function makeSource(code = 'VD-012'): DressEntity {
  return DressEntity.create(
    {
      code: DressCode.create(code),
      name: 'Váy cưới đuôi cá',
      sizeLabel: 'M',
      rentalPrice: Money.create(1_500_000),
      depositAmount: Money.create(3_000_000),
      notes: 'Ren tay dài',
      photoUrls: ['https://example.test/a.jpg'],
      categoryId: '00000000-0000-4000-8000-0000000000c1',
      purchasePrice: Money.create(8_000_000),
    },
    SOURCE_ID,
    new Date('2026-01-01'),
  );
}

function makeRepo(overrides: Partial<DressRepositoryPort> = {}): DressRepositoryPort {
  return {
    insert: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
    findOneById: jest.fn().mockResolvedValue(makeSource()),
    findOneByCode: jest.fn().mockResolvedValue(null),
    findCodesStartingWith: jest.fn().mockResolvedValue([]),
    insertWithHistory: jest.fn().mockResolvedValue(undefined),
    saveWithPriceHistory: jest.fn().mockResolvedValue(undefined),
    nextId: jest.fn().mockReturnValue(COPY_ID),
    ...overrides,
  };
}

const command = (sizeLabel?: string | null) =>
  new DuplicateDressCommand({ sourceDressId: SOURCE_ID, sizeLabel, actorId: ACTOR_ID });

describe('DuplicateDressService (FR-CAT-08)', () => {
  it('the first copy is <code>_1 and carries every field of the source', async () => {
    const repo = makeRepo();

    const result = await new DuplicateDressService(repo).execute(command());

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual({ id: COPY_ID, code: 'VD-012_1' });
    expect(repo.findCodesStartingWith).toHaveBeenCalledWith('VD-012_');
    const copy = (repo.insertWithHistory as jest.Mock).mock.calls[0][0] as DressEntity;
    const props = copy.getProps();
    expect(props.code.unpack()).toBe('VD-012_1');
    expect(props.name).toBe('Váy cưới đuôi cá');
    expect(props.sizeLabel).toBe('M'); // omitted = same size as the source
    expect(props.rentalPrice.amount).toBe(1_500_000);
    expect(props.depositAmount.amount).toBe(3_000_000);
    expect(props.notes).toBe('Ren tay dài');
    expect(props.photoUrls).toEqual(['https://example.test/a.jpg']);
    expect(props.categoryId).toBe('00000000-0000-4000-8000-0000000000c1');
    expect(props.purchasePrice?.amount).toBe(8_000_000);
    expect(props.status).toBe('active');
    // the v1 price-history row names the actor (FR-CAT-06)
    expect((repo.insertWithHistory as jest.Mock).mock.calls[0][1]).toBe(ACTOR_ID);
  });

  it('numbers after the highest existing copy', async () => {
    const repo = makeRepo({
      findCodesStartingWith: jest.fn().mockResolvedValue(['VD-012_1', 'VD-012_4']),
    });

    const result = await new DuplicateDressService(repo).execute(command());

    expect(result.unwrap().code).toBe('VD-012_5');
  });

  it('duplicating a COPY numbers from the original code, not the copy', async () => {
    const repo = makeRepo({
      findOneById: jest.fn().mockResolvedValue(makeSource('VD-012_1')),
      findCodesStartingWith: jest.fn().mockResolvedValue(['VD-012_1', 'VD-012_2']),
    });

    const result = await new DuplicateDressService(repo).execute(command());

    expect(repo.findCodesStartingWith).toHaveBeenCalledWith('VD-012_');
    expect(result.unwrap().code).toBe('VD-012_3');
  });

  it('a size given on the request overrides the source; null clears it', async () => {
    const repo = makeRepo();
    const service = new DuplicateDressService(repo);

    await service.execute(command('L'));
    await service.execute(command(null));

    const calls = (repo.insertWithHistory as jest.Mock).mock.calls;
    expect((calls[0][0] as DressEntity).getProps().sizeLabel).toBe('L');
    expect((calls[1][0] as DressEntity).getProps().sizeLabel).toBeNull();
  });

  it('returns Err(DressNotFoundError) for an unknown source, writing nothing', async () => {
    const repo = makeRepo({ findOneById: jest.fn().mockResolvedValue(null) });

    const result = await new DuplicateDressService(repo).execute(command());

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(DressNotFoundError);
    expect(repo.insertWithHistory).not.toHaveBeenCalled();
  });

  it('a lost numbering race recounts and retries with the next number', async () => {
    // First count sees no copies (→ _1); a concurrent duplicate lands _1 first; the recount sees it.
    const repo = makeRepo({
      findCodesStartingWith: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(['VD-012_1']),
      insertWithHistory: jest
        .fn()
        .mockRejectedValueOnce(new DressCodeConflictError())
        .mockResolvedValueOnce(undefined),
    });

    const result = await new DuplicateDressService(repo).execute(command());

    expect(result.unwrap().code).toBe('VD-012_2');
    expect(repo.insertWithHistory).toHaveBeenCalledTimes(2);
  });

  it('losing the race three times answers the same rejected_dress_code_taken as create-dress', async () => {
    const repo = makeRepo({
      insertWithHistory: jest.fn().mockRejectedValue(new DressCodeConflictError()),
    });

    const result = await new DuplicateDressService(repo).execute(command());

    expect(result.isErr()).toBe(true);
    const error = result.unwrapErr();
    expect(error).toBeInstanceOf(DressCodeAlreadyExistsError);
    expect((error as DressCodeAlreadyExistsError).dressCode).toBe('VD-012_1');
    expect(repo.insertWithHistory).toHaveBeenCalledTimes(3);
  });
});

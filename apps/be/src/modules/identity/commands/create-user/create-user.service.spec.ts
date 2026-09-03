import { hashSync } from 'bcryptjs';
import { CreateUserCommand } from './create-user.command';
import { CreateUserService } from './create-user.service';
import { StaffUserEntity } from '../../domain/staff-user.entity';
import { UsernameAlreadyExistsError } from '../../domain/identity.errors';
import { UsernameConflictError } from '../../application/ports/username-conflict.error';
import { StaffUserRepositoryPort } from '../../application/ports/staff-user.repository.port';

function makeRepo(overrides: Partial<StaffUserRepositoryPort> = {}): StaffUserRepositoryPort {
  return {
    insert: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
    findOneById: jest.fn().mockResolvedValue(null),
    findOneByUsername: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    nextId: jest.fn().mockReturnValue('00000000-0000-4000-8000-000000000001'),
    ...overrides,
  };
}

const baseCommand = new CreateUserCommand({
  username: 'Lan',
  name: 'Chị Lan',
  password: 'mat-khau-lan',
});

function existingUser(): StaffUserEntity {
  return StaffUserEntity.create(
    { username: 'lan', name: 'x', role: 'staff', passwordHash: hashSync('x', 4) },
    '00000000-0000-4000-8000-000000000002',
    new Date('2026-01-01'),
  );
}

describe('CreateUserService', () => {
  it('creates a STAFF account with the normalized username and a hashed password', async () => {
    const repo = makeRepo();
    const result = await new CreateUserService(repo).execute(baseCommand);

    expect(result.isOk()).toBe(true);
    const inserted = (repo.insert as jest.Mock).mock.calls[0][0] as StaffUserEntity;
    const props = inserted.getProps();
    expect(props.username).toBe('lan'); // lowercased by the VO
    expect(props.role).toBe('staff'); // never anything else through this endpoint
    expect(props.active).toBe(true);
    expect(props.passwordHash).not.toContain('mat-khau-lan'); // hashed, not stored
    expect(inserted.domainEvents).toHaveLength(1); // UserCreatedDomainEvent queued
  });

  it('rejects a taken username against the pre-check', async () => {
    const repo = makeRepo({ findOneByUsername: jest.fn().mockResolvedValue(existingUser()) });
    const result = await new CreateUserService(repo).execute(baseCommand);

    expect(result.isErr()).toBe(true);
    const error = result.unwrapErr();
    expect(error).toBeInstanceOf(UsernameAlreadyExistsError);
    expect((error as UsernameAlreadyExistsError).username).toBe('lan');
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('answers the SAME rejection when the UNIQUE index catches the race, not the pre-check', async () => {
    const repo = makeRepo({
      insert: jest.fn().mockRejectedValue(new UsernameConflictError()),
    });
    const result = await new CreateUserService(repo).execute(baseCommand);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(UsernameAlreadyExistsError);
  });
});

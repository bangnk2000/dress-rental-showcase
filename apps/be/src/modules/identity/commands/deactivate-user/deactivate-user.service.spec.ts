import { hashSync } from 'bcryptjs';
import { DeactivateUserCommand } from './deactivate-user.command';
import { DeactivateUserService } from './deactivate-user.service';
import { ReactivateUserCommand } from '../reactivate-user/reactivate-user.command';
import { ReactivateUserService } from '../reactivate-user/reactivate-user.service';
import { StaffUserEntity } from '../../domain/staff-user.entity';
import {
  CannotDeactivateSelfError,
  UserAlreadyActiveError,
  UserAlreadyInactiveError,
  UserNotFoundError,
} from '../../domain/identity.errors';
import { StaffUserRepositoryPort } from '../../application/ports/staff-user.repository.port';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const ACTOR_ID = '00000000-0000-4000-8000-000000000099';

function makeUser(): StaffUserEntity {
  return StaffUserEntity.create(
    { username: 'lan', name: 'Chị Lan', role: 'staff', passwordHash: hashSync('x', 4) },
    USER_ID,
    new Date('2026-01-01'),
  );
}

function makeRepo(overrides: Partial<StaffUserRepositoryPort> = {}): StaffUserRepositoryPort {
  return {
    insert: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
    findOneById: jest.fn().mockResolvedValue(makeUser()),
    findOneByUsername: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    nextId: jest.fn().mockReturnValue(USER_ID),
    ...overrides,
  };
}

describe('DeactivateUserService / ReactivateUserService', () => {
  it('locks an active account and persists the flip', async () => {
    const repo = makeRepo();
    const result = await new DeactivateUserService(repo).execute(
      new DeactivateUserCommand({ userId: USER_ID, actorId: ACTOR_ID }),
    );

    expect(result.isOk()).toBe(true);
    const saved = (repo.save as jest.Mock).mock.calls[0][0] as StaffUserEntity;
    expect(saved.active).toBe(false);
  });

  it('refuses to lock the actor themselves — before even loading the row', async () => {
    const repo = makeRepo();
    const result = await new DeactivateUserService(repo).execute(
      new DeactivateUserCommand({ userId: ACTOR_ID, actorId: ACTOR_ID }),
    );

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(CannotDeactivateSelfError);
    expect(repo.findOneById).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('locking a locked account says already-inactive', async () => {
    const locked = makeUser();
    locked.deactivate(new Date('2026-01-02'));
    const repo = makeRepo({ findOneById: jest.fn().mockResolvedValue(locked) });

    const result = await new DeactivateUserService(repo).execute(
      new DeactivateUserCommand({ userId: USER_ID, actorId: ACTOR_ID }),
    );

    expect(result.unwrapErr()).toBeInstanceOf(UserAlreadyInactiveError);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('unknown user is its own rejection', async () => {
    const repo = makeRepo({ findOneById: jest.fn().mockResolvedValue(null) });
    const result = await new DeactivateUserService(repo).execute(
      new DeactivateUserCommand({ userId: USER_ID, actorId: ACTOR_ID }),
    );
    expect(result.unwrapErr()).toBeInstanceOf(UserNotFoundError);
  });

  it('reactivate unlocks a locked account, and says already-active on a live one', async () => {
    const locked = makeUser();
    locked.deactivate(new Date('2026-01-02'));
    const repo = makeRepo({ findOneById: jest.fn().mockResolvedValue(locked) });

    const result = await new ReactivateUserService(repo).execute(
      new ReactivateUserCommand({ userId: USER_ID }),
    );
    expect(result.isOk()).toBe(true);
    expect(((repo.save as jest.Mock).mock.calls[0][0] as StaffUserEntity).active).toBe(true);

    const active = makeRepo();
    const again = await new ReactivateUserService(active).execute(
      new ReactivateUserCommand({ userId: USER_ID }),
    );
    expect(again.unwrapErr()).toBeInstanceOf(UserAlreadyActiveError);
  });
});

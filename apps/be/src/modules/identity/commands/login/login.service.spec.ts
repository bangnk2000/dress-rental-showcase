import { hashSync } from 'bcryptjs';
import { LoginCommand } from './login.command';
import { LoginService } from './login.service';
import { StaffUserEntity } from '../../domain/staff-user.entity';
import { AccountLockedError, InvalidCredentialsError } from '../../domain/identity.errors';
import { StaffUserRepositoryPort } from '../../application/ports/staff-user.repository.port';
import { TokenService } from '../../application/token.service';

const PASSWORD = 'mat-khau-dung';

function makeUser(): StaffUserEntity {
  return StaffUserEntity.create(
    { username: 'lan', name: 'Chị Lan', role: 'staff', passwordHash: hashSync(PASSWORD, 4) },
    '00000000-0000-4000-8000-000000000001',
    new Date('2026-01-01'),
  );
}

function makeRepo(overrides: Partial<StaffUserRepositoryPort> = {}): StaffUserRepositoryPort {
  return {
    insert: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
    findOneById: jest.fn().mockResolvedValue(null),
    findOneByUsername: jest.fn().mockResolvedValue(makeUser()),
    findAll: jest.fn().mockResolvedValue([]),
    nextId: jest.fn().mockReturnValue('00000000-0000-4000-8000-000000000009'),
    ...overrides,
  };
}

const tokenService = {
  issuePair: jest
    .fn()
    .mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' }),
} as unknown as TokenService;

describe('LoginService', () => {
  it('issues a token pair for correct username + password', async () => {
    const result = await new LoginService(makeRepo(), tokenService).execute(
      new LoginCommand({ username: 'lan', password: PASSWORD }),
    );
    expect(result.isOk()).toBe(true);
  });

  it('a LOCKED account with the CORRECT password gets the named lock rejection', async () => {
    const locked = makeUser();
    locked.deactivate(new Date('2026-01-02'));
    const repo = makeRepo({ findOneByUsername: jest.fn().mockResolvedValue(locked) });

    const result = await new LoginService(repo, tokenService).execute(
      new LoginCommand({ username: 'lan', password: PASSWORD }),
    );
    expect(result.unwrapErr()).toBeInstanceOf(AccountLockedError);
  });

  it('a LOCKED account with a WRONG password stays generic — lock state is not probeable', async () => {
    const locked = makeUser();
    locked.deactivate(new Date('2026-01-02'));
    const repo = makeRepo({ findOneByUsername: jest.fn().mockResolvedValue(locked) });

    const result = await new LoginService(repo, tokenService).execute(
      new LoginCommand({ username: 'lan', password: 'sai-mat-khau' }),
    );
    expect(result.unwrapErr()).toBeInstanceOf(InvalidCredentialsError);
  });

  it('unknown username and wrong password are the same generic rejection', async () => {
    const repo = makeRepo({ findOneByUsername: jest.fn().mockResolvedValue(null) });
    const result = await new LoginService(repo, tokenService).execute(
      new LoginCommand({ username: 'khong-ton-tai', password: PASSWORD }),
    );
    expect(result.unwrapErr()).toBeInstanceOf(InvalidCredentialsError);
  });
});

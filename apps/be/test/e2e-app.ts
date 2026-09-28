import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { hashSync } from 'bcryptjs';
import { E2eDb } from './e2e-db';
import { e2eDatabaseUrl } from './e2e-database-url';

export const OWNER_USERNAME = 'owner-e2e';
export const OWNER_PASSWORD = 'e2e-owner-password';

export interface ApiResponse {
  status: number;
  body: unknown;
}

export const STAFF_USERNAME = 'staff-e2e';
export const STAFF_PASSWORD = 'e2e-staff-password';

export interface E2eContext {
  db: E2eDb;
  baseUrl: string;
  /** Bearer token of a seeded owner (holds every write permission). */
  token: string;
  /** Bearer token of a seeded staff member — for rules that depend on NOT being the owner. */
  staffToken: string;
  request: (
    path: string,
    init?: { method?: string; body?: unknown; token?: string | null },
  ) => Promise<ApiResponse>;
  /** Empty every table and re-seed the owner + token. */
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(baseUrl: string, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`API exited early with code ${child.exitCode}`);
    }
    try {
      // 401 = up and enforcing auth, which is all the readiness this suite needs.
      const response = await fetch(`${baseUrl}/api/v1/auth/me`);
      if (response.status > 0) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error('API did not become ready within 30s');
}

/**
 * Starts the BUILT api (`dist/main.js`) against the e2e database and returns a client for it.
 *
 * Deliberately out-of-process: this proves the real wire behaviour (global pipes, guards, exception
 * filter, Postgres constraints) exactly as production runs it, and it sidesteps loading ESM-only
 * slonik inside jest's CommonJS registry.
 */
export async function startE2eApp(
  options: {
    /**
     * Extra env for the api process, applied last. Use '' to UNSET a key: the app treats an empty
     * value as missing, and a key present in the process env is not refilled from apps/be/.env.
     */
    env?: Record<string, string>;
  } = {},
): Promise<E2eContext> {
  const databaseUrl = e2eDatabaseUrl();
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const cwd = path.join(__dirname, '..');

  const child = spawn(process.execPath, [path.join(cwd, 'dist', 'main.js')], {
    cwd,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
      PORT: String(port),
      LOG_LEVEL: process.env.LOG_LEVEL ?? 'fatal',
      JWT_SECRET: process.env.JWT_SECRET ?? 'e2e-jwt-secret-value-0123456789',
      JWT_REFRESH_SECRET:
        process.env.JWT_REFRESH_SECRET ?? 'e2e-jwt-refresh-secret-0123456789',
      // Pinned, NOT read from the env: the expected dates in the rentals specs are computed with a
      // 2-day buffer, and loadEnvFile() (e2e-database-url.ts) pulls apps/be/.env — whose value is a
      // per-machine shop setting — into this process. A spec that needs another buffer passes it
      // through `options.env`.
      CLEANING_BUFFER_DAYS: '2',
      ...options.env,
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });

  const db = await E2eDb.connect();
  await waitForServer(baseUrl, child);

  async function request(
    requestPath: string,
    init: { method?: string; body?: unknown; token?: string | null } = {},
  ): Promise<ApiResponse> {
    const { method = 'GET', body, token } = init;
    const response = await fetch(`${baseUrl}${requestPath}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  const ownerHash = hashSync(OWNER_PASSWORD, 10);
  const staffHash = hashSync(STAFF_PASSWORD, 10);

  async function signIn(username: string, password: string): Promise<string> {
    const login = await request('/api/v1/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    if (login.status !== 200) {
      throw new Error(
        `e2e login failed for ${username}: ${login.status} ${JSON.stringify(login.body)}`,
      );
    }
    return (login.body as { accessToken: string }).accessToken;
  }

  const context: E2eContext = {
    db,
    baseUrl,
    token: '',
    staffToken: '',
    request,
    reset: async () => {
      await db.truncate();
      await db.seedStaff(OWNER_USERNAME, 'owner', ownerHash);
      await db.seedStaff(STAFF_USERNAME, 'staff', staffHash);
      context.token = await signIn(OWNER_USERNAME, OWNER_PASSWORD);
      context.staffToken = await signIn(STAFF_USERNAME, STAFF_PASSWORD);
    },
    close: async () => {
      await db.close();
      child.kill('SIGTERM');
      await new Promise((resolve) => child.once('exit', resolve));
    },
  };

  await context.reset();
  return context;
}

/** The rental body the API expects; dates are inclusive. */
export function rentalBody(
  dressIds: string[],
  startDate: string,
  endDate: string,
): Record<string, unknown> {
  return {
    customerName: 'Nguyễn Thị Hoa',
    customerPhone: '0903123456',
    startDate,
    endDate,
    items: dressIds.map((dressId) => ({ dressId })),
  };
}

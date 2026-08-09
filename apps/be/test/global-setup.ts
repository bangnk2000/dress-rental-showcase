import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { Client } from 'pg';
import { e2eDatabaseUrl } from './e2e-database-url';

/**
 * Creates the e2e database if it does not exist and brings it to the newest migration — the proof
 * tests assert what the REAL schema refuses, so they must run against migrations, never a
 * hand-built table.
 */
export default async function globalSetup(): Promise<void> {
  const url = new URL(e2eDatabaseUrl());
  const database = url.pathname.replace(/^\//, '');

  const maintenance = new URL(url.href);
  maintenance.pathname = '/postgres';
  const admin = new Client({ connectionString: maintenance.href });
  await admin.connect();
  try {
    const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
    if (existing.rowCount === 0) {
      // Identifiers cannot be parameterised; the name comes from our own URL, not user input.
      await admin.query(`CREATE DATABASE "${database.replace(/"/g, '""')}"`);
    }
  } finally {
    await admin.end();
  }

  const migrate = spawnSync(
    path.join(__dirname, '..', 'node_modules', '.bin', 'node-pg-migrate'),
    ['-m', 'migrations', 'up'],
    {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, DATABASE_URL: url.href },
      stdio: 'inherit',
      shell: process.platform === 'win32',
    },
  );
  if (migrate.status !== 0) {
    throw new Error(`node-pg-migrate failed for the e2e database (exit ${migrate.status})`);
  }
}

import fs from 'node:fs';
import path from 'node:path';

/**
 * Fills UNSET env vars from apps/be/.env for the e2e suite. Nest's ConfigModule does this for the
 * running app, but jest's globalSetup executes before any Nest context exists. Deliberately tiny
 * and test-only: reaching for dotenv here would be a phantom dependency (it belongs to
 * @nestjs/config, not to this package).
 */
export function loadEnvFile(file = path.join(__dirname, '..', '.env')): void {
  if (!fs.existsSync(file)) return;

  for (const rawLine of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    if (process.env[key] !== undefined) continue;
    const value = line.slice(separator + 1).trim();
    process.env[key] = value.replace(/^["']|["']$/g, '');
  }
}

/* Seed the first owner account (idempotent). Usage: pnpm --filter be seed */
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { hashSync } = require('bcryptjs');
const { randomUUID } = require('node:crypto');

/**
 * README step 3 promises this command reads DATABASE_URL / SEED_OWNER_* from apps/be/.env, and it
 * runs outside Nest, so nothing else would load that file. Already-set env vars win (CI passes
 * them directly).
 */
function loadEnvFile() {
  const file = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    if (process.env[key] !== undefined) continue;
    process.env[key] = line.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
  }
}

async function main() {
  loadEnvFile();
  const username = (process.env.SEED_OWNER_USERNAME ?? 'owner').toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD;
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (!password) throw new Error('SEED_OWNER_PASSWORD is required');

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const existing = await client.query(
      'SELECT id FROM staff_users WHERE lower(username) = $1',
      [username],
    );
    if (existing.rowCount > 0) {
      console.log(`Owner already exists: ${username}`);
      return;
    }
    await client.query(
      `INSERT INTO staff_users (id, username, name, role, password_hash)
       VALUES ($1, $2, $3, 'owner', $4)`,
      [randomUUID(), username, 'Owner', hashSync(password, 10)],
    );
    console.log(`Owner created: ${username}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/* Seed the first owner account (idempotent). Usage: pnpm --filter be seed */
const { Client } = require('pg');
const { hashSync } = require('bcryptjs');
const { randomUUID } = require('node:crypto');

async function main() {
  const email = (process.env.SEED_OWNER_EMAIL ?? 'owner@example.com').toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD;
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (!password) throw new Error('SEED_OWNER_PASSWORD is required');

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const existing = await client.query('SELECT id FROM staff_users WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      console.log(`Owner already exists: ${email}`);
      return;
    }
    await client.query(
      `INSERT INTO staff_users (id, email, name, role, password_hash)
       VALUES ($1, $2, $3, 'owner', $4)`,
      [randomUUID(), email, 'Owner', hashSync(password, 10)],
    );
    console.log(`Owner created: ${email}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

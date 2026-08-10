/* eslint-disable camelcase */

/**
 * identity/manage-users (FR-AUTH-04 + FR-AUTH-01 change): login identity moves from email to
 * username, and accounts gain a lock switch. The seeded owner's username is derived from the
 * email local-part ('owner@example.com' -> 'owner') so the only pre-existing account keeps
 * working. Email leaves the table entirely — one identity column is one truth (spec §6.Q1).
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE staff_users ADD COLUMN username text;
    UPDATE staff_users SET username = lower(split_part(email, '@', 1));
    ALTER TABLE staff_users ALTER COLUMN username SET NOT NULL;
    CREATE UNIQUE INDEX staff_users_username_lower_key ON staff_users (lower(username));

    ALTER TABLE staff_users ADD COLUMN active boolean NOT NULL DEFAULT true;

    ALTER TABLE staff_users DROP COLUMN email;
  `);
};

/**
 * Down re-derives email as '<username>@example.com' — the real addresses are NOT recoverable.
 * Acceptable only because email was never used for anything but login, which this migration
 * replaces (documented in the release readiness of the feature).
 */
exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE staff_users ADD COLUMN email text;
    UPDATE staff_users SET email = username || '@example.com';
    ALTER TABLE staff_users ALTER COLUMN email SET NOT NULL;
    ALTER TABLE staff_users ADD CONSTRAINT staff_users_email_key UNIQUE (email);

    DROP INDEX staff_users_username_lower_key;
    ALTER TABLE staff_users DROP COLUMN username;
    ALTER TABLE staff_users DROP COLUMN active;
  `);
};

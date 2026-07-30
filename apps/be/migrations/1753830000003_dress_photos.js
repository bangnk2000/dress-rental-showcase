/* eslint-disable camelcase */

/**
 * Photo LINKS only (staff paste them from the current Google workflow) —
 * binary upload/storage is a deliberate non-goal for the MVP.
 */
exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE dresses ADD COLUMN photo_urls text[] NOT NULL DEFAULT '{}'`);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE dresses DROP COLUMN photo_urls`);
};

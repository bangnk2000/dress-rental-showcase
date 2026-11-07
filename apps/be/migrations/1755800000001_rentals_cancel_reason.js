/* eslint-disable camelcase */

/**
 * rentals/cancel-with-refund (PR #38 review C2): `rentals.cancel_reason` — why the rental was
 * cancelled (mandatory when money is kept). It lives on the rental because a cancel that keeps
 * everything writes no refund row that could carry a note.
 */
exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE rentals ADD COLUMN cancel_reason text;`);
};

// Refused while any reason is on file: dropping the column would erase why money was kept.
exports.down = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM rentals WHERE cancel_reason IS NOT NULL) THEN
        RAISE EXCEPTION 'rentals holds cancel reasons — cannot roll back';
      END IF;
    END $$;
    ALTER TABLE rentals DROP COLUMN cancel_reason;
  `);
};

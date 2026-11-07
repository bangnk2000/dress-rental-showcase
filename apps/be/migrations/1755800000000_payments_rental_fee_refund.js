/* eslint-disable camelcase */

/**
 * rentals/cancel-with-refund: a sixth payment kind, `rental_fee_refund` — rental fee handed back
 * when a booked rental that was paid in advance is cancelled. Written only by the cancel flow.
 * Same CHECK, wider set; the column-level CHECK of 1753830000002 is named payments_kind_check.
 */
const WITH = `'deposit', 'deposit_refund', 'rental_fee', 'rental_fee_refund', 'late_fee', 'damage_fee'`;
const WITHOUT = `'deposit', 'deposit_refund', 'rental_fee', 'late_fee', 'damage_fee'`;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE payments DROP CONSTRAINT payments_kind_check;
    ALTER TABLE payments ADD CONSTRAINT payments_kind_check CHECK (kind IN (${WITH}));
  `);
};

// Rolling back is refused while any rental_fee_refund row exists: deleting money history to fit
// an older schema would silently change what the ledger says was paid back.
exports.down = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM payments WHERE kind = 'rental_fee_refund') THEN
        RAISE EXCEPTION 'payments holds rental_fee_refund rows — cannot roll back';
      END IF;
    END $$;
    ALTER TABLE payments DROP CONSTRAINT payments_kind_check;
    ALTER TABLE payments ADD CONSTRAINT payments_kind_check CHECK (kind IN (${WITHOUT}));
  `);
};

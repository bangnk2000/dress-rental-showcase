/* eslint-disable camelcase */

/**
 * FR-PAY-02 (docs/design/payments/record-collection.md R3): a rental may hold at most ONE
 * `deposit` row and ONE `rental_fee` row. Money collected twice is money the shop cannot
 * reconcile, so the rule gets DB teeth like the overlap rule does — the application pre-check
 * alone loses the race between two devices at the counter.
 *
 * Partial (kind-scoped) so the settlement kinds are untouched: a return legitimately writes
 * deposit_refund + late_fee + damage_fee, and a rental may hold several of those over time.
 *
 * down = DROP INDEX only: no row is destroyed, so this migration is reversible after the shop
 * has entered data (unlike 0001–0003, whose down is a DROP TABLE).
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE UNIQUE INDEX payments_one_deposit_per_rental
      ON payments (rental_id) WHERE kind = 'deposit';
    CREATE UNIQUE INDEX payments_one_rental_fee_per_rental
      ON payments (rental_id) WHERE kind = 'rental_fee';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX payments_one_rental_fee_per_rental;
    DROP INDEX payments_one_deposit_per_rental;
  `);
};

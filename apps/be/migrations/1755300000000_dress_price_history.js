/* eslint-disable camelcase */

/**
 * catalog/price-history (FR-CAT-06): an append-only version log of (rental_price,
 * deposit_amount). Each row = the values valid FROM changed_at; the previous values are the
 * previous row — no old/new column pair to drift apart. changed_by NULL = "before the log
 * existed" (the backfill) — users are never deleted (identity R3), so the FK is safe forever.
 *
 * The "every price change writes exactly one row" invariant is enforced by the application
 * (same-transaction write in DressRepository), not by a trigger: the repo keeps rules in
 * domain/app code with the DB as the last net for uniqueness/exclusion, and a trigger would be
 * an invisible second rule engine.
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE dress_price_history (
      id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      dress_id       uuid NOT NULL REFERENCES dresses(id),
      rental_price   integer NOT NULL CHECK (rental_price >= 0),
      deposit_amount integer NOT NULL CHECK (deposit_amount >= 0),
      changed_by     uuid REFERENCES staff_users(id),
      changed_at     timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX dress_price_history_dress_idx ON dress_price_history (dress_id, changed_at);

    -- Backfill v1 for every existing dress so "since when?" always has an answer (R4).
    INSERT INTO dress_price_history (dress_id, rental_price, deposit_amount, changed_by)
    SELECT id, rental_price, deposit_amount, NULL FROM dresses;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE dress_price_history;
  `);
};

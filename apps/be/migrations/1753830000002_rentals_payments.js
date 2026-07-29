/* eslint-disable camelcase */

/**
 * One rental = one customer order holding 1..n dresses (rental_items).
 * The overlap invariant lives HERE, not in application code:
 * EXCLUDE USING gist blocks two blocking items on the same dress with
 * overlapping blocked_period (rental period + cleaning buffer).
 * Cancelling a rental flips items to blocking = false, freeing the calendar
 * while keeping history.
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE rentals (
      id             uuid PRIMARY KEY,
      customer_name  text NOT NULL,
      customer_phone text NOT NULL,
      period         daterange NOT NULL,
      status         text NOT NULL DEFAULT 'booked'
                     CHECK (status IN ('booked', 'out', 'returned', 'cancelled')),
      notes          text,
      created_at     timestamptz NOT NULL DEFAULT now(),
      updated_at     timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE rental_items (
      id             uuid PRIMARY KEY,
      rental_id      uuid NOT NULL REFERENCES rentals (id),
      dress_id       uuid NOT NULL REFERENCES dresses (id),
      price          integer NOT NULL CHECK (price >= 0),
      blocked_period daterange NOT NULL,
      blocking       boolean NOT NULL DEFAULT true,
      UNIQUE (rental_id, dress_id),
      CONSTRAINT rental_items_no_overlap
        EXCLUDE USING gist (dress_id WITH =, blocked_period WITH &&)
        WHERE (blocking)
    );

    CREATE INDEX rental_items_rental_id_idx ON rental_items (rental_id);
    CREATE INDEX rental_items_dress_id_idx ON rental_items (dress_id);

    CREATE TABLE payments (
      id         uuid PRIMARY KEY,
      rental_id  uuid NOT NULL REFERENCES rentals (id),
      kind       text NOT NULL CHECK (kind IN
                 ('deposit', 'deposit_refund', 'rental_fee', 'late_fee', 'damage_fee')),
      amount     integer NOT NULL CHECK (amount >= 0),
      note       text,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX payments_rental_id_idx ON payments (rental_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE payments;
    DROP TABLE rental_items;
    DROP TABLE rentals;
  `);
};

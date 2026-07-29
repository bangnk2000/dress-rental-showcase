/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS btree_gist;

    CREATE TABLE staff_users (
      id            uuid PRIMARY KEY,
      email         text NOT NULL UNIQUE,
      name          text NOT NULL,
      role          text NOT NULL CHECK (role IN ('owner', 'staff')),
      password_hash text NOT NULL,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE dresses (
      id             uuid PRIMARY KEY,
      code           text NOT NULL UNIQUE,
      name           text NOT NULL,
      size_label     text,
      rental_price   integer NOT NULL CHECK (rental_price >= 0),
      deposit_amount integer NOT NULL CHECK (deposit_amount >= 0),
      status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
      notes          text,
      created_at     timestamptz NOT NULL DEFAULT now(),
      updated_at     timestamptz NOT NULL DEFAULT now()
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE dresses;
    DROP TABLE staff_users;
  `);
};

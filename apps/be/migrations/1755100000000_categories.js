/* eslint-disable camelcase */

/**
 * catalog/dress-category (FR-CAT-07): categories are shop-named groups; each dress belongs to
 * one or none. UNIQUE on lower(name) — 'Dạ Hội' and 'dạ hội' are the same category. The FK is
 * ON DELETE RESTRICT: deleting a category that still holds dresses is refused by the DB, the
 * last net under the application's rejected_category_in_use pre-check.
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE categories (
      id         uuid PRIMARY KEY,
      name       text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 50),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX categories_name_lower_key ON categories (lower(name));

    ALTER TABLE dresses ADD COLUMN category_id uuid
      REFERENCES categories(id) ON DELETE RESTRICT;
    CREATE INDEX dresses_category_id_idx ON dresses (category_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE dresses DROP COLUMN category_id;
    DROP TABLE categories;
  `);
};

/* eslint-disable camelcase */

/**
 * catalog/purchase-price (FR-CAT-05): what the shop PAID for a dress — owner-only to write and
 * to see (the field-level rule lives in the application; the column itself is plain). Nullable:
 * old dresses may never get a value, and that is a valid state forever.
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE dresses ADD COLUMN purchase_price integer
      CHECK (purchase_price IS NULL OR purchase_price >= 0);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE dresses DROP COLUMN purchase_price;
  `);
};

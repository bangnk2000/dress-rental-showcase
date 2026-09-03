/* eslint-disable camelcase */

/**
 * rentals/rental-discount (FR-RENT-11): a rental-level discount in VND, agreed with the customer
 * when the rental is created. It is NOT a price change on the items (rental_items.price stays the
 * per-dress agreement) and NOT a payment movement (payments records what was collected): it is the
 * amount the shop takes off the rental fee, so the expected fee reads Σ item price − discount.
 *
 * DEFAULT 0 keeps every existing rental exactly as it was; the CHECK is the DB's last net for a
 * negative value (the Money VO refuses it first). "discount ≤ Σ item prices" spans two tables and
 * is enforced by the aggregate (RentalEntity.validate), not here.
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE rentals
      ADD COLUMN discount_amount integer NOT NULL DEFAULT 0
        CHECK (discount_amount >= 0);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE rentals DROP COLUMN discount_amount;
  `);
};

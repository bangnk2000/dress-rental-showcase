/* eslint-disable camelcase */

/**
 * catalog/listing-styles: a seventh style, `accessory` ("Phụ kiện"), for listings that are not a
 * dress. R4's CHECK names the seven codes — same rule, wider set (style.value-object.ts STYLES).
 */
const WITH = `'short', 'silk', 'ao-dai', 'off-shoulder', 'sleeved', 'strappy-strapless', 'accessory'`;
const WITHOUT = `'short', 'silk', 'ao-dai', 'off-shoulder', 'sleeved', 'strappy-strapless'`;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE dress_listings DROP CONSTRAINT dress_listings_styles_check;
    ALTER TABLE dress_listings
      ADD CONSTRAINT dress_listings_styles_check CHECK (
        cardinality(styles) >= 1
        AND styles <@ ARRAY[${WITH}]::text[]
      );
  `);
};

// Rolling back drops `accessory` from every listing; one left with no style falls back to `silk`.
exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE dress_listings DROP CONSTRAINT dress_listings_styles_check;

    UPDATE dress_listings
       SET styles = array_remove(styles, 'accessory')
     WHERE 'accessory' = ANY(styles);
    UPDATE dress_listings SET styles = ARRAY['silk'] WHERE cardinality(styles) = 0;

    ALTER TABLE dress_listings
      ADD CONSTRAINT dress_listings_styles_check CHECK (
        cardinality(styles) >= 1
        AND styles <@ ARRAY[${WITHOUT}]::text[]
      );
  `);
};

/* eslint-disable camelcase */

/**
 * catalog/listing-styles: a public listing ("mẫu") is classified by STYLE ("loại": váy ngắn, váy
 * lụa, áo dài, váy trễ vai, váy che tay, váy hai dây/cúp ngực), no longer by OCCASION ("dịp").
 * The columns are renamed (`occasions` → `styles`, `occasions_text` → `styles_text`) and R4's
 * CHECK now names the six style codes — same rule, new set (style.value-object.ts STYLES).
 *
 * Owner decision (2026-09-30): old occasion codes carry no meaning into the new set. `ao-dai`
 * keeps its code; every other old code becomes `silk`, and staff re-tag in /website.
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE dress_listings DROP CONSTRAINT dress_listings_occasions_check;
    ALTER TABLE dress_listings RENAME COLUMN occasions TO styles;
    ALTER TABLE dress_listings RENAME COLUMN occasions_text TO styles_text;

    UPDATE dress_listings
       SET styles = ARRAY(
             SELECT DISTINCT CASE WHEN o = 'ao-dai' THEN 'ao-dai' ELSE 'silk' END
               FROM unnest(styles) AS o
           );

    ALTER TABLE dress_listings
      ADD CONSTRAINT dress_listings_styles_check CHECK (
        cardinality(styles) >= 1
        AND styles <@ ARRAY['short', 'silk', 'ao-dai', 'off-shoulder', 'sleeved', 'strappy-strapless']::text[]
      );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE dress_listings DROP CONSTRAINT dress_listings_styles_check;
    ALTER TABLE dress_listings RENAME COLUMN styles TO occasions;
    ALTER TABLE dress_listings RENAME COLUMN styles_text TO occasions_text;

    UPDATE dress_listings
       SET occasions = ARRAY(
             SELECT DISTINCT CASE WHEN s = 'ao-dai' THEN 'ao-dai' ELSE 'gala' END
               FROM unnest(occasions) AS s
           );

    ALTER TABLE dress_listings
      ADD CONSTRAINT dress_listings_occasions_check CHECK (
        cardinality(occasions) >= 1
        AND occasions <@ ARRAY['gala', 'birthday', 'ao-dai', 'tea-party', 'wedding-guest', 'yearbook']::text[]
      );
  `);
};

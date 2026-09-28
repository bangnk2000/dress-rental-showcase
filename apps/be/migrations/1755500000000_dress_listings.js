/* eslint-disable camelcase */

/**
 * catalog/public-listing (FR-CAT-09, docs/design/catalog/public-listing.md): the public MODEL of a
 * dress ("mẫu") — its web content lives ONCE here, and physical dresses (one size, one code each)
 * join it through `dress_listing_items`. Sizes, the displayed rental price and "còn/hết" are all
 * DERIVED from the joined dresses at read time — never stored twice.
 *
 * Every data rule of the spec's invariant table is a constraint here (the app checks first, the DB
 * is the last net and the repository translates each violation into the same outcome):
 *   R1 slug unique + format + ≤ 80      → UNIQUE + CHECK
 *   R3 published ⇒ ≥ 1 photo            → CHECK (published_at IS NULL OR cardinality(photo_urls) >= 1)
 *   R4 ≥ 1 occasion from the fixed set  → CHECK (cardinality >= 1 AND <@ the six codes)
 *   retail price ≥ 0                    → CHECK
 *   (listing, dress) pair unique        → PRIMARY KEY; FK CASCADE from listings, RESTRICT to dresses
 * R2 (slug locked once first published) is enforced by the conditional UPDATE in the repository —
 * the rule spans two columns across time, which a CHECK cannot see.
 *
 * `rentals/database/dress-lookup.adapter.ts` reads `dresses` with an explicit column list, so the
 * new join table does not touch it (spec §Contract check, minor finding).
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE dress_listings (
      id                 uuid PRIMARY KEY,
      slug               text NOT NULL UNIQUE
                           CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 80),
      name               text NOT NULL,
      tagline            text NOT NULL DEFAULT '',
      description        text NOT NULL DEFAULT '',
      occasions          text[] NOT NULL
                           CHECK (
                             cardinality(occasions) >= 1
                             AND occasions <@ ARRAY['gala', 'birthday', 'ao-dai', 'tea-party', 'wedding-guest', 'yearbook']::text[]
                           ),
      retail_price       integer CHECK (retail_price >= 0),
      material           text,
      silhouette         text,
      length             text,
      color              text,
      occasions_text     text,
      photo_urls         text[] NOT NULL DEFAULT '{}' CHECK (cardinality(photo_urls) <= 10),
      is_hot             boolean NOT NULL DEFAULT false,
      published_at       timestamptz,
      first_published_at timestamptz,
      created_at         timestamptz NOT NULL DEFAULT now(),
      updated_at         timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT dress_listings_published_has_photo
        CHECK (published_at IS NULL OR cardinality(photo_urls) >= 1),
      CONSTRAINT dress_listings_published_was_first_published
        CHECK (published_at IS NULL OR first_published_at IS NOT NULL)
    );

    CREATE TABLE dress_listing_items (
      listing_id uuid NOT NULL REFERENCES dress_listings(id) ON DELETE CASCADE,
      dress_id   uuid NOT NULL REFERENCES dresses(id) ON DELETE RESTRICT,
      PRIMARY KEY (listing_id, dress_id)
    );
    -- "which listings hold this dress" (dress detail, duplicate-dress R7)
    CREATE INDEX dress_listing_items_dress_idx ON dress_listing_items (dress_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE dress_listing_items;
    DROP TABLE dress_listings;
  `);
};

/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE qr_links (
      id uuid PRIMARY KEY,
      target_url text NOT NULL,
      label varchar(120),
      created_by_staff_id uuid NOT NULL REFERENCES staff_users(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX qr_links_created_at_id_idx ON qr_links (created_at DESC, id DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE qr_links');
};

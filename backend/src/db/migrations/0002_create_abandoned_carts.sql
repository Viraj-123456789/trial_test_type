-- checkout_id is TEXT (not INTEGER) to hold Shopify's real checkout token/id shape
-- as well as the mock storefront's ids, without a future migration (see ADR-0005).
CREATE TABLE abandoned_carts (
  id              BIGSERIAL PRIMARY KEY,
  seller_id       BIGINT NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  checkout_id     TEXT NOT NULL,
  customer_name   TEXT,
  customer_phone  TEXT NOT NULL,
  customer_email  TEXT,
  cart_total      NUMERIC(12,2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'USD',
  checkout_url    TEXT NOT NULL,
  line_items      JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Worker must transition pending -> sent with `UPDATE ... WHERE status = 'pending'`
  -- (not a plain SELECT then UPDATE) so a retried job can't double-send. See state.md
  -- "known technical debt".
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'sent', 'recovered', 'expired', 'failed')),
  sent_at         TIMESTAMPTZ,
  recovered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (seller_id, checkout_id)
);

CREATE INDEX abandoned_carts_status_idx ON abandoned_carts (status);
CREATE INDEX abandoned_carts_checkout_id_idx ON abandoned_carts (checkout_id);

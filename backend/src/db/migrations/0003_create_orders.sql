-- Mock stand-in for Shopify's `orders/create` webhook payload (see ADR-0005).
-- checkout_id links back to abandoned_carts.checkout_id for Flow 2's order-to-cart match.
CREATE TABLE orders (
  id           BIGSERIAL PRIMARY KEY,
  seller_id    BIGINT NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  checkout_id  TEXT NOT NULL,
  order_number TEXT NOT NULL,
  total_price  NUMERIC(12,2) NOT NULL,
  currency     TEXT NOT NULL DEFAULT 'USD',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (seller_id, checkout_id)
);

CREATE TABLE sellers (
  id               BIGSERIAL PRIMARY KEY,
  shop_domain      TEXT NOT NULL UNIQUE,
  store_name       TEXT NOT NULL,
  delay_minutes    INTEGER NOT NULL DEFAULT 1 CHECK (delay_minutes > 0),
  discount_code    TEXT NOT NULL DEFAULT 'SAVE10',
  discount_percent INTEGER NOT NULL DEFAULT 10 CHECK (discount_percent > 0 AND discount_percent <= 100),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

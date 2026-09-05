ALTER TABLE abandoned_carts DROP COLUMN sending_at;

ALTER TABLE abandoned_carts DROP CONSTRAINT abandoned_carts_status_check;
ALTER TABLE abandoned_carts ADD CONSTRAINT abandoned_carts_status_check
  CHECK (status IN ('pending', 'sent', 'recovered', 'expired', 'failed'));

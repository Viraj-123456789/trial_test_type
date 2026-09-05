-- Adds an intermediate 'sending' status so "claimed, attempting to send" is
-- distinguishable from "confirmed sent" — closes the crash-window bug where a
-- process death between the claim and the Twilio call resolving left a cart
-- permanently mislabeled 'sent' with no message ever delivered. See ADR-0009.
ALTER TABLE abandoned_carts DROP CONSTRAINT abandoned_carts_status_check;
ALTER TABLE abandoned_carts ADD CONSTRAINT abandoned_carts_status_check
  CHECK (status IN ('pending', 'sending', 'sent', 'recovered', 'expired', 'failed'));

-- Dedicated claim timestamp, set only by the pending -> sending transition, so a
-- reconciliation sweep can detect staleness without depending on updated_at (which
-- other, unrelated writes could otherwise reset).
ALTER TABLE abandoned_carts ADD COLUMN sending_at TIMESTAMPTZ;

import { pool } from './pool';
import { AbandonedCart, mapAbandonedCartRow } from '../models/abandonedCart';

export interface NewAbandonedCart {
  sellerId: number;
  checkoutId: string;
  customerName: string | null;
  customerPhone: string;
  customerEmail: string | null;
  cartTotal: string;
  currency: string;
  checkoutUrl: string;
  lineItems: unknown;
}

// Returns null when (seller_id, checkout_id) already exists — the caller treats that
// as a duplicate webhook delivery (Shopify retries on timeout/non-2xx) and must not
// enqueue a second recovery job for it.
export async function insertAbandonedCartIfNew(cart: NewAbandonedCart): Promise<AbandonedCart | null> {
  const { rows } = await pool.query(
    `INSERT INTO abandoned_carts
       (seller_id, checkout_id, customer_name, customer_phone, customer_email, cart_total, currency, checkout_url, line_items)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (seller_id, checkout_id) DO NOTHING
     RETURNING *`,
    [
      cart.sellerId,
      cart.checkoutId,
      cart.customerName,
      cart.customerPhone,
      cart.customerEmail,
      cart.cartTotal,
      cart.currency,
      cart.checkoutUrl,
      JSON.stringify(cart.lineItems),
    ],
  );
  return rows[0] ? mapAbandonedCartRow(rows[0]) : null;
}

// Corrects the `sending` claim after the WhatsApp API call actually fails — the
// cart was claimed (see markCartSendingIfPending) before the send was attempted, so
// this is a legitimate sending -> failed transition, not a new race to guard against
// a retry (there's no retry path back from `failed` in this MVP).
export async function markCartFailedIfSending(id: number): Promise<AbandonedCart | null> {
  const { rows } = await pool.query(
    `UPDATE abandoned_carts SET status = 'failed', updated_at = now()
     WHERE id = $1 AND status = 'sending'
     RETURNING *`,
    [id],
  );
  return rows[0] ? mapAbandonedCartRow(rows[0]) : null;
}

export async function findCartById(id: number): Promise<AbandonedCart | null> {
  const { rows } = await pool.query('SELECT * FROM abandoned_carts WHERE id = $1', [id]);
  return rows[0] ? mapAbandonedCartRow(rows[0]) : null;
}

// Atomically transitions pending -> recovered. Returns null if the cart was not (or
// no longer) pending — e.g. already sent, or already recovered by a concurrent run.
export async function markCartRecoveredIfPending(id: number): Promise<AbandonedCart | null> {
  const { rows } = await pool.query(
    `UPDATE abandoned_carts SET status = 'recovered', recovered_at = now(), updated_at = now()
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [id],
  );
  return rows[0] ? mapAbandonedCartRow(rows[0]) : null;
}

// Atomically transitions sent -> recovered, looked up by (seller_id, checkout_id)
// since the order webhook only knows the checkout id, not our internal cart id.
// Deliberately does NOT match a `pending` cart — that's the worker's own job (an
// order that arrives before the delay elapses is caught there instead, see
// recoveryWorker.ts), so this can't race with it over the same status column.
export async function markCartRecoveredIfSent(sellerId: number, checkoutId: string): Promise<AbandonedCart | null> {
  const { rows } = await pool.query(
    `UPDATE abandoned_carts SET status = 'recovered', recovered_at = now(), updated_at = now()
     WHERE seller_id = $1 AND checkout_id = $2 AND status = 'sent'
     RETURNING *`,
    [sellerId, checkoutId],
  );
  return rows[0] ? mapAbandonedCartRow(rows[0]) : null;
}

// Atomically transitions pending -> sending. This IS the claim: run it before calling
// the WhatsApp API, not after, so a retried/duplicate job invocation sees status !=
// 'pending' and skips sending instead of double-sending. `sending` (rather than
// jumping straight to `sent`) lets a crash between this claim and the Twilio call
// resolving be detected and reconciled instead of silently mislabeled `sent` forever
// — see ADR-0009.
export async function markCartSendingIfPending(id: number): Promise<AbandonedCart | null> {
  const { rows } = await pool.query(
    `UPDATE abandoned_carts SET status = 'sending', sending_at = now(), updated_at = now()
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [id],
  );
  return rows[0] ? mapAbandonedCartRow(rows[0]) : null;
}

// Confirms a successful send: sending -> sent. sent_at is only ever set here (not at
// the claim step), so it means "confirmed delivered", not "attempted".
export async function markCartSentIfSending(id: number): Promise<AbandonedCart | null> {
  const { rows } = await pool.query(
    `UPDATE abandoned_carts SET status = 'sent', sent_at = now(), updated_at = now()
     WHERE id = $1 AND status = 'sending'
     RETURNING *`,
    [id],
  );
  return rows[0] ? mapAbandonedCartRow(rows[0]) : null;
}

// Reconciliation sweep: any cart claimed (pending -> sending) more than
// `thresholdMinutes` ago and never resolved to `sent`/`failed` is assumed to have
// been orphaned by a crashed/killed worker process, and is marked `failed` so it's
// visible for manual follow-up rather than silently stuck. See ADR-0009 for the
// accepted trade-off (a legitimately slow-but-alive send outliving the threshold).
export async function reapStaleSendingCartsAsFailed(thresholdMinutes: number): Promise<AbandonedCart[]> {
  const { rows } = await pool.query(
    `UPDATE abandoned_carts SET status = 'failed', updated_at = now()
     WHERE status = 'sending' AND sending_at < now() - make_interval(mins => $1)
     RETURNING *`,
    [thresholdMinutes],
  );
  return rows.map(mapAbandonedCartRow);
}

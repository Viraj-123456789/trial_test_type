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

// Corrects an optimistic `sent` claim after the WhatsApp API call actually fails —
// the cart was claimed (see markCartSentIfPending) before the send was attempted,
// so this is the one legitimate sent -> failed transition, not a new race to guard
// against a retry (there's no retry path back from `failed` in this MVP).
export async function markCartFailedIfSent(id: number): Promise<AbandonedCart | null> {
  const { rows } = await pool.query(
    `UPDATE abandoned_carts SET status = 'failed', updated_at = now()
     WHERE id = $1 AND status = 'sent'
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

// Atomically transitions pending -> sent. This IS the claim: run it before calling
// the WhatsApp API, not after, so a retried/duplicate job invocation sees status !=
// 'pending' and skips sending instead of double-sending (see known technical debt in
// state.md and the comment in migration 0002).
export async function markCartSentIfPending(id: number): Promise<AbandonedCart | null> {
  const { rows } = await pool.query(
    `UPDATE abandoned_carts SET status = 'sent', sent_at = now(), updated_at = now()
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [id],
  );
  return rows[0] ? mapAbandonedCartRow(rows[0]) : null;
}

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

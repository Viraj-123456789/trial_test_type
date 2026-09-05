import { pool } from './pool';
import { Order, mapOrderRow } from '../models/order';

export async function findOrderBySellerAndCheckout(sellerId: number, checkoutId: string): Promise<Order | null> {
  const { rows } = await pool.query('SELECT * FROM orders WHERE seller_id = $1 AND checkout_id = $2', [
    sellerId,
    checkoutId,
  ]);
  return rows[0] ? mapOrderRow(rows[0]) : null;
}

export interface NewOrder {
  sellerId: number;
  checkoutId: string;
  orderNumber: string;
  totalPrice: string;
  currency: string;
}

// Returns null when (seller_id, checkout_id) already exists — a duplicate
// orders/create delivery, same idempotency pattern as insertAbandonedCartIfNew.
export async function insertOrderIfNew(order: NewOrder): Promise<Order | null> {
  const { rows } = await pool.query(
    `INSERT INTO orders (seller_id, checkout_id, order_number, total_price, currency)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (seller_id, checkout_id) DO NOTHING
     RETURNING *`,
    [order.sellerId, order.checkoutId, order.orderNumber, order.totalPrice, order.currency],
  );
  return rows[0] ? mapOrderRow(rows[0]) : null;
}

import { pool } from './pool';
import { Order, mapOrderRow } from '../models/order';

export async function findOrderBySellerAndCheckout(sellerId: number, checkoutId: string): Promise<Order | null> {
  const { rows } = await pool.query('SELECT * FROM orders WHERE seller_id = $1 AND checkout_id = $2', [
    sellerId,
    checkoutId,
  ]);
  return rows[0] ? mapOrderRow(rows[0]) : null;
}

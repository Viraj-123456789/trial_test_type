import { findOrderBySellerAndCheckout } from '../db/orders';
import { Order } from '../models/order';

// Scoped by sellerId as well as checkoutId — checkout ids are only unique per seller
// (see the (seller_id, checkout_id) unique constraint on both `orders` and
// `abandoned_carts`), so flow.md's `checkIfOrdered(checkoutId)` sketch is completed
// here with the seller scope it actually needs.
export async function checkIfOrdered(sellerId: number, checkoutId: string): Promise<Order | null> {
  return findOrderBySellerAndCheckout(sellerId, checkoutId);
}

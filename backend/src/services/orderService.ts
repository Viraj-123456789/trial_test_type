import { findOrderBySellerAndCheckout, insertOrderIfNew } from '../db/orders';
import { findSellerByShopDomain } from '../db/sellers';
import { matchOrderToCart, UnknownSellerError } from './cartService';
import { Order } from '../models/order';
import { Seller } from '../models/seller';
import { AbandonedCart } from '../models/abandonedCart';

// Scoped by sellerId as well as checkoutId — checkout ids are only unique per seller
// (see the (seller_id, checkout_id) unique constraint on both `orders` and
// `abandoned_carts`), so flow.md's `checkIfOrdered(checkoutId)` sketch is completed
// here with the seller scope it actually needs.
export async function checkIfOrdered(sellerId: number, checkoutId: string): Promise<Order | null> {
  return findOrderBySellerAndCheckout(sellerId, checkoutId);
}

// Shape of the fields we actually read off a Shopify-style `orders/create` payload
// (see ADR-0005) — not the full Shopify schema.
export interface OrderWebhookPayload {
  id: number | string;
  checkout_id: number | string;
  order_number: number | string;
  total_price: string;
  currency?: string;
}

export interface RecordOrderResult {
  seller: Seller;
  // null means this checkout_id was already recorded — a duplicate webhook delivery.
  order: Order | null;
  // null means no `sent` abandoned cart matched this checkout (not a recovery, or
  // already handled — see cartService.matchOrderToCart).
  recoveredCart: AbandonedCart | null;
}

export async function recordOrder(shopDomain: string, payload: OrderWebhookPayload): Promise<RecordOrderResult> {
  const seller = await findSellerByShopDomain(shopDomain);
  if (!seller) {
    throw new UnknownSellerError(`no seller registered for shop domain "${shopDomain}"`);
  }

  const checkoutId = String(payload.checkout_id);

  const order = await insertOrderIfNew({
    sellerId: seller.id,
    checkoutId,
    orderNumber: String(payload.order_number),
    totalPrice: payload.total_price,
    currency: payload.currency ?? 'USD',
  });

  // Always attempt the match, even on a duplicate order delivery — matchOrderToCart's
  // own `WHERE status = 'sent'` guard makes re-running it a safe no-op.
  const recoveredCart = await matchOrderToCart(seller.id, checkoutId);

  return { seller, order, recoveredCart };
}

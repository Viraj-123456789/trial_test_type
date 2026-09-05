import { findSellerByShopDomain } from '../db/sellers';
import {
  insertAbandonedCartIfNew,
  markCartFailedIfSent,
  markCartRecoveredIfPending,
  markCartRecoveredIfSent,
  markCartSentIfPending,
} from '../db/abandonedCarts';
import { Seller } from '../models/seller';
import { AbandonedCart } from '../models/abandonedCart';

export class UnknownSellerError extends Error {}

// Shape of the fields we actually read off a Shopify-style `checkouts/create`
// payload (see ADR-0005) — not the full Shopify schema.
export interface CheckoutWebhookPayload {
  id: number | string;
  phone?: string | null;
  email?: string | null;
  total_price: string;
  currency?: string;
  abandoned_checkout_url: string;
  line_items?: unknown[];
  customer?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
  };
}

export interface RecordAbandonedCartResult {
  seller: Seller;
  // null means this checkout_id was already recorded — a duplicate webhook delivery.
  cart: AbandonedCart | null;
}

export async function recordAbandonedCart(
  shopDomain: string,
  payload: CheckoutWebhookPayload,
): Promise<RecordAbandonedCartResult> {
  const seller = await findSellerByShopDomain(shopDomain);
  if (!seller) {
    throw new UnknownSellerError(`no seller registered for shop domain "${shopDomain}"`);
  }

  const phone = payload.phone ?? payload.customer?.phone ?? null;
  if (!phone) {
    throw new Error('checkout payload has no phone number to recover with');
  }

  const name = payload.customer
    ? `${payload.customer.first_name ?? ''} ${payload.customer.last_name ?? ''}`.trim() || null
    : null;

  const cart = await insertAbandonedCartIfNew({
    sellerId: seller.id,
    checkoutId: String(payload.id),
    customerName: name,
    customerPhone: phone,
    customerEmail: payload.email ?? payload.customer?.email ?? null,
    cartTotal: payload.total_price,
    currency: payload.currency ?? 'USD',
    checkoutUrl: payload.abandoned_checkout_url,
    lineItems: payload.line_items ?? [],
  });

  return { seller, cart };
}

// Both return null if the cart wasn't (or no longer) pending — see the comments on
// the underlying db functions for why that's a normal, expected no-op rather than an
// error (concurrent/retried job, or a race with the other transition path).
export async function markRecovered(cartId: number): Promise<AbandonedCart | null> {
  return markCartRecoveredIfPending(cartId);
}

export async function markSent(cartId: number): Promise<AbandonedCart | null> {
  return markCartSentIfPending(cartId);
}

// Corrects a cart's status when the WhatsApp send fails after markSent() already
// claimed it (see markCartFailedIfSent for why this is a legitimate correction, not
// a race to guard against).
export async function markFailed(cartId: number): Promise<AbandonedCart | null> {
  return markCartFailedIfSent(cartId);
}

// Flow 2: an orders/create webhook arrived. Only transitions a `sent` cart to
// `recovered` — an order for a still-`pending` cart is left alone here on purpose,
// since the worker's own check-then-send already handles that case (see
// markCartRecoveredIfSent's comment). Returns null if there's no matching `sent`
// cart for this checkout (not a recovery, or already handled).
export async function matchOrderToCart(sellerId: number, checkoutId: string): Promise<AbandonedCart | null> {
  return markCartRecoveredIfSent(sellerId, checkoutId);
}

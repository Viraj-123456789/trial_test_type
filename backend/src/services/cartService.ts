import { findSellerByShopDomain } from '../db/sellers';
import { insertAbandonedCartIfNew } from '../db/abandonedCarts';
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

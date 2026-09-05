import { CUSTOMERS, PRODUCTS, pickRandom } from './fixtures';
import { config } from './config';

// Field names and nesting deliberately mirror Shopify's real `checkouts/create`
// and `orders/create` webhook payloads (see ADR-0005) — only fields the backend
// actually consumes (per flow.md) are included, not Shopify's full schema.

export interface CheckoutOverrides {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  productTitle?: string;
  price?: string;
  shopDomain?: string;
}

export interface CheckoutPayload {
  id: number;
  token: string;
  email: string;
  phone: string;
  currency: string;
  total_price: string;
  line_items: Array<{
    id: number;
    product_id: number;
    variant_id: number;
    title: string;
    quantity: number;
    price: string;
    sku: string;
  }>;
  customer: {
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
  };
  abandoned_checkout_url: string;
  created_at: string;
}

let checkoutSeq = Date.now();
let orderSeq = Date.now() + 1;
let orderNumberSeq = 1000;

export function buildCheckoutPayload(overrides: CheckoutOverrides = {}): CheckoutPayload {
  const customer = pickRandom(CUSTOMERS);
  const product = pickRandom(PRODUCTS);
  const shopDomain = overrides.shopDomain ?? config.shopDomain;

  const id = checkoutSeq++;
  const token = `checkout_${id}_${Math.random().toString(36).slice(2, 8)}`;
  const price = overrides.price ?? product.price;

  const firstName = overrides.customerName?.split(' ')[0] ?? customer.first_name;
  const lastName = overrides.customerName?.split(' ').slice(1).join(' ') || customer.last_name;

  return {
    id,
    token,
    email: overrides.customerEmail ?? customer.email,
    phone: overrides.customerPhone ?? customer.phone,
    currency: 'USD',
    total_price: price,
    line_items: [
      {
        id: id * 10 + 1,
        product_id: product.product_id,
        variant_id: product.variant_id,
        title: overrides.productTitle ?? product.title,
        quantity: 1,
        price,
        sku: product.sku,
      },
    ],
    customer: {
      email: overrides.customerEmail ?? customer.email,
      first_name: firstName,
      last_name: lastName,
      phone: overrides.customerPhone ?? customer.phone,
    },
    abandoned_checkout_url: `https://${shopDomain}/checkouts/${token}/recover`,
    created_at: new Date().toISOString(),
  };
}

export interface OrderOverrides {
  checkoutId: number;
  checkoutToken?: string;
  totalPrice?: string;
  email?: string;
  phone?: string;
  shopDomain?: string;
}

export interface OrderPayload {
  id: number;
  order_number: number;
  checkout_id: number;
  checkout_token: string;
  email: string;
  phone: string;
  currency: string;
  total_price: string;
  created_at: string;
}

export function buildOrderPayload(overrides: OrderOverrides): OrderPayload {
  const customer = pickRandom(CUSTOMERS);
  const id = orderSeq++;

  return {
    id,
    order_number: ++orderNumberSeq,
    checkout_id: overrides.checkoutId,
    checkout_token: overrides.checkoutToken ?? `checkout_${overrides.checkoutId}`,
    email: overrides.email ?? customer.email,
    phone: overrides.phone ?? customer.phone,
    currency: 'USD',
    total_price: overrides.totalPrice ?? '0.00',
    created_at: new Date().toISOString(),
  };
}

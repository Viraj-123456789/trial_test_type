import { Router } from 'express';
import { isValidShopifySignature } from '../services/shopifyWebhookAuth';
import { recordAbandonedCart, UnknownSellerError, CheckoutWebhookPayload } from '../services/cartService';
import { recordOrder, OrderWebhookPayload } from '../services/orderService';
import { enqueueRecoveryJob } from '../workers/recoveryQueue';

export const webhooksRouter = Router();

function isValidCheckoutPayload(body: unknown): body is CheckoutWebhookPayload {
  if (!body || typeof body !== 'object') {
    return false;
  }
  const p = body as Record<string, unknown>;
  const customer = p.customer as Record<string, unknown> | undefined;
  const hasPhone = typeof p.phone === 'string' || typeof customer?.phone === 'string';

  return (
    (typeof p.id === 'string' || typeof p.id === 'number') &&
    typeof p.total_price === 'string' &&
    typeof p.abandoned_checkout_url === 'string' &&
    hasPhone
  );
}

webhooksRouter.post('/checkout', async (req, res) => {
  const signature = req.header('x-shopify-hmac-sha256');
  if (!isValidShopifySignature(req.rawBody, signature)) {
    res.status(401).json({ error: 'invalid webhook signature' });
    return;
  }

  const shopDomain = req.header('x-shopify-shop-domain');
  if (!shopDomain) {
    res.status(400).json({ error: 'missing X-Shopify-Shop-Domain header' });
    return;
  }

  if (!isValidCheckoutPayload(req.body)) {
    res.status(400).json({ error: 'malformed checkouts/create payload' });
    return;
  }

  try {
    const { seller, cart } = await recordAbandonedCart(shopDomain, req.body);
    if (cart) {
      await enqueueRecoveryJob({ cartId: cart.id, delayMinutes: seller.delayMinutes });
    }
    res.status(200).json({ received: true, duplicate: !cart });
  } catch (err) {
    if (err instanceof UnknownSellerError) {
      res.status(404).json({ error: err.message });
      return;
    }
    console.error('POST /webhooks/checkout failed', err);
    res.status(500).json({ error: 'internal error' });
  }
});

function isValidOrderPayload(body: unknown): body is OrderWebhookPayload {
  if (!body || typeof body !== 'object') {
    return false;
  }
  const p = body as Record<string, unknown>;

  return (
    (typeof p.id === 'string' || typeof p.id === 'number') &&
    (typeof p.checkout_id === 'string' || typeof p.checkout_id === 'number') &&
    (typeof p.order_number === 'string' || typeof p.order_number === 'number') &&
    typeof p.total_price === 'string'
  );
}

webhooksRouter.post('/order', async (req, res) => {
  const signature = req.header('x-shopify-hmac-sha256');
  if (!isValidShopifySignature(req.rawBody, signature)) {
    res.status(401).json({ error: 'invalid webhook signature' });
    return;
  }

  const shopDomain = req.header('x-shopify-shop-domain');
  if (!shopDomain) {
    res.status(400).json({ error: 'missing X-Shopify-Shop-Domain header' });
    return;
  }

  if (!isValidOrderPayload(req.body)) {
    res.status(400).json({ error: 'malformed orders/create payload' });
    return;
  }

  try {
    const { order, recoveredCart } = await recordOrder(shopDomain, req.body);
    res.status(200).json({ received: true, duplicate: !order, recovered: Boolean(recoveredCart) });
  } catch (err) {
    if (err instanceof UnknownSellerError) {
      res.status(404).json({ error: err.message });
      return;
    }
    console.error('POST /webhooks/order failed', err);
    res.status(500).json({ error: 'internal error' });
  }
});

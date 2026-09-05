import express from 'express';
import { config } from './config';
import { buildCheckoutPayload, buildOrderPayload, CheckoutOverrides, OrderOverrides } from './payloads';
import { deliverWebhook } from './send';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/', (_req, res) => {
  res.json({
    description: 'Mock storefront — fires Shopify-shaped checkouts/create and orders/create webhooks on demand',
    endpoints: {
      'POST /simulate/checkout': 'fires a checkouts/create webhook (abandoned cart). Body fields all optional: customerName, customerEmail, customerPhone, productTitle, price, shopDomain',
      'POST /simulate/order': 'fires an orders/create webhook (cart converted). Required: checkoutId (from a prior /simulate/checkout response). Optional: checkoutToken, totalPrice, email, phone, shopDomain',
    },
  });
});

app.post('/simulate/checkout', async (req, res) => {
  const overrides = req.body as CheckoutOverrides;
  const payload = buildCheckoutPayload(overrides);
  const delivery = await deliverWebhook('checkouts/create', payload);
  res.status(delivery.ok ? 200 : 502).json({ payload, delivery });
});

app.post('/simulate/order', async (req, res) => {
  const body = req.body as Partial<OrderOverrides>;
  if (body.checkoutId === undefined) {
    res.status(400).json({ error: 'checkoutId is required — use the id from a prior /simulate/checkout response' });
    return;
  }
  const payload = buildOrderPayload(body as OrderOverrides);
  const delivery = await deliverWebhook('orders/create', payload);
  res.status(delivery.ok ? 200 : 502).json({ payload, delivery });
});

app.listen(config.port, () => {
  console.log(`mock storefront listening on :${config.port}`);
  console.log(`firing webhooks at ${config.backendWebhookUrl}`);
});

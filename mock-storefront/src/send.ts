import { config } from './config';
import { signPayload } from './sign';

export interface WebhookDeliveryResult {
  url: string;
  status: number | null;
  ok: boolean;
  error?: string;
}

// Delivers with the same headers a real Shopify webhook carries (topic, shop domain,
// HMAC signature) so the backend's webhook route can't tell mock from real Shopify —
// that's the whole point of ADR-0005.
export async function deliverWebhook(
  topic: 'checkouts/create' | 'orders/create',
  payload: unknown,
): Promise<WebhookDeliveryResult> {
  const path = topic === 'checkouts/create' ? '/webhooks/checkout' : '/webhooks/order';
  const url = `${config.backendWebhookUrl}${path}`;
  const rawBody = JSON.stringify(payload);
  const signature = signPayload(rawBody, config.webhookSecret);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Topic': topic,
        'X-Shopify-Shop-Domain': config.shopDomain,
        'X-Shopify-Hmac-Sha256': signature,
      },
      body: rawBody,
    });
    return { url, status: response.status, ok: response.ok };
  } catch (err) {
    return { url, status: null, ok: false, error: (err as Error).message };
  }
}

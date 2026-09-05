import crypto from 'crypto';

// Matches Shopify's real webhook signature scheme: base64(HMAC-SHA256(raw body, shared secret)),
// delivered in the `X-Shopify-Hmac-Sha256` header. The backend's webhook route (next up) verifies
// against this same MOCK_STOREFRONT_WEBHOOK_SECRET.
export function signPayload(rawBody: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
}

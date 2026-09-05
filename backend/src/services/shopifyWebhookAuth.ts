import crypto from 'crypto';
import { env } from '../config/env';

// Verifies the signature mock-storefront/src/sign.ts produces (and real Shopify's
// scheme). Must run against the raw request bytes, not a re-serialized req.body —
// see ADR-0007.
export function isValidShopifySignature(rawBody: Buffer | undefined, signatureHeader: string | undefined): boolean {
  if (!rawBody || !signatureHeader) {
    return false;
  }

  const expected = crypto.createHmac('sha256', env.shopifyWebhookSecret).update(rawBody).digest('base64');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(signatureHeader, 'utf8');

  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

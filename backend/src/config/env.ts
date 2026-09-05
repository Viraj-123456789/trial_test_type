import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set — copy .env.example to .env at the project root`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: required('DATABASE_URL'),
  redisUrl: required('REDIS_URL'),
  shopifyWebhookSecret: required('MOCK_STOREFRONT_WEBHOOK_SECRET'),
  mockShopDomain: process.env.MOCK_SHOP_DOMAIN ?? 'demo-store.myshopify.com',
  defaultDelayMinutes: Number(process.env.DEFAULT_DELAY_MINUTES ?? 1),
  // Optional, not required(): the rest of the app (routes, worker's check-then-send
  // logic) must keep working before a Twilio Sandbox account exists. whatsappService
  // fails loudly, but only at the point of actually sending — see ADR-0004.
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? '',
  twilioWhatsappFrom: process.env.TWILIO_WHATSAPP_FROM ?? '',
  // How long a cart can sit in 'sending' before the reconciliation sweep assumes the
  // worker crashed mid-send and marks it 'failed'. Deliberately well above realistic
  // Twilio latency (the explicit client timeout in whatsappService.ts bounds that) —
  // see ADR-0009.
  recoverySendingTimeoutMinutes: Number(process.env.RECOVERY_SENDING_TIMEOUT_MINUTES ?? 5),
};

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
};

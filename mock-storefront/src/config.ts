import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: Number(process.env.MOCK_STOREFRONT_PORT ?? 4000),
  webhookSecret: process.env.MOCK_STOREFRONT_WEBHOOK_SECRET ?? '',
  shopDomain: process.env.MOCK_SHOP_DOMAIN ?? 'demo-store.myshopify.com',
  backendWebhookUrl: process.env.BACKEND_WEBHOOK_URL ?? 'http://localhost:3000',
};

if (!config.webhookSecret) {
  throw new Error('MOCK_STOREFRONT_WEBHOOK_SECRET is not set — copy .env.example to .env at the project root');
}

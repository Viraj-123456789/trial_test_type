// Inserts the one demo seller the mock storefront's payloads are addressed to
// (MOCK_SHOP_DOMAIN). Separate from migrations (schema) since this is fixture
// data for local dev/demo, not a schema change.
import { pool } from './pool';
import { env } from '../config/env';

async function main(): Promise<void> {
  const { rows } = await pool.query(
    `INSERT INTO sellers (shop_domain, store_name, delay_minutes)
     VALUES ($1, $2, $3)
     ON CONFLICT (shop_domain) DO NOTHING
     RETURNING id`,
    [env.mockShopDomain, 'Demo Store', env.defaultDelayMinutes],
  );

  if (rows[0]) {
    console.log(`seeded seller id=${rows[0].id} for ${env.mockShopDomain}`);
  } else {
    console.log(`seller for ${env.mockShopDomain} already exists, skipped`);
  }
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

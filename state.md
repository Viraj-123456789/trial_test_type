# state.md — Current Status Snapshot

**Rewritten, not appended. Last updated: 2026-09-05.**

## What's done
- Project scope defined and cut down to MVP (see below).
- Key tech decisions locked and recorded in `adr/`: Node+Express, PostgreSQL, BullMQ+Redis, Twilio WhatsApp Sandbox, self-built mock storefront over real Shopify dev store, raw-SQL migrations over a migration framework (ADR-0006).
- Documentation scaffolding created: `structure.md`, `flow.md`, `adr/`, `CLAUDE.md`.
- **Postgres schema + migrations** (`backend/src/db/migrations/`): `sellers`, `abandoned_carts`, mock `orders`. Custom TS runner (`backend/src/db/migrate.ts`) tracks applied files in `schema_migrations`. Verified against the docker-compose Postgres — migrations apply cleanly and re-running is a no-op.
- **Mock storefront** (`mock-storefront/`): standalone Express app on `MOCK_STOREFRONT_PORT` (4000). `POST /simulate/checkout` and `POST /simulate/order` build Shopify-shaped `checkouts/create`/`orders/create` payloads (fixed fixture pool of customers/products, all fields overridable) and fire them at `BACKEND_WEBHOOK_URL` with real Shopify-style headers (`X-Shopify-Topic`, `X-Shopify-Shop-Domain`, `X-Shopify-Hmac-Sha256` computed the same way Shopify computes it — base64 HMAC-SHA256 of the raw body against `MOCK_STOREFRONT_WEBHOOK_SECRET`).
- **`POST /webhooks/checkout`** (`backend/src/routes/webhooks.ts`): verifies `X-Shopify-Hmac-Sha256` against the raw request body (see ADR-0007 — must use `req.rawBody`, not re-stringified JSON), looks up the seller by `X-Shopify-Shop-Domain`, validates the payload shape, then `cartService.recordAbandonedCart()` inserts into `abandoned_carts` (`ON CONFLICT (seller_id, checkout_id) DO NOTHING` — duplicate Shopify webhook deliveries are a no-op, no double-enqueue) and `workers/recoveryQueue.ts` enqueues a BullMQ delayed job (producer side only; the processor is step #4). Also added: `backend/src/config/env.ts` (centralized env loading), `models/seller.ts` + `models/abandonedCart.ts` (row↔domain mapping, including a fix for pg returning BIGINT as strings — see comment in `db/pool.ts`), `db/sellers.ts` + `db/abandonedCarts.ts` (query layer), `services/shopifyWebhookAuth.ts` (HMAC verification), `app.ts`/`server.ts`, and `db/seed.ts` (inserts the one demo seller matching `MOCK_SHOP_DOMAIN`).
- Verified end-to-end live (Postgres + Redis + both apps running): happy path (200, row inserted, BullMQ job visible in Redis), bad signature (401), unknown seller (404), duplicate delivery (200 with `duplicate:true`, no second job).

## What's in progress
- Nothing mid-flight. Backend now has routes/services/models/workers for Flow 1 up through "enqueue the job" — the worker that consumes the job (step #4) doesn't exist yet, so enqueued jobs currently just sit in Redis unprocessed.

## What's deliberately not built (and why)
- **Multi-store OAuth onboarding** — cut from MVP, doesn't change the core story (webhook → delay → send → confirm).
- **A/B testing of message copy** — cut from MVP, adds complexity with no demo value.
- **SMS/email fallback channels** — cut from MVP, the whole pitch rests on WhatsApp's open-rate advantage.
- **Per-product discount logic** — cut from MVP; one static discount code per seller is enough to tell the story.
- **Real Shopify integration** — deferred, not rejected. Mock storefront fires Shopify-shaped payloads so this is a config swap later, not a rewrite (see ADR-0005).

## Known technical debt
- Twilio sandbox's join-code / 24h-window / template constraints (see ADR-0004) — not yet hit, will matter once whatsappService is built.
- Idempotency in the worker's "check then send" step: schema supports it (`abandoned_carts.status` CHECK constraint), but the worker itself must use `UPDATE ... WHERE status = 'pending'` (not read-then-write) to avoid double-sends on job retry. Noted in a comment in `0002_create_abandoned_carts.sql` — not yet enforced anywhere since the worker doesn't exist yet.
- No down-migrations (accepted trade-off, see ADR-0006) — a bad migration needs a fix-forward file, not a rollback.
- `express@4.22.2` (both `backend` and `mock-storefront`) pulls in a moderate-severity transitive `qs` advisory (via `body-parser`) with no fixed version published yet upstream as of this writing. Low real risk locally, but worth re-running `npm audit` before either app is ever exposed beyond localhost.
- Checkout `id`s are read as JSON numbers (`express.json()` uses `JSON.parse`), which loses precision above `Number.MAX_SAFE_INTEGER`. Fine for the mock storefront's timestamp-based ids and won't matter until a real Shopify integration (ADR-0005) — flagging so it isn't a surprise later.
- ts-node ignores tsconfig's `include`-based ambient `.d.ts` files (like `types/express.d.ts`, used for the `req.rawBody` augmentation from ADR-0007) unless `"ts-node": { "files": true }` is set in `tsconfig.json` — already set, but worth knowing if a similar augmentation is added and mysteriously "disappears" only under `ts-node`/`npm run dev` while `tsc --noEmit` stays green.

## Next up
1. ~~Postgres schema + migrations~~ ✅ done — `sellers`, `abandoned_carts`, mock `orders`.
2. ~~Mock storefront~~ ✅ done — `mock-storefront/`, fires signed `checkouts/create`/`orders/create` payloads on demand.
3. ~~`POST /webhooks/checkout` route~~ ✅ done — verifies signature, records the cart, enqueues the BullMQ job.
4. Worker: check-then-send logic against the mock orders table (the job producer exists in `workers/recoveryQueue.ts`; the processor consuming `RECOVERY_QUEUE_NAME` jobs does not).
5. Twilio WhatsApp send function.
6. `POST /webhooks/order` recovery-confirmation route.
7. Dashboard (Day 2 scope): auth, cart table, stats cards, settings page.

Update this file after every work session — rewrite the relevant sections, don't just tack new lines on the end.

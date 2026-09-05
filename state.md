# state.md — Current Status Snapshot

**Rewritten, not appended. Last updated: 2026-09-05.**

## What's done
- Project scope defined and cut down to MVP (see below).
- Key tech decisions locked and recorded in `adr/`: Node+Express, PostgreSQL, BullMQ+Redis, Twilio WhatsApp Sandbox, self-built mock storefront over real Shopify dev store, raw-SQL migrations over a migration framework (ADR-0006).
- Documentation scaffolding created: `structure.md`, `flow.md`, `adr/`, `CLAUDE.md`.
- **Postgres schema + migrations** (`backend/src/db/migrations/`): `sellers`, `abandoned_carts`, mock `orders`. Custom TS runner (`backend/src/db/migrate.ts`) tracks applied files in `schema_migrations`. Verified against the docker-compose Postgres — migrations apply cleanly and re-running is a no-op.
- **Mock storefront** (`mock-storefront/`): standalone Express app on `MOCK_STOREFRONT_PORT` (4000). `POST /simulate/checkout` and `POST /simulate/order` build Shopify-shaped `checkouts/create`/`orders/create` payloads (fixed fixture pool of customers/products, all fields overridable) and fire them at `BACKEND_WEBHOOK_URL` with real Shopify-style headers (`X-Shopify-Topic`, `X-Shopify-Shop-Domain`, `X-Shopify-Hmac-Sha256` computed the same way Shopify computes it — base64 HMAC-SHA256 of the raw body against `MOCK_STOREFRONT_WEBHOOK_SECRET`). Verified manually: both endpoints return correctly-shaped payloads; delivery correctly fails with `fetch failed` since the backend has no webhook routes yet (expected — that's step #3).

## What's in progress
- Backend has a `package.json`/`tsconfig.json` (pg, dotenv, ts-node/typescript) but no routes/services/workers/models yet. Mock storefront is done and ready to drive the webhook routes as soon as they exist — next step (#3 below).

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
- `mock-storefront`'s `express@4.22.2` pulls in a moderate-severity transitive `qs` advisory (via `body-parser`) with no fixed version published yet upstream as of this writing. Low real risk here (mock storefront only parses JSON bodies it sends to itself in a local demo), but worth re-running `npm audit` before this app is ever exposed beyond localhost.

## Next up
1. ~~Postgres schema + migrations~~ ✅ done — `sellers`, `abandoned_carts`, mock `orders`.
2. ~~Mock storefront~~ ✅ done — `mock-storefront/`, fires signed `checkouts/create`/`orders/create` payloads on demand.
3. `POST /webhooks/checkout` route → enqueue BullMQ delayed job. Must verify `X-Shopify-Hmac-Sha256` against `MOCK_STOREFRONT_WEBHOOK_SECRET` (mock storefront already sends it) and look up the seller by `X-Shopify-Shop-Domain`/`MOCK_SHOP_DOMAIN`.
4. Worker: check-then-send logic against the mock orders table.
5. Twilio WhatsApp send function.
6. `POST /webhooks/order` recovery-confirmation route.
7. Dashboard (Day 2 scope): auth, cart table, stats cards, settings page.

Update this file after every work session — rewrite the relevant sections, don't just tack new lines on the end.

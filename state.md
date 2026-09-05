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
- **Recovery worker** (`backend/src/workers/recoveryWorker.ts`, run as its own process via `npm run worker` / `backend/src/worker.ts` — separate from the Express server per ADR-0001): consumes `RECOVERY_QUEUE_NAME` jobs. Looks up the cart, short-circuits if it's no longer `pending`, calls `orderService.checkIfOrdered()` (scoped by `sellerId` + `checkoutId` — a correction to flow.md's single-arg sketch, since checkout ids are only unique per seller). If an order exists → `cartService.markRecovered()`. If not → **atomically claims the cart first** (`markCartSentIfPending`, pending→sent, *before* calling WhatsApp) and only then calls `whatsappService.sendRecoveryMessage()` — currently a **stub** that logs the would-be message instead of calling Twilio (real integration is step #5). Added `db/orders.ts` + `models/order.ts`, `findSellerById` in `db/sellers.ts`, `markCartRecoveredIfPending`/`markCartSentIfPending`/`findCartById` in `db/abandonedCarts.ts`, `services/orderService.ts`, `services/whatsappService.ts` (stub), and `markRecovered`/`markSent` in `services/cartService.ts`.
- Verified live: seeded a `pending` cart with no matching order → worker claimed it, transitioned to `sent`, logged the stub WhatsApp message. Seeded a second cart, manually inserted a matching `orders` row (simulating what step #6's route will do) → worker marked it `recovered`, no message sent. Manually re-enqueued a duplicate job for the already-`sent` cart → worker logged "already sent, skipping" and `sent_at` was unchanged — confirms the double-send fix actually works, not just that the code compiles.

## What's in progress
- Nothing mid-flight. Flow 1 (webhook → delay → check → send-or-recover) is fully wired end to end, with WhatsApp sending stubbed. Flow 2 (`POST /webhooks/order`) still doesn't exist, so a real order webhook can't yet trigger the sent→recovered transition — only the worker's own pending→recovered path (order-already-existed-by-the-time-the-delay-elapsed) is live.

## What's deliberately not built (and why)
- **Multi-store OAuth onboarding** — cut from MVP, doesn't change the core story (webhook → delay → send → confirm).
- **A/B testing of message copy** — cut from MVP, adds complexity with no demo value.
- **SMS/email fallback channels** — cut from MVP, the whole pitch rests on WhatsApp's open-rate advantage.
- **Per-product discount logic** — cut from MVP; one static discount code per seller is enough to tell the story.
- **Real Shopify integration** — deferred, not rejected. Mock storefront fires Shopify-shaped payloads so this is a config swap later, not a rewrite (see ADR-0005).

## Known technical debt
- Twilio sandbox's join-code / 24h-window / template constraints (see ADR-0004) — not yet hit, will matter once whatsappService's stub is replaced with a real Twilio call.
- ~~Idempotency in the worker's "check then send" step~~ ✅ resolved — `markCartSentIfPending()` atomically claims (pending→sent) *before* the send call, verified live against a manually duplicated job. Residual edge case, accepted for MVP: if the process crashes after the claim but before the WhatsApp call actually completes (step #5), the cart is left `sent` without a message having gone out, and a retry won't re-attempt it since status is no longer `pending`. Fixing that fully would need a `sending` intermediate status + outbox-style pattern — out of scope for a 2-day MVP with a sandbox-only demo.
- No down-migrations (accepted trade-off, see ADR-0006) — a bad migration needs a fix-forward file, not a rollback.
- `express@4.22.2` (both `backend` and `mock-storefront`) pulls in a moderate-severity transitive `qs` advisory (via `body-parser`) with no fixed version published yet upstream as of this writing. Low real risk locally, but worth re-running `npm audit` before either app is ever exposed beyond localhost.
- Checkout `id`s are read as JSON numbers (`express.json()` uses `JSON.parse`), which loses precision above `Number.MAX_SAFE_INTEGER`. Fine for the mock storefront's timestamp-based ids and won't matter until a real Shopify integration (ADR-0005) — flagging so it isn't a surprise later.
- ts-node ignores tsconfig's `include`-based ambient `.d.ts` files (like `types/express.d.ts`, used for the `req.rawBody` augmentation from ADR-0007) unless `"ts-node": { "files": true }` is set in `tsconfig.json` — already set, but worth knowing if a similar augmentation is added and mysteriously "disappears" only under `ts-node`/`npm run dev` while `tsc --noEmit` stays green.

## Next up
1. ~~Postgres schema + migrations~~ ✅ done — `sellers`, `abandoned_carts`, mock `orders`.
2. ~~Mock storefront~~ ✅ done — `mock-storefront/`, fires signed `checkouts/create`/`orders/create` payloads on demand.
3. ~~`POST /webhooks/checkout` route~~ ✅ done — verifies signature, records the cart, enqueues the BullMQ job.
4. ~~Worker: check-then-send logic~~ ✅ done — `recoveryWorker.ts`, run via `npm run worker`. WhatsApp sending is a stub (logs, doesn't call Twilio) — that's #5.
5. Twilio WhatsApp send function — replace `services/whatsappService.ts`'s stub body with a real Twilio WhatsApp Sandbox call; keep its signature (`sendRecoveryMessage(cart, seller)`) so the worker doesn't need to change.
6. `POST /webhooks/order` recovery-confirmation route.
7. Dashboard (Day 2 scope): auth, cart table, stats cards, settings page.

Update this file after every work session — rewrite the relevant sections, don't just tack new lines on the end.

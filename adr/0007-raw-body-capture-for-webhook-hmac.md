# 0007 — Capture raw request body for Shopify HMAC verification

## Context
Shopify (and the mock storefront standing in for it, per ADR-0005) signs webhook deliveries with `X-Shopify-Hmac-Sha256`: base64(HMAC-SHA256(raw request body bytes, shared secret)). Express's `express.json()` parses the body into a JS object before a route handler ever sees it — `JSON.stringify(req.body)` is **not guaranteed** to reproduce the exact bytes Shopify signed (key order, whitespace, number formatting can all differ), so verifying against a re-serialized body would intermittently reject genuine webhooks.

## Decision
Capture the raw bytes via `express.json({ verify: (req, res, buf) => { req.rawBody = buf } })` at app setup, and verify the HMAC against `req.rawBody` (a `Buffer`) — never against a re-stringified `req.body`. `req.rawBody` is added via TypeScript declaration merging (`backend/src/types/express.d.ts`), not `any`-casts.

## Alternatives considered
- **Verify against `JSON.stringify(req.body)`** — rejected: correct only by coincidence when key order/formatting happens to match; would produce intermittent, hard-to-reproduce 401s in production.
- **A dedicated raw-body-parsing library** (e.g. `raw-body` directly, bypassing `express.json`) — rejected: `express.json`'s own `verify` hook already exposes the exact buffer it parses from, with no extra dependency.

## Consequences
- Every route mounted behind the shared `express.json()` middleware gets `req.rawBody` populated, not just webhook routes — harmless, but worth knowing if a future route relies on `req.rawBody` being absent.
- HMAC comparison uses `crypto.timingSafeEqual` (not `===`) with an explicit length check first (timingSafeEqual throws on mismatched-length buffers) — this must be preserved in `services/shopifyWebhookAuth.ts` if that file is ever touched.

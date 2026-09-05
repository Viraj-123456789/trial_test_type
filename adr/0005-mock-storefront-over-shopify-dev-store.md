# 0005 — Mock storefront over real Shopify Partner dev store

## Context
Need a source of `checkouts/create` / `orders/create` events to build and demo the recovery engine against.

## Decision
Build a small self-hosted mock storefront that fires webhook payloads shaped exactly like Shopify's real ones.

## Alternatives considered
- **Real Shopify Partner dev store** — free, and gives genuinely real webhooks. Rejected for now because it adds setup time (partner account approval, dev store creation, webhook topic subscriptions, API version pinning) that doesn't change what's actually being demonstrated: the recovery engine's behavior is identical regardless of where the event came from.

## Consequences
- Zero external account dependencies — can start building the engine immediately.
- The mock payload shape must be kept faithful to Shopify's real schema (field names, nesting — id, email, phone, line_items, abandoned_checkout_url, total_price) so that swapping in a real Shopify store later is a config/trigger change in `mock-storefront/`, not a rewrite of `backend/src/routes/webhooks.js`.

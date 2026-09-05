# state.md — Current Status Snapshot

**Rewritten, not appended. Last updated: 2026-09-03.**

## What's done
- Project scope defined and cut down to MVP (see below).
- Key tech decisions locked and recorded in `adr/`: Node+Express, PostgreSQL, BullMQ+Redis, Twilio WhatsApp Sandbox, self-built mock storefront over real Shopify dev store.
- Documentation scaffolding created: `structure.md`, `flow.md`, `adr/`, `CLAUDE.md`.

## What's in progress
- Nothing yet — this is the planning/scaffolding phase. No application code has been written.

## What's deliberately not built (and why)
- **Multi-store OAuth onboarding** — cut from MVP, doesn't change the core story (webhook → delay → send → confirm).
- **A/B testing of message copy** — cut from MVP, adds complexity with no demo value.
- **SMS/email fallback channels** — cut from MVP, the whole pitch rests on WhatsApp's open-rate advantage.
- **Per-product discount logic** — cut from MVP; one static discount code per seller is enough to tell the story.
- **Real Shopify integration** — deferred, not rejected. Mock storefront fires Shopify-shaped payloads so this is a config swap later, not a rewrite (see ADR-0005).

## Known technical debt
- None yet — nothing built. First debt will likely show up around: Twilio sandbox's join-code / 24h-window / template constraints (see ADR-0004), and idempotency in the worker's "check then send" step (needs a row lock or unique constraint to avoid double-sends on job retry).

## Next up
1. Postgres schema + migrations (`sellers`, `abandoned_carts`, plus a mock `orders` table).
2. Mock storefront: fires a `checkouts/create`-shaped payload on demand.
3. `POST /webhooks/checkout` route → enqueue BullMQ delayed job.
4. Worker: check-then-send logic against the mock orders table.
5. Twilio WhatsApp send function.
6. `POST /webhooks/order` recovery-confirmation route.
7. Dashboard (Day 2 scope): auth, cart table, stats cards, settings page.

Update this file after every work session — rewrite the relevant sections, don't just tack new lines on the end.

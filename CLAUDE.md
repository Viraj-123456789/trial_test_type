# CLAUDE.md — Agent Instructions

This file is the entry point for any AI coding agent (or human) working on this repo. Read this first, then follow the pointers below before making changes.

## Project in one line
A webhook receiver that listens for abandoned-cart events, waits N minutes, checks if the cart converted, and — if not — sends a WhatsApp recovery message with a discount link. WhatsApp gets 90%+ open rates vs ~10% for recovery email, and small Shopify/WooCommerce sellers can't afford WATI/AiSensy.

## Read these first, in this order
1. **`state.md`** — what's actually built right now vs. planned. Don't re-propose work that's already done or already rejected.
2. **`structure.md`** — where things live and why. Check this before creating any new file; there is almost always a "right" folder for it.
3. **`flow.md`** — the actual call graph for the two core flows (cart-abandoned → send, order-created → recovery-confirm). Check this before touching any function to see what calls it and what breaks.
4. **`adr/`** — why key tech decisions were made the way they were, and what was considered and rejected. Don't relitigate a decision without reading its ADR first.

## Tech stack (locked — see adr/ for why)
- Backend: Node.js + Express
- Queue/delay: BullMQ + Redis
- Database: PostgreSQL
- WhatsApp: Twilio WhatsApp Sandbox
- Cart-event source: self-built mock storefront (fires Shopify-shaped webhook payloads — no real Shopify account needed)
- Frontend: React + recharts
- Language: TypeScript

## Explicitly cut from MVP — do not build these unless asked
- Multi-store OAuth onboarding
- A/B testing of message copy
- SMS/email fallback channels
- Per-product discount logic
- Real Shopify integration (mock storefront stands in; keep the webhook payload shape Shopify-compatible so swapping later is a config change, not a rewrite)

If a task seems to require one of the above, stop and confirm with the user instead of building it.

## Conventions
- Every non-trivial decision (library choice, schema shape, protocol quirk worked around) gets an ADR in `adr/`, not just a code comment.
- After finishing a unit of work, update `state.md` (rewrite the relevant section, don't just append) and `flow.md` (mark what's now real vs. still planned).
- Env vars go in `.env`, documented in `.env.example` — never commit real secrets.
- Mock storefront payloads must match Shopify's real `checkouts/create` / `orders/create` shape (field names, nesting) so the webhook handler doesn't need to change when swapped for a real store later.

## Current status
See `state.md`. As of this writing: planning/scaffolding phase, no application code written yet.

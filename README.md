# WhatsApp Abandoned Cart Recovery Bot

A webhook receiver that listens for abandoned-cart events, waits N minutes, checks if the customer already checked out, and — if not — sends them a WhatsApp message with a discount link. Built because WhatsApp gets 90%+ open rates vs ~10% for recovery email, and small Shopify/WooCommerce sellers can't afford WATI/AiSensy.

## Start here
- [`CLAUDE.md`](./CLAUDE.md) — agent/dev entry point, read this first
- [`structure.md`](./structure.md) — where things live and why
- [`state.md`](./state.md) — what's built, what's not
- [`flow.md`](./flow.md) — the call path for the two core flows
- [`adr/`](./adr) — why key tech decisions were made

## Stack
Node.js + Express · BullMQ + Redis · PostgreSQL · Twilio WhatsApp Sandbox · React + recharts

## Status
Planning/scaffolding phase — no application code yet. See `state.md`.

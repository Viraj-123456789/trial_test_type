# structure.md — Map of the Codebase

This describes *where things live and why*, not a file listing. If you're about to create a new file, find the matching case below first — there's almost always a right place for it.

## Organizing principle
Three independent workspaces at the root — `backend`, `mock-storefront`, `frontend` — because they're deployed and run separately. **Inside `backend`, organization is layer-based** (routes / services / workers / db / models) rather than feature-based, because the MVP has exactly one feature (cart recovery). A folder-per-feature structure with one feature in it just adds indirection. Revisit this if a second feature (e.g. SMS fallback) is ever added.

## Top-level layout
```
whatsapp-cart-recovery/
├── backend/            Express API + BullMQ worker. The actual recovery engine.
│   └── src/
│       ├── routes/     HTTP endpoints — webhook receivers, dashboard API, auth
│       ├── services/   Business logic — cart matching, WhatsApp sending, discount logic
│       ├── workers/    BullMQ job processors — the delayed recovery-check-and-send job
│       ├── db/         Postgres connection, migrations, query layer
│       ├── models/     Data shape / row-mapping helpers (sellers, carts, orders)
│       └── config/     Env loading, constants, defaults
├── mock-storefront/    Fires Shopify-shaped webhooks (checkouts/create, orders/create)
├── frontend/            React seller dashboard
├── adr/                 Architecture decision records
├── structure.md          This file
├── state.md              What's done / in progress / not built
├── flow.md               Call-path map for the core flows
├── CLAUDE.md              Agent entry point
└── README.md              Human-facing quick start
```

## "If you need to do X, look in Y"

**Add or change a webhook endpoint** (e.g. how `checkouts/create` is received) → `backend/src/routes/`. Route handlers should stay thin — validate the payload, then hand off to `services/`.

**Change what happens when a cart is confirmed abandoned or recovered** (business logic — should we send, should we mark recovered) → `backend/src/services/`. Cart-matching and WhatsApp-sending logic live here, kept separate from HTTP concerns so they're testable without spinning up Express.

**Change the delayed-send behavior** (delay timing, retry policy, what the job does when it fires) → `backend/src/workers/`. This is the BullMQ job processor — the piece that makes this a real system rather than a synchronous "send immediately" script.

**Change the database schema, add a migration, or change a query** → `backend/src/db/`. Migrations are the source of truth for schema; don't hand-edit the DB.

**Change how a `seller`, `abandoned_cart`, or `order` is shaped in code** → `backend/src/models/`. Thin mapping layer between DB rows and the shapes services/routes use.

**Change env var loading or a constant** (delay defaults, WhatsApp template placeholders) → `backend/src/config/`.

**Simulate a different cart-abandonment scenario for testing** → `mock-storefront/`. A small standalone app that fires webhook payloads shaped exactly like Shopify's real ones, so `backend/src/routes/` never has to know the difference between mock and real Shopify.

**Change the dashboard UI** (cart table, stats cards, settings page) → `frontend/`.

**Record why a technical decision was made** → new file in `adr/`, numbered sequentially. Don't edit an old ADR to change its decision — write a new one and mark it as superseding the old.

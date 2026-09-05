# 0002 — PostgreSQL over MongoDB

## Context
Cart/order data is inherently relational: a seller has many carts, a cart transitions through a fixed set of statuses (pending → sent → recovered/expired), and the recovery-confirmation flow needs to reliably match an order back to a specific cart.

## Decision
PostgreSQL.

## Alternatives considered
- **MongoDB** — explicitly flagged in the original brief as viable "if you'd rather move faster." Rejected because there's no schema-flexibility need here (every field is known upfront), and Postgres gives free integrity guarantees (foreign keys, unique constraints) that directly help the check-then-send idempotency problem in the worker.

## Consequences
- Requires writing and running migrations (source of truth for schema lives in `backend/src/db/`).
- Gains transactional guarantees useful for the cart status state machine and for preventing double-sends.

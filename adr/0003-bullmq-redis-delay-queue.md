# 0003 — BullMQ + Redis for the delay queue

## Context
Need to wait N minutes after a cart is abandoned, then reliably check-and-send, with retry on failure and survival across server restarts. This is the piece that makes the system a real recovery engine rather than a synchronous toy.

## Decision
BullMQ + Redis.

## Alternatives considered
- **`setTimeout` in-process** — rejected: the timer dies on any server restart or deploy, no retry, no observability into pending jobs.
- **Cron job polling a "due" timestamp column** — rejected: works, but reinvents a worse version of a queue with no built-in retry/backoff and extra polling overhead.
- **A hosted queue service** (e.g. SQS) — rejected: adds an external account/cost dependency that isn't justified for a 2-day MVP.

## Consequences
- Requires running Redis alongside the app (one more moving part in local dev and deploy).
- Gains persistence across restarts, retry/backoff on failure, and an inspectable queue (BullBoard, if needed later) for debugging stuck jobs.

# 0001 — Node.js + Express for the backend

## Context
Need a webhook receiver plus a small REST API for the dashboard, buildable in a 2-day window, with a worker process that runs outside the request/response cycle for delayed jobs.

## Decision
Node.js + Express.

## Alternatives considered
- **Python + FastAPI** — equally fast to build in, but Node's ecosystem for BullMQ and the Twilio SDK is more mature and better documented for this exact use case.
- **Next.js full-stack** — would merge frontend and backend into one deploy, but couples the worker process awkwardly since BullMQ workers need to run as a separate long-lived process outside Next's request lifecycle anyway.

## Consequences
- One language (JS/TS) across backend and frontend (React).
- Still need a separate worker process — this is required by BullMQ regardless of framework choice, not an extra cost of this decision.

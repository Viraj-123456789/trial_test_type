# 0006 — Raw SQL migrations with a custom runner, over a migration framework

## Context
Need to create and track schema changes for three tables (`sellers`, `abandoned_carts`, mock `orders`) in a way that's the schema's source of truth (per ADR-0002), buildable in the 2-day MVP window.

## Decision
Plain numbered `.sql` files in `backend/src/db/migrations/`, applied in order by a small TypeScript runner (`backend/src/db/migrate.ts`) that tracks applied filenames in a `schema_migrations` table. No down-migrations for now — MVP has no data worth rolling back yet.

## Alternatives considered
- **`node-pg-migrate`** — mature and widely used, but adds a dependency, a TS-migration build step (ts-node/tsc wiring), and its own JS DSL for what is otherwise three straightforward `CREATE TABLE` statements. Rejected as unnecessary indirection for this stage; revisit if migrations grow complex enough to need rollback support or programmatic schema introspection.
- **ORM-managed schema** (e.g. Prisma/TypeORM migrations) — rejected same reason as ADR-0002 rejected MongoDB's flexibility: the schema is small, fixed, and known upfront; an ORM's migration engine is more machinery than three tables need.

## Consequences
- Schema changes are plain SQL, readable without knowing a library's DSL.
- No automatic rollback — a bad migration must be fixed forward with a new migration file, not reversed. Acceptable while there's no production data.
- If schema churn increases post-MVP, revisit in favor of `node-pg-migrate` rather than growing the custom runner.

# 0008 — Add down-migrations (amends ADR-0006)

## Context
ADR-0006 chose raw `.sql` migrations with a custom runner over a framework, and explicitly accepted "no down-migrations" as a consequence, reasoning there was no data yet worth rolling back. That reasoning about the schema's simplicity still holds — this ADR does not revisit the raw-SQL-over-a-framework decision. But the "no rollback" consequence itself is being reversed at explicit request: being able to cleanly undo a bad migration (or step back during schema iteration) is worth the small added maintenance cost of a paired down-file per migration.

## Decision
Every migration gets a paired `<name>.down.sql` file in the same `backend/src/db/migrations/` directory. `backend/src/db/migrate.ts` gained a `down` mode: `npm run migrate:down [steps]` rolls back the `steps` most-recently-applied migrations (default 1), each by running its `.down.sql` and deleting its row from `schema_migrations`, all inside a transaction per migration.

Rollback only ever targets "the last N applied," ordered by `schema_migrations.applied_at DESC` — there is no way to roll back an arbitrary named migration out of order. This is safe by construction: migrations were applied in dependency order (e.g. `abandoned_carts`/`orders` reference `sellers`), so undoing them in reverse-chronological order always drops a dependent table before the table it references.

## Alternatives considered
- **Arbitrary/targeted rollback** (roll back migration `0002` specifically, regardless of what's applied after it) — rejected: would need real dependency-graph awareness to stay safe (you can't drop `sellers` while `abandoned_carts` still references it), which is real machinery this MVP's linear, hand-written migration set doesn't need. "Last N" is simpler and matches how the migrations are actually structured.
- **Switching to `node-pg-migrate`** (which has down-migration support built in) — still rejected for the reasons in ADR-0006; this ADR only reverses the one consequence, not the underlying tool choice.

## Consequences
- Every future migration must ship with a `.down.sql` alongside it, or `migrate:down` fails loudly with a clear error rather than silently skipping it.
- The up-runner's file glob had to explicitly exclude `*.down.sql` (it previously matched any `*.sql`), since both files now live in the same directory.
- Down migrations are fix-forward's exact inverse, not a general "restore data" mechanism — e.g. `0002`'s down is `DROP TABLE abandoned_carts`, which destroys any rows in it. Never run `migrate:down` against data worth keeping.

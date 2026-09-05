import fs from 'fs';
import path from 'path';
import { pool } from './pool';

const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations');

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function appliedMigrations(): Promise<Set<string>> {
  const { rows } = await pool.query<{ filename: string }>('SELECT filename FROM schema_migrations');
  return new Set(rows.map((row) => row.filename));
}

async function runMigration(filename: string): Promise<void> {
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
    await client.query('COMMIT');
    console.log(`applied ${filename}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw new Error(`migration ${filename} failed: ${(err as Error).message}`);
  } finally {
    client.release();
  }
}

// Rolls back one already-applied migration by running its paired `.down.sql` file.
// No down-file targeting by name — always the most-recently-applied one, so reverse
// order naturally drops dependents before what they reference (see ADR-0008).
async function runDownMigration(filename: string): Promise<void> {
  const downFilename = filename.replace(/\.sql$/, '.down.sql');
  const downPath = path.join(MIGRATIONS_DIR, downFilename);
  if (!fs.existsSync(downPath)) {
    throw new Error(`no down migration found for ${filename} (expected ${downFilename})`);
  }

  const sql = fs.readFileSync(downPath, 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('DELETE FROM schema_migrations WHERE filename = $1', [filename]);
    await client.query('COMMIT');
    console.log(`rolled back ${filename}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw new Error(`rollback of ${filename} failed: ${(err as Error).message}`);
  } finally {
    client.release();
  }
}

async function up(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await appliedMigrations();
  // .down.sql files live alongside their .sql counterpart in the same directory —
  // exclude them here or the up-runner would try to "apply" them too.
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
    .sort();

  const pending = files.filter((f) => !applied.has(f));
  if (pending.length === 0) {
    console.log('no pending migrations');
    return;
  }

  for (const file of pending) {
    await runMigration(file);
  }
}

async function down(steps: number): Promise<void> {
  await ensureMigrationsTable();
  const { rows } = await pool.query<{ filename: string }>(
    'SELECT filename FROM schema_migrations ORDER BY applied_at DESC LIMIT $1',
    [steps],
  );

  if (rows.length === 0) {
    console.log('no applied migrations to roll back');
    return;
  }

  for (const row of rows) {
    await runDownMigration(row.filename);
  }
}

async function main(): Promise<void> {
  const [, , mode, stepsArg] = process.argv;

  if (mode === 'down') {
    const steps = stepsArg ? Number(stepsArg) : 1;
    if (!Number.isInteger(steps) || steps < 1) {
      throw new Error(`invalid step count "${stepsArg}" — expected a positive integer`);
    }
    await down(steps);
    return;
  }

  await up();
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

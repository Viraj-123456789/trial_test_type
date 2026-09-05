// Entrypoint for the worker process — run separately from server.ts (see ADR-0001:
// BullMQ workers can't live inside Express's request lifecycle).
import { recoveryWorker } from './workers/recoveryWorker';
import { env } from './config/env';
import { reapStaleSending } from './services/cartService';

console.log(`recovery worker process started, listening on queue "${recoveryWorker.name}"`);

// Backstop for the crash-window bug (ADR-0009): a cart stuck in 'sending' this long
// is assumed orphaned by a crashed/killed worker process and gets marked 'failed'.
const SWEEP_INTERVAL_MS = 60_000;

async function runSweep(): Promise<void> {
  try {
    const reaped = await reapStaleSending(env.recoverySendingTimeoutMinutes);
    if (reaped.length > 0) {
      console.warn(
        `reconciliation sweep: reaped ${reaped.length} cart(s) stuck in 'sending' for over ` +
          `${env.recoverySendingTimeoutMinutes}m, marked failed: ${reaped.map((c) => c.id).join(', ')}`,
      );
    }
  } catch (err) {
    console.error('reconciliation sweep failed', err);
  }
}

// Runs once immediately — this is the realistic recovery path (crash, then restart).
runSweep();
// Periodic backstop while the process stays up (mainly relevant if a send somehow
// hangs past whatsappService's own Twilio request timeout without crashing).
setInterval(runSweep, SWEEP_INTERVAL_MS);

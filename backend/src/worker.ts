// Entrypoint for the worker process — run separately from server.ts (see ADR-0001:
// BullMQ workers can't live inside Express's request lifecycle).
import { recoveryWorker } from './workers/recoveryWorker';

console.log(`recovery worker process started, listening on queue "${recoveryWorker.name}"`);

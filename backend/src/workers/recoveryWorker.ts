import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env';
import { RECOVERY_QUEUE_NAME, RecoveryJobData } from './recoveryQueue';
import { findCartById } from '../db/abandonedCarts';
import { findSellerById } from '../db/sellers';
import { checkIfOrdered } from '../services/orderService';
import { markFailed, markRecovered, markSending, markSentConfirmed } from '../services/cartService';
import { sendRecoveryMessage } from '../services/whatsappService';

const connection = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });

// Comfortably above whatsappService's own Twilio request timeout + margin, so BullMQ
// doesn't mistake a legitimately-in-flight send for a stalled job and redeliver it
// concurrently (see ADR-0009). Not a correctness fix either way — the redelivered
// copy would just no-op on `status !== 'pending'` — but avoids noisy duplicate runs.
const LOCK_DURATION_MS = 60_000;

async function processRecoveryJob(job: Job<RecoveryJobData>): Promise<void> {
  const cart = await findCartById(job.data.cartId);
  if (!cart) {
    console.warn(`recoveryWorker: cart ${job.data.cartId} not found, skipping`);
    return;
  }
  if (cart.status !== 'pending') {
    console.log(`recoveryWorker: cart ${cart.id} already ${cart.status}, skipping`);
    return;
  }

  const seller = await findSellerById(cart.sellerId);
  if (!seller) {
    console.warn(`recoveryWorker: seller ${cart.sellerId} not found for cart ${cart.id}, skipping`);
    return;
  }

  const order = await checkIfOrdered(cart.sellerId, cart.checkoutId);
  if (order) {
    await markRecovered(cart.id);
    console.log(`recoveryWorker: cart ${cart.id} already converted (order ${order.orderNumber}), marked recovered`);
    return;
  }

  // Claim (pending -> sending) BEFORE sending — see the comment on
  // markCartSendingIfPending. `sending` (not straight to `sent`) is what makes a
  // crash between this claim and the Twilio call resolving detectable — see ADR-0009.
  const claimed = await markSending(cart.id);
  if (!claimed) {
    console.log(`recoveryWorker: cart ${cart.id} claimed by another run, skipping send`);
    return;
  }

  const result = await sendRecoveryMessage(claimed, seller);
  if (result.ok) {
    const confirmed = await markSentConfirmed(cart.id);
    if (!confirmed) {
      // The reconciliation sweep already reaped this cart to `failed` while the send
      // was still in flight, and it then succeeded anyway — the one accepted edge
      // case from ADR-0009. Log it so a real "sent but recorded failed" case is at
      // least auditable instead of silently invisible.
      console.warn(
        `recoveryWorker: cart ${cart.id} sent successfully (sid=${result.sid}) but was already reaped as failed — status left as failed, needs manual review`,
      );
    }
  } else {
    await markFailed(cart.id);
    console.error(`recoveryWorker: send failed for cart ${cart.id}, marked failed: ${result.error}`);
  }
}

export const recoveryWorker = new Worker<RecoveryJobData>(RECOVERY_QUEUE_NAME, processRecoveryJob, {
  connection,
  lockDuration: LOCK_DURATION_MS,
});

recoveryWorker.on('failed', (job, err) => {
  console.error(`recoveryWorker: job ${job?.id} failed`, err);
});

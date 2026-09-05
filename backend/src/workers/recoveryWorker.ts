import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env';
import { RECOVERY_QUEUE_NAME, RecoveryJobData } from './recoveryQueue';
import { findCartById } from '../db/abandonedCarts';
import { findSellerById } from '../db/sellers';
import { checkIfOrdered } from '../services/orderService';
import { markRecovered, markSent } from '../services/cartService';
import { sendRecoveryMessage } from '../services/whatsappService';

const connection = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });

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

  // Claim (pending -> sent) BEFORE sending — see the comment on markCartSentIfPending.
  const claimed = await markSent(cart.id);
  if (!claimed) {
    console.log(`recoveryWorker: cart ${cart.id} claimed by another run, skipping send`);
    return;
  }

  await sendRecoveryMessage(claimed, seller);
}

export const recoveryWorker = new Worker<RecoveryJobData>(RECOVERY_QUEUE_NAME, processRecoveryJob, { connection });

recoveryWorker.on('failed', (job, err) => {
  console.error(`recoveryWorker: job ${job?.id} failed`, err);
});

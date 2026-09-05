import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env';

// BullMQ requires this on any connection it manages itself.
const connection = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });

export const RECOVERY_QUEUE_NAME = 'recovery';

export const recoveryQueue = new Queue(RECOVERY_QUEUE_NAME, { connection });

export interface RecoveryJobData {
  cartId: number;
}

// Producer side only — the processor that consumes these jobs (recoveryWorker.ts,
// per flow.md) is built in the next step.
export async function enqueueRecoveryJob(params: { cartId: number; delayMinutes: number }): Promise<void> {
  const data: RecoveryJobData = { cartId: params.cartId };
  await recoveryQueue.add('check-and-send', data, { delay: params.delayMinutes * 60_000 });
}

import twilio, { Twilio } from 'twilio';
import { env } from '../config/env';
import { Seller } from '../models/seller';
import { AbandonedCart } from '../models/abandonedCart';

export interface RecoveryMessageResult {
  ok: boolean;
  sid?: string;
  error?: string;
  previewText: string;
}

interface LineItem {
  title?: string;
}

function buildMessageText(cart: AbandonedCart, seller: Seller): string {
  const lineItems = Array.isArray(cart.lineItems) ? (cart.lineItems as LineItem[]) : [];
  const product = lineItems[0]?.title ?? 'your cart';
  const name = cart.customerName ?? 'there';
  return `Hi ${name}, you left ${product} in your cart! Use code ${seller.discountCode} for ${seller.discountPercent}% off: ${cart.checkoutUrl}`;
}

let client: Twilio | null = null;

// Constructed lazily (not at module load) so the rest of the app — routes, the
// worker's check-then-send logic — keeps working before a Twilio Sandbox account
// exists. Only actually sending a message requires real credentials.
function getClient(): Twilio {
  if (!env.twilioAccountSid || !env.twilioAuthToken) {
    throw new Error(
      'TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN are not set — copy .env.example to .env and fill in Twilio Sandbox credentials',
    );
  }
  if (!client) {
    client = twilio(env.twilioAccountSid, env.twilioAuthToken);
  }
  return client;
}

// Sends via Twilio's WhatsApp Sandbox. Per ADR-0004, this only succeeds if the
// recipient has already sent the sandbox's "join <code>" message and is within its
// 24h session window — outside that window Twilio rejects the send, which surfaces
// here as `ok: false`, not a thrown error.
export async function sendRecoveryMessage(cart: AbandonedCart, seller: Seller): Promise<RecoveryMessageResult> {
  const text = buildMessageText(cart, seller);

  if (!cart.customerPhone.startsWith('+')) {
    return { ok: false, error: `customerPhone "${cart.customerPhone}" is not in E.164 format`, previewText: text };
  }

  try {
    const message = await getClient().messages.create({
      from: env.twilioWhatsappFrom,
      to: `whatsapp:${cart.customerPhone}`,
      body: text,
    });
    console.log(`whatsappService: sent to ${cart.customerPhone}, sid=${message.sid}, status=${message.status}`);
    return { ok: true, sid: message.sid, previewText: text };
  } catch (err) {
    const error = err as Error;
    console.error(`whatsappService: failed to send to ${cart.customerPhone}: ${error.message}`);
    return { ok: false, error: error.message, previewText: text };
  }
}

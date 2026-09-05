import { Seller } from '../models/seller';
import { AbandonedCart } from '../models/abandonedCart';

export interface RecoveryMessageResult {
  ok: boolean;
  previewText: string;
}

interface LineItem {
  title?: string;
}

// STUB — no Twilio call yet. Real WhatsApp Sandbox integration is the next step
// (state.md "next up" #5, ADR-0004). This exists now so the worker's check-then-send
// control flow is complete and testable without Twilio credentials; swap the body,
// keep the signature.
export async function sendRecoveryMessage(cart: AbandonedCart, seller: Seller): Promise<RecoveryMessageResult> {
  const lineItems = Array.isArray(cart.lineItems) ? (cart.lineItems as LineItem[]) : [];
  const product = lineItems[0]?.title ?? 'your cart';
  const name = cart.customerName ?? 'there';

  const text = `Hi ${name}, you left ${product} in your cart! Use code ${seller.discountCode} for ${seller.discountPercent}% off: ${cart.checkoutUrl}`;

  console.log(`[whatsappService STUB] would send WhatsApp to ${cart.customerPhone}: "${text}"`);
  return { ok: true, previewText: text };
}

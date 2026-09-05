# flow.md — Call-Path Map

**Status: PLANNED — no code written yet.** This describes the intended call path so implementation follows one shape. As each piece is built, replace the checkbox with ✅ and confirm the file/function name matches reality. Keep this file honest — it's the first place to check before touching a function, to see what calls it and what breaks if it changes.

## Flow 1: Cart abandoned → recovery message sent

```
[✅] Shopify/mock fires `checkouts/create` webhook   mock-storefront/src/index.ts (POST /simulate/checkout)
        │
        ▼
[✅] POST /webhooks/checkout              backend/src/routes/webhooks.ts
        │  verifies X-Shopify-Hmac-Sha256 against req.rawBody (ADR-0007),
        │  looks up seller by X-Shopify-Shop-Domain, validates payload shape
        ▼
[✅] cartService.recordAbandonedCart()    backend/src/services/cartService.ts
        │  inserts into `abandoned_carts` (status: pending);
        │  ON CONFLICT (seller_id, checkout_id) DO NOTHING → duplicate delivery, no-op
        ▼
[✅] enqueueRecoveryJob()                 backend/src/workers/recoveryQueue.ts
        │  BullMQ delayed job, delay = seller.delay_minutes * 60000
        ▼
        ⋯ time passes ⋯
        ▼
[✅] recoveryWorker processor fires       backend/src/workers/recoveryWorker.ts
        │  run as its own process: `npm run worker` → backend/src/worker.ts (ADR-0001)
        │  short-circuits if cart.status !== 'pending' (already handled — retry/duplicate job)
        │
        ├─[✅] orderService.checkIfOrdered(sellerId, checkoutId)   backend/src/services/orderService.ts
        │        queries mock orders for this seller+checkout id (seller-scoped — checkout ids
        │        are only unique per seller, see the DB unique constraint)
        │
        ├─ if order exists → cartService.markRecovered() → status: recovered, STOP (no message sent)  ✅
        │
        └─ if no order →
              [✅] cartService.markSent()  atomically claims pending → sent *before* sending —
              │     this ordering (not send-then-mark) is what makes a retried/duplicate job safe
              ▼
              [🚧] whatsappService.sendRecoveryMessage()  backend/src/services/whatsappService.ts
                      │  STUB — logs the filled {name}/{product}/{cart_link} template, does not
                      │  call Twilio yet. Real integration is next up (#5).
                      ▼
                   (nothing further — status is already `sent` from the claim step above)
```

## Flow 2: Order created → recovery confirmed

```
[ ] Shopify/mock fires `orders/create` webhook
        │
        ▼
[ ] POST /webhooks/order                 backend/src/routes/webhooks.js
        │
        ▼
[ ] cartService.matchOrderToCart()       backend/src/services/cartService.js
        │  looks up abandoned_carts by checkout id, status = sent
        ▼
        if match found → status: recovered   (powers the revenue-recovered stat)
        if no match     → ignore (not a recovered-cart order)
```

## Currently working on
Flow 1 is fully wired end to end (webhook → delay → check → send-or-recover), with WhatsApp sending stubbed (logs instead of calling Twilio). Flow 2 (`POST /webhooks/order`) still doesn't exist. Next: replace the whatsappService stub with a real Twilio WhatsApp Sandbox call (#5), then build `POST /webhooks/order` (#6). See `state.md` for the full list.

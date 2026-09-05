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
[ ] recoveryWorker processor fires       backend/src/workers/recoveryWorker.ts (not yet built — jobs
        │                                 land in Redis but nothing consumes RECOVERY_QUEUE_NAME yet)
        │
        ├─[ ] orderService.checkIfOrdered(checkoutId)   backend/src/services/orderService.js
        │        queries mock/Shopify orders for this checkout id
        │
        ├─ if order exists → cartService.markRecovered() → status: recovered, STOP (no message sent)
        │
        └─ if no order →
              [ ] whatsappService.sendRecoveryMessage()  backend/src/services/whatsappService.js
                      │  fills template with {name}/{product}/{cart_link}, calls Twilio
                      ▼
              [ ] cartService.markSent()   → status: sent
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
Flow 1 is wired up through "job enqueued" (schema, mock storefront, `POST /webhooks/checkout`, cartService, recoveryQueue producer). Flow 2 (`POST /webhooks/order`) and the recovery worker/processor (Flow 1's second half) are still unbuilt. Next: the worker that consumes `RECOVERY_QUEUE_NAME` jobs. See `state.md` for the full list.

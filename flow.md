# flow.md — Call-Path Map

**Status: PLANNED — no code written yet.** This describes the intended call path so implementation follows one shape. As each piece is built, replace the checkbox with ✅ and confirm the file/function name matches reality. Keep this file honest — it's the first place to check before touching a function, to see what calls it and what breaks if it changes.

## Flow 1: Cart abandoned → recovery message sent

```
[ ] Shopify/mock fires `checkouts/create` webhook
        │
        ▼
[ ] POST /webhooks/checkout              backend/src/routes/webhooks.js
        │  validates payload shape
        ▼
[ ] cartService.recordAbandonedCart()    backend/src/services/cartService.js
        │  inserts into `abandoned_carts` (status: pending)
        ▼
[ ] queue.enqueueRecoveryJob()           backend/src/workers/recoveryQueue.js
        │  BullMQ delayed job, delay = seller.delay_minutes * 60000
        ▼
        ⋯ time passes ⋯
        ▼
[ ] recoveryWorker processor fires       backend/src/workers/recoveryWorker.js
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
Schema/migrations for `sellers`, `abandoned_carts`, `orders` are done (backend/src/db/migrations/), but no routes/services/workers exist yet — every step below is still unbuilt code. Next: mock storefront, then `POST /webhooks/checkout`. See `state.md` for the full list.

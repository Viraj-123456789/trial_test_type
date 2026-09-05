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
              [✅] cartService.markSending()  atomically claims pending → sending *before* sending —
              │     this ordering (not send-then-mark) is what makes a retried/duplicate job safe.
              │     `sending` (not straight to `sent`) is what makes a crash between this claim and
              │     the Twilio call resolving detectable instead of silently mislabeled forever (ADR-0009)
              ▼
              [✅] whatsappService.sendRecoveryMessage()  backend/src/services/whatsappService.ts
                      │  fills template with {name}/{product}/{cart_link}, calls Twilio
                      │  (client built lazily — missing credentials fail the send, not app startup;
                      │  explicit 20s request timeout bounds a hung call, see ADR-0009)
                      ▼
              on success → cartService.markSentConfirmed()  sending -> sent (sent_at set here)  ✅
              on failure → cartService.markFailed()          sending -> failed (corrects the claim) ✅
```

A reconciliation sweep (`cartService.reapStaleSending`, `backend/src/worker.ts`, at startup + every 60s)
bulk-corrects any cart stuck `sending` past `RECOVERY_SENDING_TIMEOUT_MINUTES` to `failed` — closes the
crash-window gap where a worker process death between the claim and the Twilio call resolving used to
leave a cart permanently mislabeled `sent`. See ADR-0009 for the one accepted residual edge case.

Real Twilio send verified only for its failure paths here (missing credentials, non-E.164 phone) — no
Sandbox account/credentials available in this dev environment to verify an actual successful delivery.

## Flow 2: Order created → recovery confirmed

```
[✅] Shopify/mock fires `orders/create` webhook   mock-storefront/src/index.ts (POST /simulate/order)
        │
        ▼
[✅] POST /webhooks/order                 backend/src/routes/webhooks.ts
        │  verifies X-Shopify-Hmac-Sha256, looks up seller by X-Shopify-Shop-Domain,
        │  validates payload shape — same shape as /checkout
        ▼
[✅] orderService.recordOrder()           backend/src/services/orderService.ts
        │  inserts into `orders`; ON CONFLICT (seller_id, checkout_id) DO NOTHING →
        │  duplicate delivery, no-op (but the match below still runs — see next line)
        ▼
[✅] cartService.matchOrderToCart()       backend/src/services/cartService.ts
        │  looks up abandoned_carts by (seller_id, checkout_id), status = sent
        ▼
        if match found → status: recovered   (powers the revenue-recovered stat)  ✅
        if no match     → ignore — either not a recovery, or the cart is still `pending`
                           (that case is the worker's job, see Flow 1, not this route's)
```

## Currently working on
Both flows are fully wired end to end. Flow 1's WhatsApp send and Flow 2's `sent → recovered`
transition were each verified against arranged preconditions (no real Twilio Sandbox account exists
in this dev environment, so a genuine successful send/end-to-end recovery hasn't been observed).
A bug-fix pass closed the crash-window gap in Flow 1's send step (`sending` intermediate status +
reconciliation sweep, ADR-0009) and added down-migration support (ADR-0008) — see state.md for details.
Nothing left on the MVP call-graph — remaining work is the dashboard (#7 in state.md), which is a
separate `frontend/` app, not part of these two flows.

# 0004 — Twilio WhatsApp Sandbox over Meta Cloud API

## Context
Need to actually send WhatsApp messages for a working demo within a 2-day build window.

## Decision
Twilio WhatsApp Sandbox.

## Alternatives considered
- **Meta WhatsApp Cloud API** — more "production real," but outbound business-initiated messages (like a cart-recovery nudge) require a pre-approved message template, and template approval isn't instant. Rejected for the MVP timeline; this is the natural next step if a real seller ever needs to onboard.

## Consequences
- The recipient must first send a "join `<code>`" message to the sandbox number before they can receive anything — not viable for a live storefront's cold customers, but fine for a controlled demo.
- Outbound messages depend on Twilio's 24-hour session window / sandbox template rules relative to the recipient's last inbound message. For the demo: join once, send within the window.
- Before any real seller onboarding, this decision needs to be revisited with a new ADR (likely superseding this one in favor of Meta Cloud API + approved templates).

---
name: webhook-payments-checklist
description: Provider-by-provider rules for verifying webhooks (Stripe, Paddle, Lemon Squeezy, PayPal, custom HMAC), raw-body handling per framework, replay and idempotency, and the checkout and invoice checks that keep amounts and ownership honest.
---

# Webhook and payments checklist

## Signature verification by provider

| Provider | Correct | Wrong |
|---|---|---|
| Stripe | `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`; raw body as string or Buffer | `JSON.parse` / `request.json()` first; secret from `STRIPE_SECRET_KEY`; `constructEvent` wrapped in try with the parsed body used in catch |
| Paddle (Billing) | SDK `webhooks.unmarshal(raw, secret, signature)` or HMAC-SHA256 over `ts:body` from the `Paddle-Signature` header | checking only that the header exists |
| Lemon Squeezy | HMAC-SHA256 of the raw body with the signing secret, compared to `X-Signature` with `timingSafeEqual` | `==` string compare; parsed body re-serialised |
| PayPal | `POST /v1/notifications/verify-webhook-signature` with the transmission headers, or SDK equivalent | trusting `event_type` from the body |
| Custom partner | HMAC over raw body plus timestamp, constant-time compare, timestamp window | shared token in the query string; token compared with `===` is acceptable only if long and random, note replay |

A receiver with no secret in the environment (`?? ''`, unset in `.env.example` and no startup
check) verifies against an empty key: treat as unsigned.

## Raw body per framework

- Next.js App Router: `await request.text()` (not `.json()`), no body parser config needed.
- Next.js Pages: `export const config = { api: { bodyParser: false } }` plus `raw-body` or `buffer`.
- Express: `express.raw({ type: 'application/json' })` on the webhook route only, mounted before
  `express.json()`; or `verify: (req, res, buf) => req.rawBody = buf` in `express.json`.
- SvelteKit `+server.ts`: `await request.text()`.
- FastAPI: `await request.body()`; `Request` injected, not a Pydantic model.
- Hono: `await c.req.text()`; `c.req.raw`.

If the handler parses JSON first and then re-stringifies to verify, verification fails or is
skipped in practice. Report it.

## Replay and idempotency

- Store `event.id` (Stripe, Lemon Squeezy `meta.event_name` + id, Paddle `event_id`) and return 200
  without acting on repeats.
- Credits, usage or balance updates must be idempotent per event; an `increment` on every delivery
  pays twice when the provider retries.
- Out-of-order: `subscription.updated` after `subscription.deleted` must not resurrect.
- Timestamp tolerance (`tolerance` in `constructEvent`, default 300 s) left at a huge value or
  disabled.

## Checkout creation

- `amount`, `unit_amount`, `price`, `currency` from the request body: critical. Use a price id or
  look the amount up by product in the database.
- `quantity` unbounded; negative or zero amounts not rejected server-side.
- `success_url` / `cancel_url` from the request: open redirect through the provider.
- `customer` or `customer_email` from the body rather than the session.
- `metadata` must carry your own ids (user, invoice) so the webhook can link the payment back.

## Ownership on billing routes

Pay, invoice detail, PDF download, cancel, refund, change plan, portal session: every route that
takes an id must filter by the caller's account or tenant, in the same query (`where id and
ownerId`), not by checking after a lookup that already returned another user's row. Export or
"admin" routes left without a check are the common decoy.

## Status writes

Grep for assignments to `paid`, `paidAt`, `status: 'active'`, `plan`, `credits`, `balance`,
`tier`. Each writer should be a verified webhook, an admin-only route, or a transaction that reads
the provider state server-side. A `PATCH` that spreads the body over the row is mass assignment
of money.

## Secrets

`sk_live_`, `sk_test_`, `whsec_`, `pdl_`, `lmsq_` in client components, public env prefixes, or
logs. Report where the secret is used; the exact value belongs to the secret exposure hunter.

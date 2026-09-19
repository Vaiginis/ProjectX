# ivio-stripe-capi

Stripe webhook → Meta Conversions API. Fires `Purchase` when Stripe confirms the
payment rather than when a browser loads the success page.

## Why it exists

The pixel on `/success.html` only fires if the customer's browser gets there.
Pay and close the tab before the redirect and the sale is invisible; Meta then
optimises against incomplete data. This Worker reports from Stripe's side, so
the event follows the money.

Both events are still sent. They share `event_id` — Stripe's object id — so Meta
deduplicates and keeps the better-matched copy. The server guarantees delivery,
the browser adds the cookies that make matching work. This is Meta's documented
setup.

## What fires

| Stripe event | Sent? | Why |
|---|---|---|
| `checkout.session.completed`, paid | yes | first payment on a subscription |
| `checkout.session.completed`, unpaid | no | no money |
| `invoice.paid`, `subscription_create` | no | same money as the checkout event |
| `invoice.paid`, `subscription_cycle` | yes | a renewal |
| `invoice.paid`, zero amount | no | full coupon or trial |
| anything else | no | — |

Bad signatures and replays older than five minutes are rejected with 400.

## Deploy

```bash
npm install -g wrangler        # once
cd worker
wrangler login
wrangler deploy
```

Then set the secrets. **Run these yourself — the values are credentials and
should not be pasted into a chat, a commit, or `wrangler.toml`.**

```bash
wrangler secret put STRIPE_WEBHOOK_SECRET   # whsec_… from the Stripe endpoint
wrangler secret put META_ACCESS_TOKEN       # Events Manager → Settings → Conversions API
```

Point Stripe at the Worker: Stripe → Developers → Webhooks → Add endpoint →
the `workers.dev` URL `wrangler deploy` printed. Subscribe to
`checkout.session.completed` and `invoice.paid`. Copy the signing secret it
shows into `STRIPE_WEBHOOK_SECRET` above.

## Test before trusting it

```bash
node test/handler.test.mjs     # signature, replay, and event-selection cases
wrangler tail                  # live logs, including anything Meta rejects
```

For an end-to-end check, set `META_TEST_EVENT_CODE` (Events Manager → Test
Events gives you the code), buy through a Stripe test-mode link, and watch the
event arrive. Remove the secret afterwards — while it is set, events go to the
test stream and not to your real reporting.

## Known limits

- Match quality rests on the hashed billing email; Stripe cannot give us the
  visitor's `fbp` / `fbc` cookies. The browser copy covers that.
- Refunds and chargebacks are not sent, so reported revenue reads slightly high.
- Stripe's dashboard remains the source of truth for money. This is for ad
  optimisation.

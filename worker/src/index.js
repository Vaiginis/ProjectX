/* Stripe webhook -> Meta Conversions API.
 *
 * Fires Purchase when Stripe confirms the money, not when a browser happens to
 * load the success page. That closes the gap where someone pays and shuts the
 * tab before the redirect, and it keeps reporting honest when a card is
 * declined on a renewal.
 *
 * The browser pixel still sends its own Purchase. Both carry the same event_id
 * — Stripe's object id — so Meta collapses them into one event and keeps the
 * better-matched copy. That is Meta's documented setup and it beats either
 * alone: the server always fires, the browser adds the cookies that make the
 * match land.
 *
 * Secrets (set with `wrangler secret put NAME`, never in wrangler.toml):
 *   STRIPE_WEBHOOK_SECRET   whsec_... from the Stripe webhook endpoint
 *   META_ACCESS_TOKEN       Events Manager -> Settings -> Conversions API
 *   META_TOKEN_<pixel id>   optional, per-pixel override. A token only works
 *                           for the pixel it was generated from, so a second
 *                           pixel needs its own: META_TOKEN_28948852661366483
 *   META_TEST_EVENT_CODE    optional, only while testing
 */

const TOLERANCE_SECONDS = 300;

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    const signature = request.headers.get('stripe-signature');
    const payload = await request.text();

    let event;
    try {
      event = await verifyStripeSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      // 400 tells Stripe not to retry — a bad signature will never become good.
      console.warn(`REJECTED 400 — ${err.message}`);
      return new Response(`Signature verification failed: ${err.message}`, { status: 400 });
    }

    const purchase = extractPurchase(event);
    if (!purchase) {
      console.log(`IGNORED 200 — ${event.type} (not a countable purchase)`);
      return new Response('Ignored', { status: 200 });
    }
    console.log(`ACCEPTED 200 — ${event.type} id=${purchase.eventId} ${purchase.value} ${purchase.currency} email=${purchase.email ? 'yes' : 'none'}`);

    // Acknowledge Stripe immediately; Meta delivery continues in the background.
    // A slow Meta response must never make Stripe think the webhook failed.
    ctx.waitUntil(sendToMeta(purchase, env));
    return new Response('OK', { status: 200 });
  },
};

/* ------------------------------------------------------------------ Stripe */

/** Verify the `stripe-signature` header. Manual HMAC rather than the Stripe SDK:
 *  one dependency fewer, and Workers give us Web Crypto for free. */
async function verifyStripeSignature(payload, header, secret) {
  if (!header) throw new Error('missing stripe-signature header');
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set');

  const parts = Object.fromEntries(
    header.split(',').map((kv) => kv.split('=', 2).map((s) => s.trim()))
  );
  const timestamp = parts.t;
  const expected = parts.v1;
  if (!timestamp || !expected) throw new Error('malformed signature header');

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (age > TOLERANCE_SECONDS) throw new Error(`timestamp outside tolerance (${age}s)`);

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
  if (!timingSafeEqual(toHex(mac), expected)) throw new Error('signature mismatch');

  return JSON.parse(payload);
}

/** Pull a purchase out of the events we care about, or null for everything else.
 *
 *  checkout.session.completed — the first payment on a new subscription.
 *  invoice.paid               — every renewal after that. Skipped when the
 *                               billing reason is the subscription's creation,
 *                               because checkout.session.completed already
 *                               reported that same money. */
function extractPurchase(event) {
  const o = event.data?.object;

  if (event.type === 'checkout.session.completed') {
    if (o.payment_status !== 'paid') return null;
    return {
      eventId: o.id,                                   // matches the browser's ?sid=
      value: (o.amount_total ?? 0) / 100,
      currency: (o.currency || 'eur').toUpperCase(),
      email: o.customer_details?.email || null,
      createdAt: event.created,
    };
  }

  if (event.type === 'invoice.paid') {
    if (o.billing_reason === 'subscription_create') return null;   // already counted
    if ((o.amount_paid ?? 0) <= 0) return null;                    // 100% coupon, trial
    return {
      eventId: o.id,
      value: o.amount_paid / 100,
      currency: (o.currency || 'eur').toUpperCase(),
      email: o.customer_email || null,
      createdAt: event.created,
    };
  }

  return null;
}

/* -------------------------------------------------------------------- Meta */

async function sendToMeta(purchase, env) {
  const pixels = (env.META_PIXEL_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const version = env.META_API_VERSION || 'v21.0';

  // Meta requires at least one identifier, and it must be hashed. Stripe gives
  // us the billing email, which is the strongest thing available server-side.
  const user_data = {};
  if (purchase.email) user_data.em = [await sha256(purchase.email.trim().toLowerCase())];

  const body = {
    data: [{
      event_name: 'Purchase',
      event_time: purchase.createdAt,
      event_id: purchase.eventId,
      action_source: 'website',
      event_source_url: env.EVENT_SOURCE_URL,
      user_data,
      custom_data: { currency: purchase.currency, value: purchase.value },
    }],
  };
  if (env.META_TEST_EVENT_CODE) body.test_event_code = env.META_TEST_EVENT_CODE;

  await Promise.all(pixels.map(async (pixelId) => {
    // Conversions API tokens are scoped to the pixel they were generated from,
    // so two pixels normally need two tokens. Look for a per-pixel secret first
    // and fall back to the shared one.
    const token = env[`META_TOKEN_${pixelId}`] || env.META_ACCESS_TOKEN;
    if (!token) {
      console.error(`META SKIP ${pixelId} — no token (set META_TOKEN_${pixelId})`);
      return;
    }
    const url = `https://graph.facebook.com/${version}/${pixelId}/events?access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      console.log(`META OK   ${pixelId} — ${await res.text()}`);
    } else {
      // Logged rather than thrown: one pixel failing must not stop the other,
      // and Stripe has already been acknowledged. Visible in `wrangler tail`.
      console.error(`META FAIL ${pixelId} — ${res.status} ${await res.text()}`);
    }
  }));
}

/* ----------------------------------------------------------------- helpers */

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return toHex(digest);
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time compare so a mismatch cannot be found one character at a time. */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

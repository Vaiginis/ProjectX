import worker from '../src/index.js';

const SECRET = 'whsec_test_secret';
const sent = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).includes('graph.facebook.com')) {
    sent.push({ pixel: String(url).match(/\/(\d+)\/events/)[1], body: JSON.parse(init.body) });
    return new Response('{"events_received":1}', { status: 200 });
  }
  return realFetch(url, init);
};

const env = {
  STRIPE_WEBHOOK_SECRET: SECRET,
  META_ACCESS_TOKEN: 'TEST_TOKEN',
  META_PIXEL_IDS: '28948852661366483,1553171279426030',
  META_API_VERSION: 'v21.0',
  EVENT_SOURCE_URL: 'https://tryivio.com/success.html',
};
const pending = [];
const ctx = { waitUntil: (p) => pending.push(p) };

async function sign(payload, secret, t = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`));
  const hex = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('');
  return `t=${t},v1=${hex}`;
}

async function post(event, { secret = SECRET, t } = {}) {
  sent.length = 0; pending.length = 0;
  const payload = JSON.stringify(event);
  const res = await worker.fetch(new Request('https://w/', {
    method: 'POST', body: payload,
    headers: { 'stripe-signature': await sign(payload, secret, t) },
  }), env, ctx);
  await Promise.all(pending);
  return { status: res.status, text: await res.text(), sent: [...sent] };
}

const checkout = (over = {}) => ({
  type: 'checkout.session.completed', created: 1789000000,
  data: { object: { id: 'cs_test_123', payment_status: 'paid', amount_total: 1949,
    currency: 'eur', customer_details: { email: ' Karolis@Example.COM ' }, ...over } },
});

const results = {};

let r = await post(checkout());
results['valid checkout -> both pixels'] = {
  status: r.status, pixels: r.sent.map(s => s.pixel),
  event: r.sent[0]?.body.data[0].event_name,
  value: r.sent[0]?.body.data[0].custom_data.value,
  currency: r.sent[0]?.body.data[0].custom_data.currency,
  event_id: r.sent[0]?.body.data[0].event_id,
  emailHashed: /^[0-9a-f]{64}$/.test(r.sent[0]?.body.data[0].user_data.em?.[0] || ''),
  rawEmailLeaked: JSON.stringify(r.sent[0]?.body).toLowerCase().includes('karolis@example'),
};

r = await post(checkout(), { secret: 'whsec_wrong' });
results['bad signature'] = { status: r.status, sent: r.sent.length };

r = await post(checkout(), { t: Math.floor(Date.now() / 1000) - 3600 });
results['replayed (1h old)'] = { status: r.status, sent: r.sent.length };

r = await post(checkout({ payment_status: 'unpaid' }));
results['unpaid checkout'] = { status: r.status, sent: r.sent.length };

r = await post({ type: 'invoice.paid', created: 1789000100,
  data: { object: { id: 'in_1', billing_reason: 'subscription_create', amount_paid: 1949, currency: 'eur' } } });
results['first invoice (already counted)'] = { status: r.status, sent: r.sent.length };

r = await post({ type: 'invoice.paid', created: 1789000200,
  data: { object: { id: 'in_2', billing_reason: 'subscription_cycle', amount_paid: 1949,
    currency: 'eur', customer_email: 'a@b.com' } } });
results['renewal invoice'] = { status: r.status, sent: r.sent.length, value: r.sent[0]?.body.data[0].custom_data.value, event_id: r.sent[0]?.body.data[0].event_id };

r = await post({ type: 'customer.created', created: 1, data: { object: {} } });
results['unrelated event'] = { status: r.status, sent: r.sent.length };

console.log(JSON.stringify(results, null, 1));

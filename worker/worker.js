// Awqat Cloudflare Worker
//   POST /scan    { image: <base64 jpeg>, mediaType }  -> { times: {...}, notes }
//   GET  /news                                          -> { items: [{ title, link, source, date }] }
//   GET  /videos                                        -> { items: [{ id, title, channel, date }] }
// Secrets / vars (set in the Cloudflare dashboard → Worker → Settings → Variables):
//   ANTHROPIC_API_KEY  (secret, required for /scan)
//   ALLOWED_ORIGIN     e.g. https://dullahcrypto.github.io   (use * while testing)
//   MODEL              optional, default claude-sonnet-5-5
//   NEWS_FEEDS         optional, comma-separated RSS/Atom URLs
//   YT_CHANNELS        optional, comma-separated YouTube channel IDs (UC...)
//   PAYSTACK_SECRET_KEY (secret) for GET /verify?ref=  (Lifetime purchase check)
//   LIFETIME_KOBO      optional, default 200000 (₦2,000)

const DEFAULT_FEEDS = [
  'https://news.google.com/rss/search?q=Islam+OR+Muslims+OR+Ramadan+OR+Hajj&hl=en-NG&gl=NG&ceid=NG:en',
  'https://salaamgateway.com/feed/news'
];

const PROMPT = `You are reading a photo of a prayer timetable (often a board on a mosque wall, a printed sheet, or a screen).
Extract today's times for each prayer. Boards usually show an ADHAN (azan / start) column and an IQAMA (jama'ah / congregation) column; some show only one.
Return ONLY JSON, no prose, in exactly this shape:
{"times":{"fajr":{"adhan":"HH:MM","iqama":"HH:MM"},"sunrise":{"adhan":"HH:MM","iqama":""},"dhuhr":{...},"asr":{...},"maghrib":{...},"isha":{...},"jumuah":{...}},"confidence":"high|medium|low","notes":"short note about anything unclear"}
Rules:
- Use 24-hour HH:MM. Boards often omit AM/PM: Fajr and sunrise are morning; Dhuhr is around midday (12:00-14:30); Asr, Maghrib and Isha are afternoon/evening, so add 12 hours where needed.
- If a time is missing or unreadable use "".
- Arabic, Hausa, Yoruba, Urdu or other labels are fine: map Subh/Fajr, Zuhr/Dhuhr, Asr, Maghrib, Isha, Jumu'ah/Friday.
- If the board shows a whole month, use the row for today's date: TODAY_DATE.`;

function cors(env, req) {
  const allowed = env.ALLOWED_ORIGIN || '*';
  const origin = req.headers.get('Origin') || '';
  const ok = allowed === '*' || allowed.split(',').map((s) => s.trim()).includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? (allowed === '*' ? '*' : origin) : 'null',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}
const json = (data, status, headers) => new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

async function scan(req, env, h) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY is not set on the worker' }, 500, h);
  const body = await req.json().catch(() => null);
  if (!body || !body.image || body.image.length > 7_000_000) return json({ error: 'Send a JPEG image under 5 MB' }, 400, h);
  const today = body.today || new Date().toISOString().slice(0, 10);
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: env.MODEL || 'claude-sonnet-5-5',
      max_tokens: 800,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: body.mediaType || 'image/jpeg', data: body.image } },
        { type: 'text', text: PROMPT.replace('TODAY_DATE', today) }
      ] }]
    })
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) return json({ error: (out.error && out.error.message) || 'AI request failed' }, 502, h);
  const text = (out.content || []).map((c) => c.text || '').join('');
  const m = text.match(/\{[\s\S]*\}/);
  try { return json(JSON.parse(m ? m[0] : text), 200, h); }
  catch { return json({ error: 'Could not read times from this photo', raw: text.slice(0, 300) }, 422, h); }
}

const tag = (s, t) => { const m = s.match(new RegExp('<' + t + '[^>]*>([\\s\\S]*?)</' + t + '>', 'i')); return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : ''; };
const clean = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

async function news(env, h, ctx, req) {
  const cache = caches.default, key = new Request(new URL('/__news', req.url));
  const hit = await cache.match(key); if (hit) return new Response(hit.body, { headers: { ...h, 'Content-Type': 'application/json' } });
  const feeds = env.NEWS_FEEDS ? env.NEWS_FEEDS.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_FEEDS;
  const items = [];
  await Promise.all(feeds.map(async (u) => {
    try {
      const xml = await (await fetch(u, { headers: { 'User-Agent': 'AwqatBot/1.0' } })).text();
      const src = clean(tag(xml, 'title')) || new URL(u).hostname;
      const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
      blocks.slice(0, 12).forEach((b) => {
        let link = tag(b, 'link'); if (!link) { const lm = b.match(/<link[^>]*href="([^"]+)"/i); link = lm ? lm[1] : ''; }
        const title = clean(tag(b, 'title'));
        const s2 = clean(tag(b, 'source')) || src;
        if (title && link) items.push({ title, link: clean(link), source: s2.replace(/ - Google News$/, ''), date: tag(b, 'pubDate') || tag(b, 'updated') || tag(b, 'published') });
      });
    } catch { /* skip feed */ }
  }));
  items.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
  const res = new Response(JSON.stringify({ items: items.slice(0, 30) }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=900' } });
  ctx.waitUntil(cache.put(key, res.clone()));
  return new Response(res.body, { headers: { ...h, 'Content-Type': 'application/json' } });
}

async function videos(env, h) {
  const ids = (env.YT_CHANNELS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const items = [];
  await Promise.all(ids.map(async (id) => {
    try {
      const xml = await (await fetch('https://www.youtube.com/feeds/videos.xml?channel_id=' + id)).text();
      const channel = clean(tag(xml, 'title'));
      (xml.match(/<entry>[\s\S]*?<\/entry>/gi) || []).slice(0, 8).forEach((e) => {
        items.push({ id: tag(e, 'yt:videoId'), title: clean(tag(e, 'title')), channel, date: tag(e, 'published') });
      });
    } catch { /* skip */ }
  }));
  items.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return json({ items: items.slice(0, 24) }, 200, { ...h, 'Cache-Control': 'max-age=1800' });
}

async function verify(req, env, h) {
  if (!env.PAYSTACK_SECRET_KEY) return json({ ok: false, error: 'Payments are not set up yet' }, 500, h);
  const ref = new URL(req.url).searchParams.get('ref') || '';
  if (!/^[\w.-]{4,100}$/.test(ref)) return json({ ok: false, error: 'Invalid reference' }, 400, h);
  const r = await fetch('https://api.paystack.co/transaction/verify/' + encodeURIComponent(ref), { headers: { Authorization: 'Bearer ' + env.PAYSTACK_SECRET_KEY } });
  const j = await r.json().catch(() => ({}));
  const d = j.data || {};
  const need = parseInt(env.LIFETIME_KOBO || '200000', 10);
  if (j.status && d.status === 'success' && d.currency === 'NGN' && d.amount >= need) return json({ ok: true, email: (d.customer && d.customer.email) || '' }, 200, h);
  return json({ ok: false, error: 'Payment not found or not completed' }, 402, h);
}

export default {
  async fetch(req, env, ctx) {
    const h = cors(env, req);
    if (req.method === 'OPTIONS') return new Response(null, { headers: h });
    const { pathname } = new URL(req.url);
    try {
      if (pathname === '/scan' && req.method === 'POST') return await scan(req, env, h);
      if (pathname === '/news') return await news(env, h, ctx, req);
      if (pathname === '/videos') return await videos(env, h);
      if (pathname === '/verify') return await verify(req, env, h);
      return json({ ok: true, service: 'awqat' }, 200, h);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500, h);
    }
  }
};

// Awqat Cloudflare Worker
//   POST /scan    { image: <base64 jpeg>, mediaType }  -> { times: {...}, notes }
//   GET  /news                                          -> { items: [{ title, link, source, date }] }
//   GET  /videos                                        -> { items: [{ id, title, channel, date }] }
// Secrets / vars (set in the Cloudflare dashboard → Worker → Settings → Variables):
//   GEMINI_API_KEY     (secret) free key from aistudio.google.com: first AI reader
//   AI                 Workers AI binding (free daily allowance): second reader
//   ANTHROPIC_API_KEY  (secret, optional) third reader
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
- Copy digits exactly as written. To convert to 24-hour add exactly 12 to the hour (7:20 PM = 19:20, never 20:20). Isha is usually 19:00-21:00 and Maghrib 18:00-19:30.
- Only fill sunrise if the board has its own Sunrise/Shuruq/Fitowar rana row. Never copy another prayer's time into sunrise or jumuah.
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

// Which AI readers are switched on
const providers = (env) => ({ gemini: !!env.GEMINI_API_KEY, cloudflare: !!env.AI, anthropic: !!env.ANTHROPIC_API_KEY });
const pickJSON = (text) => { if (text && typeof text === 'object') return text; text = String(text || ''); const m = text.match(/\{[\s\S]*\}/); return JSON.parse(m ? m[0] : text); };

async function viaGemini(env, img, mime, prompt) {
  const models = [env.GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-2.0-flash'].filter(Boolean);
  let last = 'Gemini failed';
  for (const model of models) {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + env.GEMINI_API_KEY, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: mime, data: img } }, { text: prompt }] }], generationConfig: { temperature: 0, responseMimeType: 'application/json' } })
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { const text = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map((p) => p.text || '').join(''); return { ...pickJSON(text), reader: 'gemini' }; }
    last = (j.error && j.error.message) || ('Gemini error ' + r.status);
    if (r.status === 429) break; // daily limit used up: let the next reader try
  }
  throw new Error(last);
}

async function viaCloudflare(env, img, prompt) {
  const bin = atob(img), bytes = new Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const model = '@cf/meta/llama-3.2-11b-vision-instruct';
  const run = () => env.AI.run(model, { prompt: prompt, image: bytes, max_tokens: 700, temperature: 0 });
  let out;
  try { out = await run(); }
  catch (e) { if (/agree/i.test(String(e && e.message))) { try { await env.AI.run(model, { prompt: 'agree' }); } catch (e2) { } out = await run(); } else throw e; }
  try { return { ...pickJSON(out.response || ''), reader: 'cloudflare' }; } catch (e) {
    const o2 = await env.AI.run(model, { prompt: prompt + '\nReply with the JSON object only. Start with { and end with }.', image: bytes, max_tokens: 700, temperature: 0 });
    return { ...pickJSON(o2.response || ''), reader: 'cloudflare' };
  }
}

async function viaAnthropic(env, img, mime, prompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: env.MODEL || 'claude-sonnet-5-5', max_tokens: 800, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: mime, data: img } }, { type: 'text', text: prompt }] }] })
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((out.error && out.error.message) || 'AI request failed');
  return { ...pickJSON((out.content || []).map((c) => c.text || '').join('')), reader: 'anthropic' };
}

async function scan(req, env, h) {
  const body = await req.json().catch(() => null);
  if (!body || !body.image || body.image.length > 7000000) return json({ error: 'Send a JPEG image under 5 MB' }, 400, h);
  const prompt = PROMPT.replace('TODAY_DATE', body.today || new Date().toISOString().slice(0, 10));
  const mime = body.mediaType || 'image/jpeg', errors = [];
  const order = [['gemini', () => viaGemini(env, body.image, mime, prompt)], ['cloudflare', () => viaCloudflare(env, body.image, prompt)], ['anthropic', () => viaAnthropic(env, body.image, mime, prompt)]];
  for (const [name, fn] of order) {
    if (!providers(env)[name]) continue;
    try { const r = await fn(); if (r && r.times) return json(r, 200, h); errors.push(name + ': no times'); }
    catch (e) { errors.push(name + ': ' + String(e && e.message || e).slice(0, 120)); }
  }
  return json({ error: errors.length ? 'The AI readers could not read this photo. (' + errors.join(' | ') + ')' : 'No AI reader is set up on the worker' }, 502, h);
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
      return json({ ok: true, service: 'awqat', ai: providers(env) }, 200, h);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500, h);
    }
  }
};

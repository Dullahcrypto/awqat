import { schedule, fmt, ampm, hhmm, calc, snaps, activeSnap, SALAH, PRAYERS, qiblaBearing } from './prayer.js';
import { store, setting } from './store.js';
import { esc, I, backbar, hijri, hijriParts } from './ui.js';
import { SIRAH, DUAS, DHIKR, NAMES } from '../data/content.js';
import { COUNTRIES } from '../data/places.js';
import { COLLECTIONS, WORKER } from './net.js';
import { isIOS, isAndroid } from './alarms.js';
import { videoRail, libraryGrid } from './home.js';

export const ps = { pending: null, preview: null, scanning: false, error: '' };

// ---------- SNAP ----------
export function snap() {
  return `<div class="screen">${backbar('Snap prayer time')}
  <div class="viewer">
    ${ps.preview ? `<img src="${ps.preview}" alt="Your photo of the prayer timetable">` : `<div style="text-align:center;color:#CFE0D7;padding:40px 30px;display:flex;flex-direction:column;align-items:center;gap:14px">${I.camera(44)}<span style="font-size:15px;line-height:1.5">Take a clear photo of any prayer timetable: a board on the wall, a printed sheet, or a screen.</span></div>`}
    <div class="corners" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    ${ps.scanning ? `<div class="scanline" aria-hidden="true"></div><div class="badge">${esc(ps.status || 'Reading the times…')}</div>` : ''}
  </div>
  ${ps.failed && !ps.scanning ? `<div class="card" style="margin-bottom:14px"><p style="margin:0 0 4px;font-weight:600">Couldn't read all the times</p><p class="small muted" style="margin:0">${esc(ps.error || 'The phone reader found too few times in this photo. Try again closer with less glare, or let the AI read it.')}</p>${WORKER() ? '<button class="btn" data-act="ai" style="margin-top:14px">Read with AI</button>' : ''}</div>` : ''}
  <div class="pad" style="display:flex;flex-direction:column;gap:10px">
    <label class="btn" style="cursor:pointer">${I.camera(20)}Take photo<input type="file" accept="image/*" capture="environment" data-act="file" hidden></label>
    <label class="btn ghost" style="cursor:pointer">${I.gallery(20)}Choose from gallery<input type="file" accept="image/*" data-act="file" hidden></label>
    <button class="btn ghost" data-act="manual">Type the times instead</button>
  </div>
  <p class="pad small muted" style="margin-top:16px">Photos are read on your phone for free.${WORKER() ? ' If that misses, Awqat can read it with AI.' : ' AI reading for hard photos turns on once the worker link is added in <a href="#/settings" style="text-decoration:underline">Settings</a>.'}</p>
  </div>`;
}

const ROWS = [['fajr', 'Fajr'], ['sunrise', 'Sunrise'], ['dhuhr', 'Dhuhr'], ['asr', 'Asr'], ['maghrib', 'Maghrib'], ['isha', 'Isha'], ['jumuah', "Jumu'ah"]];
export function review() {
  const p = ps.pending || { times: {} };
  const c = calc();
  const val = (k, f) => (p.times[k] && p.times[k][f]) || '';
  return `<div class="screen">${backbar('Check the times', '#/snap')}
  ${p.source === 'phone' ? `<div class="card" style="margin-top:14px;display:flex;flex-direction:column;gap:10px"><span class="small">Read on your phone: found ${p.found} of 5 prayers. Check every time below.</span>${WORKER() && ps.preview ? '<button class="btn sm ghost" data-act="ai" style="width:100%">Not right? Read with AI</button>' : ''}</div>` : p.confidence ? `<p class="pad small muted" style="margin:12px 0 0">AI read this with ${esc(p.confidence)} confidence${p.notes ? ': ' + esc(p.notes) : ''}. Fix anything that looks wrong.</p>` : `<p class="pad small muted" style="margin:12px 0 0">Enter the times from the timetable. Leave a box empty to use the calculated time.</p>`}
  <div class="field" style="margin-top:16px"><label for="label">Name these times (optional)</label><input id="label" class="input" placeholder="e.g. Work, Home, Ramadan" value="${esc(p.label || '')}"></div>
  <div class="rhead"><span>PRAYER</span><span>ADHAN</span><span>IQAMA</span></div>
  <form class="rtable" id="rform">
    ${ROWS.map(([k, n]) => `<div class="rrow"><span style="font-weight:600">${n}${c[k] ? `<br><span class="small muted" style="font-weight:400">calc ${fmt(c[k])}</span>` : ''}</span>
      <input class="timein" type="time" name="${k}.adhan" value="${esc(val(k, 'adhan'))}" aria-label="${n} adhan">
      <input class="timein" type="time" name="${k}.iqama" value="${esc(val(k, 'iqama'))}" aria-label="${n} iqama" ${k === 'sunrise' ? 'disabled' : ''}></div>`).join('')}
  </form>
  <div class="pad" style="margin-top:18px;display:flex;flex-direction:column;gap:10px">
    <button class="btn" data-act="savesnap">Save as my prayer times</button>
    <a class="btn ghost" href="#/snap">Retake photo</a>
  </div></div>`;
}

export function saved() {
  const all = snaps(); const a = activeSnap();
  return `<div class="screen">${backbar('Saved times')}
  <p class="pad small muted" style="margin:12px 0 0">Every timetable you snap is kept on this phone. Pick which one Awqat follows.</p>
  <div class="list" style="margin-top:12px">
    <div class="li"><span style="display:flex;flex-direction:column;gap:2px"><span style="font-weight:600">Calculated times</span><span class="small muted">${esc(setting('location').label)} · ${esc(setting('method').replace(/([A-Z])/g, ' $1').trim())}</span></span>${a ? '<button class="btn sm ghost" data-act="usesnap" data-id="">Use</button>' : '<span class="small" style="font-weight:600;color:var(--accent)">In use</span>'}</div>
    ${all.map((s) => `<div class="li"><span style="display:flex;flex-direction:column;gap:2px"><span style="font-weight:600">${esc(s.label)}</span><span class="small muted">Snapped ${new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span></span>
      <span style="display:flex;gap:6px">${a && a.id === s.id ? '<span class="small" style="font-weight:600;color:var(--accent);align-self:center">In use</span>' : `<button class="btn sm ghost" data-act="usesnap" data-id="${s.id}">Use</button>`}<button class="iconbtn" aria-label="Delete ${esc(s.label)}" data-act="delsnap" data-id="${s.id}">${I.close(16)}</button></span></div>`).join('')}
  </div>
  ${all.length ? '' : '<div class="empty">No snaps yet. <a href="#/snap" style="text-decoration:underline">Snap a prayer timetable</a> to start.</div>'}
  </div>`;
}

// ---------- ALARMS ----------
export function alarms() {
  const on = setting('alarmsOn'), lead = setting('alarmLead');
  const sch = schedule();
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  return `<div class="screen">${backbar('Alarms')}
  <div class="sec-h" style="margin-top:20px"><span class="k">Ring at</span></div>
  <div class="seg" style="margin:0 18px">${[['adhan', 'Adhan'], ['iqama', 'Iqama'], ['10', '10 min before']].map(([v, l]) => `<button data-act="lead" data-v="${v}" aria-pressed="${lead === v}">${l}</button>`).join('')}</div>
  <div class="sec-h"><span class="k">Prayers</span></div>
  <div class="list">${sch.filter((p) => p.key !== 'sunrise').map((p) => `<div class="li"><span style="display:flex;flex-direction:column;gap:2px"><span style="font-weight:600">${esc(p.name)}</span><span class="small muted">${fmt(p.adhan)} ${ampm(p.adhan)}${p.iqama ? ' · iqama ' + fmt(p.iqama) : ''}</span></span>
    <span style="display:flex;gap:8px;align-items:center">${isAndroid ? `<a class="iconbtn" aria-label="Add ${esc(p.name)} to Clock" data-act="android" data-k="${p.key}" href="#">${I.bell(18)}</a>` : ''}<button class="sw" role="switch" aria-checked="${!!on[p.key]}" aria-label="${esc(p.name)} alarm" data-act="alarm" data-k="${p.key}"></button></span></div>`).join('')}</div>
  <div class="sec-h"><span class="k">Sync to your phone</span></div>
  <div class="pad" style="display:flex;flex-direction:column;gap:10px">
    <button class="btn" data-act="notif">${I.bell(20)}${perm === 'granted' ? 'Notifications are on' : 'Turn on notifications'}</button>
    <button class="btn ghost" data-act="ics">Add to calendar with alerts (.ics)</button>
  </div>
  <div class="card" style="margin-top:18px">
    <p class="small" style="margin:0 0 8px;font-weight:600">How syncing works</p>
    <p class="small muted" style="margin:0;line-height:1.55">${isIOS
      ? 'On iPhone, open Awqat from your Home Screen and allow notifications. For alarms that ring even when Awqat is closed, tap "Add to calendar": each prayer becomes a daily event with an alert. Snap again whenever your times change, then add the calendar again.'
      : isAndroid
        ? 'Tap the bell beside a prayer to open your Clock app with that alarm filled in, then save it. Notifications also work while Awqat is open. "Add to calendar" gives daily alerts too.'
        : 'Notifications fire while Awqat is open. "Add to calendar" creates daily repeating events with alerts in your calendar app.'}</p>
  </div></div>`;
}

// ---------- QIBLA ----------
export function qibla() {
  const b = qiblaBearing();
  const loc = setting('location');
  const R = 6371, toR = (d) => d * Math.PI / 180;
  const dLat = toR(21.4225 - loc.lat), dLng = toR(39.8262 - loc.lng);
  const km = Math.round(2 * R * Math.asin(Math.sqrt(Math.sin(dLat / 2) ** 2 + Math.cos(toR(loc.lat)) * Math.cos(toR(21.4225)) * Math.sin(dLng / 2) ** 2)));
  const dirs = ['north', 'north-northeast', 'northeast', 'east-northeast', 'east', 'east-southeast', 'southeast', 'south-southeast', 'south', 'south-southwest', 'southwest', 'west-southwest', 'west', 'west-northwest', 'northwest', 'north-northwest'];
  return `<div class="screen">${backbar('Qibla')}
  <div style="text-align:center;margin-top:18px;display:flex;flex-direction:column;gap:4px"><span class="ar" style="font-size:26px;color:var(--accent)">القبلة</span><span class="h1">Facing Makkah</span><span class="small muted">${esc(loc.label)} · ${km.toLocaleString()} km to the Kaaba</span></div>
  <div class="compass">
    <div class="dial" id="dial">
      <svg viewBox="0 0 300 300" width="300" height="300" aria-hidden="true">
        <circle cx="150" cy="150" r="146" fill="var(--card)" stroke="var(--accent)" stroke-width="1.5"/>
        <circle cx="150" cy="150" r="132" fill="none" stroke="currentColor" stroke-opacity=".4" stroke-width="10" stroke-dasharray="1.5 5.41"/>
        <text x="150" y="44" text-anchor="middle" fill="currentColor" font-weight="700" font-size="15">N</text>
        <text x="262" y="155" text-anchor="middle" fill="currentColor" opacity=".6" font-size="13">E</text>
        <text x="150" y="268" text-anchor="middle" fill="currentColor" opacity=".6" font-size="13">S</text>
        <text x="38" y="155" text-anchor="middle" fill="currentColor" opacity=".6" font-size="13">W</text>
      </svg>
      <div class="needle" style="transform:rotate(${b}deg)">
        <svg width="40" height="300" viewBox="0 0 40 300" aria-hidden="true"><path d="M20 40 L32 150 L20 160 L8 150 Z" fill="var(--accent)"/><path d="M20 160 L32 150 L20 250 L8 150 Z" fill="currentColor" fill-opacity=".15"/><rect x="11" y="14" width="18" height="18" rx="2" fill="#10261D" stroke="var(--accent)" stroke-width="1.5"/><path d="M11 20 H29" stroke="var(--accent)" stroke-width="1.5"/></svg>
      </div>
    </div>
  </div>
  <div style="text-align:center;margin-top:26px;display:flex;flex-direction:column;gap:4px"><span class="h1" style="font-size:48px;color:var(--accent)">${Math.round(b)}°</span><span class="small muted">${dirs[Math.round(b / 22.5) % 16]} from true north</span><span class="small muted" id="cstatus">Lay your phone flat, then start the compass.</span></div>
  <div class="pad" style="margin-top:18px"><button class="btn" data-act="compass">Start compass</button></div>
  </div>`;
}

// ---------- QUR'AN ----------
export function quranList(list, q = '') {
  const m = setting('mushaf');
  const last = store.get('lastRead', null);
  const items = (list || []).filter((s) => !q || (s.englishName + ' ' + s.number + ' ' + s.englishNameTranslation).toLowerCase().includes(q.toLowerCase()));
  return `<div class="screen">${backbar("The Qur'an")}
  <div class="seg" style="margin:18px 18px 0" role="group" aria-label="Mushaf"><button data-act="mushaf" data-v="madani" aria-pressed="${m === 'madani'}">Mushaf Madani</button><button data-act="mushaf" data-v="maki" aria-pressed="${m === 'maki'}">Mushaf Maki</button></div>
  <div class="pad" style="margin-top:12px;display:flex;gap:10px">
    <a class="btn" href="#/mushaf/${store.get('lastPage', 1)}" style="flex:1">${m === 'madani' ? 'Open the Madani Mushaf' : 'Open the Mushaf'}</a>
  </div>
  ${m === 'maki' ? '<p class="pad small muted" style="margin:10px 0 0">The Makkah print page layout is coming in a later update. Until then the Mushaf opens in the Madani 604-page layout.</p>' : ''}
  ${last ? `<a class="card" href="#/surah/${last.s}" style="display:flex;justify-content:space-between;margin-top:16px"><span>Continue · ${esc(last.name)}, ayah ${last.a}</span>${I.chev()}</a>` : ''}
  <div class="field" style="margin-top:18px"><input class="input" type="search" placeholder="Search surah by name or number" data-act="qsearch" value="${esc(q)}" aria-label="Search surah"></div>
  ${list ? `<div class="list" id="slist">${items.map((s) => `<a class="li" href="#/surah/${s.number}"><span style="display:flex;gap:14px;align-items:center"><span class="num">${s.number}</span><span style="display:flex;flex-direction:column"><span style="font-weight:600">${esc(s.englishName)}</span><span class="small muted">${esc(s.englishNameTranslation)} · ${s.numberOfAyahs} ayahs</span></span></span><span class="ar" style="font-size:20px">${esc(s.name.replace('سُورَةُ ', ''))}</span></a>`).join('')}</div>` : '<div class="spinner"></div>'}
  </div>`;
}

export function surah(data, n) {
  if (!data) return `<div class="screen">${backbar('Surah', '#/quran')}<div class="spinner"></div></div>`;
  const [ar, en] = data;
  return `<div class="screen">${backbar(ar.englishName, '#/quran')}
  <div style="text-align:center;margin:20px 22px 6px;display:flex;flex-direction:column;gap:4px"><span class="ar" style="font-size:34px">${esc(ar.name)}</span><span class="small muted">${esc(ar.englishNameTranslation)} · ${ar.numberOfAyahs} ayahs · ${esc(ar.revelationType)}</span></div>
  ${n !== 1 && n !== 9 ? '<p class="ar" style="text-align:center;font-size:26px;margin:14px 0 0">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p>' : ''}
  <div class="list">${ar.ayahs.map((a, i) => {
    let t = a.text; if (n !== 1 && i === 0) t = t.replace(/^بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ\s*/, '');
    return `<div class="ayah" id="a${a.numberInSurah}"><div class="a">${esc(t)} <span class="num">${a.numberInSurah}</span></div><div class="e">${esc(en.ayahs[i].text)}</div>
    <button class="small muted" style="background:none;border:none;padding:8px 0 0;font-weight:600" data-act="bookmark" data-s="${n}" data-a="${a.numberInSurah}" data-name="${esc(ar.englishName)}">Mark as last read</button></div>`; }).join('')}</div>
  <div class="pad" style="display:flex;gap:10px;margin-top:16px">${n > 1 ? `<a class="btn ghost" href="#/surah/${n - 1}">Previous</a>` : ''}${n < 114 ? `<a class="btn" href="#/surah/${n + 1}">Next surah</a>` : ''}</div>
  </div>`;
}

export function mushaf(data, p) {
  const head = data && data.ayahs.length ? data.ayahs[0].surah.englishName + ' · Juz ' + data.ayahs[0].juz : '';
  let lastS = null;
  const body = data ? data.ayahs.map((a) => {
    let out = '';
    if (a.surah.number !== lastS && a.numberInSurah === 1) {
      out += `<div style="text-align:center;margin:14px 0 6px;padding:6px;border:1px solid #C9A24A;border-radius:8px;font-size:22px">${esc(a.surah.name)}</div>`;
      if (a.surah.number !== 1 && a.surah.number !== 9) out += '<div style="text-align:center">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div>';
    }
    lastS = a.surah.number;
    let t = a.text; if (a.surah.number !== 1 && a.numberInSurah === 1) t = t.replace(/^بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ\s*/, '');
    return out + esc(t) + ` <span style="color:#9A7B2F">﴿${a.numberInSurah.toLocaleString('ar-EG')}﴾</span> `;
  }).join('') : '';
  return `<div class="screen">${backbar('Mushaf Madani', '#/quran')}
  <p class="pad small muted" style="margin:10px 0 12px">Page ${p} of 604 ${head ? '· ' + esc(head) : ''}</p>
  ${data ? `<div class="mushaf"><div class="pg">${body}</div><div style="text-align:center;margin-top:10px;font-size:14px;color:#7a6a4a">${p}</div></div>` : '<div class="spinner"></div>'}
  <div class="pad" style="display:flex;gap:10px;margin-top:16px">
    <a class="btn ghost" href="#/mushaf/${Math.min(604, p + 1)}" aria-label="Next page">← Next page</a>
    ${p > 1 ? `<a class="btn ghost" href="#/mushaf/${p - 1}" aria-label="Previous page">Previous →</a>` : ''}
  </div>
  <div class="field" style="margin-top:14px"><label for="pgo">Go to page</label><input id="pgo" class="input" type="number" min="1" max="604" value="${p}" data-act="pgo"></div>
  </div>`;
}

// ---------- HADITH ----------
export const hs = { col: 'nawawi', n: 1, data: null, err: '' };
export function hadithPage() {
  const col = COLLECTIONS.find((c) => c[0] === hs.col);
  return `<div class="screen">${backbar('Hadith')}
  <div class="chips" style="margin-top:18px">${COLLECTIONS.map((c) => `<button class="chip" style="flex:0 0 auto;padding:0 14px" data-act="hcol" data-v="${c[0]}" aria-pressed="${c[0] === hs.col}">${esc(c[1].replace('Sahih ', '').replace('Forty Hadith of an-', '40 '))}</button>`).join('')}</div>
  <div class="card" style="margin-top:16px;min-height:220px">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px"><span class="k">${esc(col[1])} · ${hs.n}</span>${hs.data && hs.data.grade ? `<span class="small muted">${esc(hs.data.grade)}</span>` : ''}</div>
    ${hs.err ? `<p class="muted">${esc(hs.err)}</p>` : hs.data ? `${hs.data.ar ? `<p class="ar" style="font-size:22px;line-height:1.9;margin:0 0 14px">${esc(hs.data.ar)}</p>` : ''}<p style="margin:0;line-height:1.65">${esc(hs.data.en)}</p>${hs.data.section ? `<p class="small muted" style="margin:12px 0 0">${esc(hs.data.section)}</p>` : ''}` : '<div class="spinner"></div>'}
  </div>
  <div class="pad" style="display:flex;gap:10px;margin-top:16px">
    <button class="btn ghost" data-act="hprev" ${hs.n <= 1 ? 'disabled' : ''}>Previous</button>
    <button class="btn" data-act="hnext">Next</button>
  </div>
  <div class="pad" style="display:flex;gap:10px;margin-top:10px">
    <button class="btn ghost" data-act="hrand">${I.shuffle(18)}Random</button>
    <input class="input" type="number" min="1" max="${col[2]}" placeholder="No." aria-label="Hadith number" data-act="hgo" style="width:110px;flex-shrink:0">
  </div>
  <p class="pad small muted" style="margin-top:14px">English and Arabic text from the open hadith-api collection.</p>
  </div>`;
}

// ---------- SIRAH / DUAS / NAMES ----------
export function sirah() {
  return `<div class="screen">${backbar('Sirah')}
  <p class="pad muted" style="margin:12px 0 6px">The life of the Prophet Muhammad ﷺ, in sixteen moments.</p>
  <div class="list">${SIRAH.map(([y, t, d], i) => `<div class="li rise" style="--i:${i};align-items:flex-start;flex-direction:column;gap:4px"><span class="k" style="color:var(--accent)">${y}</span><span class="h2" style="font-size:22px">${esc(t)}</span><span class="muted" style="line-height:1.55">${esc(d)}</span></div>`).join('')}</div></div>`;
}
export function duas() {
  return `<div class="screen">${backbar('Duas & adhkar')}
  <div class="list" style="margin-top:8px">${DUAS.map(([t, a, e, s], i) => `<div class="li rise" style="--i:${i};flex-direction:column;align-items:stretch;gap:8px"><span class="k">${esc(t)}</span><span class="ar" style="font-size:24px;line-height:1.9;text-align:right">${a}</span><span style="line-height:1.55">${esc(e)}</span><span class="small muted">${esc(s)}</span></div>`).join('')}</div></div>`;
}
export function names() {
  return `<div class="screen">${backbar('The 99 Names')}
  <p class="ar pad" style="text-align:center;font-size:30px;margin:18px 0 4px">أسماء الله الحسنى</p>
  <div class="grid2" style="margin-top:14px">${NAMES.map(([a, t, m], i) => `<div class="tile" style="min-height:120px;justify-content:space-between"><span class="small muted">${i + 1}</span><span class="ar" style="font-size:26px;align-self:flex-end">${a}</span><span style="display:flex;flex-direction:column"><span style="font-weight:600">${esc(t)}</span><span class="small muted">${esc(m)}</span></span></div>`).join('')}</div></div>`;
}

// ---------- TASBIH ----------
export function tasbih() {
  const t = store.get('tasbih', { i: 0, n: 0, total: 0 });
  const d = DHIKR[t.i % DHIKR.length];
  return `<div class="screen">${backbar('Tasbih')}
  <div class="chips" style="margin-top:18px">${DHIKR.map((x, i) => `<button class="chip" style="flex:0 0 auto;padding:0 14px" data-act="dhikr" data-i="${i}" aria-pressed="${i === t.i % DHIKR.length}">${x[1]}</button>`).join('')}</div>
  <button class="bead" data-act="count" aria-label="Count"><span class="ar" style="font-size:26px">${d[0]}</span><span class="n" id="tn">${t.n}</span><span class="small" style="opacity:.8">of ${d[2]}</span></button>
  <p style="text-align:center" class="muted small">Today's total: <span id="tt">${t.total}</span></p>
  <div class="pad" style="margin-top:10px"><button class="btn ghost" data-act="treset">Reset</button></div></div>`;
}

// ---------- CALENDAR ----------
export const cs = { off: 0 };
export function calendar() {
  const base = new Date(); base.setDate(1); base.setMonth(base.getMonth() + cs.off);
  const y = base.getFullYear(), m = base.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;
  const today = new Date();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<div></div>');
  for (let d = 1; d <= days; d++) {
    const dt = new Date(y, m, d), h = hijriParts(dt);
    const fast = dt.getDay() === 1 || dt.getDay() === 4 || (h.day >= 13 && h.day <= 15);
    const isT = dt.toDateString() === today.toDateString();
    cells.push(`<div class="d ${isT ? 'today' : ''} ${fast && !isT ? 'fast' : ''}"><span>${d}</span><small>${h.day}</small></div>`);
  }
  const hm = (d) => { try { return new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { month: 'long', year: 'numeric' }).format(d).replace(/ AH$/, ''); } catch { return ''; } };
  return `<div class="screen">${backbar('Hijri calendar')}
  <div style="text-align:center;margin:18px 0 4px"><span class="h2">${base.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span><br><span class="small muted">${hm(new Date(y, m, 1))} – ${hm(new Date(y, m, days))}</span></div>
  <p style="text-align:center;margin:6px 0 14px" class="small muted">Today: ${hijri()}</p>
  <div class="cal">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((w) => `<div class="wd">${w}</div>`).join('')}${cells.join('')}</div>
  <p class="pad small muted" style="margin-top:12px">Small numbers are Hijri dates (Umm al-Qura). Outlined days are Sunnah fasts: Mondays, Thursdays and the 13th–15th of each Hijri month. Your local moon sighting may differ by a day.</p>
  <div class="pad" style="display:flex;gap:10px"><button class="btn ghost" data-act="cal" data-d="-1">Previous</button><button class="btn ghost" data-act="cal" data-d="1">Next</button></div></div>`;
}

// ---------- ZAKAT ----------
export function zakat() {
  const z = store.get('zakat', { cash: '', gold: '', silver: '', business: '', owed: '', debts: '', goldPrice: '' });
  const f = (k, l, hint = '') => `<div class="field"><label for="z-${k}">${l}</label><input id="z-${k}" class="input" inputmode="decimal" data-act="zak" data-k="${k}" value="${esc(z[k])}" placeholder="${hint || '₦0'}"></div>`;
  return `<div class="screen">${backbar('Zakat')}
  <p class="pad muted" style="margin:12px 0 18px">Add what you have held for a full lunar year. Amounts in naira.</p>
  ${f('goldPrice', 'Gold price today, per gram', '₦ per gram')}
  ${f('cash', 'Cash and bank savings')}${f('gold', 'Value of gold you own')}${f('silver', 'Value of silver you own')}${f('business', 'Business stock for sale')}${f('owed', 'Money owed to you that you expect back')}${f('debts', 'Debts you must pay now')}
  <div class="card" id="zres" style="margin-top:8px">${zakatResult(z)}</div>
  <p class="pad small muted" style="margin-top:12px">Nisab is taken as the value of 85 g of gold. This is a guide; for complex cases, ask a scholar you trust.</p></div>`;
}
export function zakatResult(z) {
  const n = (k) => parseFloat(String(z[k] || '').replace(/[^\d.]/g, '')) || 0;
  const total = n('cash') + n('gold') + n('silver') + n('business') + n('owed') - n('debts');
  const nisab = n('goldPrice') * 85;
  const due = nisab && total >= nisab ? total * 0.025 : 0;
  const ng = (v) => '₦' + Math.round(v).toLocaleString('en-NG');
  return `<div style="display:flex;justify-content:space-between"><span class="muted">Zakatable wealth</span><span>${ng(total)}</span></div>
  <div style="display:flex;justify-content:space-between;margin-top:6px"><span class="muted">Nisab (85 g gold)</span><span>${nisab ? ng(nisab) : 'Add gold price'}</span></div>
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:14px;padding-top:12px;border-top:1px solid var(--line)"><span style="font-weight:600">Zakat due (2.5%)</span><span class="h2">${ng(due)}</span></div>
  ${nisab && total < nisab ? '<p class="small muted" style="margin:8px 0 0">Below nisab, so no zakat is due.</p>' : ''}`;
}

// ---------- NEWS / WATCH / MORE ----------
export function newsPage(items) {
  return `<div class="screen">${backbar('Islamic news')}
  ${items === null ? '<div class="empty">Connect the Awqat worker in Settings to load news.</div>' : !items ? '<div class="spinner"></div>' : !items.length ? '<div class="empty">No news right now.</div>' : `<div class="list" style="margin-top:8px">${items.map((n) => `<a class="li" href="${esc(n.link)}" target="_blank" rel="noopener" style="flex-direction:column;align-items:flex-start;gap:4px"><span style="font-family:var(--fd);font-size:19px;line-height:1.3">${esc(n.title)}</span><span class="small muted">${esc(n.source)}${n.date ? ' · ' + new Date(n.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}</span></a>`).join('')}</div>`}
  </div>`;
}
export function watchPage(v) {
  return `<div class="screen">${backbar('Watch')}<div style="margin-top:16px">${v && v.length ? `<div class="list">${v.map((x) => `<a class="li" href="https://www.youtube.com/watch?v=${esc(x.id)}" target="_blank" rel="noopener" style="gap:14px;justify-content:flex-start"><span class="th" style="flex:0 0 120px;height:68px;border-radius:12px;background:var(--card) center/cover url('https://i.ytimg.com/vi/${esc(x.id)}/mqdefault.jpg')"></span><span style="display:flex;flex-direction:column;gap:3px"><span style="font-weight:500;line-height:1.3">${esc(x.title)}</span><span class="small muted">${esc(x.channel)}</span></span></a>`).join('')}</div>` : videoRail(v)}</div></div>`;
}
export function more() {
  return `<div class="screen">
  <div class="top" style="padding-top:12px"><span class="h1">More</span><a class="iconbtn" href="#/settings" aria-label="Settings">${I.gear(20)}</a></div>
  <div style="margin-top:20px">${libraryGrid()}</div>
  <div class="list" style="margin-top:20px">
    ${[['#/alarms', 'Alarms & sync'], ['#/news', 'Islamic news'], ['#/watch', 'Watch'], ['#/qibla', 'Qibla'], ['#/settings', 'Settings & theme']].map(([h, t]) => `<a class="li" href="${h}"><span style="font-weight:600">${t}</span>${I.chev()}</a>`).join('')}
  </div></div>`;
}

// ---------- SETTINGS ----------
const METHODS = [['MuslimWorldLeague', 'Muslim World League'], ['Egyptian', 'Egyptian General Authority'], ['UmmAlQura', 'Umm al-Qura, Makkah'], ['Karachi', 'University of Islamic Sciences, Karachi'], ['NorthAmerica', 'ISNA, North America'], ['Dubai', 'Dubai'], ['Qatar', 'Qatar'], ['Kuwait', 'Kuwait']];
const THEMES = [['sky', 'Sky', '#F2E7C9', '#24301F'], ['clay', 'Clay', '#B4532F', '#EEE3D0'], ['ink', 'Ink & Brass', '#0F1522', '#D2A65A'], ['paper', 'Paper', '#F4F2EC', '#111111']];
export function settings() {
  const loc = setting('location'), th = setting('theme');
  return `<div class="screen">${backbar('Settings')}
  <div class="sec-h" style="margin-top:20px"><span class="k">Theme</span></div>
  <div class="grid2">${THEMES.map(([k, n, a, b]) => `<button class="tile" data-act="theme" data-v="${k}" style="min-height:90px;${th === k ? 'box-shadow:inset 0 0 0 2px var(--accent)' : ''}"><span style="display:flex;gap:6px"><i style="width:22px;height:22px;border-radius:11px;background:${a};border:1px solid rgba(0,0,0,.15)"></i><i style="width:22px;height:22px;border-radius:11px;background:${b};border:1px solid rgba(0,0,0,.15)"></i></span><span class="t">${n}</span></button>`).join('')}</div>
  <div class="sec-h"><span class="k">Location</span><span class="small muted">${esc(loc.label)}</span></div>
  <div class="field"><label for="country">Country</label><select id="country" class="input" data-act="country">${Object.keys(COUNTRIES).map((c) => `<option ${loc.country === c ? 'selected' : ''}>${c}</option>`).join('')}<option value="__gps" ${loc.kind === 'gps' ? 'selected' : ''}>Somewhere else (use my location)</option></select></div>
  ${loc.kind === 'gps' ? '' : `<div class="field"><label for="state">State</label><select id="state" class="input" data-act="state">${(COUNTRIES[loc.country] || []).map(([s]) => `<option value="${s}" ${loc.state === s ? 'selected' : ''}>${s === 'FCT' ? 'Abuja (FCT)' : s}</option>`).join('')}</select></div>`}
  <div class="pad"><button class="btn ghost" data-act="gps">${I.loc(18)}Use my exact location</button></div>
  <div class="sec-h"><span class="k">Calculation</span></div>
  <div class="field"><label for="method">Method (used when you have no snapped times)</label><select id="method" class="input" data-act="method">${METHODS.map(([k, n]) => `<option value="${k}" ${setting('method') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
  <div class="field"><label for="madhab">Asr time</label><select id="madhab" class="input" data-act="madhab"><option value="Shafi" ${setting('madhab') === 'Shafi' ? 'selected' : ''}>Standard (Maliki, Shafi'i, Hanbali)</option><option value="Hanafi" ${setting('madhab') === 'Hanafi' ? 'selected' : ''}>Hanafi</option></select></div>
  <div class="list"><div class="li"><span style="font-weight:500">24-hour clock</span><button class="sw" role="switch" aria-checked="${setting('clock24')}" aria-label="24-hour clock" data-act="clock"></button></div></div>
  <div class="sec-h"><span class="k">AI reader & feeds</span></div>
  <div class="field"><label for="wurl">Awqat worker link</label><input id="wurl" class="input" type="url" placeholder="https://awqat.yourname.workers.dev" value="${esc(store.get('workerUrl', ''))}" data-act="wurl"></div>
  <p class="pad small muted" style="margin-top:-4px">${WORKER() ? 'Connected.' : 'Not connected. Scanning, news and videos need it.'}</p>
  <div class="sec-h"><span class="k">Install on your phone</span></div>
  <div class="card"><p class="small" style="margin:0;line-height:1.6"><b>iPhone:</b> open in Safari, tap Share, then <i>Add to Home Screen</i>.<br><b>Android:</b> open in Chrome, tap ⋮, then <i>Install app</i> or <i>Add to Home screen</i>.</p></div>
  <div class="pad" style="margin-top:18px"><button class="btn ghost" data-act="reset">Clear all data on this phone</button></div>
  <p class="pad small muted" style="text-align:center;margin-top:18px">Awqat · made with care</p>
  </div>`;
}
export { SALAH, PRAYERS, hhmm };

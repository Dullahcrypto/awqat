import { schedule, nextPrayer, fmt, ampm, left, SALAH, SKY, activeSnap } from './prayer.js';
import { setting } from './store.js';
import { esc, I, hijri, gdate } from './ui.js';
import { DAILY } from '../data/content.js';

export const homeState = { sel: null, open: null };

const ARC_T = { fajr: 0.03, sunrise: 0.14, dhuhr: 0.5, asr: 0.72, maghrib: 0.97, isha: 1.08 };
const arcPos = (t) => ({ x: 170 - 150 * Math.cos(Math.PI * t), y: 180 - 150 * Math.sin(Math.PI * t) });

function sourceLine() {
  const s = activeSnap();
  return s ? 'Snapped times · ' + esc(s.label) : 'Calculated for ' + esc(setting('location').label);
}

function heroSky(sch, nx) {
  const sel = homeState.sel || nx.key;
  const cur = sch.find((p) => p.key === sel) || nx;
  const isNext = cur.key === nx.key;
  const sp = arcPos(ARC_T[cur.key]);
  return `
  <div class="cloud" style="top:118px;width:90px"></div><div class="cloud" style="top:170px;width:56px;height:12px;animation-duration:54s;animation-delay:-20s"></div>
  <div class="top" style="align-items:flex-start;padding-top:22px">
    <div style="display:flex;flex-direction:column;gap:2px"><span style="font-size:14px;font-weight:500">${gdate()}</span><span class="small muted">${esc(setting('location').label)}</span></div>
    <span class="ar" style="font-size:18px;opacity:.8">${hijri(new Date(), 'ar')}</span>
  </div>
  <div class="arc" aria-hidden="true">
    <svg viewBox="0 0 340 190"><path d="M20 180 A150 150 0 0 1 320 180" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="1.5" stroke-dasharray="2 6" stroke-linecap="round"/><path d="M0 180 H340" stroke="currentColor" stroke-opacity=".25"/></svg>
    ${SALAH.map((p) => { const q = arcPos(ARC_T[p.key]); return `<i class="adot" style="left:${q.x / 3.4}%;top:${q.y / 1.9}%"></i>`; }).join('')}
    <i class="sun" style="left:${sp.x / 3.4}%;top:${sp.y / 1.9}%"></i>
  </div>
  <div class="pad" style="padding-top:30px;display:flex;flex-direction:column;gap:6px">
    <span class="k">${isNext ? 'Next prayer · in <span data-live="left">' + left(nx.ms) + '</span>' : 'Today'}</span>
    <div style="display:flex;align-items:baseline;gap:14px"><span class="h1" style="font-size:46px">${esc(cur.name)}</span><span class="ar" style="font-size:24px;opacity:.75">${cur.ar}</span></div>
    <span class="bigtime">${fmt(cur.main)}</span>
    <span style="font-size:15px;opacity:.75">${cur.iqama ? 'Iqama · adhan at ' + fmt(cur.adhan) + ' ' + ampm(cur.adhan) : 'Adhan · ' + ampm(cur.adhan)}</span>
  </div>
  <div class="chips" style="margin-top:22px" role="group" aria-label="Prayers">
    ${sch.filter((p) => p.key !== 'sunrise').map((p) => `<button class="chip" data-act="sel" data-k="${p.key}" aria-pressed="${p.key === cur.key}">${esc(p.name === "Jumu'ah" ? 'Jumu’ah' : p.name)}</button>`).join('')}
  </div>
  <div style="margin:14px 18px 0"><a class="btn" href="#/snap">${I.camera(20)}Snap prayer time</a></div>`;
}

function heroClay(sch, nx) {
  return `
  <div class="top" style="padding-top:22px"><span class="brand">awqat</span><a class="pill" href="#/settings">${I.loc(16)}${esc(setting('location').label)}</a></div>
  <div class="arch"><div class="arch-in">
    <div class="lamp" aria-hidden="true"><i></i><b></b></div>
    <span class="ar" style="font-size:26px">${nx.ar}</span>
    <span style="font-family:var(--fd);font-size:84px;line-height:.95;letter-spacing:-.03em">${fmt(nx.main)}</span>
    <span style="font-size:14px;font-weight:500;opacity:.9;margin-top:6px">${esc(nx.name)} ${nx.iqama ? 'iqama' : ''} · in <span data-live="left">${left(nx.ms)}</span></span>
  </div></div>
  <div class="list ptable" style="margin-top:20px">
    ${sch.map((p, i) => { const open = homeState.open === p.key; return `<button class="li rise" style="--i:${i};flex-direction:column;align-items:stretch;gap:6px" data-act="open" data-k="${p.key}" data-next="${p.key === nx.key ? 1 : 0}" aria-expanded="${open}">
      <span style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-weight:600">${esc(p.name)}</span><span class="tm">${fmt(p.main)}</span></span>
      ${open ? `<span class="small muted" style="display:flex;justify-content:space-between;animation:up .4s both"><span>Adhan ${fmt(p.adhan)} ${ampm(p.adhan)}</span><span>${p.iqama ? 'Iqama ' + fmt(p.iqama) : 'No iqama set'}</span></span>` : ''}
    </button>`; }).join('')}
  </div>
  <div style="margin:18px 22px 0"><a class="btn primary-dark" href="#/snap">${I.camera(20)}Snap prayer time</a></div>`;
}

function heroInk(sch, nx) {
  const off = 754 * (1 - nx.frac);
  const sel = homeState.sel || nx.key;
  return `
  <div class="top" style="padding-top:22px"><div style="display:flex;flex-direction:column;gap:2px"><span class="brand">Awqat</span><span class="small muted">${esc(setting('location').label)}</span></div><a class="iconbtn" href="#/snap" aria-label="Snap prayer time" style="border-radius:14px;color:var(--accent)">${I.scan(22)}</a></div>
  <div class="ring">
    <div class="glow" aria-hidden="true"></div>
    <svg viewBox="0 0 280 280" width="280" height="280" aria-hidden="true">
      <circle cx="140" cy="140" r="120" fill="var(--bg)" stroke="#232C40" stroke-width="6"/>
      <circle cx="140" cy="140" r="132" fill="none" stroke="#D2A65A" stroke-opacity=".3" stroke-width="1" stroke-dasharray="1 7.6"/>
      <circle class="prog" data-live="ring" cx="140" cy="140" r="120" fill="none" stroke="#D2A65A" stroke-width="6" stroke-linecap="round" stroke-dasharray="754" stroke-dashoffset="${off}"/>
    </svg>
    <div class="mid"><span class="ar" style="font-size:34px;color:var(--accent);line-height:1.2">${nx.ar}</span><span class="mono" style="font-size:38px;letter-spacing:-.02em" data-live="lefts">${left(nx.ms, true)}</span><span class="small muted">until ${esc(nx.name)} ${nx.iqama ? 'iqama' : ''} at ${fmt(nx.main)} ${ampm(nx.main)}</span></div>
  </div>
  <div class="sec-h" style="margin-top:30px"><span class="h2">Today</span><span class="k">swipe</span></div>
  <div class="rail">
    ${sch.map((p, i) => `<button class="pcard rise" style="--i:${i + 3}" data-act="sel" data-k="${p.key}" aria-pressed="${p.key === sel}"><span class="small muted">${esc(p.name)}</span><span class="tm">${fmt(p.main)}</span><span class="small muted">${p.iqama ? 'adhan ' + fmt(p.adhan) : ampm(p.adhan)}</span></button>`).join('')}
  </div>
  <div style="margin:18px 22px 0"><a class="btn" href="#/snap">${I.camera(20)}Snap prayer time</a></div>`;
}

function heroPaper(sch, nx) {
  const h24 = setting('clock24');
  const nowF = (new Date().getHours() * 60 + new Date().getMinutes()) / 1440;
  const tl = (d) => ((d.getHours() * 60 + d.getMinutes()) / 1440 * 100).toFixed(1);
  const loc = esc(setting('location').label.toUpperCase());
  const snap = activeSnap();
  const tk = `<span>${loc}</span><span style="color:#7FD1AE">${snap ? 'SNAPPED TIMES · ' + esc(snap.label.toUpperCase()) : 'CALCULATED TIMES'}</span><span>${esc(hijri().toUpperCase())}</span>`;
  return `
  <div class="top" style="padding-top:22px"><span class="brand" style="font-size:22px">Awqat.</span><button class="pill" data-act="clock">${h24 ? '24h' : '12h'}</button></div>
  <div class="ticker" aria-hidden="true"><div>${tk}${tk}</div></div>
  <div class="pad" style="padding-top:26px;display:flex;flex-direction:column">
    <div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:15px;font-weight:600">Next — ${esc(nx.name)}${nx.iqama ? ' iqama' : ''} · in <span data-live="left">${left(nx.ms)}</span></span><span class="ar" style="font-size:16px;flex-shrink:0;padding-left:8px">${nx.ar}</span></div>
    <span class="mega rise">${fmt(nx.main)}</span>
  </div>
  <div class="tline" aria-hidden="true"><div class="bar"></div>${sch.filter((p) => p.key !== 'sunrise').map((p) => `<i class="tk" style="left:${tl(p.main)}%"></i>`).join('')}<i class="now" style="left:${(nowF * 100).toFixed(1)}%"></i></div>
  <div class="pgrid">${sch.map((p, i) => `<div class="rise" style="--i:${i + 2}"><span class="small" style="font-weight:600;color:${p.key === nx.key ? 'var(--accent)' : 'var(--muted)'}">${esc(p.name)}</span><span class="tm">${fmt(p.main)}</span></div>`).join('')}</div>
  <div style="margin:18px 22px 0"><a class="btn" href="#/snap">Snap prayer time ${I.camera(22)}</a></div>`;
}

const LIB = [
  ['#/sirah', 'Sirah', 'Life of the Prophet ﷺ', 'السيرة'],
  ['#/hadith', 'Hadith', 'Bukhari · Muslim · Nawawi', 'الحديث'],
  ['#/duas', 'Duas', 'Morning & evening', 'الدعاء'],
  ['#/tasbih', 'Tasbih', 'Tap counter', 'التسبيح'],
  ['#/names', '99 Names', 'Asma ul-Husna', 'الأسماء'],
  ['#/calendar', 'Hijri calendar', 'Fasts & occasions', 'التقويم'],
  ['#/zakat', 'Zakat', 'Calculator', 'الزكاة'],
  ['#/saved', 'Saved times', 'Your snaps', 'المحفوظ']
];
export const libraryGrid = () => `<div class="grid2">${LIB.map(([h, t, s, a], i) => `<a class="tile rise" style="--i:${i}" href="${h}">${setting('theme') === 'ink' ? `<span class="tar">${a}</span>` : ''}<span class="t">${t}</span><span class="small muted">${s}</span></a>`).join('')}</div>`;

const REM = [['adhan', 'Adhan alerts', 'Every prayer'], ['kahf', 'Surah Al-Kahf on Friday', 'Friday morning'], ['adhkar', 'Morning adhkar', 'After Fajr'], ['fasts', 'Monday & Thursday fasts', 'Night before']];

export function home(newsItems, vids) {
  const sch = schedule();
  const nx = nextPrayer();
  const theme = setting('theme');
  const hero = { sky: heroSky, clay: heroClay, ink: heroInk, paper: heroPaper }[theme](sch, nx);
  const day = DAILY[Math.floor(Date.now() / 864e5) % DAILY.length];
  const r = setting('reminders');
  const mushaf = setting('mushaf');
  const last = JSON.parse(localStorage.getItem('awqat:lastRead') || 'null');
  const onCount = Object.values(r).filter(Boolean).length;
  const newsHTML = newsItems === null
    ? `<div class="empty small">News appears here once the Awqat worker is connected.</div>`
    : newsItems === undefined ? '<div class="spinner"></div>'
    : !newsItems.length ? '<div class="empty small">No news right now.</div>'
    : `<div class="list">${newsItems.slice(0, 3).map((n) => `<a class="li" href="${esc(n.link)}" target="_blank" rel="noopener" style="flex-direction:column;align-items:flex-start;gap:4px"><span style="font-family:var(--fd);font-size:18px;line-height:1.3">${esc(n.title)}</span><span class="small muted">${esc(n.source)}</span></a>`).join('')}</div><div style="margin:8px 22px 0"><a class="small" href="#/news" style="font-weight:600">All news →</a></div>`;
  return `<div class="screen" style="padding-top:var(--safe-t)">
  ${hero}
  <div class="sec-h src"><span class="small muted" style="font-weight:600">${sourceLine()}</span><a class="small" href="#/alarms" style="font-weight:600">Alarms →</a></div>

  <div class="card rise" style="display:flex;flex-direction:column;gap:14px">
    <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="h2">The Qur'an</span><span class="ar" style="font-size:20px;color:var(--accent)">المصحف</span></div>
    <div class="seg" role="group" aria-label="Mushaf"><button data-act="mushaf" data-v="madani" aria-pressed="${mushaf === 'madani'}">Mushaf Madani</button><button data-act="mushaf" data-v="maki" aria-pressed="${mushaf === 'maki'}">Mushaf Maki</button></div>
    <a href="${last ? '#/surah/' + last.s : '#/quran'}" style="display:flex;justify-content:space-between;font-size:14px;border-top:1px solid var(--line);padding-top:12px"><span>${last ? 'Continue · ' + esc(last.name) + ', ayah ' + last.a : 'Start reading'}</span><span class="muted">${mushaf === 'madani' ? '604 pages' : 'Makkah print'}</span></a>
  </div>

  <div class="sec-h"><span class="k">Library</span></div>
  ${libraryGrid()}

  <div class="sec-h"><span class="k">Hadith of the day</span></div>
  <div class="quote"><span class="q">“${esc(day[0])}”</span><span class="small muted">${esc(day[1])}</span></div>

  <div class="sec-h"><span class="k">Reminders</span><span class="small muted">${onCount} on</span></div>
  <div class="list">${REM.map(([k, n, w]) => `<div class="li"><span style="display:flex;flex-direction:column;gap:2px"><span style="font-weight:500">${n}</span><span class="small muted">${w}</span></span><button class="sw" role="switch" aria-checked="${!!r[k]}" aria-label="${n}" data-act="rem" data-k="${k}"></button></div>`).join('')}</div>

  <div class="sec-h"><span class="k">Islamic news</span></div>
  ${newsHTML}

  <div class="sec-h"><span class="k">Watch</span><a class="small" href="#/watch" style="font-weight:600">All →</a></div>
  ${videoRail(vids)}
  </div>`;
}

export function videoRail(vids) {
  if (vids === null || (vids && !vids.length)) return `<div class="empty small">${vids === null ? 'Islamic videos from your chosen YouTube channels appear here once the worker is connected.' : 'No videos yet.'}</div>`;
  if (!vids) return '<div class="spinner"></div>';
  return `<div class="rail">${vids.slice(0, 8).map((v) => `<a class="vid" href="https://www.youtube.com/watch?v=${esc(v.id)}" target="_blank" rel="noopener"><span class="th" style="background-image:url('https://i.ytimg.com/vi/${esc(v.id)}/mqdefault.jpg')"><span class="play">${I.play(16)}</span></span><span style="font-size:15px;font-weight:500;line-height:1.3">${esc(v.title)}</span><span class="small muted">${esc(v.channel || '')}</span></a>`).join('')}</div>`;
}

export function liveTick() {
  const nx = nextPrayer();
  document.querySelectorAll('[data-live="left"]').forEach((e) => { e.textContent = left(nx.ms); });
  document.querySelectorAll('[data-live="lefts"]').forEach((e) => { e.textContent = left(nx.ms, true); });
  document.querySelectorAll('[data-live="ring"]').forEach((e) => { e.setAttribute('stroke-dashoffset', 754 * (1 - nx.frac)); });
  return nx;
}
export { SKY };

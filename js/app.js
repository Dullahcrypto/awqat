import { store, setting, setSetting } from './store.js';
import { currentKey, SKY, saveSnap, deleteSnap, useSnap, schedule, effectiveTheme } from './prayer.js';
import { home, homeState, liveTick } from './home.js';
import * as P from './pages.js';
import { toast, I, themeSheet } from './ui.js';
import { readOnDevice } from './ocr.js';
import { canSnap, recordSnap, buyLifetime, restore } from './plan.js';
import { shrink, scanBoard, quran, hadith, COLLECTIONS, news, videos } from './net.js';
import { scheduleToday, enableNotifications, downloadICS, androidAlarmURL } from './alarms.js';
import { COUNTRIES, placeLabel } from '../data/places.js';
import { DHIKR } from '../data/content.js';

const $app = document.getElementById('app');
const $nav = document.getElementById('nav');
const cache = { list: null, surah: {}, page: {}, news: undefined, vids: undefined, q: '' };

const FONTS = {
  sky: 'family=Young+Serif&family=Outfit:wght@300;400;500;600&family=Noto+Naskh+Arabic:wght@400;500;700',
  clay: 'family=Gloock&family=Figtree:wght@400;500;600;700&family=Reem+Kufi:wght@500;600',
  ink: 'family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono&family=Aref+Ruqaa:wght@400;700',
  paper: 'family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Noto+Kufi+Arabic:wght@500'
};
const QFONT = '&family=Amiri+Quran&family=Amiri:wght@400;700';

function applyTheme() {
  const t = effectiveTheme();
  const html = document.documentElement;
  html.dataset.theme = t;
  const route = location.hash.slice(1) || '/';
  const sky = route === '/' && homeState.sel ? SKY[homeState.sel] : SKY[currentKey()];
  html.dataset.sky = sky;
  document.getElementById('theme-fonts').href = 'https://fonts.googleapis.com/css2?' + FONTS[t] + QFONT + '&display=swap';
  requestAnimationFrame(() => {
    const bg = getComputedStyle(document.body).backgroundColor;
    document.querySelector('meta[name="theme-color"]').setAttribute('content', bg);
  });
}

function nav(route) {
  const cur = (r) => (route === r || (r !== '/' && route.startsWith(r)) ? 'aria-current="page"' : '');
  $nav.innerHTML = `
    <a href="#/" ${cur('/')}>Today</a>
    <a href="#/quran" ${route.startsWith('/surah') || route.startsWith('/mushaf') ? 'aria-current="page"' : cur('/quran')}>Qur'an</a>
    <a class="snapbtn" href="#/snap" aria-label="Snap prayer time">${I.camera(22)}<span class="lbl">Snap</span></a>
    <a href="#/qibla" ${cur('/qibla')}>Qibla</a>
    <a href="#/more" ${cur('/more')}>Explore</a>`;
  $nav.style.display = route === '/snap' || route === '/review' || route === '/welcome' ? 'none' : '';
}

function loadFeeds() {
  if (!cache.newsReq) { cache.newsReq = true; news().then((v) => { cache.news = v; rerenderIf(['/', '/news']); }).catch(() => { cache.news = null; rerenderIf(['/', '/news']); }); }
  if (!cache.vidsReq) { cache.vidsReq = true; videos().then((v) => { cache.vids = v; rerenderIf(['/', '/watch']); }).catch(() => { cache.vids = null; rerenderIf(['/', '/watch']); }); }
}
function rerenderIf(routes) { const r = location.hash.slice(1) || '/'; if (routes.includes(r)) render(true); }

function view(route) {
  let m;
  if (route === '/welcome') return P.welcome();
  if (route === '/') { loadFeeds(); return home(cache.news, cache.vids); }
  if (route === '/snap') return P.snap();
  if (route === '/review') return P.review();
  if (route === '/saved') return P.saved();
  if (route === '/alarms') return P.alarms();
  if (route === '/qibla') return P.qibla();
  if (route === '/quran') {
    if (!cache.list) quran.list().then((l) => { cache.list = l; rerenderIf(['/quran']); }).catch(() => toast('Could not load the surah list. Check your connection.'));
    return P.quranList(cache.list, cache.q);
  }
  if ((m = route.match(/^\/surah\/(\d+)/))) {
    const n = Math.min(114, Math.max(1, +m[1]));
    if (!cache.surah[n]) quran.surah(n).then((d) => { cache.surah[n] = d; rerenderIf([route]); }).catch(() => toast('Could not load this surah.'));
    return P.surah(cache.surah[n], n);
  }
  if ((m = route.match(/^\/mushaf\/(\d+)/))) {
    const p = Math.min(604, Math.max(1, +m[1])); store.set('lastPage', p);
    if (!cache.page[p]) quran.page(p).then((d) => { cache.page[p] = d; rerenderIf([route]); }).catch(() => toast('Could not load this page.'));
    return P.mushaf(cache.page[p], p);
  }
  if (route === '/hadith') { if (!P.hs.data && !P.hs.err) loadHadith(); return P.hadithPage(); }
  if (route === '/sirah') return P.sirah();
  if (route === '/duas') return P.duas();
  if (route === '/names') return P.names();
  if (route === '/tasbih') return P.tasbih();
  if (route === '/calendar') return P.calendar();
  if (route === '/zakat') return P.zakat();
  if (route === '/news') { loadFeeds(); return P.newsPage(cache.news); }
  if (route === '/watch') { loadFeeds(); return P.watchPage(cache.vids); }
  if (route === '/more') return P.more();
  if (route === '/pro') return P.pro();
  if (route === '/settings') return P.settings();
  return home(cache.news, cache.vids);
}

let lastRoute = '';
function render(keepScroll) {
  const route = location.hash.slice(1) || '/';
  applyTheme();
  const y = window.scrollY;
  $app.innerHTML = view(route);
  nav(route);
  if (keepScroll && route === lastRoute) window.scrollTo(0, y); else if (route !== lastRoute) window.scrollTo(0, 0);
  lastRoute = route;
}

async function loadHadith() {
  const col = COLLECTIONS.find((c) => c[0] === P.hs.col);
  P.hs.data = null; P.hs.err = '';
  try { P.hs.data = await hadith(P.hs.col, P.hs.n); }
  catch { P.hs.err = 'Could not load hadith ' + P.hs.n + ' of ' + col[1] + '. Try another number or check your connection.'; }
  rerenderIf(['/hadith']);
}

// ---------- events ----------
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.tagName === 'INPUT' || el.tagName === 'SELECT') return;
  const a = el.dataset.act, k = el.dataset.k, v = el.dataset.v;
  switch (a) {
    case 'sel': homeState.sel = homeState.sel === k ? null : k; render(true); break;
    case 'open': homeState.open = homeState.open === k ? null : k; render(true); break;
    case 'clock': setSetting('clock24', !setting('clock24')); render(true); break;
    case 'mushaf':
      setSetting('mushaf', v);
      if (v === 'maki') toast('Mushaf Maki page layout is coming soon');
      render(true); break;
    case 'rem': {
      const r = setting('reminders'); r[k] = !r[k]; setSetting('reminders', r);
      if (r[k]) await enableNotifications();
      scheduleToday(); render(true); break;
    }
    case 'manual': P.ps.pending = { times: {} }; location.hash = '#/review'; break;
    case 'ai': {
      if (!P.ps.preview) break;
      try {
        P.ps.error = ''; P.ps.failed = false; P.ps.scanning = true; P.ps.status = 'Reading with AI…';
        if (location.hash !== '#/snap') location.hash = '#/snap'; else render(true);
        const res = await scanBoard(P.ps.preview);
        P.ps.scanning = false; P.ps.pending = { times: res.times || {}, confidence: res.confidence, notes: res.notes, source: 'ai' };
        location.hash = '#/review'; render(true);
      } catch (err) { P.ps.scanning = false; P.ps.failed = true; P.ps.error = err.message; render(true); }
      break;
    }
    case 'savesnap': {
      const f = document.getElementById('rform');
      const times = {};
      new FormData(f).forEach((val, name) => { const [p, t] = name.split('.'); times[p] = times[p] || { adhan: '', iqama: '' }; times[p][t] = String(val); });
      const any = Object.values(times).some((x) => x.adhan || x.iqama);
      if (!any) { toast('Add at least one time first'); break; }
      const label = document.getElementById('label').value.trim() || 'Snapped ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      saveSnap({ id: (P.ps.pending && P.ps.pending.id) || 's' + Date.now(), label, date: Date.now(), times });
      P.ps.pending = null; P.ps.preview = null;
      scheduleToday(); toast('Saved. Awqat now follows these times.');
      location.hash = '#/alarms'; break;
    }
    case 'usesnap': useSnap(el.dataset.id || null); scheduleToday(); toast('Updated'); render(true); break;
    case 'delsnap': if (confirm('Delete these saved times?')) { deleteSnap(el.dataset.id); render(true); } break;
    case 'lead': setSetting('alarmLead', v); scheduleToday(); render(true); break;
    case 'alarm': { const o = setting('alarmsOn'); o[k] = !o[k]; setSetting('alarmsOn', o); scheduleToday(); render(true); break; }
    case 'notif': {
      const res = await enableNotifications();
      if (res === 'granted') { scheduleToday(); toast('Notifications on for today’s prayers'); }
      else if (res === 'unsupported') toast('Add Awqat to your Home Screen first, then try again');
      else toast('Notifications are blocked in your browser settings');
      render(true); break;
    }
    case 'ics': e.preventDefault(); downloadICS(); store.set('icsAt', Date.now()); toast('Open the downloaded file to add the alerts'); break;
    case 'android': { e.preventDefault(); const p = schedule().find((x) => x.key === k); location.href = androidAlarmURL(p); break; }
    case 'compass': startCompass(); break;
    case 'bookmark': store.set('lastRead', { s: +el.dataset.s, a: +el.dataset.a, name: el.dataset.name }); toast('Saved as last read'); break;
    case 'hcol': P.hs.col = v; P.hs.n = 1; P.hs.data = null; render(true); loadHadith(); break;
    case 'hnext': P.hs.n += 1; render(true); loadHadith(); break;
    case 'hprev': P.hs.n = Math.max(1, P.hs.n - 1); render(true); loadHadith(); break;
    case 'hrand': { const c = COLLECTIONS.find((x) => x[0] === P.hs.col); P.hs.n = 1 + Math.floor(Math.random() * c[2]); render(true); loadHadith(); break; }
    case 'dhikr': { const t = store.get('tasbih', { i: 0, n: 0, total: 0 }); t.i = +el.dataset.i; t.n = 0; store.set('tasbih', t); render(true); break; }
    case 'count': {
      const t = store.get('tasbih', { i: 0, n: 0, total: 0, day: '' });
      const today = new Date().toDateString(); if (t.day !== today) { t.total = 0; t.day = today; }
      t.n += 1; t.total += 1;
      const d = DHIKR[t.i % DHIKR.length];
      if (t.n >= d[2]) { t.n = 0; t.i = (t.i + 1) % DHIKR.length; navigator.vibrate && navigator.vibrate([60, 40, 60]); store.set('tasbih', t); render(true); break; }
      navigator.vibrate && navigator.vibrate(12);
      store.set('tasbih', t);
      const n = document.getElementById('tn'); n.textContent = t.n; n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop');
      document.getElementById('tt').textContent = t.total; break;
    }
    case 'treset': store.set('tasbih', { i: 0, n: 0, total: 0, day: new Date().toDateString() }); render(true); break;
    case 'cal': P.cs.off += +el.dataset.d; render(true); break;
    case 'theme': {
      setSetting('theme', v); setSetting('themeAuto', false); homeState.sel = null; render(true);
      if (document.querySelector('.sheet')) openSheet(); break;
    }
    case 'themes': openSheet(); break;
    case 'autotheme': setSetting('themeAuto', !setting('themeAuto')); homeState.sel = null; render(true); toast(setting('themeAuto') ? 'Auto: Sky at Fajr and Maghrib, Paper at Dhuhr, Clay at Asr, Ink & Brass at Isha' : 'Auto theme off'); break;
    case 'closesheet': closeSheet(); break;
    case 'buy': {
      const em = (document.getElementById('payemail') || {}).value || '';
      if (!/^\S+@\S+\.\S+$/.test(em)) { toast('Enter a valid email for your receipt'); break; }
      try { await buyLifetime(em.trim()); toast('Lifetime unlocked. Jazakallahu khairan!'); render(true); } catch (err) { toast(err.message); }
      break;
    }
    case 'restore': {
      const ref = (document.getElementById('payref') || {}).value || '';
      if (!ref.trim()) { toast('Paste your Paystack reference'); break; }
      try { await restore(ref); toast('Lifetime restored'); render(true); } catch (err) { toast(err.message); }
      break;
    }
    case 'start': store.set('onboarded', true); location.hash = '#/'; break;
    case 'gps': getGPS(); break;
    case 'reset': if (confirm('Clear all Awqat data on this phone? Saved times and settings will be removed.')) { Object.keys(localStorage).filter((x) => x.startsWith('awqat:')).forEach((x) => localStorage.removeItem(x)); location.hash = '#/'; location.reload(); } break;
  }
});

document.addEventListener('change', async (e) => {
  const el = e.target, a = el.dataset && el.dataset.act;
  if (!a) return;
  if (a === 'file' && el.files && el.files[0]) {
    if (!canSnap()) { location.hash = '#/pro'; return; }
    recordSnap();
    try {
      P.ps.error = ''; P.ps.failed = false; P.ps.preview = await shrink(el.files[0]);
      P.ps.scanning = true; P.ps.status = 'Reading on your phone…'; render(true);
      const res = await readOnDevice(P.ps.preview, (pr) => { const b = document.querySelector('.badge'); if (b) b.textContent = 'Reading on your phone… ' + Math.round(pr * 100) + '%'; });
      P.ps.scanning = false;
      if (res.salah >= 3) {
        P.ps.pending = { times: res.times, source: 'phone', found: res.salah };
        location.hash = '#/review';
      } else { P.ps.failed = true; render(true); }
    } catch (err) { P.ps.scanning = false; P.ps.failed = true; P.ps.error = err.message || ''; render(true); }
  }
  if (a === 'country') {
    if (el.value === '__gps') return getGPS();
    const [s, lat, lng] = COUNTRIES[el.value][0];
    setSetting('location', { kind: 'state', country: el.value, state: s, label: placeLabel(el.value, s), lat, lng }); afterLocation();
  }
  if (a === 'state') {
    const loc = setting('location'); loc.country = loc.country || 'Nigeria'; const row = COUNTRIES[loc.country].find((x) => x[0] === el.value);
    setSetting('location', { kind: 'state', country: loc.country, state: row[0], label: placeLabel(loc.country, row[0]), lat: row[1], lng: row[2] }); afterLocation();
  }
  if (a === 'method') { setSetting('method', el.value); afterLocation(); }
  if (a === 'madhab') { setSetting('madhab', el.value); afterLocation(); }
  if (a === 'wurl') { store.set('workerUrl', el.value.trim()); cache.news = undefined; cache.vids = undefined; cache.newsReq = false; cache.vidsReq = false; toast(el.value.trim() ? 'Worker link saved' : 'Worker link removed'); render(true); }
  if (a === 'pgo') { const p = Math.min(604, Math.max(1, +el.value || 1)); location.hash = '#/mushaf/' + p; }
  if (a === 'hgo') { const c = COLLECTIONS.find((x) => x[0] === P.hs.col); P.hs.n = Math.min(c[2], Math.max(1, +el.value || 1)); render(true); loadHadith(); }
});

document.addEventListener('input', (e) => {
  const el = e.target, a = el.dataset && el.dataset.act;
  if (a === 'qsearch') {
    cache.q = el.value;
    const list = document.getElementById('slist');
    if (list) list.querySelectorAll('a').forEach((x) => { x.style.display = x.textContent.toLowerCase().includes(cache.q.toLowerCase()) ? '' : 'none'; });
  }
  if (a === 'zak') {
    const z = store.get('zakat', {}); z[el.dataset.k] = el.value; store.set('zakat', z);
    document.getElementById('zres').innerHTML = P.zakatResult(z);
  }
});

function openSheet() {
  closeSheet(true);
  const d = document.createElement('div'); d.id = 'sheetwrap'; d.innerHTML = themeSheet(setting('theme'));
  document.body.appendChild(d);
}
function closeSheet(instant) {
  const w = document.getElementById('sheetwrap'); if (!w) return;
  if (instant) return w.remove();
  w.querySelector('.sheet').style.transition = 'transform .35s'; w.querySelector('.sheet').style.transform = 'translate(-50%,100%)';
  w.querySelector('.sheet-bg').style.opacity = '0'; setTimeout(() => w.remove(), 330);
}
window.addEventListener('hashchange', () => closeSheet(true));

function afterLocation() { scheduleToday(); toast('Prayer times updated for ' + setting('location').label); render(true); }

function getGPS() {
  if (!navigator.geolocation) return toast('Location is not available on this device');
  toast('Finding your location…');
  navigator.geolocation.getCurrentPosition((pos) => {
    const { latitude: lat, longitude: lng } = pos.coords;
    // nearest known state, else "My location"
    let best = null;
    Object.entries(COUNTRIES).forEach(([c, rows]) => rows.forEach(([s, la, ln]) => { const d = (la - lat) ** 2 + (ln - lng) ** 2; if (!best || d < best.d) best = { c, s, d }; }));
    const near = best && best.d < 1.2;
    setSetting('location', { kind: near ? 'state' : 'gps', country: near ? best.c : '', state: near ? best.s : '', label: near ? placeLabel(best.c, best.s) : 'My location', lat, lng });
    afterLocation();
  }, () => toast('Could not get your location. Choose your state instead.'), { enableHighAccuracy: false, timeout: 12000 });
}

// ---------- compass ----------
let compassOn = false;
async function startCompass() {
  const st = document.getElementById('cstatus');
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') { st.textContent = 'Compass permission was not given.'; return; }
    }
  } catch { /* ignore */ }
  if (compassOn) return; compassOn = true;
  const handler = (ev) => {
    let hd = ev.webkitCompassHeading;
    if (hd == null && ev.absolute && ev.alpha != null) hd = 360 - ev.alpha;
    if (hd == null) return;
    const dial = document.getElementById('dial'); if (!dial) return;
    dial.style.transform = 'rotate(' + (-hd) + 'deg)';
    const s = document.getElementById('cstatus'); if (s) s.textContent = 'Turn until the arrow points straight up.';
  };
  window.addEventListener('deviceorientationabsolute', handler);
  window.addEventListener('deviceorientation', handler);
  setTimeout(() => { const s = document.getElementById('cstatus'); if (s && s.textContent.startsWith('Lay')) s.textContent = 'No compass found on this device. Use the degrees shown.'; }, 2500);
}

// ---------- boot ----------
window.addEventListener('hashchange', () => render());
let lastMinute = -1;
setInterval(() => {
  const route = location.hash.slice(1) || '/';
  if (route === '/') liveTick();
  const m = new Date().getMinutes();
  if (m !== lastMinute) {
    const themeChanged = document.documentElement.dataset.theme !== effectiveTheme();
    if (lastMinute !== -1 && ((route === '/' && !homeState.sel) || themeChanged)) render(true);
    else applyTheme();
    lastMinute = m;
  }
}, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { scheduleToday(); render(true); } });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
if (!store.get('onboarded', false) && !location.hash.slice(1).replace('/', '')) location.hash = '#/welcome';
render();
scheduleToday();

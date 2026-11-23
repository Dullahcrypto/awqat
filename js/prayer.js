import { Coordinates, CalculationMethod, PrayerTimes, Madhab, Qibla } from '../vendor/adhan.js';
import { store, setting } from './store.js';

export const PRAYERS = [
  { key: 'fajr', name: 'Fajr', ar: 'الفجر' },
  { key: 'sunrise', name: 'Sunrise', ar: 'الشروق' },
  { key: 'dhuhr', name: 'Dhuhr', ar: 'الظهر' },
  { key: 'asr', name: 'Asr', ar: 'العصر' },
  { key: 'maghrib', name: 'Maghrib', ar: 'المغرب' },
  { key: 'isha', name: 'Isha', ar: 'العشاء' }
];
export const SALAH = PRAYERS.filter((p) => p.key !== 'sunrise');
export const SKY = { fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha', jumuah: 'Dhuhr' };

function params() {
  const m = setting('method');
  const p = (CalculationMethod[m] || CalculationMethod.MuslimWorldLeague)();
  p.madhab = setting('madhab') === 'Hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  return p;
}

export function calc(date = new Date()) {
  const loc = setting('location');
  const pt = new PrayerTimes(new Coordinates(loc.lat, loc.lng), date, params());
  return { fajr: pt.fajr, sunrise: pt.sunrise, dhuhr: pt.dhuhr, asr: pt.asr, maghrib: pt.maghrib, isha: pt.isha };
}

export function qiblaBearing() {
  const loc = setting('location');
  return Qibla(new Coordinates(loc.lat, loc.lng));
}

// ---- Snapped timetables ----
export function snaps() { return store.get('snaps', []); }
export function activeSnap() {
  const id = store.get('activeSnap', null);
  return snaps().find((s) => s.id === id) || null;
}
export function saveSnap(snap) {
  const all = snaps().filter((s) => s.id !== snap.id);
  all.unshift(snap);
  store.set('snaps', all);
  store.set('activeSnap', snap.id);
}
export function deleteSnap(id) {
  store.set('snaps', snaps().filter((s) => s.id !== id));
  if (store.get('activeSnap', null) === id) store.set('activeSnap', null);
}
export function useSnap(id) { store.set('activeSnap', id); }

function at(date, hhmm) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(date); d.setHours(h, m, 0, 0); return d;
}

// The schedule for a day: calculated times, overridden by the active snap.
export function schedule(date = new Date()) {
  const c = calc(date);
  const snap = activeSnap();
  const friday = date.getDay() === 5;
  return PRAYERS.map((p) => {
    let key = p.key, name = p.name, ar = p.ar;
    let s = snap && snap.times ? snap.times[key] : null;
    if (key === 'dhuhr' && friday && snap && snap.times && snap.times.jumuah && (snap.times.jumuah.adhan || snap.times.jumuah.iqama)) {
      s = snap.times.jumuah; name = "Jumu'ah"; ar = 'الجمعة';
    }
    const adhan = (s && at(date, s.adhan)) || c[key];
    const iqama = s ? at(date, s.iqama) : null;
    return { key, name, ar, adhan, iqama, main: iqama || adhan, snapped: !!(s && (s.adhan || s.iqama)) };
  });
}

export function nextPrayer(now = new Date()) {
  const today = schedule(now).filter((p) => p.key !== 'sunrise');
  let n = today.find((p) => p.main > now);
  if (!n) {
    const t = new Date(now); t.setDate(t.getDate() + 1);
    n = schedule(t).find((p) => p.key === 'fajr');
  }
  const prevIdx = today.findIndex((p) => p === n) - 1;
  const prev = prevIdx >= 0 ? today[prevIdx] : null;
  const start = prev ? prev.main : new Date(now.getTime() - 6 * 3600e3);
  const frac = Math.min(1, Math.max(0, (now - start) / (n.main - start)));
  return { ...n, ms: n.main - now, frac };
}

// The prayer whose time we are currently in (drives the Sky colour).
export function currentKey(now = new Date()) {
  const s = schedule(now);
  let cur = 'isha';
  for (const p of s) if (p.adhan <= now) cur = p.key;
  if (now < s[0].adhan) cur = 'isha';
  return cur;
}

export function fmt(d, h24 = setting('clock24')) {
  if (!d) return '—';
  const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
  return h24 ? String(h).padStart(2, '0') + ':' + m : ((h + 11) % 12 + 1) + ':' + m;
}
export function ampm(d) { return d ? (d.getHours() < 12 ? 'AM' : 'PM') : ''; }
export function hhmm(d) { return d ? String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') : ''; }
export function left(ms, withSec = false) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, sec = s % 60;
  if (withSec) return h + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  return h ? h + 'h ' + m + 'm' : m + 'm';
}

// Auto theme: the look follows the time of day.
export const AUTO_MAP = { fajr: 'sky', sunrise: 'sky', dhuhr: 'paper', asr: 'clay', maghrib: 'sky', isha: 'ink' };
export function effectiveTheme(now = new Date()) {
  return setting('themeAuto') ? AUTO_MAP[currentKey(now)] : setting('theme');
}

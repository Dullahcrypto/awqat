import { store } from './store.js';

export const WORKER = () => ((window.AWQAT_CONFIG && window.AWQAT_CONFIG.WORKER_URL) || store.get('workerUrl', '') || '').replace(/\/$/, '');

// fetch JSON with a localStorage cache so things keep working offline
export async function getJSON(url, { ttl = 864e5, key } = {}) {
  const k = 'cache:' + (key || url);
  const c = store.get(k, null);
  if (c && Date.now() - c.t < ttl) return c.v;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.status);
    const v = await r.json();
    try { store.set(k, { t: Date.now(), v }); } catch { /* too big */ }
    return v;
  } catch (e) {
    if (c) return c.v;
    throw e;
  }
}

// ---- Snap: shrink the photo, send to the worker ----
export function shrink(file, max = 1600) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const url = c.toDataURL('image/jpeg', 0.85);
      URL.revokeObjectURL(img.src);
      res(url);
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

export async function scanBoard(dataUrl) {
  const w = WORKER();
  if (!w) throw new Error('The AI reader is not connected yet. Add the worker URL in Settings, or type the times in by hand.');
  const d = new Date();
  const today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const r = await fetch(w + '/scan', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: dataUrl.split(',')[1], mediaType: 'image/jpeg', today })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.times) throw new Error(j.error || 'Could not read that photo. Try again closer, with the whole timetable in frame.');
  return j;
}

// ---- Qur'an (api.alquran.cloud) ----
const Q = 'https://api.alquran.cloud/v1';
export const quran = {
  list: () => getJSON(Q + '/surah', { ttl: 30 * 864e5 }).then((j) => j.data),
  surah: (n) => getJSON(Q + '/surah/' + n + '/editions/quran-uthmani,en.sahih', { ttl: 30 * 864e5 }).then((j) => j.data),
  page: (p) => getJSON(Q + '/page/' + p + '/quran-uthmani', { ttl: 30 * 864e5 }).then((j) => j.data)
};

// ---- Hadith (fawazahmed0/hadith-api on jsDelivr) ----
const H = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/';
export const COLLECTIONS = [
  ['nawawi', 'Forty Hadith of an-Nawawi', 42],
  ['bukhari', 'Sahih al-Bukhari', 7563],
  ['muslim', 'Sahih Muslim', 7470],
  ['abudawud', 'Sunan Abi Dawud', 5274],
  ['tirmidhi', "Jami' at-Tirmidhi", 3956]
];
export async function hadith(col, n) {
  const get = async (ed) => {
    try { return await getJSON(H + ed + '-' + col + '/' + n + '.min.json', { ttl: 365 * 864e5 }); }
    catch { return getJSON(H + ed + '-' + col + '/' + n + '.json', { ttl: 365 * 864e5 }); }
  };
  const [en, ar] = await Promise.all([get('eng'), get('ara').catch(() => null)]);
  const e = en && en.hadiths && en.hadiths[0];
  const a = ar && ar.hadiths && ar.hadiths[0];
  if (!e || !e.text) throw new Error('empty');
  return { n, en: e.text, ar: a ? a.text : '', grade: (e.grades && e.grades[0] && e.grades[0].grade) || '', section: en.metadata && en.metadata.section ? Object.values(en.metadata.section)[0] : '' };
}

// ---- News & videos through the worker ----
export async function news() {
  const w = WORKER(); if (!w) return null;
  return getJSON(w + '/news', { ttl: 15 * 60e3, key: 'news' }).then((j) => j.items || []);
}
export async function videos() {
  const w = WORKER(); if (!w) return null;
  return getJSON(w + '/videos', { ttl: 30 * 60e3, key: 'videos' }).then((j) => j.items || []);
}

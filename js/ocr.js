// Free, on-device reading of prayer timetables with Tesseract (open source).
// Strategy: clean the photo several ways, read each with Tesseract, then match
// times to prayer names by where they sit on the board (same row or same column),
// fixing common misreads. The best of all passes wins.
const TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
let loading = null, worker = null;

function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load the reader. Connect to the internet once; after that it works offline.')); document.head.appendChild(s); });
}
async function getWorker() {
  if (worker) return worker;
  if (!loading) loading = (async () => {
    if (!window.Tesseract) await loadScript(TESS);
    worker = await window.Tesseract.createWorker('eng', 1);
    return worker;
  })();
  return loading;
}

// ---------- image cleaning ----------
function toCanvas(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(3, 2200 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height);
      res(c);
    };
    img.onerror = rej; img.src = src;
  });
}
function grey(c) {
  const x = c.getContext('2d', { willReadFrequently: true });
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data, g = new Uint8ClampedArray(c.width * c.height);
  let sum = 0;
  for (let i = 0, j = 0; i < p.length; i += 4, j++) { const v = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; g[j] = v; sum += v; }
  return { g, w: c.width, h: c.height, mean: sum / g.length };
}
function out(G, data) {
  const c = document.createElement('canvas'); c.width = G.w; c.height = G.h;
  const x = c.getContext('2d'); const im = x.createImageData(G.w, G.h);
  for (let j = 0, i = 0; j < data.length; j++, i += 4) { im.data[i] = im.data[i + 1] = im.data[i + 2] = data[j]; im.data[i + 3] = 255; }
  x.putImageData(im, 0, 0); return c;
}
function contrast(G, invert) {
  const o = new Uint8ClampedArray(G.g.length), hist = new Uint32Array(256);
  G.g.forEach((v) => hist[v]++);
  let lo = 0, hi = 255, acc = 0; const n = G.g.length;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > n * 0.02) { lo = v; break; } }
  acc = 0; for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > n * 0.02) { hi = v; break; } }
  const k = 255 / Math.max(1, hi - lo);
  for (let j = 0; j < o.length; j++) { let v = (G.g[j] - lo) * k; if (invert) v = 255 - v; o[j] = v; }
  return o;
}
// Bradley adaptive threshold: handles glare, shadows and uneven light
function adaptive(G, invert, win = 0.06, t = 0.13) {
  const { g, w, h } = G, W = w + 1, I = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += g[y * w + x]; I[(y + 1) * W + x + 1] = I[y * W + x + 1] + row; } }
  const r = Math.max(8, Math.round(Math.max(w, h) * win / 2)), o = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r), cnt = (x1 - x0 + 1) * (y1 - y0 + 1);
      const s = I[(y1 + 1) * W + x1 + 1] - I[y0 * W + x1 + 1] - I[(y1 + 1) * W + x0] + I[y0 * W + x0];
      const v = g[y * w + x], m = s / cnt;
      o[y * w + x] = (invert ? v > m * (1 + t) : v < m * (1 - t)) ? 0 : 255;
    }
  }
  return o;
}

// ---------- understanding the text ----------
const LABELS = {
  fajr: ['fajr', 'fajar', 'fadjr', 'subh', 'subuh', 'subah', 'sobh', 'asuba', 'asubah', 'dawn'],
  sunrise: ['sunrise', 'shuruq', 'shurooq', 'shorook', 'ishraq', 'shuruk'],
  dhuhr: ['dhuhr', 'duhr', 'zuhr', 'zuhur', 'zohr', 'thuhr', 'dhuhur', 'zuhar', 'azahar', 'azuhur', 'zhuhr', 'dhur', 'zohar', 'noon'],
  asr: ['asr', 'asar', 'aser', 'laasar', 'lasari', 'asir', 'assar'],
  maghrib: ['maghrib', 'magrib', 'maghreb', 'mugrib', 'magariba', 'magrb', 'maghrab', 'sunset'],
  isha: ['isha', 'ishai', 'esha', 'ishaa', 'lisha', 'ishah', 'isya', 'eshaa'],
  jumuah: ['jumuah', 'jumah', 'juma', 'jummah', 'jumaa', 'jumma', 'friday', 'jumaat', 'jumat']
};
function lev(a, b) {
  const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9;
  const d = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
// OCR often reads l as 1/|, o as 0, s as 5 inside words
const deglyph = (s) => s.toLowerCase().replace(/0/g, 'o').replace(/[1|!]/g, 'l').replace(/5/g, 's').replace(/[^a-z]/g, '');
const STOP = new Set(['salah', 'salat', 'salaat', 'prayer', 'prayers', 'adhan', 'azan', 'athan', 'adhaan', 'iqama', 'iqamah', 'iqamat', 'jamaah', 'jamat', 'time', 'times', 'begins', 'start', 'starts', 'date', 'day', 'today', 'mosque', 'masjid']);
export function labelOf(word) {
  const w = deglyph(word); if (w.length < 3 || w.length > 10 || STOP.has(w)) return null;
  let best = null, bd = 9;
  for (const [k, list] of Object.entries(LABELS)) for (const c of list) {
    if (w === c || (w.length >= 5 && c.length >= 4 && w.includes(c))) return k;
    const d = lev(w, c), lim = c.length <= 4 ? 1 : 2;
    if (d <= lim && d < bd) { bd = d; best = k; }
  }
  return best;
}
// normalise one token that might be a time: "5.3O" "l2:52" "0530" "6:08pm"
const DIG = { o: '0', O: '0', D: '0', Q: '0', l: '1', I: '1', '|': '1', i: '1', '!': '1', S: '5', s: '5', B: '8', Z: '2', z: '2', g: '9', q: '9', G: '6', b: '6' };
export function timeOf(tok) {
  if (!tok) return null;
  let t = tok.trim().replace(/[ap]\.?m\.?$/i, '').replace(/^[^\dOolIS|]+|[^\dOolIS|]+$/g, '');
  if (!/\d/.test(t) || t.length > 6) return null;
  t = t.split('').map((c) => DIG[c] || c).join('');
  const m = t.match(/^(\d{1,2})\s*[:.;,'·\-]\s*(\d{2})$/) || t.match(/^(\d)(\d{2})$/) || t.match(/^(0\d)(\d{2})$/);
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  if (h > 23 || mi > 59) return null;
  return [h, mi];
}
const SAL = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
function to24(key, h, m) {
  if (key === 'fajr' || key === 'sunrise') { if (h >= 12) h -= 12; }
  else if (key === 'dhuhr' || key === 'jumuah') { if (h < 10) h += 12; }
  else if (h < 12) h += 12;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
const RANGE = { fajr: [3, 7], sunrise: [5, 8], dhuhr: [11, 15], jumuah: [11, 15], asr: [14, 18], maghrib: [17, 20], isha: [18, 23] };
const ok = (k, s) => { if (!s) return false; const h = +s.slice(0, 2); return h >= RANGE[k][0] && h <= RANGE[k][1]; };

function setTimes(times, k, list) {
  if (times[k]) return;
  const v = list.map(([h, m]) => to24(k, h, m)).filter((s) => ok(k, s));
  if (!v.length) return;
  let [a, b] = v;
  if (b && b < a) [a, b] = [b, a]; // iqama comes after adhan
  times[k] = { adhan: a, iqama: k === 'sunrise' ? '' : (b && b !== a ? b : '') };
}

// Words with boxes: join "5" ":" "30" pieces OCR split apart, split "Fajr5:12"
function tokens(words) {
  const ws = words.filter((w) => w.text && w.text.trim() && w.bbox).map((w) => ({ t: w.text.trim(), x0: w.bbox.x0, x1: w.bbox.x1, y0: w.bbox.y0, y1: w.bbox.y1 }));
  ws.sort((a, b) => (a.y0 - b.y0) || (a.x0 - b.x0));
  const res = [];
  for (let i = 0; i < ws.length; i++) {
    let w = { ...ws[i] };
    for (let k = 1; k <= 2 && i + 1 < ws.length; k++) {
      const n = ws[i + 1], h = w.y1 - w.y0;
      if (Math.abs((n.y0 + n.y1) / 2 - (w.y0 + w.y1) / 2) > h * 0.6 || n.x0 - w.x1 > h * 1.2) break;
      const joined = w.t + n.t;
      if (!timeOf(w.t) && (timeOf(joined) || /^\d{1,2}[:.;,]?$/.test(joined))) { w = { t: joined, x0: w.x0, x1: n.x1, y0: Math.min(w.y0, n.y0), y1: Math.max(w.y1, n.y1) }; i += 1; }
      else break;
    }
    const parts = w.t.match(/[A-Za-z']{3,}|[\dOolIS|]{1,2}\s?[:.;,]\s?[\dOolIS|]{2}|\d{3,4}/g) || [w.t];
    const step = (w.x1 - w.x0) / parts.length;
    parts.forEach((p, j) => res.push({ t: p, x0: w.x0 + j * step, x1: w.x0 + (j + 1) * step, y0: w.y0, y1: w.y1 }));
  }
  return res.map((w) => ({ ...w, cx: (w.x0 + w.x1) / 2, cy: (w.y0 + w.y1) / 2, h: Math.max(4, w.y1 - w.y0), label: labelOf(w.t), time: timeOf(w.t) }));
}

function byGeometry(words) {
  const T = tokens(words);
  const labels = T.filter((w) => w.label), times = T.filter((w) => w.time && !w.label);
  if (!labels.length || !times.length) return {};
  const rowT = {}, colT = {};
  // Row layout: times to the right on the same line
  labels.forEach((L) => {
    const same = times.filter((t) => Math.abs(t.cy - L.cy) < Math.max(L.h, t.h) * 0.75 && t.cx > L.x0).sort((a, b) => a.cx - b.cx);
    if (same.length) setTimes(rowT, L.label, same.slice(0, 2).map((t) => t.time));
  });
  // Column layout: labels side by side in a header, times below each
  const header = labels.filter((L) => labels.filter((M) => Math.abs(M.cy - L.cy) < L.h).length >= 3);
  header.forEach((L) => {
    const w = Math.max(L.x1 - L.x0, L.h * 2);
    const below = times.filter((t) => t.cy > L.cy && Math.abs(t.cx - L.cx) < w * 0.9).sort((a, b) => a.cy - b.cy);
    if (below.length) setTimes(colT, L.label, below.slice(0, 2).map((t) => t.time));
  });
  const n = (o) => SAL.filter((k) => o[k]).length;
  return n(colT) > n(rowT) ? colT : rowT;
}

function byText(text) {
  const times = {};
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  lines.forEach((l, i) => {
    const ws = l.split(/\s+/);
    const labs = ws.map(labelOf).filter(Boolean);
    if (labs.length !== 1) return;
    let ts = ws.map(timeOf).filter(Boolean);
    if (!ts.length && lines[i + 1]) ts = lines[i + 1].split(/\s+/).map(timeOf).filter(Boolean);
    if (ts.length) setTimes(times, labs[0], ts);
  });
  // header row of labels, rows of times below
  lines.forEach((l, i) => {
    const keys = l.split(/\s+/).map(labelOf).filter(Boolean);
    if (keys.length < 3) return;
    const rows = lines.slice(i + 1, i + 4).map((r) => r.split(/\s+/).map(timeOf).filter(Boolean)).filter((r) => r.length >= keys.length - 1);
    keys.forEach((k, j) => { const col = rows.map((r) => r[j]).filter(Boolean); if (col.length) setTimes(times, k, col); });
  });
  return times;
}

export function parse(text, words) {
  const a = words && words.length ? byGeometry(words) : {};
  const times = { ...byText(text || '') };
  Object.keys(a).forEach((k) => { times[k] = a[k]; }); // positions beat raw text order
  return { times, salah: SAL.filter((k) => times[k]).length };
}

function wordsOf(data) {
  if (data.words && data.words.length) return data.words;
  const w = [];
  (data.blocks || []).forEach((b) => (b.paragraphs || []).forEach((p) => (p.lines || []).forEach((l) => (l.words || []).forEach((x) => w.push(x)))));
  return w;
}

// Read several cleaned versions with different page modes; keep the best.
export async function readOnDevice(dataUrl, onProgress = () => {}) {
  onProgress('Loading reader', 0.03);
  const w = await getWorker();
  const base = await toCanvas(dataUrl);
  const G = grey(base);
  const inv = G.mean < 110;
  const variants = [
    ['Cleaning shadows and glare', () => out(G, adaptive(G, inv)), '6'],
    ['Boosting contrast', () => out(G, contrast(G, inv)), '6'],
    ['Looking for scattered text', () => out(G, adaptive(G, inv, 0.1, 0.1)), '11'],
    ['Trying light text on dark', () => out(G, contrast(G, !inv)), '6'],
    ['Reading the original photo', () => base, '4']
  ];
  let best = { times: {}, salah: 0, text: '' };
  const merged = {};
  for (let i = 0; i < variants.length; i++) {
    const [msg, make, psm] = variants[i];
    onProgress(msg, 0.08 + 0.9 * (i / variants.length));
    await w.setParameters({ tessedit_pageseg_mode: psm, preserve_interword_spaces: '1', user_defined_dpi: '300' });
    const { data } = await w.recognize(make().toDataURL('image/png'), {}, { text: true, blocks: true });
    const r = parse(data.text || '', wordsOf(data));
    Object.entries(r.times).forEach(([k, v]) => { if (!merged[k] || (!merged[k].iqama && v.iqama)) merged[k] = v; });
    if (r.salah > best.salah) best = { ...r, text: data.text || '' };
    const full = (o) => SAL.every((k) => o[k] && o[k].iqama);
    if (full(best.times)) break;
    if (i >= 1 && full(merged)) break;
  }
  const mSal = SAL.filter((k) => merged[k]).length;
  if (mSal >= best.salah) best = { times: merged, salah: mSal, text: best.text };
  onProgress('Done', 1);
  return best;
}

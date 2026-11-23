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
    const o = window.AWQAT_TESS || {}; // local testing override
    if (!window.Tesseract) await loadScript(o.script || TESS);
    worker = await window.Tesseract.createWorker('eng', 1, o.script ? { workerPath: o.workerPath, corePath: o.corePath, langPath: o.langPath, gzip: true } : {});
    return worker;
  })();
  return loading;
}

// ---------- image cleaning ----------
function toCanvas(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(3, (window.AWQAT_RES || 2200) / Math.max(img.width, img.height));
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

// Straighten a tilted photo: try small angles, keep the one whose text rows line up best.
function skewAngle(G, inv) {
  const k = Math.max(1, Math.round(Math.max(G.w, G.h) / 500)), w = Math.floor(G.w / k), h = Math.floor(G.h / k);
  const pts = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = G.g[(y * k) * G.w + x * k];
    if (inv ? v > G.mean + 45 : v < G.mean - 45) pts.push(x - w / 2, y - h / 2);
  }
  if (pts.length < 200) return 0;
  let best = 0, bestScore = -1;
  for (let a = -10; a <= 10; a += 0.5) {
    const r = a * Math.PI / 180, sn = Math.sin(r), cs = Math.cos(r), bins = new Float32Array(h * 2);
    for (let i = 0; i < pts.length; i += 2) { const yy = Math.round(-pts[i] * sn + pts[i + 1] * cs + h); if (yy >= 0 && yy < bins.length) bins[yy]++; }
    let sc = 0; for (let i = 1; i < bins.length; i++) { const d = bins[i] - bins[i - 1]; sc += d * d; }
    if (sc > bestScore) { bestScore = sc; best = a; }
  }
  return best;
}
function rotated(c, deg) {
  if (!deg) return c;
  const r = deg * Math.PI / 180, o = document.createElement('canvas'); o.width = c.width; o.height = c.height;
  const x = o.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#808080'; x.fillRect(0, 0, o.width, o.height);
  x.translate(o.width / 2, o.height / 2); x.rotate(-r); x.drawImage(c, -c.width / 2, -c.height / 2);
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
  let t = tok.trim().replace(/[|\])}.,;:'"!]+$/, '').replace(/[ap]\.?m\.?$/i, '').replace(/^[^\dOolIS|]+|[^\dOolIS]+$/g, '');
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

const mins = (s) => +s.slice(0, 2) * 60 + +s.slice(3);
// explicit fields (from column positions)
function setFields(times, k, a, q) {
  if (times[k]) return;
  let A = a ? to24(k, a[0], a[1]) : '', Q = q ? to24(k, q[0], q[1]) : '';
  if (A && !ok(k, A)) A = ''; if (Q && !ok(k, Q)) Q = '';
  if (k === 'sunrise') Q = '';
  if (A && Q && (Q <= A || mins(Q) - mins(A) > (k === 'jumuah' ? 90 : 60))) Q = '';
  if (!A && !Q) return;
  times[k] = { adhan: A, iqama: Q };
}
function setTimes(times, k, list) {
  if (times[k]) return;
  const v = list.map(([h, m]) => to24(k, h, m)).filter((s) => ok(k, s));
  if (!v.length) return;
  let [a, b] = v;
  if (b && b < a) [a, b] = [b, a]; // iqama comes after adhan
  if (b && mins(b) - mins(a) > (k === 'jumuah' ? 90 : 60)) b = ''; // iqama is never long after adhan
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

const ADH = ['adhan', 'azan', 'athan', 'adhaan', 'begins', 'start', 'starts', 'beginning'], IQ = ['iqama', 'iqamah', 'iqamat', 'jamaah', 'jamat', 'jamaat', 'jammat', 'congregation'];
// x position dividing the adhan column from the iqama column (null = one column)
function columnSplit(T, times) {
  const hA = T.find((w) => ADH.includes(deglyph(w.t))), hQ = T.find((w) => IQ.includes(deglyph(w.t)));
  if (hA && hQ && hQ.cx > hA.cx) return (hA.cx + hQ.cx) / 2;
  const xs = times.map((t) => t.cx).sort((a, b) => a - b);
  if (xs.length < 4) return null;
  let gap = 0, at = null;
  for (let i = 1; i < xs.length; i++) if (xs[i] - xs[i - 1] > gap) { gap = xs[i] - xs[i - 1]; at = (xs[i] + xs[i - 1]) / 2; }
  const wid = times.reduce((s, t) => s + (t.x1 - t.x0), 0) / times.length;
  const left = xs.filter((x) => x < at).length, right = xs.length - left;
  return gap > wid * 1.2 && left >= 2 && right >= 2 ? at : null;
}
function byGeometry(words) {
  const T = tokens(words);
  const labels = T.filter((w) => w.label), times = T.filter((w) => w.time && !w.label);
  if (!labels.length || !times.length) return {};
  const rowT = {}, colT = {};
  const split = columnSplit(T, times);
  // Row layout: times to the right on the same line, placed by column
  labels.forEach((L) => {
    const same = times.filter((t) => Math.abs(t.cy - L.cy) < Math.max(L.h, t.h) * 0.75 && t.cx > L.x0).sort((a, b) => a.cx - b.cx);
    if (!same.length) return;
    if (split == null) return setTimes(rowT, L.label, same.slice(0, 2).map((t) => t.time));
    const A = same.find((t) => t.cx < split), Q = same.find((t) => t.cx >= split);
    setFields(rowT, L.label, A && A.time, Q && Q.time);
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

// When names are unreadable: boards list prayers in day order, so map rows of
// times to Fajr → Sunrise → Dhuhr → Asr → Maghrib → Isha → Jumu'ah in sequence.
let PRIOR = null;
const ORDER = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha', 'jumuah'];
function assignInOrder(rows) {
  const times = {}; let p = 0, last = -1;
  for (const row of rows) {
    if (!row.length || (row.cols && !row[0] && !row[1])) continue;
    const vals = row.cols ? row.filter(Boolean) : row;
    for (let i = p; i < ORDER.length; i++) {
      const k = ORDER[i];
      if (k === 'sunrise' && (row.cols ? row[1] : row.length > 1)) continue; // sunrise has one time
      if (k === 'fajr' && vals.length === 1 && vals[0][0] % 12 >= 6 && !(row.cols && !row[0])) continue; // a lone 6:xx is sunrise
      const v = vals.map(([h, m]) => to24(k, h, m));
      if (!ok(k, v[0])) continue;
      if (k !== 'jumuah' && mins(v[0]) <= last) continue;
      if (PRIOR && PRIOR[k] != null && k !== 'jumuah' && Math.abs(mins(v[0]) - PRIOR[k]) > (row.cols && !row[0] ? 80 : 55)) continue;
      if (row.cols) setFields(times, k, row[0], row[1]); else setTimes(times, k, row);
      if (times[k]) { if (k !== 'jumuah') last = mins(times[k].adhan || times[k].iqama); p = i + 1; break; }
    }
  }
  return times;
}
function rowsFromWords(words) {
  const T = tokens(words).filter((w) => w.time && !w.label).sort((a, b) => a.cy - b.cy);
  const rows = [];
  T.forEach((t) => { const r = rows.find((r) => Math.abs(r.cy - t.cy) < t.h * 0.6); if (r) { r.items.push(t); r.cy = (r.cy + t.cy) / 2; } else rows.push({ cy: t.cy, items: [t] }); });
  rows.forEach((r) => r.items.sort((a, b) => a.cx - b.cx));
  // a wide row (4+ times) is a horizontal board: each time is its own prayer
  if (rows.length <= 3 && rows.some((r) => r.items.length >= 4)) {
    const [r1, r2] = rows.filter((r) => r.items.length >= 4);
    return r1.items.map((t, i) => [t.time].concat(r2 && r2.items[i] ? [r2.items[i].time] : []));
  }
  const split = columnSplit(tokens(words), T);
  if (split == null) return rows.map((r) => r.items.slice(0, 2).map((t) => t.time));
  return rows.map((r) => { const A = r.items.find((t) => t.cx < split), Q = r.items.find((t) => t.cx >= split); const out = [A ? A.time : null, Q ? Q.time : null]; out.cols = true; return out; });
}
function byOrder(text, words) {
  if (words && words.length) return assignInOrder(rowsFromWords(words));
  return assignInOrder(text.split(/\n+/).map((l) => l.split(/\s+/).map(timeOf).filter(Boolean).slice(0, 2)));
}

export function parse(text, words) {
  const a = words && words.length ? byGeometry(words) : {};
  const times = { ...byText(text || '') };
  // positions beat raw text order, but keep any field only the text found
  Object.keys(a).forEach((k) => {
    const g = a[k], t = times[k];
    if (!t) { times[k] = g; return; }
    const adhan = g.adhan || t.adhan;
    times[k] = { adhan, iqama: g.iqama || (t.adhan === adhan && t.iqama > adhan ? t.iqama : '') };
  });
  if (SAL.filter((k) => times[k]).length < 5) {
    const o = byOrder(text || '', words);
    if (SAL.filter((k) => o[k]).length > SAL.filter((k) => times[k]).length) Object.keys(o).forEach((k) => { if (!times[k]) times[k] = o[k]; });
  }
  return { times, salah: SAL.filter((k) => times[k]).length };
}

function wordsOf(data) {
  if (data.words && data.words.length) return data.words;
  const w = [];
  (data.blocks || []).forEach((b) => (b.paragraphs || []).forEach((p) => (p.lines || []).forEach((l) => (l.words || []).forEach((x) => w.push(x)))));
  return w;
}

// Read several cleaned versions with different page modes; keep the best.
export async function readOnDevice(dataUrl, onProgress = () => {}, prior = null) {
  onProgress('Loading reader', 0.03);
  PRIOR = prior;
  const w = await getWorker();
  const t0 = Date.now();
  let base = await toCanvas(dataUrl);
  let G = grey(base);
  const inv = G.mean < 110;
  const ang = window.AWQAT_NOSKEW ? 0 : skewAngle(G, inv);
  if (Math.abs(ang) >= 1) { base = rotated(base, ang); G = grey(base); }
  const variants = [
    ['Reading the photo', () => out(G, window.AWQAT_INV1 && inv ? G.g.map((v) => 255 - v) : G.g), '6'],
    ['Cleaning shadows and glare', () => out(G, adaptive(G, inv)), '6'],
    ['Boosting contrast', () => out(G, contrast(G, inv)), '6'],
    ['Trying another way', () => out(G, adaptive(G, inv, 0.12, 0.08)), '4'],
    ['Reading light-on-dark', () => out(G, G.g.map((v) => 255 - v)), '6']
  ];
  const votes = {}; let agree = 0, prev = '', passes = 0;
  const vote = (k, f, v, wgt) => { if (!v) return; votes[k] = votes[k] || { adhan: {}, iqama: {} }; votes[k][f][v] = (votes[k][f][v] || 0) + wgt; };
  for (let i = 0; i < variants.length; i++) {
    const [msg, make, psm] = variants[i];
    onProgress(msg, 0.08 + 0.9 * (i / variants.length));
    await w.setParameters({ tessedit_pageseg_mode: psm, preserve_interword_spaces: '1', user_defined_dpi: '300' });
    const left = 14000 - (Date.now() - t0);
    if (i > 0 && left < 2500) break;
    let timer;
    const data = await Promise.race([
      w.recognize(make().toDataURL('image/png'), {}, { text: true, blocks: true }).then((r) => r.data),
      new Promise((res) => { timer = setTimeout(() => res(null), i === 0 ? 20000 : left); })
    ]);
    clearTimeout(timer);
    if (!data) { try { await w.terminate(); } catch { /* */ } worker = null; loading = null; break; } // too slow: stop with what we have
    passes++;
    const r = parse(data.text || '', wordsOf(data));
    const wgt = 1 + r.salah / 5; // passes that found more prayers count a little more
    Object.entries(r.times).forEach(([k, v]) => { vote(k, 'adhan', v.adhan, wgt); vote(k, 'iqama', v.iqama, wgt); });
    const sig = JSON.stringify(r.times);
    if (r.salah === 5 && sig === prev) agree++;
    prev = sig;
    if (agree >= 1 && i >= 1) break; // two passes read exactly the same full board
    if (i === 0 && SAL.every((k) => r.times[k] && r.times[k].adhan && r.times[k].iqama)) break; // first read got the whole board
  }
  const pick = (o) => { const e = Object.entries(o || {}); if (!e.length) return ''; e.sort((x, y) => y[1] - x[1]); return e[0][0]; };
  const times = {};
  Object.keys(votes).forEach((k) => { const a = pick(votes[k].adhan); let q = k === 'sunrise' ? '' : pick(votes[k].iqama); if (a && q && q <= a) q = ''; if (a || q) times[k] = { adhan: a, iqama: q }; });
  const tally = (v) => [...Object.values(v.adhan), ...Object.values(v.iqama)].reduce((x, y) => x + y, 0);
  // day order must hold: Fajr < Sunrise < Dhuhr < Asr < Maghrib < Isha
  const seq = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
  for (let i = 0; i < seq.length; i++) for (let j = i + 1; j < seq.length; j++) {
    const A = times[seq[i]], B = times[seq[j]];
    if (A && B && (A.adhan || A.iqama) >= (B.adhan || B.iqama)) delete times[seq[i] === 'fajr' && seq[j] === 'sunrise' ? 'fajr' : (tally(votes[seq[i]]) < tally(votes[seq[j]]) ? seq[i] : seq[j])];
  }
  // compare with the calculated times for this location: a mosque adhan is never far from them
  if (prior) Object.keys(times).forEach((k) => {
    const c = prior[k]; if (c == null || k === 'jumuah') return;
    const T = times[k];
    if (T.adhan && Math.abs(mins(T.adhan) - c) > 55) T.adhan = '';
    if (T.iqama && (mins(T.iqama) < c - 10 || mins(T.iqama) > c + 80)) T.iqama = '';
    if (!T.adhan && !T.iqama) delete times[k];
  });
  // how sure are we? a time seen in only one pass gets flagged for checking
  const need = passes > 1 ? 2.2 : 0; // one clean full read is trusted
  const low = Object.keys(times).filter((k) => (!times[k].adhan && k !== 'sunrise') || (votes[k].adhan[times[k].adhan] || 0) < need || (times[k].iqama && (votes[k].iqama[times[k].iqama] || 0) < need));
  const best = { times, low: low.filter((k) => times[k]), salah: SAL.filter((k) => times[k]).length };
  onProgress('Done', 1);
  return best;
}

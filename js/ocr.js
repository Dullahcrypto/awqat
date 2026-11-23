// Free, on-device reading of prayer timetables with Tesseract (open source).
// The engine (~3 MB) and English data load the first time, then stay cached on the phone.
const TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
let loading = null, worker = null;

function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load the on-phone reader. Check your connection once; after that it works offline.')); document.head.appendChild(s); });
}
async function getWorker(onProgress) {
  if (worker) return worker;
  if (!loading) loading = (async () => {
    if (!window.Tesseract) await loadScript(TESS);
    worker = await window.Tesseract.createWorker('eng', 1, { logger: (m) => onProgress && m.status === 'recognizing text' && onProgress(m.progress) });
    await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
    return worker;
  })();
  return loading;
}

// Grey, high-contrast, larger copy of the photo: OCR reads boards much better this way.
function prep(dataUrl) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(2, 2000 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = img.width * s; c.height = img.height * s;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height);
      const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
      let sum = 0;
      for (let i = 0; i < p.length; i += 4) { const g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; p[i] = g; sum += g; }
      const mean = sum / (p.length / 4);
      const dark = mean < 110; // light text on a dark/LED board → invert
      for (let i = 0; i < p.length; i += 4) {
        let g = p[i]; if (dark) g = 255 - g;
        g = Math.max(0, Math.min(255, (g - 128) * 1.6 + 128));
        p[i] = p[i + 1] = p[i + 2] = g;
      }
      x.putImageData(d, 0, 0); res(c.toDataURL('image/png'));
    };
    img.src = dataUrl;
  });
}

const LABELS = [
  ['fajr', /\b(fajr|fajar|fadjr|subh|sub[ae]h|sobh|asuba|asubah|dawn)\b/i],
  ['sunrise', /\b(sunrise|shuruq|shurooq|sh[uo]rook|ishraq|rise)\b/i],
  ['jumuah', /\b(jum[ua]'?a?h?|jumm?ah|juma|friday|jumu.?ah)\b/i],
  ['dhuhr', /\b(dhuhr|duhr|zuhr|zuhur|zohr|thuhr|dhuhur|zuhar|zawal|noon|azahar|azuhur)\b/i],
  ['asr', /\b(asr|asar|aser|la'?asar|lasari)\b/i],
  ['maghrib', /\b(maghrib|magrib|maghreb|mugrib|sunset)\b/i],
  ['isha', /\b(isha|ishai|esha|ishaa|isha'?a|lisha)\b/i]
];
const TIME = /(\d{1,2})\s?[:.;,]\s?(\d{2})(?!\d)/g;

function to24(key, h, m) {
  if (h > 23 || m > 59) return '';
  if (key === 'fajr' || key === 'sunrise') { if (h >= 12) h -= 12; }
  else if (key === 'dhuhr' || key === 'jumuah') { if (h < 10) h += 12; }
  else if (h < 12) h += 12;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
const plausible = { fajr: [3, 7], sunrise: [5, 8], dhuhr: [11, 15], jumuah: [11, 15], asr: [14, 18], maghrib: [17, 20], isha: [18, 23] };
function ok(key, hhmm) { if (!hhmm) return false; const h = +hhmm.slice(0, 2); const [a, b] = plausible[key]; return h >= a && h <= b; }

export function parse(text) {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const times = {};
  const put = (key, list) => {
    if (times[key] && (times[key].adhan || times[key].iqama)) return;
    const [a, b] = list.map(([h, m]) => to24(key, h, m));
    times[key] = { adhan: ok(key, a) ? a : '', iqama: key !== 'sunrise' && ok(key, b) ? b : '' };
  };
  const labelOf = (l) => (LABELS.find(([, re]) => re.test(l)) || [])[0];
  const timesOf = (l) => [...l.matchAll(TIME)].map((m) => [+m[1], +m[2]]);

  // Rows: "Fajr 5:12 5:35"
  lines.forEach((l, i) => {
    const k = labelOf(l); if (!k) return;
    if (LABELS.filter(([, re]) => re.test(l)).length >= 3) return; // a header row, handled below
    let t = timesOf(l);
    if (!t.length && lines[i + 1] && !labelOf(lines[i + 1])) t = timesOf(lines[i + 1]); // label on its own line
    if (t.length) put(k, t);
  });

  // Columns: a header line with several labels, then lines of times in the same order
  const found = () => Object.values(times).filter((x) => x.adhan || x.iqama).length;
  if (found() < 4) {
    lines.forEach((l, i) => {
      const keys = LABELS.map(([k, re]) => [k, l.search(re)]).filter(([, p]) => p >= 0).sort((a, b) => a[1] - b[1]).map(([k]) => k);
      if (keys.length < 3) return;
      const rows = lines.slice(i + 1, i + 4).map(timesOf).filter((r) => r.length >= keys.length - 1);
      keys.forEach((k, j) => { const col = rows.map((r) => r[j]).filter(Boolean); if (col.length) put(k, col); });
    });
  }
  Object.keys(times).forEach((k) => { if (!times[k].adhan && !times[k].iqama) delete times[k]; });
  const salah = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].filter((k) => times[k]).length;
  return { times, salah };
}

export async function readOnDevice(dataUrl, onProgress) {
  const w = await getWorker(onProgress);
  const img = await prep(dataUrl);
  const { data } = await w.recognize(img);
  const r = parse(data.text || '');
  return { ...r, text: data.text || '' };
}

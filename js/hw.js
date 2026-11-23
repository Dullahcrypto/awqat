// Awqat handwriting digit reader: a small neural network trained on many
// handwriting styles plus real handwritten digits (MNIST). Classes: 0-9, 10 = not a digit.
let NET = null, loading = null;

// mask: Uint8Array (1 = ink), w, h → 28×28 Float32 (digit fitted in 20×20, centred)
export function normalize(mask, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const out = new Float32Array(784);
  if (x1 < 0) return out;
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, s = 20 / Math.max(bw, bh);
  const tw = Math.max(1, Math.round(bw * s)), th = Math.max(1, Math.round(bh * s));
  const ox = Math.floor((28 - tw) / 2), oy = Math.floor((28 - th) / 2);
  for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
    // area-average the source pixels that fall in this target pixel
    const sx0 = x0 + tx / s, sx1 = x0 + (tx + 1) / s, sy0 = y0 + ty / s, sy1 = y0 + (ty + 1) / s;
    let sum = 0, cnt = 0;
    for (let yy = Math.floor(sy0); yy < Math.max(Math.floor(sy0) + 1, Math.ceil(sy1)); yy++) for (let xx = Math.floor(sx0); xx < Math.max(Math.floor(sx0) + 1, Math.ceil(sx1)); xx++) {
      if (xx >= 0 && yy >= 0 && xx < w && yy < h) { sum += mask[yy * w + xx]; cnt++; }
    }
    out[(oy + ty) * 28 + ox + tx] = cnt ? sum / cnt : 0;
  }
  return out;
}

function b64f32(s) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new Float32Array(u.buffer); }
function deq(s, sc) { const b = atob(s), f = new Float32Array(b.length); for (let i = 0; i < b.length; i++) { const v = b.charCodeAt(i); f[i] = (v > 127 ? v - 256 : v) * sc; } return f; }
export async function loadNet(url) {
  if (NET) return NET;
  if (!loading) loading = fetch(url).then((r) => r.json()).then((j) => { NET = {}; Object.entries(j).forEach(([k, v]) => { NET[k] = { shape: v.shape, data: v.q ? deq(v.q, v.scale) : b64f32(v.data) }; }); return NET; });
  return loading;
}
export function setNet(n) { NET = n; }

// conv 3×3 same padding; weights [3,3,cin,cout]
function conv(inp, H, W, C, k, b, CO) {
  const out = new Float32Array(H * W * CO);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let o = 0; o < CO; o++) {
    let s = b[o];
    for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue;
      for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= W) continue;
        const ib = (yy * W + xx) * C, kb = ((dy + 1) * 3 + (dx + 1)) * C * CO;
        for (let c = 0; c < C; c++) s += inp[ib + c] * k[kb + c * CO + o]; } }
    out[(y * W + x) * CO + o] = s > 0 ? s : 0;
  }
  return out;
}
function pool(inp, H, W, C) {
  const h = H >> 1, w = W >> 1, out = new Float32Array(h * w * C);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < C; c++) {
    const a = inp[((2 * y) * W + 2 * x) * C + c], b = inp[((2 * y) * W + 2 * x + 1) * C + c], d = inp[((2 * y + 1) * W + 2 * x) * C + c], e = inp[((2 * y + 1) * W + 2 * x + 1) * C + c];
    out[(y * w + x) * C + c] = Math.max(a, b, d, e);
  }
  return out;
}
function dense(inp, k, b, n, relu) {
  const m = inp.length, out = new Float32Array(n);
  for (let o = 0; o < n; o++) { let s = b[o]; for (let i = 0; i < m; i++) s += inp[i] * k[i * n + o]; out[o] = relu && s < 0 ? 0 : s; }
  return out;
}
// returns probabilities for 11 classes
export function classify(img28) {
  const N = NET;
  const c1 = N.c1k.shape[3], c2 = N.c2k.shape[3];
  let a = conv(img28, 28, 28, 1, N.c1k.data, N.c1b.data, c1); a = pool(a, 28, 28, c1);
  a = conv(a, 14, 14, c1, N.c2k.data, N.c2b.data, c2); a = pool(a, 14, 14, c2);
  a = dense(a, N.d1k.data, N.d1b.data, N.d1b.shape[0], true);
  const z = dense(a, N.d2k.data, N.d2b.data, N.d2b.shape[0], false);
  const mx = Math.max(...z); let s = 0; const p = z.map((v) => { const e = Math.exp(v - mx); s += e; return e; });
  return p.map((v) => v / s);
}

// ---------- find handwritten times on a binarised board ----------
// ink: Uint8Array (1 = ink), w, h → [{ text, bbox:{x0,y0,x1,y1} }] for things that look like times
export function readTimes(ink, w, h) {
  // 1. connected components (8-neighbour)
  const lab = new Int32Array(w * h), comps = [];
  const stack = new Int32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!ink[i] || lab[i]) continue;
    const id = comps.length + 1; let sp = 0; stack[sp++] = i; lab[i] = id;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, area = 0;
    while (sp) {
      const p = stack[--sp], px = p % w, py = (p - px) / w; area++;
      if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = px + dx, ny = py + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx; if (ink[q] && !lab[q]) { lab[q] = id; stack[sp++] = q; }
      }
    }
    comps.push({ id, x0, y0, x1, y1, area, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  if (!comps.length) return [];
  // 2. typical character height = median height of mid-sized blobs
  const hs = comps.filter((c) => c.area > 30 && c.h > 8 && c.h < h * 0.2 && c.w < w * 0.2).map((c) => c.h).sort((a, b) => a - b);
  if (!hs.length) return [];
  const H = hs[Math.floor(hs.length * 0.6)];
  const big = comps.filter((c) => c.h > H * 0.55 && c.h < H * 2.2 && c.w < H * 4);
  const dots = comps.filter((c) => c.h <= H * 0.55 && c.w <= H * 0.55 && c.area > 2 && c.h >= H * 0.06);
  if (typeof window !== 'undefined' && window.HWDBG) window.HWBOX = { big: big.map((c) => [c.x0, c.y0, c.x1, c.y1]), dots: dots.map((c) => [c.x0, c.y0, c.x1, c.y1]), H };
  // 3. group big blobs into words: same line, small horizontal gap
  big.sort((a, b) => a.x0 - b.x0);
  const parent = big.map((_, i) => i), find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < big.length; i++) for (let j = i + 1; j < big.length; j++) {
    const a = big[i], b = big[j];
    if (b.x0 - a.x1 > H * 0.85) continue;
    const ov = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    if (ov > Math.min(a.h, b.h) * 0.35) parent[find(j)] = find(i);
  }
  const groups = {};
  big.forEach((c, i) => { (groups[find(i)] = groups[find(i)] || []).push(c); });
  // all ink of a word (digits + dots) as one small image
  // first try: one blob = one character (works when characters don't touch)
  const crop = (c, xa, xb) => {
    const cw = xb - xa + 1, m = new Uint8Array(cw * c.h);
    for (let y = 0; y < c.h; y++) for (let x = 0; x < cw; x++) { const q = (c.y0 + y) * w + xa + x; if (lab[q] === c.id) m[y * cw + x] = 1; }
    return { m, cw };
  };
  const read = (c, xa, xb) => { const { m, cw } = crop(c, xa, xb); const p = classify(normalize(m, cw, c.h)); let k = 0; for (let i = 1; i < 10; i++) if (p[i] > p[k]) k = i; return p[10] > 0.85 ? { k: 10, p: p[10] } : { k, p: p[k] }; };
  const byBlobs = (g, gx0, gy0, gx1, gy1) => {
    if (g.length < 2) return null;
    const gs = g.slice().sort((a, b) => a.x0 - b.x0), chars = [];
    for (const c of gs) {
      const n = c.w > c.h * 1.25 ? Math.min(3, Math.round(c.w / (c.h * 0.7))) : 1; // touching digits
      if (n <= 1) { const r = read(c, c.x0, c.x1); chars.push({ x: (c.x0 + c.x1) / 2, ch: r.k < 10 && r.p > 0.45 ? String(r.k) : '?' }); continue; }
      const col = new Array(c.w).fill(0);
      for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) if (lab[y * w + x] === c.id) col[x - c.x0]++;
      const cuts = [];
      for (let k = 1; k < n; k++) { const tt = Math.round(c.w * k / n), rr = Math.round(c.w * 0.18); let bi = tt, bv = 1e9; for (let x = Math.max(1, tt - rr); x < Math.min(c.w - 1, tt + rr); x++) if (col[x] < bv) { bv = col[x]; bi = x; } cuts.push(bi); }
      const xs = [0, ...cuts, c.w];
      for (let k = 0; k < n; k++) { const r = read(c, c.x0 + xs[k], c.x0 + xs[k + 1] - 1); chars.push({ x: c.x0 + (xs[k] + xs[k + 1]) / 2, ch: r.k < 10 && r.p > 0.45 ? String(r.k) : '?' }); }
    }
    const seps = dots.filter((d) => d.x0 > gx0 - H * 0.2 && d.x1 < gx1 + H * 0.2 && d.y0 >= gy0 - H * 0.3 && d.y1 <= gy1 + H * 0.3);
    const used = new Set();
    seps.forEach((d) => {
      if (used.has(d)) return;
      const pair = seps.find((e) => e !== d && !used.has(e) && Math.abs((e.x0 + e.x1) / 2 - (d.x0 + d.x1) / 2) < H * 0.35 && Math.abs(e.y0 - d.y0) > H * 0.2);
      if (pair) { used.add(d); used.add(pair); chars.push({ x: (d.x0 + d.x1 + pair.x0 + pair.x1) / 4, ch: ':' }); }
      else if (d.y0 > gy0 + (gy1 - gy0) * 0.55) { used.add(d); chars.push({ x: (d.x0 + d.x1) / 2, ch: ':' }); }
    });
    chars.sort((a, b) => a.x - b.x);
    const s = chars.map((c) => c.ch).join('').replace(/^\?+|\?+$/g, '');
    if (/^\d{1,2}:\d{2}$/.test(s)) return s;
    if (/^\d{3,4}$/.test(s)) return s.slice(0, -2) + ':' + s.slice(-2);
    return null;
  };
  const out = [], t0 = Date.now();
  // biggest-looking time candidates first, and never more than ~2.5 s of work
  Object.values(groups).filter((g) => g.length <= 8).sort((a, b) => b.length - a.length).slice(0, 60).forEach((g) => {
    if (Date.now() - t0 > 2500) return;
    let gx0 = Math.min(...g.map((c) => c.x0)), gx1 = Math.max(...g.map((c) => c.x1));
    const gy0 = Math.min(...g.map((c) => c.y0)), gy1 = Math.max(...g.map((c) => c.y1));
    if (gx1 - gx0 < H * 1.2) return; // too short to be a time
    const ids = new Set(g.map((c) => c.id));
    dots.forEach((d) => { if (d.x0 > gx0 - H * 0.3 && d.x1 < gx1 + H * 0.3 && d.y0 >= gy0 - H * 0.2 && d.y1 <= gy1 + H * 0.2) { ids.add(d.id); gx0 = Math.min(gx0, d.x0); gx1 = Math.max(gx1, d.x1); } });
    let t = byBlobs(g, gx0, gy0, gx1, gy1);
    if (!t) {
      const W = gx1 - gx0 + 1, Hh = gy1 - gy0 + 1, m = new Uint8Array(W * Hh), col = new Float32Array(W);
      for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) if (ids.has(lab[(gy0 + y) * w + gx0 + x])) { m[y * W + x] = 1; col[x]++; }
      t = readWord(m, W, Hh, col, H);
    }
    if (typeof window !== 'undefined' && window.HWDBG) window.HWDBG.push((t || '·') + '[' + g.length + ']');
    if (t) out.push({ text: t, bbox: { x0: gx0, y0: gy0, x1: gx1, y1: gy1 } });
  });
  return out;
}

// Read one handwritten time by trying cut points and keeping the best valid reading.
const PATTERNS = [['d', 'd', ':', 'd', 'd'], ['d', ':', 'd', 'd'], ['d', 'd', '.', 'd', 'd'], ['d', '.', 'd', 'd'], ['d', 'd', 'd', 'd'], ['d', 'd', 'd']];
function readWord(m, W, Hh, col, H) {
  // candidate cuts: blank columns and low valleys in the ink profile
  const mx = Math.max(...col), cuts = [0];
  for (let x = 1; x < W - 1; x++) {
    const v = col[x];
    if (v === 0 && col[x - 1] > 0) cuts.push(x);
    else if (v === 0 && col[x + 1] > 0) cuts.push(x + 1);
    else if (v > 0 && v <= col[x - 1] && v <= col[x + 1] && v < mx * 0.35) cuts.push(x);
  }
  cuts.push(W);
  const C = [];
  cuts.sort((a, b) => a - b).forEach((c) => { if (!C.length || c - C[C.length - 1] >= Math.max(2, H * 0.08)) C.push(c); else C[C.length - 1] = Math.round((C[C.length - 1] + c) / 2); });
  if (C[C.length - 1] !== W) C.push(W);
  const n = C.length, cache = new Map();
  // what is the piece between cut i and cut j?
  const piece = (i, j) => {
    const key = i * 100 + j; if (cache.has(key)) return cache.get(key);
    const xa = C[i], xb = C[j], pw = xb - xa;
    let y0 = Hh, y1 = -1, ink = 0;
    for (let y = 0; y < Hh; y++) for (let x = xa; x < xb; x++) if (m[y * W + x]) { ink++; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    let r = { d: null, sep: 0, dot: 0, blank: ink === 0 };
    if (ink && pw >= H * 0.1 && pw <= H * 1.5) {
      const ih = y1 - y0 + 1;
      if (ih < H * 0.55 && pw < H * 0.55) {
        // small marks: two stacked = colon, one low = dot
        let rows = 0, prev = false, runs = 0;
        for (let y = y0; y <= y1; y++) { let any = false; for (let x = xa; x < xb; x++) if (m[y * W + x]) { any = true; break; } if (any && !prev) runs++; prev = any; rows += any; }
        if (runs >= 2) r.sep = 0.9; else if (y0 > Hh * 0.45) r.dot = 0.8; else r.sep = 0.25;
      } else if (ih >= H * 0.5) {
        const sub = new Uint8Array(pw * Hh);
        for (let y = 0; y < Hh; y++) for (let x = 0; x < pw; x++) sub[y * pw + x] = m[y * W + xa + x];
        const p = classify(normalize(sub, pw, Hh));
        r.d = p;
      }
    }
    cache.set(key, r); return r;
  };
  const L = (v) => Math.log(Math.max(v, 1e-4));
  let best = null;
  for (const P of PATTERNS) {
    // dp[t][i] = best score having matched P[0..t) ending at cut i
    const dp = Array.from({ length: P.length + 1 }, () => new Float64Array(n).fill(-Infinity)), bk = Array.from({ length: P.length + 1 }, () => new Int32Array(n).fill(-1)), lbl = Array.from({ length: P.length + 1 }, () => new Int8Array(n));
    dp[0][0] = 0;
    for (let i = 1; i < n; i++) if (piece(0, i).blank || (C[i] < H * 0.4)) dp[0][i] = L(0.3); // allow a little leading junk
    for (let t = 0; t < P.length; t++) for (let i = 0; i < n; i++) {
      if (dp[t][i] === -Infinity) continue;
      for (let j = i + 1; j < n && j <= i + 5; j++) {
        const pc = piece(i, j); let sc = -Infinity, lb = -1;
        if (P[t] === 'd' && pc.d) { for (let k = 0; k < 10; k++) if (L(pc.d[k]) > sc) { sc = L(pc.d[k]); lb = k; } sc += L(1 - pc.d[10] * 0.7); }
        else if (P[t] === ':' && pc.sep) { sc = L(pc.sep); lb = 10; }
        else if (P[t] === '.' && pc.dot) { sc = L(pc.dot); lb = 11; }
        if (sc === -Infinity) continue;
        const v = dp[t][i] + sc;
        if (v > dp[t + 1][j]) { dp[t + 1][j] = v; bk[t + 1][j] = i; lbl[t + 1][j] = lb; }
      }
    }
    // allow a little trailing junk
    let endScore = -Infinity, endAt = -1;
    for (let i = 1; i < n; i++) { if (dp[P.length][i] === -Infinity) continue; const tail = i === n - 1 ? 0 : (C[n - 1] - C[i] < H * 0.4 || piece(i, n - 1).blank ? L(0.3) : -Infinity); if (dp[P.length][i] + tail > endScore) { endScore = dp[P.length][i] + tail; endAt = i; } }
    if (endAt < 0) continue;
    let s = '', i = endAt;
    for (let t = P.length; t > 0; t--) { const lb = lbl[t][i]; s = (lb === 10 ? ':' : lb === 11 ? '.' : String(lb)) + s; i = bk[t][i]; }
    const avg = endScore / P.length;
    if (!best || avg > best.avg) best = { s, avg };
  }
  if (!best || best.avg < Math.log(window.HWTH || 0.7)) return null;
  const d = best.s.replace(/[:.]/g, '');
  return d.slice(0, d.length - 2) + ':' + d.slice(-2);
}

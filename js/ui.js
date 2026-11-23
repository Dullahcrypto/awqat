// Small UI helpers and icons
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const sv = (d, w = 22, extra = '') => `<svg aria-hidden="true" width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
export const I = {
  camera: (w) => sv('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', w),
  scan: (w) => sv('<path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3"/><circle cx="12" cy="12" r="3"/>', w),
  back: (w) => sv('<path d="M15 5l-7 7 7 7"/>', w),
  close: (w) => sv('<path d="M6 6l12 12M18 6L6 18"/>', w),
  compass: (w) => sv('<circle cx="12" cy="12" r="9"/><path d="M15 9l-2 5-4 1 2-5z"/>', w),
  book: (w) => sv('<path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 6v14"/>', w),
  gallery: (w) => sv('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/>', w),
  play: (w = 16) => `<svg aria-hidden="true" width="${w}" height="${w}" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z"/></svg>`,
  bell: (w) => sv('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>', w),
  gear: (w) => sv('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>', w),
  chev: (w = 18) => sv('<path d="M9 5l7 7-7 7"/>', w),
  shuffle: (w) => sv('<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>', w),
  loc: (w) => sv('<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>', w),
  palette: (w) => sv('<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-.5-.2-.8-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4-4-7.4-9-7.4z"/><circle cx="7.5" cy="11.5" r="1.2"/><circle cx="10.5" cy="7.5" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>', w),
  ext: (w = 16) => sv('<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>', w)
};

let tt;
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2600);
}

export const backbar = (title, href = '#/') => `<div class="back"><a class="iconbtn" href="${href}" aria-label="Back">${I.back(20)}</a><h1 class="h2" style="margin:0">${esc(title)}</h1></div>`;

export function hijri(d = new Date(), lang = 'en') {
  try {
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-islamic-umalqura' : 'en-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(d).replace(/ AH$/, '');
  } catch { return ''; }
}
export function hijriParts(d) {
  try {
    const p = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(d);
    const g = (t) => +(p.find((x) => x.type === t) || {}).value;
    return { day: g('day'), month: g('month'), year: g('year') };
  } catch { return { day: 0, month: 0, year: 0 }; }
}
export const gdate = (d = new Date()) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' });

export const THEME_LIST = [
  { k: 'sky', n: 'Sky', d: 'Colour follows the prayer', bg: '#F2E7C9', ink: '#24301F', ac: '#FFE7B0', f: "'Young Serif',serif", b: "'Outfit',sans-serif", ar: 'الظهر', alt: ['#2C3163', '#E7BF8B', '#C2553C', '#121729'] },
  { k: 'clay', n: 'Clay', d: 'Mihrab arch, warm sand', bg: '#EEE3D0', ink: '#2A1F1A', ac: '#B4532F', f: "'Gloock',serif", b: "'Figtree',sans-serif", ar: 'الظهر' },
  { k: 'ink', n: 'Ink & Brass', d: 'Night navy, live ring', bg: '#0F1522', ink: '#EDE6D6', ac: '#D2A65A', f: "'Cormorant Garamond',serif", b: "'IBM Plex Sans',sans-serif", ar: 'الظهر' },
  { k: 'paper', n: 'Paper', d: 'Black and white, one green', bg: '#F4F2EC', ink: '#111111', ac: '#1E6B4F', f: "'Bricolage Grotesque',sans-serif", b: "'Bricolage Grotesque',sans-serif", ar: 'الظهر' }
];
export const ALL_FONTS = 'https://fonts.googleapis.com/css2?family=Young+Serif&family=Outfit:wght@400;600&family=Gloock&family=Figtree:wght@400;600&family=Cormorant+Garamond:wght@600&family=IBM+Plex+Sans:wght@400;600&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&display=swap';
export function loadAllFonts() {
  if (document.getElementById('all-fonts')) return;
  const l = document.createElement('link'); l.id = 'all-fonts'; l.rel = 'stylesheet'; l.href = ALL_FONTS; document.head.appendChild(l);
}
export function themeCards(current) {
  loadAllFonts();
  return THEME_LIST.map((t, i) => {
    const arch = t.k === 'clay' ? 'border-radius:60px 60px 8px 8px;' : '';
    const time = t.k === 'paper' ? `<span style="font-family:${t.f};font-weight:800;letter-spacing:-.06em;font-size:40px;line-height:.9">13:30</span>` : `<span style="font-family:${t.f};font-size:38px;line-height:1;${t.k === 'ink' ? 'font-weight:600' : ''}">1:30</span>`;
    const deco = t.k === 'sky' ? `<span style="display:flex;gap:4px">${[t.bg].concat(t.alt).map((c) => `<i style="width:12px;height:12px;border-radius:6px;background:${c};border:1px solid rgba(0,0,0,.12)"></i>`).join('')}</span>`
      : t.k === 'ink' ? `<span style="width:46px;height:46px;border-radius:50%;border:3px solid #232C40;border-top-color:${t.ac};border-right-color:${t.ac}"></span>`
      : t.k === 'paper' ? `<span style="height:2px;width:100%;background:${t.ink};position:relative"><i style="position:absolute;left:46%;top:-5px;width:12px;height:12px;border-radius:6px;background:${t.ac}"></i></span>`
      : `<span style="width:54px;height:60px;${arch}background:${t.ac}"></span>`;
    const on = current === t.k;
    return `<button class="tcard rise" style="--i:${i};background:${t.bg};color:${t.ink};${on ? 'box-shadow:0 0 0 3px ' + t.ac + ',0 0 0 5px ' + t.bg : ''}" data-act="theme" data-v="${t.k}" aria-pressed="${on}">
      <span style="display:flex;justify-content:space-between;align-items:flex-start;width:100%">${deco}${on ? `<span style="font:600 11px ${t.b};padding:4px 8px;border-radius:10px;background:${t.ac};color:${t.k === 'sky' ? t.ink : t.bg}">ON</span>` : ''}</span>
      ${time}
      <span style="display:flex;flex-direction:column;gap:1px;text-align:left"><span style="font:600 15px ${t.b}">${t.n}</span><span style="font:400 12px ${t.b};opacity:.7">${t.d}</span></span>
    </button>`;
  }).join('');
}
export function themeSheet(current) {
  return `<div class="sheet-bg" data-act="closesheet"></div><div class="sheet" role="dialog" aria-label="Choose a look"><div class="grab"></div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><span class="h2">Choose a look</span><button class="iconbtn" data-act="closesheet" aria-label="Close">${I.close(18)}</button></div>
  <div class="tgrid">${themeCards(current)}</div></div>`;
}

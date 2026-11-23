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

const fi = (d) => `<svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const FEATURES = [
  { g: 'Read', items: [
    ['#/quran', "Qur'an", '#1F6B4F', fi('<path d="M4 5.5c2.7-.9 5.4-.8 8 1 2.6-1.8 5.3-1.9 8-1V19c-2.7-.9-5.4-.8-8 1-2.6-1.8-5.3-1.9-8-1z"/><path d="M12 6.5V20"/><path d="M7 9.5h2.5M14.5 9.5H17"/>')],
    ['#/hadith', 'Hadith', '#9A6B1F', fi('<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v3h3"/><path d="M9 11h6M9 14.5h6M9 18h3.5"/>')],
    ['#/sirah', 'Sirah', '#B4532F', fi('<path d="M3 20h18"/><path d="M5 20V10l3-3 3 3v10"/><path d="M13 20v-7a3 3 0 0 1 6 0v7"/><path d="M8 3v4"/>')],
    ['#/duas', 'Duas', '#3E5BA9', fi('<path d="M8 21v-5.5L5.5 12a2 2 0 0 1 3-2.6L10 11V4.5a1.5 1.5 0 0 1 3 0V11l1.5-1.6a2 2 0 0 1 3 2.6L15 15.5V21"/>')]
  ] },
  { g: 'Worship', items: [
    ['#/tasbih', 'Tasbih', '#7A3E7A', fi('<circle cx="12" cy="5" r="2"/><circle cx="6.5" cy="9" r="2"/><circle cx="17.5" cy="9" r="2"/><circle cx="8" cy="15" r="2"/><circle cx="16" cy="15" r="2"/><path d="M12 17v4"/>')],
    ['#/qibla', 'Qibla', '#1F6B78', fi('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>')],
    ['#/names', '99 Names', '#A8862E', fi('<path d="M12 3l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 8.3l5-.7z"/>')],
    ['#/calendar', 'Calendar', '#5C6B2E', fi('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/><path d="M15.5 14.5a2.5 2.5 0 1 1-2-3 2 2 0 0 0 2 3z"/>')]
  ] },
  { g: 'Tools', items: [
    ['#/snap', 'Snap times', '#24301F', fi('<path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3"/><circle cx="12" cy="12" r="3"/>')],
    ['#/alarms', 'Sync to phone', '#C2553C', fi('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>')],
    ['#/saved', 'Saved times', '#4A5A70', fi('<path d="M6 3h12v18l-6-4-6 4z"/>')],
    ['#/zakat', 'Zakat', '#2E7D5B', fi('<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.5 0-2.5.8-2.5 2s1.1 1.6 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1.1 0-2-.4-2.5-1.2M12 6.5V8M12 16v1.5"/>')]
  ] },
  { g: 'Discover', items: [
    ['#/news', 'News', '#8C3B3B', fi('<rect x="3" y="5" width="14" height="14" rx="1.5"/><path d="M17 9h3v8.5a1.5 1.5 0 0 1-3 0"/><path d="M6 9h8M6 12.5h8M6 16h5"/>')],
    ['#/watch', 'Watch', '#B23A2F', fi('<rect x="3" y="5.5" width="18" height="13" rx="3"/><path d="M10.5 9.5l4 2.5-4 2.5z"/>')],
    ['#/settings', 'Settings', '#555049', fi('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>')]
  ] }
];
export function featureGrid(groups = FEATURES, labelled = true) {
  return groups.map((grp, gi) => `${labelled ? `<div class="fg-h"><span>${grp.g}</span></div>` : ''}<div class="fgrid">${grp.items.map(([h, n, c, ic], i) =>
    `<a class="fitem rise" style="--i:${gi * 4 + i}" href="${h}"><span class="ficon" style="--c:${c}">${ic}</span><span class="flabel">${n}</span></a>`).join('')}</div>`).join('');
}

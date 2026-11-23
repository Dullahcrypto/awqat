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

// Tiny localStorage wrapper — everything stays on the device.
const P = 'awqat:';
export const store = {
  get(k, d) {
    try { const v = localStorage.getItem(P + k); return v == null ? d : JSON.parse(v); } catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem(P + k, JSON.stringify(v)); } catch { /* storage full or blocked */ }
    return v;
  },
  update(k, d, fn) { return this.set(k, fn(this.get(k, d))); }
};

export const defaults = {
  theme: 'sky',
  themeAuto: false,
  location: { kind: 'state', country: 'Nigeria', state: 'FCT', label: 'Abuja, Nigeria', lat: 9.0765, lng: 7.3986 },
  method: 'MuslimWorldLeague',
  madhab: 'Shafi',
  alarmLead: 'iqama',          // 'adhan' | 'iqama' | '10'
  alarmsOn: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
  reminders: { adhan: true, kahf: true, adhkar: false, fasts: false },
  mushaf: 'madani',
  clock24: false
};

export function setting(k) { return store.get(k, defaults[k]); }
export function setSetting(k, v) { return store.set(k, v); }

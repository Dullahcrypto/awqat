import { schedule, SALAH, hhmm } from './prayer.js';
import { setting } from './store.js';

let timers = [];

function alarmTime(p) {
  const lead = setting('alarmLead');
  if (lead === 'adhan') return p.adhan;
  if (lead === 'iqama') return p.iqama || p.adhan;
  const mins = parseInt(lead, 10) || 0;
  return new Date((p.iqama || p.adhan).getTime() - mins * 60000);
}

export async function enableNotifications() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  return Notification.requestPermission();
}

async function notify(title, body) {
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg) return reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: title, vibrate: [200, 100, 200] });
    new Notification(title, { body });
  } catch { /* ignore */ }
}

// While the app is open (or kept in memory), fire notifications at each prayer.
export function scheduleToday() {
  timers.forEach(clearTimeout); timers = [];
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const on = setting('alarmsOn');
  const now = Date.now();
  schedule().forEach((p) => {
    if (p.key === 'sunrise' || !on[p.key]) return;
    const t = alarmTime(p).getTime() - now;
    if (t > 0 && t < 24 * 3600e3) timers.push(setTimeout(() => notify(p.name + ' · ' + hhmm(p.main), p.iqama ? 'Iqama at ' + hhmm(p.iqama) : 'Time for ' + p.name), t));
  });
  const r = setting('reminders'), d = new Date();
  if (r.kahf && d.getDay() === 5) {
    const t = new Date(d); t.setHours(8, 0, 0, 0);
    if (t > d) timers.push(setTimeout(() => notify('Jumu’ah', 'Read Surah Al-Kahf today'), t - d));
  }
  if (r.adhkar) {
    const fajr = schedule().find((p) => p.key === 'fajr');
    const t = new Date(fajr.main.getTime() + 20 * 60000);
    if (t > d) timers.push(setTimeout(() => notify('Morning adhkar', 'A few minutes of remembrance'), t - d));
  }
  if (r.fasts && (d.getDay() === 0 || d.getDay() === 3)) {
    const t = new Date(d); t.setHours(20, 30, 0, 0);
    if (t > d) timers.push(setTimeout(() => notify('Fast tomorrow?', 'Tomorrow is a Sunnah fasting day'), t - d));
  }
}

// Calendar file: one daily repeating event per prayer, each with an alert.
export function downloadICS() {
  const on = setting('alarmsOn');
  const pad = (n) => String(n).padStart(2, '0');
  const d = new Date();
  const day = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Awqat//Prayer Times//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Awqat prayer times'];
  schedule().forEach((p) => {
    if (p.key === 'sunrise' || !on[p.key]) return;
    const t = alarmTime(p);
    const st = day + 'T' + pad(t.getHours()) + pad(t.getMinutes()) + '00';
    lines.push('BEGIN:VEVENT', 'UID:awqat-' + p.key + '-' + day + '@awqat', 'DTSTAMP:' + stamp, 'DTSTART:' + st, 'DURATION:PT10M',
      'RRULE:FREQ=DAILY', 'SUMMARY:' + p.name + (p.iqama ? ' (iqama ' + hhmm(p.iqama) + ')' : ''),
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + p.name, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'awqat-prayer-times.ics';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// Android: opens the Clock app's "new alarm" screen pre-filled.
export function androidAlarmURL(p) {
  const t = alarmTime(p);
  return 'intent:#Intent;action=android.intent.action.SET_ALARM;i.android.intent.extra.alarm.HOUR=' + t.getHours() +
    ';i.android.intent.extra.alarm.MINUTES=' + t.getMinutes() + ';S.android.intent.extra.alarm.MESSAGE=' + encodeURIComponent(p.name) + ';end';
}

export const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isAndroid = /android/i.test(navigator.userAgent);
export { SALAH };

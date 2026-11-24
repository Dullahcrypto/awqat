// Free vs Lifetime. Counts are kept on this phone.
import { store } from './store.js';
const C = () => window.AWQAT_CONFIG || {};
export const FREE = () => C().FREE_SNAPS_PER_DAY || 3;
export const PRICE = () => C().LIFETIME_PRICE_NGN || 2000;
let workerAI = null;
export const aiOn = () => !!C().AI_ENABLED || !!(workerAI && (workerAI.gemini || workerAI.cloudflare || workerAI.anthropic));
export async function checkAI() {
  const w = (C().WORKER_URL || '').replace(/\/$/, ''); if (!w) return;
  try { const j = await (await fetch(w + '/')).json(); workerAI = j.ai || null; } catch { /* offline */ }
}
export const payOn = () => !!C().PAYSTACK_PUBLIC_KEY;
export const isPro = () => !!store.get('pro', null);
const today = () => new Date().toDateString();
export function used() { const c = store.get('snapCount', { day: '', n: 0 }); return c.day === today() ? c.n : 0; }
export function left() { return isPro() ? Infinity : Math.max(0, FREE() - used()); }
export function canSnap() { return isPro() || left() > 0; }
export function recordSnap() { if (isPro()) return; store.set('snapCount', { day: today(), n: used() + 1 }); }
export const naira = (n) => '₦' + Number(n).toLocaleString('en-NG');

function loadPaystack() {
  if (window.PaystackPop) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://js.paystack.co/v2/inline.js'; s.onload = res; s.onerror = () => rej(new Error('Could not load Paystack. Check your connection.')); document.head.appendChild(s); });
}
async function verify(reference) {
  const w = (C().WORKER_URL || '').replace(/\/$/, '');
  const r = await fetch(w + '/verify?ref=' + encodeURIComponent(reference));
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || 'We could not confirm this payment yet.');
  store.set('pro', { ref: reference, email: j.email || '', at: Date.now() });
  return j;
}
export async function buyLifetime(email) {
  if (!payOn()) throw new Error('Payments are not switched on yet.');
  await loadPaystack();
  return new Promise((resolve, reject) => {
    const p = new window.PaystackPop();
    p.newTransaction({
      key: C().PAYSTACK_PUBLIC_KEY, email, amount: PRICE() * 100, currency: 'NGN',
      metadata: { product: 'awqat-lifetime' },
      onSuccess: (t) => verify(t.reference).then(resolve, reject),
      onCancel: () => reject(new Error('Payment cancelled'))
    });
  });
}
export const restore = (ref) => verify(ref.trim());

// Small shared helpers. Pure functions only (safe to import from Node tests).

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
export const sum = (arr) => arr.reduce((a, b) => a + b, 0);
export const round = (v, d = 0) => Math.round(v * 10 ** d) / 10 ** d;

export function stdev(arr) {
  if (arr.length < 2) return 0;
  const m = avg(arr);
  return Math.sqrt(avg(arr.map((v) => (v - m) ** 2)));
}

// ---------- Dates (local calendar dates as YYYY-MM-DD) ----------
const pad = (n) => String(n).padStart(2, '0');
export const todayISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export const addDays = (iso, n) => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return todayISO(d);
};
export function startOfWeek(iso) {
  const d = parseISO(iso);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return todayISO(d);
}
export const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
export const fmtDate = (iso, opts = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  parseISO(iso).toLocaleDateString('es-ES', opts);
export const isWeekend = (iso) => [0, 6].includes(parseISO(iso).getDay());

// ---------- Seeded randomness ----------
export function hashStr(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h >>> 0) || 1;
}
export function rng(seed = Math.random() * 2 ** 32) {
  let a = typeof seed === 'string' ? hashStr(seed) : seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pickOne = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];
export function shuffle(arr, r = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// Weighted pick with softmax temperature over scores.
export function softPick(list, scoreOf, temperature, r = Math.random) {
  if (!list.length) return null;
  if (temperature <= 0) return list[0];
  const max = Math.max(...list.map(scoreOf));
  const w = list.map((x) => Math.exp((scoreOf(x) - max) / temperature));
  let t = r() * sum(w);
  for (let i = 0; i < list.length; i++) {
    t -= w[i];
    if (t <= 0) return list[i];
  }
  return list[list.length - 1];
}

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export const countBy = (arr, keyFn) => {
  const m = new Map();
  for (const x of arr) {
    const keys = [].concat(keyFn(x)).filter((k) => k != null);
    for (const k of keys) m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
};

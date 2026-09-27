// Weather via Open-Meteo (free, no API key). Every call degrades gracefully offline.
import { bandForTemp, seasonFor } from './constants.js';
import { todayISO, addDays, parseISO } from './util.js';

const cache = new Map();
async function getJSON(url, ttl = 60 * 60 * 1000) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < ttl) return hit.v;
  try {
    const ls = JSON.parse(localStorage.getItem('wx:' + url) || 'null');
    if (ls && Date.now() - ls.t < ttl) { cache.set(url, ls); return ls.v; }
  } catch {}
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const v = await r.json();
    const entry = { t: Date.now(), v };
    cache.set(url, entry);
    try { localStorage.setItem('wx:' + url, JSON.stringify(entry)); } catch {}
    return v;
  } finally { clearTimeout(to); }
}

export const WMO = (code) => {
  if (code == null) return { label: '—', icon: 'cloud' };
  if (code === 0) return { label: 'Clear', icon: 'sun' };
  if (code <= 2) return { label: 'Partly cloudy', icon: 'sun' };
  if (code === 3) return { label: 'Overcast', icon: 'cloud' };
  if (code <= 48) return { label: 'Fog', icon: 'cloud' };
  if (code <= 67 || (code >= 80 && code <= 82)) return { label: 'Rain', icon: 'rain' };
  if (code <= 77 || code === 85 || code === 86) return { label: 'Snow', icon: 'snow' };
  return { label: 'Storms', icon: 'rain' };
};

export async function geocode(q) {
  const d = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`, 24 * 3600e3);
  return (d.results || []).map((r) => ({
    name: [r.name, r.admin1, r.country].filter(Boolean).join(', '), short: r.name, lat: r.latitude, lon: r.longitude,
  }));
}

export function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation is not available.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3), name: 'My location' }),
      () => reject(new Error('Location permission was denied.')),
      { timeout: 10000, maximumAge: 3600e3 },
    );
  });
}

// Daily forecast map: date -> { tmax, tmin, rain (prob %), code }
export async function forecast(loc) {
  const d = await getJSON(
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
      `&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=auto&forecast_days=16`,
  );
  const days = {};
  d.daily.time.forEach((t, i) => {
    days[t] = { tmax: d.daily.temperature_2m_max[i], tmin: d.daily.temperature_2m_min[i], rain: d.daily.precipitation_probability_max[i], code: d.daily.weather_code[i] };
  });
  return { current: d.current ? { temp: d.current.temperature_2m, code: d.current.weather_code } : null, days };
}

// Climate estimate for dates beyond the forecast horizon: same dates last year.
export async function climate(loc, start, days) {
  const s = parseISO(start);
  s.setFullYear(s.getFullYear() - 1);
  const from = todayISO(s), to = addDays(from, days - 1);
  const d = await getJSON(
    `https://archive-api.open-meteo.com/v1/archive?latitude=${loc.lat}&longitude=${loc.lon}&start_date=${from}&end_date=${to}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=auto`,
    7 * 24 * 3600e3,
  );
  const out = {};
  d.daily.time.forEach((t, i) => {
    out[addDays(start, i)] = {
      tmax: d.daily.temperature_2m_max[i], tmin: d.daily.temperature_2m_min[i],
      rain: d.daily.precipitation_sum[i] > 1 ? 70 : 10, code: d.daily.weather_code[i], estimate: true,
    };
  });
  return out;
}

// Convert a forecast day into the engine's weather context.
export function dayContext(day, date, lat = 40) {
  const season = seasonFor(date ? parseISO(date) : new Date(), lat);
  if (!day) return defaultContext(date, lat);
  const temp = day.tmax * 0.65 + day.tmin * 0.35; // daytime "feels like" blend
  return { temp, band: bandForTemp(temp).id, rain: (day.rain ?? 0) >= 50, season, code: day.code, tmax: day.tmax, tmin: day.tmin, estimate: !!day.estimate };
}
// With no forecast, fall back to typical temperatures for the season.
export function defaultContext(date, lat = 40) {
  const season = seasonFor(date ? parseISO(date) : new Date(), lat);
  const temp = { summer: 26, spring: 16, autumn: 14, winter: 6 }[season];
  return { temp, band: bandForTemp(temp).id, season, assumed: true };
}

export async function forecastFor(loc) {
  if (!loc) return null;
  try { return await forecast(loc); } catch { return null; }
}

export const fmtTemp = (c, units = 'C') => (c == null ? '—' : units === 'F' ? `${Math.round(c * 1.8 + 32)}°F` : `${Math.round(c)}°`);

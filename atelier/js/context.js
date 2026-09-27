// App-wide derived context: weather for any date + engine context from user settings.
import { store, wearCounts } from './store.js';
import { forecastFor, dayContext, defaultContext } from './weather.js';
import { todayISO } from './util.js';

let wx = null; // { current, days }
let wxLoc = null;
let wxPromise = null;
const wxListeners = new Set();

export function loadWeather(force = false) {
  const loc = store.settings.location;
  const key = loc ? `${loc.lat},${loc.lon}` : null;
  if (!force && wxPromise && key === wxLoc) return wxPromise;
  wxLoc = key;
  wxPromise = forecastFor(loc).then((f) => {
    wx = f;
    wxListeners.forEach((fn) => fn(wx));
    return wx;
  });
  return wxPromise;
}
export const onWeather = (fn) => (wxListeners.add(fn), () => wxListeners.delete(fn));
export const weatherData = () => wx;

export function weatherFor(date = todayISO()) {
  const lat = store.settings.location?.lat ?? 40;
  const day = wx?.days?.[date];
  return day ? dayContext(day, date, lat) : defaultContext(date, lat);
}

export function buildCtx({ style = 'any', occasion = null, weather, colorPrefs, preferLeastWorn = false, onlyFavorites = false, date } = {}) {
  const s = store.settings;
  return {
    style, occasion,
    weather: weather === null ? null : weather || weatherFor(date),
    colorPrefs: colorPrefs || { include: [], avoid: [] },
    favColors: s.favColors, avoidColors: s.avoidColors,
    accessories: s.accessories, layering: s.layering,
    preferLeastWorn, onlyFavorites, wearCounts: wearCounts(),
  };
}

export function defaultOccasion(date = todayISO()) {
  const d = new Date(date + 'T12:00');
  const weekend = d.getDay() === 0 || d.getDay() === 6;
  return weekend ? store.settings.occasionWeekend : store.settings.occasionWeekday;
}
export const defaultStyle = () => store.settings.styles?.[0] || 'any';

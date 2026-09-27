// Home: greeting, weather, Outfit of the Day, quick actions, week strip, insights.
import { store, wearCounts } from '../store.js';
import { generateOutfit } from '../engine.js';
import { buildCtx, weatherFor, defaultOccasion, defaultStyle, loadWeather, onWeather, weatherData } from '../context.js';
import { mountStudio } from '../studio.js';
import { icon } from '../icons.js';
import { esc, todayISO, addDays, startOfWeek, fmtDate, rng } from '../util.js';
import { saveGenerated, empty, outfitBoard } from '../ui.js';
import { OCCASION, STYLE } from '../constants.js';
import { WMO, fmtTemp } from '../weather.js';
import { navigate } from '../router.js';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

async function ensureOotd(force = false) {
  const today = todayISO();
  const plan = store.get('plans', today);
  if (!force && plan && store.get('outfits', plan.outfitId)) return { plan, outfit: store.get('outfits', plan.outfitId) };
  const items = store.all('items');
  if (!items.length) return null;
  const ctx = buildCtx({ style: defaultStyle(), occasion: defaultOccasion(today), date: today });
  const prev = force && plan ? store.get('outfits', plan.outfitId) : null;
  const res = generateOutfit(items, ctx, {
    random: force ? Math.random : rng(today + items.length),
    avoidSignatures: prev ? new Set([prev.signature]) : undefined,
    usage: recentUsage(),
  });
  if (res.error) return { error: res.error };
  const outfit = await saveGenerated(res, { style: ctx.style, occasion: ctx.occasion, weather: ctx.weather, source: 'ootd', name: 'Outfit of the day' });
  const p = await store.put('plans', { id: today, date: today, outfitId: outfit.id, worn: false, source: 'ootd' });
  return { plan: p, outfit };
}

// Items worn in the last few days get a gentle penalty so OOTD rotates.
function recentUsage() {
  const since = addDays(todayISO(), -4);
  const m = new Map();
  for (const w of store.all('wears')) if (w.date >= since) for (const id of w.itemIds) m.set(id, (m.get(id) || 0) + 1);
  return m;
}

function weekHTML(week, today) {
  return week.map((d) => {
    const p = store.get('plans', d);
    const o = p && store.get('outfits', p.outfitId);
    return `<a class="ws-day ${d === today ? 'today' : ''}" href="#/calendar?date=${d}">
      <span class="ws-name">${fmtDate(d, { weekday: 'short' })}</span><span class="ws-num">${fmtDate(d, { day: 'numeric' })}</span>
      ${o ? outfitBoard(o.items, { size: 'xs' }) : `<span class="ws-empty">${icon('plus', 16)}</span>`}
      ${p?.worn ? `<span class="ws-worn" title="Worn">${icon('check', 12)}</span>` : ''}</a>`;
  }).join('');
}

export default {
  render(el) {
    const s = store.settings;
    const items = store.all('items');
    const today = todayISO();
    const wx = weatherData();
    const cur = wx?.current;
    const w = weatherFor(today);
    const wxHTML = s.location
      ? cur
        ? `${icon(WMO(cur.code).icon, 18)} <b>${fmtTemp(cur.temp, s.units)}</b> ${esc(WMO(cur.code).label)} · ${esc(s.location.name.split(',')[0])}`
        : `${icon('cloud', 18)} Weather unavailable — using ${esc(w.season)} defaults`
      : `<a href="#/settings?tab=profile">${icon('pin', 18)} Set your city for weather-aware outfits</a>`;

    const laundry = items.filter((i) => i.status === 'laundry').length;
    const wc = wearCounts();
    const forgotten = items.filter((i) => i.category !== 'accessory' && (i.status || 'available') === 'available')
      .sort((a, b) => (wc.get(a.id) || 0) - (wc.get(b.id) || 0) || a.createdAt - b.createdAt)[0];
    const ws = startOfWeek(today);
    const week = Array.from({ length: 7 }, (_, i) => addDays(ws, i));

    el.innerHTML = `
      <header class="page-head home-head">
        <div>
          <div class="eyebrow">${fmtDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1 class="display">${greeting()}${s.name ? `, <em>${esc(s.name)}</em>` : ''}.</h1>
          <div class="wx-line">${wxHTML}</div>
        </div>
      </header>

      ${items.length ? `
      <section class="ootd">
        <div class="section-head"><h2>Outfit of the Day</h2>
          <span class="muted small">${esc(OCCASION[defaultOccasion(today)]?.label || '')} · ${esc(STYLE[defaultStyle()]?.label || 'Any style')}</span></div>
        <div id="ootd"><div class="skeleton" style="height:420px"></div></div>
      </section>` : `
      <section class="card hero-empty">
        ${empty('hanger', 'Your wardrobe is empty', 'Add a few pieces — a top, trousers and sneakers are enough for your first outfit.',
          `<div class="row gap center"><a class="btn primary" href="#/wardrobe?add=1">${icon('camera', 18)} Add clothes</a><a class="btn ghost" href="#/settings?tab=data">Load sample wardrobe</a></div>`)}
      </section>`}

      <section>
        <div class="section-head"><h2>Quick actions</h2></div>
        <div class="quick">
          <a class="q-tile" href="#/create">${icon('sparkles', 22)}<b>Create an outfit</b><small>Style, occasion, weather</small></a>
          <a class="q-tile" href="#/create?mode=surprise">${icon('shuffle', 22)}<b>Surprise me</b><small>A random combination</small></a>
          <a class="q-tile" href="#/planner">${icon('week', 22)}<b>Plan my week</b><small>Seven days, no repeats</small></a>
          <a class="q-tile" href="#/travel">${icon('suitcase', 22)}<b>Pack for a trip</b><small>Outfits + packing list</small></a>
        </div>
      </section>

      <section>
        <div class="section-head"><h2>This week</h2><a class="link" href="#/planner">Open planner ${icon('right', 16)}</a></div>
        <div class="week-strip"></div>
      </section>

      ${items.length ? `<section class="home-cards">
        ${forgotten ? `<a class="card insight" href="#/create?item=${esc(forgotten.id)}">
          <img src="${esc(forgotten.image)}" alt=""><div><div class="eyebrow">Rediscover</div><b>${esc(forgotten.name)}</b>
          <p class="muted small">${wc.get(forgotten.id) ? `Worn only ${wc.get(forgotten.id)}×` : 'Never worn yet'} — build an outfit around it.</p></div>${icon('right', 18)}</a>` : ''}
        <a class="card insight" href="#/laundry">${icon('laundry', 30)}<div><div class="eyebrow">Laundry</div><b>${laundry ? `${laundry} item${laundry > 1 ? 's' : ''} in the wash` : 'Everything is available'}</b>
          <p class="muted small">${laundry ? 'They are skipped when generating outfits.' : 'Mark items as washing to keep them out of outfits.'}</p></div>${icon('right', 18)}</a>
        <a class="card insight" href="#/stats">${icon('chart', 30)}<div><div class="eyebrow">Wardrobe</div><b>${items.length} pieces · ${store.all('outfits').filter((o) => o.favorite).length} favourite outfits</b>
          <p class="muted small">See what you wear most and what you forget.</p></div>${icon('right', 18)}</a>
      </section>` : ''}
    `;

    const drawOotd = async (force = false) => {
      const host = el.querySelector('#ootd');
      if (!host) return;
      const r = await ensureOotd(force);
      if (!r) return;
      if (r.error) { host.innerHTML = `<div class="card">${empty('hanger', 'Almost there', esc(r.error), '<a class="btn primary" href="#/wardrobe?add=1">Add clothes</a>')}</div>`; return; }
      const ctx = buildCtx({ style: defaultStyle(), occasion: defaultOccasion(today), date: today });
      mountStudio(host, r.outfit, ctx, {
        source: 'ootd',
        headline: r.plan.worn ? `<span class="pill good">${icon('check', 13)} Worn today</span>` : '',
        onChange: async (o) => {
          const p = store.get('plans', today);
          await store.put('plans', { ...(p || {}), id: today, date: today, outfitId: o.id });
        },
      });
    };
    drawOotd();
    // Re-render once live weather arrives (first load) so the OOTD reflects it.
    const offW = onWeather(() => { if (!store.get('plans', today)) drawOotd(); });
    loadWeather();
    const drawWeek = () => {
      const host = el.querySelector('.week-strip');
      if (host) host.innerHTML = weekHTML(week, today);
    };
    drawWeek();
    const off = store.on((c) => {
      if (c.has('items') && !items.length && store.all('items').length) navigate('home', {}, { replace: true });
      if (c.has('plans') || c.has('outfits')) drawWeek();
    });
    return () => { off(); offW(); };
  },
};

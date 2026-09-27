// Home: greeting, weather, Outfit of the Day, quick actions, week strip, insights.
import { store, wearCounts } from '../store.js';
import { generateOutfit } from '../engine.js';
import { buildCtx, weatherFor, defaultOccasion, defaultStyle, loadWeather, onWeather, weatherData } from '../context.js';
import { mountStudio } from '../studio.js';
import { icon } from '../icons.js';
import { esc, todayISO, addDays, startOfWeek, fmtDate, rng } from '../util.js';
import { saveGenerated, empty, outfitBoard } from '../ui.js';
import { OCCASION, STYLE, SEASON_LABEL } from '../constants.js';
import { WMO, fmtTemp } from '../weather.js';
import { navigate } from '../router.js';

function greeting() {
  const h = new Date().getHours();
  return h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
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
  const outfit = await saveGenerated(res, { style: ctx.style, occasion: ctx.occasion, weather: ctx.weather, source: 'ootd', name: 'Outfit del día' });
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
      ${p?.worn ? `<span class="ws-worn" title="Puesto">${icon('check', 12)}</span>` : ''}</a>`;
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
        : `${icon('cloud', 18)} El tiempo no está disponible: se usan valores típicos de ${esc(SEASON_LABEL[w.season].toLowerCase())}`
      : `<a href="#/settings?tab=profile">${icon('pin', 18)} Indica tu ciudad para tener outfits según el tiempo</a>`;

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
        <div class="section-head"><h2>Outfit del día</h2>
          <span class="muted small">${esc(OCCASION[defaultOccasion(today)]?.label || '')} · ${esc(STYLE[defaultStyle()]?.label || 'Cualquier estilo')}</span></div>
        <div id="ootd"><div class="skeleton" style="height:420px"></div></div>
      </section>` : `
      <section class="card hero-empty">
        ${empty('hanger', 'Tu armario está vacío', 'Añade algunas prendas: con una parte de arriba, un pantalón y unas zapatillas ya tienes tu primer outfit.',
          `<div class="row gap center"><a class="btn primary" href="#/wardrobe?add=1">${icon('camera', 18)} Añadir ropa</a><a class="btn ghost" href="#/settings?tab=data">Cargar armario de ejemplo</a></div>`)}
      </section>`}

      <section>
        <div class="section-head"><h2>Accesos rápidos</h2></div>
        <div class="quick">
          <a class="q-tile" href="#/create">${icon('sparkles', 22)}<b>Crear un outfit</b><small>Estilo, ocasión y tiempo</small></a>
          <a class="q-tile" href="#/create?mode=surprise">${icon('shuffle', 22)}<b>Sorpréndeme</b><small>Una combinación al azar</small></a>
          <a class="q-tile" href="#/planner">${icon('week', 22)}<b>Planificar mi semana</b><small>Siete días sin repetir</small></a>
          <a class="q-tile" href="#/travel">${icon('suitcase', 22)}<b>Preparar un viaje</b><small>Outfits y lista de maleta</small></a>
        </div>
      </section>

      <section>
        <div class="section-head"><h2>Esta semana</h2><a class="link" href="#/planner">Abrir planificador ${icon('right', 16)}</a></div>
        <div class="week-strip"></div>
      </section>

      ${items.length ? `<section class="home-cards">
        ${forgotten ? `<a class="card insight" href="#/create?item=${esc(forgotten.id)}">
          <img src="${esc(forgotten.image)}" alt=""><div><div class="eyebrow">Redescubre</div><b>${esc(forgotten.name)}</b>
          <p class="muted small">${wc.get(forgotten.id) ? `Solo te lo has puesto ${wc.get(forgotten.id)} ${wc.get(forgotten.id) > 1 ? 'veces' : 'vez'}` : 'Aún no te lo has puesto'}: crea un outfit a su alrededor.</p></div>${icon('right', 18)}</a>` : ''}
        <a class="card insight" href="#/laundry">${icon('laundry', 30)}<div><div class="eyebrow">Lavandería</div><b>${laundry ? `${laundry} ${laundry > 1 ? 'prendas lavándose' : 'prenda lavándose'}` : 'Todo está disponible'}</b>
          <p class="muted small">${laundry ? 'No se usan al generar outfits.' : 'Marca prendas como «lavando» para dejarlas fuera de los outfits.'}</p></div>${icon('right', 18)}</a>
        <a class="card insight" href="#/stats">${icon('chart', 30)}<div><div class="eyebrow">Armario</div><b>${items.length} prendas · ${store.all('outfits').filter((o) => o.favorite).length} outfits favoritos</b>
          <p class="muted small">Mira qué es lo que más te pones y qué tienes olvidado.</p></div>${icon('right', 18)}</a>
      </section>` : ''}
    `;

    const drawOotd = async (force = false) => {
      const host = el.querySelector('#ootd');
      if (!host) return;
      const r = await ensureOotd(force);
      if (!r) return;
      if (r.error) { host.innerHTML = `<div class="card">${empty('hanger', 'Ya casi está', esc(r.error), '<a class="btn primary" href="#/wardrobe?add=1">Añadir ropa</a>')}</div>`; return; }
      const ctx = buildCtx({ style: defaultStyle(), occasion: defaultOccasion(today), date: today });
      mountStudio(host, r.outfit, ctx, {
        source: 'ootd',
        headline: r.plan.worn ? `<span class="pill good">${icon('check', 13)} Puesto hoy</span>` : '',
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

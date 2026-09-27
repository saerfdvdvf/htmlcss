// Travel mode: destination + days + weather + occasions → capsule outfits and automatic packing list.
import { store } from '../store.js';
import { planTrip, tripExtras } from '../planning.js';
import { generateOutfit } from '../engine.js';
import { buildCtx } from '../context.js';
import { STYLES, OCCASIONS, OCCASION, CAT, bandForTemp, seasonFor } from '../constants.js';
import { geocode, forecast, climate, dayContext } from '../weather.js';
import { icon } from '../icons.js';
import { esc, todayISO, addDays, fmtDate, uid, daysBetween, debounce, parseISO } from '../util.js';
import { chip, bindChips, pickItem, outfitBoard, scoreRing, saveGenerated, toast, confirmDialog, empty } from '../ui.js';
import { navigate } from '../router.js';

const TRIP_TYPES = [
  { id: 'city', label: 'City break', occ: ['everyday', 'going-out'] },
  { id: 'beach', label: 'Beach', occ: ['everyday', 'going-out'] },
  { id: 'business', label: 'Business', occ: ['work', 'everyday'] },
  { id: 'outdoor', label: 'Outdoor', occ: ['sports', 'everyday'] },
  { id: 'cold', label: 'Ski / cold', occ: ['everyday', 'sports'] },
  { id: 'party', label: 'Festival / party', occ: ['party', 'going-out'] },
];

async function weatherForTrip(loc, start, n, manual) {
  const dates = Array.from({ length: n }, (_, i) => addDays(start, i));
  if (manual) {
    const temp = (manual.min + manual.max) / 2;
    const lat = loc?.lat ?? 40;
    return { source: 'manual', days: Object.fromEntries(dates.map((d) => [d, { temp, band: bandForTemp(temp).id, rain: manual.rain, season: seasonFor(parseISO(d), lat), tmax: manual.max, tmin: manual.min }])) };
  }
  const out = {};
  let source = 'seasonal';
  if (loc) {
    try {
      if (daysBetween(todayISO(), start) <= 14) {
        const f = await forecast(loc);
        for (const d of dates) if (f.days[d]) out[d] = dayContext(f.days[d], d, loc.lat);
        if (Object.keys(out).length) source = 'forecast';
      }
      const missing = dates.filter((d) => !out[d]);
      if (missing.length) {
        const c = await climate(loc, missing[0], missing.length);
        for (const d of missing) if (c[d]) out[d] = dayContext(c[d], d, loc.lat);
        if (source !== 'forecast') source = 'last year';
      }
    } catch (e) { console.info('Trip weather unavailable', e); }
  }
  for (const d of dates) if (!out[d]) {
    const season = seasonFor(parseISO(d), loc?.lat ?? 40);
    const temp = { summer: 26, spring: 16, autumn: 14, winter: 5 }[season];
    out[d] = { temp, band: bandForTemp(temp).id, season, assumed: true };
  }
  return { source, days: out };
}

async function buildTrip(form) {
  const n = form.days;
  const wx = await weatherForTrip(form.loc, form.start, n, form.manual);
  const occs = form.occasions.length ? form.occasions : TRIP_TYPES.find((t) => t.id === form.type)?.occ || ['everyday'];
  const dayList = Array.from({ length: n }, (_, i) => {
    const date = addDays(form.start, i);
    const occasion = (i === 0 || i === n - 1) && n > 2 ? 'travel' : occs[i % occs.length];
    return { date, occasion, weather: wx.days[date], style: form.style };
  });
  const items = store.all('items');
  const plan = planTrip(items, { dayList, style: form.style, include: form.include, exclude: form.exclude, seed: form.destination + form.start });
  const days = [];
  for (const [i, s] of plan.series.entries()) {
    if (!s.items) continue;
    const o = await saveGenerated(s, { style: form.style, occasion: dayList[i].occasion, weather: dayList[i].weather, source: 'travel' });
    days.push({ date: dayList[i].date, occasion: dayList[i].occasion, weather: dayList[i].weather, outfitId: o.id });
  }
  const temps = Object.values(wx.days).map((d) => d.temp);
  return store.put('trips', {
    id: uid(), destination: form.destination, loc: form.loc, start: form.start, days, type: form.type, style: form.style,
    include: form.include, exclude: form.exclude, weatherSource: wx.source,
    packing: plan.packing.map((id) => ({ itemId: id, packed: false })),
    extras: tripExtras({
      days: n, rain: Object.values(wx.days).some((d) => d.rain), hot: Math.max(...temps) >= 24, cold: Math.min(...temps) < 8,
      beach: form.type === 'beach', sports: dayList.some((d) => d.occasion === 'sports'), business: form.type === 'business',
    }),
  });
}

function tripView(el, trip) {
  const capsule = trip.packing.map((p) => store.get('items', p.itemId)).filter(Boolean);
  const packedN = trip.packing.filter((p) => p.packed).length + trip.extras.filter((x) => x.packed).length;
  const totalN = trip.packing.length + trip.extras.length;
  const temps = trip.days.map((d) => d.weather?.temp).filter((t) => t != null);
  const byCat = Object.keys(CAT).map((c) => [c, trip.packing.filter((p) => store.get('items', p.itemId)?.category === c)]).filter(([, l]) => l.length);
  el.innerHTML = `
    <header class="page-head">
      <div><button class="back" data-back>${icon('left', 18)} All trips</button>
        <h1 class="display">${esc(trip.destination || 'Trip')}</h1>
        <p class="muted">${fmtDate(trip.start, { day: 'numeric', month: 'short' })} – ${fmtDate(addDays(trip.start, trip.days.length - 1), { day: 'numeric', month: 'short', year: 'numeric' })} · ${trip.days.length} days
        ${temps.length ? ` · ${Math.round(Math.min(...temps)) === Math.round(Math.max(...temps)) ? `around ${Math.round(temps[0])}°` : `${Math.round(Math.min(...temps))}–${Math.round(Math.max(...temps))}°`} (${esc(trip.weatherSource === 'seasonal' ? 'seasonal estimate' : trip.weatherSource)})` : ''}</p></div>
      <button class="btn ghost danger-text" data-del>${icon('trash', 16)} Delete trip</button>
    </header>
    <div class="tiles small">
      <div class="tile"><span>Clothing pieces</span><b>${capsule.length}</b></div>
      <div class="tile"><span>Outfits</span><b>${trip.days.length}</b></div>
      <div class="tile" title="Compared with packing a separate top, trousers and sneakers for every day"><span>Pieces saved</span><b>${Math.max(0, trip.days.length * 3 - capsule.filter((i) => i.category !== 'accessory').length)}</b></div>
      <div class="tile"><span>Packed</span><b>${packedN}<small>/${totalN}</small></b></div>
    </div>
    <div class="trip-layout">
      <section>
        <div class="section-head"><h2>Daily outfits</h2></div>
        <div class="trip-days">${trip.days.map((d, i) => {
          const o = store.get('outfits', d.outfitId);
          return `<article class="card trip-day" data-i="${i}">
            <header><div><b>Day ${i + 1}</b> <span class="muted small">${fmtDate(d.date)}</span></div>
            <span class="pill">${esc(OCCASION[d.occasion]?.label || '')}</span>
            <span class="pill">${icon(d.weather?.rain ? 'rain' : ['hot', 'warm'].includes(d.weather?.band) ? 'sun' : 'cloud', 13)} ${d.weather?.temp != null ? Math.round(d.weather.temp) + '°' : ''}</span></header>
            ${o ? outfitBoard(o.items, { size: 'sm' }) : ''}
            <footer>${o ? scoreRing(o.score?.total, 34) : ''}<span class="grow"></span>
              <button class="btn soft sm" data-regen>${icon('refresh', 14)} Regenerate</button>
              <button class="icon-btn" data-open aria-label="Open outfit">${icon('eye', 18)}</button></footer>
          </article>`;
        }).join('')}</div>
      </section>
      <aside class="card packing">
        <div class="section-head"><h2>Packing list</h2><span class="muted small">${packedN}/${totalN}</span></div>
        <div class="progress"><i style="width:${totalN ? (packedN / totalN) * 100 : 0}%"></i></div>
        ${byCat.map(([c, list]) => `<h4 class="sub-h">${CAT[c].plural} <small>${list.length}</small></h4>
          ${list.map((p) => { const it = store.get('items', p.itemId); return `<label class="pack-row ${p.packed ? 'done' : ''}"><input type="checkbox" data-pack="${esc(p.itemId)}" ${p.packed ? 'checked' : ''}><img src="${esc(it.image)}" alt=""><span>${esc(it.name)}</span></label>`; }).join('')}`).join('')}
        <h4 class="sub-h">Essentials</h4>
        ${trip.extras.map((x) => `<label class="pack-row ${x.packed ? 'done' : ''}"><input type="checkbox" data-extra="${esc(x.id)}" ${x.packed ? 'checked' : ''}><span class="qty">${x.qty}×</span><span>${esc(x.label)}</span></label>`).join('')}
        <button class="btn ghost sm" data-add-piece>${icon('plus', 14)} Add a piece</button>
      </aside>
    </div>`;
}

export default {
  render(el, params) {
    let form = {
      destination: '', loc: null, start: addDays(todayISO(), 7), days: 5, type: 'city', style: store.settings.styles?.[0] || 'casual',
      occasions: [], include: [], exclude: [], manual: null,
    };
    const draw = () => {
      if (params.trip) {
        const t = store.get('trips', params.trip);
        if (t) return tripView(el, t);
      }
      const trips = store.all('trips').sort((a, b) => b.createdAt - a.createdAt);
      const items = store.all('items');
      el.innerHTML = `
        <header class="page-head"><div><div class="eyebrow">Automatic suitcase</div><h1 class="display">Travel</h1><p class="muted">Tell us where you're going — we'll plan every outfit and pack the fewest pieces possible.</p></div></header>
        ${trips.length ? `<div class="trip-list">${trips.map((t) => `<button class="card trip-chip" data-trip="${esc(t.id)}">${icon('suitcase', 22)}<span><b>${esc(t.destination || 'Trip')}</b><small>${fmtDate(t.start, { day: 'numeric', month: 'short' })} · ${t.days.length} days · ${t.packing.length} pieces</small></span>${icon('right', 16)}</button>`).join('')}</div>` : ''}
        ${!items.length ? `<div class="card">${empty('hanger', 'Add clothes first', '', '<a class="btn primary" href="#/wardrobe?add=1">Add clothes</a>')}</div>` : `
        <form class="card trip-form" novalidate>
          <h2>Plan a new trip</h2>
          <div class="grid2">
            <label class="field dest"><span>${icon('pin', 15)} Destination</span><input name="dest" placeholder="e.g. Lisbon" autocomplete="off" value="${esc(form.destination)}"><div class="suggest" data-suggest></div></label>
            <div class="grid2">
              <label class="field"><span>Start date</span><input type="date" name="start" value="${form.start}"></label>
              <label class="field"><span>Days</span><input type="number" name="days" min="1" max="21" value="${form.days}"></label>
            </div>
          </div>
          <div class="field"><span>Type of trip</span><div class="chips">${TRIP_TYPES.map((t) => chip(t.label, { value: t.id, name: 'type', active: form.type === t.id })).join('')}</div></div>
          <div class="field"><span>Style</span><div class="chips">${[...STYLES, { id: 'any', label: 'Any' }].map((s) => chip(s.label, { value: s.id, name: 'tstyle', active: form.style === s.id })).join('')}</div></div>
          <div class="field"><span>Occasions (optional)</span><div class="chips">${OCCASIONS.filter((o) => o.id !== 'home').map((o) => chip(o.label, { value: o.id, name: 'tocc', active: form.occasions.includes(o.id) })).join('')}</div></div>
          <details class="field" ${form.manual ? 'open' : ''}><summary>${icon('thermo', 15)} Weather — automatic from forecast, or set it yourself</summary>
            <div class="grid3">
              <label class="field"><span>Min °C</span><input type="number" name="tmin" placeholder="auto" value="${form.manual?.min ?? ''}"></label>
              <label class="field"><span>Max °C</span><input type="number" name="tmax" placeholder="auto" value="${form.manual?.max ?? ''}"></label>
              <label class="switch-row"><input type="checkbox" name="rain" ${form.manual?.rain ? 'checked' : ''}><span class="switch"></span><span>Rain expected</span></label>
            </div></details>
          <div class="grid2">
            <div class="field"><span>Must take</span><div class="chips" data-list="include">${form.include.map((id) => pill(id, 'include')).join('')}<button type="button" class="chip" data-addto="include">${icon('plus', 14)} Add</button></div></div>
            <div class="field"><span>Leave at home</span><div class="chips" data-list="exclude">${form.exclude.map((id) => pill(id, 'exclude')).join('')}<button type="button" class="chip" data-addto="exclude">${icon('plus', 14)} Add</button></div></div>
          </div>
          <button class="btn primary lg" type="submit">${icon('suitcase', 20)} Plan outfits & packing list</button>
        </form>`}`;
      bindChips(el, 'type', { onChange: (v) => (form.type = v) });
      bindChips(el, 'tstyle', { onChange: (v) => (form.style = v) });
      bindChips(el, 'tocc', { multi: true, onChange: (v) => (form.occasions = v) });
      const dest = el.querySelector('[name=dest]');
      if (dest) {
        const sug = el.querySelector('[data-suggest]');
        dest.addEventListener('input', debounce(async () => {
          form.destination = dest.value.trim();
          form.loc = null;
          if (dest.value.trim().length < 2) return (sug.innerHTML = '');
          try {
            const r = await geocode(dest.value.trim());
            sug.innerHTML = r.map((x, i) => `<button type="button" data-geo="${i}">${icon('pin', 14)} ${esc(x.name)}</button>`).join('');
            sug.onclick = (e) => {
              const b = e.target.closest('[data-geo]');
              if (!b) return;
              const x = r[+b.dataset.geo];
              form.loc = x; form.destination = x.short;
              dest.value = x.name; sug.innerHTML = '';
            };
          } catch { sug.innerHTML = ''; }
        }, 350));
      }
    };
    const pill = (id, list) => {
      const it = store.get('items', id);
      return it ? `<span class="chip on must"><img src="${esc(it.image)}" alt="">${esc(it.name)}<button type="button" data-rm="${list}:${esc(id)}" aria-label="Remove">${icon('x', 12)}</button></span>` : '';
    };
    const readForm = () => {
      const f = el.querySelector('form');
      if (!f) return;
      form.destination = f.dest.value.split(',')[0].trim() || form.destination;
      form.start = f.start.value || form.start;
      form.days = Math.max(1, Math.min(21, +f.days.value || 5));
      const mn = f.tmin.value, mx = f.tmax.value;
      form.manual = mn !== '' || mx !== '' ? { min: +(mn || mx), max: +(mx || mn), rain: f.rain.checked } : null;
    };
    draw();

    el.addEventListener('submit', async (e) => {
      e.preventDefault();
      readForm();
      const btn = e.target.querySelector('[type=submit]');
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner sm"></span> Planning your trip…`;
      try {
        const trip = await buildTrip(form);
        navigate('travel', { trip: trip.id });
      } catch (err) {
        console.error(err);
        toast('Could not plan this trip: ' + err.message);
        btn.disabled = false;
      }
    });
    el.addEventListener('click', async (e) => {
      const t = e.target;
      const add = t.closest('[data-addto]')?.dataset.addto;
      if (add) {
        readForm();
        const it = await pickItem({ title: add === 'include' ? 'Must take…' : 'Leave at home…' });
        if (it && !form[add].includes(it.id)) form[add].push(it.id);
        return draw();
      }
      const rm = t.closest('[data-rm]')?.dataset.rm;
      if (rm) { readForm(); const [l, id] = rm.split(':'); form[l] = form[l].filter((x) => x !== id); return draw(); }
      const tr = t.closest('[data-trip]');
      if (tr) return navigate('travel', { trip: tr.dataset.trip });
      if (t.closest('[data-back]')) return navigate('travel');
      const trip = params.trip && store.get('trips', params.trip);
      if (!trip) return;
      if (t.closest('[data-del]')) {
        if (!(await confirmDialog('Delete this trip and its packing list?', { ok: 'Delete', danger: true }))) return;
        await store.remove('trips', trip.id);
        return navigate('travel');
      }
      const day = t.closest('[data-i]');
      if (day && t.closest('[data-open]')) return navigate('outfit', { id: trip.days[+day.dataset.i].outfitId });
      if (day && t.closest('[data-regen]')) {
        const d = trip.days[+day.dataset.i];
        const capsule = trip.packing.map((p) => store.get('items', p.itemId)).filter(Boolean);
        const cur = store.get('outfits', d.outfitId);
        const ctx = buildCtx({ style: trip.style, occasion: d.occasion, weather: d.weather });
        let res = generateOutfit(capsule, ctx, { avoidSignatures: new Set(cur ? [cur.signature] : []), temperature: 6 });
        if (res.error) return toast(res.error);
        const o = await saveGenerated(res, { style: trip.style, occasion: d.occasion, weather: d.weather, source: 'travel' });
        const days = trip.days.map((x, i) => (i === +day.dataset.i ? { ...x, outfitId: o.id } : x));
        return store.put('trips', { ...trip, days });
      }
      if (t.closest('[data-add-piece]')) {
        const it = await pickItem({ title: 'Add to suitcase', filter: (i) => !trip.packing.some((p) => p.itemId === i.id) });
        if (it) await store.put('trips', { ...trip, packing: [...trip.packing, { itemId: it.id, packed: false }] });
      }
    });
    el.addEventListener('change', async (e) => {
      const trip = params.trip && store.get('trips', params.trip);
      if (!trip) return;
      const p = e.target.dataset.pack, x = e.target.dataset.extra;
      if (p) await store.put('trips', { ...trip, packing: trip.packing.map((q) => (q.itemId === p ? { ...q, packed: e.target.checked } : q)) });
      if (x) await store.put('trips', { ...trip, extras: trip.extras.map((q) => (q.id === x ? { ...q, packed: e.target.checked } : q)) });
    });
    return store.on((c) => (c.has('trips') || c.has('outfits')) && params.trip && draw());
  },
};

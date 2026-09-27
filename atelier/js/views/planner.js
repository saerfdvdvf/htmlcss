// Weekly Planner: generate, lock, regenerate and constrain each day; optional No-Repetition mode.
import { store, outfitItemIds } from '../store.js';
import { generateOutfit } from '../engine.js';
import { buildCtx, weatherFor, defaultOccasion, defaultStyle, loadWeather, onWeather } from '../context.js';
import { STYLES, OCCASIONS, STYLE } from '../constants.js';
import { icon } from '../icons.js';
import { esc, todayISO, addDays, startOfWeek, fmtDate } from '../util.js';
import { outfitBoard, scoreRing, pickItem, saveGenerated, toast, confirmDialog, empty, logWear } from '../ui.js';
import { navigate } from '../router.js';

const dayCfg = (plan, date) => ({
  style: plan?.config?.style || defaultStyle(),
  occasion: plan?.config?.occasion || defaultOccasion(date),
  mustInclude: plan?.config?.mustInclude || null,
  random: !!plan?.config?.random,
});

function usageExcept(week, except) {
  const m = new Map();
  for (const d of week) {
    if (d === except) continue;
    const p = store.get('plans', d);
    const o = p && store.get('outfits', p.outfitId);
    if (o) for (const id of outfitItemIds(o.items)) m.set(id, (m.get(id) || 0) + 1);
  }
  return m;
}

async function genDay(date, week, { usage } = {}) {
  const plan = store.get('plans', date);
  const cfg = dayCfg(plan, date);
  const cur = plan?.outfitId ? store.get('outfits', plan.outfitId) : null;
  const locked = {};
  if (cur && plan.locks) {
    for (const k of ['hoodie', 'tshirt', 'trousers', 'sneakers']) if (plan.locks[k] && cur.items[k]) locked[k] = cur.items[k];
    const acc = (plan.locks.accessory || []).filter((id) => cur.items.accessory.includes(id));
    if (acc.length) locked.accessory = acc;
  }
  const ctx = buildCtx({ style: cfg.random ? 'any' : cfg.style, occasion: cfg.occasion, date });
  const res = generateOutfit(store.all('items'), ctx, {
    locked, mustInclude: cfg.mustInclude, usage: usage || usageExcept(week, date), noRepeat: store.settings.noRepeat,
    avoidSignatures: cur ? new Set([cur.signature]) : undefined, temperature: cfg.random ? 12 : 3.5,
  });
  if (res.error) { toast(res.error); return null; }
  const outfit = await saveGenerated(res, { style: ctx.style, occasion: ctx.occasion, weather: ctx.weather, source: 'weekly' });
  await store.put('plans', { ...(plan || {}), id: date, date, outfitId: outfit.id, config: cfg, locks: plan?.locks || {}, worn: false });
  return outfit;
}

export default {
  render(el, params) {
    const week0 = startOfWeek(params.week || todayISO());
    const week = Array.from({ length: 7 }, (_, i) => addDays(week0, i));
    const today = todayISO();

    const draw = () => {
      const items = store.all('items');
      el.innerHTML = `
      <header class="page-head">
        <div><div class="eyebrow">Plan ahead</div><h1 class="display">Weekly Planner</h1>
          <p class="muted">${fmtDate(week[0], { day: 'numeric', month: 'short' })} – ${fmtDate(week[6], { day: 'numeric', month: 'short', year: 'numeric' })}</p></div>
        <div class="row gap-s wrap">
          <a class="icon-btn bordered" href="#/planner?week=${addDays(week0, -7)}" aria-label="Previous week">${icon('left')}</a>
          <a class="btn ghost sm" href="#/planner">This week</a>
          <a class="icon-btn bordered" href="#/planner?week=${addDays(week0, 7)}" aria-label="Next week">${icon('right')}</a>
        </div>
      </header>
      ${items.length ? `
      <div class="card planner-bar">
        <label class="switch-row"><input type="checkbox" data-norepeat ${store.settings.noRepeat ? 'checked' : ''}><span class="switch"></span><span><b>No repetition</b><small class="muted"> Avoid reusing pieces within the week</small></span></label>
        <div class="row gap-s wrap">
          <button class="btn ghost" data-clear-week>${icon('trash', 16)} Clear week</button>
          <button class="btn primary" data-gen-week>${icon('sparkles', 18)} Generate whole week</button>
        </div>
      </div>
      <div class="week-grid">${week.map((d) => dayCard(d)).join('')}</div>`
      : `<div class="card">${empty('hanger', 'Add clothes to start planning', '', '<a class="btn primary" href="#/wardrobe?add=1">Add clothes</a>')}</div>`}`;
    };

    const dayCard = (d) => {
      const p = store.get('plans', d);
      const cfg = dayCfg(p, d);
      const o = p?.outfitId ? store.get('outfits', p.outfitId) : null;
      const w = weatherFor(d);
      const must = cfg.mustInclude && store.get('items', cfg.mustInclude);
      const locks = p?.locks || {};
      return `<article class="day-card card ${d === today ? 'today' : ''} ${d < today ? 'past' : ''}" data-day="${d}">
        <header class="day-head">
          <div><b>${fmtDate(d, { weekday: 'long' })}</b><span class="muted small"> ${fmtDate(d, { day: 'numeric', month: 'short' })}</span></div>
          <span class="pill" title="${w.assumed ? 'Seasonal estimate' : 'Forecast'}">${icon(w.rain ? 'rain' : w.band === 'hot' || w.band === 'warm' ? 'sun' : w.band === 'cold' ? 'snow' : 'cloud', 13)} ${w.temp != null ? Math.round(w.temp) + '°' : w.band}</span>
        </header>
        <div class="day-controls">
          <select data-f="style" aria-label="Style" ${cfg.random ? 'disabled' : ''}>${STYLES.map((s) => `<option value="${s.id}" ${cfg.style === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}<option value="any" ${cfg.style === 'any' ? 'selected' : ''}>Any style</option></select>
          <select data-f="occasion" aria-label="Occasion">${OCCASIONS.map((x) => `<option value="${x.id}" ${cfg.occasion === x.id ? 'selected' : ''}>${x.label}</option>`).join('')}</select>
        </div>
        <div class="day-controls">
          <button class="chip ${cfg.random ? 'on' : ''}" data-random aria-pressed="${cfg.random}">${icon('shuffle', 14)} Random</button>
          ${must ? `<span class="chip on must"><img src="${esc(must.image)}" alt="">${esc(must.name)}<button data-unmust aria-label="Remove required item">${icon('x', 12)}</button></span>`
                 : `<button class="chip" data-must>${icon('plus', 14)} Must include…</button>`}
        </div>
        <div class="day-outfit">
          ${o ? `${outfitBoard(o.items, { interactive: true, size: 'sm', locks: { ...locks, accessory: locks.accessory || [] } })}
            <div class="day-score" title="${esc(STYLE[o.style]?.label || '')} · score ${o.score?.total}">${scoreRing(o.score?.total, 36)}</div>`
            : `<button class="day-empty" data-gen>${icon('sparkles', 22)}<span>Generate ${fmtDate(d, { weekday: 'short' })}</span></button>`}
        </div>
        ${o ? `<footer class="day-foot">
          <button class="btn soft sm" data-gen>${icon('refresh', 15)} Regenerate</button>
          <button class="icon-btn" data-open aria-label="Open outfit">${icon('eye', 18)}</button>
          ${d <= today ? `<button class="icon-btn ${p.worn ? 'on' : ''}" data-worn aria-label="Mark worn" title="Mark as worn">${icon('check', 18)}</button>` : ''}
          <button class="icon-btn" data-clear aria-label="Clear day">${icon('trash', 18)}</button>
        </footer>` : ''}
      </article>`;
    };

    draw();

    el.addEventListener('change', async (e) => {
      if (e.target.matches('[data-norepeat]')) return store.setSettings({ noRepeat: e.target.checked });
      const f = e.target.dataset.f;
      const d = e.target.closest('[data-day]')?.dataset.day;
      if (f && d) {
        const p = store.get('plans', d);
        await store.put('plans', { ...(p || { id: d, date: d, locks: {} }), config: { ...dayCfg(p, d), [f]: e.target.value } });
      }
    });

    el.addEventListener('click', async (e) => {
      const t = e.target;
      if (t.closest('[data-gen-week]')) {
        const has = week.some((d) => store.get('plans', d)?.outfitId);
        if (has && !(await confirmDialog('Regenerate every day of this week? Locked pieces are kept.', { ok: 'Generate' }))) return;
        const usage = new Map();
        for (const d of week) {
          const o = await genDay(d, week, { usage: store.settings.noRepeat ? new Map(usage) : usageExcept(week, d) });
          if (o) for (const id of outfitItemIds(o.items)) usage.set(id, (usage.get(id) || 0) + 1);
        }
        return toast('Your week is planned');
      }
      if (t.closest('[data-clear-week]')) {
        if (!(await confirmDialog('Remove all outfits planned for this week?', { ok: 'Clear', danger: true }))) return;
        return store.removeMany('plans', week.filter((d) => store.get('plans', d)));
      }
      const card = t.closest('[data-day]');
      if (!card) return;
      const d = card.dataset.day;
      const p = store.get('plans', d);
      if (t.closest('[data-lock]')) {
        const b = t.closest('[data-lock]');
        const locks = { accessory: [], ...(p.locks || {}) };
        if (b.dataset.lock === 'accessory') locks.accessory = locks.accessory.includes(b.dataset.id) ? locks.accessory.filter((x) => x !== b.dataset.id) : [...locks.accessory, b.dataset.id];
        else locks[b.dataset.lock] = !locks[b.dataset.lock];
        return store.put('plans', { ...p, locks });
      }
      if (t.closest('[data-gen]')) { card.classList.add('busy'); await genDay(d, week); return; }
      if (t.closest('[data-random]')) {
        const cfg = dayCfg(p, d);
        return store.put('plans', { ...(p || { id: d, date: d, locks: {} }), config: { ...cfg, random: !cfg.random } });
      }
      if (t.closest('[data-must]')) {
        const it = await pickItem({ title: `Must include on ${fmtDate(d, { weekday: 'long' })}` });
        if (!it) return;
        await store.put('plans', { ...(p || { id: d, date: d, locks: {} }), config: { ...dayCfg(p, d), mustInclude: it.id } });
        return genDay(d, week);
      }
      if (t.closest('[data-unmust]')) return store.put('plans', { ...p, config: { ...dayCfg(p, d), mustInclude: null } });
      if (t.closest('[data-open]')) return navigate('outfit', { id: p.outfitId });
      if (t.closest('[data-clear]')) return store.remove('plans', d);
      if (t.closest('[data-worn]')) {
        const o = store.get('outfits', p.outfitId);
        if (!p.worn && o) await logWear(o, d);
        if (p.worn) {
          const ws = store.all('wears').filter((w) => w.date === d && w.outfitId === p.outfitId);
          await store.removeMany('wears', ws.map((w) => w.id));
        }
        return store.put('plans', { ...p, worn: !p.worn });
      }
    });

    const off = store.on((c) => (c.has('plans') || c.has('items') || c.has('outfits')) && draw());
    const offW = onWeather(draw);
    loadWeather();
    return () => { off(); offW(); };
  },
};

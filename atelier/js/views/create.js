// Create Outfit: what → style → optional filters → result studio.
import { store } from '../store.js';
import { STYLES, OCCASIONS, WEATHER_BANDS, SEASONS, CAT } from '../constants.js';
import { generateOutfit } from '../engine.js';
import { buildCtx, weatherFor, defaultOccasion } from '../context.js';
import { mountStudio } from '../studio.js';
import { icon } from '../icons.js';
import { esc, cap, todayISO } from '../util.js';
import { chip, bindChips, pickItem, saveGenerated, empty, swatch } from '../ui.js';
import { NAMED } from '../color.js';
import { navigate, setHash } from '../router.js';

const MODES = [
  { id: 'create', icon: 'sparkles', title: 'Create an outfit', text: 'Pick a style and occasion; we do the rest.' },
  { id: 'weekly', icon: 'week', title: 'Create weekly outfits', text: 'Seven days planned, with optional no-repeat.' },
  { id: 'surprise', icon: 'shuffle', title: 'Surprise me', text: 'A random look you might not have thought of.' },
  { id: 'item', icon: 'hanger', title: 'Use a specific item', text: 'Build the best outfit around one piece.' },
  { id: 'preview', icon: 'user', title: 'Preview an outfit on me', text: 'See a look on your own photo.' },
];
const STYLE_ICON = { casual: 'hanger', 'smart-casual': 'star', formal: 'tag', streetwear: 'layers', sporty: 'thermo', any: 'shuffle' };

const fresh = () => ({
  step: 'mode', mode: 'create', style: null, item: null,
  occasion: null, weather: 'auto', season: null, include: [], avoid: [],
  accessories: store.settings.accessories, layering: store.settings.layering, leastWorn: false, favOnly: false,
});
let S = null;

export default {
  render(el, params) {
    if (!S || params.reset) S = fresh();
    if (params.mode === 'surprise') { S = fresh(); S.mode = 'surprise'; S.style = 'any'; S.step = 'result'; setHash('create'); }
    if (params.item && store.get('items', params.item)) { S = fresh(); S.mode = 'item'; S.item = params.item; S.step = 'style'; setHash('create'); }
    if (!S.occasion) S.occasion = defaultOccasion();

    const items = store.all('items');
    if (!items.length) {
      el.innerHTML = `<header class="page-head"><div><div class="eyebrow">Stylist</div><h1 class="display">Create Outfit</h1></div></header>
        <div class="card">${empty('hanger', 'Add clothes first', 'Atelier needs at least a top, trousers and sneakers to style you.', `<a class="btn primary" href="#/wardrobe?add=1">${icon('camera', 18)} Add clothes</a>`)}</div>`;
      return;
    }

    const go = (step) => { S.step = step; draw(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const steps = ['mode', 'style', 'filters', 'result'];

    function header(title, sub) {
      const idx = steps.indexOf(S.step);
      return `<header class="page-head create-head">
        <div>${idx > 0 ? `<button class="back" data-back>${icon('left', 18)} Back</button>` : '<div class="eyebrow">Your stylist</div>'}
        <h1 class="display">${title}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}</div>
        <ol class="stepper" aria-label="Progress">${['What', 'Style', 'Details', 'Outfit'].map((s, i) => `<li class="${i < idx ? 'done' : i === idx ? 'now' : ''}">${s}</li>`).join('')}</ol>
      </header>`;
    }

    function selectedItemBanner() {
      const it = S.item && store.get('items', S.item);
      if (!it) return '';
      return `<div class="card anchor-item"><img src="${esc(it.image)}" alt=""><div><div class="eyebrow">Building around</div><b>${esc(it.name)}</b><div class="muted small">${esc(CAT[it.category].label)} · stays in every result</div></div>
        <button class="btn ghost sm" data-change-item>Change</button></div>`;
    }

    function draw() {
      if (S.step === 'mode') {
        el.innerHTML = header('What do you want to do?') + `
          <div class="mode-grid">${MODES.map((m) => `
            <button class="mode-card" data-mode="${m.id}">${icon(m.icon, 26)}<b>${m.title}</b><small>${m.text}</small>${icon('right', 18, 'go')}</button>`).join('')}</div>`;
      } else if (S.step === 'style') {
        el.innerHTML = header('Choose your style', S.mode === 'surprise' ? '' : 'Everything else is optional.') + selectedItemBanner() + `
          <div class="style-grid">${[...STYLES, { id: 'any', label: 'Any style', blurb: 'Let Atelier decide' }].map((s) => `
            <button class="style-card ${S.style === s.id ? 'on' : ''}" data-style="${s.id}"><span class="st-ic">${icon(STYLE_ICON[s.id], 22)}</span><b>${s.label}</b><small>${s.blurb}</small></button>`).join('')}</div>`;
      } else if (S.step === 'filters') {
        const w = weatherFor(todayISO());
        const colorNames = [...new Set(items.flatMap((i) => (i.colors || []).slice(0, 1).map((c) => c.name)))].sort();
        el.innerHTML = header('Fine-tune (optional)', 'Skip straight to generate, or tell us more.') + selectedItemBanner() + `
          <div class="filters card">
            <div class="field"><span>${icon('pin', 15)} Occasion</span><div class="chips">${OCCASIONS.map((o) => chip(o.label, { value: o.id, name: 'occ', active: S.occasion === o.id })).join('')}</div></div>
            <div class="field"><span>${icon('thermo', 15)} Weather</span><div class="chips">
              ${chip(`Auto · ${w.temp != null ? Math.round(w.temp) + '° ' : ''}${w.band}${w.assumed ? ' (seasonal)' : ''}`, { value: 'auto', name: 'wx', active: S.weather === 'auto' })}
              ${WEATHER_BANDS.map((b) => chip(`${b.label} <small>${b.range}</small>`, { value: b.id, name: 'wx', active: S.weather === b.id })).join('')}
              ${chip('Ignore', { value: 'none', name: 'wx', active: S.weather === 'none' })}</div></div>
            <div class="field"><span>Season</span><div class="chips">${chip('Current', { value: '', name: 'season', active: !S.season })}${SEASONS.map((s) => chip(cap(s), { value: s, name: 'season', active: S.season === s })).join('')}</div></div>
            <div class="field"><span>${icon('palette', 15)} Include a colour</span><div class="chips">${colorNames.map((n) => chip(`${swatch(NAMED[n]?.hex || '#888', 12)} ${n}`, { value: n, name: 'inc', active: S.include.includes(n) })).join('')}</div></div>
            <div class="field"><span>Avoid colours</span><div class="chips">${colorNames.map((n) => chip(`${swatch(NAMED[n]?.hex || '#888', 12)} ${n}`, { value: n, name: 'avoid', active: S.avoid.includes(n) })).join('')}</div></div>
            <div class="toggles">
              <label class="switch-row"><input type="checkbox" data-t="accessories" ${S.accessories ? 'checked' : ''}><span class="switch"></span><span>Add accessories</span></label>
              <label class="switch-row"><input type="checkbox" data-t="layering" ${S.layering ? 'checked' : ''}><span class="switch"></span><span>Allow layering (T-shirt under hoodie)</span></label>
              <label class="switch-row"><input type="checkbox" data-t="leastWorn" ${S.leastWorn ? 'checked' : ''}><span class="switch"></span><span>Prefer least-worn pieces</span></label>
              <label class="switch-row"><input type="checkbox" data-t="favOnly" ${S.favOnly ? 'checked' : ''}><span class="switch"></span><span>Prefer my favourite pieces</span></label>
            </div>
            <p class="muted small">${icon('laundry', 14)} ${items.filter((i) => i.status && i.status !== 'available').length} items in the laundry or unavailable are skipped automatically.</p>
          </div>
          <div class="sticky-cta"><button class="btn primary lg block" data-generate>${icon('sparkles', 20)} Generate outfit</button></div>`;
        bindChips(el, 'occ', { onChange: (v) => (S.occasion = v) });
        bindChips(el, 'wx', { onChange: (v) => (S.weather = v) });
        bindChips(el, 'season', { onChange: (v) => (S.season = v || null) });
        bindChips(el, 'inc', { multi: true, onChange: (v) => (S.include = v) });
        bindChips(el, 'avoid', { multi: true, onChange: (v) => (S.avoid = v) });
        el.querySelectorAll('[data-t]').forEach((c) => (c.onchange = () => (S[c.dataset.t] = c.checked)));
      } else if (S.step === 'result') {
        el.innerHTML = header(S.mode === 'surprise' ? 'Surprise!' : 'Your outfit') + `<div data-studio><div class="skeleton" style="height:480px"></div></div>
          <div class="row gap center result-foot"><button class="btn ghost" data-back>${icon('filter', 16)} Adjust</button><button class="btn ghost" data-restart>${icon('refresh', 16)} Start over</button></div>`;
        generate();
      }
    }

    function ctxNow() {
      let weather;
      if (S.weather === 'none') weather = null;
      else if (S.weather === 'auto') weather = weatherFor(todayISO());
      else { const b = WEATHER_BANDS.find((x) => x.id === S.weather); weather = { band: b.id, temp: null, season: weatherFor().season }; }
      if (weather && S.season) weather = { ...weather, season: S.season };
      return buildCtx({ style: S.style || 'any', occasion: S.occasion, weather, colorPrefs: { include: S.include, avoid: S.avoid }, preferLeastWorn: S.leastWorn, onlyFavorites: S.favOnly });
    }

    async function generate() {
      const ctx = { ...ctxNow(), accessories: S.accessories, layering: S.layering };
      const surprise = S.mode === 'surprise';
      const res = generateOutfit(store.all('items'), ctx, { mustInclude: S.item, temperature: surprise ? 14 : 3.5 });
      const host = el.querySelector('[data-studio]');
      if (res.error) { host.innerHTML = `<div class="card">${empty('info', "Couldn't build an outfit", esc(res.error))}</div>`; return; }
      const outfit = await saveGenerated(res, { style: ctx.style, occasion: ctx.occasion, weather: ctx.weather, source: surprise ? 'surprise' : S.item ? 'item' : 'create' });
      mountStudio(host, outfit, ctx, { mustInclude: S.item, source: 'create' });
    }

    el.onclick = async (e) => {
      const t = e.target;
      if (t.closest('[data-back]')) return go(steps[Math.max(0, steps.indexOf(S.step) - 1)]);
      if (t.closest('[data-restart]')) { S = fresh(); return draw(); }
      const mode = t.closest('[data-mode]')?.dataset.mode;
      if (mode) {
        if (mode === 'weekly') return navigate('planner');
        if (mode === 'preview') return navigate('preview');
        S.mode = mode;
        S.item = null;
        if (mode === 'surprise') { S.style = 'any'; return go('result'); }
        if (mode === 'item') {
          const it = await pickItem({ title: 'Which piece should the outfit be built around?' });
          if (!it) return;
          S.item = it.id;
        }
        return go('style');
      }
      if (t.closest('[data-change-item]')) {
        const it = await pickItem({ title: 'Build around…' });
        if (it) { S.item = it.id; draw(); }
        return;
      }
      const st = t.closest('[data-style]')?.dataset.style;
      if (st) { S.style = st; return go('filters'); }
      if (t.closest('[data-generate]')) return go('result');
    };
    draw();
  },
};

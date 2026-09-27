// Calendar: month view of planned/worn outfits; assign, change, view and manage days.
import { store } from '../store.js';
import { generateOutfit } from '../engine.js';
import { buildCtx, defaultOccasion, defaultStyle } from '../context.js';
import { icon } from '../icons.js';
import { esc, todayISO, addDays, startOfWeek, fmtDate, parseISO } from '../util.js';
import { outfitBoard, scoreRing, openSheet, outfitCard, saveGenerated, toast, logWear, empty } from '../ui.js';
import { navigate, setHash } from '../router.js';
import { STYLE, OCCASION } from '../constants.js';

function chooseOutfit(date) {
  const favs = store.all('outfits').filter((o) => o.favorite).sort((a, b) => b.updatedAt - a.updatedAt);
  const hist = store.all('outfits').filter((o) => !o.favorite).sort((a, b) => b.createdAt - a.createdAt).slice(0, 30);
  return openSheet({
    title: `Outfit for ${fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}`, wide: true,
    body: `<button class="btn primary block" data-new>${icon('sparkles', 18)} Generate a new outfit</button>
      <h4 class="sub-h">Favourites</h4><div class="grid outfits-grid sm">${favs.map((o) => outfitCard(o, { showDate: false })).join('') || '<p class="muted small">No favourites yet.</p>'}</div>
      <h4 class="sub-h">Recent</h4><div class="grid outfits-grid sm">${hist.map((o) => outfitCard(o)).join('') || '<p class="muted small">No history yet.</p>'}</div>`,
    onMount(b, close) {
      b.querySelector('[data-new]').onclick = () => close('new');
      b.addEventListener('click', (e) => {
        if (e.target.closest('[data-ofav]')) return;
        const c = e.target.closest('[data-outfit]');
        if (c) close(c.dataset.outfit);
      });
    },
  }).result;
}

export async function assign(date, choice) {
  if (!choice) return;
  let outfitId = choice;
  if (choice === 'new') {
    const ctx = buildCtx({ style: defaultStyle(), occasion: defaultOccasion(date), date });
    const res = generateOutfit(store.all('items'), ctx);
    if (res.error) return toast(res.error);
    outfitId = (await saveGenerated(res, { style: ctx.style, occasion: ctx.occasion, weather: ctx.weather, source: 'calendar' })).id;
  }
  const p = store.get('plans', date);
  await store.put('plans', { ...(p || {}), id: date, date, outfitId, worn: false });
  toast(`Planned for ${fmtDate(date)}`);
}

export default {
  render(el, params) {
    const today = todayISO();
    let sel = params.date || today;
    let month = (params.month || sel).slice(0, 7);

    const draw = () => {
      const first = parseISO(month + '-01');
      const gridStart = startOfWeek(month + '-01');
      const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
      const lastRowNeeded = days.slice(35).some((d) => d.slice(0, 7) === month);
      const cells = lastRowNeeded ? days : days.slice(0, 35);
      const prevM = addDays(month + '-01', -1).slice(0, 7);
      const nextM = addDays(month + '-28', 7).slice(0, 7);
      const p = store.get('plans', sel);
      const o = p && store.get('outfits', p.outfitId);
      const planned = store.all('plans').filter((x) => x.date.startsWith(month) && store.get('outfits', x.outfitId)).length;
      el.innerHTML = `
        <header class="page-head">
          <div><div class="eyebrow">${planned} outfit${planned === 1 ? '' : 's'} planned</div><h1 class="display">${first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h1></div>
          <div class="row gap-s">
            <button class="icon-btn bordered" data-m="${prevM}" aria-label="Previous month">${icon('left')}</button>
            <button class="btn ghost sm" data-m="${today.slice(0, 7)}" data-today>Today</button>
            <button class="icon-btn bordered" data-m="${nextM}" aria-label="Next month">${icon('right')}</button>
          </div>
        </header>
        <div class="cal-layout">
          <div class="card cal">
            <div class="cal-head">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<span>${d}</span>`).join('')}</div>
            <div class="cal-grid">${cells.map((d) => {
              const pl = store.get('plans', d);
              const oo = pl && store.get('outfits', pl.outfitId);
              const top = oo && store.get('items', oo.items.hoodie || oo.items.tshirt);
              return `<button class="cal-cell ${d.slice(0, 7) !== month ? 'out' : ''} ${d === today ? 'today' : ''} ${d === sel ? 'sel' : ''}" data-d="${d}" aria-label="${fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}${oo ? ', outfit planned' : ''}">
                <span class="cal-num">${+d.slice(8)}</span>
                ${top ? `<img src="${esc(top.image)}" alt="">` : ''}
                ${pl?.worn ? `<i class="cal-worn">${icon('check', 10)}</i>` : ''}</button>`;
            }).join('')}</div>
          </div>
          <aside class="card cal-day">
            <div class="eyebrow">${sel === today ? 'Today' : fmtDate(sel, { weekday: 'long' })}</div>
            <h3>${fmtDate(sel, { day: 'numeric', month: 'long', year: 'numeric' })}</h3>
            ${o ? `
              ${outfitBoard(o.items, { size: 'md' })}
              <div class="row gap-s cal-score">${scoreRing(o.score?.total, 44)}<div><b>${esc(o.score?.verdict || '')}</b><div class="muted small">${esc(STYLE[o.style]?.label || '')}${o.occasion ? ' · ' + esc(OCCASION[o.occasion]?.label) : ''}</div></div></div>
              <div class="row gap-s wrap">
                <button class="btn primary sm" data-open>${icon('eye', 15)} Open</button>
                <button class="btn soft sm" data-change>${icon('refresh', 15)} Change</button>
                ${sel <= today ? `<button class="btn soft sm ${p.worn ? 'on' : ''}" data-worn>${icon('check', 15)} ${p.worn ? 'Worn' : 'Mark worn'}</button>` : ''}
                <button class="btn ghost sm danger-text" data-remove>${icon('trash', 15)} Remove</button>
              </div>`
              : `${empty('calendar', 'Nothing planned', 'Assign a favourite, pick from history or generate a new look.')}
                 <div class="row gap-s center"><button class="btn primary" data-change>${icon('plus', 16)} Add outfit</button><a class="btn ghost" href="#/planner?week=${startOfWeek(sel)}">Plan this week</a></div>`}
          </aside>
        </div>`;
    };
    draw();

    el.addEventListener('click', async (e) => {
      const m = e.target.closest('[data-m]');
      if (m) { month = m.dataset.m; if (m.hasAttribute('data-today')) sel = today; setHash('calendar', { date: sel, month }); return draw(); }
      const c = e.target.closest('[data-d]');
      if (c) { sel = c.dataset.d; if (sel.slice(0, 7) !== month) month = sel.slice(0, 7); setHash('calendar', { date: sel }); return draw(); }
      const p = store.get('plans', sel);
      if (e.target.closest('[data-change]')) return assign(sel, await chooseOutfit(sel));
      if (e.target.closest('[data-open]')) return navigate('outfit', { id: p.outfitId });
      if (e.target.closest('[data-remove]')) return store.remove('plans', sel);
      if (e.target.closest('[data-worn]')) {
        const o = store.get('outfits', p.outfitId);
        if (!p.worn && o) await logWear(o, sel);
        if (p.worn) {
          const ws = store.all('wears').filter((w) => w.date === sel && w.outfitId === p.outfitId);
          await store.removeMany('wears', ws.map((w) => w.id));
        }
        return store.put('plans', { ...p, worn: !p.worn });
      }
    });
    return store.on((c) => (c.has('plans') || c.has('outfits') || c.has('items')) && draw());
  },
};

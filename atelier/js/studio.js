// The outfit studio: shows an outfit with its score and lets the user lock, swap and regenerate.
import { store, outfitItemIds } from './store.js';
import { generateOutfit, alternativesFor, rescore, signatureOf } from './engine.js';
import { CAT, STYLE, OCCASION, BAND_LABEL } from './constants.js';
import { icon } from './icons.js';
import { esc, todayISO } from './util.js';
import { outfitBoard, scoreRing, scoreBars, openSheet, toast, saveGenerated, logWear, planOutfit, pickDate, swatch, imgOf } from './ui.js';
import { nameColor, colorLabel } from './color.js';
import { navigate } from './router.js';

/**
 * @param el        container
 * @param outfit    saved outfit record
 * @param ctx       engine context used for regeneration/scoring
 * @param opts      { mustInclude, onChange(outfit), source, actions: ['regen','fav','plan','wear','preview'], headline }
 */
export function mountStudio(el, outfit, ctx, opts = {}) {
  let current = outfit;
  const seen = new Set([outfit.signature || signatureOf(outfit.items)]);
  let locks = { accessory: [] };
  if (opts.mustInclude) {
    const it = store.get('items', opts.mustInclude);
    if (it) it.category === 'accessory' ? locks.accessory.push(it.id) : (locks[it.category] = true);
  }
  const actions = opts.actions || ['regen', 'fav', 'plan', 'wear', 'preview'];

  const lockedIds = () => {
    const l = {};
    for (const k of ['hoodie', 'tshirt', 'trousers', 'sneakers']) if (locks[k] && current.items[k]) l[k] = current.items[k];
    const acc = locks.accessory.filter((id) => current.items.accessory.includes(id));
    if (acc.length) l.accessory = acc;
    return l;
  };

  async function replace(res, source = 'regenerate') {
    const saved = await saveGenerated(res, { style: ctx.style, occasion: ctx.occasion, weather: ctx.weather, source: opts.source || source });
    current = saved;
    seen.add(saved.signature);
    render();
    opts.onChange?.(saved);
  }

  async function regenerate() {
    const items = store.all('items');
    const res = generateOutfit(items, ctx, { locked: lockedIds(), avoidSignatures: seen, temperature: 5 });
    if (res.error) return toast(res.error);
    if (seen.has(res.signature)) toast('Era la mejor combinación que quedaba: desbloquea alguna prenda para tener más variedad.');
    await replace(res);
  }

  function swap(slot) {
    const alts = alternativesFor(slot, current.items, store.all('items'), ctx, 16);
    const cur = slot === 'accessory' ? null : current.items[slot];
    const canRemove = (slot === 'hoodie' && current.items.tshirt) || (slot === 'tshirt' && current.items.hoodie);
    openSheet({
      title: `Cambiar ${CAT[slot].label.toLowerCase()}`, wide: true,
      body: `<p class="muted small">Ordenadas según lo bien que combina cada prenda con el resto del outfit.</p>
      <div class="alt-list">${alts.map((a) => `
        <button class="alt ${a.item.id === cur ? 'current' : ''}" data-id="${esc(a.item.id)}">
          <img src="${esc(imgOf(a.item))}" alt=""><span class="alt-name">${esc(a.item.name)}</span>
          <span class="alt-score">${a.total}</span></button>`).join('') || '<p class="muted">No hay alternativas disponibles.</p>'}</div>
      ${canRemove ? `<button class="btn ghost block" data-remove>${icon('x', 16)} Quitar esta capa</button>` : ''}`,
      async onMount(b, close) {
        b.querySelectorAll('.alt').forEach((btn) => (btn.onclick = async () => {
          close();
          const it = store.get('items', btn.dataset.id);
          const ids = { ...current.items, accessory: [...current.items.accessory] };
          if (slot === 'accessory') ids.accessory = [...ids.accessory.filter((id) => store.get('items', id)?.subtype !== it.subtype), it.id];
          else ids[slot] = it.id;
          await replace({ items: ids, score: rescore(ids, store.all('items'), ctx), signature: signatureOf(ids) }, 'edit');
        }));
        b.querySelector('[data-remove]')?.addEventListener('click', async () => {
          close();
          const ids = { ...current.items, [slot]: null };
          await replace({ items: ids, score: rescore(ids, store.all('items'), ctx), signature: signatureOf(ids) }, 'edit');
        });
      },
    });
  }

  function render() {
    const o = current;
    const s = o.score || rescore(o.items, store.all('items'), ctx);
    const pieces = [...['hoodie', 'tshirt', 'trousers', 'sneakers'].map((k) => [k, o.items[k]]), ...o.items.accessory.map((id) => ['accessory', id])]
      .filter(([, id]) => id).map(([slot, id]) => [slot, store.get('items', id)]).filter(([, it]) => it);
    const isLocked = (slot, id) => (slot === 'accessory' ? locks.accessory.includes(id) : !!locks[slot]);
    const w = ctx.weather;
    el.innerHTML = `
    <div class="studio">
      <div class="studio-stage card">
        ${opts.headline ? `<div class="stage-head">${opts.headline}</div>` : ''}
        ${outfitBoard(o.items, { interactive: true, locks: { ...Object.fromEntries(['hoodie', 'tshirt', 'trousers', 'sneakers'].map((k) => [k, !!locks[k]])), accessory: locks.accessory } })}
        <div class="palette-strip">${(s.palette || []).map((h) => `<span style="--c:${h}" title="${esc(colorLabel(nameColor(h)))}"></span>`).join('')}</div>
      </div>
      <div class="studio-side">
        <div class="card score-card">
          <div class="score-head">
            ${scoreRing(s.total, 76)}
            <div>
              <div class="eyebrow">Puntuación del outfit</div>
              <div class="verdict">${esc(s.verdict || '')}</div>
              <div class="pills">
                ${s.style ? `<span class="pill">${esc(STYLE[s.style]?.label || s.style)}</span>` : ''}
                ${ctx.occasion ? `<span class="pill">${esc(OCCASION[ctx.occasion]?.label)}</span>` : ''}
                ${w ? `<span class="pill">${icon(w.band === 'hot' || w.band === 'warm' ? 'sun' : w.band === 'cold' ? 'snow' : 'cloud', 13)} ${w.temp != null ? Math.round(w.temp) + '° ' : ''}${esc(BAND_LABEL[w.band] || w.band)}${w.assumed ? ' (estimado)' : ''}</span>` : ''}
              </div>
            </div>
          </div>
          <ul class="why">${(s.reasons || []).map((r) => `<li>${icon('check', 16)}<span>${esc(r)}</span></li>`).join('')}
          ${(s.tips || []).map((r) => `<li class="tip">${icon('bulb', 16)}<span>${esc(r)}</span></li>`).join('')}</ul>
          <details class="breakdown"><summary>Desglose de la puntuación</summary>${scoreBars(s)}</details>
        </div>
        <div class="card pieces">
          <div class="pieces-head"><span class="eyebrow">Prendas</span><span class="muted small">Bloquea lo que te guste y regenera el resto</span></div>
          ${pieces.map(([slot, it]) => `
            <div class="piece-row ${isLocked(slot, it.id) ? 'locked' : ''}">
              <img src="${esc(imgOf(it))}" alt="">
              <div class="pr-text"><div class="pr-name">${esc(it.name)}</div><div class="muted small">${swatch(it.colors?.[0]?.hex || '#888', 9)} ${esc(CAT[slot].label)}${it.brand ? ' · ' + esc(it.brand) : ''}</div></div>
              <button class="icon-btn ${isLocked(slot, it.id) ? 'on' : ''}" data-lock="${slot}" data-id="${esc(it.id)}" aria-pressed="${isLocked(slot, it.id)}" aria-label="${isLocked(slot, it.id) ? 'Desbloquear' : 'Bloquear'}">${icon(isLocked(slot, it.id) ? 'lock' : 'unlock', 18)}</button>
              <button class="icon-btn" data-swap="${slot}" aria-label="Cambiar">${icon('shuffle', 18)}</button>
            </div>`).join('')}
          <div class="row gap-s wrap add-row">
            ${!o.items.hoodie ? `<button class="btn soft sm" data-swap="hoodie">${icon('plus', 14)} Capa de sudadera</button>` : ''}
            ${!o.items.tshirt ? `<button class="btn soft sm" data-swap="tshirt">${icon('plus', 14)} Camiseta</button>` : ''}
            <button class="btn soft sm" data-swap="accessory">${icon('plus', 14)} Accesorio</button>
          </div>
        </div>
        <div class="studio-actions">
          ${actions.includes('regen') ? `<button class="btn primary grow" data-act="regen">${icon('refresh', 18)} Regenerar</button>` : ''}
          ${actions.includes('fav') ? `<button class="btn ${o.favorite ? 'on-fav' : 'ghost'}" data-act="fav" aria-label="Favorito">${icon('heart', 18)} ${o.favorite ? 'Guardado' : 'Guardar'}</button>` : ''}
          ${actions.includes('plan') ? `<button class="btn ghost" data-act="plan">${icon('calendar', 18)} Planificar</button>` : ''}
          ${actions.includes('wear') ? `<button class="btn ghost" data-act="wear">${icon('hanger', 18)} Me lo pongo hoy</button>` : ''}
          ${actions.includes('preview') && store.settings.tryOn ? `<button class="btn ghost" data-act="preview">${icon('user', 18)} Probármelo</button>` : ''}
        </div>
      </div>
    </div>`;
  }

  el.addEventListener('click', async (e) => {
    const lockBtn = e.target.closest('[data-lock]');
    if (lockBtn) {
      const slot = lockBtn.dataset.lock, id = lockBtn.dataset.id;
      if (slot === 'accessory') locks.accessory = locks.accessory.includes(id) ? locks.accessory.filter((x) => x !== id) : [...locks.accessory, id];
      else locks[slot] = !locks[slot];
      return render();
    }
    const sw = e.target.closest('[data-swap]');
    if (sw) return swap(sw.dataset.swap);
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'regen') {
      e.target.closest('button').classList.add('spin');
      await regenerate();
    } else if (act === 'fav') {
      current = await store.patch('outfits', current.id, { favorite: !current.favorite });
      toast(current.favorite ? 'Guardado en favoritos' : 'Quitado de favoritos');
      render();
      opts.onChange?.(current);
    } else if (act === 'plan') {
      const d = await pickDate({ title: 'Añadir al calendario' });
      if (d) await planOutfit(current, d);
    } else if (act === 'wear') {
      await logWear(current, todayISO());
      const plan = store.get('plans', todayISO());
      if (!plan || plan.outfitId !== current.id) await store.put('plans', { ...(plan || {}), id: todayISO(), date: todayISO(), outfitId: current.id, worn: true });
      else await store.patch('plans', plan.id, { worn: true });
    } else if (act === 'preview') {
      navigate('preview', { outfit: current.id });
    }
  });

  render();
  return { get outfit() { return current; }, render, regenerate };
}

export { outfitItemIds };

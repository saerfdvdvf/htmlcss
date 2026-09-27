// Shopping mode: wardrobe gap analysis → targeted, non-duplicate suggestions.
import { store } from '../store.js';
import { shoppingSuggestions, IDEAL_MIX } from '../planning.js';
import { garmentDataURL } from '../garments.js';
import { CAT, STYLE, CATEGORIES } from '../constants.js';
import { icon } from '../icons.js';
import { esc } from '../util.js';
import { empty, swatch } from '../ui.js';
import { openItemEditor, blankItem } from './item-editor.js';
import { guessStyles } from '../engine.js';
import { nameColor } from '../color.js';

export default {
  render(el) {
    const items = store.all('items');
    el.innerHTML = `
      <header class="page-head"><div><div class="eyebrow">Smart shopping</div><h1 class="display">Shopping</h1>
        <p class="muted">Suggestions come from your own wardrobe: pieces that would unlock the most new outfits — never duplicates of what you own.</p></div></header>
      <div data-body>${items.length ? '<div class="analyzing"><div class="spinner"></div><p>Analysing thousands of combinations…</p></div>' : `<div class="card">${empty('bag', 'Nothing to analyse yet', 'Add a few clothes first — suggestions are based on what you already own.', '<a class="btn primary" href="#/wardrobe?add=1">Add clothes</a>')}</div>`}</div>`;
    if (!items.length) return;

    setTimeout(() => {
      const { suggestions, orphans } = shoppingSuggestions(items);
      const counts = Object.fromEntries(CATEGORIES.map((c) => [c.id, items.filter((i) => i.category === c.id).length]));
      const total = items.length;
      const orphanItems = orphans.map((id) => store.get('items', id)).filter(Boolean);
      el.querySelector('[data-body]').innerHTML = `
        <section class="card balance">
          <h3>Wardrobe balance</h3>
          <div class="balance-grid">${CATEGORIES.map((c) => {
            const share = total ? counts[c.id] / total : 0;
            const ideal = IDEAL_MIX[c.id];
            const status = counts[c.id] === 0 ? 'missing' : share < ideal * 0.6 ? 'low' : share > ideal * 1.7 ? 'high' : 'ok';
            return `<div class="bal ${status}"><b>${counts[c.id]}</b><span>${c.plural}</span>
              <div class="bal-track" title="${Math.round(share * 100)}% of wardrobe · balanced ≈ ${Math.round(ideal * 100)}%"><i style="width:${Math.min(100, (share / (ideal * 2)) * 100)}%"></i><em style="left:50%"></em></div>
              <small>${status === 'missing' ? 'Missing' : status === 'low' ? 'Could use more' : status === 'high' ? 'Plenty' : 'Balanced'}</small></div>`;
          }).join('')}</div>
        </section>
        <div class="section-head"><h2>Top picks for your wardrobe</h2><span class="muted small">Ranked by new outfits unlocked</span></div>
        <div class="shop-grid">${suggestions.map((s, i) => `
          <article class="card shop-card">
            <div class="shop-img"><img src="${garmentDataURL(s.category, s.hex, s.subtype)}" alt=""><span class="rank">#${i + 1}</span></div>
            <div class="shop-body">
              <div class="eyebrow">${esc(CAT[s.category].label)} · ${s.styles.slice(0, 2).map((x) => STYLE[x]?.label).join(', ')}</div>
              <h3>${swatch(s.hex, 12)} ${esc(s.colorName)} ${esc(s.subtype)}</h3>
              <ul class="why">${s.reasons.map((r) => `<li>${icon('check', 15)}<span>${esc(r)}</span></li>`).join('')}</ul>
              ${s.partners.length ? `<div class="partners"><span class="muted small">Works with</span>${s.partners.map((id) => { const it = store.get('items', id); return it ? `<img src="${esc(it.image)}" alt="${esc(it.name)}" title="${esc(it.name)}">` : ''; }).join('')}</div>` : ''}
              <div class="row gap-s wrap">
                <a class="btn soft sm" target="_blank" rel="noopener" href="https://www.google.com/search?tbm=shop&q=${encodeURIComponent(`${s.colorName} ${s.subtype} ${s.category === 'tshirt' ? 't-shirt' : s.category === 'accessory' ? '' : s.category}`.trim())}">${icon('search', 14)} Find it</a>
                <button class="btn ghost sm" data-own="${i}">${icon('plus', 14)} I bought it</button>
              </div>
            </div>
          </article>`).join('') || `<div class="card">${empty('check', 'Your wardrobe is well rounded', 'We could not find a piece that would add much right now.')}</div>`}</div>
        ${orphanItems.length ? `<section class="card"><h3>Hard to match right now</h3><p class="muted small">These pieces don't yet form a high-scoring outfit — the picks above take them into account.</p>
          <div class="match-row">${orphanItems.map((it) => `<span class="match"><img src="${esc(it.image)}" alt=""><span>${esc(it.name)}</span></span>`).join('')}</div></section>` : ''}`;
      el.querySelector('[data-body]').addEventListener('click', (e) => {
        const b = e.target.closest('[data-own]');
        if (!b) return;
        const s = suggestions[+b.dataset.own];
        const it = blankItem(s.category, s.hex);
        it.subtype = s.subtype;
        it.image = garmentDataURL(s.category, s.hex, s.subtype);
        it.name = `${s.colorName} ${s.subtype}`;
        it.colors = [{ hex: s.hex, name: nameColor(s.hex), pct: 100 }];
        it.styles = guessStyles(s.category, s.subtype, 'solid', s.hex);
        openItemEditor(it, { isNew: true });
      });
    }, 30);
  },
};

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
import { nameColor, colorLabel } from '../color.js';

const NOUN = {
  pullover: 'Sudadera con capucha', 'crewneck sweatshirt': 'Sudadera de cuello redondo', 'zip-up': 'Sudadera con cremallera',
  tee: 'Camiseta básica', polo: 'Polo', 'long sleeve': 'Camiseta de manga larga',
  jeans: 'Vaqueros', chinos: 'Chinos', tailored: 'Pantalón de vestir', cargo: 'Pantalón cargo', joggers: 'Joggers',
  'minimal leather': 'Zapatillas de piel minimalistas', runner: 'Zapatillas de running', 'low-top': 'Zapatillas bajas', chunky: 'Zapatillas chunky',
  watch: 'Reloj', belt: 'Cinturón', cap: 'Gorra', beanie: 'Gorro', bag: 'Bolso',
};
const noun = (s) => NOUN[s.subtype] || CAT[s.category].label;

export default {
  render(el) {
    const items = store.all('items');
    el.innerHTML = `
      <header class="page-head"><div><div class="eyebrow">Compras inteligentes</div><h1 class="display">Compras</h1>
        <p class="muted">Las sugerencias salen de tu propio armario: prendas que desbloquearían más outfits nuevos, nunca duplicados de lo que ya tienes.</p></div></header>
      <div data-body>${items.length ? '<div class="analyzing"><div class="spinner"></div><p>Analizando miles de combinaciones…</p></div>' : `<div class="card">${empty('bag', 'Aún no hay nada que analizar', 'Añade primero algo de ropa: las sugerencias se basan en lo que ya tienes.', '<a class="btn primary" href="#/wardrobe?add=1">Añadir ropa</a>')}</div>`}</div>`;
    if (!items.length) return;

    setTimeout(() => {
      const { suggestions, orphans } = shoppingSuggestions(items);
      const counts = Object.fromEntries(CATEGORIES.map((c) => [c.id, items.filter((i) => i.category === c.id).length]));
      const total = items.length;
      const orphanItems = orphans.map((id) => store.get('items', id)).filter(Boolean);
      el.querySelector('[data-body]').innerHTML = `
        <section class="card balance">
          <h3>Equilibrio del armario</h3>
          <div class="balance-grid">${CATEGORIES.map((c) => {
            const share = total ? counts[c.id] / total : 0;
            const ideal = IDEAL_MIX[c.id];
            const status = counts[c.id] === 0 ? 'missing' : share < ideal * 0.6 ? 'low' : share > ideal * 1.7 ? 'high' : 'ok';
            return `<div class="bal ${status}"><b>${counts[c.id]}</b><span>${c.plural}</span>
              <div class="bal-track" title="${Math.round(share * 100)} % del armario · equilibrado ≈ ${Math.round(ideal * 100)} %"><i style="width:${Math.min(100, (share / (ideal * 2)) * 100)}%"></i><em style="left:50%"></em></div>
              <small>${status === 'missing' ? 'Falta' : status === 'low' ? 'Te vendrían bien más' : status === 'high' ? 'De sobra' : 'Equilibrado'}</small></div>`;
          }).join('')}</div>
        </section>
        <div class="section-head"><h2>Lo mejor para tu armario</h2><span class="muted small">Ordenado por outfits nuevos que desbloquea</span></div>
        <div class="shop-grid">${suggestions.map((s, i) => `
          <article class="card shop-card">
            <div class="shop-img"><img src="${garmentDataURL(s.category, s.hex, s.subtype)}" alt=""><span class="rank">#${i + 1}</span></div>
            <div class="shop-body">
              <div class="eyebrow">${esc(CAT[s.category].label)} · ${s.styles.slice(0, 2).map((x) => STYLE[x]?.label).join(', ')}</div>
              <h3>${swatch(s.hex, 12)} ${esc(noun(s))} · ${esc(colorLabel(s.colorName).toLowerCase())}</h3>
              <ul class="why">${s.reasons.map((r) => `<li>${icon('check', 15)}<span>${esc(r)}</span></li>`).join('')}</ul>
              ${s.partners.length ? `<div class="partners"><span class="muted small">Combina con</span>${s.partners.map((id) => { const it = store.get('items', id); return it ? `<img src="${esc(it.image)}" alt="${esc(it.name)}" title="${esc(it.name)}">` : ''; }).join('')}</div>` : ''}
              <div class="row gap-s wrap">
                <a class="btn soft sm" target="_blank" rel="noopener" href="https://www.google.com/search?tbm=shop&q=${encodeURIComponent(`${noun(s)} ${colorLabel(s.colorName)}`.toLowerCase())}">${icon('search', 14)} Buscarla</a>
                <button class="btn ghost sm" data-own="${i}">${icon('plus', 14)} Ya la he comprado</button>
              </div>
            </div>
          </article>`).join('') || `<div class="card">${empty('check', 'Tu armario está muy completo', 'Ahora mismo no encontramos ninguna prenda que aporte mucho.')}</div>`}</div>
        ${orphanItems.length ? `<section class="card"><h3>Difíciles de combinar ahora mismo</h3><p class="muted small">Estas prendas aún no forman ningún outfit con buena puntuación; las sugerencias de arriba las tienen en cuenta.</p>
          <div class="match-row">${orphanItems.map((it) => `<span class="match"><img src="${esc(it.image)}" alt=""><span>${esc(it.name)}</span></span>`).join('')}</div></section>` : ''}`;
      el.querySelector('[data-body]').addEventListener('click', (e) => {
        const b = e.target.closest('[data-own]');
        if (!b) return;
        const s = suggestions[+b.dataset.own];
        const it = blankItem(s.category, s.hex);
        it.subtype = s.subtype;
        it.image = garmentDataURL(s.category, s.hex, s.subtype);
        it.name = `${noun(s)} ${colorLabel(s.colorName).toLowerCase()}`;
        it.colors = [{ hex: s.hex, name: nameColor(s.hex), pct: 100 }];
        it.styles = guessStyles(s.category, s.subtype, 'solid', s.hex);
        openItemEditor(it, { isNew: true });
      });
    }, 30);
  },
};

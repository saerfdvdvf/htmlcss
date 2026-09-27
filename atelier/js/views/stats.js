// Wardrobe statistics.
import { store } from '../store.js';
import { wardrobeStats, IDEAL_MIX } from '../planning.js';
import { CAT, STYLE } from '../constants.js';
import { icon } from '../icons.js';
import { esc, fmtDate } from '../util.js';
import { empty, swatch } from '../ui.js';
import { colorLabel } from '../color.js';
import { openItemEditor } from './item-editor.js';

const barList = (rows, { max, fmt = (v) => v, lead = () => '' } = {}) => {
  const m = max ?? Math.max(1, ...rows.map((r) => r.value));
  return `<div class="hbars">${rows.map((r) => `
    <div class="hbar" title="${esc(r.label)}: ${fmt(r.value)}">
      <span class="hb-label">${lead(r)}${esc(r.label)}</span>
      <span class="hb-track"><i style="width:${Math.max(2, (r.value / m) * 100)}%"></i></span>
      <b class="hb-val">${fmt(r.value)}</b>
    </div>`).join('')}</div>`;
};

export default {
  render(el) {
    const draw = () => {
      const items = store.all('items');
      const s = wardrobeStats({ items, outfits: store.all('outfits'), wears: store.all('wears'), plans: store.all('plans') });
      if (!items.length) {
        el.innerHTML = `<header class="page-head"><div><div class="eyebrow">Tu armario en datos</div><h1 class="display">Estadísticas</h1></div></header><div class="card">${empty('chart', 'Aún no hay datos', 'Añade ropa y registra lo que te pones para ver tus estadísticas.')}</div>`;
        return;
      }
      const t = s.totals;
      const itemRow = (x, label) => `<button class="stat-item" data-item="${esc(x.item.id)}"><img src="${esc(x.item.image)}" alt=""><span><b>${esc(x.item.name)}</b><small>${label(x)}</small></span></button>`;
      el.innerHTML = `
        <header class="page-head"><div><div class="eyebrow">Tu armario en datos</div><h1 class="display">Estadísticas</h1><p class="muted">Entiende qué te pones… y qué tienes olvidado.</p></div></header>
        <div class="tiles">
          <div class="tile"><span>Prendas</span><b>${t.items}</b></div>
          <div class="tile"><span>Outfits creados</span><b>${t.outfits}</b></div>
          <div class="tile"><span>Outfits favoritos</span><b>${t.favorites}</b></div>
          <div class="tile"><span>Días registrados</span><b>${t.wears}</b></div>
          <div class="tile"><span>Usado en los últimos 30 días</span><b>${t.utilization}<small>%</small></b></div>
          <div class="tile"><span>Puntuación media</span><b>${t.avgScore || '—'}</b></div>
        </div>
        ${s.insights.length ? `<div class="card insights">${s.insights.map((i) => `<p>${icon('bulb', 18)}<span>${esc(i)}</span></p>`).join('')}</div>` : ''}
        ${s.basis === 'planned' ? `<div class="card note">${icon('info', 18)}<span>El uso de abajo es una estimación a partir de tus outfits planificados y favoritos. Toca <b>Me lo pongo hoy</b> en cualquier outfit, o marca los días planificados como puestos, para tener estadísticas exactas.</span></div>` : ''}
        <div class="stats-grid">
          <section class="card"><h3>Prendas más usadas</h3>
            ${s.most.length ? `<div class="stat-items">${s.most.map((x) => itemRow(x, (x) => `${s.basis === 'worn' ? 'Puesta' : 'Usada'} ${x.count} ${x.count === 1 ? 'vez' : 'veces'}`)).join('')}</div>` : '<p class="muted small">Aún no hay nada registrado.</p>'}</section>
          <section class="card"><h3>Prendas menos usadas</h3>
            <div class="stat-items">${s.least.map((x) => itemRow(x, (x) => (x.count ? `${s.basis === 'worn' ? 'Puesta' : 'Usada'} ${x.count} ${x.count === 1 ? 'vez' : 'veces'}${x.last ? ` · última: ${fmtDate(x.last, { day: 'numeric', month: 'short' })}` : ''}` : s.basis === 'worn' ? 'Nunca puesta' : 'En ningún outfit planificado'))).join('')}</div>
            <a class="link" href="#/create?item=${esc(s.least[0]?.item.id || '')}">${icon('sparkles', 15)} Crear un outfit con la menos usada</a></section>
          <section class="card"><h3>Colores de tu armario</h3>
            ${barList(s.ownedColors.slice(0, 8).map(([n, v]) => ({ label: colorLabel(n), value: v, hex: s.colorHex.get(n) })), { lead: (r) => swatch(r.hex || '#888', 12) })}</section>
          <section class="card"><h3>Colores más usados</h3>
            ${s.wornColors.length ? barList(s.wornColors.slice(0, 8).map(([n, v]) => ({ label: colorLabel(n), value: v, hex: s.colorHex.get(n) })), { lead: (r) => swatch(r.hex || '#888', 12) }) : '<p class="muted small">Registra algunos outfits para ver esto.</p>'}</section>
          <section class="card"><h3>Categorías</h3>
            ${barList(s.cats.map((c) => ({ label: CAT[c.id].plural, value: c.owned })), {})}
            <p class="muted small">Mezcla equilibrada: ${Object.entries(IDEAL_MIX).map(([k, v]) => `${CAT[k].plural.toLowerCase()} ${Math.round(v * 100)} %`).join(' · ')}</p></section>
          <section class="card"><h3>Categorías más usadas</h3>
            ${s.cats.some((c) => c.worn) ? barList(s.cats.map((c) => ({ label: CAT[c.id].plural, value: c.worn }))) : '<p class="muted small">Registra algunos outfits para ver esto.</p>'}</section>
          <section class="card wide"><h3>Combinaciones más frecuentes</h3>
            ${s.topPairs.length ? `<div class="pairs">${s.topPairs.map((p) => {
              const [a, b] = p.ids.map((id) => store.get('items', id));
              return a && b ? `<div class="pair"><img src="${esc(a.image)}" alt=""><span>+</span><img src="${esc(b.image)}" alt=""><small>${esc(a.name)} con ${esc(b.name)}</small></div>` : '';
            }).join('')}</div>` : '<p class="muted small">Guarda como favoritos o ponte outfits para descubrir tus combinaciones estrella.</p>'}</section>
          <section class="card"><h3>Estilos que creas</h3>
            ${s.styleShare.length ? barList(s.styleShare.filter(([k]) => k && k !== 'undefined').map(([k, v]) => ({ label: STYLE[k]?.label || k, value: v }))) : '<p class="muted small">Crea outfits para ver tu mezcla de estilos.</p>'}</section>
        </div>`;
    };
    draw();
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-item]');
      if (b) openItemEditor(store.get('items', b.dataset.item));
    });
    return store.on((c) => (c.has('items') || c.has('wears') || c.has('outfits')) && draw());
  },
};

// Wardrobe statistics.
import { store } from '../store.js';
import { wardrobeStats, IDEAL_MIX } from '../planning.js';
import { CAT, STYLE } from '../constants.js';
import { icon } from '../icons.js';
import { esc, fmtDate } from '../util.js';
import { empty, swatch } from '../ui.js';
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
        el.innerHTML = `<header class="page-head"><div><div class="eyebrow">Insights</div><h1 class="display">Statistics</h1></div></header><div class="card">${empty('chart', 'No data yet', 'Add clothes and log what you wear to see your stats.')}</div>`;
        return;
      }
      const t = s.totals;
      const itemRow = (x, label) => `<button class="stat-item" data-item="${esc(x.item.id)}"><img src="${esc(x.item.image)}" alt=""><span><b>${esc(x.item.name)}</b><small>${label(x)}</small></span></button>`;
      el.innerHTML = `
        <header class="page-head"><div><div class="eyebrow">Insights</div><h1 class="display">Statistics</h1><p class="muted">Understand what you wear — and what you forget.</p></div></header>
        <div class="tiles">
          <div class="tile"><span>Pieces</span><b>${t.items}</b></div>
          <div class="tile"><span>Outfits created</span><b>${t.outfits}</b></div>
          <div class="tile"><span>Favourite outfits</span><b>${t.favorites}</b></div>
          <div class="tile"><span>Days logged</span><b>${t.wears}</b></div>
          <div class="tile"><span>Worn in last 30 days</span><b>${t.utilization}<small>%</small></b></div>
          <div class="tile"><span>Average outfit score</span><b>${t.avgScore || '—'}</b></div>
        </div>
        ${s.insights.length ? `<div class="card insights">${s.insights.map((i) => `<p>${icon('bulb', 18)}<span>${esc(i)}</span></p>`).join('')}</div>` : ''}
        ${s.basis === 'planned' ? `<div class="card note">${icon('info', 18)}<span>Usage below is estimated from your planned and favourite outfits. Tap <b>Wear today</b> on any outfit, or mark planned days as worn, for exact stats.</span></div>` : ''}
        <div class="stats-grid">
          <section class="card"><h3>Most-used pieces</h3>
            ${s.most.length ? `<div class="stat-items">${s.most.map((x) => itemRow(x, (x) => `${s.basis === 'worn' ? 'Worn' : 'Used'} ${x.count}×`)).join('')}</div>` : '<p class="muted small">Nothing logged yet.</p>'}</section>
          <section class="card"><h3>Least-used pieces</h3>
            <div class="stat-items">${s.least.map((x) => itemRow(x, (x) => (x.count ? `${s.basis === 'worn' ? 'Worn' : 'Used'} ${x.count}×${x.last ? ` · last ${fmtDate(x.last, { day: 'numeric', month: 'short' })}` : ''}` : s.basis === 'worn' ? 'Never worn' : 'Not in any planned outfit'))).join('')}</div>
            <a class="link" href="#/create?item=${esc(s.least[0]?.item.id || '')}">${icon('sparkles', 15)} Style the least-worn piece</a></section>
          <section class="card"><h3>Colours in your wardrobe</h3>
            ${barList(s.ownedColors.slice(0, 8).map(([n, v]) => ({ label: n, value: v, hex: s.colorHex.get(n) })), { lead: (r) => swatch(r.hex || '#888', 12) })}</section>
          <section class="card"><h3>Most-worn colours</h3>
            ${s.wornColors.length ? barList(s.wornColors.slice(0, 8).map(([n, v]) => ({ label: n, value: v, hex: s.colorHex.get(n) })), { lead: (r) => swatch(r.hex || '#888', 12) }) : '<p class="muted small">Log a few outfits to see this.</p>'}</section>
          <section class="card"><h3>Categories</h3>
            ${barList(s.cats.map((c) => ({ label: CAT[c.id].plural, value: c.owned })), {})}
            <p class="muted small">Balanced mix: ${Object.entries(IDEAL_MIX).map(([k, v]) => `${CAT[k].plural.toLowerCase()} ${Math.round(v * 100)}%`).join(' · ')}</p></section>
          <section class="card"><h3>Most-worn categories</h3>
            ${s.cats.some((c) => c.worn) ? barList(s.cats.map((c) => ({ label: CAT[c.id].plural, value: c.worn }))) : '<p class="muted small">Log a few outfits to see this.</p>'}</section>
          <section class="card wide"><h3>Most frequent combinations</h3>
            ${s.topPairs.length ? `<div class="pairs">${s.topPairs.map((p) => {
              const [a, b] = p.ids.map((id) => store.get('items', id));
              return a && b ? `<div class="pair"><img src="${esc(a.image)}" alt=""><span>+</span><img src="${esc(b.image)}" alt=""><small>${esc(a.name)} with ${esc(b.name)}</small></div>` : '';
            }).join('')}</div>` : '<p class="muted small">Favourite or wear outfits to discover your signature pairings.</p>'}</section>
          <section class="card"><h3>Styles you create</h3>
            ${s.styleShare.length ? barList(s.styleShare.filter(([k]) => k && k !== 'undefined').map(([k, v]) => ({ label: STYLE[k]?.label || k, value: v }))) : '<p class="muted small">Create outfits to see your style mix.</p>'}</section>
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

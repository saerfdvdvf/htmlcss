// Favourites & outfit history.
import { store } from '../store.js';
import { STYLES, OCCASIONS } from '../constants.js';
import { icon } from '../icons.js';
import { outfitCard, empty, chip, bindChips, toggleOutfitFav, confirmDialog, toast } from '../ui.js';
import { navigate, setHash } from '../router.js';

let filter = { style: 'all', occ: 'all' };

export default {
  render(el, params) {
    let tab = params.tab === 'history' ? 'history' : 'favorites';
    const draw = () => {
      const all = store.all('outfits');
      const favs = all.filter((o) => o.favorite);
      let list = (tab === 'favorites' ? favs : all).slice().sort((a, b) => (tab === 'favorites' ? b.updatedAt - a.updatedAt : b.createdAt - a.createdAt));
      if (filter.style !== 'all') list = list.filter((o) => o.style === filter.style);
      if (filter.occ !== 'all') list = list.filter((o) => o.occasion === filter.occ);
      el.innerHTML = `
        <header class="page-head">
          <div><div class="eyebrow">${favs.length} saved · ${all.length} in history</div><h1 class="display">${tab === 'favorites' ? 'Favorites' : 'Outfit History'}</h1></div>
          ${tab === 'history' && all.length ? `<button class="btn ghost danger-text" data-clear>${icon('trash', 16)} Clear history</button>` : ''}
        </header>
        <div class="seg" role="tablist">
          <button role="tab" class="${tab === 'favorites' ? 'on' : ''}" data-tab="favorites" aria-selected="${tab === 'favorites'}">${icon('heart', 16)} Favorites</button>
          <button role="tab" class="${tab === 'history' ? 'on' : ''}" data-tab="history" aria-selected="${tab === 'history'}">${icon('history', 16)} History</button>
        </div>
        <div class="chips scroll">${chip('All styles', { value: 'all', name: 'fst', active: filter.style === 'all' })}${STYLES.map((s) => chip(s.label, { value: s.id, name: 'fst', active: filter.style === s.id })).join('')}</div>
        <div class="chips scroll">${chip('All occasions', { value: 'all', name: 'foc', active: filter.occ === 'all' })}${OCCASIONS.map((s) => chip(s.label, { value: s.id, name: 'foc', active: filter.occ === s.id })).join('')}</div>
        <div class="grid outfits-grid">${list.map((o) => outfitCard(o)).join('') ||
          (tab === 'favorites'
            ? empty('heart', 'No favourites yet', 'Tap the heart on any outfit you love to keep it here.', `<a class="btn primary" href="#/create">${icon('sparkles', 18)} Create an outfit</a>`)
            : empty('history', 'No outfits generated yet', 'Everything you generate shows up here so you can revisit it.'))}</div>`;
      bindChips(el, 'fst', { onChange: (v) => { filter.style = v; draw(); } });
      bindChips(el, 'foc', { onChange: (v) => { filter.occ = v; draw(); } });
    };
    draw();
    el.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-tab]');
      if (t) { tab = t.dataset.tab; setHash('favorites', { tab }); return draw(); }
      const f = e.target.closest('[data-ofav]');
      if (f) { e.stopPropagation(); return toggleOutfitFav(f.dataset.ofav); }
      if (e.target.closest('[data-clear]')) {
        if (!(await confirmDialog('Clear all non-favourite outfits from history? Planned outfits are kept.', { ok: 'Clear', danger: true }))) return;
        const planned = new Set(store.all('plans').map((p) => p.outfitId));
        await store.removeMany('outfits', store.all('outfits').filter((o) => !o.favorite && !planned.has(o.id)).map((o) => o.id));
        return toast('History cleared');
      }
      const card = e.target.closest('[data-outfit]');
      if (card) navigate('outfit', { id: card.dataset.outfit });
    });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-outfit]')) e.target.click(); });
    return store.on((c) => (c.has('outfits') || c.has('items')) && draw());
  },
};

// Higher-level planners built on the engine: travel capsule, shopping gaps, wardrobe statistics.
import { feat, generateSeries, scoreOutfit, availablePool } from './engine.js';
import { STYLE_AFFINITY, CAT, STYLES, CORE_SLOTS } from './constants.js';
import { pairHarmony, deltaE, NAMED, nameColor, colorLabel } from './color.js';
import { rng, shuffle, clamp, countBy, round } from './util.js';

// ---------------------------------------------------------------------------
// Travel: pick a small capsule, then plan every day from it.
// ---------------------------------------------------------------------------
function compat(f, chosen) {
  const others = chosen.filter((g) => g.cat !== f.cat);
  if (!others.length) return 0.5;
  let s = 0;
  for (const g of others) {
    const st = Math.max(...f.styles.map((a) => Math.max(...g.styles.map((b) => STYLE_AFFINITY[a]?.[b] ?? 0))));
    s += pairHarmony(f.primary, g.primary).h * 0.6 + st * 0.4;
  }
  return s / others.length;
}

export function planTrip(items, { dayList, style = 'any', include = [], exclude = [], seed = 'trip' }) {
  const r = rng(seed);
  const n = dayList.length;
  const ex = new Set(exclude);
  const pool = availablePool(items).filter((i) => !ex.has(i.id));
  const bands = new Set(dayList.map((d) => d.weather?.band));
  const warm = bands.has('hot') || bands.has('warm');
  const cool = bands.has('cool') || bands.has('cold');
  const mild = bands.has('mild');
  const sporty = dayList.some((d) => d.occasion === 'sports');
  const dressy = dayList.some((d) => ['work', 'event', 'date'].includes(d.occasion));
  const need = {
    tshirt: clamp(Math.ceil(n * (warm ? 0.8 : 0.55)), 1, 8),
    hoodie: cool ? clamp(Math.ceil(n / 3), 1, 3) : mild ? 1 : 0,
    trousers: clamp(Math.ceil(n / 3) + (dressy ? 1 : 0), 1, 4),
    sneakers: (n >= 5 ? 2 : 1) + (sporty && dressy ? 1 : 0),
    accessory: Math.min(2, Math.ceil(n / 4)),
  };
  const byCat = (c) => pool.filter((i) => i.category === c).map(feat);
  const chosen = items.filter((i) => include.includes(i.id)).map(feat);
  const target = style === 'any' ? null : style;
  const seasons = new Set(dayList.map((d) => d.weather?.season).filter(Boolean));
  const unary = (f) =>
    (target ? Math.max(...f.styles.map((s) => STYLE_AFFINITY[s]?.[target] ?? 0)) : 0.7) * 0.5 +
    (f.primary.neutral ? 0.25 : 0) +
    (!f.seasons || [...seasons].some((s) => f.seasons.includes(s)) ? 0.2 : -0.3) +
    (warm && !cool && f.cat === 'hoodie' && f.warmth >= 4 ? -0.3 : 0) +
    (cool && f.subtype === 'shorts' ? -0.4 : 0) + r() * 0.05;
  for (const cat of ['trousers', 'sneakers', 'hoodie', 'tshirt', 'accessory']) {
    let have = chosen.filter((f) => f.cat === cat).length;
    const cands = byCat(cat).filter((f) => !chosen.includes(f));
    while (have < need[cat] && cands.length) {
      cands.sort((a, b) => {
        const div = (f) => (chosen.some((g) => g.cat === cat && g.primary.name === f.primary.name) ? -0.25 : 0);
        return unary(b) + compat(b, chosen) + div(b) - (unary(a) + compat(a, chosen) + div(a));
      });
      chosen.push(cands.shift());
      have++;
    }
  }
  const capsule = chosen.map((f) => f.item);
  const series = generateSeries(
    capsule,
    dayList.map((d, i) => ({ key: d.date || i, style: d.style || style, occasion: d.occasion, weather: d.weather })),
    { accessories: true },
    { noRepeat: false, seed: rng(seed + 'series') },
  );
  const used = new Set(include);
  for (const s of series) if (s.items) for (const id of Object.values(s.items).flat()) if (id) used.add(id);
  const packing = capsule.filter((i) => used.has(i.id)).map((i) => i.id);
  return { series, packing };
}

export function tripExtras({ days, rain, hot, cold, beach, sports, business }) {
  const x = [
    { label: 'Ropa interior', qty: days + 1 },
    { label: 'Calcetines', qty: days + 1 },
    { label: 'Pijama', qty: 1 },
    { label: 'Neceser', qty: 1 },
    { label: 'Cargador del móvil', qty: 1 },
  ];
  if (rain) x.push({ label: 'Chubasquero o paraguas', qty: 1 });
  if (hot) x.push({ label: 'Crema solar', qty: 1 });
  if (cold) x.push({ label: 'Abrigo / guantes', qty: 1 });
  if (beach) x.push({ label: 'Bañador', qty: 2 }, { label: 'Chanclas / sandalias', qty: 1 });
  if (sports) x.push({ label: 'Ropa de deporte', qty: Math.ceil(days / 3) });
  if (business) x.push({ label: 'Portátil y documentos', qty: 1 });
  return x.map((e, i) => ({ ...e, id: 'x' + i, packed: false }));
}

// ---------------------------------------------------------------------------
// Shopping: find the pieces that would unlock the most new, good outfits.
// ---------------------------------------------------------------------------
const ARCHETYPES = {
  hoodie: [['pullover', ['Black', 'Grey', 'Navy', 'Cream', 'Olive', 'Charcoal', 'Burgundy', 'Forest green']], ['crewneck sweatshirt', ['Grey', 'Navy', 'Cream', 'Sand']], ['zip-up', ['Black', 'Grey', 'Navy']]],
  tshirt: [['tee', ['White', 'Black', 'Grey', 'Navy', 'Cream', 'Sand', 'Olive']], ['polo', ['Navy', 'Black', 'Cream', 'Forest green']], ['long sleeve', ['White', 'Navy', 'Charcoal']]],
  trousers: [['jeans', ['Denim', 'Light denim', 'Black']], ['chinos', ['Beige', 'Navy', 'Olive', 'Khaki']], ['tailored', ['Charcoal', 'Navy', 'Black']], ['cargo', ['Olive', 'Black', 'Khaki']], ['joggers', ['Grey', 'Black']]],
  sneakers: [['minimal leather', ['White', 'Black']], ['runner', ['Grey', 'Navy']], ['low-top', ['Black', 'White', 'Cream']], ['chunky', ['Cream', 'Grey']]],
  accessory: [['watch', ['Black', 'Light grey']], ['belt', ['Brown', 'Black']], ['cap', ['Navy', 'Black', 'Beige']], ['beanie', ['Charcoal', 'Olive']], ['bag', ['Black', 'Brown']]],
};

export function shoppingSuggestions(items, { seed = 'shop', limit = 8 } = {}) {
  const r = rng(seed);
  const pool = availablePool(items.filter((i) => i.status !== 'unavailable').map((i) => ({ ...i, status: 'available' })));
  const feats = pool.map(feat);
  const by = Object.fromEntries(['hoodie', 'tshirt', 'trousers', 'sneakers', 'accessory'].map((c) => [c, feats.filter((f) => f.cat === c)]));
  const sample = (arr, k) => (arr.length <= k ? arr : shuffle(arr, r).slice(0, k));
  const GOOD = 80;
  const ctx = { style: 'any' };

  // Good outfits a set of pieces can make with the current wardrobe (core pieces only).
  const countGood = (fixed, partners) => {
    let good = 0, total = 0;
    const tops = fixed.cat === 'tshirt' || fixed.cat === 'hoodie' ? [fixed] : sample([...by.tshirt, ...by.hoodie], 12);
    const bottoms = fixed.cat === 'trousers' ? [fixed] : sample(by.trousers, 10);
    const shoes = fixed.cat === 'sneakers' ? [fixed] : sample(by.sneakers, 8);
    for (const t of tops) for (const b of bottoms) for (const s of shoes) {
      const o = { tshirt: t.cat === 'tshirt' ? t : null, hoodie: t.cat === 'hoodie' ? t : null, trousers: b, sneakers: s, accessory: [] };
      if (fixed.cat === 'accessory') o.accessory = [fixed];
      const sc = scoreOutfit(o, ctx).total;
      total++;
      if (sc >= GOOD) { good++; partners && [t, b, s].forEach((p) => p !== fixed && partners.set(p.id, (partners.get(p.id) || 0) + sc)); }
    }
    return { good, ratio: total ? good / total : 0 };
  };

  // Orphans: pieces that currently have no good outfit.
  const orphans = feats.filter((f) => f.cat !== 'accessory' && countGood(f).good === 0);

  const styleCoverage = {};
  for (const c of CORE_SLOTS) styleCoverage[c] = new Set(by[c].flatMap((f) => f.styles));

  const out = [];
  for (const [cat, list] of Object.entries(ARCHETYPES)) {
    for (const [subtype, colors] of list) {
      for (const cname of colors) {
        const hex = NAMED[cname].hex;
        const cand = feat({ id: `cand-${cat}-${subtype}-${cname}`, category: cat, subtype, colors: [{ hex }], updatedAt: 1 });
        // Skip near-duplicates of things already owned.
        const dup = by[cat].find((f) => deltaE(f.primary.lab, cand.primary.lab) < 13 && (f.subtype === subtype || f.styles.some((s) => cand.styles.includes(s))));
        if (dup) continue;
        const partners = new Map();
        const { good, ratio } = countGood(cand, partners);
        const isAcc = cat === 'accessory';
        let score = ratio * 40 + Math.log2(1 + good) * 6;
        const reasons = [];
        if (!by[cat].length) { score += 40; reasons.push(`Todavía no tienes ${CAT[cat].plural.toLowerCase()}.`); }
        const newStyles = cand.styles.filter((s) => CORE_SLOTS.includes(cat) && !styleCoverage[cat]?.has(s));
        if (newStyles.length) {
          score += newStyles.length * 8;
          reasons.push(`Añade opciones de estilo ${newStyles.map((s) => STYLES.find((x) => x.id === s).label.toLowerCase()).join(' y ')} a tus ${CAT[cat].plural.toLowerCase()}.`);
        }
        let rescued = 0;
        for (const o of orphans) {
          if (o.cat === cat) continue;
          const h = pairHarmony(o.primary, cand.primary).h;
          if (h > 0.84) rescued++;
        }
        if (rescued) { score += rescued * 3; reasons.push(rescued > 1 ? `Da pareja a ${rescued} prendas difíciles de combinar.` : 'Da pareja a una prenda difícil de combinar.'); }
        if (cand.primary.neutral) score += 2;
        if (isAcc) { score *= 0.6; if (ratio > 0.2) reasons.unshift(`Completa cerca del ${Math.round(ratio * 100)} % de los outfits que ya puedes crear.`); }
        else if (good) reasons.unshift(good > 1 ? `Desbloquea unos ${good} outfits nuevos con puntuación alta.` : 'Desbloquea un outfit nuevo con puntuación alta.');
        const top = [...partners.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id);
        if (score > 8 && reasons.length) out.push({ id: cand.id, category: cat, subtype, colorName: cname, hex, score: Math.round(score), good, ratio, reasons, partners: top, styles: cand.styles });
      }
    }
  }
  // Keep variety: at most two suggestions per category.
  out.sort((a, b) => b.score - a.score);
  const picked = [], perCat = {};
  for (const s of out) {
    if ((perCat[s.category] || 0) >= 2) continue;
    perCat[s.category] = (perCat[s.category] || 0) + 1;
    picked.push(s);
    if (picked.length >= limit) break;
  }
  return { suggestions: picked, orphans: orphans.map((f) => f.id) };
}

// Recommended share per category for a balanced wardrobe.
export const IDEAL_MIX = { tshirt: 0.3, hoodie: 0.2, trousers: 0.22, sneakers: 0.13, accessory: 0.15 };

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------
export function wardrobeStats({ items, outfits, wears: logged, plans = [], now = new Date() }) {
  const live = items.filter((i) => !i.deleted);
  // Until outfits are logged as worn, estimate usage from planned and favourite outfits.
  const byOutfit = new Map(outfits.map((o) => [o.id, o]));
  const ids = (o) => Object.values(o.items).flat().filter(Boolean);
  const basis = logged.length ? 'worn' : 'planned';
  const wears = logged.length ? logged : [
    ...plans.map((p) => byOutfit.get(p.outfitId)).filter(Boolean).map((o) => ({ date: '', itemIds: ids(o) })),
    ...outfits.filter((o) => o.favorite).map((o) => ({ date: '', itemIds: ids(o) })),
  ];
  const byId = new Map(live.map((i) => [i.id, i]));
  const wearCount = new Map(), last = new Map();
  for (const w of wears) for (const id of w.itemIds || []) {
    if (!byId.has(id)) continue;
    wearCount.set(id, (wearCount.get(id) || 0) + 1);
    if (!last.has(id) || last.get(id) < w.date) last.set(id, w.date);
  }
  const ranked = live.map((i) => ({ item: i, count: wearCount.get(i.id) || 0, last: last.get(i.id) || null }));
  const most = ranked.filter((x) => x.count).sort((a, b) => b.count - a.count).slice(0, 6);
  const least = ranked.slice().sort((a, b) => a.count - b.count || (a.last || '').localeCompare(b.last || '') || a.item.createdAt - b.item.createdAt).slice(0, 6);

  const colorName = (i) => i.colors?.[0]?.name || nameColor(i.colors?.[0]?.hex || '#888');
  const colorHex = new Map();
  for (const i of live) if (!colorHex.has(colorName(i))) colorHex.set(colorName(i), NAMED[colorName(i)]?.hex || i.colors?.[0]?.hex);
  const ownedColors = [...countBy(live, colorName)].sort((a, b) => b[1] - a[1]);
  const wornColors = [...countBy(wears.flatMap((w) => (w.itemIds || []).map((id) => byId.get(id)).filter(Boolean)), colorName)].sort((a, b) => b[1] - a[1]);

  const cats = ['hoodie', 'tshirt', 'trousers', 'sneakers', 'accessory'].map((c) => ({
    id: c, owned: live.filter((i) => i.category === c).length,
    worn: wears.reduce((a, w) => a + (w.itemIds || []).filter((id) => byId.get(id)?.category === c).length, 0),
  }));

  const pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  const pairs = new Map();
  const add = (ids, w) => {
    const core = ids.filter((id) => byId.has(id) && byId.get(id).category !== 'accessory');
    for (let i = 0; i < core.length; i++) for (let j = i + 1; j < core.length; j++) {
      const k = pairKey(core[i], core[j]);
      pairs.set(k, (pairs.get(k) || 0) + w);
    }
  };
  wears.forEach((w) => add(w.itemIds || [], 2));
  outfits.filter((o) => o.favorite).forEach((o) => add(Object.values(o.items).flat().filter(Boolean), 1));
  const topPairs = [...pairs].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => ({ ids: k.split('|'), weight: v }));

  const styleShare = [...countBy(outfits, (o) => o.style || o.score?.style)].sort((a, b) => b[1] - a[1]);
  const since = new Date(now); since.setDate(since.getDate() - 30);
  const sinceISO = since.toISOString().slice(0, 10);
  const recent = new Set(logged.filter((w) => w.date >= sinceISO).flatMap((w) => w.itemIds || []));
  const utilization = live.length ? round((live.filter((i) => recent.has(i.id)).length / live.length) * 100) : 0;
  const neverWorn = ranked.filter((x) => !x.count).length;

  const favs = outfits.filter((o) => o.favorite);
  const avgScore = outfits.length ? round(outfits.reduce((a, o) => a + (o.score?.total || 0), 0) / outfits.length) : 0;

  const insights = [];
  if (neverWorn && logged.length) insights.push(neverWorn > 1 ? `Hay ${neverWorn} prendas que nunca has registrado como puestas: prueba a crear un outfit alrededor de una.` : 'Hay una prenda que nunca has registrado como puesta: prueba a crear un outfit alrededor de ella.');
  if (most[0] && wears.length >= 5 && most[0].count / wears.length > 0.4) insights.push(`«${most[0].item.name || 'Tu prenda favorita'}» aparece en el ${Math.round((most[0].count / wears.length) * 100)} % de tus outfits. Una alternativa parecida repartiría el uso.`);
  if (ownedColors[0] && live.length >= 8 && ownedColors[0][1] / live.length > 0.35) insights.push(`El ${colorLabel(ownedColors[0][0]).toLowerCase()} supone el ${Math.round((ownedColors[0][1] / live.length) * 100)} % de tu armario: una gran base; añade uno o dos colores de acento para ganar variedad.`);
  const mix = cats.map((c) => ({ ...c, share: live.length ? c.owned / live.length : 0 }));
  const low = mix.filter((c) => c.owned === 0 || c.share < IDEAL_MIX[c.id] * 0.5);
  if (live.length >= 6 && low.length) insights.push(`Tienes pocas prendas en: ${low.map((c) => CAT[c.id].plural.toLowerCase()).join(' y ')}. Mira Compras para ver ideas concretas.`);
  if (utilization && utilization < 40 && wears.length >= 7) insights.push(`Solo te has puesto el ${utilization} % de tu armario en los últimos 30 días. La opción «Priorizar las prendas menos usadas» de Crear outfit te ayudará a rotar.`);

  return {
    totals: { items: live.length, outfits: outfits.length, favorites: favs.length, wears: logged.length, utilization, neverWorn, avgScore }, basis,
    most, least, ownedColors, wornColors, colorHex, cats, topPairs, styleShare, insights,
  };
}

// Outfit engine: item features, outfit scoring (with explanations) and generation.
// Pure module: works in the browser and in Node tests.
import {
  CAT, STYLE, STYLES, STYLE_AFFINITY, STYLE_FORMALITY, OCCASION, WEATHER_BANDS, bandForTemp,
  DEFAULT_WARMTH, SUBTYPE_WARMTH, DEFAULT_FORMALITY, SUBTYPE_FORMALITY,
} from './constants.js';
import { colorInfo, paletteScore, pairHarmony, hueDist } from './color.js';
import { avg, clamp, stdev, softPick, shuffle, cap, round } from './util.js';

// ---------------------------------------------------------------------------
// Attribute inference (also used by the image analyzer for suggestions)
// ---------------------------------------------------------------------------
export function guessStyles(category, subtype = '', pattern = 'solid', primaryHex) {
  const s = new Set();
  const st = (subtype || '').toLowerCase();
  const neutral = primaryHex ? colorInfo(primaryHex).neutral : true;
  switch (category) {
    case 'hoodie':
      s.add('casual').add('streetwear');
      if (st.includes('zip') || pattern === 'solid') s.add('sporty');
      if (st.includes('crewneck') && neutral) s.add('smart-casual');
      break;
    case 'tshirt':
      s.add('casual');
      if (st === 'polo' || st === 'henley') s.add('smart-casual');
      else if (pattern === 'graphic' || st === 'graphic tee' || st === 'oversized') s.add('streetwear');
      else if (st === 'tank top') s.add('sporty');
      else { s.add('streetwear'); if (neutral && pattern === 'solid') s.add('smart-casual'); }
      break;
    case 'trousers':
      if (st === 'tailored') s.add('formal').add('smart-casual');
      else if (st === 'chinos') s.add('smart-casual').add('casual');
      else if (st === 'joggers') s.add('sporty').add('streetwear').add('casual');
      else if (st === 'cargo' || st === 'wide leg') s.add('streetwear').add('casual');
      else if (st === 'shorts') s.add('casual').add('sporty');
      else { s.add('casual').add('streetwear'); if (neutral) s.add('smart-casual'); }
      break;
    case 'sneakers':
      if (st === 'minimal leather') s.add('smart-casual').add('casual').add('formal');
      else if (st === 'runner') s.add('sporty').add('casual');
      else if (st === 'chunky' || st === 'high-top' || st === 'skate') s.add('streetwear').add('casual');
      else { s.add('casual').add('streetwear'); if (neutral) s.add('smart-casual'); }
      break;
    default:
      if (['watch', 'belt', 'ring', 'bracelet'].includes(st)) s.add('smart-casual').add('formal').add('casual');
      else if (['cap', 'chain', 'beanie'].includes(st)) s.add('streetwear').add('casual');
      else if (st === 'bag') s.add('casual').add('smart-casual').add('streetwear');
      else s.add('casual');
      if (st === 'cap') s.add('sporty');
  }
  return [...s];
}

export function guessFit(category, subtype = '') {
  const st = subtype.toLowerCase();
  if (st.includes('oversized')) return 'oversized';
  if (st.includes('cropped')) return 'cropped';
  if (st === 'wide leg') return 'wide';
  if (st === 'cargo' || st === 'joggers') return 'relaxed';
  if (st === 'tailored') return 'slim';
  return 'regular';
}

export function guessSeasons(category, subtype = '', warmth) {
  const w = warmth ?? itemWarmth({ category, subtype });
  if (category === 'accessory') {
    if (subtype === 'beanie' || subtype === 'scarf') return ['autumn', 'winter'];
    if (subtype === 'sunglasses') return ['spring', 'summer'];
    return ['spring', 'summer', 'autumn', 'winter'];
  }
  if (subtype === 'shorts' || subtype === 'tank top') return ['spring', 'summer'];
  if (category === 'hoodie') return w >= 4 ? ['autumn', 'winter', 'spring'] : ['spring', 'autumn', 'winter'];
  return ['spring', 'summer', 'autumn', 'winter'];
}

export const itemWarmth = (it) =>
  it.warmth ?? SUBTYPE_WARMTH[it.subtype] ?? DEFAULT_WARMTH[it.category] ?? 1;
export const itemFormality = (it) =>
  it.formality ?? SUBTYPE_FORMALITY[it.subtype] ?? DEFAULT_FORMALITY[it.category] ?? 2;

// ---------------------------------------------------------------------------
// Features (cached per item revision)
// ---------------------------------------------------------------------------
const featCache = new Map();
export function feat(item) {
  if (!item) return null;
  const key = item.id + ':' + (item.updatedAt || 0);
  let f = featCache.get(key);
  if (f) return f;
  const hexes = (item.colors || []).map((c) => (typeof c === 'string' ? c : c.hex)).filter(Boolean);
  const colors = (hexes.length ? hexes : ['#8a8d91']).map(colorInfo);
  const styles = item.styles?.length ? item.styles : guessStyles(item.category, item.subtype, item.pattern, colors[0].hex);
  f = {
    id: item.id, item, cat: item.category, subtype: item.subtype || '',
    colors, primary: colors[0],
    styles, formality: itemFormality(item), warmth: itemWarmth(item),
    seasons: item.seasons?.length ? item.seasons : null,
    fit: item.fit || guessFit(item.category, item.subtype || ''),
    pattern: item.pattern || 'solid',
    name: item.name || `${colors[0].name} ${CAT[item.category]?.label.toLowerCase() || 'item'}`,
  };
  featCache.set(key, f);
  return f;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------
export const WEIGHTS = { color: 0.3, style: 0.25, occasion: 0.15, proportion: 0.15, weather: 0.15 };
export const FACTOR_LABELS = {
  color: 'Colour harmony', style: 'Style match', occasion: 'Occasion fit', proportion: 'Proportions', weather: 'Weather & season',
};

const PROPORTION = {
  slim: { slim: 0.84, regular: 0.9, relaxed: 0.86, wide: 0.78, cropped: 0.84 },
  regular: { slim: 0.9, regular: 0.88, relaxed: 0.87, wide: 0.8, cropped: 0.88 },
  relaxed: { slim: 0.92, regular: 0.9, relaxed: 0.8, wide: 0.72, cropped: 0.9 },
  oversized: { slim: 0.96, regular: 0.88, relaxed: 0.8, wide: 0.72, cropped: 0.95 },
  cropped: { slim: 0.78, regular: 0.86, relaxed: 0.92, wide: 0.97, cropped: 0.8 },
  wide: { slim: 0.9, regular: 0.86, relaxed: 0.78, wide: 0.7, cropped: 0.9 },
};

export function weatherFromTemp(temp, extra = {}) {
  const band = bandForTemp(temp);
  return { temp, band: band.id, ...extra };
}

const layerOrder = (o) => ['hoodie', 'tshirt', 'trousers', 'sneakers'].map((k) => o[k]).filter(Boolean);
export const outfitFeats = (o) => [...layerOrder(o), ...(o.accessory || [])];

// o: { hoodie, tshirt, trousers, sneakers, accessory: [] } of feat() objects
export function scoreOutfit(o, ctx = {}, explain = false) {
  const items = outfitFeats(o);
  const top = o.hoodie || o.tshirt;
  const layered = !!(o.hoodie && o.tshirt);
  const reasons = [], tips = [];

  // ---- colour
  const areaW = (f) =>
    f.cat === 'hoodie' ? 1 : f.cat === 'tshirt' ? (layered ? 0.35 : 1) : f.cat === 'trousers' ? 0.9 : f.cat === 'sneakers' ? 0.5 : 0.2;
  const pal = paletteScore(items.map((f) => ({ info: f.primary, weight: areaW(f) })));
  let color = pal.score;
  const patterned = items.filter((f) => f.cat !== 'accessory' && f.pattern !== 'solid');
  if (patterned.length > 1) color -= 9;
  const names = new Set(items.map((f) => f.primary.name));
  const inc = ctx.colorPrefs?.include || [], avoid = ctx.colorPrefs?.avoid || [];
  if (inc.length) color += inc.some((n) => names.has(n)) ? 6 : -10;
  if (avoid.some((n) => names.has(n))) color -= 25;
  if (ctx.favColors?.some((n) => names.has(n))) color += 3;
  if (ctx.avoidColors?.some((n) => names.has(n))) color -= 8;
  color = clamp(color, 0, 100);

  // ---- style
  const core = items.filter((f) => f.cat !== 'accessory');
  const itemW = (f) => (f.cat === 'accessory' ? 0.4 : f.cat === 'tshirt' && layered ? 0.6 : 1);
  const matchFor = (target) => {
    let t = 0, w = 0;
    for (const f of items) {
      const m = Math.max(...f.styles.map((s) => STYLE_AFFINITY[s]?.[target] ?? 0));
      t += m * itemW(f); w += itemW(f);
    }
    return t / w;
  };
  let target = ctx.style && ctx.style !== 'any' ? ctx.style : null;
  let match;
  if (target) match = matchFor(target);
  else {
    let best = -1;
    for (const s of STYLES) { const m = matchFor(s.id); if (m > best) { best = m; target = s.id; } }
    match = best;
  }
  const formalities = core.map((f) => f.formality);
  const spread = stdev(formalities);
  let style = clamp(match * 100 - Math.max(0, spread - 0.8) * 14, 0, 100);

  // ---- occasion
  let occasion = null;
  const occ = ctx.occasion ? OCCASION[ctx.occasion] : null;
  const meanF = avg(formalities);
  if (occ) {
    const [lo, hi] = occ.formality;
    const d = meanF < lo ? lo - meanF : meanF > hi ? meanF - hi : 0;
    const formalFit = clamp(100 - d * 32, 0, 100);
    const styleFit = Math.max(...occ.styles.map((s) => matchFor(s))) * 100;
    occasion = formalFit * 0.65 + styleFit * 0.35;
  }

  // ---- proportion
  let proportion = 85;
  if (top && o.trousers) {
    proportion = (PROPORTION[top.fit]?.[o.trousers.fit] ?? 0.86) * 100;
    if (target === 'streetwear' && top.fit === 'oversized' && ['wide', 'relaxed'].includes(o.trousers.fit)) proportion += 12;
    if (target === 'formal' && ['oversized', 'wide'].includes(top.fit)) proportion -= 10;
  }
  if (o.sneakers && o.trousers) {
    const gap = Math.abs(o.sneakers.formality - o.trousers.formality);
    if (gap > 1.6) proportion -= (gap - 1.6) * 12;
    if (o.sneakers.subtype === 'chunky' && ['wide', 'relaxed'].includes(o.trousers.fit)) proportion += 5;
  }
  if (top && o.trousers) {
    const gap = Math.abs(top.formality - o.trousers.formality);
    if (gap > 1.4) proportion -= (gap - 1.4) * 15;
  }
  if (layered && o.tshirt.subtype === 'polo') proportion -= 6;
  proportion = clamp(proportion, 0, 100);

  // ---- weather
  let weather = null;
  const warmth = items.reduce((a, f) => a + f.warmth, 0);
  const w = ctx.weather;
  let bandTarget = null;
  if (w) {
    const band = WEATHER_BANDS.find((b) => b.id === w.band) || bandForTemp(w.temp ?? 15);
    bandTarget = band.target;
    const diff = warmth - band.target;
    let s = 100 - Math.abs(diff) * (diff < 0 && ['cool', 'cold'].includes(band.id) ? 18 : 15);
    if (o.hoodie && band.id === 'hot') s -= 20;
    if (w.season) {
      const inSeason = items.filter((f) => !f.seasons || f.seasons.includes(w.season)).length / items.length;
      s = s * 0.8 + inSeason * 20;
    }
    if (w.rain && o.sneakers && o.sneakers.primary.L > 80) s -= 5;
    weather = clamp(s, 0, 100);
  }

  const breakdown = { color, style, occasion, proportion, weather };
  let tw = 0, tot = 0;
  for (const [k, v] of Object.entries(breakdown)) if (v != null) { tot += v * WEIGHTS[k]; tw += WEIGHTS[k]; }
  // Stretch the raw weighted mean so that average combinations land ~70 and great ones ~90+.
  let total = (tot / tw) * 1.6 - 58;
  // Incomplete outfits are capped.
  if (!o.trousers || !top) total -= 25;
  if (!o.sneakers) total -= 8;
  total = clamp(Math.round(total), 0, 100);

  if (!explain) return { total, breakdown };

  // ---- explanations
  const cn = (f) => f.primary.name.toLowerCase();
  const chroma = items.filter((f) => !f.primary.neutral && f.cat !== 'accessory');
  const neutrals = [...new Set(items.filter((f) => f.primary.neutral).map(cn))];
  switch (pal.scheme) {
    case 'neutral': reasons.push(`A neutral palette (${neutrals.slice(0, 3).join(', ')}) — timeless and effortless to wear.`); break;
    case 'tonal neutral': reasons.push(`Tonal neutrals (${neutrals.slice(0, 3).join(', ')}) give a quiet, expensive-looking finish.`); break;
    case 'monochrome': reasons.push(`A monochrome ${cn(chroma[0])} look — cohesive and intentional.`); break;
    case 'accent': reasons.push(`${cap(cn(chroma[0]))} works as a single pop of colour against a neutral base.`); break;
    case 'complementary': reasons.push(`${cap(cn(chroma[0]))} and ${cn(chroma[1] || chroma[0])} are complementary — bold contrast kept in check by the neutrals.`); break;
    case 'analogous': reasons.push(`${cap(cn(chroma[0]))} and ${cn(chroma[1] || chroma[0])} sit side by side on the colour wheel, so they blend smoothly.`); break;
    case 'clashing': {
      const [a, b] = chroma;
      tips.push(`${cap(cn(a))} and ${cn(b || a)} compete for attention — lock your favourite and regenerate to swap the other for a neutral.`);
      break;
    }
  }
  if (pal.notes.includes('too many competing colours')) tips.push('There are a lot of colours at once — try keeping it to one or two plus neutrals.');
  if (pal.notes.includes('two very similar dark tones sit close together')) tips.push('Two very similar dark shades next to each other can look like a mismatch — more contrast would help.');
  if (patterned.length > 1) tips.push('Two patterned pieces compete — pair one of them with something solid.');
  if (top && o.trousers) {
    const dL = Math.abs(top.primary.L - o.trousers.primary.L);
    if (dL > 30) reasons.push('Light/dark contrast between the top and trousers gives a crisp silhouette.');
  }
  const sLabel = STYLE[target]?.label || 'casual';
  if (style >= 80) reasons.push(`Every piece speaks the same ${sLabel.toLowerCase()} language.`);
  else if (style < 65) {
    let worst = null, wm = 2;
    for (const f of core) {
      const m = Math.max(...f.styles.map((s) => STYLE_AFFINITY[s]?.[target] ?? 0));
      if (m < wm) { wm = m; worst = f; }
    }
    if (worst) tips.push(`The ${worst.name.toLowerCase()} reads less ${sLabel.toLowerCase()} than the rest — lock the others and regenerate to swap it.`);
  }
  if (occ) {
    const [lo, hi] = occ.formality;
    if (occasion >= 80) reasons.push(`The formality level is right for ${occ.label.toLowerCase()}.`);
    else if (meanF < lo) tips.push(`A little too relaxed for ${occ.label.toLowerCase()} — dressier trousers or shoes would lift it.`);
    else if (meanF > hi) tips.push(`A bit dressy for ${occ.label.toLowerCase()} — a more relaxed piece would feel more natural.`);
  }
  if (top && o.trousers) {
    if (top.fit === 'oversized' && ['slim', 'regular'].includes(o.trousers.fit)) reasons.push('A roomy top over slimmer trousers keeps the proportions balanced.');
    else if (['oversized', 'relaxed'].includes(top.fit) && o.trousers.fit === 'wide' && target !== 'streetwear') tips.push('Loose top and wide trousers together can look heavy — a slimmer leg would sharpen it.');
    if (top.fit === 'cropped' && ['wide', 'relaxed'].includes(o.trousers.fit)) reasons.push('A cropped top with a fuller trouser lengthens the legs.');
  }
  if (w && bandTarget != null) {
    const t = w.temp != null ? ` (${Math.round(w.temp)}°)` : '';
    const diff = warmth - bandTarget;
    if (Math.abs(diff) <= 1.2) reasons.push(layered ? `Layered sensibly for ${w.band} weather${t}.` : `Right weight for ${w.band} weather${t}.`);
    else if (diff > 0) tips.push(`Could be too warm for ${w.band} weather${t}${o.hoodie ? ' — the hoodie is optional' : ''}.`);
    else tips.push(`Might be chilly for ${w.band} weather${t}${o.hoodie ? '' : ' — add a hoodie'}.`);
    if (w.rain && o.sneakers && o.sneakers.primary.L > 80) tips.push('Rain is expected — darker sneakers are a safer bet.');
  }
  if (!o.trousers) tips.push('Add trousers to your wardrobe to complete outfits.');
  if (!o.sneakers) tips.push('Add sneakers to your wardrobe to complete outfits.');

  return {
    total, breakdown, reasons: reasons.slice(0, 4), tips: tips.slice(0, 3),
    scheme: pal.scheme, style: target,
    palette: [...new Map(items.map((f) => [f.primary.name, f.primary.hex])).values()],
    verdict: total >= 88 ? 'Excellent' : total >= 78 ? 'Great' : total >= 68 ? 'Good' : total >= 55 ? 'Fair' : 'Risky',
  };
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------
export const signatureOf = (items) =>
  ['hoodie', 'tshirt', 'trousers', 'sneakers'].map((k) => items[k] || '-').join('|') + '|' + [...(items.accessory || [])].sort().join(',');

function unaryScore(f, ctx) {
  let s = 0;
  if (ctx.style && ctx.style !== 'any') s += Math.max(...f.styles.map((x) => STYLE_AFFINITY[x]?.[ctx.style] ?? 0)) * 40;
  else s += 20;
  const occ = ctx.occasion && OCCASION[ctx.occasion];
  if (occ) {
    const [lo, hi] = occ.formality;
    s -= (f.formality < lo ? lo - f.formality : f.formality > hi ? f.formality - hi : 0) * 8;
  }
  if (ctx.weather?.season && f.seasons && !f.seasons.includes(ctx.weather.season)) s -= 12;
  const names = f.colors.map((c) => c.name);
  if (ctx.colorPrefs?.include?.some((n) => names.includes(n))) s += 10;
  if (ctx.colorPrefs?.avoid?.includes(f.primary.name)) s -= 40;
  if (ctx.favColors?.includes(f.primary.name)) s += 3;
  if (ctx.preferLeastWorn && ctx.wearCounts) s -= Math.min(15, (ctx.wearCounts.get(f.id) || 0) * 1.5);
  if (ctx.onlyFavorites && !f.item.favorite) s -= 30;
  if (f.item.favorite) s += 2;
  return s;
}

export function availablePool(items, { exclude } = {}) {
  return items.filter((i) => !i.deleted && (i.status || 'available') === 'available' && !exclude?.has(i.id));
}

/**
 * Generate one outfit.
 * @param items   wardrobe items (raw)
 * @param ctx     { style, occasion, weather, colorPrefs, favColors, avoidColors, preferLeastWorn, wearCounts, accessories, layering }
 * @param opts    { locked: {slot: id | ids[]}, mustInclude: id, exclude: Set, avoidSignatures: Set, usage: Map, noRepeat, temperature, random, perSlot }
 * @returns { items, score, signature } | { error }
 */
export function generateOutfit(items, ctx = {}, opts = {}) {
  const r = opts.random || Math.random;
  const byId = new Map(items.map((i) => [i.id, i]));
  const locked = { ...(opts.locked || {}) };
  if (opts.mustInclude && byId.has(opts.mustInclude)) {
    const it = byId.get(opts.mustInclude);
    if (it.category === 'accessory') locked.accessory = [...new Set([...(locked.accessory || []), it.id])];
    else locked[it.category] = it.id;
  }
  const lockedIds = new Set(Object.values(locked).flat().filter(Boolean));
  const usage = opts.usage || new Map();
  const pool = availablePool(items, { exclude: opts.exclude }).filter((i) => !lockedIds.has(i.id));
  const bySlot = { hoodie: [], tshirt: [], trousers: [], sneakers: [], accessory: [] };
  for (const i of pool) bySlot[i.category]?.push(feat(i));

  // Hard no-repeat: drop used items while alternatives remain.
  if (opts.noRepeat) {
    for (const k of Object.keys(bySlot)) {
      const fresh = bySlot[k].filter((f) => !usage.get(f.id));
      if (fresh.length) bySlot[k] = fresh;
    }
  }
  const usagePenalty = (f) => (usage.get(f.id) || 0) * (opts.noRepeat ? 14 : 5);

  const perSlot = opts.perSlot || 11;
  const shortlist = (slot) => {
    if (locked[slot] && slot !== 'accessory') {
      const it = byId.get(locked[slot]);
      return it ? [feat(it)] : [];
    }
    const ranked = bySlot[slot]
      .map((f) => ({ f, s: unaryScore(f, ctx) - usagePenalty(f) + r() * 6 }))
      .sort((a, b) => b.s - a.s);
    const top = ranked.slice(0, perSlot).map((x) => x.f);
    // A couple of wildcards keep results varied.
    const rest = shuffle(ranked.slice(perSlot), r).slice(0, 3).map((x) => x.f);
    return [...top, ...rest];
  };
  const tees = shortlist('tshirt'), hoods = shortlist('hoodie');
  const trousers = shortlist('trousers'), shoes = shortlist('sneakers');
  if (!tees.length && !hoods.length) return { error: 'Add at least one hoodie or T-shirt to generate outfits.' };

  const structures = [];
  const lockT = !!locked.tshirt, lockH = !!locked.hoodie;
  if (tees.length && !lockH) structures.push(['T']);
  if (hoods.length && !lockT) structures.push(['H']);
  if (tees.length && hoods.length && ctx.layering !== false) structures.push(['T', 'H']);
  if (!structures.length) structures.push(lockT ? ['T'] : ['H']);

  const trs = trousers.length ? trousers : [null];
  const shs = shoes.length ? shoes : [null];
  const avoidSig = opts.avoidSignatures || new Set();
  const cands = [];
  const lockedAcc = (locked.accessory || []).map((id) => byId.get(id)).filter(Boolean).map(feat);
  const consider = (o) => {
    const sc = scoreOutfit(o, ctx);
    const pen = outfitFeats(o).reduce((a, f) => a + (lockedIds.has(f.id) ? 0 : usagePenalty(f)), 0);
    cands.push({ o, total: sc.total, rank: sc.total - pen });
  };
  for (const st of structures) {
    const useT = st.includes('T'), useH = st.includes('H');
    const T = useT ? tees.slice(0, useH ? 8 : 14) : [null];
    const H = useH ? hoods.slice(0, useT ? 8 : 14) : [null];
    for (const t of T) for (const h of H) for (const tr of trs) for (const sn of shs)
      consider({ tshirt: t, hoodie: h, trousers: tr, sneakers: sn, accessory: lockedAcc });
  }
  cands.sort((a, b) => b.rank - a.rank);
  const sig = (o) => signatureOf(toIds(o));
  let fresh = cands.filter((c) => !avoidSig.has(sig(c.o)));
  if (!fresh.length) fresh = cands;
  const temperature = opts.temperature ?? 3.5;
  const chosen = softPick(fresh.slice(0, 40), (c) => c.rank, temperature, r);
  const o = { ...chosen.o, accessory: [...lockedAcc] };

  // Accessories: greedy, one per subtype, only if they don't hurt the look.
  if (ctx.accessories !== false && !(Array.isArray(locked.accessory) && opts.keepAccessories)) {
    const styleTarget = ctx.style && ctx.style !== 'any' ? ctx.style : chosenStyle(o, ctx);
    const want = { formal: 1, 'smart-casual': 2, streetwear: 2, casual: 1, sporty: 1 }[ctx.style] ?? 1;
    const accPool = shortlist('accessory');
    let base = scoreOutfit(o, ctx).total;
    while (o.accessory.length < want + lockedAcc.length && accPool.length) {
      const usedSub = new Set(o.accessory.map((a) => a.subtype));
      const opts2 = accPool
        .filter((a) => !usedSub.has(a.subtype) && !o.accessory.includes(a))
        .filter((a) => !(ctx.weather && ['hot', 'warm'].includes(ctx.weather.band) && ['beanie', 'scarf'].includes(a.subtype)))
        .filter((a) => Math.max(...a.styles.map((x) => STYLE_AFFINITY[x]?.[styleTarget] ?? 0)) >= 0.6)
        .map((a) => ({ a, s: scoreOutfit({ ...o, accessory: [...o.accessory, a] }, ctx).total - usagePenalty(a) }))
        .filter((x) => x.s >= base - 1)
        .sort((x, y) => y.s - x.s);
      if (!opts2.length || r() < 0.2) break;
      const pick = softPick(opts2.slice(0, 5), (x) => x.s, 2, r);
      o.accessory.push(pick.a);
      base = pick.s;
    }
  }
  const ids = toIds(o);
  return { items: ids, score: scoreOutfit(o, ctx, true), signature: signatureOf(ids) };
}

function chosenStyle(o, ctx) {
  return scoreOutfit(o, ctx, true).style || 'casual';
}

export function toIds(o) {
  return {
    hoodie: o.hoodie?.id || null, tshirt: o.tshirt?.id || null, trousers: o.trousers?.id || null,
    sneakers: o.sneakers?.id || null, accessory: (o.accessory || []).map((a) => a.id),
  };
}
export function toFeats(ids, byId) {
  const g = (id) => (id && byId.get(id) ? feat(byId.get(id)) : null);
  return {
    hoodie: g(ids.hoodie), tshirt: g(ids.tshirt), trousers: g(ids.trousers), sneakers: g(ids.sneakers),
    accessory: (ids.accessory || []).map(g).filter(Boolean),
  };
}
export function rescore(ids, items, ctx) {
  const byId = new Map(items.map((i) => [i.id, i]));
  return scoreOutfit(toFeats(ids, byId), ctx, true);
}

// Ranked alternatives for one slot of an existing outfit.
export function alternativesFor(slot, ids, items, ctx, limit = 12) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const base = toFeats(ids, byId);
  const pool = availablePool(items).filter((i) => i.category === slot);
  const out = pool.map((i) => {
    const f = feat(i);
    const o = { ...base };
    if (slot === 'accessory') o.accessory = [...base.accessory.filter((a) => a.subtype !== f.subtype), f];
    else o[slot] = f;
    return { item: i, total: scoreOutfit(o, ctx).total };
  });
  return out.sort((a, b) => b.total - a.total).slice(0, limit);
}

/**
 * Generate a sequence of outfits (weekly planner, travel).
 * days: [{ key, style, occasion, weather, mustInclude, locked, random }]
 */
export function generateSeries(items, days, baseCtx = {}, { noRepeat = false, seed, usage: startUsage, avoidSignatures } = {}) {
  const usage = new Map(startUsage || []);
  const sigs = new Set(avoidSignatures || []);
  const out = [];
  for (const d of days) {
    const ctx = { ...baseCtx, style: d.random ? 'any' : d.style || baseCtx.style, occasion: d.occasion ?? baseCtx.occasion, weather: d.weather || baseCtx.weather };
    const res = generateOutfit(items, ctx, {
      locked: d.locked, mustInclude: d.mustInclude, usage, noRepeat, avoidSignatures: sigs,
      temperature: d.random ? 9 : 3.5, random: seed ? seed : undefined, exclude: d.exclude,
    });
    out.push({ key: d.key, ctx, ...res });
    if (res.items) {
      sigs.add(res.signature);
      for (const id of [res.items.hoodie, res.items.tshirt, res.items.trousers, res.items.sneakers, ...res.items.accessory])
        if (id) usage.set(id, (usage.get(id) || 0) + 1);
    }
  }
  return out;
}

// Count how many good outfits (core only) an item participates in — used by shopping & item detail.
export function bestPartners(item, items, ctx = {}, limit = 3) {
  const f = feat(item);
  const pool = availablePool(items).filter((i) => i.id !== item.id && i.category !== item.category && i.category !== 'accessory');
  return pool
    .map((i) => {
      const g = feat(i);
      const p = pairHarmony(f.primary, g.primary).h;
      const st = Math.max(...f.styles.map((s) => Math.max(...g.styles.map((t) => STYLE_AFFINITY[s]?.[t] ?? 0))));
      return { item: i, score: round((p * 0.6 + st * 0.4) * 100) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export { hueDist, STYLE_FORMALITY };

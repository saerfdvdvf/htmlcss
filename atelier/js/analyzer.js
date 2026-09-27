// On-device image analysis for new clothing photos:
// background removal, dominant colours, pattern, silhouette-based category guess,
// and (when reachable) a MobileNet classifier for a second opinion.
import { rgbToLab, deltaE, rgbToHex, nameColor, colorInfo } from './color.js';
import { guessStyles, guessFit, guessSeasons, itemWarmth, itemFormality } from './engine.js';
import { rng } from './util.js';

const MAX = 640;

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = src;
  });
}
export const fileToDataURL = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

// Downscale any image (data URL) to a compact JPEG/WebP data URL.
export async function compress(src, max = 900, quality = 0.85, type = 'image/jpeg') {
  const img = await loadImage(src);
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL(type, quality);
}

// ---------------------------------------------------------------------------
// Background removal: flood fill from the borders when the backdrop is uniform.
// ---------------------------------------------------------------------------
function removeBackground(data, w, h, k = 1) {
  const px = (i) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
  const border = [];
  const step = Math.max(1, Math.floor((w + h) / 300));
  for (let x = 0; x < w; x += step) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y += step) border.push(y * w, y * w + w - 1);
  const labs = border.map((i) => rgbToLab(px(i)));
  // Median background colour
  const med = [0, 1, 2].map((k) => labs.map((l) => l[k]).sort((a, b) => a - b)[Math.floor(labs.length / 2)]);
  const uniform = labs.filter((l) => deltaE(l, med) < 14).length / labs.length;
  if (uniform < 0.6) return null;

  const labCache = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const l = rgbToLab(px(i));
    labCache[i * 3] = l[0]; labCache[i * 3 + 1] = l[1]; labCache[i * 3 + 2] = l[2];
  }
  const dist = (i, ref) => Math.hypot(labCache[i * 3] - ref[0], labCache[i * 3 + 1] - ref[1], labCache[i * 3 + 2] - ref[2]);
  const distIJ = (i, j) => Math.hypot(labCache[i * 3] - labCache[j * 3], labCache[i * 3 + 1] - labCache[j * 3 + 1], labCache[i * 3 + 2] - labCache[j * 3 + 2]);
  const bg = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let qh = 0, qt = 0;
  const TOL = 16 * k, TOL_FAR = 30 * k, TOL_STEP = 5 * k;
  const seed = (i) => { if (!bg[i] && dist(i, med) < TOL_FAR) { bg[i] = 1; queue[qt++] = i; } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (qh < qt) {
    const i = queue[qh++];
    const x = i % w, y = (i / w) | 0;
    const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    for (const j of nb) {
      if (j < 0 || bg[j]) continue;
      const dm = dist(j, med);
      // Accept close-to-backdrop pixels, or soft shadows that change gradually.
      if (dm < TOL || (dm < TOL_FAR && distIJ(i, j) < TOL_STEP)) { bg[j] = 1; queue[qt++] = j; }
    }
  }
  let fg = 0;
  for (let i = 0; i < w * h; i++) if (!bg[i]) fg++;
  const frac = fg / (w * h);
  if (frac < 0.04 || frac > 0.96) return null;
  return bg;
}

// ---------------------------------------------------------------------------
// Dominant colours with k-means in Lab space.
// ---------------------------------------------------------------------------
function dominantColors(samples, k = 5) {
  if (!samples.length) return [];
  const r = rng(samples.length);
  const labs = samples.map((s) => rgbToLab(s));
  let cents = [labs[Math.floor(r() * labs.length)]];
  while (cents.length < k) {
    const d = labs.map((l) => Math.min(...cents.map((c) => deltaE(l, c))) ** 2);
    let t = r() * d.reduce((a, b) => a + b, 0);
    let idx = 0;
    for (; idx < d.length - 1 && (t -= d[idx]) > 0; idx++);
    cents.push(labs[idx]);
  }
  let assign = new Int32Array(labs.length);
  for (let it = 0; it < 10; it++) {
    labs.forEach((l, i) => {
      let b = 0, bd = Infinity;
      cents.forEach((c, j) => { const dd = deltaE(l, c); if (dd < bd) { bd = dd; b = j; } });
      assign[i] = b;
    });
    cents = cents.map((c, j) => {
      const m = [0, 0, 0]; let n = 0;
      labs.forEach((l, i) => { if (assign[i] === j) { m[0] += l[0]; m[1] += l[1]; m[2] += l[2]; n++; } });
      return n ? m.map((v) => v / n) : c;
    });
  }
  let clusters = cents.map((c, j) => {
    const members = samples.filter((_, i) => assign[i] === j);
    const rgb = [0, 1, 2].map((k2) => members.reduce((a, m) => a + m[k2], 0) / (members.length || 1));
    return { lab: c, rgb, n: members.length };
  }).filter((c) => c.n);
  // Merge perceptually similar clusters.
  clusters.sort((a, b) => b.n - a.n);
  const merged = [];
  for (const c of clusters) {
    const m = merged.find((x) => deltaE(x.lab, c.lab) < 11);
    if (m) {
      const t = m.n + c.n;
      m.rgb = m.rgb.map((v, i) => (v * m.n + c.rgb[i] * c.n) / t);
      m.lab = rgbToLab(m.rgb);
      m.n = t;
    } else merged.push({ ...c });
  }
  const total = samples.length;
  return merged
    .sort((a, b) => b.n - a.n)
    .map((c) => ({ hex: rgbToHex(c.rgb), pct: Math.round((c.n / total) * 100) }))
    .filter((c) => c.pct >= 4)
    .slice(0, 4)
    .map((c) => ({ ...c, name: nameColor(c.hex) }));
}

// ---------------------------------------------------------------------------
// Silhouette heuristics (need a foreground mask).
// ---------------------------------------------------------------------------
function silhouette(mask, w, h) {
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const at = (fx, fy) => mask[Math.min(h - 1, Math.round(y0 + fy * bh)) * w + Math.min(w - 1, Math.round(x0 + fx * bw))];
  const region = (fx0, fx1, fy0, fy1) => {
    let n = 0, f = 0;
    for (let fy = fy0; fy <= fy1; fy += 0.02) for (let fx = fx0; fx <= fx1; fx += 0.02) { n++; f += at(fx, fy) ? 1 : 0; }
    return f / n;
  };
  let fill = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) fill += mask[y * w + x] ? 1 : 0;
  return {
    box: { x: x0, y: y0, w: bw, h: bh },
    aspect: bw / bh,
    fill: fill / (bw * bh),
    legGap: region(0.46, 0.54, 0.7, 0.98), // empty between trouser legs
    neckGap: region(0.44, 0.56, 0.0, 0.06), // empty neckline on a tee
    sleeveLow: (region(0.0, 0.12, 0.7, 0.9) + region(0.88, 1, 0.7, 0.9)) / 2, // long sleeves reach low
    shoulders: region(0.0, 1, 0.18, 0.35),
    bottomBand: region(0, 1, 0.85, 1),
  };
}

function guessFromShape(s) {
  if (!s) return null;
  const scores = { hoodie: 0, tshirt: 0, trousers: 0, sneakers: 0, accessory: 0 };
  if (s.aspect > 1.3) scores.sneakers += 1.4;
  if (s.aspect > 1.3 && s.bottomBand > 0.55) scores.sneakers += 1;
  if (s.aspect > 1.6) scores.sneakers += 0.8;
  if (s.aspect < 0.8 && s.legGap < 0.35) scores.trousers += 2.4;
  if (s.aspect < 0.62) scores.trousers += 0.8;
  if (s.aspect >= 0.75 && s.aspect <= 1.45 && s.shoulders > 0.5) {
    scores.tshirt += 1.2; scores.hoodie += 1.1;
    if (s.neckGap < 0.4) scores.tshirt += 0.9; else scores.hoodie += 0.9;
    if (s.sleeveLow > 0.45) scores.hoodie += 1; else scores.tshirt += 0.5;
  }
  if (s.fill < 0.35 && s.aspect <= 1.3) scores.accessory += 1.6;
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? { category: best[0], confidence: Math.min(0.75, best[1] / 3.5) } : null;
}

const NAME_HINTS = [
  [/hood|sweat|crewneck|zip/i, 'hoodie'],
  [/tee|t-?shirt|shirt|polo|tank|henley|top/i, 'tshirt'],
  [/jean|pant|trouser|chino|cargo|jogger|short|denim/i, 'trousers'],
  [/sneaker|shoe|trainer|runner|jordan|dunk|air ?max|yeezy|converse|vans/i, 'sneakers'],
  [/cap|hat|watch|bag|belt|glass|chain|necklace|beanie|scarf|ring|bracelet|tote/i, 'accessory'],
];
const SUB_HINTS = [
  [/zip/i, 'zip-up'], [/crew/i, 'crewneck sweatshirt'], [/oversiz/i, 'oversized'],
  [/polo/i, 'polo'], [/long ?sleeve/i, 'long sleeve'], [/tank/i, 'tank top'], [/graphic|print/i, 'graphic tee'],
  [/jean|denim/i, 'jeans'], [/chino/i, 'chinos'], [/cargo/i, 'cargo'], [/jogger|sweatpant/i, 'joggers'], [/short/i, 'shorts'], [/tailor|suit|dress pant/i, 'tailored'],
  [/high/i, 'high-top'], [/run/i, 'runner'], [/chunky/i, 'chunky'],
  [/cap/i, 'cap'], [/beanie/i, 'beanie'], [/watch/i, 'watch'], [/bag|tote/i, 'bag'], [/glass/i, 'sunglasses'], [/belt/i, 'belt'], [/chain|necklace/i, 'chain'], [/scarf/i, 'scarf'],
];

// ---------------------------------------------------------------------------
// Optional ML classifier (MobileNet, loaded lazily from a CDN).
// ---------------------------------------------------------------------------
const ML_MAP = [
  [/sweatshirt|cardigan|trench coat|fur coat|poncho|lab coat/i, 'hoodie', null],
  [/jersey|t-shirt|tee shirt|bulletproof/i, 'tshirt', null],
  [/jean|denim/i, 'trousers', 'jeans'],
  [/swimming trunks|bathing trunks/i, 'trousers', 'shorts'],
  [/pajama|suit/i, 'trousers', null],
  [/running shoe/i, 'sneakers', 'runner'],
  [/loafer|clog|sandal|cowboy boot|shoe/i, 'sneakers', null],
  [/sunglass|dark glasses/i, 'accessory', 'sunglasses'],
  [/backpack|purse|wallet|mailbag|pencil case/i, 'accessory', 'bag'],
  [/necklace|chain/i, 'accessory', 'chain'],
  [/digital watch|analog clock|wall clock|stopwatch|magnetic compass/i, 'accessory', 'watch'],
  [/buckle/i, 'accessory', 'belt'],
  [/cowboy hat|sombrero|bonnet|mortarboard|baseball/i, 'accessory', 'cap'],
  [/ski mask|shower cap/i, 'accessory', 'beanie'],
  [/stole|feather boa/i, 'accessory', 'scarf'],
  [/bow tie|windsor tie|bolo tie/i, 'accessory', null],
];
let modelP = null;
const loadScript = (src) =>
  new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true; s.onload = resolve; s.onerror = () => reject(new Error('script ' + src));
    document.head.appendChild(s);
  });
export function loadModel() {
  if (modelP) return modelP;
  modelP = (async () => {
    if (!globalThis.tf) await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
    if (!globalThis.mobilenet) await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js');
    return globalThis.mobilenet.load({ version: 2, alpha: 1.0 });
  })().catch((e) => { console.info('Smart recognition unavailable:', e.message); modelP = null; return null; });
  return modelP;
}
async function classify(canvas) {
  const timeout = new Promise((r) => setTimeout(() => r(null), 12000));
  const model = await Promise.race([loadModel(), timeout]);
  if (!model) return null;
  const preds = await model.classify(canvas, 5);
  for (const p of preds) {
    const hit = ML_MAP.find(([re]) => re.test(p.className));
    if (hit && p.probability > 0.08) return { category: hit[1], subtype: hit[2], confidence: Math.min(0.95, 0.4 + p.probability), label: p.className };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public: analyse a photo → suggested item fields.
// ---------------------------------------------------------------------------
export async function analyzeImage(src, { fileName = '', smart = true } = {}) {
  const img = await loadImage(src);
  const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Transparent PNGs already have a mask.
  let mask = new Uint8Array(w * h), transparent = 0;
  for (let i = 0; i < w * h; i++) { const a = data[i * 4 + 3] > 40; mask[i] = a ? 1 : 0; if (!a) transparent++; }
  let bgRemoved = transparent / (w * h) > 0.05;
  if (!bgRemoved) {
    // Retry with tighter tolerances for garments close in colour to the backdrop.
    const bg = removeBackground(data, w, h) || removeBackground(data, w, h, 0.5) || removeBackground(data, w, h, 0.28);
    if (bg) {
      bgRemoved = true;
      for (let i = 0; i < w * h; i++) mask[i] = bg[i] ? 0 : 1;
    } else mask.fill(1);
  }
  // Soft 3x3 alpha edge.
  if (bgRemoved) {
    const a = new Uint8ClampedArray(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = y + dy, xx = x + dx;
        if (yy >= 0 && yy < h && xx >= 0 && xx < w) { s += mask[yy * w + xx]; n++; }
      }
      a[y * w + x] = Math.round((s / n) * 255);
    }
    for (let i = 0; i < w * h; i++) data[i * 4 + 3] = Math.min(data[i * 4 + 3], a[i]);
    ctx.putImageData(imgData, 0, 0);
  }

  // Colour samples from the foreground (ignoring near-transparent pixels).
  const samples = [];
  const stride = Math.max(1, Math.floor(Math.sqrt((w * h) / 5000)));
  for (let y = 0; y < h; y += stride) for (let x = 0; x < w; x += stride) {
    const i = y * w + x;
    if (mask[i] && data[i * 4 + 3] > 200) samples.push([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);
  }
  const colors = dominantColors(samples);
  const pattern = !colors.length || colors[0].pct >= 72 ? 'solid'
    : colors.length >= 3 && colors[1].pct < 22 && colorInfo(colors[1].hex).C > 25 ? 'graphic'
    : colors.length >= 3 ? 'print' : colors[0].pct >= 58 ? 'solid' : 'colorblock';

  const shape = bgRemoved ? silhouette(mask, w, h) : null;

  // Crop to the garment with a little padding.
  let out = c;
  if (shape) {
    const pad = Math.round(Math.max(shape.box.w, shape.box.h) * 0.06);
    const bx = Math.max(0, shape.box.x - pad), by = Math.max(0, shape.box.y - pad);
    const bw = Math.min(w - bx, shape.box.w + pad * 2), bh = Math.min(h - by, shape.box.h + pad * 2);
    out = document.createElement('canvas');
    out.width = bw; out.height = bh;
    out.getContext('2d').drawImage(c, bx, by, bw, bh, 0, 0, bw, bh);
  }

  // Category: filename → ML → silhouette.
  let category = null, confidence = 0, subtype = '', source = '';
  for (const [re, cat] of NAME_HINTS) if (re.test(fileName)) { category = cat; confidence = 0.7; source = 'file name'; break; }
  for (const [re, st] of SUB_HINTS) if (re.test(fileName)) { subtype = st; break; }
  let ml = null;
  if (smart) { try { ml = await classify(out); } catch (e) { console.info(e); } }
  if (ml && ml.confidence > confidence) { category = ml.category; confidence = ml.confidence; source = 'visual recognition'; if (ml.subtype && !subtype) subtype = ml.subtype; }
  const sh = guessFromShape(shape);
  if (sh) {
    if (!category) { category = sh.category; confidence = sh.confidence; source = 'silhouette'; }
    else if (sh.category === category) confidence = Math.min(0.97, confidence + 0.15);
  }
  if (!category) { category = 'tshirt'; confidence = 0.2; source = 'default'; }
  if (subtype && !CATSUB[category]?.includes(subtype)) subtype = '';
  if (!subtype) subtype = CATSUB_DEFAULT[category];

  const hex = colors[0]?.hex || '#888888';
  const base = { category, subtype };
  const warmth = itemWarmth(base);
  const image = out.toDataURL(bgRemoved ? 'image/webp' : 'image/jpeg', 0.86);
  return {
    image: image.startsWith('data:image/webp') || !bgRemoved ? image : out.toDataURL('image/png'),
    bgRemoved,
    category, subtype, confidence, source,
    colors: colors.length ? colors : [{ hex, name: nameColor(hex), pct: 100 }],
    pattern,
    styles: guessStyles(category, subtype, pattern, hex),
    seasons: guessSeasons(category, subtype, warmth),
    fit: guessFit(category, subtype),
    warmth, formality: itemFormality(base),
    name: `${nameColor(hex)} ${subtype && subtype !== CATSUB_DEFAULT[category] ? subtype : LABEL[category]}`,
  };
}

const CATSUB = {
  hoodie: ['pullover', 'zip-up', 'crewneck sweatshirt', 'oversized', 'cropped'],
  tshirt: ['tee', 'graphic tee', 'long sleeve', 'polo', 'tank top', 'henley'],
  trousers: ['jeans', 'chinos', 'cargo', 'joggers', 'tailored', 'wide leg', 'shorts'],
  sneakers: ['low-top', 'high-top', 'runner', 'chunky', 'minimal leather', 'skate'],
  accessory: ['cap', 'beanie', 'watch', 'bag', 'sunglasses', 'belt', 'chain', 'scarf', 'bracelet', 'ring'],
};
const CATSUB_DEFAULT = { hoodie: 'pullover', tshirt: 'tee', trousers: 'jeans', sneakers: 'low-top', accessory: 'cap' };
const LABEL = { hoodie: 'hoodie', tshirt: 'tee', trousers: 'trousers', sneakers: 'sneakers', accessory: 'accessory' };

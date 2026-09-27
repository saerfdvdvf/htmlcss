// Color science + fashion color theory. Pure module (no DOM).

export function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgbToHex = ([r, g, b]) =>
  '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

export function rgbToLab([r, g, b]) {
  const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const R = lin(r), G = lin(g), B = lin(b);
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x); y = f(y); z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
export const hexToLab = (hex) => rgbToLab(hexToRgb(hex));
export function labToLch([L, a, b]) {
  const C = Math.hypot(a, b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, C, H];
}
export const deltaE = (l1, l2) => Math.hypot(l1[0] - l2[0], l1[1] - l2[1], l1[2] - l2[2]);
export const hueDist = (h1, h2) => {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
};

// Fashion-oriented named palette. `neutral` marks colors that behave as neutrals in styling.
export const NAMED_COLORS = [
  { name: 'Black', hex: '#111111', neutral: true },
  { name: 'Charcoal', hex: '#36393d', neutral: true },
  { name: 'Grey', hex: '#8a8d91', neutral: true },
  { name: 'Light grey', hex: '#c9cbcd', neutral: true },
  { name: 'White', hex: '#f7f7f5', neutral: true },
  { name: 'Off-white', hex: '#ece6d8', neutral: true },
  { name: 'Cream', hex: '#e9dcc0', neutral: true },
  { name: 'Beige', hex: '#cdb894', neutral: true },
  { name: 'Sand', hex: '#c2a878', neutral: true },
  { name: 'Khaki', hex: '#a39a6b', neutral: true },
  { name: 'Camel', hex: '#b5854b', neutral: true },
  { name: 'Tan', hex: '#9c7650', neutral: true },
  { name: 'Brown', hex: '#5f4330', neutral: true },
  { name: 'Chocolate', hex: '#3e2a20', neutral: true },
  { name: 'Navy', hex: '#1d2a44', neutral: true },
  { name: 'Denim', hex: '#3f5f86', neutral: true },
  { name: 'Light denim', hex: '#7d9cc0', neutral: true },
  { name: 'Olive', hex: '#5b5f37', neutral: true },
  { name: 'Burgundy', hex: '#6b1f2e' },
  { name: 'Red', hex: '#c0302b' },
  { name: 'Rust', hex: '#a24c26' },
  { name: 'Terracotta', hex: '#c46a4a' },
  { name: 'Orange', hex: '#e07a2c' },
  { name: 'Mustard', hex: '#c89b2a' },
  { name: 'Yellow', hex: '#f0d24a' },
  { name: 'Lime', hex: '#a9c93c' },
  { name: 'Green', hex: '#2f8a4c' },
  { name: 'Forest green', hex: '#23422f' },
  { name: 'Sage', hex: '#9aa98a' },
  { name: 'Mint', hex: '#a8dcc3' },
  { name: 'Teal', hex: '#1f6e70' },
  { name: 'Sky blue', hex: '#8fc2e8' },
  { name: 'Blue', hex: '#2f63c0' },
  { name: 'Cobalt', hex: '#1f44a8' },
  { name: 'Lavender', hex: '#b7a8d8' },
  { name: 'Purple', hex: '#5d3a8a' },
  { name: 'Pink', hex: '#eaa6b8' },
  { name: 'Hot pink', hex: '#d63d82' },
  { name: 'Coral', hex: '#e8796b' },
].map((c) => ({ ...c, lab: hexToLab(c.hex) }));
export const NAMED = Object.fromEntries(NAMED_COLORS.map((c) => [c.name, c]));

// Nombres en español para mostrar (el nombre interno en inglés se guarda en los datos).
const ES = {
  Black: 'Negro', Charcoal: 'Gris marengo', Grey: 'Gris', 'Light grey': 'Gris claro', White: 'Blanco', 'Off-white': 'Blanco roto',
  Cream: 'Crema', Beige: 'Beis', Sand: 'Arena', Khaki: 'Caqui', Camel: 'Camel', Tan: 'Tostado', Brown: 'Marrón', Chocolate: 'Chocolate',
  Navy: 'Azul marino', Denim: 'Denim', 'Light denim': 'Denim claro', Olive: 'Verde oliva', Burgundy: 'Burdeos', Red: 'Rojo', Rust: 'Óxido',
  Terracotta: 'Terracota', Orange: 'Naranja', Mustard: 'Mostaza', Yellow: 'Amarillo', Lime: 'Lima', Green: 'Verde', 'Forest green': 'Verde bosque',
  Sage: 'Verde salvia', Mint: 'Menta', Teal: 'Verde azulado', 'Sky blue': 'Azul cielo', Blue: 'Azul', Cobalt: 'Azul cobalto', Lavender: 'Lavanda',
  Purple: 'Morado', Pink: 'Rosa', 'Hot pink': 'Fucsia', Coral: 'Coral',
};
export const colorLabel = (name) => ES[name] || name || '';

export function nameColor(hex) {
  const lab = hexToLab(hex);
  let best = NAMED_COLORS[0], bd = Infinity;
  for (const c of NAMED_COLORS) {
    const d = deltaE(lab, c.lab);
    if (d < bd) { bd = d; best = c; }
  }
  return best.name;
}

// Everything the engine needs about one colour, computed once.
export function colorInfo(hex) {
  const lab = hexToLab(hex);
  const [L, C, H] = labToLch(lab);
  const name = nameColor(hex);
  const named = NAMED[name];
  const neutral = C < 12 || !!named?.neutral;
  return { hex, lab, L, C, H, name, neutral };
}

// Harmony between two colours, 0..1, plus the relationship name.
export function pairHarmony(a, b) {
  const dL = Math.abs(a.L - b.L);
  const contrastBonus = dL > 25 ? 0.05 : dL < 8 ? -0.05 : 0;
  if (a.neutral && b.neutral) {
    // Near-identical dark neutrals (black + navy) read as a near-miss.
    if (dL < 7 && deltaE(a.lab, b.lab) > 4 && deltaE(a.lab, b.lab) < 18 && a.L < 35) return { h: 0.7, rel: 'near-miss' };
    return { h: 0.9 + contrastBonus, rel: 'neutral' };
  }
  if (a.neutral || b.neutral) {
    const chroma = a.neutral ? b : a;
    // Loud colours are easy to anchor with neutrals.
    return { h: 0.88 + contrastBonus + (chroma.C > 60 ? -0.02 : 0), rel: 'anchored' };
  }
  const d = hueDist(a.H, b.H);
  const loud = a.C > 55 && b.C > 55;
  let h, rel;
  if (d < 14) { h = dL > 12 ? 0.9 : 0.8; rel = 'tonal'; }
  else if (d < 40) { h = 0.8; rel = 'analogous'; }
  else if (d < 95) { h = 0.45; rel = 'clash'; }
  else if (d < 150) { h = 0.66; rel = 'triadic'; }
  else { h = 0.76; rel = 'complementary'; }
  if (loud && rel !== 'tonal') h -= 0.12;
  return { h: Math.max(0, Math.min(1, h + contrastBonus)), rel };
}

// Score a whole palette (list of {info, weight}), return 0..100 + a description.
export function paletteScore(entries) {
  const list = entries.filter((e) => e.info);
  if (list.length < 2) return { score: 80, scheme: 'simple', notes: [] };
  let tot = 0, wsum = 0;
  const rels = [];
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const w = list[i].weight * list[j].weight;
      const p = pairHarmony(list[i].info, list[j].info);
      tot += p.h * w; wsum += w;
      rels.push(p.rel);
    }
  let score = (tot / wsum) * 100;
  const chromatic = list.filter((e) => !e.info.neutral);
  const hues = [];
  for (const c of chromatic) if (!hues.some((h) => hueDist(h, c.info.H) < 25)) hues.push(c.info.H);
  const notes = [];
  if (hues.length > 2) { score -= (hues.length - 2) * 9; notes.push('too many competing colours'); }
  if (chromatic.length && chromatic.length < list.length) score += 3; // neutral anchor
  const Ls = list.map((e) => e.info.L);
  const range = Math.max(...Ls) - Math.min(...Ls);
  let scheme;
  if (!chromatic.length) scheme = range < 18 ? 'tonal neutral' : 'neutral';
  else if (hues.length === 1 && chromatic.length === list.length) scheme = 'monochrome';
  else if (hues.length === 1) scheme = 'accent';
  else if (rels.includes('complementary')) scheme = 'complementary';
  else if (rels.includes('analogous')) scheme = 'analogous';
  else if (rels.includes('clash')) scheme = 'clashing';
  else scheme = 'mixed';
  if (range < 10 && list.length > 2 && scheme !== 'tonal neutral') { score -= 6; notes.push('little light/dark contrast'); }
  if (rels.includes('near-miss')) notes.push('two very similar dark tones sit close together');
  return { score: Math.max(0, Math.min(100, score)), scheme, notes, hues: hues.length };
}

export const isLight = (hex) => hexToLab(hex)[0] > 62;
// Readable text colour on top of a swatch.
export const inkOn = (hex) => (isLight(hex) ? '#151412' : '#ffffff');

export function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const f = (v) => (amt < 0 ? v * (1 + amt) : v + (255 - v) * amt);
  return rgbToHex([f(r), f(g), f(b)]);
}

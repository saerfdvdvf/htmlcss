// Flat-lay garment illustrations (SVG). Used for the demo wardrobe and shopping suggestions.
import { shade, isLight } from './color.js';

const wrap = (inner, defs = '', box = '0 0 200 200') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}"><defs>${defs}</defs>${inner}</svg>`;
// Tight crops so flat-lays and try-on layers aren't padded with empty space.
const BOX = { sneakers: '14 58 182 110' };

function grad(id, c) {
  return `<linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="${shade(c, -0.1)}"/><stop offset=".45" stop-color="${c}"/><stop offset="1" stop-color="${shade(c, -0.14)}"/></linearGradient>`;
}

const DRAW = {
  tshirt(c, sub, acc) {
    const line = isLight(c) ? shade(c, -0.22) : shade(c, 0.22);
    const long = sub === 'long sleeve';
    const tank = sub === 'tank top';
    const polo = sub === 'polo';
    let body;
    if (tank) body = `<path d="M70 22 Q76 60 60 70 L60 180 L140 180 L140 70 Q124 60 130 22 L116 22 Q100 44 84 22 Z" fill="url(#g)"/>`;
    else if (long) body = `<path d="M60 30 L82 20 Q100 34 118 20 L140 30 L168 70 L180 160 L162 164 L146 92 L144 180 L56 180 L54 92 L38 164 L20 160 L32 70 Z" fill="url(#g)"/>`;
    else body = `<path d="M60 30 L82 20 Q100 34 118 20 L140 30 L174 56 L158 84 L142 74 L142 180 L58 180 L58 74 L42 84 L26 56 Z" fill="url(#g)"/>`;
    let extra = tank ? '' : `<path d="M82 20 Q100 38 118 20" fill="none" stroke="${line}" stroke-width="3"/>`;
    if (polo) extra = `<path d="M84 20 L100 44 L116 20 L108 18 L100 30 L92 18 Z" fill="${shade(c, -0.12)}"/><line x1="100" y1="44" x2="100" y2="70" stroke="${line}" stroke-width="2"/><circle cx="100" cy="54" r="2" fill="${line}"/><circle cx="100" cy="64" r="2" fill="${line}"/>`;
    if (sub === 'graphic tee') extra += `<circle cx="100" cy="95" r="22" fill="none" stroke="${acc}" stroke-width="5"/><path d="M86 95 L100 80 L114 95 L100 110 Z" fill="${acc}"/>`;
    if (sub === 'henley') extra += `<line x1="100" y1="30" x2="100" y2="62" stroke="${line}" stroke-width="2"/><circle cx="100" cy="42" r="2" fill="${line}"/><circle cx="100" cy="54" r="2" fill="${line}"/>`;
    return body + extra;
  },
  hoodie(c, sub, acc) {
    const dark = shade(c, -0.18);
    const cord = isLight(c) ? shade(c, -0.35) : '#f3efe6';
    const zip = sub === 'zip-up';
    const crew = sub === 'crewneck sweatshirt';
    const hood = crew ? '' : `<path d="M70 38 Q66 6 100 6 Q134 6 130 38 Q100 52 70 38 Z" fill="${dark}"/>`;
    const body = `<path d="M62 36 L82 28 Q100 42 118 28 L138 36 L168 70 L182 150 L162 156 L148 96 L146 178 L54 178 L52 96 L38 156 L18 150 L32 70 Z" fill="url(#g)"/>`;
    const rib = `<rect x="54" y="170" width="92" height="9" rx="2" fill="${dark}"/><rect x="16" y="148" width="22" height="9" rx="2" transform="rotate(8 27 152)" fill="${dark}"/><rect x="162" y="148" width="22" height="9" rx="2" transform="rotate(-8 173 152)" fill="${dark}"/>`;
    const pocket = zip
      ? `<path d="M64 128 L84 128 L86 160 L62 160 Z M136 128 L116 128 L114 160 L138 160 Z" fill="${shade(c, -0.08)}" stroke="${dark}" stroke-width="1.5"/><line x1="100" y1="34" x2="100" y2="176" stroke="${shade(c, -0.4)}" stroke-width="3"/>`
      : crew ? `<path d="M82 28 Q100 44 118 28" fill="none" stroke="${dark}" stroke-width="5"/>`
      : `<path d="M72 126 L128 126 L138 160 L62 160 Z" fill="${shade(c, -0.07)}" stroke="${dark}" stroke-width="1.5"/>`;
    const cords = crew ? '' : `<path d="M92 40 Q90 60 89 76 M108 40 Q110 60 111 76" stroke="${cord}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
    const art = sub === 'oversized' && acc ? `<text x="100" y="104" text-anchor="middle" font-family="Georgia,serif" font-size="18" font-style="italic" fill="${acc}">atelier</text>` : '';
    return hood + body + rib + pocket + cords + art;
  },
  trousers(c, sub) {
    const dark = shade(c, -0.2);
    const seam = isLight(c) ? shade(c, -0.25) : shade(c, 0.18);
    if (sub === 'shorts')
      return `<path d="M58 40 L142 40 L152 132 L108 136 L100 84 L92 136 L48 132 Z" fill="url(#g)"/><rect x="58" y="40" width="84" height="12" fill="${dark}"/><line x1="100" y1="52" x2="100" y2="80" stroke="${seam}" stroke-width="2"/>`;
    const wide = sub === 'wide leg' || sub === 'cargo';
    const legs = wide
      ? `<path d="M60 16 L140 16 L158 186 L110 186 L100 76 L90 186 L42 186 Z" fill="url(#g)"/>`
      : sub === 'joggers'
      ? `<path d="M60 16 L140 16 L146 170 L140 184 L112 184 L108 170 L100 76 L92 170 L88 184 L60 184 L54 170 Z" fill="url(#g)"/><rect x="58" y="172" width="32" height="12" rx="3" fill="${dark}"/><rect x="110" y="172" width="32" height="12" rx="3" fill="${dark}"/>`
      : `<path d="M62 16 L138 16 L148 186 L110 186 L100 74 L90 186 L52 186 Z" fill="url(#g)"/>`;
    let extra = `<rect x="61" y="16" width="78" height="12" fill="${dark}"/><line x1="100" y1="28" x2="100" y2="66" stroke="${seam}" stroke-width="2"/>`;
    if (sub === 'jeans' || !sub) extra += `<path d="M66 30 Q76 44 86 30 M134 30 Q124 44 114 30" fill="none" stroke="${seam}" stroke-width="1.6"/>`;
    if (sub === 'cargo') extra += `<rect x="50" y="104" width="26" height="30" rx="3" fill="${shade(c, -0.08)}" stroke="${dark}"/><rect x="124" y="104" width="26" height="30" rx="3" fill="${shade(c, -0.08)}" stroke="${dark}"/>`;
    if (sub === 'tailored' || sub === 'chinos') extra += `<line x1="76" y1="30" x2="72" y2="184" stroke="${seam}" stroke-width="1.2" opacity=".7"/><line x1="124" y1="30" x2="128" y2="184" stroke="${seam}" stroke-width="1.2" opacity=".7"/>`;
    if (sub === 'joggers') extra += `<path d="M92 28 L90 44 M108 28 L110 44" stroke="${seam}" stroke-width="2"/>`;
    return legs + extra;
  },
  sneakers(c, sub, acc) {
    const sole = sub === 'chunky' ? '#f2efe8' : isLight(c) ? '#e9e6df' : '#f7f5f0';
    const soleH = sub === 'chunky' ? 26 : 14;
    const high = sub === 'high-top';
    const upper = high
      ? `<path d="M34 ${150 - soleH} L40 70 Q58 62 76 70 L86 108 Q140 112 172 130 Q186 136 186 ${150 - soleH} Z" fill="url(#g)"/>`
      : `<path d="M30 ${150 - soleH} L38 104 Q56 92 76 100 L104 110 Q146 114 172 128 Q186 134 186 ${150 - soleH} Z" fill="url(#g)"/>`;
    const soleP = `<path d="M22 ${150 - soleH} L190 ${150 - soleH} Q192 ${152} 186 ${154 + (sub === 'chunky' ? 6 : 0)} L30 ${154 + (sub === 'chunky' ? 6 : 0)} Q20 ${152} 22 ${150 - soleH} Z" fill="${sole}" stroke="#d8d3ca"/>`;
    const lace = isLight(c) ? shade(c, -0.3) : '#f3efe6';
    const laces = [0, 1, 2, 3].map((i) => `<line x1="${84 + i * 12}" y1="${104 + i * 3 - (high ? 10 : 0)}" x2="${92 + i * 12}" y2="${116 + i * 3 - (high ? 10 : 0)}" stroke="${lace}" stroke-width="3" stroke-linecap="round"/>`).join('');
    const swoosh = sub === 'runner' || sub === 'low-top' || !sub
      ? `<path d="M70 ${136 - soleH / 2} Q120 ${140 - soleH / 2} 164 ${118}" fill="none" stroke="${acc}" stroke-width="5" stroke-linecap="round"/>` : '';
    const heel = `<path d="M30 ${150 - soleH} L36 ${112 - (high ? 40 : 0)} L44 ${112 - (high ? 40 : 0)} L40 ${150 - soleH} Z" fill="${shade(c, -0.15)}"/>`;
    return upper + heel + soleP + laces + swoosh;
  },
  accessory(c, sub) {
    const dark = shade(c, -0.25);
    switch (sub) {
      case 'cap': return `<path d="M44 120 Q44 56 104 56 Q160 56 160 120 Z" fill="url(#g)"/><path d="M140 118 Q186 116 192 132 Q170 138 130 130 Z" fill="${dark}"/><circle cx="104" cy="58" r="5" fill="${dark}"/><path d="M104 60 L104 118" stroke="${dark}" stroke-width="1.5"/>`;
      case 'beanie': return `<path d="M48 140 Q46 58 100 56 Q154 58 152 140 Z" fill="url(#g)"/><rect x="44" y="124" width="112" height="30" rx="8" fill="${dark}"/><circle cx="100" cy="50" r="14" fill="${shade(c, 0.1)}"/>`;
      case 'watch': return `<rect x="82" y="20" width="36" height="160" rx="10" fill="${dark}"/><circle cx="100" cy="100" r="36" fill="#d9d4ca" stroke="#9b958b" stroke-width="5"/><circle cx="100" cy="100" r="28" fill="${c}"/><path d="M100 100 L100 80 M100 100 L114 106" stroke="#f3efe6" stroke-width="3" stroke-linecap="round"/>`;
      case 'bag': return `<path d="M62 82 Q62 30 100 30 Q138 30 138 82" fill="none" stroke="${dark}" stroke-width="8"/><rect x="40" y="76" width="120" height="100" rx="12" fill="url(#g)"/><rect x="40" y="76" width="120" height="30" rx="12" fill="${shade(c, -0.1)}"/><rect x="94" y="100" width="12" height="12" rx="2" fill="#c9a86a"/>`;
      case 'sunglasses': return `<path d="M20 86 L180 86" stroke="${dark}" stroke-width="6"/><rect x="26" y="84" width="62" height="42" rx="18" fill="url(#g)" stroke="${dark}" stroke-width="5"/><rect x="112" y="84" width="62" height="42" rx="18" fill="url(#g)" stroke="${dark}" stroke-width="5"/><path d="M88 94 Q100 86 112 94" stroke="${dark}" stroke-width="5" fill="none"/>`;
      case 'belt': return `<rect x="10" y="88" width="180" height="24" rx="4" fill="url(#g)"/><rect x="120" y="82" width="36" height="36" rx="4" fill="none" stroke="#c9a86a" stroke-width="6"/><line x1="138" y1="88" x2="138" y2="112" stroke="#c9a86a" stroke-width="4"/>`;
      case 'chain': return Array.from({ length: 14 }, (_, i) => {
        const a = (Math.PI * (i + 0.5)) / 14; const x = 100 + Math.cos(a) * 62; const y = 60 + Math.sin(a) * 90;
        return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="9" ry="6" fill="none" stroke="${c}" stroke-width="4"/>`;
      }).join('');
      case 'scarf': return `<path d="M50 40 Q100 70 150 40 L150 64 Q100 94 50 64 Z" fill="url(#g)"/><path d="M118 70 L138 180 L112 182 L100 78 Z" fill="${shade(c, -0.06)}"/><path d="M112 176 l4 12 M120 176 l2 12 M128 176 l2 12 M134 176 l3 12" stroke="${dark}" stroke-width="2"/>`;
      case 'bracelet': case 'ring': return `<circle cx="100" cy="100" r="56" fill="none" stroke="url(#g)" stroke-width="14"/>`;
      default: return `<circle cx="100" cy="100" r="60" fill="url(#g)"/>`;
    }
  },
};

export function garmentSVG(category, hex = '#888888', subtype = '', accent) {
  const acc = accent || (isLight(hex) ? '#1b1b1b' : '#f2efe8');
  const inner = (DRAW[category] || DRAW.accessory)(hex, subtype, acc);
  // Light garments get a soft outline so they don't disappear on light backgrounds.
  const outline = isLight(hex) ? `stroke="${shade(hex, -0.28)}" stroke-width="1.4" stroke-linejoin="round"` : '';
  return wrap(`<g ${outline}>${inner}</g>`, grad('g', hex), BOX[category]);
}
export const garmentDataURL = (...args) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(garmentSVG(...args));

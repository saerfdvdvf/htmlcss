// Domain vocabulary shared by the engine and the UI.

export const CATEGORIES = [
  { id: 'hoodie', label: 'Sudadera', plural: 'Sudaderas', subtypes: ['pullover', 'zip-up', 'crewneck sweatshirt', 'oversized', 'cropped'] },
  { id: 'tshirt', label: 'Camiseta', plural: 'Camisetas', subtypes: ['tee', 'graphic tee', 'long sleeve', 'polo', 'tank top', 'henley'] },
  { id: 'trousers', label: 'Pantalón', plural: 'Pantalones', subtypes: ['jeans', 'chinos', 'cargo', 'joggers', 'tailored', 'wide leg', 'shorts'] },
  { id: 'sneakers', label: 'Zapatillas', plural: 'Zapatillas', subtypes: ['low-top', 'high-top', 'runner', 'chunky', 'minimal leather', 'skate'] },
  { id: 'accessory', label: 'Accesorio', plural: 'Accesorios', subtypes: ['cap', 'beanie', 'watch', 'bag', 'sunglasses', 'belt', 'chain', 'scarf', 'bracelet', 'ring'] },
];
export const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
export const CORE_SLOTS = ['hoodie', 'tshirt', 'trousers', 'sneakers'];

// Etiquetas en español de los subtipos (los ids internos no cambian).
export const SUBTYPE_LABEL = {
  pullover: 'Con capucha', 'zip-up': 'Con cremallera', 'crewneck sweatshirt': 'Cuello redondo', oversized: 'Oversize', cropped: 'Corta',
  tee: 'Básica', 'graphic tee': 'Estampada', 'long sleeve': 'Manga larga', polo: 'Polo', 'tank top': 'De tirantes', henley: 'Henley',
  jeans: 'Vaqueros', chinos: 'Chinos', cargo: 'Cargo', joggers: 'Joggers', tailored: 'De vestir', 'wide leg': 'Pierna ancha', shorts: 'Pantalón corto',
  'low-top': 'Bajas', 'high-top': 'Altas', runner: 'Running', chunky: 'Chunky', 'minimal leather': 'Piel minimalistas', skate: 'Skate',
  cap: 'Gorra', beanie: 'Gorro', watch: 'Reloj', bag: 'Bolso', sunglasses: 'Gafas de sol', belt: 'Cinturón', chain: 'Cadena', scarf: 'Bufanda', bracelet: 'Pulsera', ring: 'Anillo',
};
export const subLabel = (s) => SUBTYPE_LABEL[s] || (s ? s[0].toUpperCase() + s.slice(1) : '');

export const STYLES = [
  { id: 'casual', label: 'Casual', blurb: 'Relajado, cómodo, para el día a día' },
  { id: 'smart-casual', label: 'Smart casual', blurb: 'Arreglado pero cómodo' },
  { id: 'formal', label: 'Formal', blurb: 'Elegante, limpio y cuidado' },
  { id: 'streetwear', label: 'Streetwear', blurb: 'Siluetas atrevidas y prendas con carácter' },
  { id: 'sporty', label: 'Deportivo', blurb: 'Atlético y funcional' },
];
export const STYLE = Object.fromEntries(STYLES.map((s) => [s.id, s]));

// How well style A reads as style B (1 = identical).
export const STYLE_AFFINITY = {
  casual: { casual: 1, 'smart-casual': 0.55, formal: 0.1, streetwear: 0.65, sporty: 0.55 },
  'smart-casual': { casual: 0.55, 'smart-casual': 1, formal: 0.6, streetwear: 0.3, sporty: 0.1 },
  formal: { casual: 0.1, 'smart-casual': 0.6, formal: 1, streetwear: 0.05, sporty: 0 },
  streetwear: { casual: 0.65, 'smart-casual': 0.3, formal: 0.05, streetwear: 1, sporty: 0.55 },
  sporty: { casual: 0.55, 'smart-casual': 0.1, formal: 0, streetwear: 0.55, sporty: 1 },
};
export const STYLE_FORMALITY = { casual: 2, 'smart-casual': 3, formal: 5, streetwear: 2, sporty: 1 };

export const OCCASIONS = [
  { id: 'everyday', label: 'Día a día', phrase: 'el día a día', formality: [1, 3], styles: ['casual', 'streetwear', 'smart-casual'] },
  { id: 'school', label: 'Clase / Uni', phrase: 'ir a clase', formality: [1, 3], styles: ['casual', 'streetwear', 'sporty'] },
  { id: 'work', label: 'Trabajo', phrase: 'el trabajo', formality: [3, 5], styles: ['smart-casual', 'formal'] },
  { id: 'going-out', label: 'Salir', phrase: 'salir', formality: [2, 4], styles: ['streetwear', 'smart-casual', 'casual'] },
  { id: 'party', label: 'Fiesta', phrase: 'una fiesta', formality: [2, 4], styles: ['streetwear', 'smart-casual'] },
  { id: 'date', label: 'Cita', phrase: 'una cita', formality: [3, 4], styles: ['smart-casual', 'casual'] },
  { id: 'event', label: 'Evento', phrase: 'un evento', formality: [4, 5], styles: ['formal', 'smart-casual'] },
  { id: 'sports', label: 'Deporte / Gym', phrase: 'hacer deporte', formality: [1, 1], styles: ['sporty'] },
  { id: 'travel', label: 'Día de viaje', phrase: 'un día de viaje', formality: [1, 3], styles: ['casual', 'sporty', 'streetwear'] },
  { id: 'home', label: 'Casa', phrase: 'estar en casa', formality: [1, 2], styles: ['casual', 'sporty'] },
];
export const OCCASION = Object.fromEntries(OCCASIONS.map((o) => [o.id, o]));

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const SEASON_LABEL = { spring: 'Primavera', summer: 'Verano', autumn: 'Otoño', winter: 'Invierno' };
export const PATTERNS = ['solid', 'striped', 'graphic', 'print', 'check', 'colorblock', 'textured'];
export const PATTERN_LABEL = { solid: 'Liso', striped: 'Rayas', graphic: 'Gráfico', print: 'Estampado', check: 'Cuadros', colorblock: 'Color block', textured: 'Texturizado' };
export const FITS = ['slim', 'regular', 'relaxed', 'oversized', 'wide', 'cropped'];
export const FIT_LABEL = { slim: 'Ajustado', regular: 'Regular', relaxed: 'Holgado', oversized: 'Oversize', wide: 'Ancho', cropped: 'Corto' };
export const STATUSES = [
  { id: 'available', label: 'Disponible' },
  { id: 'laundry', label: 'En la lavadora' },
  { id: 'unavailable', label: 'No disponible' },
];

// Temperature bands, target "warmth points" for a full outfit.
export const WEATHER_BANDS = [
  { id: 'hot', label: 'Calor', range: '24 °C o más', min: 24, target: 3, icon: 'sun' },
  { id: 'warm', label: 'Templado', range: '18–24 °C', min: 18, target: 4.5, icon: 'sun' },
  { id: 'mild', label: 'Suave', range: '12–18 °C', min: 12, target: 6.5, icon: 'cloud' },
  { id: 'cool', label: 'Fresco', range: '5–12 °C', min: 5, target: 8, icon: 'cloud' },
  { id: 'cold', label: 'Frío', range: 'menos de 5 °C', min: -99, target: 9.5, icon: 'snow' },
];
export const BAND_LABEL = { hot: 'calor', warm: 'templado', mild: 'suave', cool: 'fresco', cold: 'frío' };
export const bandForTemp = (t) => WEATHER_BANDS.find((b) => t >= b.min) || WEATHER_BANDS[4];

export function seasonFor(date = new Date(), lat = 40) {
  const m = date.getMonth();
  const north = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'][m];
  if (lat >= 0) return north;
  return { winter: 'summer', summer: 'winter', spring: 'autumn', autumn: 'spring' }[north];
}

// Sensible defaults when an attribute is unknown.
export const DEFAULT_WARMTH = { hoodie: 4, tshirt: 1, trousers: 2, sneakers: 1, accessory: 0 };
export const SUBTYPE_WARMTH = { 'long sleeve': 2, 'tank top': 0, shorts: 0, 'zip-up': 3, beanie: 1, scarf: 2, 'high-top': 1.5 };
export const DEFAULT_FORMALITY = { hoodie: 1.5, tshirt: 2, trousers: 3, sneakers: 2, accessory: 3 };
export const SUBTYPE_FORMALITY = {
  polo: 3, henley: 3, 'graphic tee': 1.5, 'tank top': 1, tailored: 4.5, chinos: 3.5, joggers: 1, cargo: 2, shorts: 1.5,
  'minimal leather': 3.5, runner: 1.5, chunky: 2, watch: 4, belt: 4, cap: 1.5, chain: 2, 'crewneck sweatshirt': 2.5,
  beanie: 1.5, sunglasses: 2.5, bag: 3, scarf: 3, bracelet: 2.5, ring: 3, 'high-top': 1.5, skate: 1.5,
};

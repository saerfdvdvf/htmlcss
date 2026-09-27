// Domain vocabulary shared by the engine and the UI.

export const CATEGORIES = [
  { id: 'hoodie', label: 'Hoodie', plural: 'Hoodies', subtypes: ['pullover', 'zip-up', 'crewneck sweatshirt', 'oversized', 'cropped'] },
  { id: 'tshirt', label: 'T-shirt', plural: 'T-shirts', subtypes: ['tee', 'graphic tee', 'long sleeve', 'polo', 'tank top', 'henley'] },
  { id: 'trousers', label: 'Trousers', plural: 'Trousers', subtypes: ['jeans', 'chinos', 'cargo', 'joggers', 'tailored', 'wide leg', 'shorts'] },
  { id: 'sneakers', label: 'Sneakers', plural: 'Sneakers', subtypes: ['low-top', 'high-top', 'runner', 'chunky', 'minimal leather', 'skate'] },
  { id: 'accessory', label: 'Accessory', plural: 'Accessories', subtypes: ['cap', 'beanie', 'watch', 'bag', 'sunglasses', 'belt', 'chain', 'scarf', 'bracelet', 'ring'] },
];
export const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
export const CORE_SLOTS = ['hoodie', 'tshirt', 'trousers', 'sneakers'];

export const STYLES = [
  { id: 'casual', label: 'Casual', blurb: 'Relaxed, easy, everyday' },
  { id: 'smart-casual', label: 'Smart Casual', blurb: 'Polished but comfortable' },
  { id: 'formal', label: 'Formal', blurb: 'Sharp, clean, elevated' },
  { id: 'streetwear', label: 'Streetwear', blurb: 'Bold fits, statement pieces' },
  { id: 'sporty', label: 'Sporty', blurb: 'Athletic and functional' },
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
  { id: 'everyday', label: 'Everyday', formality: [1, 3], styles: ['casual', 'streetwear', 'smart-casual'] },
  { id: 'school', label: 'School / Uni', formality: [1, 3], styles: ['casual', 'streetwear', 'sporty'] },
  { id: 'work', label: 'Work', formality: [3, 5], styles: ['smart-casual', 'formal'] },
  { id: 'going-out', label: 'Going out', formality: [2, 4], styles: ['streetwear', 'smart-casual', 'casual'] },
  { id: 'party', label: 'Party', formality: [2, 4], styles: ['streetwear', 'smart-casual'] },
  { id: 'date', label: 'Date', formality: [3, 4], styles: ['smart-casual', 'casual'] },
  { id: 'event', label: 'Event', formality: [4, 5], styles: ['formal', 'smart-casual'] },
  { id: 'sports', label: 'Sports / Gym', formality: [1, 1], styles: ['sporty'] },
  { id: 'travel', label: 'Travel day', formality: [1, 3], styles: ['casual', 'sporty', 'streetwear'] },
  { id: 'home', label: 'Lounge / Home', formality: [1, 2], styles: ['casual', 'sporty'] },
];
export const OCCASION = Object.fromEntries(OCCASIONS.map((o) => [o.id, o]));

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const PATTERNS = ['solid', 'striped', 'graphic', 'print', 'check', 'colorblock', 'textured'];
export const FITS = ['slim', 'regular', 'relaxed', 'oversized', 'wide', 'cropped'];
export const STATUSES = [
  { id: 'available', label: 'Available' },
  { id: 'laundry', label: 'In the laundry' },
  { id: 'unavailable', label: 'Unavailable' },
];

// Temperature bands, target "warmth points" for a full outfit.
export const WEATHER_BANDS = [
  { id: 'hot', label: 'Hot', range: '24°C+', min: 24, target: 3, icon: 'sun' },
  { id: 'warm', label: 'Warm', range: '18–24°C', min: 18, target: 4.5, icon: 'sun' },
  { id: 'mild', label: 'Mild', range: '12–18°C', min: 12, target: 6.5, icon: 'cloud' },
  { id: 'cool', label: 'Cool', range: '5–12°C', min: 5, target: 8, icon: 'cloud' },
  { id: 'cold', label: 'Cold', range: 'below 5°C', min: -99, target: 9.5, icon: 'snow' },
];
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

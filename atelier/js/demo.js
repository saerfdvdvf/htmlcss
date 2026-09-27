// Armario de ejemplo para que cualquier usuario nuevo pueda probar todas las funciones al instante.
import { garmentDataURL } from './garments.js';
import { nameColor } from './color.js';
import { guessStyles, guessFit, guessSeasons, itemWarmth, itemFormality } from './engine.js';

const D = [
  // category, subtype, hex, name, brand, extra
  ['hoodie', 'pullover', '#1b1b1d', 'Sudadera negra gruesa', 'Essentials'],
  ['hoodie', 'pullover', '#9a9ea3', 'Sudadera gris jaspeada', 'Champion'],
  ['hoodie', 'zip-up', '#1f2c46', 'Sudadera azul marino con cremallera', 'Nike'],
  ['hoodie', 'oversized', '#e9e0cc', 'Sudadera oversize crema', 'Represent', { accent: '#5f4330' }],
  ['hoodie', 'crewneck sweatshirt', '#5b5f37', 'Sudadera verde oliva cuello redondo', 'Carhartt WIP'],
  ['hoodie', 'pullover', '#6b1f2e', 'Sudadera burdeos', 'Stüssy'],
  ['tshirt', 'tee', '#f7f7f5', 'Camiseta blanca', 'Uniqlo'],
  ['tshirt', 'tee', '#141414', 'Camiseta negra', 'COS'],
  ['tshirt', 'tee', '#8a8d91', 'Camiseta gris jaspeada', 'Uniqlo'],
  ['tshirt', 'graphic tee', '#ece6d8', 'Camiseta gráfica vintage', 'Marca local', { pattern: 'graphic', accent: '#a24c26' }],
  ['tshirt', 'long sleeve', '#1d2a44', 'Camiseta manga larga azul marino', 'Arket'],
  ['tshirt', 'polo', '#23422f', 'Polo de punto verde bosque', 'Massimo Dutti'],
  ['tshirt', 'tee', '#cdb894', 'Camiseta gruesa color arena', 'Carhartt WIP'],
  ['tshirt', 'tee', '#8fc2e8', 'Camiseta azul cielo', 'Zara'],
  ['trousers', 'jeans', '#3f5f86', 'Vaqueros rectos lavado medio', "Levi's"],
  ['trousers', 'jeans', '#151618', 'Vaqueros negros slim', 'Weekday'],
  ['trousers', 'chinos', '#cdb894', 'Chinos beis', 'Dockers'],
  ['trousers', 'cargo', '#5b5f37', 'Pantalón cargo verde oliva', 'Dickies'],
  ['trousers', 'tailored', '#36393d', 'Pantalón de vestir gris marengo', 'COS'],
  ['trousers', 'joggers', '#8a8d91', 'Joggers grises', 'Nike'],
  ['trousers', 'wide leg', '#7d9cc0', 'Vaqueros anchos lavado claro', 'Weekday'],
  ['trousers', 'shorts', '#1d2a44', 'Pantalón corto azul marino', 'Uniqlo'],
  ['sneakers', 'minimal leather', '#f7f7f5', 'Zapatillas blancas de piel', 'Common Projects', { accent: '#f7f7f5' }],
  ['sneakers', 'low-top', '#141414', 'Zapatillas bajas negras', 'Vans', { accent: '#f7f7f5' }],
  ['sneakers', 'runner', '#9a9ea3', 'Zapatillas de running grises', 'New Balance', { accent: '#1d2a44' }],
  ['sneakers', 'chunky', '#ece6d8', 'Zapatillas chunky crema', 'Asics', { accent: '#6b1f2e' }],
  ['sneakers', 'high-top', '#6b1f2e', 'Zapatillas altas burdeos', 'Converse', { accent: '#f7f7f5' }],
  ['accessory', 'cap', '#1d2a44', 'Gorra azul marino', 'New Era'],
  ['accessory', 'watch', '#141414', 'Reloj de esfera negra', 'Casio'],
  ['accessory', 'beanie', '#5b5f37', 'Gorro verde oliva', 'Carhartt WIP'],
  ['accessory', 'bag', '#5f4330', 'Bolso bandolera marrón', 'Arket'],
  ['accessory', 'sunglasses', '#141414', 'Gafas de sol negras', 'Ray-Ban'],
  ['accessory', 'belt', '#3e2a20', 'Cinturón de piel marrón', 'Levi\'s'],
  ['accessory', 'chain', '#c9cbcd', 'Cadena plateada', 'Vitaly'],
];

export function demoItems(now = Date.now()) {
  return D.map(([category, subtype, hex, name, brand, extra = {}], i) => {
    const base = { category, subtype };
    const warmth = itemWarmth(base);
    return {
      id: 'demo-' + i.toString(36),
      name, brand, category, subtype,
      image: garmentDataURL(category, hex, subtype, extra.accent),
      colors: [{ hex, name: nameColor(hex), pct: 100 }],
      styles: guessStyles(category, subtype, extra.pattern || 'solid', hex),
      seasons: guessSeasons(category, subtype, warmth),
      fit: guessFit(category, subtype),
      pattern: extra.pattern || 'solid',
      warmth, formality: itemFormality(base),
      tags: ['demo'], notes: '', favorite: i % 7 === 0,
      status: 'available', demo: true,
      createdAt: now - i * 1000, updatedAt: now - i * 1000,
    };
  });
}

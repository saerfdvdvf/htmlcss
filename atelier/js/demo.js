// A starter wardrobe so new users can explore every feature immediately.
import { garmentDataURL } from './garments.js';
import { nameColor } from './color.js';
import { guessStyles, guessFit, guessSeasons, itemWarmth, itemFormality } from './engine.js';

const D = [
  // category, subtype, hex, name, brand, extra
  ['hoodie', 'pullover', '#1b1b1d', 'Heavyweight black hoodie', 'Essentials'],
  ['hoodie', 'pullover', '#9a9ea3', 'Heather grey hoodie', 'Champion'],
  ['hoodie', 'zip-up', '#1f2c46', 'Navy zip hoodie', 'Nike'],
  ['hoodie', 'oversized', '#e9e0cc', 'Cream oversized hoodie', 'Represent', { accent: '#5f4330' }],
  ['hoodie', 'crewneck sweatshirt', '#5b5f37', 'Olive crewneck', 'Carhartt WIP'],
  ['hoodie', 'pullover', '#6b1f2e', 'Burgundy hoodie', 'Stüssy'],
  ['tshirt', 'tee', '#f7f7f5', 'Crisp white tee', 'Uniqlo'],
  ['tshirt', 'tee', '#141414', 'Black tee', 'COS'],
  ['tshirt', 'tee', '#8a8d91', 'Grey marl tee', 'Uniqlo'],
  ['tshirt', 'graphic tee', '#ece6d8', 'Vintage graphic tee', 'Local brand', { pattern: 'graphic', accent: '#a24c26' }],
  ['tshirt', 'long sleeve', '#1d2a44', 'Navy long sleeve', 'Arket'],
  ['tshirt', 'polo', '#23422f', 'Forest knit polo', 'Massimo Dutti'],
  ['tshirt', 'tee', '#cdb894', 'Sand heavyweight tee', 'Carhartt WIP'],
  ['tshirt', 'tee', '#8fc2e8', 'Sky blue tee', 'Zara'],
  ['trousers', 'jeans', '#3f5f86', 'Mid-wash straight jeans', "Levi's"],
  ['trousers', 'jeans', '#151618', 'Black slim jeans', 'Weekday'],
  ['trousers', 'chinos', '#cdb894', 'Beige chinos', 'Dockers'],
  ['trousers', 'cargo', '#5b5f37', 'Olive cargo trousers', 'Dickies'],
  ['trousers', 'tailored', '#36393d', 'Charcoal tailored trousers', 'COS'],
  ['trousers', 'joggers', '#8a8d91', 'Grey joggers', 'Nike'],
  ['trousers', 'wide leg', '#7d9cc0', 'Light wash wide jeans', 'Weekday'],
  ['trousers', 'shorts', '#1d2a44', 'Navy shorts', 'Uniqlo'],
  ['sneakers', 'minimal leather', '#f7f7f5', 'White leather sneakers', 'Common Projects', { accent: '#f7f7f5' }],
  ['sneakers', 'low-top', '#141414', 'Black low-tops', 'Vans', { accent: '#f7f7f5' }],
  ['sneakers', 'runner', '#9a9ea3', 'Grey runners', 'New Balance', { accent: '#1d2a44' }],
  ['sneakers', 'chunky', '#ece6d8', 'Cream chunky sneakers', 'Asics', { accent: '#6b1f2e' }],
  ['sneakers', 'high-top', '#6b1f2e', 'Burgundy high-tops', 'Converse', { accent: '#f7f7f5' }],
  ['accessory', 'cap', '#1d2a44', 'Navy cap', 'New Era'],
  ['accessory', 'watch', '#141414', 'Black dial watch', 'Casio'],
  ['accessory', 'beanie', '#5b5f37', 'Olive beanie', 'Carhartt WIP'],
  ['accessory', 'bag', '#5f4330', 'Brown crossbody bag', 'Arket'],
  ['accessory', 'sunglasses', '#141414', 'Black sunglasses', 'Ray-Ban'],
  ['accessory', 'belt', '#3e2a20', 'Brown leather belt', 'Levi\'s'],
  ['accessory', 'chain', '#c9cbcd', 'Silver chain', 'Vitaly'],
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

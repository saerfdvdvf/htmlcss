import assert from 'node:assert/strict';
import { demoItems } from '../js/demo.js';
import { generateOutfit, generateSeries, scoreOutfit, feat, alternativesFor, weatherFromTemp } from '../js/engine.js';
import { rng } from '../js/util.js';

const items = demoItems(1);
const byId = new Map(items.map(i => [i.id, i]));
const show = (res) => ['hoodie','tshirt','trousers','sneakers'].map(k => res.items[k] && byId.get(res.items[k]).name).filter(Boolean).concat(res.items.accessory.map(a => byId.get(a).name)).join(' + ');

let t = performance.now();
for (const style of ['casual','smart-casual','formal','streetwear','sporty','any']) {
  for (const temp of [28, 15, 2]) {
    const ctx = { style, occasion: style==='formal'?'work':style==='sporty'?'sports':'everyday', weather: weatherFromTemp(temp, {season: 'autumn'}) };
    const res = generateOutfit(items, ctx, { random: rng(style+temp) });
    assert.ok(res.items, 'generated');
    assert.ok(res.items.trousers && res.items.sneakers);
    console.log(style.padEnd(13), String(temp).padStart(2)+'°', res.score.total, res.score.verdict.padEnd(9), show(res));
    if (temp === 15 && style === 'casual') console.log('   ', res.score.breakdown, res.score.reasons, res.score.tips);
  }
}
console.log('ms per gen', ((performance.now()-t)/18).toFixed(1));

// lock + regenerate keeps locked item and changes outfit
const ctx = { style: 'casual', weather: weatherFromTemp(15) };
const first = generateOutfit(items, ctx, { mustInclude: 'demo-5', random: rng('a') });
assert.equal(first.items.hoodie, 'demo-5');
const second = generateOutfit(items, ctx, { mustInclude: 'demo-5', avoidSignatures: new Set([first.signature]), random: rng('b') });
assert.equal(second.items.hoodie, 'demo-5');
assert.notEqual(second.signature, first.signature);

// laundry exclusion
const washed = items.map(i => i.category === 'sneakers' && i.id !== 'demo-n' ? { ...i, status: 'laundry' } : i);
const avail = washed.filter(i => i.category==='sneakers' && i.status==='available').map(i=>i.id);
for (let k=0;k<10;k++){ const r = generateOutfit(washed, ctx); assert.ok(!r.items.sneakers || avail.includes(r.items.sneakers)); }

// week no-repeat
const days = Array.from({length:7},(_,i)=>({key:i, style:'casual'}));
const week = generateSeries(items, days, { weather: weatherFromTemp(15) }, { noRepeat: true });
console.log('week tops unique:', new Set(week.map(d=>d.items.tshirt)).size, new Set(week.map(d=>d.items.hoodie)).size, 'trousers', new Set(week.map(d=>d.items.trousers)).size);
assert.equal(new Set(week.map(d=>d.signature)).size, 7);
console.log(alternativesFor('sneakers', first.items, items, ctx, 3).map(a=>a.item.name+' '+a.total));
console.log('OK');
// distribution of random combos
{
  const f = items.map(feat); const g = c => f.filter(x=>x.cat===c);
  const scores=[]; const r = rng('dist');
  for (let i=0;i<2000;i++){ const pick=a=>a[Math.floor(r()*a.length)]; scores.push(scoreOutfit({tshirt:pick(g('tshirt')),hoodie:r()<.5?pick(g('hoodie')):null,trousers:pick(g('trousers')),sneakers:pick(g('sneakers')),accessory:[]},{style:'smart-casual',occasion:'work',weather:weatherFromTemp(20)}).total); }
  scores.sort((a,b)=>a-b); console.log('random combo score p10/p50/p90', scores[200], scores[1000], scores[1800]);
}

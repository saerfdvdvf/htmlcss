// Optional photorealistic "Preview on me" backend (Cloudflare Worker).
// Receives { person, garments: [{ category, name, image }] } (data URLs) from Atelier,
// runs IDM-VTON on Replicate for the top and then the trousers, and returns { image } as a data URL.
//
// Deploy:
//   npm create cloudflare@latest atelier-tryon   (choose "Hello World" worker, paste this file)
//   npx wrangler secret put REPLICATE_API_TOKEN
//   npx wrangler secret put IDM_VTON_VERSION      (version id from https://replicate.com/cuuupid/idm-vton/versions)
//   npx wrangler secret put ACCESS_KEY            (optional; also enter it in Atelier → Settings → Preview)
//   npx wrangler deploy
// Then paste https://<worker>.workers.dev in Atelier → Settings → Preview on me → Endpoint URL.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

async function runVton(env, human, garment, description, category) {
  const r = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.REPLICATE_API_TOKEN}`, 'Content-Type': 'application/json', Prefer: 'wait=60' },
    body: JSON.stringify({
      version: env.IDM_VTON_VERSION,
      input: { human_img: human, garm_img: garment, garment_des: description, category, crop: false, steps: 30, seed: 42 },
    }),
  });
  let pred = await r.json();
  // Poll if the synchronous wait was not enough.
  for (let i = 0; i < 40 && !['succeeded', 'failed', 'canceled'].includes(pred.status); i++) {
    await new Promise((res) => setTimeout(res, 3000));
    pred = await (await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${env.REPLICATE_API_TOKEN}` } })).json();
  }
  if (pred.status !== 'succeeded') throw new Error(pred.error || `Prediction ${pred.status}`);
  const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  const img = await fetch(url);
  const buf = new Uint8Array(await img.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return `data:${img.headers.get('content-type') || 'image/png'};base64,${btoa(bin)}`;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
    if (env.ACCESS_KEY && request.headers.get('Authorization') !== `Bearer ${env.ACCESS_KEY}`) return json({ error: 'Unauthorized' }, 401);
    try {
      const { person, garments = [] } = await request.json();
      if (!person || !garments.length) return json({ error: 'person and garments are required' }, 400);
      const top = garments.find((g) => g.category === 'hoodie') || garments.find((g) => g.category === 'tshirt');
      const bottom = garments.find((g) => g.category === 'trousers');
      let image = person;
      if (top) image = await runVton(env, image, top.image, top.name || 'top', 'upper_body');
      if (bottom) image = await runVton(env, image, bottom.image, bottom.name || 'trousers', 'lower_body');
      return json({ image });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  },
};

# Atelier: your personal AI stylist

Atelier is a fashion app that runs as a **website (installable PWA)** and as an **Android APK** from one codebase. Upload your clothes, and Atelier builds complete, colour-matched outfits for today, the whole week or a trip. Every outfit comes with a score and an explanation of why it works.

## Features

| Area | What it does |
| --- | --- |
| **My Wardrobe** | Hoodies, T-shirts, trousers, sneakers and accessories. You can add, edit, delete, search, filter (colour, style, season, availability, favourites), sort, favourite, bulk-edit and drag-and-drop photos. |
| **Auto-analysis** | Each photo is processed on the device. It removes plain backgrounds, finds the dominant colours with k-means in Lab space and names them, detects the pattern, and guesses the category from the silhouette. When a network is available it also uses MobileNet. From these it suggests the style, season, fit, warmth and formality. |
| **Create Outfit** | A four-step flow: *What do you want to do?* (create, weekly, surprise me, use a specific item, preview on me) → **style** → optional **filters** (occasion, weather or season, colours to include or avoid, accessories, layering, least-worn, favourites) → **result**. |
| **Lock & regenerate** | In the result you can lock any piece, swap a single piece from a ranked list, add or remove a layer, and **Regenerate** only the unlocked parts. A piece you chose to build around stays in every result. |
| **Outfit score** | A 0–100 score made of five parts: colour harmony, style match, occasion fit, proportions, and weather & season. You also get a plain-language explanation of what works and tips for what to change. |
| **Colour matching** | Uses colour theory in CIE Lab: neutrals, tonal, analogous, complementary and triadic schemes, a "rule of three" hue limit, light/dark contrast, near-miss detection (for example black next to navy), and your favourite and avoided colours. |
| **Favourites & history** | Every generated outfit is kept in the history (up to 400). You can favourite or unfavourite outfits and filter by style or occasion. |
| **Outfit of the Day** | Generated automatically each day from your wardrobe, the weather, your default style and the weekday or weekend occasion. It rotates away from pieces worn in recent days. |
| **Weekly Planner** | Per day: style, occasion, **Random**, **Must include** an item, lock pieces and regenerate that day. There is also *Generate whole week* and a **No repetition** mode. |
| **Calendar** | A month view with thumbnails. You can assign a favourite, a history outfit or a new one to any day, change or remove it, and mark it as worn. |
| **Laundry** | Mark items as Available, In the laundry or Unavailable. Unavailable and laundry items are **excluded from all generation**. There is a one-tap "laundry done", and after *Wear today* you can send the worn pieces straight to the laundry. |
| **Statistics** | Most- and least-used pieces, colours owned and worn, categories, outfits created, favourites, most frequent combinations, style mix, how much of the wardrobe was worn in the last 30 days, and written insights. |
| **Travel** | Enter a destination (weather comes from the forecast, or from the same dates last year if the trip is further out, or you set it yourself), the number of days, trip type and occasions, and pieces you want or don't want to take. Atelier picks a **minimal capsule**, plans every day, and builds an **automatic packing list** with essentials. |
| **Shopping** | A wardrobe-balance check plus gap analysis. It simulates thousands of combinations to find the pieces that would **unlock the most new high-scoring outfits** or give hard-to-match pieces a partner. It skips anything too similar to what you already own. |
| **Preview on me** | Can be turned on or off. It overlays the outfit's cut-outs on your **unmodified** photo, can place them automatically using pose detection, and lets you drag, resize and rotate each piece. You can compare with the original and export the image. For a photorealistic render, connect the optional AI try-on service described below. |
| **Sync** | Optional Firebase account (email and password). The APK and the website sign in to the same account and sync wardrobe, outfits, plans, trips and settings in real time. The app stores everything on the device first, so it keeps working offline. |

## Project layout

```
atelier/              ← the web app (also the APK's content)
  index.html          app shell
  css/app.css         design system (light + dark)
  js/engine.js        outfit scoring + generation (pure, unit-tested)
  js/color.js         colour science & harmony
  js/planning.js      travel capsule, shopping gaps, statistics
  js/analyzer.js      photo analysis (background removal, colours, category)
  js/store.js, db.js  local-first IndexedDB store
  js/sync.js          Firebase Auth + Firestore sync
  js/views/*          one module per screen
  sw.js, manifest     offline support + install
  firestore.rules     security rules for sync
  server/tryon-worker.js   optional AI try-on backend (Cloudflare Worker)
  tests/              Node tests for the engine & planners
mobile/               Capacitor project that packages atelier/ as an APK
.github/workflows/android-apk.yml   builds the APK on every push
```

There is no build step: the site is plain ES modules.

## Run the website locally

```bash
cd atelier
python3 -m http.server 8080      # or: npx serve .
# open http://localhost:8080
```

On first launch you can load a **sample wardrobe** of 34 illustrated pieces to try every feature, or start with your own clothes.

Tests:

```bash
node atelier/tests/engine.test.mjs
node atelier/tests/planning.test.mjs
```

## Deploy the website

Upload the `atelier/` folder to any static host, such as GitHub Pages, Netlify, Vercel or Cloudflare Pages. If this repository is published with GitHub Pages, the app is served at `/atelier/`. HTTPS is required for installing the app, the camera and location.

## Build the Android APK

**Automatically.** Every push that touches `atelier/` or `mobile/` runs **Build Android APK** in GitHub Actions. Download `Atelier.apk` from the run's artifacts. Pushing a tag such as `v1.0.0` also attaches the APK to a GitHub Release.

**Locally** (needs Node 20+, JDK 21 and the Android SDK):

```bash
cd mobile
npm install
npm run android:init     # first time: generates android/ and adds camera/location permissions
npx @capacitor/assets generate --android --iconBackgroundColor '#161513' --splashBackgroundColor '#f6f3ee'
npm run apk              # → android/app/build/outputs/apk/debug/app-debug.apk
```

The workflow builds a debug APK, which is signed with a debug key and can be installed directly. To publish on Google Play, create a keystore and run `npm run apk:release` with signing configured in `android/app/build.gradle`.

## Same account on the app and the website (sync)

1. Create a project at <https://console.firebase.google.com> and add a **Web app**.
2. Turn on **Authentication → Sign-in method → Email/Password**.
3. Create a **Firestore Database** and publish the rules from `atelier/firestore.rules`.
4. Either paste the `firebaseConfig` snippet in **Settings → Account & sync**, or put it in `atelier/js/config.js` before deploying or building the APK. Putting it in `config.js` means users only need to sign in.
5. Sign in with the same email on the phone and on the computer.

Photos are compressed and resized (typically well under 200 KB each) and stored inside Firestore documents. This means Cloud Storage and a paid plan are not needed. The "Preview on me" photo never leaves the device.

## Photorealistic "Preview on me" (optional)

Out of the box, Preview overlays your clothing cut-outs on your photo without changing the photo. For a photorealistic re-render, deploy `atelier/server/tryon-worker.js` as a Cloudflare Worker. It calls **IDM-VTON** on Replicate and needs your Replicate token. Instructions are at the top of that file. Then enter the worker URL under **Settings → Preview on me**.

## Privacy

- Wardrobe data stays on the device unless you turn on sync. With sync on, it is stored only in your own Firebase project.
- Photo analysis runs in the browser. If smart recognition is enabled, the MobileNet model is downloaded once from jsDelivr. Your images are never uploaded for analysis.
- Weather comes from Open-Meteo using only the city or coordinates you choose.

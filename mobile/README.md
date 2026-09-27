# Atelier for Android

This folder packages the web app in `../atelier` as a native Android app with [Capacitor](https://capacitorjs.com). The app and the website share one codebase, and one account when sync is configured.

- CI: `.github/workflows/android-apk.yml` builds `Atelier.apk` on every push. Download it from the workflow run's artifacts.
- Local build: see "Build the Android APK" in `../atelier/README.md`.

`android/` and `www/` are generated and git-ignored. `scripts/build-web.mjs` copies the web app into `www/`. `scripts/patch-android.mjs` adds the camera and location permissions.

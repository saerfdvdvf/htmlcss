# Atelier para Android

Esta carpeta empaqueta la app web de `../atelier` como app nativa de Android con [Capacitor](https://capacitorjs.com). La app y la web comparten el mismo código. No hay cuentas: los datos se guardan en el propio teléfono.

- CI: `.github/workflows/android-apk.yml` compila `Atelier.apk` en cada push. Descárgala desde los artefactos de la ejecución del workflow.
- Compilación local: consulta «Compilar la APK de Android» en `../atelier/README.md`.

`android/` y `www/` se generan automáticamente y están en `.gitignore`. `scripts/build-web.mjs` copia la app web en `www/`. `scripts/patch-android.mjs` añade los permisos de cámara y ubicación.

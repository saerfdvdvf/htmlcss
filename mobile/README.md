# Atelier para Android

App nativa ligera que abre la app web de `../atelier` dentro de una WebView. No usa Gradle ni Android Studio, y no tiene cuentas: todo se guarda en el propio teléfono.

- **Descargar:** `Atelier.apk` (en esta carpeta). En el móvil, ábrela y permite «instalar apps de origen desconocido» cuando Android lo pida. Requiere Android 7.0 o superior.
- **Compilar:** `./build-apk.sh` (necesita en Ubuntu/Debian `sudo apt-get install aapt apksigner dalvik-exchange android-sdk-platform-23 zipalign`, más JDK 17+ y Node 18+). GitHub Actions la compila también en cada push (`.github/workflows/android-apk.yml`).

## Cómo funciona

- `src/.../MainActivity.java` sirve la app desde `assets/www/index.html` (la versión de un solo archivo, `Atelier.html`) en el origen `https://appassets.androidplatform.net`, así que el almacenamiento (IndexedDB) funciona igual que en un navegador.
- Subir fotos abre la galería o la cámara (las fotos de la cámara se guardan en Imágenes/Atelier).
- Las copias de seguridad se guardan en Descargas/Atelier y las imágenes de «Pruébatelo» en Imágenes/Atelier.
- El botón «atrás» cierra la ventana abierta o vuelve a la pantalla anterior; en Inicio, sale de la app.
- La ubicación (para el tiempo) se pide solo si la usas en Ajustes.

## Firma

La APK se firma con `keystore/atelier.jks` (contraseña `atelier-app`). Está en el repositorio para que cada versión nueva se instale encima de la anterior sin perder datos. Si vas a publicarla en Google Play, crea tu propia clave y pásala con las variables `KEYSTORE` y `KS_PASS`.

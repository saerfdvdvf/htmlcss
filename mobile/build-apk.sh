#!/usr/bin/env bash
# Compila Unreal-Outfits.apk sin Gradle ni Android Studio.
# Requisitos (Ubuntu/Debian): sudo apt-get install aapt apksigner dalvik-exchange android-sdk-platform-23 zipalign
#                             + JDK 17 o superior y Node 18 o superior.
set -euo pipefail
cd "$(dirname "$0")"

ANDROID_JAR="${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}"
BUILD_TOOLS="${BUILD_TOOLS:-/usr/lib/android-sdk/build-tools/debian}"
VERSION_NAME="${VERSION_NAME:-1.1}"
VERSION_CODE="${VERSION_CODE:-$(( $(date -u +%s) / 60 ))}"  # minutos desde 1970: siempre crece
KEYSTORE="${KEYSTORE:-keystore/atelier.jks}"
KS_PASS="${KS_PASS:-atelier-app}"
OUT=build

for tool in aapt2 javac zipalign apksigner node; do
  command -v "$tool" >/dev/null || { echo "Falta la herramienta: $tool"; exit 1; }
done
[ -f "$ANDROID_JAR" ] || { echo "No se encuentra android.jar en $ANDROID_JAR"; exit 1; }
DX="$BUILD_TOOLS/dx"; [ -x "$DX" ] || DX="$(command -v dalvik-exchange)"

rm -rf "$OUT"
mkdir -p "$OUT/assets/www" "$OUT/gen" "$OUT/classes" "$OUT/dex"

echo "1/6  App web en un solo archivo"
( cd ../atelier && { [ -d node_modules ] || npm ci --no-audit --no-fund --silent; } && npm run --silent standalone )
cp ../atelier/Unreal-Outfits.html "$OUT/assets/www/index.html"

echo "2/6  Recursos"
aapt2 compile --dir res -o "$OUT/res.zip"
aapt2 link -I "$ANDROID_JAR" --manifest AndroidManifest.xml \
  --min-sdk-version 24 --target-sdk-version 29 \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  -A "$OUT/assets" --java "$OUT/gen" -o "$OUT/unsigned.apk" "$OUT/res.zip"

echo "3/6  Java"
javac -source 8 -target 8 -bootclasspath "$ANDROID_JAR" -encoding UTF-8 -Xlint:-options -nowarn \
  -d "$OUT/classes" $(find src "$OUT/gen" -name '*.java')

echo "4/6  Dex"
"$DX" --dex --min-sdk-version=24 --output="$OUT/dex/classes.dex" "$OUT/classes"

echo "5/6  Empaquetado"
cp "$OUT/unsigned.apk" "$OUT/app.apk"
( cd "$OUT/dex" && zip -q -j ../app.apk classes.dex )
zipalign -f -p 4 "$OUT/app.apk" "$OUT/aligned.apk"

echo "6/6  Firma"
apksigner sign --ks "$KEYSTORE" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
  --out Unreal-Outfits.apk "$OUT/aligned.apk"
apksigner verify Unreal-Outfits.apk
rm -f Unreal-Outfits.apk.idsig
echo "Listo: $(pwd)/Unreal-Outfits.apk ($(du -h Unreal-Outfits.apk | cut -f1), versión $VERSION_NAME / $VERSION_CODE)"

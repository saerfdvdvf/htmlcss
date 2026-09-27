# Atelier: tu estilista personal con IA

Atelier es una app de moda que funciona como **web (PWA instalable)** y como **APK de Android** a partir del mismo código. Sube tu ropa y Atelier crea outfits completos y con los colores bien combinados para hoy, para toda la semana o para un viaje. Cada outfit incluye una puntuación y una explicación de por qué funciona.

## Funciones

| Área | Qué hace |
| --- | --- |
| **Mi armario** | Sudaderas, camisetas, pantalones, zapatillas y accesorios. Puedes añadir, editar, eliminar, buscar, filtrar (color, estilo, temporada, disponibilidad, favoritas), ordenar, marcar como favorita, editar en bloque y arrastrar fotos. |
| **Análisis automático** | Cada foto se procesa en el propio dispositivo: quita fondos lisos, detecta y nombra los colores dominantes (k-means en espacio Lab), reconoce el estampado y deduce la categoría por la silueta. Si hay conexión, también usa MobileNet. A partir de todo esto sugiere estilo, temporada, corte, abrigo y formalidad. |
| **Crear outfit** | Flujo en cuatro pasos: *¿Qué quieres hacer?* (crear, semana, sorpréndeme, usar una prenda concreta, probártelo) → **estilo** → **filtros** opcionales (ocasión, tiempo o temporada, colores a incluir o evitar, accesorios, capas, menos usadas, favoritas) → **resultado**. |
| **Bloquear y regenerar** | En el resultado puedes bloquear cualquier prenda, cambiar una sola prenda desde una lista ordenada, añadir o quitar una capa y pulsar **Regenerar** para cambiar solo lo que no está bloqueado. La prenda elegida como base se mantiene en todos los resultados. |
| **Puntuación del outfit** | Nota de 0 a 100 formada por cinco factores: armonía de color, estilo, ocasión, proporciones, y clima y temporada. Incluye una explicación en lenguaje natural de lo que funciona y consejos de qué cambiar. |
| **Combinación de colores** | Teoría del color en CIE Lab: neutros, tonos de la misma gama, análogos, complementarios y triádicos; la «regla de tres» colores; contraste claro/oscuro; detección de casi-coincidencias (por ejemplo, negro junto a azul marino); y tus colores favoritos y los que evitas. |
| **Favoritos e historial** | Todos los outfits generados se guardan en el historial (hasta 400). Puedes marcarlos o desmarcarlos como favoritos y filtrar por estilo u ocasión. |
| **Outfit del día** | Se genera automáticamente cada día a partir de tu armario, el tiempo, tu estilo por defecto y la ocasión (entre semana o fin de semana). Evita las prendas que te has puesto en los últimos días. |
| **Planificador semanal** | Para cada día: estilo, ocasión, **Al azar**, **Incluir sí o sí** una prenda, bloquear prendas y regenerar ese día. También hay *Generar toda la semana* y un modo **Sin repetir**. |
| **Calendario** | Vista mensual con miniaturas. Puedes asignar a cualquier día un favorito, un outfit del historial o uno nuevo, cambiarlo o quitarlo, y marcarlo como puesto. |
| **Lavandería** | Marca prendas como Disponible, Lavando o No disponible. Las que se están lavando o no están disponibles **se excluyen de toda la generación**. Hay un botón de «colada terminada» y, tras *Me lo pongo hoy*, puedes mandar a lavar las prendas usadas con un toque. |
| **Estadísticas** | Prendas más y menos usadas, colores que tienes y que más usas, categorías, outfits creados, favoritos, combinaciones más frecuentes, mezcla de estilos, qué parte del armario has usado en los últimos 30 días y consejos escritos. |
| **Viajes** | Indica el destino (el tiempo sale de la previsión, de las mismas fechas del año pasado si el viaje es más adelante, o lo pones tú), los días, el tipo de viaje y las ocasiones, y las prendas que quieres llevar o dejar en casa. Atelier elige una **selección mínima de prendas**, planifica cada día y crea una **lista de maleta automática** con los imprescindibles. |
| **Compras** | Revisa el equilibrio del armario y busca huecos. Simula miles de combinaciones para encontrar las prendas que **desbloquearían más outfits nuevos con buena puntuación** o que darían pareja a prendas difíciles de combinar. Descarta todo lo que se parezca demasiado a lo que ya tienes. |
| **Pruébatelo** | Se puede activar o desactivar. Superpone los recortes de las prendas del outfit sobre tu foto **sin modificarla**, puede colocarlos automáticamente detectando tu postura y te deja arrastrar, redimensionar y girar cada prenda. Puedes comparar con la foto original y exportar la imagen. Para un resultado fotorrealista, conecta el servicio opcional de prueba virtual con IA descrito más abajo. |
| **Sincronización** | Cuenta opcional de Firebase (correo y contraseña). La APK y la web inician sesión en la misma cuenta y sincronizan armario, outfits, planes, viajes y ajustes en tiempo real. La app guarda primero todo en el dispositivo, así que sigue funcionando sin conexión. |

## Estructura del proyecto

```
atelier/              ← la app web (también el contenido de la APK)
  index.html          estructura de la app
  css/app.css         sistema de diseño (modo claro y oscuro)
  js/engine.js        puntuación y generación de outfits (puro, con tests)
  js/color.js         ciencia del color y armonías
  js/planning.js      selección de viaje, huecos para compras, estadísticas
  js/analyzer.js      análisis de fotos (quitar fondo, colores, categoría)
  js/store.js, db.js  almacenamiento local en IndexedDB
  js/sync.js          sincronización con Firebase Auth + Firestore
  js/views/*          un módulo por pantalla
  sw.js, manifest     funcionamiento sin conexión e instalación
  firestore.rules     reglas de seguridad para la sincronización
  server/tryon-worker.js   backend opcional de prueba virtual con IA (Cloudflare Worker)
  tests/              tests en Node del motor y los planificadores
mobile/               proyecto de Capacitor que empaqueta atelier/ como APK
.github/workflows/android-apk.yml   compila la APK en cada push
```

No hay paso de compilación: la web son módulos ES normales.

## Ejecutar la web en local

```bash
cd atelier
python3 -m http.server 8080      # o: npx serve .
# abre http://localhost:8080
```

La primera vez puedes cargar un **armario de ejemplo** con 34 prendas ilustradas para probar todas las funciones, o empezar con tu propia ropa.

Tests:

```bash
node atelier/tests/engine.test.mjs
node atelier/tests/planning.test.mjs
```

## Publicar la web

Sube la carpeta `atelier/` a cualquier hosting estático, como GitHub Pages, Netlify, Vercel o Cloudflare Pages. Si este repositorio se publica con GitHub Pages, la app estará en `/atelier/`. Se necesita HTTPS para instalar la app y usar la cámara y la ubicación.

## Compilar la APK de Android

**Automáticamente.** Cada push que toque `atelier/` o `mobile/` lanza **Build Android APK** en GitHub Actions. Descarga `Atelier.apk` desde los artefactos de la ejecución. Si subes una etiqueta como `v1.0.0`, la APK también se adjunta a una GitHub Release.

**En local** (necesitas Node 20 o superior, JDK 21 y el SDK de Android):

```bash
cd mobile
npm install
npm run android:init     # la primera vez: genera android/ y añade permisos de cámara y ubicación
npx @capacitor/assets generate --android --iconBackgroundColor '#161513' --splashBackgroundColor '#f6f3ee'
npm run apk              # → android/app/build/outputs/apk/debug/app-debug.apk
```

El workflow compila una APK de depuración, firmada con una clave de depuración, que se puede instalar directamente. Para publicarla en Google Play, crea un keystore y ejecuta `npm run apk:release` con la firma configurada en `android/app/build.gradle`.

## La misma cuenta en la app y en la web (sincronización)

1. Crea un proyecto en <https://console.firebase.google.com> y añade una **app web**.
2. Activa **Authentication → Método de inicio de sesión → Correo electrónico/contraseña**.
3. Crea una **base de datos de Firestore** y publica las reglas de `atelier/firestore.rules`.
4. Pega el fragmento `firebaseConfig` en **Ajustes → Cuenta y sincronización**, o ponlo en `atelier/js/config.js` antes de publicar la web o compilar la APK. Si lo pones en `config.js`, los usuarios solo tienen que iniciar sesión.
5. Inicia sesión con el mismo correo en el móvil y en el ordenador.

Las fotos se comprimen y redimensionan (normalmente bastante menos de 200 KB cada una) y se guardan dentro de los documentos de Firestore. Así no hacen falta Cloud Storage ni un plan de pago. La foto de «Pruébatelo» nunca sale del dispositivo.

## «Pruébatelo» fotorrealista (opcional)

De serie, Pruébatelo superpone los recortes de tu ropa sobre tu foto sin modificarla. Para un resultado fotorrealista, despliega `atelier/server/tryon-worker.js` como Cloudflare Worker. Llama a **IDM-VTON** en Replicate y necesita tu token de Replicate; las instrucciones están al principio de ese archivo. Después, escribe la URL del worker en **Ajustes → Pruébatelo**.

## Privacidad

- Los datos del armario se quedan en el dispositivo salvo que actives la sincronización. Con la sincronización activada, solo se guardan en tu propio proyecto de Firebase.
- El análisis de fotos se hace en el navegador. Si el reconocimiento inteligente está activado, el modelo MobileNet se descarga una vez desde jsDelivr. Tus imágenes nunca se suben para analizarlas.
- El tiempo viene de Open-Meteo usando solo la ciudad o las coordenadas que elijas.

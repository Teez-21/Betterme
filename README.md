# BetterME

PWA offline-first para hábitos, calendario y finanzas personales. Sin backend, sin cuentas en la nube: todo se guarda en el dispositivo mediante IndexedDB.

## Stack
- HTML/CSS/JS vanilla (sin frameworks ni build step)
- IndexedDB para almacenamiento local
- Service Worker para funcionamiento 100% offline
- Web App Manifest + íconos para instalación en iOS/Android

## Estructura
```
index.html          → shell principal (splash, PIN, tabs, sheet modal)
manifest.json        → configuración PWA
sw.js                → service worker (cache-first)
css/style.css        → sistema de diseño completo
js/db.js             → capa de datos IndexedDB
js/utils.js          → helpers (fechas, formato, toasts, sheets)
js/pin.js            → autenticación por PIN (hash SHA-256)
js/habits.js         → módulo de Hábitos
js/calendar.js       → módulo de Calendario y Proyectos
js/finance.js        → módulo de Finanzas
js/charts.js         → gráficos canvas nativos (circular, barras, líneas)
js/dashboard.js      → Dashboard y estadísticas + export PDF
js/settings.js       → Configuración, backup/restore
js/app.js            → router y arranque de la app
icons/, fonts/       → assets (logo BetterME, tipografía Cocogoose Pro)
```

## Correr en local
No requiere instalación. Sirve la carpeta con cualquier servidor estático:
```bash
npx serve .
# o
python3 -m http.server 8000
```
Abre `http://localhost:8000`. La primera vez te pedirá crear un PIN de 6 dígitos.

> Nota: IndexedDB y Service Workers requieren `http://localhost` o `https://` — no funcionan abriendo el `index.html` directamente con `file://`.

## Deploy en Vercel
1. Sube esta carpeta a un repositorio de GitHub.
2. En Vercel: **New Project → Import** el repositorio.
3. Framework Preset: **Other** (no requiere build command ni output directory: es estático).
4. Deploy.

`vercel.json` ya incluye los headers necesarios para que el Service Worker y el manifest se sirvan correctamente.

## Instalar como app
- **iOS (Safari):** Compartir → Agregar a pantalla de inicio. Usará el ícono de BetterME.
- **Android/Chrome:** aparecerá el banner "Instalar app", o desde el menú → Instalar app.

## Datos y respaldo
Toda la información vive en este dispositivo. Desde **Ajustes** puedes exportar un respaldo en JSON o importarlo en otro dispositivo/navegador.

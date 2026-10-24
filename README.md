# Calle Viva – PWA de reportes ciudadanos

Aplicación web progresiva para reportar baches, fallas de alumbrado, fugas y basura con **foto** y **ubicación GPS**. Los reportes se guardan en el dispositivo y se consultan **sin conexión**.

**URL publicada:** _(pega aquí tu URL HTTPS, p. ej. https://calle-viva.netlify.app)_

## Caso de uso
Una persona detecta un problema en la calle, lo documenta en segundos aunque no tenga datos móviles y conserva el historial en su teléfono.

## Credenciales de prueba
La app no requiere inicio de sesión: abre la URL, instala la app y crea un reporte.

## Arquitectura
| Componente | Archivo | Descripción |
|---|---|---|
| Manifest | `manifest.json` | Nombre, colores, `display: standalone`, iconos 192/512 y maskable (habilita instalación y splash screen) |
| App Shell | `index.html`, `css/styles.css` | Cabecera, navegación y contenedor fijos; responsive (móvil → escritorio) |
| Vistas CSR | `js/app.js` | Router por hash que renderiza "Nuevo reporte" y "Mis reportes" en el cliente |
| Service Worker | `sw.js` | `install` (precache), `activate` (limpia cachés viejas), `fetch` (estrategias) |
| Persistencia | `js/db.js` | IndexedDB asíncrona: `addReporte`, `getReportes`, `deleteReporte` (incluye fotos como Blob) |

### Estrategias de caché
- **Shell y estáticos propios:** cache-first (precargados en `install`).
- **Navegación:** network-first con respaldo a `index.html` offline.
- **API externa (Nominatim):** network-first con caché dinámica.

### Web APIs nativas
1. **Cámara** (`getUserMedia`, con respaldo a `<input capture>`)
2. **Geolocalización** (`navigator.geolocation`)
3. **Notificaciones** (`Notification` + `registration.showNotification`)

Los permisos se solicitan al usar cada función y se manejan los casos de denegación.

## Ejecutar en local
```bash
python3 -m http.server 8080   # o: npx serve .
# abrir http://localhost:8080
```
(`localhost` cuenta como origen seguro para cámara, GPS y Service Worker.)

## Despliegue
Netlify/Vercel/Cloudflare Pages/GitHub Pages: conecta el repositorio, sin comando de build y directorio de publicación `/` (raíz).

## Capturas
Agrega en `docs/`: instalación, vista offline, DevTools → Application (Manifest, Service Worker, IndexedDB).

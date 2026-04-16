# Formulario de Degustación — Cloudflare Pages

Frontend estático del formulario de degustación de Tinto Banquetería.
Conecta con Google Apps Script vía fetch() API.

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `index.html` | HTML + CSS del formulario |
| `app.js` | Lógica JS (fetch a API, validaciones, modals) |
| `config.js` | URL del Apps Script deployment |

## Setup

1. **Apps Script**: Agregar `API.gs` al proyecto y hacer un nuevo deployment web app
2. **config.js**: Actualizar `window.API_URL` con la URL del deployment
3. **Cloudflare Pages**: Conectar este repo → se despliega automáticamente
4. **DNS**: Agregar CNAME `degustacion.tintobanqueteria.cl` → `<proyecto>.pages.dev`

## Patrón API

- GET: `fetch(API_URL + '?action=obtenerDatosMenu')`
- POST: `fetch(API_URL, { method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify({action, data}) })`
- Respuesta: `{ ok: true, data: ... }` o `{ ok: false, error: "..." }`

Content-Type `text/plain` evita CORS preflight (simple request).

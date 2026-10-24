import { addReporte, getReportes, deleteReporte } from './db.js';

const $ = (s) => document.querySelector(s);
const view = $('#view');
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); };

/* ---------- Service Worker ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(e => console.error('SW error', e));
  });
}

/* ---------- Instalación (beforeinstallprompt) ---------- */
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; $('#btnInstall').hidden = false; });
$('#btnInstall').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt(); await deferredPrompt.userChoice;
  deferredPrompt = null; $('#btnInstall').hidden = true;
});
window.addEventListener('appinstalled', () => toast('App instalada'));

/* ---------- Estado de red ---------- */
function updateNet() {
  const n = $('#net'), on = navigator.onLine;
  n.textContent = on ? 'En línea' : 'Sin conexión'; n.classList.toggle('off', !on);
}
addEventListener('online', () => { updateNet(); toast('Conexión restablecida'); });
addEventListener('offline', () => { updateNet(); toast('Sin conexión: tus reportes se guardan en el dispositivo'); });
updateNet();

/* ---------- Router CSR ---------- */
const routes = { nuevo: renderNuevo, lista: renderLista };
async function router() {
  const r = (location.hash.replace('#/', '') || 'nuevo');
  document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.r === r));
  await (routes[r] || renderNuevo)();
  view.focus();
  $('#count').textContent = (await getReportes()).length;
}
addEventListener('hashchange', router);
router();

/* ---------- Vista: nuevo reporte ---------- */
function renderNuevo() {
  let foto = null, coords = null, direccion = '';
  view.innerHTML = `
    <h2>Nuevo reporte</h2>
    <label for="titulo">¿Qué encontraste?</label>
    <input id="titulo" placeholder="Ej. Bache profundo frente a la escuela" required>
    <label for="cat">Tipo de problema</label>
    <select id="cat"><option>Bache</option><option>Alumbrado</option><option>Fuga de agua</option><option>Basura</option><option>Otro</option></select>
    <label for="desc">Detalles</label>
    <textarea id="desc" rows="3"></textarea>
    <div class="row"><button id="bFoto" type="button">Tomar foto</button><button id="bGeo" type="button">Usar mi ubicación</button></div>
    <img id="prev" class="preview" alt="Vista previa de la foto" hidden>
    <p id="geoTxt" class="hint">Sin ubicación todavía.</p>
    <div class="row"><button id="bGuardar" class="primary" type="button">Guardar reporte</button></div>`;

  $('#bFoto').onclick = async () => {
    foto = await capturarFoto();
    if (foto) { const p = $('#prev'); p.src = URL.createObjectURL(foto); p.hidden = false; }
  };

  $('#bGeo').onclick = () => {
    if (!('geolocation' in navigator)) return toast('Tu dispositivo no soporta geolocalización');
    $('#geoTxt').textContent = 'Obteniendo ubicación…';
    navigator.geolocation.getCurrentPosition(async (pos) => {
      coords = { lat: +pos.coords.latitude.toFixed(6), lon: +pos.coords.longitude.toFixed(6) };
      $('#geoTxt').textContent = `Lat ${coords.lat}, Lon ${coords.lon}`;
      direccion = await direccionDe(coords);
      if (direccion) $('#geoTxt').textContent += ` · ${direccion}`;
    }, (err) => {
      $('#geoTxt').textContent = err.code === 1 ? 'Permiso de ubicación denegado. Actívalo en los ajustes del navegador.' : 'No se pudo obtener la ubicación.';
    }, { enableHighAccuracy: true, timeout: 15000 });
  };

  $('#bGuardar').onclick = async () => {
    const titulo = $('#titulo').value.trim();
    if (!titulo) { toast('Escribe qué encontraste'); return $('#titulo').focus(); }
    await addReporte({ titulo, categoria: $('#cat').value, descripcion: $('#desc').value.trim(), foto, coords, direccion, fecha: Date.now() });
    await notificar('Reporte guardado', titulo);
    toast('Reporte guardado en tu dispositivo');
    location.hash = '#/lista';
  };
}

/* ---------- Vista: lista (funciona offline desde IndexedDB) ---------- */
async function renderLista() {
  const items = await getReportes();
  view.innerHTML = '<h2>Mis reportes</h2>' + (items.length ? '' :
    '<div class="empty">Aún no hay reportes.<br><a href="#/nuevo">Crear el primero</a></div>');
  items.forEach(r => {
    const el = document.createElement('article'); el.className = 'card';
    const url = r.foto ? URL.createObjectURL(r.foto) : '';
    el.innerHTML = `${url ? `<img src="${url}" alt="Foto del reporte">` : ''}
      <div class="body"><h3>${esc(r.titulo)}</h3>
      <small>${esc(r.categoria)} · ${new Date(r.fecha).toLocaleString('es-MX')}</small>
      ${r.descripcion ? `<p>${esc(r.descripcion)}</p>` : ''}
      ${r.coords ? `<small>${esc(r.direccion || `${r.coords.lat}, ${r.coords.lon}`)}</small>` : ''}
      <button class="del" data-id="${r.id}">Eliminar</button></div>`;
    el.querySelector('.del').onclick = async () => { await deleteReporte(r.id); toast('Reporte eliminado'); router(); };
    view.append(el);
  });
}

/* ---------- Web API 1: Cámara (getUserMedia) con respaldo a <input capture> ---------- */
async function capturarFoto() {
  if (!navigator.mediaDevices?.getUserMedia) return elegirArchivo();
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); }
  catch (e) { toast(e.name === 'NotAllowedError' ? 'Permiso de cámara denegado' : 'Cámara no disponible'); return elegirArchivo(); }
  const dlg = $('#cam'), video = $('#video');
  video.srcObject = stream; dlg.showModal();
  return new Promise((resolve) => {
    const fin = (blob) => { stream.getTracks().forEach(t => t.stop()); dlg.close(); resolve(blob); };
    $('#snap').onclick = () => {
      const c = document.createElement('canvas');
      c.width = video.videoWidth; c.height = video.videoHeight;
      c.getContext('2d').drawImage(video, 0, 0);
      c.toBlob(b => fin(b), 'image/jpeg', 0.8);
    };
    $('#closeCam').onclick = () => fin(null);
  });
}
function elegirArchivo() {
  return new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.capture = 'environment';
    i.onchange = () => res(i.files[0] || null); i.click();
  });
}

/* ---------- Web API 2: Geolocalización + geocodificación inversa (caché dinámica en SW) ---------- */
async function direccionDe({ lat, lon }) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
    return (await r.json()).display_name?.split(',').slice(0, 3).join(',') || '';
  } catch { return ''; }
}

/* ---------- Web API 3: Notificaciones ---------- */
async function notificar(titulo, cuerpo) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') await Notification.requestPermission();
  if (Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker?.ready;
  const opts = { body: cuerpo, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'reporte' };
  reg ? reg.showNotification(titulo, opts) : new Notification(titulo, opts);
}

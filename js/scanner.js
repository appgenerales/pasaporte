import { usuarioActual, leerPerfil, pendiente } from './auth.js';
import { sellar, ErrorSello } from './sellos.js';

const $ = (sel) => document.querySelector(sel);
let lector = null;

function mostrar(id) {
  for (const v of ['#vista-camara', '#vista-procesando', '#vista-error']) {
    $(v).classList.toggle('oculto', v !== id);
  }
}

// Acepta la URL completa del QR o solo sus parámetros.
function leerQR(texto) {
  try {
    const url = new URL(texto, location.href);
    const e = url.searchParams.get('e');
    const t = url.searchParams.get('t');
    return e && t ? { e, t } : null;
  } catch {
    return null;
  }
}

async function procesar(e, t) {
  mostrar('#vista-procesando');
  const uid = await usuarioActual();
  const perfil = uid ? await leerPerfil() : null;
  if (!perfil) {
    // Primero el registro; el sello se aplica al terminar.
    pendiente.guardar(e, t);
    return location.replace('index.html');
  }
  try {
    const resultado = await sellar(e, t);
    location.replace(`pasaporte.html?sello=${encodeURIComponent(e)}&estado=${resultado}`);
  } catch (err) {
    console.error(err);
    $('#mensaje-error').textContent =
      err instanceof ErrorSello ? err.message : 'Ocurrió un error inesperado. Inténtalo de nuevo.';
    mostrar('#vista-error');
  }
}

async function abrirCamara() {
  mostrar('#vista-camara');
  const estado = $('#estado-camara');
  estado.textContent = 'Activando cámara…';
  if (!window.Html5Qrcode) {
    estado.textContent = 'No se pudo cargar el lector. También puedes escanear el QR con la cámara de tu celular.';
    return;
  }
  lector = lector || new Html5Qrcode('lector', { verbose: false });
  try {
    await lector.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: (w, h) => {
        const lado = Math.floor(Math.min(w, h) * 0.72);
        return { width: lado, height: lado };
      } },
      async (texto) => {
        const datos = leerQR(texto);
        if (!datos) {
          estado.textContent = 'Ese código no es de un stand CUEE 2.0. Intenta con otro.';
          return;
        }
        await lector.stop().catch(() => {});
        history.replaceState(null, '', `?e=${encodeURIComponent(datos.e)}&t=${encodeURIComponent(datos.t)}`);
        procesar(datos.e, datos.t);
      },
      () => {},
    );
    estado.textContent = '';
  } catch (err) {
    console.error(err);
    estado.textContent =
      'No tenemos permiso para usar la cámara. Actívalo en tu navegador o escanea el QR con la app de cámara del celular.';
  }
}

$('#reintentar').addEventListener('click', () => {
  history.replaceState(null, '', location.pathname);
  abrirCamara();
});

const params = new URLSearchParams(location.search);
if (params.get('e') && params.get('t')) {
  procesar(params.get('e'), params.get('t'));
} else {
  window.addEventListener('load', abrirCamara);
}

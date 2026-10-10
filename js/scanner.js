import { usuarioActual, leerPerfil, pendiente } from './auth.js';
import { sellar, registrarAsistencia, ErrorSello } from './sellos.js';

const $ = (sel) => document.querySelector(sel);
let lector = null;

function mostrar(id) {
  for (const v of ['#vista-camara', '#vista-procesando', '#vista-error']) {
    $(v).classList.toggle('oculto', v !== id);
  }
}

// QR de stand: ?e=<empresa>&t=<token>. QR de asistencia del día: ?d=<dia>&t=<token>.
// Acepta la URL completa del QR o solo sus parámetros.
function leerQR(texto) {
  try {
    const p = new URL(texto, location.href).searchParams;
    const t = p.get('t');
    if (!t) return null;
    if (p.get('e')) return { tipo: 'sello', id: p.get('e'), t };
    if (p.get('d')) return { tipo: 'asistencia', id: p.get('d'), t };
    return null;
  } catch {
    return null;
  }
}

function query(qr) {
  return `${qr.tipo === 'sello' ? 'e' : 'd'}=${encodeURIComponent(qr.id)}&t=${encodeURIComponent(qr.t)}`;
}

async function procesar(qr) {
  mostrar('#vista-procesando');
  $('#texto-procesando').textContent = qr.tipo === 'sello' ? 'Sellando tu pasaporte…' : 'Registrando tu asistencia…';
  const uid = await usuarioActual();
  const perfil = uid ? await leerPerfil() : null;
  if (!perfil) {
    // Primero el registro; el QR se aplica al terminar.
    pendiente.guardar(query(qr));
    return location.replace('index.html');
  }
  try {
    if (qr.tipo === 'sello') {
      const resultado = await sellar(qr.id, qr.t);
      location.replace(`pasaporte.html?sello=${encodeURIComponent(qr.id)}&estado=${resultado}`);
    } else {
      const { estado, dia } = await registrarAsistencia(qr.id, qr.t);
      location.replace(`pasaporte.html?asistencia=${dia.id}&estado=${estado}`);
    }
  } catch (err) {
    console.error(err);
    $('#titulo-error').textContent = qr.tipo === 'sello' ? 'No se pudo sellar' : 'No se pudo registrar la asistencia';
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
        const qr = leerQR(texto);
        if (!qr) {
          estado.textContent = 'Ese código no es del CUEE 2.0. Intenta con otro.';
          return;
        }
        await lector.stop().catch(() => {});
        history.replaceState(null, '', `?${query(qr)}`);
        procesar(qr);
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

const inicial = leerQR(location.href);
if (inicial) {
  procesar(inicial);
} else {
  window.addEventListener('load', abrirCamara);
}

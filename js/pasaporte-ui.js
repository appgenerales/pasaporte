import { usuarioActual, leerPerfil, actualizarPerfil, guardarNota, foto, firma } from './auth.js';
import { misSellos } from './sellos.js';
import { EMPRESAS, TOTAL, PAGINAS, PAGINA_DATOS, PAGINA_MISION, empresaPorId, rutaSello } from './empresas.js';

const $ = (sel) => document.querySelector(sel);
const RATIO = 1100 / 1700; // proporción de cada hoja del boceto

// `ocultar`: sello recién escaneado que se deja en blanco hasta animar su caída.
const estado = { uid: null, perfil: null, sellos: {}, libro: null, ocultar: null };

// ---------- utilidades ----------
function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

let avisoTimer;
function aviso(texto, tipo = '') {
  const el = $('#aviso');
  el.textContent = texto;
  el.className = `aviso visible ${tipo}`;
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => (el.className = 'aviso'), 3600);
}

// Giro "a mano" del sello, estable para cada estudiante y empresa.
function giroSello(id) {
  let h = 0;
  for (const c of `${estado.uid}:${id}`) h = (h * 31 + c.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 21) - 11) + 'deg';
}

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
function fechaSello(ms) {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()} · ${hh}:${mm}`;
}

// Evita que el libro capture el toque y pase la hoja al escribir.
function aislarDelLibro(el) {
  for (const ev of ['mousedown', 'touchstart']) {
    el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  }
}

// ---------- construcción de las hojas ----------
function hojaBase(nombre, indice) {
  const el = document.createElement('div');
  el.className = 'pagina';
  el.dataset.indice = indice;
  if (indice === 0 || indice === PAGINAS.length - 1) el.dataset.density = 'hard';
  const img = document.createElement('img');
  img.className = 'fondo';
  img.src = `assets/paginas/${nombre}.webp`;
  img.alt = '';
  img.draggable = false;
  img.decoding = 'async';
  el.append(img);
  return el;
}

function pintarSello(capa, empresa, animar = false) {
  capa.querySelector('.sello, .sello-pendiente')?.remove();
  const ts = estado.ocultar === empresa.id ? null : estado.sellos[empresa.id];
  let el;
  if (ts) {
    el = document.createElement('div');
    el.className = 'sello' + (animar ? ' estampando' : '');
    el.style.setProperty('--giro', giroSello(empresa.id));
    el.innerHTML = `<img src="${rutaSello(empresa.id)}" alt="Sello de ${escapar(empresa.nombre)}">
      <span class="sello-fecha">${fechaSello(ts)}</span>`;
  } else {
    el = document.createElement('div');
    el.className = 'sello-pendiente';
    el.innerHTML = `Escanea el QR del stand de ${escapar(empresa.nombre)} para sellar esta hoja`;
  }
  capa.prepend(el);
}

function hojaDestino(el, empresa) {
  const capa = document.createElement('div');
  capa.className = 'capa';
  capa.id = `capa-${empresa.id}`;
  capa.style.setProperty('--linea', empresa.linea);
  pintarSello(capa, empresa);

  const nota = document.createElement('textarea');
  nota.className = 'nota';
  nota.maxLength = 180;
  nota.rows = 3;
  nota.placeholder = 'Toca aquí para escribir…';
  nota.setAttribute('aria-label', `Lo más importante que descubrí en ${empresa.nombre}`);
  nota.value = estado.perfil?.notas?.[empresa.id] || '';
  aislarDelLibro(nota);

  const marca = document.createElement('span');
  marca.className = 'nota-estado';
  marca.textContent = 'Guardado ✓';

  let timer;
  let ultimo = nota.value;
  const guardar = async () => {
    clearTimeout(timer);
    if (nota.value === ultimo) return;
    ultimo = nota.value;
    try {
      await guardarNota(empresa.id, nota.value);
      marca.classList.add('visible');
      setTimeout(() => marca.classList.remove('visible'), 1400);
    } catch (err) {
      console.error(err);
      aviso('No se pudo guardar la nota. Revisa tu conexión.', 'error');
    }
  };
  nota.addEventListener('input', () => {
    // Que el texto no se salga de las tres líneas del boceto.
    while (nota.scrollHeight > nota.clientHeight + 2 && nota.value.length) {
      nota.value = nota.value.slice(0, -1);
    }
    clearTimeout(timer);
    timer = setTimeout(guardar, 900);
  });
  nota.addEventListener('blur', guardar);

  capa.append(nota, marca);
  el.append(capa);
}

function hojaDatos(el) {
  const capa = document.createElement('div');
  capa.className = 'datos-giro';
  capa.innerHTML = `
    <div class="campo campo-apellidos"></div>
    <div class="campo campo-nombres"></div>
    <div class="campo campo-programa"></div>
    <div class="campo campo-empresa"></div>
    <button type="button" class="editar-datos" aria-label="Editar datos del titular"><span class="pista">✎ Editar datos</span></button>
    <button type="button" class="foto-btn" aria-label="Cambiar fotografía"></button>
    <button type="button" class="firma-btn" aria-label="Firmar"></button>`;
  el.append(capa);
  capa.querySelector('.editar-datos').addEventListener('click', abrirDatos);
  capa.querySelector('.foto-btn').addEventListener('click', () => $('#input-foto').click());
  capa.querySelector('.firma-btn').addEventListener('click', abrirFirma);
}

function pintarDatos() {
  const capa = document.querySelector('.datos-giro');
  if (!capa) return;
  const p = estado.perfil || {};
  capa.querySelector('.campo-apellidos').textContent = p.apellidos || '';
  capa.querySelector('.campo-nombres').textContent = p.nombres || '';
  capa.querySelector('.campo-programa').textContent = p.programa || '';
  capa.querySelector('.campo-empresa').textContent = p.empresa || '';
  capa.classList.toggle('lleno', Boolean(p.apellidos && p.nombres));

  const f = foto.leer();
  capa.querySelector('.foto-btn').innerHTML = f
    ? `<img src="${f}" alt="Fotografía del titular">`
    : '<span class="pista">Toca para agregar tu foto</span>';
  const s = firma.leer();
  capa.querySelector('.firma-btn').innerHTML = s
    ? `<img src="${s}" alt="Firma del titular">`
    : '<span class="pista">Toca para firmar</span>';
}

function hojaMision(el) {
  const velo = document.createElement('div');
  velo.className = 'mision-velo';
  el.append(velo);
}

function pintarMision() {
  const hoja = document.querySelector(`.pagina[data-indice="${PAGINA_MISION}"]`);
  if (!hoja) return;
  const n = Object.keys(estado.sellos).length;
  const faltan = TOTAL - n;
  hoja.classList.toggle('completo', faltan <= 0);
  hoja.querySelector('.mision-velo').innerHTML =
    faltan > 0 ? `<div><strong>${n} / ${TOTAL}</strong>Te ${faltan === 1 ? 'falta 1 destino' : `faltan ${faltan} destinos`} para completar la misión</div>` : '';
}

function pintarProgreso() {
  const n = EMPRESAS.filter((e) => estado.sellos[e.id]).length;
  $('#progreso-texto').textContent = `${n} de ${TOTAL} destinos`;
  $('#progreso-num').textContent = `${n}/${TOTAL}`;
  $('#anillo').style.setProperty('--p', Math.round((n / TOTAL) * 100));
}

function construir() {
  const libro = $('#libro');
  PAGINAS.forEach((nombre, i) => {
    const el = hojaBase(nombre, i);
    const empresa = EMPRESAS.find((e) => e.pagina === i);
    if (empresa) hojaDestino(el, empresa);
    if (i === PAGINA_DATOS) hojaDatos(el);
    if (i === PAGINA_MISION) hojaMision(el);
    libro.append(el);
  });
  pintarDatos();
  pintarMision();
}

// ---------- tamaño del libro ----------
// Celular en vertical: una hoja a la vez. Pantallas anchas: el libro abierto (dos hojas).
function medir() {
  if (document.activeElement?.classList.contains('nota')) return; // el teclado no encoge el libro
  const zona = $('#libro-zona').getBoundingClientRect();
  const w = zona.width - 32;
  const h = zona.height - 8;
  const doble = Math.min(w, h * RATIO * 2);
  const ancho = doble >= 640 && w > h ? doble : Math.min(w, h * RATIO, 599);
  // StPageFlip fija width:100% en #libro, por eso el ancho va en el marco.
  $('#libro-marco').style.width = `${Math.floor(ancho)}px`;
}

// ---------- indicador de hoja ----------
function etiqueta(i) {
  if (i === 0) return 'Portada';
  if (i === PAGINA_DATOS) return 'Datos del titular';
  if (i === PAGINA_MISION) return 'Misión CUEE 2.0';
  if (i === PAGINAS.length - 1) return 'Contraportada';
  const e = EMPRESAS.find((x) => x.pagina === i);
  return e ? `Destino ${e.destino} · ${e.nombre}${estado.sellos[e.id] ? ' ✓' : ''}` : '';
}

function pintarIndicador() {
  const libro = estado.libro;
  if (!libro) return;
  const i = libro.getCurrentPageIndex();
  const ultima = PAGINAS.length - 1;
  let texto = etiqueta(i);
  if (libro.getOrientation() === 'landscape' && i > 0 && i < ultima) {
    const izq = i % 2 === 1 ? i : i - 1;
    texto = `${etiqueta(izq)}   |   ${etiqueta(izq + 1)}`;
  }
  $('#indicador').textContent = texto;
  const horizontal = libro.getOrientation() === 'landscape';
  $('#libro-marco').classList.toggle('tapa-delante', horizontal && i === 0);
  $('#libro-marco').classList.toggle('tapa-detras', horizontal && i === ultima);
  $('#anterior').disabled = i <= 0;
  $('#siguiente').disabled = i >= ultima;
}

// ---------- foto, firma y datos ----------
$('#input-foto').addEventListener('change', async (ev) => {
  const archivo = ev.target.files?.[0];
  ev.target.value = '';
  if (!archivo) return;
  try {
    const bmp = await createImageBitmap(archivo);
    const W = 360;
    const H = 480;
    const lienzo = document.createElement('canvas');
    lienzo.width = W;
    lienzo.height = H;
    const escala = Math.max(W / bmp.width, H / bmp.height);
    const ancho = bmp.width * escala;
    const alto = bmp.height * escala;
    lienzo.getContext('2d').drawImage(bmp, (W - ancho) / 2, (H - alto) / 2, ancho, alto);
    if (!foto.guardar(lienzo.toDataURL('image/jpeg', 0.82))) throw new Error('almacenamiento lleno');
    pintarDatos();
    aviso('Foto actualizada', 'exito');
  } catch (err) {
    console.error(err);
    aviso('No pudimos usar esa imagen. Prueba con otra.', 'error');
  }
});

function abrirDatos() {
  const dlg = $('#dlg-datos');
  const form = $('#form-datos');
  for (const k of ['apellidos', 'nombres', 'programa', 'empresa', 'contacto']) {
    form.elements[k].value = estado.perfil?.[k] || '';
  }
  dlg.showModal();
}

$('#dlg-datos').addEventListener('close', async () => {
  const dlg = $('#dlg-datos');
  if (dlg.returnValue !== 'guardar') return;
  const datos = Object.fromEntries(new FormData($('#form-datos')));
  estado.perfil = { ...estado.perfil, ...datos };
  pintarDatos();
  try {
    await actualizarPerfil(datos);
    aviso('Datos guardados', 'exito');
  } catch (err) {
    console.error(err);
    aviso('No se pudieron guardar los datos. Revisa tu conexión.', 'error');
  }
});

// Panel de firma con trazo suave.
const lienzo = $('#lienzo-firma');
const ctx = lienzo.getContext('2d');
let trazando = false;
let puntos = [];
let firmado = false;

function prepararLienzo() {
  const r = lienzo.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  lienzo.width = Math.round(r.width * dpr);
  lienzo.height = Math.round(r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0d2a5e';
  ctx.lineWidth = 2.6;
  firmado = false;
}

function punto(ev) {
  const r = lienzo.getBoundingClientRect();
  return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}

lienzo.addEventListener('pointerdown', (ev) => {
  trazando = true;
  firmado = true;
  puntos = [punto(ev)];
  lienzo.setPointerCapture(ev.pointerId);
});
lienzo.addEventListener('pointermove', (ev) => {
  if (!trazando) return;
  puntos.push(punto(ev));
  if (puntos.length < 3) return;
  const [a, b, c] = puntos.slice(-3);
  ctx.beginPath();
  ctx.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2);
  ctx.quadraticCurveTo(b.x, b.y, (b.x + c.x) / 2, (b.y + c.y) / 2);
  ctx.stroke();
});
const terminar = () => (trazando = false);
lienzo.addEventListener('pointerup', terminar);
lienzo.addEventListener('pointercancel', terminar);

function abrirFirma() {
  $('#dlg-firma').showModal();
  prepararLienzo();
}
$('#firma-limpiar').addEventListener('click', () => {
  ctx.clearRect(0, 0, lienzo.width, lienzo.height);
  firmado = false;
});
$('#firma-cancelar').addEventListener('click', () => $('#dlg-firma').close());
$('#firma-guardar').addEventListener('click', () => {
  if (firmado) firma.guardar(lienzo.toDataURL('image/png'));
  else firma.borrar();
  $('#dlg-firma').close();
  pintarDatos();
});

// ---------- arranque ----------
async function iniciar() {
  estado.uid = await usuarioActual();
  if (!estado.uid) return location.replace('index.html');

  const [perfil, sellos] = await Promise.all([leerPerfil(), misSellos()]);
  if (!perfil) return location.replace('index.html');
  estado.perfil = perfil;
  estado.sellos = sellos;

  const params = new URLSearchParams(location.search);
  const nuevo = empresaPorId(params.get('sello'));
  const repetido = params.get('estado') === 'repetido';
  if (params.has('sello')) history.replaceState(null, '', location.pathname);
  if (nuevo && !repetido) estado.ocultar = nuevo.id;

  construir();
  pintarProgreso();

  $('#cargando').classList.add('oculto');
  $('#escena').classList.remove('oculto');
  medir();
  window.addEventListener('resize', medir);

  const libro = new St.PageFlip($('#libro'), {
    width: 550,
    height: 850,
    size: 'stretch',
    minWidth: 300,
    maxWidth: 1100,
    minHeight: 200,
    maxHeight: 1700,
    showCover: true,
    usePortrait: true,
    mobileScrollSupport: false,
    maxShadowOpacity: 0.45,
    flippingTime: 850,
    startPage: nuevo ? nuevo.pagina : 0,
  });
  estado.libro = libro;
  libro.loadFromHTML(document.querySelectorAll('#libro .pagina'));
  libro.on('flip', pintarIndicador);
  libro.on('changeOrientation', pintarIndicador);
  $('#libro').classList.remove('cargando');
  pintarIndicador();

  $('#anterior').addEventListener('click', () => libro.flipPrev());
  $('#siguiente').addEventListener('click', () => libro.flipNext());
  document.addEventListener('keydown', (ev) => {
    if (ev.target.closest('textarea, input, dialog')) return;
    if (ev.key === 'ArrowLeft') libro.flipPrev();
    if (ev.key === 'ArrowRight') libro.flipNext();
  });

  if (nuevo && !repetido) {
    // El sello cae sobre la hoja recién abierta.
    setTimeout(() => {
      estado.ocultar = null;
      pintarSello($(`#capa-${nuevo.id}`), nuevo, true);
      if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.([30, 40, 70]);
      aviso(`¡Destino ${nuevo.destino} sellado: ${nuevo.nombre}!`, 'exito');
      pintarMision();
      if (Object.keys(estado.sellos).length >= TOTAL) {
        setTimeout(() => {
          libro.flip(PAGINA_MISION);
          aviso('¡Misión CUEE 2.0 completada! 🎉', 'exito');
        }, 2600);
      }
    }, 450);
  } else {
    if (nuevo && repetido) aviso(`Ya tenías el sello de ${nuevo.nombre}.`);
  }
}

iniciar().catch((err) => {
  console.error(err);
  $('#cargando').innerHTML = '<div>No pudimos abrir tu pasaporte.<br><br><button class="btn btn-primario" onclick="location.reload()">Reintentar</button></div>';
});

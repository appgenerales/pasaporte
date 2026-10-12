import { usuarioActual, leerPerfil, actualizarPerfil, guardarNota, foto, firma, sincronizarImagenes, faltanDatos, cerrarSesion, esAnonimo, crearContrasena, ErrorCuenta } from './auth.js';
import { misSellos, misAsistencias } from './sellos.js';
import { EMPRESAS, TOTAL, PAGINAS, PAGINA_DATOS, PAGINA_MISION, DIAS, empresaPorId, diaPorId, mentorPorId, rutaSello, fechaLarga, etiquetaDestino, tipoDe, lineaPrograma, constanciaLista } from './empresas.js';
import { conectarFacultadPrograma, llenarEmpresas, llenarVinculos, camposPorTipo, empresaFinal } from './formularios.js';
import { fiesta } from './fiesta.js';
import { pasaporteVisible, PASAPORTE_VISIBLE_DESDE } from './evento.js';

const $ = (sel) => document.querySelector(sel);
const RATIO = 1100 / 1700; // proporción de cada hoja del boceto

// `ocultar`: sello recién escaneado que se deja en blanco hasta animar su caída.
const estado = { uid: null, perfil: null, sellos: {}, asistencias: {}, libro: null, ocultar: null };

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
    el.className = 'sello' + (animar ? ' estampando' : '') + (empresa.sello ? ' sobre-imagen' : '');
    el.style.setProperty('--giro', giroSello(empresa.id));
    el.innerHTML = `<img src="${rutaSello(empresa.id)}" alt="Sello de ${escapar(empresa.nombre)}">
      <span class="sello-fecha">${fechaSello(ts)}</span>`;
  } else {
    el = document.createElement('div');
    el.className = 'sello-pendiente' + (empresa.sello ? ' sobre-imagen' : '');
    el.innerHTML = `Escanea el QR del stand de ${escapar(empresa.nombre)} para sellar esta hoja`;
  }
  // Hojas con imagen de fondo completa: el sello va donde indica `empresa.sello`.
  if (empresa.sello) {
    el.style.left = `${empresa.sello.x}%`;
    el.style.top = `${empresa.sello.y}%`;
    el.style.width = `${empresa.sello.ancho}cqw`;
    if (ts) el.style.height = `${empresa.sello.ancho * 0.75 * (1100 / 1700)}cqh`;
  }
  capa.prepend(el);
}

function hojaDestino(el, empresa) {
  const capa = document.createElement('div');
  capa.className = 'capa';
  capa.id = `capa-${empresa.id}`;
  pintarSello(capa, empresa);
  if (empresa.linea == null) {
    el.append(capa);
    return; // hoja sin líneas para "Lo más importante que descubrí"
  }
  capa.style.setProperty('--linea', empresa.linea);

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
  capa.querySelector('.campo-programa').textContent = lineaPrograma(p);
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
  $('#progreso-num').textContent = `${n}/${TOTAL}`;
  $('#anillo').style.setProperty('--p', Math.round((n / TOTAL) * 100));
  const d = DIAS.filter((x) => estado.asistencias[x.id]).length;
  $('#num-dias').textContent = `${d}/${DIAS.length}`;
  $('#anillo-dias').style.setProperty('--p', Math.round((d / DIAS.length) * 100));
  $('#anillo-dias').parentElement.title = DIAS.map((x) => `${x.nombre}: ${estado.asistencias[x.id] ? 'asistió' : 'pendiente'}`).join(' · ');
  // Visitantes y comunidad ITM: la asistencia es opcional; el anillo aparece si registran alguna.
  $('#anillo-dias').parentElement.classList.toggle('oculto', !tipoDe(estado.perfil).asistencia && d === 0);
}

const selloCompleto = () => EMPRESAS.every((e) => estado.sellos[e.id]);
const asistenciaCompleta = () => DIAS.every((d) => estado.asistencias[d.id]);

function pintarConstancia() {
  const lista = constanciaLista(estado.perfil, estado.sellos, estado.asistencias);
  $('#btn-constancia').classList.toggle('oculto', !lista);
  $('#btn-constancia').classList.toggle('btn-primario', lista);
  $('#btn-constancia').classList.toggle('btn-secundario', !lista);
  // Con todo completo, lo importante es la constancia.
  $('#btn-escanear').classList.toggle('btn-primario', !lista);
  $('#btn-escanear').classList.toggle('btn-secundario', lista);
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
  return e ? `${etiquetaDestino(e)} · ${e.nombre}${estado.sellos[e.id] ? ' ✓' : ''}` : '';
}

function pintarIndicador() {
  const libro = estado.libro;
  if (!libro) return;
  const i = libro.getCurrentPageIndex();
  const ultima = PAGINAS.length - 1;
  const horizontal = libro.getOrientation() === 'landscape';
  // En pantalla ancha se ven dos hojas: la de la izquierda es la impar.
  const izq = horizontal && i > 0 ? (i % 2 === 1 ? i : i - 1) : i;
  const der = horizontal && i > 0 ? Math.min(izq + 1, ultima) : i;
  $('#indicador').textContent = der !== izq ? `${etiqueta(izq)}   |   ${etiqueta(der)}` : etiqueta(i);
  $('#libro-marco').classList.toggle('tapa-delante', horizontal && i === 0);
  $('#libro-marco').classList.toggle('tapa-detras', horizontal && izq === ultima);
  $('#anterior').disabled = i <= 0;
  $('#siguiente').disabled = der >= ultima;
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
    const dataUrl = lienzo.toDataURL('image/jpeg', 0.82);
    try {
      await foto.guardar(dataUrl);
      aviso('Foto actualizada', 'exito');
    } catch (err) {
      console.error(err);
      aviso('Foto guardada en este celular, pero no se pudo subir. Revisa tu conexión.', 'error');
    }
    pintarDatos();
  } catch (err) {
    console.error(err);
    aviso('No pudimos usar esa imagen. Prueba con otra.', 'error');
  }
});

function abrirDatos() {
  const dlg = $('#dlg-datos');
  const form = $('#form-datos');
  const tipo = tipoDe(estado.perfil);
  for (const k of ['cedula', 'apellidos', 'nombres', 'contacto']) {
    form.elements[k].value = estado.perfil?.[k] || '';
  }
  form.elements.tipoNombre.value = tipo.nombre;
  listasDatos.facultad.fijar(estado.perfil?.facultad, estado.perfil?.programa);
  listasDatos.empresa.fijar(estado.perfil?.empresa);
  listasDatos.empresaVisitante.fijar(estado.perfil?.empresa);
  form.elements.vinculo.value = estado.perfil?.vinculo || '';
  listasDatos.aplicar(tipo.id);
  form.elements.mentorNombre.value = mentorPorId(estado.perfil?.mentor)?.nombre || 'Sin mentor asignado';
  $('#datos-intro').textContent = faltanDatos(estado.perfil)
    ? tipo.id === 'estudiante'
      ? 'Para registrar tu asistencia a los 3 días necesitamos tu cédula y tu facultad.'
      : 'Necesitamos tu cédula para completar tu registro.'
    : 'Así aparecen en la hoja de datos de tu pasaporte.';
  dlg.showModal();
}

$('#dlg-datos').addEventListener('close', async () => {
  const dlg = $('#dlg-datos');
  if (dlg.returnValue !== 'guardar') return;
  const { mentorNombre, tipoNombre, ...datos } = empresaFinal(Object.fromEntries(new FormData($('#form-datos'))));
  datos.tipo = tipoDe(estado.perfil).id; // el tipo se elige al registrarse
  if (estado.perfil?.mentor) datos.mentor = estado.perfil.mentor;
  datos.cedula = String(datos.cedula || '').replace(/\D/g, '');
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
$('#firma-guardar').addEventListener('click', async () => {
  let guardado;
  if (firmado) {
    // Se reduce a 600×200 para que pese poco en Firestore.
    const reducido = document.createElement('canvas');
    reducido.width = 600;
    reducido.height = 200;
    reducido.getContext('2d').drawImage(lienzo, 0, 0, 600, 200);
    guardado = firma.guardar(reducido.toDataURL('image/png'));
  } else {
    guardado = firma.borrar();
  }
  $('#dlg-firma').close();
  pintarDatos();
  try {
    await guardado;
    aviso('Firma guardada', 'exito');
  } catch (err) {
    console.error(err);
    aviso('Firma guardada en este celular, pero no se pudo subir. Revisa tu conexión.', 'error');
  }
});

// ---------- arranque ----------
// Antes de PASAPORTE_VISIBLE_DESDE: portada cerrada y asistencia de los días.
function mostrarAntesala() {
  $('#libro-zona').classList.add('oculto');
  $('#navegacion').classList.add('oculto');
  $('#antesala').classList.remove('oculto');
  const semana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const diaSemana = semana[new Date(`${PASAPORTE_VISIBLE_DESDE}T12:00:00-05:00`).getUTCDay()];
  $('#antesala-fecha').textContent = `${diaSemana} ${fechaLarga(PASAPORTE_VISIBLE_DESDE)}`;
  if (!tipoDe(estado.perfil).asistencia) {
    $('#antesala-intro').textContent = 'Ese día lo hojeas y lo sellas en cada stand.';
    $('#antesala-dias').classList.add('oculto');
  }
  $('#antesala-dias').innerHTML = DIAS.map((d) => {
    const ok = estado.asistencias[d.id];
    return `<li class="${ok ? 'si' : ''}"><span>${d.nombre} · ${fechaLarga(d.fecha)}</span><b>${ok ? '✓ Asististe' : 'Pendiente'}</b></li>`;
  }).join('');
}

function abrirLibro(nuevo, repetido) {
  construir();
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
      aviso(`¡${etiquetaDestino(nuevo)} sellado: ${nuevo.nombre}!`, 'exito');
      pintarMision();
      if (selloCompleto()) {
        setTimeout(() => {
          libro.flip(PAGINA_MISION);
          setTimeout(() => {
            fiesta();
            const t = tipoDe(estado.perfil);
            aviso(!t.asistencia
              ? '¡Misión CUEE 2.0 completada! 🎉 Gracias por viajar con nosotros.'
              : asistenciaCompleta()
                ? '¡Completaste el CUEE 2.0! 🎉 Ya puedes descargar tu constancia.'
                : '¡Misión CUEE 2.0 completada! 🎉 No olvides registrar tu asistencia de los 3 días.', 'exito');
          }, 900);
        }, 2400);
      }
    }, 450);
  } else if (nuevo && repetido) {
    aviso(`Ya tenías el sello de ${nuevo.nombre}.`);
  }
}

async function iniciar() {
  estado.uid = await usuarioActual();
  if (!estado.uid) return location.replace('index.html');

  const [perfil, sellos, asistencias] = await Promise.all([leerPerfil(), misSellos(), misAsistencias()]);
  if (!perfil) return location.replace('index.html');
  estado.perfil = perfil;
  estado.sellos = sellos;
  estado.asistencias = asistencias;

  const params = new URLSearchParams(location.search);
  const nuevo = empresaPorId(params.get('sello'));
  const nuevoDia = diaPorId(params.get('asistencia'));
  const repetido = params.get('estado') === 'repetido';
  if (params.has('sello') || params.has('asistencia')) history.replaceState(null, '', location.pathname);
  if (nuevo && !repetido) estado.ocultar = nuevo.id;

  pintarProgreso();
  pintarConstancia();
  sincronizarImagenes().then((cambio) => cambio && pintarDatos());
  $('#cargando').classList.add('oculto');
  $('#escena').classList.remove('oculto');

  if (pasaporteVisible()) abrirLibro(nuevo, repetido);
  else mostrarAntesala();

  if (nuevoDia) {
    const anillo = $('#anillo-dias');
    anillo.classList.add('latido');
    setTimeout(() => anillo.classList.remove('latido'), 1600);
    if (repetido) {
      aviso(`Tu asistencia del ${nuevoDia.nombre} ya estaba registrada.`);
    } else if (constanciaLista(estado.perfil, estado.sellos, estado.asistencias)) {
      fiesta();
      aviso('¡Completaste el CUEE 2.0! 🎉 Ya puedes descargar tu constancia.', 'exito');
    } else {
      aviso(`¡Asistencia del ${nuevoDia.nombre} registrada!`, 'exito');
    }
  }

  // Estudiantes registrados antes de que se pidieran cédula y facultad,
  // o con la sesión anónima de la primera versión (sin contraseña).
  const espera = nuevo || nuevoDia ? 3200 : 600;
  if (faltanDatos(estado.perfil)) setTimeout(abrirDatos, espera);
  else if (await esAnonimo()) setTimeout(abrirClave, espera);
}

function abrirClave() {
  const form = $('#form-clave');
  form.elements.correo.value = estado.perfil?.contacto || '';
  form.querySelector('.mensaje-error').textContent = '';
  $('#dlg-clave').showModal();
}

$('#clave-guardar').addEventListener('click', async () => {
  const form = $('#form-clave');
  const { correo, contrasena, contrasena2 } = Object.fromEntries(new FormData(form));
  const error = form.querySelector('.mensaje-error');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo.trim())) return (error.textContent = 'Revisa el correo electrónico.');
  if (contrasena.length < 6) return (error.textContent = 'La contraseña debe tener al menos 6 caracteres.');
  if (contrasena !== contrasena2) return (error.textContent = 'Las contraseñas no coinciden.');
  try {
    await crearContrasena(correo, contrasena);
    estado.perfil.contacto = correo.trim().toLowerCase();
    $('#dlg-clave').close();
    aviso('Listo: ya puedes entrar desde cualquier celular con tu correo y contraseña.', 'exito');
  } catch (err) {
    error.textContent = err instanceof ErrorCuenta ? err.message : 'No se pudo crear la contraseña.';
  }
});

$('#antesala-datos').addEventListener('click', abrirDatos);

$('#salir').addEventListener('click', async () => {
  const msg = (await esAnonimo())
    ? 'Aún no tienes contraseña: si sales, no podrás volver a entrar a este pasaporte. ¿Salir de todos modos?'
    : '¿Cerrar sesión? Podrás volver a entrar con tu correo y contraseña.';
  if (!confirm(msg)) return;
  await cerrarSesion();
  location.replace('index.html?entrar');
});

const formDatos = $('#form-datos');
const listasDatos = {
  facultad: conectarFacultadPrograma(formDatos.elements.facultad, formDatos.elements.programa),
  empresa: llenarEmpresas($('#datos-empresa')),
  empresaVisitante: llenarEmpresas($('#datos-empresa-visitante'), 'Elige la empresa'),
  aplicar: camposPorTipo(formDatos, $('#datos-empresa-otra')),
};
llenarVinculos(formDatos.elements.vinculo);

iniciar().catch((err) => {
  console.error(err);
  $('#cargando').innerHTML = '<div>No pudimos abrir tu pasaporte.<br><br><button class="btn btn-primario" onclick="location.reload()">Reintentar</button></div>';
});

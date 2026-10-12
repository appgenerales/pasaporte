import { usuarioActual, leerPerfil, faltanDatos } from './auth.js';
import { misSellos, misAsistencias } from './sellos.js';
import { EMPRESAS, DIAS, fechaLarga, etiquetaDestino, tipoDe, constanciaLista } from './empresas.js';
import { dibujarConstancia, pdfDeLienzos, nombreArchivo } from './constancia-dibujo.js';

const $ = (sel) => document.querySelector(sel);

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

function descargar(url, archivo) {
  const a = document.createElement('a');
  a.href = url;
  a.download = archivo;
  a.click();
}

function mostrarPendiente(sellos, asistencias, perfil) {
  const filas = [
    ...DIAS.map((d) => [`Asistencia ${d.nombre} (${fechaLarga(d.fecha)})`, Boolean(asistencias[d.id])]),
    // Al mentor le basta la asistencia de los 3 días.
    ...(tipoDe(perfil).constanciaConSellos ? EMPRESAS.map((e) => [`${etiquetaDestino(e)} · ${e.nombre}`, Boolean(sellos[e.id])]) : []),
  ];
  if (faltanDatos(perfil)) filas.unshift([tipoDe(perfil).id === 'estudiante' ? 'Cédula y facultad en tus datos' : 'Cédula en tus datos', false]);
  const faltan = filas.filter(([, ok]) => !ok).length;
  $('#pendiente-resumen').textContent = faltan === 1 ? 'Te falta 1 paso' : `Te faltan ${faltan} pasos`;
  $('#pendiente-lista').innerHTML = filas
    .map(([txt, ok]) => `<li>${escapar(txt)}<span class="${ok ? 'si' : 'no'}">${ok ? '✓' : 'Pendiente'}</span></li>`)
    .join('');
  $('#vista-pendiente').classList.remove('oculto');
}

async function iniciar() {
  if (!(await usuarioActual())) return location.replace('index.html');
  const [perfil, sellos, asistencias] = await Promise.all([leerPerfil(), misSellos(), misAsistencias()]);
  if (!perfil) return location.replace('index.html');
  // Visitantes de empresa y comunidad ITM no reciben constancia.
  const plantilla = tipoDe(perfil).constancia;
  if (!plantilla) return location.replace('pasaporte.html');
  $('#cargando').classList.add('oculto');

  if (!constanciaLista(perfil, sellos, asistencias) || faltanDatos(perfil)) return mostrarPendiente(sellos, asistencias, perfil);

  // La de mentor no lleva cédula.
  const lienzo = await dibujarConstancia(plantilla, { nombre: `${perfil.nombres} ${perfil.apellidos}`, cedula: perfil.cedula });
  const jpg = lienzo.toDataURL('image/jpeg', 0.92);
  $('#vista').src = jpg;
  $('#vista-lista').classList.remove('oculto');
  const archivo = nombreArchivo(`Constancia CUEE 2.0 - ${perfil.nombres} ${perfil.apellidos}`);

  $('#descargar-img').addEventListener('click', () => descargar(jpg, `${archivo}.jpg`));
  $('#descargar-pdf').addEventListener('click', () => {
    if (!window.jspdf) return descargar(jpg, `${archivo}.jpg`);
    pdfDeLienzos([lienzo], 'Constancia de abordaje y participación · Pasantías CUEE 2.0').save(`${archivo}.pdf`);
  });
}

iniciar().catch((err) => {
  console.error(err);
  $('#cargando').innerHTML = '<div>No pudimos preparar tu constancia.<br><br><button class="btn btn-primario" onclick="location.reload()">Reintentar</button></div>';
});

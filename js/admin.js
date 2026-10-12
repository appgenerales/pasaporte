import { DEMO, fb, local } from './firebase.js';
import { organizadorActual, entrarConGoogle, entrarConCorreo, salir } from './admin-auth.js';
import { dibujarConstancia, pdfDeLienzos, nombreArchivo } from './constancia-dibujo.js';
import { EMPRESAS, TOTAL, DIAS, MENTORES, TIPOS, mentorPorId, rotuloCorto, tipoDe, lineaPrograma } from './empresas.js';

const $ = (sel) => document.querySelector(sel);
let filas = [];

function mostrar(id) {
  for (const v of ['#vista-acceso', '#vista-panel']) $(v).classList.toggle('oculto', v !== id);
  $('#salir').classList.toggle('oculto', id !== '#vista-panel' || DEMO);
}

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

const MIN_DIAS_CONSTANCIA = 2;

const fecha = (ms) => (ms ? new Date(ms).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '');

// ---------- Ganadores del sorteo ----------
// Quien gana queda en ganadores/{uid} y no vuelve a participar hasta reiniciar.
const K_DEMO_GANADORES = 'cue.demo.ganadores';
let ganadores = {}; // uid -> { nombre, ts }

async function cargarGanadores() {
  if (DEMO) {
    ganadores = local.get(K_DEMO_GANADORES, {});
    return;
  }
  const { db, F } = await fb();
  const snap = await F.getDocs(F.collection(db, 'ganadores'));
  ganadores = {};
  snap.forEach((d) => {
    const g = d.data();
    ganadores[d.id] = { nombre: g.nombre, ts: g.ts?.toMillis?.() ?? Date.now() };
  });
}

async function guardarGanador(r) {
  const nombre = `${r.nombres} ${r.apellidos}`.trim();
  ganadores[r.uid] = { nombre, ts: Date.now() };
  if (DEMO) return local.set(K_DEMO_GANADORES, ganadores);
  const { db, F } = await fb();
  await F.setDoc(F.doc(db, 'ganadores', r.uid), { nombre, ts: F.serverTimestamp() });
}

async function reiniciarGanadores() {
  if (DEMO) {
    local.borrar(K_DEMO_GANADORES);
  } else {
    const { db, F } = await fb();
    const lote = F.writeBatch(db);
    for (const uid of Object.keys(ganadores)) lote.delete(F.doc(db, 'ganadores', uid));
    await lote.commit();
  }
  ganadores = {};
}

function pintarGanadores() {
  const lista = Object.values(ganadores).sort((a, b) => a.ts - b.ts);
  $('#reiniciar-ganadores').classList.toggle('oculto', !lista.length);
  $('#ganadores-lista').classList.toggle('oculto', !lista.length);
  $('#ganadores-lista').innerHTML = lista.length
    ? `<b>Ya ganaron (no participan en el próximo sorteo):</b> ${lista.map((g, i) => `${i + 1}. ${escapar(g.nombre)}`).join(' · ')}`
    : '';
}

async function cargar() {
  const estudiantes = {};
  await cargarGanadores();
  if (DEMO) {
    // Todas las cuentas creadas en este navegador.
    for (const { uid } of Object.values(local.get('cue.demo.cuentas', {}))) {
      const perfil = local.get(`cue.demo.perfil.${uid}`);
      if (!perfil) continue;
      const asis = local.get(`cue.demo.asistencias.${uid}`, {});
      estudiantes[uid] = {
        ...perfil,
        sellos: local.get(`cue.demo.sellos.${uid}`, {}),
        asistencias: Object.fromEntries(Object.entries(asis).map(([d, v]) => [d, typeof v === 'object' ? v : { ts: v }])),
      };
    }
  } else {
    const { db, F } = await fb();
    const [snapE, snapS, snapA] = await Promise.all([
      F.getDocs(F.collection(db, 'estudiantes')),
      F.getDocs(F.collection(db, 'sellos')),
      F.getDocs(F.collection(db, 'asistencias')),
    ]);
    snapE.forEach((d) => {
      const e = d.data();
      estudiantes[d.id] = { ...e, creadoEn: e.creadoEn?.toMillis?.() ?? null, sellos: {}, asistencias: {} };
    });
    // Un sello o asistencia sin estudiante registrado no debería existir, pero no lo perdemos.
    const de = (uid) => (estudiantes[uid] ??= { nombre: '(sin registro)', sellos: {}, asistencias: {} });
    snapS.forEach((d) => {
      const s = d.data();
      de(s.uid).sellos[s.empresaId] = s.ts?.toMillis?.() ?? Date.now();
    });
    snapA.forEach((d) => {
      const a = d.data();
      de(a.uid).asistencias[a.dia] = { ts: a.ts?.toMillis?.() ?? Date.now() };
    });
  }

  filas = Object.entries(estudiantes).map(([uid, e]) => {
    const n = EMPRESAS.filter((x) => e.sellos[x.id]).length;
    const dias = DIAS.filter((x) => e.asistencias?.[x.id]).length;
    const tipo = tipoDe(e);
    return {
      uid,
      ganador: Boolean(ganadores[uid]),
      tipo,
      vinculo: e.vinculo || '',
      linea: lineaPrograma(e), // programa, o el tipo para quien no es estudiante
      cedula: e.cedula || '',
      facultad: e.facultad || '',
      asistencias: e.asistencias || {},
      mentor: e.mentor || '',
      dias,
      apellidos: e.apellidos || '',
      nombres: e.nombres || e.nombre || '',
      programa: e.programa || '',
      empresa: e.empresa || '',
      contacto: e.contacto || '',
      sellos: e.sellos,
      n,
      // Visitantes y comunidad ITM completan solo con los sellos.
      completo: n >= TOTAL && (!tipo.asistencia || dias >= DIAS.length),
      creadoEn: e.creadoEn,
    };
  });
  filas.sort((a, b) => b.n + b.dias - (a.n + a.dias) || a.apellidos.localeCompare(b.apellidos, 'es'));
  pintar();
}

function filtradas() {
  const q = $('#buscar').value.trim().toLowerCase();
  const f = $('#filtro').value;
  return filas.filter((r) => {
    if (f === 'completos' && !r.completo) return false;
    if (f === 'incompletos' && r.completo) return false;
    const m = $('#filtro-mentor').value;
    if (m && r.mentor !== m) return false;
    const t = $('#filtro-tipo').value;
    if (t && r.tipo.id !== t) return false;
    if (!q) return true;
    return [r.cedula, r.apellidos, r.nombres, r.programa, r.facultad, r.contacto, r.empresa, r.vinculo, r.tipo.nombre, mentorPorId(r.mentor)?.nombre].join(' ').toLowerCase().includes(q);
  });
}

function pintar() {
  const totalSellos = filas.reduce((s, r) => s + r.n, 0);
  $('#r-estudiantes').textContent = filas.length;
  $('#r-sellos').textContent = totalSellos;
  $('#r-completos').textContent = filas.filter((r) => r.completo).length;
  $('#r-asistencia').textContent = filas.filter((r) => r.dias >= DIAS.length).length;
  $('#r-promedio').textContent = filas.length ? (totalSellos / filas.length).toFixed(1) : '0';
  pintarGanadores();

  $('#cabecera').innerHTML =
    '<th>Participante</th><th>Cédula</th><th>Programa / Facultad</th><th>Mentor</th><th>Correo</th><th>Días</th><th>Sellos</th>' +
    `<th>Stands (${EMPRESAS.map(rotuloCorto).join(' ')})</th><th>Completo</th><th>Ficha</th>`;

  const lista = filtradas();
  $('#filas').innerHTML = lista.length
    ? lista
        .map(
          (r) => `<tr>
        <td><b>${escapar(r.apellidos)}</b> ${escapar(r.nombres)}${r.ganador ? ' <span title="Ganó el sorteo">🏆</span>' : ''}<br><small class="tipo-${r.tipo.id}">${escapar(r.tipo.nombre)}</small></td>
        <td>${escapar(r.cedula) || '<span class="falta">falta</span>'}</td>
        <td>${r.tipo.id === 'estudiante'
          ? `${escapar(r.programa)}<br><small>${escapar(r.facultad) || '<span class="falta">sin facultad</span>'}</small>`
          : `${escapar(r.linea)}${r.empresa ? `<br><small>${escapar(r.empresa)}</small>` : ''}`}</td>
        <td>${r.tipo.id !== 'estudiante' ? '—' : escapar(mentorPorId(r.mentor)?.nombre) || '<span class="falta">sin mentor</span>'}</td>
        <td>${escapar(r.contacto)}</td>
        <td>${DIAS.map(
          (d, i) => {
            const a = r.asistencias[d.id];
            const detalle = a ? ` · ${fecha(a.ts)}` : '';
            return `<span class="chip ${a ? 'si dia' : ''}" title="${escapar(d.nombre + detalle)}">D${i + 1}</span>`;
          },
        ).join('')}</td>
        <td class="num">${r.n}/${TOTAL}</td>
        <td>${EMPRESAS.map(
          (e) => `<span class="chip ${r.sellos[e.id] ? 'si' : ''}" title="${escapar(e.nombre)}${r.sellos[e.id] ? ' · ' + fecha(r.sellos[e.id]) : ''}">${rotuloCorto(e)}</span>`,
        ).join('')}</td>
        <td>${r.completo ? '<span class="ok">✓ Sí</span>' : 'No'}</td>
        <td><button class="btn btn-claro ver-btn" type="button" data-uid="${escapar(r.uid)}">Ver</button>${
          r.tipo.constancia && r.dias >= MIN_DIAS_CONSTANCIA
            ? ` <button class="btn btn-claro ver-btn constancia-btn" type="button" data-uid="${escapar(r.uid)}" title="Constancia manual (asistió ${r.dias} días)">Constancia</button>`
            : ''
        }</td>
      </tr>`,
        )
        .join('')
    : '<tr><td colspan="10" style="text-align:center;padding:30px;color:var(--texto-suave)">Sin participantes para mostrar.</td></tr>';
}

// Foto y firma se piden solo al abrir la ficha (viven en fotos/{uid}).
async function abrirFicha(uid) {
  const r = filas.find((x) => x.uid === uid);
  if (!r) return;
  $('#ficha-nombre').textContent = `${r.nombres} ${r.apellidos}`;
  $('#ficha-datos').innerHTML = [
    ['Participa como', r.tipo.nombre],
    ['Cédula', r.cedula || '—'],
    ...(r.tipo.id === 'estudiante'
      ? [['Programa', r.programa], ['Facultad', r.facultad || '—'], ['Mentor', mentorPorId(r.mentor)?.nombre || '—']]
      : r.tipo.id === 'comunidad' ? [['Vínculo', r.vinculo || '—']] : []),
    ['Empresa', r.empresa || '—'],
    ['Contacto', r.contacto],
    ['Días', `${r.dias} de ${DIAS.length}`],
    ['Sellos', `${r.n} de ${TOTAL}`],
    ['Registro', fecha(r.creadoEn)],
  ].map(([k, v]) => `<dt>${k}</dt><dd>${escapar(v)}</dd>`).join('');
  $('#ficha-foto').outerHTML = '<div id="ficha-foto" class="ficha-foto">Cargando…</div>';
  $('#ficha-firma').innerHTML = '';
  $('#dlg-ficha').showModal();

  let img = {};
  try {
    if (DEMO) {
      img = {}; // en la demo la foto y la firma quedan solo en el celular del estudiante
    } else {
      const { db, F } = await fb();
      const snap = await F.getDoc(F.doc(db, 'fotos', uid));
      img = snap.exists() ? snap.data() : {};
    }
  } catch (err) {
    console.error(err);
  }
  $('#ficha-foto').outerHTML = img.foto
    ? `<img id="ficha-foto" class="ficha-foto" src="${img.foto}" alt="Foto de ${escapar(r.nombres)}">`
    : '<div id="ficha-foto" class="ficha-foto">Sin foto</div>';
  $('#ficha-firma').innerHTML = img.firma
    ? `<img class="ficha-firma" src="${img.firma}" alt="Firma">`
    : '<p style="margin:12px 0 0">Sin firma</p>';
}

function exportarCSV() {
  const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const cab = ['Tipo', 'Cédula', 'Apellidos', 'Nombres', 'Correo', 'Programa', 'Facultad', 'Vínculo ITM', 'Empresa', 'Mentor', 'Días',
    ...DIAS.map((d) => `Asistencia ${d.nombre}`), 'Sellos', ...EMPRESAS.map((e) => e.nombre), 'Completo', 'Registro'];
  const lineas = filtradas().map((r) =>
    [r.tipo.nombre, r.cedula, r.apellidos, r.nombres, r.contacto, r.programa, r.facultad, r.vinculo, r.empresa, mentorPorId(r.mentor)?.nombre || '', r.dias,
      ...DIAS.map((d) => fecha(r.asistencias[d.id]?.ts)),
      r.n, ...EMPRESAS.map((e) => fecha(r.sellos[e.id])), r.completo ? 'Sí' : 'No', fecha(r.creadoEn)]
      .map(celda)
      .join(';'),
  );
  // BOM + punto y coma para que Excel en español lo abra con columnas y tildes correctas.
  const blob = new Blob(['﻿' + [cab.map(celda).join(';'), ...lineas].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pasaporte-cuee-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Solo participan estudiantes en pasantía con el pasaporte completo
// (no mentores, visitantes ni comunidad ITM).
function sortear() {
  const completos = filas.filter((r) => r.completo && r.tipo.id === 'estudiante');
  const candidatos = completos.filter((r) => !r.ganador);
  const caja = $('#ganador');
  caja.classList.remove('oculto');
  if (!candidatos.length) {
    caja.innerHTML = completos.length
      ? 'Todos los estudiantes con pasaporte completo ya ganaron. Usa <b>Reiniciar ganadores</b> para volver a sortear entre todos.'
      : 'Aún no hay estudiantes con el pasaporte completo para sortear.';
    return;
  }
  const boton = $('#sortear');
  boton.disabled = true;
  const azar = () => crypto.getRandomValues(new Uint32Array(1))[0] % candidatos.length;
  let vueltas = 0;
  const giro = setInterval(async () => {
    const r = candidatos[azar()];
    caja.innerHTML = `Sorteando entre ${candidatos.length}…<b>${escapar(r.nombres)} ${escapar(r.apellidos)}</b>`;
    if (++vueltas < 18) return;
    clearInterval(giro);
    const g = candidatos[azar()];
    // Empresa de la pasantía en lugar del correo.
    const detalle = [g.programa, g.empresa || 'Sin empresa registrada'].filter(Boolean).map(escapar).join(' · ');
    caja.innerHTML = `🎉 Ganador del sorteo<b>${escapar(g.nombres)} ${escapar(g.apellidos)}</b>${detalle}`;
    try {
      await guardarGanador(g);
      g.ganador = true;
      pintar();
    } catch (err) {
      console.error(err);
      caja.insertAdjacentHTML('beforeend', '<br><small>No se pudo guardar el ganador; podría volver a salir en el próximo sorteo.</small>');
    }
    boton.disabled = false;
  }, 90);
}

async function iniciar() {
  $('#aviso-demo').classList.toggle('oculto', !DEMO);
  try {
    const correo = await organizadorActual();
    if (!correo) return mostrar('#vista-acceso');
    mostrar('#vista-panel');
    await cargar();
  } catch (err) {
    console.error(err);
    $('#error-acceso').textContent = err.message;
    mostrar('#vista-acceso');
  }
}

$('#entrar').addEventListener('click', async () => {
  $('#error-acceso').textContent = '';
  try {
    if (await entrarConGoogle()) {
      mostrar('#vista-panel');
      await cargar();
    }
  } catch (err) {
    console.error(err);
    $('#error-acceso').textContent = err.message;
    await salir().catch(() => {});
  }
});
$('#form-acceso').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const { correo, contrasena } = Object.fromEntries(new FormData(ev.currentTarget));
  $('#error-acceso').textContent = '';
  try {
    if (await entrarConCorreo(correo, contrasena)) {
      mostrar('#vista-panel');
      await cargar();
    }
  } catch (err) {
    console.error(err);
    $('#error-acceso').textContent = err.message;
    if (!err.message.includes('incorrectos') && !err.message.includes('intentos')) await salir().catch(() => {});
  }
});

// ---------- Constancias de mentores ----------
$('#mentor-constancia').innerHTML = MENTORES.map((m) => `<option value="${m.id}">${escapar(m.nombre)}</option>`).join('');

async function descargarConstancias(mentores, archivo) {
  const estado = $('#estado-constancias');
  if (!window.jspdf) return (estado.textContent = 'No cargó el generador de PDF; recarga la página.');
  estado.textContent = 'Generando…';
  try {
    const lienzos = [];
    for (const m of mentores) lienzos.push(await dibujarConstancia('mentor', { nombre: m.nombre }));
    pdfDeLienzos(lienzos, 'Constancias de mentores · Pasantías CUEE 2.0').save(archivo);
    estado.textContent = '';
  } catch (err) {
    console.error(err);
    estado.textContent = 'No se pudo generar el PDF.';
  }
}
$('#constancia-mentor').addEventListener('click', () => {
  const m = mentorPorId($('#mentor-constancia').value);
  descargarConstancias([m], `${nombreArchivo(`Constancia Mentor CUEE 2.0 - ${m.nombre}`)}.pdf`);
});
$('#constancias-todas').addEventListener('click', () => descargarConstancias(MENTORES, 'Constancias Mentores CUEE 2.0.pdf'));

$('#salir').addEventListener('click', async () => {
  await salir();
  mostrar('#vista-acceso');
});
$('#recargar').addEventListener('click', () => cargar().catch((err) => alert(err.message)));
$('#buscar').addEventListener('input', pintar);
$('#filtro').addEventListener('change', pintar);
$('#filtro-mentor').insertAdjacentHTML('beforeend', MENTORES.map((m) => `<option value="${m.id}">${escapar(m.nombre)}</option>`).join(''));
$('#filtro-mentor').addEventListener('change', pintar);
$('#filtro-tipo').insertAdjacentHTML('beforeend', TIPOS.map((t) => `<option value="${t.id}">${escapar(t.nombre)}</option>`).join(''));
$('#filtro-tipo').addEventListener('change', pintar);
$('#csv').addEventListener('click', exportarCSV);
$('#sortear').addEventListener('click', sortear);
$('#reiniciar-ganadores').addEventListener('click', async () => {
  if (!confirm('¿Reiniciar los ganadores? Todos los estudiantes con pasaporte completo vuelven a participar en el sorteo.')) return;
  try {
    await reiniciarGanadores();
    for (const r of filas) r.ganador = false;
    $('#ganador').classList.add('oculto');
    pintar();
  } catch (err) {
    console.error(err);
    alert('No se pudieron reiniciar los ganadores.');
  }
});
$('#filas').addEventListener('click', (ev) => {
  const c = ev.target.closest('.constancia-btn');
  if (c) return constanciaEstudiantes([filas.find((r) => r.uid === c.dataset.uid)]);
  const b = ev.target.closest('.ver-btn');
  if (b) abrirFicha(b.dataset.uid);
});

// Constancias manuales: los organizadores las generan para quien asistió al
// menos MIN_DIAS_CONSTANCIA días, aunque no tenga todos los sellos.
async function constanciaEstudiantes(lista) {
  const estado = $('#estado-constancias-est');
  if (!lista.length) return (estado.textContent = `Nadie con ${MIN_DIAS_CONSTANCIA} o más días en la lista actual.`);
  if (!window.jspdf) return (estado.textContent = 'No cargó el generador de PDF; recarga la página.');
  estado.textContent = `Generando ${lista.length}…`;
  try {
    const lienzos = [];
    for (const r of lista) {
      // Mentores registrados: plantilla de mentor (sin cédula).
      lienzos.push(await dibujarConstancia(r.tipo.constancia, { nombre: `${r.nombres} ${r.apellidos}`, cedula: r.cedula }));
    }
    const archivo = lista.length === 1
      ? nombreArchivo(`Constancia CUEE 2.0 - ${lista[0].nombres} ${lista[0].apellidos}`)
      : `Constancias estudiantes CUEE 2.0 (${lista.length})`;
    pdfDeLienzos(lienzos, 'Constancias de abordaje y participación · Pasantías CUEE 2.0').save(`${archivo}.pdf`);
    estado.textContent = '';
  } catch (err) {
    console.error(err);
    estado.textContent = 'No se pudo generar el PDF.';
  }
}
$('#constancias-estudiantes').addEventListener('click', () => {
  constanciaEstudiantes(filtradas().filter((r) => r.tipo.id === 'estudiante' && r.dias >= MIN_DIAS_CONSTANCIA));
});

iniciar();

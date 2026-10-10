import { DEMO, fb, local } from './firebase.js';
import { organizadorActual, entrarConGoogle, salir } from './admin-auth.js';
import { EMPRESAS, TOTAL } from './empresas.js';

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

const fecha = (ms) => (ms ? new Date(ms).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '');

async function cargar() {
  const estudiantes = {};
  if (DEMO) {
    const perfil = local.get('cue.perfil');
    if (perfil) {
      estudiantes.demo = { ...perfil, sellos: local.get('cue.demo.sellos', {}), creadoEn: perfil.creadoEn };
    }
  } else {
    const { db, F } = await fb();
    const [snapE, snapS] = await Promise.all([
      F.getDocs(F.collection(db, 'estudiantes')),
      F.getDocs(F.collection(db, 'sellos')),
    ]);
    snapE.forEach((d) => {
      const e = d.data();
      estudiantes[d.id] = { ...e, creadoEn: e.creadoEn?.toMillis?.() ?? null, sellos: {} };
    });
    snapS.forEach((d) => {
      const s = d.data();
      // Un sello sin estudiante registrado no debería existir, pero no lo perdemos.
      estudiantes[s.uid] ??= { nombre: '(sin registro)', sellos: {} };
      estudiantes[s.uid].sellos[s.empresaId] = s.ts?.toMillis?.() ?? Date.now();
    });
  }

  filas = Object.entries(estudiantes).map(([uid, e]) => {
    const n = EMPRESAS.filter((x) => e.sellos[x.id]).length;
    return {
      uid,
      apellidos: e.apellidos || '',
      nombres: e.nombres || e.nombre || '',
      programa: e.programa || '',
      empresa: e.empresa || '',
      contacto: e.contacto || '',
      sellos: e.sellos,
      n,
      completo: n >= TOTAL,
      creadoEn: e.creadoEn,
    };
  });
  filas.sort((a, b) => b.n - a.n || a.apellidos.localeCompare(b.apellidos, 'es'));
  pintar();
}

function filtradas() {
  const q = $('#buscar').value.trim().toLowerCase();
  const f = $('#filtro').value;
  return filas.filter((r) => {
    if (f === 'completos' && !r.completo) return false;
    if (f === 'incompletos' && r.completo) return false;
    if (!q) return true;
    return [r.apellidos, r.nombres, r.programa, r.contacto, r.empresa].join(' ').toLowerCase().includes(q);
  });
}

function pintar() {
  const totalSellos = filas.reduce((s, r) => s + r.n, 0);
  $('#r-estudiantes').textContent = filas.length;
  $('#r-sellos').textContent = totalSellos;
  $('#r-completos').textContent = filas.filter((r) => r.completo).length;
  $('#r-promedio').textContent = filas.length ? (totalSellos / filas.length).toFixed(1) : '0';

  $('#cabecera').innerHTML =
    '<th>Estudiante</th><th>Programa</th><th>Contacto</th><th>Sellos</th>' +
    `<th>Destinos (${EMPRESAS.map((e) => e.destino).join(' ')})</th><th>Completo</th>`;

  const lista = filtradas();
  $('#filas').innerHTML = lista.length
    ? lista
        .map(
          (r) => `<tr>
        <td><b>${escapar(r.apellidos)}</b> ${escapar(r.nombres)}</td>
        <td>${escapar(r.programa)}</td>
        <td>${escapar(r.contacto)}</td>
        <td class="num">${r.n}/${TOTAL}</td>
        <td>${EMPRESAS.map(
          (e) => `<span class="chip ${r.sellos[e.id] ? 'si' : ''}" title="${escapar(e.nombre)}${r.sellos[e.id] ? ' · ' + fecha(r.sellos[e.id]) : ''}">${e.destino}</span>`,
        ).join('')}</td>
        <td>${r.completo ? '<span class="ok">✓ Sí</span>' : 'No'}</td>
      </tr>`,
        )
        .join('')
    : '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--texto-suave)">Sin estudiantes para mostrar.</td></tr>';
}

function exportarCSV() {
  const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const cab = ['Apellidos', 'Nombres', 'Programa', 'Empresa', 'Contacto', 'Sellos', 'Completo', ...EMPRESAS.map((e) => e.nombre), 'Registro'];
  const lineas = filtradas().map((r) =>
    [r.apellidos, r.nombres, r.programa, r.empresa, r.contacto, r.n, r.completo ? 'Sí' : 'No', ...EMPRESAS.map((e) => fecha(r.sellos[e.id])), fecha(r.creadoEn)]
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

function sortear() {
  const candidatos = filas.filter((r) => r.completo);
  const caja = $('#ganador');
  caja.classList.remove('oculto');
  if (!candidatos.length) {
    caja.innerHTML = 'Aún no hay pasaportes completos para sortear.';
    return;
  }
  const azar = () => crypto.getRandomValues(new Uint32Array(1))[0] % candidatos.length;
  let vueltas = 0;
  const giro = setInterval(() => {
    const r = candidatos[azar()];
    caja.innerHTML = `Sorteando entre ${candidatos.length}…<b>${escapar(r.nombres)} ${escapar(r.apellidos)}</b>`;
    if (++vueltas >= 18) {
      clearInterval(giro);
      const g = candidatos[azar()];
      caja.innerHTML = `🎉 Ganador del sorteo<b>${escapar(g.nombres)} ${escapar(g.apellidos)}</b>${escapar(g.programa)} · ${escapar(g.contacto)}`;
    }
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
$('#salir').addEventListener('click', async () => {
  await salir();
  mostrar('#vista-acceso');
});
$('#recargar').addEventListener('click', () => cargar().catch((err) => alert(err.message)));
$('#buscar').addEventListener('input', pintar);
$('#filtro').addEventListener('change', pintar);
$('#csv').addEventListener('click', exportarCSV);
$('#sortear').addEventListener('click', sortear);

iniciar();

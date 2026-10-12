// Borra los datos de los estudiantes para empezar pruebas desde cero.
//
// Borra: estudiantes, sellos, asistencias, fotos, ganadores del sorteo y (opcional) las cuentas de
// Firebase Authentication de los estudiantes.
// Conserva: empresas y dias (tokens de los QR impresos y ventanas) y las
// cuentas de los organizadores (ADMINS de js/firebase-config.js y los UID
// de esAdmin() en firestore.rules).
//
// Uso:   node tools/limpiar-datos.mjs [--cuentas] [--simular] [--proyecto=sandbox-pasaporte]
// Credenciales: GOOGLE_APPLICATION_CREDENTIALS con la cuenta de servicio, o
// FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST para el emulador.
// Pensado para el workflow .github/workflows/limpiar-datos.yml.
import { readFileSync } from 'node:fs';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const COLECCIONES = ['estudiantes', 'sellos', 'asistencias', 'fotos', 'ganadores'];
const args = new Set(process.argv.slice(2));
const SIMULAR = args.has('--simular');
const CUENTAS = args.has('--cuentas');
const PROYECTO = [...args].find((a) => a.startsWith('--proyecto='))?.slice(11) || 'pasaporte-itm';

const raiz = new URL('../', import.meta.url);
const correosAdmin = [...readFileSync(new URL('js/firebase-config.js', raiz), 'utf8')
  .match(/ADMINS = \[([\s\S]*?)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1].toLowerCase());
const uidsAdmin = [...(readFileSync(new URL('firestore.rules', raiz), 'utf8')
  .match(/request\.auth\.uid in \[(.*?)\]/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);

const emulador = process.env.FIRESTORE_EMULATOR_HOST;
initializeApp(emulador ? { projectId: PROYECTO } : { credential: applicationDefault(), projectId: PROYECTO });
const db = getFirestore();

console.log(`${SIMULAR ? 'SIMULACIÓN — no se borra nada' : 'BORRANDO'} en ${emulador ? `el emulador ${emulador}` : `el proyecto ${PROYECTO}`}`);
console.log(`Organizadores que se conservan: ${correosAdmin.join(', ')}${uidsAdmin.length ? ` + ${uidsAdmin.length} UID` : ''}\n`);

for (const nombre of COLECCIONES) {
  const ref = db.collection(nombre);
  const total = (await ref.count().get()).data().count;
  if (!SIMULAR && total) await db.recursiveDelete(ref);
  console.log(`  ${nombre.padEnd(12)} ${total} documento(s)${SIMULAR ? '' : ' borrados'}`);
}

if (CUENTAS) {
  const auth = getAuth();
  const borrar = [];
  let conservadas = 0;
  let pagina;
  do {
    const lote = await auth.listUsers(1000, pagina);
    for (const u of lote.users) {
      const esAdmin = uidsAdmin.includes(u.uid) || correosAdmin.includes(String(u.email || '').toLowerCase());
      if (esAdmin) conservadas++;
      else borrar.push(u.uid);
    }
    pagina = lote.pageToken;
  } while (pagina);
  if (!SIMULAR) {
    for (let i = 0; i < borrar.length; i += 1000) {
      const r = await auth.deleteUsers(borrar.slice(i, i + 1000));
      if (r.failureCount) console.log(`  ${r.failureCount} cuenta(s) no se pudieron borrar`, r.errors.slice(0, 3));
    }
  }
  console.log(`  cuentas       ${borrar.length} de estudiantes${SIMULAR ? '' : ' borradas'}, ${conservadas} de organizadores conservadas`);
} else {
  console.log('  cuentas       no se tocaron (usa --cuentas para borrarlas)');
}

console.log('\nListo. Los estudiantes que tengan el pasaporte abierto deben cerrar sesión o borrar los datos del sitio en su navegador.');

// Pruebas de firestore.rules contra el emulador de Firestore.
// Uso (desde la raíz): npx firebase-tools emulators:exec --only firestore "node pruebas/reglas.test.mjs"
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';

// Se agrega un UID de prueba a la lista de administradores por UID.
const reglas = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
  .replace('/*ADMIN_UIDS*/', "/*ADMIN_UIDS*/'UIDadminPrueba', ");

const env = await initializeTestEnvironment({
  projectId: 'pasaporte-itm',
  firestore: { rules: reglas, host: '127.0.0.1', port: 8085 },
});

const resultados = [];
async function prueba(nombre, promesa) {
  try {
    await promesa;
    resultados.push([true, nombre]);
  } catch (err) {
    resultados.push([false, `${nombre} — ${err.message.split('\n')[0]}`]);
  }
}

const hora = 3600e3;
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'empresas/epm'), { token: 'T-EPM' });
  await setDoc(doc(db, 'empresas/viajemos'), { token: 'T-VJ' });
  await setDoc(doc(db, 'dias/dia1'), { token: 'T-D1', inicio: Timestamp.fromMillis(Date.now() - hora), fin: Timestamp.fromMillis(Date.now() + hora) });
  await setDoc(doc(db, 'dias/dia2'), { token: 'T-D2', inicio: Timestamp.fromMillis(Date.now() + 20 * hora), fin: Timestamp.fromMillis(Date.now() + 44 * hora) });
  // Estudiante registrado antes de pedir cédula y facultad.
  await setDoc(doc(db, 'estudiantes/viejo'), { nombres: 'M', apellidos: 'M', nombre: 'M M', programa: 'P', empresa: '', contacto: 'a@b.co', notas: {}, creadoEn: Timestamp.now() });
});

const ctx = (uid, token) => env.authenticatedContext(uid, token).firestore();
const ana = ctx('ana', { email: 'ana@x.co', email_verified: false });
const viejo = ctx('viejo');
const otro = ctx('otro');
const adminGoogle = ctx('adm', { email: 'hahiguit@gmail.com', email_verified: true });
const adminUid = ctx('UIDadminPrueba', { email: 'angelagil@itm.edu.co', email_verified: false });
const correoAdminSinVerificar = ctx('falso', { email: 'hahiguit@gmail.com', email_verified: false });
const impostor = ctx('UIDotro', { email: 'angelagil@itm.edu.co', email_verified: true });
const perfil = {
  cedula: '1036123456', nombres: 'Ana', apellidos: 'Ruiz', nombre: 'Ana Ruiz', programa: 'P',
  facultad: 'Facultad de Ingenierías', empresa: '', contacto: 'ana@x.co', mentor: 'german-cano',
  autorizaDatos: true, notas: {}, creadoEn: serverTimestamp(),
};
const asistencia = (uid, dia, token = { dia1: 'T-D1', dia2: 'T-D2' }[dia]) => ({ uid, dia, token, ts: serverTimestamp() });

// Estudiantes
await prueba('registro completo', assertSucceeds(setDoc(doc(ana, 'estudiantes/ana'), perfil)));
await prueba('autorizaDatos false rechazado', assertFails(setDoc(doc(ctx('n2'), 'estudiantes/n2'), { ...perfil, autorizaDatos: false })));
await prueba('cédula con letras rechazada', assertFails(updateDoc(doc(ana, 'estudiantes/ana'), { cedula: '12a' })));
await prueba('estudiante antiguo guarda nota sin cédula', assertSucceeds(updateDoc(doc(viejo, 'estudiantes/viejo'), { 'notas.epm': 'hola' })));
await prueba('estudiante antiguo completa cédula y facultad', assertSucceeds(updateDoc(doc(viejo, 'estudiantes/viejo'), { cedula: '987654', facultad: 'Facultad de Ingenierías' })));
await prueba('otro no lee a ana', assertFails(getDoc(doc(otro, 'estudiantes/ana'))));
// Mentores, visitantes de empresa y comunidad ITM
const sinPrograma = { ...perfil, programa: '', facultad: '' };
delete sinPrograma.mentor;
await prueba('registro de mentor', assertSucceeds(setDoc(doc(ctx('m1'), 'estudiantes/m1'), { ...sinPrograma, tipo: 'mentor' })));
await prueba('registro de visitante de empresa', assertSucceeds(setDoc(doc(ctx('v1'), 'estudiantes/v1'), { ...sinPrograma, tipo: 'visitante', empresa: 'EPM' })));
await prueba('registro de comunidad ITM con vínculo', assertSucceeds(setDoc(doc(ctx('c1'), 'estudiantes/c1'), { ...sinPrograma, tipo: 'comunidad', vinculo: 'Docente' })));
await prueba('tipo desconocido rechazado', assertFails(setDoc(doc(ctx('x1'), 'estudiantes/x1'), { ...perfil, tipo: 'admin' })));
await prueba('vínculo demasiado largo rechazado', assertFails(setDoc(doc(ctx('c2'), 'estudiantes/c2'), { ...sinPrograma, tipo: 'comunidad', vinculo: 'x'.repeat(61) })));
// Sellos
await prueba('sello con token correcto', assertSucceeds(setDoc(doc(ana, 'sellos/ana_epm'), { uid: 'ana', empresaId: 'epm', token: 'T-EPM', ts: serverTimestamp() })));
await prueba('sello del stand Viajemos juntos', assertSucceeds(setDoc(doc(ana, 'sellos/ana_viajemos'), { uid: 'ana', empresaId: 'viajemos', token: 'T-VJ', ts: serverTimestamp() })));
await prueba('sello con token malo', assertFails(setDoc(doc(viejo, 'sellos/viejo_epm'), { uid: 'viejo', empresaId: 'epm', token: 'X', ts: serverTimestamp() })));
await prueba('sello repetido rechazado', assertFails(setDoc(doc(ana, 'sellos/ana_epm'), { uid: 'ana', empresaId: 'epm', token: 'T-EPM', ts: serverTimestamp() })));
await prueba('get de sello inexistente propio', assertSucceeds(getDoc(doc(ana, 'sellos/ana_isa'))));
// Asistencia
await prueba('asistencia del día vigente', assertSucceeds(setDoc(doc(ana, 'asistencias/ana_dia1'), asistencia('ana', 'dia1'))));
await prueba('asistencia repetida rechazada', assertFails(setDoc(doc(ana, 'asistencias/ana_dia1'), asistencia('ana', 'dia1'))));
await prueba('asistencia de otro día rechazada', assertFails(setDoc(doc(ana, 'asistencias/ana_dia2'), asistencia('ana', 'dia2'))));
await prueba('asistencia con token malo rechazada', assertFails(setDoc(doc(viejo, 'asistencias/viejo_dia1'), asistencia('viejo', 'dia1', 'X'))));
await prueba('asistencia con el token de otro día rechazada', assertFails(setDoc(doc(viejo, 'asistencias/viejo_dia1'), asistencia('viejo', 'dia1', 'T-D2'))));
await prueba('asistencia de un día inexistente rechazada', assertFails(setDoc(doc(viejo, 'asistencias/viejo_dia9'), asistencia('viejo', 'dia9', 'T-D1'))));
await prueba('asistencia con campos extra rechazada', assertFails(setDoc(doc(viejo, 'asistencias/viejo_dia1'), { ...asistencia('viejo', 'dia1'), mentor: 'x' })));
await prueba('viejo marca asistencia con el QR del día', assertSucceeds(setDoc(doc(viejo, 'asistencias/viejo_dia1'), asistencia('viejo', 'dia1'))));
await prueba('asistencia sin registro rechazada', assertFails(setDoc(doc(otro, 'asistencias/otro_dia1'), asistencia('otro', 'dia1'))));
await prueba('lista de mis asistencias', assertSucceeds(getDocs(query(collection(ana, 'asistencias'), where('uid', '==', 'ana')))));
await prueba('estudiante no lee tokens de días', assertFails(getDoc(doc(ana, 'dias/dia1'))));
await prueba('estudiante no lee tokens de stands', assertFails(getDoc(doc(ana, 'empresas/epm'))));
// Foto y firma
await prueba('foto propia', assertSucceeds(setDoc(doc(ana, 'fotos/ana'), { foto: 'data:image/jpeg;base64,AAA', actualizado: serverTimestamp() }, { merge: true })));
await prueba('firma propia (merge)', assertSucceeds(setDoc(doc(ana, 'fotos/ana'), { firma: 'data:image/png;base64,BBB', actualizado: serverTimestamp() }, { merge: true })));
await prueba('otro no lee la foto de ana', assertFails(getDoc(doc(otro, 'fotos/ana'))));
// Organizadores
await prueba('admin de Google lee todo', assertSucceeds(Promise.all([
  getDocs(collection(adminGoogle, 'estudiantes')), getDocs(collection(adminGoogle, 'asistencias')),
  getDocs(collection(adminGoogle, 'sellos')), getDoc(doc(adminGoogle, 'fotos/ana')), getDoc(doc(adminGoogle, 'dias/dia1')),
])));
await prueba('admin por UID lee estudiantes', assertSucceeds(getDocs(collection(adminUid, 'estudiantes'))));
await prueba('admin escribe tokens', assertSucceeds(setDoc(doc(adminUid, 'dias/dia3'), { token: 'T' })));
await prueba('correo de admin sin verificar no es admin', assertFails(getDocs(collection(correoAdminSinVerificar, 'estudiantes'))));
await prueba('mismo correo con otro UID no es admin', assertFails(getDocs(collection(impostor, 'estudiantes'))));

await env.cleanup();
for (const [ok, nombre] of resultados) console.log(`${ok ? '✓' : '✗'} ${nombre}`);
const fallas = resultados.filter(([ok]) => !ok).length;
console.log(`\n${resultados.length - fallas} de ${resultados.length} pruebas pasaron`);
process.exit(fallas ? 1 : 0);

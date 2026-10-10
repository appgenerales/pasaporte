import { DEMO, fb, local } from './firebase.js';
import { usuarioActual } from './auth.js';
import { empresaPorId, mentorPorId, diaDeHoy, DIAS, fechaLarga } from './empresas.js';

// En modo demo cada cuenta guarda lo suyo aparte.
const demo = (k) => `${k}.${local.get('cue.demo.uid')}`;
const K_DEMO_SELLOS = 'cue.demo.sellos';
const K_CACHE = 'cue.sellos';
const K_DEMO_ASIS = 'cue.demo.asistencias';
const K_CACHE_ASIS = 'cue.asistencias';

export class ErrorSello extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.codigo = codigo;
  }
}

// R3: registra el sello. Devuelve 'nuevo' o 'repetido'.
// Las reglas de Firestore validan uid, empresa y token; aquí solo damos buenos mensajes.
export async function sellar(empresaId, token) {
  if (!empresaPorId(empresaId) || !token) {
    throw new ErrorSello('qr', 'Este código QR no pertenece al pasaporte CUEE 2.0.');
  }
  const uid = await usuarioActual();
  if (!uid) throw new ErrorSello('sesion', 'Primero debes registrarte.');

  if (DEMO) {
    if (token !== `demo-${empresaId}`) {
      throw new ErrorSello('token', 'El código del stand no es válido. Pide a la empresa que te muestre el QR vigente.');
    }
    const sellos = local.get(demo(K_DEMO_SELLOS), {});
    if (sellos[empresaId]) return 'repetido';
    sellos[empresaId] = Date.now();
    local.set(demo(K_DEMO_SELLOS), sellos);
    return 'nuevo';
  }

  const { db, F } = await fb();
  const ref = F.doc(db, 'sellos', `${uid}_${empresaId}`);
  const previo = await F.getDoc(ref);
  if (previo.exists()) return 'repetido';
  try {
    await F.setDoc(ref, { uid, empresaId, token, ts: F.serverTimestamp() });
  } catch (err) {
    if (err.code === 'permission-denied') {
      throw new ErrorSello('token', 'El código del stand no es válido. Pide a la empresa que te muestre el QR vigente.');
    }
    throw new ErrorSello('red', 'No pudimos registrar el sello. Revisa tu conexión e inténtalo de nuevo.');
  }
  return 'nuevo';
}

// R2: { empresaId: fecha(ms) } con los sellos del estudiante actual.
export async function misSellos() {
  if (DEMO) return local.get(demo(K_DEMO_SELLOS), {});
  const uid = await usuarioActual();
  if (!uid) return {};
  try {
    const { db, F } = await fb();
    const q = F.query(F.collection(db, 'sellos'), F.where('uid', '==', uid));
    const snap = await F.getDocs(q);
    const sellos = {};
    snap.forEach((d) => {
      const s = d.data();
      sellos[s.empresaId] = s.ts ? s.ts.toMillis() : Date.now();
    });
    local.set(K_CACHE, sellos);
    return sellos;
  } catch (err) {
    console.warn('Sin conexión, uso los sellos guardados', err);
    return local.get(K_CACHE, {});
  }
}

// ---------- Asistencia a los días del evento ----------
// Se marca con el QR de un mentor: asistencias/{uid}_{dia} guarda el día en
// curso y el mentor. Las reglas exigen el token del mentor y que la hora del
// servidor esté dentro del día (dias/{dia}.inicio … fin).
// Devuelve { estado: 'nuevo' | 'repetido', dia }.
export async function registrarAsistencia(mentorId, token) {
  const mentor = mentorPorId(mentorId);
  if (!mentor || !token) {
    throw new ErrorSello('qr', 'Este código QR no pertenece al CUEE 2.0.');
  }
  const uid = await usuarioActual();
  if (!uid) throw new ErrorSello('sesion', 'Primero debes registrarte.');

  let dia = diaDeHoy();
  if (DEMO) {
    if (token !== `demo-${mentorId}`) throw new ErrorSello('token', 'El código del mentor no es válido.');
    const asis = local.get(demo(K_DEMO_ASIS), {});
    // En la demo, fuera de las fechas se usa el primer día pendiente para poder probar.
    dia = dia || DIAS.find((d) => !asis[d.id]) || DIAS[DIAS.length - 1];
    if (asis[dia.id]) return { estado: 'repetido', dia };
    asis[dia.id] = { ts: Date.now(), mentor: mentorId };
    local.set(demo(K_DEMO_ASIS), asis);
    return { estado: 'nuevo', dia };
  }

  if (!dia) {
    const [primero, ultimo] = [DIAS[0], DIAS[DIAS.length - 1]];
    throw new ErrorSello('fecha', `La asistencia se registra del ${fechaLarga(primero.fecha)} al ${fechaLarga(ultimo.fecha)}.`);
  }
  const { db, F } = await fb();
  const ref = F.doc(db, 'asistencias', `${uid}_${dia.id}`);
  if ((await F.getDoc(ref)).exists()) return { estado: 'repetido', dia };
  try {
    await F.setDoc(ref, { uid, dia: dia.id, mentor: mentorId, token, ts: F.serverTimestamp() });
  } catch (err) {
    if (err.code === 'permission-denied') {
      throw new ErrorSello('token', 'El código del mentor no es válido. Pide a tu mentor el QR vigente.');
    }
    throw new ErrorSello('red', 'No pudimos registrar tu asistencia. Revisa tu conexión e inténtalo de nuevo.');
  }
  return { estado: 'nuevo', dia };
}

// { diaId: fecha(ms) } con las asistencias del estudiante actual.
export async function misAsistencias() {
  if (DEMO) {
    const asis = local.get(demo(K_DEMO_ASIS), {});
    return Object.fromEntries(Object.entries(asis).map(([d, v]) => [d, v.ts ?? v]));
  }
  const uid = await usuarioActual();
  if (!uid) return {};
  try {
    const { db, F } = await fb();
    const snap = await F.getDocs(F.query(F.collection(db, 'asistencias'), F.where('uid', '==', uid)));
    const asis = {};
    snap.forEach((d) => {
      const a = d.data();
      asis[a.dia] = a.ts ? a.ts.toMillis() : Date.now();
    });
    local.set(K_CACHE_ASIS, asis);
    return asis;
  } catch (err) {
    console.warn('Sin conexión, uso las asistencias guardadas', err);
    return local.get(K_CACHE_ASIS, {});
  }
}

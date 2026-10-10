import { DEMO, fb, local } from './firebase.js';
import { usuarioActual } from './auth.js';
import { empresaPorId } from './empresas.js';

const K_DEMO_SELLOS = 'cue.demo.sellos';
const K_CACHE = 'cue.sellos';

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
    const sellos = local.get(K_DEMO_SELLOS, {});
    if (sellos[empresaId]) return 'repetido';
    sellos[empresaId] = Date.now();
    local.set(K_DEMO_SELLOS, sellos);
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
  if (DEMO) return local.get(K_DEMO_SELLOS, {});
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

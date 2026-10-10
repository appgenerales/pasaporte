import { DEMO, fb, local } from './firebase.js';

const K_PERFIL = 'cue.perfil';
const K_DEMO_UID = 'cue.demo.uid';
const K_FOTO = 'cue.foto';
const K_FIRMA = 'cue.firma';
const K_PENDIENTE = 'cue.pendiente';

// Espera a que Firebase Auth restaure la sesión guardada en el dispositivo.
export async function usuarioActual() {
  if (DEMO) return local.get(K_DEMO_UID);
  const { auth } = await fb();
  await auth.authStateReady();
  return auth.currentUser ? auth.currentUser.uid : null;
}

async function asegurarSesion() {
  if (DEMO) {
    let uid = local.get(K_DEMO_UID);
    if (!uid) {
      uid = 'demo' + crypto.getRandomValues(new Uint32Array(2)).join('');
      local.set(K_DEMO_UID, uid);
    }
    return uid;
  }
  const { auth, A } = await fb();
  await auth.authStateReady();
  if (!auth.currentUser) await A.signInAnonymously(auth);
  return auth.currentUser.uid;
}

function limpiar(datos) {
  const t = (v, max) => String(v || '').trim().replace(/\s+/g, ' ').slice(0, max);
  const nombres = t(datos.nombres, 80);
  const apellidos = t(datos.apellidos, 80);
  return {
    nombres,
    apellidos,
    nombre: `${nombres} ${apellidos}`.trim(),
    programa: t(datos.programa, 120),
    empresa: t(datos.empresa, 120),
    contacto: t(datos.contacto, 120),
  };
}

// R1: registro único. Crea la sesión anónima y el documento estudiantes/{uid}.
export async function registrar(datos) {
  const uid = await asegurarSesion();
  const perfil = limpiar(datos);
  if (DEMO) {
    local.set(K_PERFIL, { ...perfil, notas: {}, creadoEn: Date.now() });
    return uid;
  }
  const { db, F } = await fb();
  await F.setDoc(F.doc(db, 'estudiantes', uid), { ...perfil, notas: {}, creadoEn: F.serverTimestamp() });
  local.set(K_PERFIL, { ...perfil, notas: {} });
  return uid;
}

// Devuelve el perfil o null si el estudiante aún no se registra.
// Usa la copia local para pintar rápido y la refresca desde Firestore.
export async function leerPerfil({ soloCache = false } = {}) {
  const uid = await usuarioActual();
  if (!uid) return null;
  const cache = local.get(K_PERFIL);
  if (DEMO || soloCache) return cache;
  try {
    const { db, F } = await fb();
    const snap = await F.getDoc(F.doc(db, 'estudiantes', uid));
    if (!snap.exists()) {
      local.borrar(K_PERFIL);
      return null;
    }
    const { creadoEn, ...perfil } = snap.data();
    local.set(K_PERFIL, perfil);
    return perfil;
  } catch (err) {
    console.warn('Sin conexión, uso el perfil guardado', err);
    return cache;
  }
}

export async function actualizarPerfil(datos) {
  const uid = await usuarioActual();
  const perfil = limpiar(datos);
  const actual = local.get(K_PERFIL) || {};
  local.set(K_PERFIL, { ...actual, ...perfil });
  if (DEMO) return;
  const { db, F } = await fb();
  await F.updateDoc(F.doc(db, 'estudiantes', uid), perfil);
}

// "Lo más importante que descubrí", una nota por empresa.
export async function guardarNota(empresaId, texto) {
  const uid = await usuarioActual();
  const valor = String(texto || '').slice(0, 280);
  const actual = local.get(K_PERFIL) || {};
  local.set(K_PERFIL, { ...actual, notas: { ...(actual.notas || {}), [empresaId]: valor } });
  if (DEMO) return;
  const { db, F } = await fb();
  await F.updateDoc(F.doc(db, 'estudiantes', uid), { [`notas.${empresaId}`]: valor });
}

// La foto y la firma se quedan solo en el dispositivo: no se suben a ningún servidor.
export const foto = {
  leer: () => local.get(K_FOTO),
  guardar: (dataUrl) => local.set(K_FOTO, dataUrl),
};
export const firma = {
  leer: () => local.get(K_FIRMA),
  guardar: (dataUrl) => local.set(K_FIRMA, dataUrl),
  borrar: () => local.borrar(K_FIRMA),
};

// Sello escaneado antes de registrarse: se aplica al terminar el registro.
export const pendiente = {
  leer: () => local.get(K_PENDIENTE),
  guardar: (e, t) => local.set(K_PENDIENTE, { e, t }),
  borrar: () => local.borrar(K_PENDIENTE),
};

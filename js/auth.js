import { DEMO, fb, local } from './firebase.js';

const K_PERFIL = 'cue.perfil';
const K_DEMO_UID = 'cue.demo.uid';
const K_DEMO_CUENTAS = 'cue.demo.cuentas';
const K_FOTO = 'cue.foto';
const K_FIRMA = 'cue.firma';
const K_PENDIENTE = 'cue.pendiente';
// Copias locales del usuario con sesión; se borran al entrar o salir.
const CACHES = [K_PERFIL, K_FOTO, K_FIRMA, 'cue.sellos', 'cue.asistencias'];

// En modo demo cada cuenta guarda su perfil aparte; con Firebase es solo caché.
const kPerfil = () => (DEMO ? `cue.demo.perfil.${local.get(K_DEMO_UID)}` : K_PERFIL);

export class ErrorCuenta extends Error {}

function mensajeAuth(err) {
  const c = err?.code || '';
  if (c.includes('email-already-in-use') || c.includes('credential-already-in-use')) return 'Ese correo ya tiene pasaporte. Entra con tu contraseña.';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found') || c.includes('invalid-login')) return 'Correo o contraseña incorrectos.';
  if (c.includes('invalid-email')) return 'Revisa el correo electrónico.';
  if (c.includes('weak-password')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (c.includes('too-many-requests')) return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
  if (c.includes('network')) return 'Sin conexión. Revisa tu internet.';
  if (c.includes('operation-not-allowed')) return 'El inicio con correo no está activado en Firebase (Authentication > Correo/contraseña).';
  return 'No pudimos completar la operación. Inténtalo de nuevo.';
}

// sha256 en hexadecimal (solo para las cuentas del modo demo; Firebase cifra
// las contraseñas reales en su servidor).
async function sha256(texto) {
  const datos = new TextEncoder().encode(texto);
  const hash = await crypto.subtle.digest('SHA-256', datos);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function limpiarCaches() {
  CACHES.forEach((k) => local.borrar(k));
}

// Espera a que Firebase Auth restaure la sesión guardada en el dispositivo.
export async function usuarioActual() {
  if (DEMO) return local.get(K_DEMO_UID);
  const { auth } = await fb();
  await auth.authStateReady();
  return auth.currentUser ? auth.currentUser.uid : null;
}

// Sesiones anónimas de la primera versión: deben crear contraseña.
export async function esAnonimo() {
  if (DEMO) return false;
  const { auth } = await fb();
  await auth.authStateReady();
  return Boolean(auth.currentUser?.isAnonymous);
}

function limpiar(datos) {
  const t = (v, max) => String(v || '').trim().replace(/\s+/g, ' ').slice(0, max);
  const nombres = t(datos.nombres, 80);
  const apellidos = t(datos.apellidos, 80);
  const perfil = {
    cedula: String(datos.cedula || '').replace(/\D/g, '').slice(0, 15),
    nombres,
    apellidos,
    nombre: `${nombres} ${apellidos}`.trim(),
    programa: t(datos.programa, 120),
    facultad: t(datos.facultad, 120),
    empresa: t(datos.empresa, 120),
    contacto: t(datos.contacto, 120).toLowerCase(), // correo
  };
  if (datos.mentor) perfil.mentor = t(datos.mentor, 60);
  if (datos.autorizaDatos === true) perfil.autorizaDatos = true; // Ley 1581 de 2012
  return perfil;
}

// R1: registro único con correo y contraseña. Crea estudiantes/{uid}.
export async function registrar(datos, contrasena) {
  const perfil = limpiar(datos);
  if (DEMO) {
    const cuentas = local.get(K_DEMO_CUENTAS, {});
    if (cuentas[perfil.contacto]) throw new ErrorCuenta('Ese correo ya tiene pasaporte. Entra con tu contraseña.');
    const uid = 'demo' + crypto.getRandomValues(new Uint32Array(2)).join('');
    cuentas[perfil.contacto] = { uid, hash: await sha256(`${perfil.contacto}:${contrasena}`) };
    local.set(K_DEMO_CUENTAS, cuentas);
    limpiarCaches();
    local.set(K_DEMO_UID, uid);
    local.set(kPerfil(), { ...perfil, notas: {}, creadoEn: Date.now() });
    return uid;
  }
  const { auth, A, db, F } = await fb();
  await auth.authStateReady();
  const actual = auth.currentUser;
  try {
    if (actual?.isAnonymous) {
      // Se conserva el uid anónimo (y lo que ya tenía) al ponerle contraseña.
      await A.linkWithCredential(actual, A.EmailAuthProvider.credential(perfil.contacto, contrasena));
    } else if (actual && actual.email === perfil.contacto) {
      // Ya tiene sesión con ese correo pero le falta el pasaporte (un registro
      // anterior creó la cuenta y no alcanzó a guardar la ficha): se completa.
    } else {
      if (actual) await A.signOut(auth);
      try {
        await A.createUserWithEmailAndPassword(auth, perfil.contacto, contrasena);
      } catch (err) {
        if (!String(err.code).includes('email-already-in-use')) throw err;
        // El correo ya existe: si la contraseña coincide y no tiene pasaporte,
        // se completa el registro; si ya lo tiene, se le pide entrar.
        await A.signInWithEmailAndPassword(auth, perfil.contacto, contrasena).catch(() => { throw err; });
        if ((await F.getDoc(F.doc(db, 'estudiantes', auth.currentUser.uid))).exists()) {
          throw new ErrorCuenta('Ese correo ya tiene pasaporte. Entra con tu contraseña en "Ya tengo pasaporte".');
        }
      }
    }
  } catch (err) {
    console.error(err);
    throw err instanceof ErrorCuenta ? err : new ErrorCuenta(mensajeAuth(err));
  }
  const uid = auth.currentUser.uid;
  const ref = F.doc(db, 'estudiantes', uid);
  try {
    if ((await F.getDoc(ref)).exists()) await F.updateDoc(ref, perfil);
    else await F.setDoc(ref, { ...perfil, notas: {}, creadoEn: F.serverTimestamp() });
  } catch (err) {
    console.error('No se pudo guardar estudiantes/' + uid, err);
    // La cuenta queda creada y con sesión: al reintentar se completa el registro.
    throw new ErrorCuenta(err.code === 'permission-denied'
      ? 'Tu cuenta quedó creada pero Firebase rechazó guardar el pasaporte (reglas de seguridad). Avísale a la organización y vuelve a intentarlo con la misma contraseña.'
      : 'Tu cuenta quedó creada pero no se pudo guardar el pasaporte. Revisa tu conexión y vuelve a tocar "Emitir mi pasaporte" con la misma contraseña.');
  }
  limpiarCaches();
  local.set(K_PERFIL, { ...perfil, notas: {} });
  return uid;
}

// Correo de la sesión abierta (para completar un registro a medias).
export async function correoSesion() {
  if (DEMO) return null;
  const { auth } = await fb();
  await auth.authStateReady();
  return auth.currentUser && !auth.currentUser.isAnonymous ? auth.currentUser.email : null;
}

export async function iniciarSesion(correo, contrasena) {
  const email = String(correo || '').trim().toLowerCase();
  if (DEMO) {
    const cuenta = local.get(K_DEMO_CUENTAS, {})[email];
    if (!cuenta || cuenta.hash !== (await sha256(`${email}:${contrasena}`))) {
      throw new ErrorCuenta('Correo o contraseña incorrectos.');
    }
    limpiarCaches();
    local.set(K_DEMO_UID, cuenta.uid);
    return cuenta.uid;
  }
  const { auth, A } = await fb();
  try {
    await A.signInWithEmailAndPassword(auth, email, contrasena);
  } catch (err) {
    console.error(err);
    throw new ErrorCuenta(mensajeAuth(err));
  }
  limpiarCaches();
  return auth.currentUser.uid;
}

export async function cerrarSesion() {
  limpiarCaches();
  local.borrar(K_PENDIENTE);
  if (DEMO) return local.borrar(K_DEMO_UID);
  const { auth, A } = await fb();
  await A.signOut(auth);
}

export async function recuperarContrasena(correo) {
  if (DEMO) throw new ErrorCuenta('En modo demo no se envían correos.');
  const { auth, A } = await fb();
  try {
    await A.sendPasswordResetEmail(auth, String(correo || '').trim().toLowerCase());
  } catch (err) {
    console.error(err);
    throw new ErrorCuenta(mensajeAuth(err));
  }
}

// Para quien se registró con la versión anónima: le pone correo y contraseña
// a su misma cuenta, sin perder sellos ni datos.
export async function crearContrasena(correo, contrasena) {
  const { auth, A, db, F } = await fb();
  const email = String(correo || '').trim().toLowerCase();
  try {
    await A.linkWithCredential(auth.currentUser, A.EmailAuthProvider.credential(email, contrasena));
  } catch (err) {
    console.error(err);
    throw new ErrorCuenta(mensajeAuth(err));
  }
  await F.updateDoc(F.doc(db, 'estudiantes', auth.currentUser.uid), { contacto: email });
}

// Devuelve el perfil o null si el estudiante aún no se registra.
// Usa la copia local para pintar rápido y la refresca desde Firestore.
export async function leerPerfil({ soloCache = false } = {}) {
  const uid = await usuarioActual();
  if (!uid) return null;
  const cache = local.get(kPerfil());
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
  delete perfil.contacto; // el correo es el usuario de la cuenta: no se cambia aquí
  const actual = local.get(kPerfil()) || {};
  local.set(kPerfil(), { ...actual, ...perfil });
  if (DEMO) return;
  const { db, F } = await fb();
  await F.updateDoc(F.doc(db, 'estudiantes', uid), perfil);
}

// Guarda el mentor con el que llegó el estudiante (QR del mentor).
export async function guardarMentor(mentorId) {
  const uid = await usuarioActual();
  const actual = local.get(kPerfil()) || {};
  if (actual.mentor === mentorId) return;
  local.set(kPerfil(), { ...actual, mentor: mentorId });
  if (DEMO) return;
  const { db, F } = await fb();
  await F.updateDoc(F.doc(db, 'estudiantes', uid), { mentor: mentorId });
}

// "Lo más importante que descubrí", una nota por empresa.
export async function guardarNota(empresaId, texto) {
  const uid = await usuarioActual();
  const valor = String(texto || '').slice(0, 280);
  const actual = local.get(kPerfil()) || {};
  local.set(kPerfil(), { ...actual, notas: { ...(actual.notas || {}), [empresaId]: valor } });
  if (DEMO) return;
  const { db, F } = await fb();
  await F.updateDoc(F.doc(db, 'estudiantes', uid), { [`notas.${empresaId}`]: valor });
}

// La foto y la firma se guardan en el celular y en fotos/{uid}, aparte del
// perfil, para que la tabla de admin no descargue imágenes de todos.
async function subirImagen(campo, dataUrl) {
  if (DEMO) return;
  const uid = await usuarioActual();
  const { db, F } = await fb();
  await F.setDoc(F.doc(db, 'fotos', uid), { [campo]: dataUrl, actualizado: F.serverTimestamp() }, { merge: true });
}

// Lanza error solo si falla la subida; la copia local queda guardada igual.
export const foto = {
  leer: () => local.get(K_FOTO),
  guardar: async (dataUrl) => {
    local.set(K_FOTO, dataUrl);
    await subirImagen('foto', dataUrl);
  },
};
export const firma = {
  leer: () => local.get(K_FIRMA),
  guardar: async (dataUrl) => {
    local.set(K_FIRMA, dataUrl);
    await subirImagen('firma', dataUrl);
  },
  borrar: async () => {
    local.borrar(K_FIRMA);
    await subirImagen('firma', '');
  },
};

// Sincroniza en ambos sentidos al abrir el pasaporte: en un celular nuevo trae
// la foto y la firma de Firestore; si estaban solo en el celular, las sube.
// Devuelve true si cambió algo en el celular.
export async function sincronizarImagenes() {
  if (DEMO) return false;
  try {
    const uid = await usuarioActual();
    const { db, F } = await fb();
    const snap = await F.getDoc(F.doc(db, 'fotos', uid));
    const remoto = snap.exists() ? snap.data() : {};
    let cambio = false;
    for (const [campo, clave] of [['foto', K_FOTO], ['firma', K_FIRMA]]) {
      const enCelular = local.get(clave);
      if (remoto[campo] && !enCelular) cambio = local.set(clave, remoto[campo]) || cambio;
      else if (enCelular && !(campo in remoto)) await subirImagen(campo, enCelular);
    }
    return cambio;
  } catch (err) {
    console.warn('No se pudieron sincronizar la foto y la firma', err);
    return false;
  }
}

// QR escaneado antes de registrarse (sello o asistencia): se aplica al
// terminar el registro. Se guarda la query del QR, p. ej. "e=epm&t=…".
export const pendiente = {
  leer: () => {
    const p = local.get(K_PENDIENTE);
    return p && typeof p === 'object' ? new URLSearchParams(p).toString() : p;
  },
  guardar: (query) => local.set(K_PENDIENTE, query),
  borrar: () => local.borrar(K_PENDIENTE),
};

// Datos que se agregaron después del primer registro (asistencia).
export function faltanDatos(perfil) {
  return !perfil?.cedula || !perfil?.facultad;
}

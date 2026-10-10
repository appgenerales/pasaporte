import { DEMO, fb } from './firebase.js';
import { ADMINS } from './firebase-config.js';

// Inicio de sesión de organizadores con Google (admin.html y tools/generar-qrs.html).
// Devuelve el correo si está autorizado; null si no hay sesión.
export async function organizadorActual() {
  if (DEMO) return 'demo';
  const { auth } = await fb();
  await auth.authStateReady();
  const u = auth.currentUser;
  if (!u || u.isAnonymous) return null;
  if (!ADMINS.includes(String(u.email).toLowerCase())) throw new Error(`La cuenta ${u.email} no está autorizada para el panel.`);
  return u.email;
}

export async function entrarConGoogle() {
  const { auth, A } = await fb();
  await A.signInWithPopup(auth, new A.GoogleAuthProvider());
  return organizadorActual();
}

export async function entrarConCorreo(correo, contrasena) {
  const { auth, A } = await fb();
  try {
    await A.signInWithEmailAndPassword(auth, String(correo).trim().toLowerCase(), contrasena);
  } catch (err) {
    const c = err?.code || '';
    if (c.includes('invalid') || c.includes('wrong-password') || c.includes('user-not-found')) throw new Error('Correo o contraseña incorrectos.');
    if (c.includes('too-many-requests')) throw new Error('Demasiados intentos. Espera un momento.');
    throw new Error('No se pudo iniciar sesión.');
  }
  return organizadorActual();
}

export async function salir() {
  if (DEMO) return;
  const { auth, A } = await fb();
  await A.signOut(auth);
}

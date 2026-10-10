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
  if (!ADMINS.includes(u.email)) throw new Error(`La cuenta ${u.email} no está autorizada.`);
  return u.email;
}

export async function entrarConGoogle() {
  const { auth, A } = await fb();
  await A.signInWithPopup(auth, new A.GoogleAuthProvider());
  return organizadorActual();
}

export async function salir() {
  if (DEMO) return;
  const { auth, A } = await fb();
  await A.signOut(auth);
}

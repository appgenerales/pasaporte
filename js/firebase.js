import { firebaseConfig } from './firebase-config.js';

// Sin configuración real el sitio corre en modo demo (todo en localStorage).
export const DEMO = !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith('PEGAR');

const SDK = 'https://www.gstatic.com/firebasejs/10.12.5/';
let cargando = null;

// Carga el SDK solo cuando hace falta, para que el modo demo no dependa de la red.
export function fb() {
  if (!cargando) {
    cargando = (async () => {
      const [app, auth, fs] = await Promise.all([
        import(SDK + 'firebase-app.js'),
        import(SDK + 'firebase-auth.js'),
        import(SDK + 'firebase-firestore.js'),
      ]);
      const instancia = app.initializeApp(firebaseConfig);
      return { auth: auth.getAuth(instancia), db: fs.getFirestore(instancia), A: auth, F: fs };
    })();
  }
  return cargando;
}

// Helpers de localStorage que nunca lanzan (modo privado, almacenamiento bloqueado).
export const local = {
  get(clave, porDefecto = null) {
    try {
      const v = localStorage.getItem(clave);
      return v === null ? porDefecto : JSON.parse(v);
    } catch {
      return porDefecto;
    }
  },
  set(clave, valor) {
    try {
      localStorage.setItem(clave, JSON.stringify(valor));
      return true;
    } catch {
      return false;
    }
  },
  borrar(clave) {
    try {
      localStorage.removeItem(clave);
    } catch {}
  },
};

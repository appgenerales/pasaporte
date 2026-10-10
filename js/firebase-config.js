// Configuración web de Firebase (proyecto pasaporte-itm). Es pública por
// diseño: la protección real está en firestore.rules.
//
// Para volver al MODO DEMO (todo en localStorage, QR con token
// "demo-<empresaId>"), cambia apiKey por 'PEGAR_API_KEY'.
export const firebaseConfig = {
  apiKey: 'AIzaSyCaHuhROO9tgRWQtBcuqPRm9LYzt7d-TEo',
  authDomain: 'pasaporte-itm.firebaseapp.com',
  projectId: 'pasaporte-itm',
  storageBucket: 'pasaporte-itm.firebasestorage.app',
  messagingSenderId: '984123129153',
  appId: '1:984123129153:web:e149f33175f9f67e5035c0',
};

// Correos que pueden entrar a admin.html y tools/generar-qrs.html.
// hahiguit@gmail.com entra con Google; los demás con correo y contraseña
// (cuentas creadas con tools/crear_admins.py). La protección real está en
// esAdmin() de firestore.rules, que valida el correo de Google y los UID.
export const ADMINS = [
  'hahiguit@gmail.com',
  'angelagil@itm.edu.co',
  'gladysperez@itm.edu.co',
  'monicameneses@itm.edu.co',
  'maritzamedina@itm.edu.co',
];

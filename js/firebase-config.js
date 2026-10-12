import { SANDBOX } from './evento.js';

// Configuración web de Firebase. Es pública por diseño: la protección real
// está en firestore.rules.
//   - Producción (sitio principal): proyecto pasaporte-itm.
//   - Pruebas (/sandbox/ y localhost, ver SANDBOX en js/evento.js): proyecto
//     sandbox-pasaporte, con sus propios datos, cuentas y reglas.
//
// Para volver al MODO DEMO (todo en localStorage, QR con token
// "demo-<empresaId>"), cambia apiKey por 'PEGAR_API_KEY'.
const PRODUCCION = {
  apiKey: 'AIzaSyCaHuhROO9tgRWQtBcuqPRm9LYzt7d-TEo',
  authDomain: 'pasaporte-itm.firebaseapp.com',
  projectId: 'pasaporte-itm',
  storageBucket: 'pasaporte-itm.firebasestorage.app',
  messagingSenderId: '984123129153',
  appId: '1:984123129153:web:e149f33175f9f67e5035c0',
};

const PRUEBAS = {
  apiKey: 'AIzaSyB8Krx-DjvbEqr1451zKK0-nxHQ9oIJYBo',
  authDomain: 'sandbox-pasaporte.firebaseapp.com',
  projectId: 'sandbox-pasaporte',
  storageBucket: 'sandbox-pasaporte.firebasestorage.app',
  messagingSenderId: '154488720545',
  appId: '1:154488720545:web:88a6640008d5a0699bf4e0',
};

export const firebaseConfig = SANDBOX ? PRUEBAS : PRODUCCION;

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

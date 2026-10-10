// Configuración web de Firebase. Es pública por diseño: la protección real
// está en firestore.rules. Pega aquí los valores de
// Consola de Firebase > Configuración del proyecto > Tus apps > Web.
//
// Mientras apiKey siga con el texto de ejemplo, el sitio funciona en
// MODO DEMO: todo se guarda en este navegador (localStorage) y los QR de
// prueba usan el token "demo-<empresaId>".
export const firebaseConfig = {
  apiKey: 'PEGAR_API_KEY',
  authDomain: 'TU-PROYECTO.firebaseapp.com',
  projectId: 'TU-PROYECTO',
  storageBucket: 'TU-PROYECTO.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000',
};

// Correos que pueden entrar a admin.html y tools/generar-qrs.html.
// Debe coincidir con la lista de esAdmin() en firestore.rules.
export const ADMINS = [
  'organizador1@universidad.edu',
  'organizador2@universidad.edu',
];

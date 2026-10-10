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
// Debe coincidir con la lista de esAdmin() en firestore.rules.
export const ADMINS = [
  'hahiguit@gmail.com',
];

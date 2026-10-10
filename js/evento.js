// Interruptores del evento. Se cambian aquí y se despliegan con un push.

// Copia de pruebas: rama sandbox (publicada en /sandbox/) o el sitio en local.
// Usa el proyecto de Firebase sandbox-pasaporte (ver js/firebase-config.js).
export const SANDBOX =
  location.pathname.includes('/sandbox/') || ['localhost', '127.0.0.1'].includes(location.hostname);

// EXIGIR_FECHA (solo afecta al sitio principal):
// false = el QR de cada día marca asistencia en cualquier fecha (para pruebas).
// true  = solo sirve en su fecha (14, 15 y 16 de octubre, hora de Colombia).
// Tras cambiarlo, abre tools/generar-qrs.html para que Firestore tome la ventana.
// En sandbox y en local la asistencia de cualquier día se marca siempre.
const EXIGIR_FECHA = false;
export const FECHA_ASISTENCIA_OBLIGATORIA = EXIGIR_FECHA && !SANDBOX;

// Desde cuándo se puede abrir el libro y sellar en los stands (hora de Colombia).
// En sandbox y en local el pasaporte se ve siempre.
export const PASAPORTE_VISIBLE_DESDE = '2026-10-16';

export function pasaporteVisible(ahora = new Date()) {
  if (SANDBOX) return true;
  return ahora.getTime() >= new Date(`${PASAPORTE_VISIBLE_DESDE}T00:00:00-05:00`).getTime();
}

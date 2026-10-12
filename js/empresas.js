// Catálogo fijo: cada empresa ya tiene su página y su sello en el diseño.
// `pagina` es el índice de la hoja dentro del libro (0 = portada).
// `linea` es la altura (en % de la hoja) de la primera línea de
// "Lo más importante que descubrí", medida sobre el boceto.
// "Viajemos juntos" es un stand con hoja propia (sin número de destino ni
// líneas para escribir); `sello` ubica el sello sobre su imagen, en % de la hoja.
export const EMPRESAS = [
  { id: 'epm',        nombre: 'EPM',        destino: 1, pagina: 2, linea: 77.2 },
  { id: 'cardiovid',  nombre: 'Cardio VID', destino: 2, pagina: 3, linea: 77.2 },
  { id: 'isa',        nombre: 'ISA',        destino: 3, pagina: 4, linea: 77.2 },
  { id: 'texmaquila', nombre: 'Texmaquila', destino: 4, pagina: 5, linea: 76.4 },
  { id: 'renting',    nombre: 'Renting',    destino: 5, pagina: 6, linea: 78.2 },
  { id: 'proteccion', nombre: 'Protección', destino: 6, pagina: 7, linea: 75.9 },
  { id: 'haceb',      nombre: 'Haceb',      destino: 7, pagina: 8, linea: 77.2 },
  { id: 'colcafe',    nombre: 'Colcafé',    destino: 8, pagina: 9, linea: 77.2 },
  { id: 'viajemos',   nombre: 'Viajemos juntos', destino: 0, pagina: 11, linea: null, sello: { x: 74, y: 41, ancho: 42 } },
];

export const TOTAL = EMPRESAS.length;

// '01b-viajemos' es la hoja del stand Viajemos juntos (imagen de WhatsApp
// ajustada a la hoja), la última antes de la contraportada.
export const PAGINAS = [
  '00-portada', '01-datos',
  '02-destino-1', '03-destino-2', '04-destino-3', '05-destino-4',
  '06-destino-5', '07-destino-6', '08-destino-7', '09-destino-8',
  '10-mision', '01b-viajemos', '11-contraportada',
];

export const PAGINA_DATOS = 1;
export const PAGINA_MISION = 10;

// "Destino 3" para las empresas, "Stand" para Viajemos juntos.
export function etiquetaDestino(e) {
  return e.destino ? `Destino ${e.destino}` : 'Stand';
}

// Rótulo corto para las fichas del panel de admin.
export function rotuloCorto(e) {
  return e.destino ? String(e.destino) : 'VJ';
}

export function empresaPorId(id) {
  return EMPRESAS.find((e) => e.id === id) || null;
}

// Ruta del sello relativa a la raíz del sitio.
export function rutaSello(id) {
  return `assets/sellos/${id}.webp`;
}

// Días del evento. Cada día tiene su QR de asistencia (dias/{id}.token en
// Firestore). Si FECHA_ASISTENCIA_OBLIGATORIA (js/evento.js) está activo, el QR
// solo sirve en su `fecha` (hora de Colombia). Si cambian las fechas, vuelve a
// abrir tools/generar-qrs.html para que Firestore tome las nuevas.
export const DIAS = [
  { id: 'dia1', nombre: 'Día 1', fecha: '2026-10-14' },
  { id: 'dia2', nombre: 'Día 2', fecha: '2026-10-15' },
  { id: 'dia3', nombre: 'Día 3', fecha: '2026-10-16' },
];

export function diaPorId(id) {
  return DIAS.find((d) => d.id === id) || null;
}

// Día del evento que corresponde a una fecha (por defecto, ahora), o null.
export function diaDeHoy(fecha = new Date()) {
  const t = fecha.getTime();
  return DIAS.find((d) => {
    const { inicio, fin } = ventanaDia(d);
    return t >= inicio.getTime() && t < fin.getTime();
  }) || null;
}

// Mentores de navegación y acompañamiento: el estudiante elige el suyo al
// registrarse. También se usan para las constancias de mentor.
export const MENTORES = [
  { id: 'andres-montoya', nombre: 'Andrés Felipe Montoya Tobón' },
  { id: 'cristian-bocanegra', nombre: 'Cristian David Bocanegra Villazon' },
  { id: 'daniel-varela', nombre: 'Daniel Alberto Varela Rueda' },
  { id: 'diana-pachajoa', nombre: 'Diana Catherine Pachajoa' },
  { id: 'enrique-quiceno', nombre: 'Enrique Quiceno Rúa' },
  { id: 'estefania-perez', nombre: 'Estefanía Pérez Giraldo' },
  { id: 'german-cano', nombre: 'Germán Alberto Cano Ortiz' },
  { id: 'jaime-gutierrez', nombre: 'Jaime Andrés Gutiérrez Monsalve' },
  { id: 'luis-alvarez', nombre: 'Luis Carlos Alvarez Velez' },
  { id: 'maria-menco', nombre: 'Maria Angélica Menco Domínguez' },
  { id: 'yuli-montoya', nombre: 'Yuli Catalina Montoya' },
];

export function mentorPorId(id) {
  return MENTORES.find((m) => m.id === id) || null;
}

// Inicio y fin (exclusivo) del día en Colombia (UTC-5, sin horario de verano).
export function ventanaDia(dia) {
  const inicio = new Date(`${dia.fecha}T00:00:00-05:00`);
  return { inicio, fin: new Date(inicio.getTime() + 24 * 3600 * 1000) };
}

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function fechaLarga(fecha) {
  const [, m, d] = fecha.split('-').map(Number);
  return `${d} de ${MESES_LARGOS[m - 1]}`;
}

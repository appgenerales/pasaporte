// Catálogo fijo: cada empresa ya tiene su página y su sello en el diseño.
// `pagina` es el índice de la hoja dentro del libro (0 = portada).
// `linea` es la altura (en % de la hoja) de la primera línea de
// "Lo más importante que descubrí", medida sobre el boceto.
export const EMPRESAS = [
  { id: 'epm',        nombre: 'EPM',        destino: 1, pagina: 2, linea: 77.2 },
  { id: 'cardiovid',  nombre: 'Cardio VID', destino: 2, pagina: 3, linea: 77.2 },
  { id: 'isa',        nombre: 'ISA',        destino: 3, pagina: 4, linea: 77.2 },
  { id: 'texmaquila', nombre: 'Texmaquila', destino: 4, pagina: 5, linea: 76.4 },
  { id: 'renting',    nombre: 'Renting',    destino: 5, pagina: 6, linea: 78.2 },
  { id: 'proteccion', nombre: 'Protección', destino: 6, pagina: 7, linea: 75.9 },
  { id: 'haceb',      nombre: 'Haceb',      destino: 7, pagina: 8, linea: 77.2 },
  { id: 'colcafe',    nombre: 'Colcafé',    destino: 8, pagina: 9, linea: 77.2 },
];

export const TOTAL = EMPRESAS.length;

export const PAGINAS = [
  '00-portada', '01-datos',
  '02-destino-1', '03-destino-2', '04-destino-3', '05-destino-4',
  '06-destino-5', '07-destino-6', '08-destino-7', '09-destino-8',
  '10-mision', '11-contraportada',
];

export const PAGINA_DATOS = 1;
export const PAGINA_MISION = 10;

export function empresaPorId(id) {
  return EMPRESAS.find((e) => e.id === id) || null;
}

// Ruta del sello relativa a la raíz del sitio.
export function rutaSello(id) {
  return `assets/sellos/${id}.webp`;
}

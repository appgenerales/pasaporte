// Dibuja las constancias sobre la plantilla de Canva y arma el PDF.
// Medidas sobre assets/constancia/*.webp (2340×1655, PDF a 200 dpi).
export const PLANTILLAS = {
  estudiante: { fondo: 'assets/constancia/estudiante.webp', nombre: { cx: 1342, cy: 679 }, cedula: { x: 1150, base: 805 } },
  mentor: { fondo: 'assets/constancia/mentor.webp', nombre: { cx: 1366, cy: 679 } },
};
const ANCHO_NOMBRE = 1100;
const A4 = [842.25, 595.5]; // puntos, horizontal, igual que la plantilla

const formatoCedula = (c) => String(c).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

function cargarImagen(src) {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = mal;
    img.src = src;
  });
}

// `raiz` permite usarlo desde páginas en subcarpetas (p. ej. '../').
export async function dibujarConstancia(tipo, { nombre, cedula }, raiz = '') {
  const p = PLANTILLAS[tipo];
  await Promise.all([document.fonts.load('800 60px Montserrat'), document.fonts.load('500 40px Roboto')]);
  const fondo = await cargarImagen(raiz + p.fondo);
  const lienzo = document.createElement('canvas');
  lienzo.width = fondo.naturalWidth;
  lienzo.height = fondo.naturalHeight;
  const ctx = lienzo.getContext('2d');
  ctx.drawImage(fondo, 0, 0);

  // Nombre centrado en la caja; se reduce si es muy largo.
  const texto = String(nombre).trim().toLocaleUpperCase('es');
  let tam = 66;
  ctx.font = `800 ${tam}px Montserrat`;
  while (ctx.measureText(texto).width > ANCHO_NOMBRE && tam > 30) {
    tam -= 2;
    ctx.font = `800 ${tam}px Montserrat`;
  }
  ctx.fillStyle = '#0c3b69';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, p.nombre.cx, p.nombre.cy + 3);

  if (p.cedula && cedula) {
    ctx.font = '500 40px Roboto';
    ctx.fillStyle = '#1b2a4a';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(formatoCedula(cedula), p.cedula.x, p.cedula.base);
  }
  return lienzo;
}

// Un PDF con una página por lienzo.
export function pdfDeLienzos(lienzos, titulo) {
  const pdf = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: A4 });
  lienzos.forEach((l, i) => {
    if (i) pdf.addPage(A4, 'landscape');
    pdf.addImage(l.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, A4[0], A4[1]);
  });
  pdf.setProperties({ title: titulo, author: 'Coordinación de Prácticas Profesionales ITM' });
  return pdf;
}

export function nombreArchivo(texto) {
  return texto.replace(/[\\/:*?"<>|]/g, '');
}

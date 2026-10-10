import { PROGRAMAS, FACULTADES } from './programas.js';
import { EMPRESAS } from './empresas.js';

const opcion = (valor, texto = valor) => {
  const o = document.createElement('option');
  o.value = valor;
  o.textContent = texto;
  return o;
};

// Facultad y programa como listas encadenadas: el programa depende de la facultad.
export function conectarFacultadPrograma(selFacultad, selPrograma) {
  selFacultad.replaceChildren(opcion('', 'Elige tu facultad'), ...FACULTADES.map((f) => opcion(f)));
  const pintarProgramas = (valor = '') => {
    const lista = PROGRAMAS[selFacultad.value] || [];
    selPrograma.replaceChildren(opcion('', lista.length ? 'Elige tu programa' : 'Primero elige la facultad'), ...lista.map((p) => opcion(p)));
    selPrograma.disabled = !lista.length;
    // Un valor antiguo que no está en la lista se conserva para no perderlo.
    if (valor && !lista.includes(valor)) selPrograma.append(opcion(valor));
    selPrograma.value = valor;
  };
  selFacultad.addEventListener('change', () => pintarProgramas());
  pintarProgramas();
  return {
    fijar(facultad, programa) {
      if (facultad && !FACULTADES.includes(facultad)) selFacultad.append(opcion(facultad));
      selFacultad.value = facultad || '';
      pintarProgramas(programa || '');
    },
  };
}

export function llenarEmpresas(select) {
  select.replaceChildren(opcion('', 'Ninguna / aún no'), ...EMPRESAS.map((e) => opcion(e.nombre)), opcion('Otra'));
  return {
    fijar(valor) {
      if (valor && ![...select.options].some((o) => o.value === valor)) select.append(opcion(valor));
      select.value = valor || '';
    },
  };
}

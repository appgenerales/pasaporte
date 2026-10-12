import { PROGRAMAS, FACULTADES } from './programas.js';
import { EMPRESAS, VINCULOS } from './empresas.js';

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

// "Viajemos juntos" es un stand, no una empresa: no va en la lista.
export function llenarEmpresas(select, vacio = 'Ninguna / aún no') {
  select.replaceChildren(opcion('', vacio), ...EMPRESAS.filter((e) => e.destino).map((e) => opcion(e.nombre)), opcion('Otra'));
  return {
    fijar(valor) {
      if (valor && ![...select.options].some((o) => o.value === valor)) select.append(opcion(valor));
      select.value = valor || '';
    },
  };
}

export function llenarVinculos(select) {
  select.replaceChildren(opcion('', 'Elige tu vínculo'), ...VINCULOS.map((v) => opcion(v)));
}

// Muestra solo los campos del tipo de participante (data-tipos="a b"). Los
// ocultos se deshabilitan: no se validan ni se envían con el formulario.
// Si la empresa elegida es "Otra", aparece el campo para escribirla.
export function camposPorTipo(form, campoOtra) {
  const empresaVisible = () => [...form.elements].find((c) => c.name === 'empresa' && !c.disabled);
  const pintarOtra = () => {
    const sel = empresaVisible();
    const ver = sel?.value === 'Otra';
    campoOtra.classList.toggle('oculto', !ver);
    campoOtra.querySelector('input').disabled = !ver;
    campoOtra.querySelector('input').required = ver && sel.required;
  };
  for (const c of form.elements) if (c.name === 'empresa') c.addEventListener('change', pintarOtra);
  return function aplicar(tipo) {
    for (const el of form.querySelectorAll('[data-tipos]')) {
      const ver = Boolean(tipo) && el.dataset.tipos.split(' ').includes(tipo);
      el.classList.toggle('oculto', !ver);
      for (const c of el.querySelectorAll('input, select')) {
        // El programa sigue bloqueado hasta elegir facultad.
        c.disabled = !ver || (c.name === 'programa' && !form.elements.facultad?.value);
      }
    }
    pintarOtra();
  };
}

// Junta "Otra" + el nombre escrito en un solo valor de empresa.
export function empresaFinal(datos) {
  const { empresaOtra, ...resto } = datos;
  if (resto.empresa === 'Otra' && String(empresaOtra || '').trim()) resto.empresa = String(empresaOtra).trim();
  return resto;
}

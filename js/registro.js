import { leerPerfil, registrar, pendiente } from './auth.js';

const $ = (sel) => document.querySelector(sel);

function continuar() {
  // Si el estudiante llegó escaneando un QR antes de registrarse, se sella ahora.
  const p = pendiente.leer();
  if (p) {
    pendiente.borrar();
    location.replace(`scanner.html?e=${encodeURIComponent(p.e)}&t=${encodeURIComponent(p.t)}`);
  } else {
    location.replace('pasaporte.html');
  }
}

async function iniciar() {
  let perfil = null;
  try {
    perfil = await leerPerfil();
  } catch (err) {
    console.error(err);
  }
  if (perfil) return continuar();

  $('#cargando').classList.add('oculto');
  $('#registro').classList.remove('oculto');
}

$('#form-registro').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const form = ev.currentTarget;
  const datos = Object.fromEntries(new FormData(form));
  const error = $('#error-registro');
  error.textContent = '';

  const faltan = ['apellidos', 'nombres', 'programa', 'contacto'].filter((k) => !String(datos[k] || '').trim());
  if (faltan.length) {
    error.textContent = 'Completa los campos obligatorios.';
    form.elements[faltan[0]].focus();
    return;
  }

  const boton = form.querySelector('button');
  boton.disabled = true;
  boton.textContent = 'Emitiendo…';
  try {
    await registrar(datos);
    continuar();
  } catch (err) {
    console.error(err);
    error.textContent = 'No pudimos emitir tu pasaporte. Revisa tu conexión e inténtalo otra vez.';
    boton.disabled = false;
    boton.textContent = 'Emitir mi pasaporte';
  }
});

iniciar();

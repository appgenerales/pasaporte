import { leerPerfil, registrar, iniciarSesion, recuperarContrasena, pendiente, ErrorCuenta, correoSesion } from './auth.js';
import { MENTORES, diaPorId } from './empresas.js';
import { conectarFacultadPrograma, llenarEmpresas } from './formularios.js';

const $ = (sel) => document.querySelector(sel);

function continuar() {
  // Si llegó escaneando un QR (asistencia o stand) antes de entrar, se aplica ahora.
  const p = pendiente.leer();
  if (p) {
    pendiente.borrar();
    location.replace(`scanner.html?${p}`);
  } else {
    location.replace('pasaporte.html');
  }
}

function mostrarVista(id) {
  for (const b of document.querySelectorAll('.pestana')) {
    const activa = b.dataset.vista === id;
    b.classList.toggle('activa', activa);
    b.setAttribute('aria-selected', activa);
  }
  $('#form-registro').classList.toggle('oculto', id !== 'form-registro');
  $('#form-entrar').classList.toggle('oculto', id !== 'form-entrar');
}

function error(form, texto) {
  form.querySelector('.mensaje-error').textContent = texto;
}

// Llegó con el QR de asistencia de un día: se le cuenta al terminar el registro.
function prepararAviso() {
  const q = new URLSearchParams(pendiente.leer() || '');
  const dia = diaPorId(q.get('d'));
  if (!dia) return;
  $('#aviso-qr').innerHTML = `Escaneaste el QR de asistencia del <b>${dia.nombre}</b>. Si es tu primera vez, regístrate y quedará marcada; si ya tienes pasaporte, entra con tu correo.`;
  $('#aviso-qr').classList.remove('oculto');
}

// La cuenta existe pero le falta el pasaporte: se lleva a "Soy nuevo" con
// el correo puesto para que complete sus datos (con la misma contraseña).
function completarRegistro(correo) {
  mostrarVista('form-registro');
  const form = $('#form-registro');
  form.elements.contacto.value = correo;
  form.elements.contacto.readOnly = true;
  form.querySelector('.mensaje-error').innerHTML =
    '<span style="color:var(--azul)">Tu cuenta ya está creada pero falta tu pasaporte. Completa tus datos y usa la misma contraseña.</span>';
  form.elements.cedula.focus();
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
  const correo = await correoSesion().catch(() => null);
  if (correo) completarRegistro(correo);
}

$('#form-registro').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const form = ev.currentTarget;
  const datos = Object.fromEntries(new FormData(form));
  error(form, '');

  if (datos.autoriza !== 'si') {
    error(form, datos.autoriza === 'no'
      ? 'Sin tu autorización para el tratamiento de datos no podemos emitir el pasaporte.'
      : 'Responde la autorización de tratamiento de datos.');
    form.querySelector('.autorizacion').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const faltan = ['cedula', 'nombres', 'apellidos', 'contacto', 'programa', 'facultad', 'mentor', 'contrasena'].filter((k) => !String(datos[k] || '').trim());
  if (faltan.length) {
    error(form, 'Completa los campos obligatorios.');
    form.elements[faltan[0]].focus();
    return;
  }
  if (!/^\d{5,12}$/.test(String(datos.cedula).replace(/\D/g, ''))) {
    error(form, 'Revisa el número de cédula (solo números).');
    form.elements.cedula.focus();
    return;
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(datos.contacto.trim())) {
    error(form, 'Revisa el correo electrónico.');
    form.elements.contacto.focus();
    return;
  }
  if (datos.contrasena.length < 6) {
    error(form, 'La contraseña debe tener al menos 6 caracteres.');
    form.elements.contrasena.focus();
    return;
  }
  if (datos.contrasena !== datos.contrasena2) {
    error(form, 'Las contraseñas no coinciden.');
    form.elements.contrasena2.focus();
    return;
  }

  const boton = form.querySelector('button[type=submit]');
  boton.disabled = true;
  boton.textContent = 'Emitiendo…';
  try {
    const { contrasena, contrasena2, autoriza, ...perfil } = datos;
    await registrar({ ...perfil, autorizaDatos: true }, contrasena);
    continuar();
  } catch (err) {
    console.error(err);
    error(form, err instanceof ErrorCuenta ? err.message : 'No pudimos emitir tu pasaporte. Revisa tu conexión e inténtalo otra vez.');
    boton.disabled = false;
    boton.textContent = 'Emitir mi pasaporte';
  }
});

$('#form-entrar').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const form = ev.currentTarget;
  const { correo, contrasena } = Object.fromEntries(new FormData(form));
  error(form, '');
  if (!correo || !contrasena) return error(form, 'Escribe tu correo y tu contraseña.');
  const boton = form.querySelector('button[type=submit]');
  boton.disabled = true;
  try {
    await iniciarSesion(correo, contrasena);
    if (await leerPerfil()) return continuar();
    completarRegistro(correo);
  } catch (err) {
    console.error(err);
    error(form, err instanceof ErrorCuenta ? err.message : 'No pudimos iniciar sesión. Inténtalo otra vez.');
  }
  boton.disabled = false;
});

$('#olvide').addEventListener('click', async () => {
  const form = $('#form-entrar');
  const correo = form.elements.correo.value.trim();
  if (!correo) {
    error(form, 'Escribe tu correo y vuelve a tocar "¿Olvidaste tu contraseña?".');
    form.elements.correo.focus();
    return;
  }
  try {
    await recuperarContrasena(correo);
    error(form, '');
    form.querySelector('.mensaje-error').innerHTML = '<span style="color:var(--ok)">Te enviamos un correo para crear una nueva contraseña. Revisa también la carpeta de spam.</span>';
  } catch (err) {
    error(form, err instanceof ErrorCuenta ? err.message : 'No pudimos enviar el correo.');
  }
});

for (const b of document.querySelectorAll('.pestana')) {
  b.addEventListener('click', () => mostrarVista(b.dataset.vista));
}
conectarFacultadPrograma($('#facultad'), $('#programa'));
llenarEmpresas($('#empresa'));
$('#mentor').insertAdjacentHTML('beforeend', MENTORES.map((m) => `<option value="${m.id}">${m.nombre}</option>`).join(''));
prepararAviso();
if (new URLSearchParams(location.search).get('entrar') !== null) mostrarVista('form-entrar');

iniciar();

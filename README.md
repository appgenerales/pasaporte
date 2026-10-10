# Pasaporte CUEE 2.0

Pasaporte digital de las Pasantías CUEE 2.0 (ITM). Hay un QR de asistencia por día. El primer día el estudiante lo escanea con la cámara del celular y se registra (cédula, nombres, apellidos, correo, facultad, programa, mentor y una contraseña que él mismo crea); los días siguientes escanea el QR de ese día. Desde el viernes 16 de octubre abre su pasaporte, lo hojea como un libro y, al terminar la charla de cada stand, escanea su QR para sellar la hoja. Antes de esa fecha ve una antesala con la portada cerrada y su asistencia. Con los 3 días y los 8 sellos completa el CUEE 2.0.

- Diseño: las hojas son el boceto de Canva (`imagenes_referencia/Pasaporte CUEE 2.0.pdf`, páginas 1 a 6) y los sellos son las páginas 7 a 14.
- Especificación: `.remember/cue-pasaporte-spec.md`. Arquitectura: `imagenes_referencia/cue-pasaporte-arquitectura.drawio`.
- Costo cero: GitHub Pages + Firebase plan Spark (Auth anónima y Google, Firestore).

## Páginas

| Archivo | Para quién | Qué hace |
|---|---|---|
| `index.html` | Estudiante | "Soy nuevo": autorización de tratamiento de datos (Ley 1581 de 2012), registro con facultad y programa en listas (desde `imagenes_referencia/Facultades-Programas.xlsx`), empresa opcional, mentor y contraseña. "Ya tengo pasaporte": entrar con correo y contraseña desde cualquier celular, y recuperar la contraseña por correo. |
| `pasaporte.html` | Estudiante | El libro: portada, hoja de datos, 8 destinos, misión cumplida y contraportada. Se pasa la hoja deslizando, con las flechas o con el teclado. |
| `scanner.html` | Estudiante | Escáner de QR de asistencia (`?d=dia1`, registro el primer día) y de stands (`?e=`). También funciona si el QR se abre con la cámara normal del celular. |
| `constancia.html` | Estudiante | Con los 3 días y los 8 sellos, genera la constancia de abordaje y participación (plantilla de Canva, página 1) con su nombre y cédula, y la descarga en PDF o imagen. |
| `admin.html` | Organizadores | Entrada con correo y contraseña (o Google). Tabla con asistencia por día y sellos, ficha con foto y firma, exportación CSV, sorteo entre los completos (3 días + todos los sellos), constancia manual para estudiantes con 2 días o más, y constancias de mentores en PDF. |
| `tools/generar-qrs.html` | Organizadores | Crea los tokens secretos y la ventana de cada día, y muestra los QR para imprimir: 3 de asistencia (uno por día) y 9 de stands. Permite rotarlos. |

En la hoja de datos el estudiante toca la foto para tomarse una, la firma para firmar con el dedo y los campos para corregirlos. En cada destino puede escribir "Lo más importante que descubrí" sobre las líneas del boceto.

## Probar sin Firebase (modo demo)

Mientras `js/firebase-config.js` tenga `PEGAR_API_KEY`, todo se guarda en el navegador:

```bash
python3 -m http.server 8080
# http://localhost:8080/            registro
# http://localhost:8080/tools/generar-qrs.html   QR de prueba (token "demo-<empresa>")
# http://localhost:8080/scanner.html?e=epm&t=demo-epm   sellar EPM sin cámara
```

La cámara del escáner necesita HTTPS (o `localhost`).

## Puesta en marcha

1. **Firebase**: crea el proyecto, activa Firestore y en Authentication habilita *Correo electrónico/contraseña* (estudiantes) y *Google* (organizadores). En *Authentication > Settings > Authorized domains* agrega `<usuario>.github.io`.
2. **Configuración**: copia la configuración web en `js/firebase-config.js` y pon los correos de los organizadores en `ADMINS`.
3. **Reglas**: pon los mismos correos en `esAdmin()` de `firestore.rules` y publícalas (consola de Firebase > Firestore > Reglas, o `firebase deploy --only firestore:rules`). Sin reglas publicadas no hay protección.
4. **GitHub Pages y reglas**: ver la sección *GitHub Actions* (el workflow publica el sitio y las reglas en cada push a `main`).
5. **QR**: entra a `tools/generar-qrs.html` con una cuenta organizadora. La primera vez crea los tokens en `empresas/{id}`. Imprime un QR por stand.
6. **Prueba**: registra un estudiante en Android y otro en iPhone, sella un par de stands y revisa `admin.html`.

## El día del evento

- Cada día se muestra su QR de asistencia. Si el estudiante no tiene pasaporte, el QR abre el registro y al terminar queda marcado ese día; si ya lo tiene, marca el día. Las fechas están en `DIAS` de `js/empresas.js` y los mentores (que el estudiante elige al registrarse) en `MENTORES`.
- Interruptores en `js/evento.js`:
  - `EXIGIR_FECHA` (hoy `false`, para pruebas): con `true` cada QR solo sirve en su fecha en el sitio principal; en sandbox y local la asistencia de cualquier día se marca siempre. Tras cambiarlo, abre `tools/generar-qrs.html` para que Firestore tome la ventana de cada día.
  - `PASAPORTE_VISIBLE_DESDE` (`2026-10-16`): antes de esa fecha el pasaporte muestra la antesala y los stands no sellan. En sandbox y en local se ve siempre.
- El estudiante puede cerrar sesión (botón de la cabecera) y volver a entrar en cualquier celular con su correo y contraseña. Las contraseñas las guarda cifradas Firebase Authentication; nadie del equipo las ve.
- Cada stand muestra su QR impreso. El estudiante lo escanea con "Escanear QR" o con la cámara del celular.
- Al completar los 8 sellos (y al completar todo) el pasaporte lanza confeti.
- Si alguien llega al QR sin registrarse, primero se registra y el sello se aplica solo al terminar.
- Escanear dos veces la misma empresa no duplica el sello.
- Si un QR se filtra, rota el token en `tools/generar-qrs.html` y cambia el impreso.
- Al cierre: `admin.html` > filtro *Completos (3 días + 8 sellos)* > *Sortear ganador*. *Exportar CSV* descarga el listado (abre directo en Excel).
- Los organizadores deben usar `admin.html` en un navegador distinto al de su propio pasaporte: iniciar sesión con Google reemplaza la sesión anónima de estudiante.

## Datos

- `estudiantes/{uid}`: cédula, nombres, apellidos, programa, facultad, empresa (opcional), contacto (correo), notas por destino, fecha de registro. A quien se registró antes de pedir cédula y facultad, el pasaporte se las pide al abrirlo.
- `asistencias/{uid}_{dia}`: uid, dia, token, ts. `dias/{dia}`: token del QR, inicio y fin (solo organizadores); las reglas exigen el token del día y que la hora del servidor esté en esa ventana.
- `estudiantes/{uid}.mentor`: mentor acompañante elegido en el registro.
- `sellos/{uid}_{empresaId}`: uid, empresaId, token, ts. El ID compuesto impide sellos repetidos.
- `empresas/{empresaId}`: nombre, orden, token (solo organizadores).
- `fotos/{uid}`: foto (JPEG 360×480) y firma (PNG 600×200) como data URL. Va aparte del perfil para que la tabla de `admin.html` no descargue imágenes; se ve con el botón *Ver* de cada estudiante. Al abrir el pasaporte se sincronizan: si el estudiante cambia de celular se recuperan, y si estaban solo en el celular se suben.

Cambios respecto a la especificación: el catálogo de empresas vive en `js/empresas.js` (no en `empresasPublic`), porque cada empresa ya tiene su hoja y su sello fijos en el diseño; y se añadieron las notas "Lo más importante que descubrí", la foto y la firma (colección `fotos`), que están en el boceto.

## GitHub Actions

| Workflow | Cuándo | Qué hace |
|---|---|---|
| `desplegar.yml` | Cada push a `main` o `sandbox` (y a mano) | Revisa la sintaxis del JavaScript, corre las pruebas de `firestore.rules` en el emulador (`pruebas/reglas.test.mjs`), publica las reglas en Firebase y despliega el sitio en GitHub Pages: `main` en la raíz y `sandbox` en `/sandbox/` (modo pruebas). En pull requests solo corre las pruebas. |
| `limpiar-datos.yml` | A mano: *Actions > Limpiar datos de prueba > Run workflow* | Borra estudiantes, sellos, asistencias, fotos y (opcional) las cuentas de los estudiantes. Conserva tokens de stands y mentores, fechas y cuentas de organizadores. Pide escribir `BORRAR`; con *simular* solo cuenta. |

Cada rama tiene su propio proyecto de Firebase (datos, cuentas y reglas aparte). `js/firebase-config.js` elige según la URL:

| Sitio | Rama | Proyecto | Secreto para publicar reglas |
|---|---|---|---|
| `/pasaporte/` | `main` | `pasaporte-itm` | `FIREBASE_SERVICE_ACCOUNT` |
| `/pasaporte/sandbox/` y `localhost` | `sandbox` | `sandbox-pasaporte` | `FIREBASE_SERVICE_ACCOUNT_SANDBOX` |

Para borrar los datos de prueba usa `limpiar-datos.yml` (por defecto sobre `sandbox-pasaporte`).

**Preparar el proyecto de pruebas (una sola vez):** en Cloud Shell, `bash setup-firebase.sh sandbox-pasaporte` (crea Firestore, publica las reglas, activa correo/contraseña y autoriza `appgenerales.github.io`); en la consola agrega el proveedor Google; luego `python3 tools/crear_admins.py --sandbox correo1 …` crea las cuentas de las organizadoras allí y agrega sus UID a `esAdmin()` (la lista sirve para los dos proyectos).

**Configuración (una sola vez):**

1. *Settings > Pages > Build and deployment > Source*: **GitHub Actions**.
2. Cuenta de servicio para Firebase. En Cloud Shell del proyecto:

   ```bash
   gcloud iam service-accounts create github-actions --display-name="GitHub Actions"
   for rol in roles/firebase.admin roles/serviceusage.serviceUsageConsumer; do
     gcloud projects add-iam-policy-binding pasaporte-itm \
       --member="serviceAccount:github-actions@pasaporte-itm.iam.gserviceaccount.com" --role="$rol" --condition=None
   done
   gcloud iam service-accounts keys create clave.json \
     --iam-account=github-actions@pasaporte-itm.iam.gserviceaccount.com
   cat clave.json && rm clave.json
   ```

3. Copia todo el JSON y guárdalo en *Settings > Secrets and variables > Actions > New repository secret* con el nombre **`FIREBASE_SERVICE_ACCOUNT`**. No lo subas al repositorio. Repite los pasos 2 y 3 en el proyecto `sandbox-pasaporte` (cambia `pasaporte-itm` por `sandbox-pasaporte` en los comandos) y guarda ese JSON como **`FIREBASE_SERVICE_ACCOUNT_SANDBOX`**.

Probar en local: `npm ci --prefix pruebas && npx firebase-tools emulators:exec --only firestore "node pruebas/reglas.test.mjs"` (requiere Java). La limpieza contra el emulador: `npm ci --prefix tools` y `npx firebase-tools emulators:exec --only firestore,auth "node tools/limpiar-datos.mjs --cuentas"`.

## Organizadores

- `hahiguit@gmail.com` entra con Google.
- Las demás cuentas son de correo y contraseña: `python3 tools/crear_admins.py correo1 correo2 …` las crea en Firebase (requiere *Correo electrónico/contraseña* activado), imprime las contraseñas y agrega sus UID a `esAdmin()` en `firestore.rules`. Después publica las reglas y agrega los correos a `ADMINS` en `js/firebase-config.js`.
- Para cambiar una contraseña: en `index.html` > "Ya tengo pasaporte" > "¿Olvidaste tu contraseña?", o desde la consola de Firebase.

## Listas de facultades y programas

Si cambia el Excel: `python3 tools/programas_desde_excel.py` regenera `js/programas.js`.

## Regenerar las imágenes desde el PDF

Si cambia el diseño en Canva, exporta el PDF con el mismo orden de páginas y ejecuta:

```bash
python3 tools/extraer_assets.py "imagenes_referencia/Pasaporte CUEE 2.0.pdf"
```

Requiere `pdftocairo` (poppler), Pillow y numpy. También genera la hoja del stand "Viajemos juntos" (`01b-viajemos.webp`, a partir de la imagen de WhatsApp de `imagenes_referencia/`) y su sello (`assets/sellos/viajemos.webp`, dibujado con Montserrat), y las plantillas de constancia de estudiante y mentor (a la de mentor le borra la línea de cédula). Si cambian las líneas de "Lo más importante que descubrí", ajusta `linea` en `js/empresas.js`. El script también corrige el "DESTINO 6" de la hoja de Colcafé a "DESTINO 8" (función `corregir_destino_8`, con Montserrat de `tools/fuentes/`, licencia OFL); si el PDF ya viene corregido, quita esa llamada.

## Créditos

Hojas con [StPageFlip](https://github.com/Nodlik/StPageFlip) (MIT, copia en `js/vendor/`), escáner con html5-qrcode y QR con qrcodejs.

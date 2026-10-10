# Pasaporte CUEE 2.0

Pasaporte digital de las Pasantías CUEE 2.0 (ITM). El estudiante abre su pasaporte en el celular, lo hojea como un libro y, al terminar la charla de cada empresa, escanea el QR del stand para que su hoja quede sellada.

- Diseño: las hojas son el boceto de Canva (`imagenes_referencia/Pasaporte CUEE 2.0.pdf`, páginas 1 a 6) y los sellos son las páginas 7 a 14.
- Especificación: `.remember/cue-pasaporte-spec.md`. Arquitectura: `imagenes_referencia/cue-pasaporte-arquitectura.drawio`.
- Costo cero: GitHub Pages + Firebase plan Spark (Auth anónima y Google, Firestore).

## Páginas

| Archivo | Para quién | Qué hace |
|---|---|---|
| `index.html` | Estudiante | Registro único (apellidos, nombres, programa, empresa opcional, correo o documento). |
| `pasaporte.html` | Estudiante | El libro: portada, hoja de datos, 8 destinos, misión cumplida y contraportada. Se pasa la hoja deslizando, con las flechas o con el teclado. |
| `scanner.html` | Estudiante | Escáner de QR. También sella si el QR se abre con la cámara normal del celular. |
| `admin.html` | Organizadores | Tabla de avance, búsqueda, exportación CSV y sorteo entre los pasaportes completos. |
| `tools/generar-qrs.html` | Organizadores | Crea el token secreto de cada empresa, muestra los QR para imprimir y permite rotarlos. |

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

1. **Firebase**: crea el proyecto, activa Firestore y en Authentication habilita los proveedores *Anónimo* y *Google*. En *Authentication > Settings > Authorized domains* agrega `<usuario>.github.io`.
2. **Configuración**: copia la configuración web en `js/firebase-config.js` y pon los correos de los organizadores en `ADMINS`.
3. **Reglas**: pon los mismos correos en `esAdmin()` de `firestore.rules` y publícalas (consola de Firebase > Firestore > Reglas, o `firebase deploy --only firestore:rules`). Sin reglas publicadas no hay protección.
4. **GitHub Pages**: *Settings > Pages > Deploy from a branch > main / (root)*.
5. **QR**: entra a `tools/generar-qrs.html` con una cuenta organizadora. La primera vez crea los tokens en `empresas/{id}`. Imprime un QR por stand.
6. **Prueba**: registra un estudiante en Android y otro en iPhone, sella un par de stands y revisa `admin.html`.

## El día del evento

- Cada stand muestra su QR impreso. El estudiante lo escanea con "Escanear sello" o con la cámara del celular.
- Si alguien llega al QR sin registrarse, primero se registra y el sello se aplica solo al terminar.
- Escanear dos veces la misma empresa no duplica el sello.
- Si un QR se filtra, rota el token en `tools/generar-qrs.html` y cambia el impreso.
- Al cierre: `admin.html` > filtro *Completos* > *Sortear ganador*. *Exportar CSV* descarga el listado (abre directo en Excel).
- Los organizadores deben usar `admin.html` en un navegador distinto al de su propio pasaporte: iniciar sesión con Google reemplaza la sesión anónima de estudiante.

## Datos

- `estudiantes/{uid}`: nombres, apellidos, programa, empresa, contacto, notas por destino, fecha de registro.
- `sellos/{uid}_{empresaId}`: uid, empresaId, token, ts. El ID compuesto impide sellos repetidos.
- `empresas/{empresaId}`: nombre, orden, token (solo organizadores).
- La foto y la firma se guardan solo en el celular del estudiante (localStorage); no se suben.

Cambios respecto a la especificación: el catálogo de empresas vive en `js/empresas.js` (no en `empresasPublic`), porque cada empresa ya tiene su hoja y su sello fijos en el diseño; y se añadieron las notas "Lo más importante que descubrí", la foto y la firma, que están en el boceto.

## Regenerar las imágenes desde el PDF

Si cambia el diseño en Canva, exporta el PDF con el mismo orden de páginas y ejecuta:

```bash
python3 tools/extraer_assets.py "imagenes_referencia/Pasaporte CUEE 2.0.pdf"
```

Requiere `pdftocairo` (poppler), Pillow y numpy. Si cambian las líneas de "Lo más importante que descubrí", ajusta `linea` en `js/empresas.js`.

## Créditos

Hojas con [StPageFlip](https://github.com/Nodlik/StPageFlip) (MIT, copia en `js/vendor/`), escáner con html5-qrcode y QR con qrcodejs.

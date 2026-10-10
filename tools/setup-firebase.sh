#!/usr/bin/env bash
# Configura Firebase para el Pasaporte CUEE 2.0 desde Cloud Shell.
# Se puede correr varias veces: lo que ya existe no se toca.
set -euo pipefail

PROJECT="pasaporte-itm"
ADMINS="hahiguit@gmail.com"          # correos organizadores, separados por coma
DOMINIO="appgenerales.github.io"     # dominio de GitHub Pages
UBICACION="nam5"                     # ubicación de Firestore (NO se puede cambiar después)

gcloud config set project "$PROJECT" >/dev/null
TOKEN="$(gcloud auth print-access-token)"
api() {
  local metodo=$1 url=$2; shift 2
  curl -sS -X "$metodo" "$url" \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-goog-user-project: $PROJECT" \
    -H "Content-Type: application/json" "$@"
}
campo() { python3 -c 'import json,sys; d=json.load(sys.stdin); print(eval(sys.argv[1], {"d": d}))' "$1"; }

echo "== 1/6 Activando APIs (puede tardar un minuto)"
gcloud services enable firebase.googleapis.com firestore.googleapis.com \
  identitytoolkit.googleapis.com firebaserules.googleapis.com

echo "== 2/6 Firebase en el proyecto"
if api GET "https://firebase.googleapis.com/v1beta1/projects/$PROJECT" | grep -q '"projectId"'; then
  echo "   ya estaba"
else
  api POST "https://firebase.googleapis.com/v1beta1/projects/$PROJECT:addFirebase" -d '{}' >/dev/null
  echo "   agregado, esperando..."; sleep 25
fi

echo "== 3/6 Base de datos Firestore"
if gcloud firestore databases describe --database='(default)' >/dev/null 2>&1; then
  echo "   ya existía"
else
  gcloud firestore databases create --database='(default)' --location="$UBICACION" --type=firestore-native
fi

echo "== 4/6 Reglas de seguridad"
cat > /tmp/firestore.rules <<'REGLAS'
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Organizadores: cuentas de Google verificadas, o cuentas de correo y
    // contraseña identificadas por su UID (las crea tools/crear_admins.py).
    // Por UID y no por correo, para que nadie se registre con ese correo y
    // quede como administrador. Mantener sincronizado con ADMINS en js/firebase-config.js.
    function esAdmin() {
      return request.auth != null && (
        (request.auth.token.email_verified == true
          && request.auth.token.email in [__ADMINS__])
        || request.auth.uid in [/*ADMIN_UIDS*/]);
    }

    function texto(v, max) {
      return v is string && v.size() <= max;
    }

    // Tokens secretos de cada stand. Los estudiantes nunca los leen;
    // las reglas de /sellos los consultan con get().
    match /empresas/{id} {
      allow read, write: if esAdmin();
    }

    match /estudiantes/{uid} {
      function propio() {
        return request.auth != null && request.auth.uid == uid;
      }
      function valido() {
        let d = request.resource.data;
        return d.keys().hasOnly(['cedula', 'nombres', 'apellidos', 'nombre', 'programa', 'facultad', 'empresa', 'contacto', 'mentor', 'autorizaDatos', 'notas', 'creadoEn'])
          && texto(d.nombres, 80) && texto(d.apellidos, 80) && texto(d.nombre, 161)
          && texto(d.programa, 120) && texto(d.empresa, 120) && texto(d.contacto, 120)
          // cédula y facultad son opcionales para los registrados antes de pedirlas
          && (!('cedula' in d) || (d.cedula is string && d.cedula.matches('[0-9]{0,15}')))
          && (!('facultad' in d) || texto(d.facultad, 120))
          && (!('mentor' in d) || texto(d.mentor, 60))
          && (!('autorizaDatos' in d) || d.autorizaDatos == true)
          && d.notas is map && d.notas.size() <= 8;
      }
      allow read: if propio() || esAdmin();
      allow create: if propio() && valido() && request.resource.data.creadoEn == request.time;
      allow update: if propio() && valido() && request.resource.data.creadoEn == resource.data.creadoEn;
      allow delete: if esAdmin();
    }

    // Foto y firma del titular (data URL), aparte del perfil para que la
    // tabla de admin no descargue imágenes.
    match /fotos/{uid} {
      allow read: if (request.auth != null && request.auth.uid == uid) || esAdmin();
      allow create, update: if request.auth != null && request.auth.uid == uid
        && request.resource.data.keys().hasOnly(['foto', 'firma', 'actualizado'])
        && (!('foto' in request.resource.data) || texto(request.resource.data.foto, 150000))
        && (!('firma' in request.resource.data) || texto(request.resource.data.firma, 100000))
        && request.resource.data.actualizado == request.time;
      allow delete: if esAdmin();
    }

    // Ventana (inicio, fin) de cada día del evento.
    match /dias/{id} {
      allow read, write: if esAdmin();
    }

    // Token secreto del QR de cada mentor.
    match /mentores/{id} {
      allow read, write: if esAdmin();
    }

    // Un documento por estudiante y día: {uid}_{diaId}. Se marca con el QR
    // de un mentor y solo durante ese día (hora del servidor).
    match /asistencias/{aid} {
      function diaVigente(d) {
        let dia = get(/databases/$(database)/documents/dias/$(d.dia)).data;
        let mentor = get(/databases/$(database)/documents/mentores/$(d.mentor)).data;
        return d.token == mentor.token && request.time >= dia.inicio && request.time < dia.fin;
      }
      allow get: if esAdmin() || (request.auth != null && aid.matches(request.auth.uid + '_.+'));
      allow list: if esAdmin() || (request.auth != null && resource.data.uid == request.auth.uid);
      allow create: if request.auth != null
        && request.resource.data.keys().hasOnly(['uid', 'dia', 'mentor', 'token', 'ts'])
        && request.resource.data.uid == request.auth.uid
        && aid == request.auth.uid + '_' + request.resource.data.dia
        && request.resource.data.ts == request.time
        && exists(/databases/$(database)/documents/estudiantes/$(request.auth.uid))
        && diaVigente(request.resource.data);
      allow update: if false;
      allow delete: if esAdmin();
    }

    // Un documento por estudiante y empresa: {uid}_{empresaId}.
    match /sellos/{sealId} {
      // get funciona aunque el documento no exista (para saber si ya estaba sellado).
      allow get: if esAdmin() || (request.auth != null && sealId.matches(request.auth.uid + '_.+'));
      allow list: if esAdmin() || (request.auth != null && resource.data.uid == request.auth.uid);
      allow create: if request.auth != null
        && request.resource.data.keys().hasOnly(['uid', 'empresaId', 'token', 'ts'])
        && request.resource.data.uid == request.auth.uid
        && sealId == request.auth.uid + '_' + request.resource.data.empresaId
        && request.resource.data.ts == request.time
        && exists(/databases/$(database)/documents/estudiantes/$(request.auth.uid))
        && request.resource.data.token ==
           get(/databases/$(database)/documents/empresas/$(request.resource.data.empresaId)).data.token;
      allow update: if false;
      allow delete: if esAdmin();
    }
  }
}
REGLAS
CUERPO=$(python3 - "$ADMINS" <<'PY'
import json, sys
correos = [c.strip() for c in sys.argv[1].split(',') if c.strip()]
fuente = open('/tmp/firestore.rules').read().replace('__ADMINS__', ', '.join("'%s'" % c for c in correos))
print(json.dumps({"source": {"files": [{"name": "firestore.rules", "content": fuente}]}}))
PY
)
RESP=$(api POST "https://firebaserules.googleapis.com/v1/projects/$PROJECT/rulesets" -d "$CUERPO")
RULESET=$(echo "$RESP" | campo 'd.get("name", "")')
if [ -z "$RULESET" ]; then echo "   ERROR al compilar las reglas:"; echo "$RESP"; exit 1; fi
REL="projects/$PROJECT/releases/cloud.firestore"
if api GET "https://firebaserules.googleapis.com/v1/$REL" | grep -q '"rulesetName"'; then
  api PATCH "https://firebaserules.googleapis.com/v1/$REL" \
    -d "{\"release\":{\"name\":\"$REL\",\"rulesetName\":\"$RULESET\"}}" >/dev/null
else
  api POST "https://firebaserules.googleapis.com/v1/projects/$PROJECT/releases" \
    -d "{\"name\":\"$REL\",\"rulesetName\":\"$RULESET\"}" >/dev/null
fi
echo "   publicadas (organizadores: $ADMINS)"

echo "== 5/6 Authentication: correo/contraseña y dominio autorizado"
CFG_URL="https://identitytoolkit.googleapis.com/admin/v2/projects/$PROJECT/config"
CFG=$(api GET "$CFG_URL")
if echo "$CFG" | grep -q '"authorizedDomains"'; then
  CUERPO=$(echo "$CFG" | python3 -c '
import json, sys
d = json.load(sys.stdin); dom = sys.argv[1]
doms = d.get("authorizedDomains", [])
if dom not in doms: doms.append(dom)
print(json.dumps({"signIn": {"anonymous": {"enabled": True}, "email": {"enabled": True, "passwordRequired": True}}, "authorizedDomains": doms}))' "$DOMINIO")
  api PATCH "$CFG_URL?updateMask=signIn.anonymous.enabled,signIn.email.enabled,signIn.email.passwordRequired,authorizedDomains" -d "$CUERPO" >/dev/null
  echo "   correo/contraseña activado, $DOMINIO autorizado"
  AUTH_OK=1
else
  echo "   Authentication aún no está iniciado en este proyecto."
  AUTH_OK=0
fi

echo "== 6/6 App web y configuración"
listar() { api GET "https://firebase.googleapis.com/v1beta1/projects/$PROJECT/webApps" | campo '(d.get("apps") or [{}])[0].get("appId", "")'; }
APPID=$(listar)
if [ -z "$APPID" ]; then
  api POST "https://firebase.googleapis.com/v1beta1/projects/$PROJECT/webApps" \
    -d '{"displayName":"Pasaporte CUEE web"}' >/dev/null
  for i in $(seq 1 20); do sleep 3; APPID=$(listar); [ -n "$APPID" ] && break; done
fi
echo
echo "================ Pega esto en js/firebase-config.js ================"
api GET "https://firebase.googleapis.com/v1beta1/projects/$PROJECT/webApps/$APPID/config" | python3 -c '
import json, sys
c = json.load(sys.stdin)
print("export const firebaseConfig = {")
for k in ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"]:
    print("  %s: %r," % (k, c.get(k, "")))
print("};")'
echo "===================================================================="
echo
echo "Falta un paso manual en la consola (no se puede por API sin crear credenciales a mano):"
echo "  https://console.firebase.google.com/project/$PROJECT/authentication/providers"
[ "$AUTH_OK" = 0 ] && echo "  - Pulsa 'Comenzar' y vuelve a correr este script para activar Anónimo y el dominio."
echo "  - Agrega el proveedor Google (elige tu correo de asistencia) y Guardar."

"""Crea las cuentas de correo y contraseña de los organizadores del panel y
pone sus UID en esAdmin() de firestore.rules (y en tools/setup-firebase.sh).

Requiere que en Firebase esté activado Authentication > Correo electrónico/contraseña.
Uso: python3 tools/crear_admins.py [--sandbox] correo1 correo2 ...
     --sandbox crea las cuentas en el proyecto de pruebas (sandbox-pasaporte).
Los UID de ambos proyectos van en la misma lista de esAdmin().
Imprime correo, contraseña y UID. Las contraseñas solo se muestran aquí: guárdalas.
Después hay que publicar firestore.rules.
"""
import json, pathlib, re, secrets, sys, urllib.error, urllib.request

RAIZ = pathlib.Path(__file__).resolve().parent.parent
PALABRAS = ['Vuelo', 'Brujula', 'Destino', 'Mapa', 'Ruta', 'Avion', 'Pasaje', 'Viaje', 'Rumbo', 'Escala']


def api_key(sandbox):
    texto = (RAIZ / 'js' / 'firebase-config.js').read_text()
    bloque = re.search(r"const %s = \{(.*?)\}" % ('PRUEBAS' if sandbox else 'PRODUCCION'), texto, re.S).group(1)
    return re.search(r"apiKey: '([^']+)'", bloque).group(1)


def crear(correo, clave, key):
    req = urllib.request.Request(
        f'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={key}',
        data=json.dumps({'email': correo, 'password': clave, 'returnSecureToken': True}).encode(),
        headers={'Content-Type': 'application/json'})
    try:
        return json.load(urllib.request.urlopen(req))['localId'], None
    except urllib.error.HTTPError as e:
        return None, json.load(e)['error']['message']


def poner_uids(uids):
    for archivo in [RAIZ / 'firestore.rules', RAIZ / 'tools' / 'setup-firebase.sh']:
        texto = archivo.read_text()
        actual = re.search(r"request\.auth\.uid in \[(.*?)\]", texto)
        previos = re.findall(r"'([^']+)'", actual.group(1)) if actual else []
        todos = previos + [u for u in uids if u not in previos]
        lista = '/*ADMIN_UIDS*/' + ', '.join(f"'{u}'" for u in todos)
        texto = re.sub(r"request\.auth\.uid in \[.*?\]", f"request.auth.uid in [{lista}]", texto)
        archivo.write_text(texto)


def main(correos):
    sandbox = '--sandbox' in correos
    correos = [c for c in correos if c != '--sandbox']
    key = api_key(sandbox)
    uids = []
    for correo in correos:
        clave = f'{secrets.choice(PALABRAS)}{secrets.randbelow(9000) + 1000}'
        uid, error = crear(correo.strip().lower(), clave, key)
        if uid:
            uids.append(uid)
            print(f'{correo}\t{clave}\t{uid}')
        else:
            print(f'{correo}\tERROR {error}')
    if uids:
        poner_uids(uids)
        print(f'\n{len(uids)} UID agregados a firestore.rules. Publica las reglas.')


if __name__ == '__main__':
    main(sys.argv[1:])

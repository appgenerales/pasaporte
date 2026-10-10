"""Regenera js/programas.js desde el Excel de facultades y programas.

Uso: python3 tools/programas_desde_excel.py ["imagenes_referencia/Facultades-Programas.xlsx"]
El Excel debe tener la columna A = Programa y B = Facultad, con encabezado.
"""
import html, json, pathlib, re, sys, zipfile

RAIZ = pathlib.Path(__file__).resolve().parent.parent


def leer(xlsx):
    z = zipfile.ZipFile(xlsx)
    textos = [html.unescape(re.sub(r'<[^>]+>', '', m)) for m in re.findall(r'<si>(.*?)</si>', z.read('xl/sharedStrings.xml').decode(), re.S)]
    hoja = z.read('xl/worksheets/sheet1.xml').decode()
    facultades = {}
    for fila in re.findall(r'<row[^>]*>(.*?)</row>', hoja, re.S)[1:]:
        valores = []
        for _, attrs, dentro in re.findall(r'<c r="([A-Z]+)\d+"([^>]*?)(?:/>|>(.*?)</c>)', fila, re.S):
            v = re.search(r'<v>(.*?)</v>', dentro or '')
            valor = v.group(1) if v else ''
            if 't="s"' in attrs and valor:
                valor = textos[int(valor)]
            valores.append(valor.strip())
        if len(valores) < 2 or not valores[0]:
            continue
        programa, facultad = valores[0], valores[1]
        if programa.endswith('Móviles-Virtua'):  # viene cortado en el Excel
            programa = programa.replace('Móviles-Virtua', 'Móviles - Virtual')
        facultades.setdefault(facultad, []).append(programa)
    return facultades


def main(xlsx):
    fac = leer(xlsx)
    lineas = ['// Generado desde imagenes_referencia/Facultades-Programas.xlsx',
              '// (tools/programas_desde_excel.py). Facultad -> programas, en orden alfabético.',
              'export const PROGRAMAS = {']
    for f in sorted(fac):
        lineas.append(f'  {json.dumps(f, ensure_ascii=False)}: [')
        lineas += [f'    {json.dumps(p, ensure_ascii=False)},' for p in sorted(fac[f], key=str.lower)]
        lineas.append('  ],')
    lineas += ['};', '', 'export const FACULTADES = Object.keys(PROGRAMAS);']
    (RAIZ / 'js' / 'programas.js').write_text('\n'.join(lineas) + '\n')
    print(f'{sum(map(len, fac.values()))} programas en {len(fac)} facultades')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else RAIZ / 'imagenes_referencia' / 'Facultades-Programas.xlsx')

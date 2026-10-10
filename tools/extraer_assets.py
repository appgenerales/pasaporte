"""Genera las imágenes del pasaporte a partir del PDF de Canva.

Uso: python3 tools/extraer_assets.py "imagenes_referencia/Pasaporte CUEE 2.0.pdf"
Requiere poppler (pdftocairo), Pillow y numpy.
"""
import subprocess, sys, tempfile, pathlib
import numpy as np
from PIL import Image

RAIZ = pathlib.Path(__file__).resolve().parent.parent
PAG = RAIZ / "assets" / "paginas"
SEL = RAIZ / "assets" / "sellos"

# (página del PDF, mitad) -> nombre, en el orden en que se lee el libro
PAGINAS = [
    (1, "der", "00-portada"),
    (2, "izq", "01-datos"),
    (2, "der", "02-destino-1"),
    (3, "izq", "03-destino-2"),
    (3, "der", "04-destino-3"),
    (4, "izq", "05-destino-4"),
    (4, "der", "06-destino-5"),
    (5, "izq", "07-destino-6"),
    (5, "der", "08-destino-7"),
    (6, "izq", "09-destino-8"),
    (6, "der", "10-mision"),
    (1, "izq", "11-contraportada"),
]
SELLOS = {7: "epm", 8: "isa", 9: "colcafe", 10: "renting",
          11: "proteccion", 12: "texmaquila", 13: "haceb", 14: "cardiovid"}


def render(pdf, pagina, dpi, destino, transp=False):
    args = ["pdftocairo", "-png", "-singlefile", "-r", str(dpi), "-f", str(pagina), "-l", str(pagina)]
    if transp:
        args.append("-transp")
    subprocess.run(args + [pdf, str(destino)], check=True)
    return Image.open(str(destino) + ".png").convert("RGBA")


def blanco_a_alfa(img):
    """Quita el fondo blanco conservando el color de la tinta (como 'color to alpha')."""
    a = np.asarray(img).astype(np.float32) / 255.0
    rgb = a[..., :3]
    alfa = 1.0 - rgb.min(axis=2)
    alfa = np.clip(alfa * 1.15, 0, 1)
    seguro = np.maximum(alfa, 1e-4)[..., None]
    color = np.clip((rgb - (1 - seguro)) / seguro, 0, 1)
    out = np.dstack([color, alfa]) * 255
    out = Image.fromarray(out.astype(np.uint8), "RGBA")
    return out.crop(out.getbbox())


def main(pdf):
    PAG.mkdir(parents=True, exist_ok=True)
    SEL.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        cache = {}
        for pagina, mitad, nombre in PAGINAS:
            if pagina not in cache:
                cache[pagina] = render(pdf, pagina, 200, tmp / f"p{pagina}").convert("RGB")
            img = cache[pagina]
            w, h = img.size
            caja = (0, 0, w // 2, h) if mitad == "izq" else (w // 2, 0, w, h)
            img.crop(caja).save(PAG / f"{nombre}.webp", quality=82, method=6)
            print("página", nombre)
        for pagina, nombre in SELLOS.items():
            img = render(pdf, pagina, 100, tmp / f"s{pagina}")
            sello = blanco_a_alfa(img)
            sello.thumbnail((640, 640))
            sello.save(SEL / f"{nombre}.webp", quality=88, method=6)
            print("sello", nombre, sello.size)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else str(RAIZ / "imagenes_referencia" / "Pasaporte CUEE 2.0.pdf"))

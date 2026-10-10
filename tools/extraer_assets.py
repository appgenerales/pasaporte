"""Genera las imágenes del pasaporte y de la constancia a partir de los PDF de Canva.

Uso: python3 tools/extraer_assets.py ["pasaporte.pdf" ["constancias.pdf"]]
Requiere poppler (pdftocairo), Pillow y numpy.
"""
import subprocess, sys, tempfile, pathlib
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

RAIZ = pathlib.Path(__file__).resolve().parent.parent
PAG = RAIZ / "assets" / "paginas"
SEL = RAIZ / "assets" / "sellos"
CON = RAIZ / "assets" / "constancia"
PDF_PASAPORTE = RAIZ / "imagenes_referencia" / "Pasaporte CUEE 2.0.pdf"
PDF_CONSTANCIAS = RAIZ / "imagenes_referencia" / "Constancias CUEE 2.0 2006-2.pdf"
# Página del PDF de constancias -> nombre (1 = estudiante, 2 = mentor, 3 = empresa)
CONSTANCIAS = {1: "estudiante", 2: "mentor"}

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


def corregir_destino_8(img):
    """El boceto dice "DESTINO 6" en la hoja de Colcafé; debe decir 8.
    Borra el 6 (rellenando con el fondo de nubes) y escribe un 8 en Montserrat Bold.
    Coordenadas para la hoja a 200 dpi (1100x1700)."""
    x0, y0, x1, y1 = 913, 221, 966, 288          # caja del "6"
    a = np.asarray(img).astype(np.float32)
    zona = (slice(y0 - 6, y1 + 7), slice(x0 - 6, x1 + 7))
    oscuro = np.zeros(a.shape[:2], bool)
    oscuro[zona] = a[zona].sum(axis=2) < 600
    mascara = Image.fromarray((oscuro * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))
    hueco = np.asarray(mascara) > 0
    color = np.median(a[zona][a[zona].sum(axis=2) < 300], axis=0)

    # Relleno por difusión: cada pasada promedia los vecinos conocidos.
    valido = (~hueco).astype(np.float32)
    rgb = a * valido[..., None]
    for _ in range(60):
        suma = np.asarray(Image.fromarray(np.uint8(np.clip(rgb, 0, 255))).filter(ImageFilter.BoxBlur(3))).astype(np.float32)
        peso = np.asarray(Image.fromarray(np.uint8(valido * 255)).filter(ImageFilter.BoxBlur(3))).astype(np.float32) / 255
        estimado = suma / np.maximum(peso[..., None], 1e-3)
        rgb = np.where(hueco[..., None], estimado * (peso[..., None] > 0.05), a)
        valido = np.where(hueco, (peso > 0.05).astype(np.float32), 1.0)
    out = Image.fromarray(np.uint8(np.clip(rgb, 0, 255)))

    fuente = ImageFont.truetype(str(RAIZ / "tools" / "fuentes" / "Montserrat-VariableFont.ttf"), 100)
    fuente.set_variation_by_name("Bold")
    alto = y1 - y0 + 1
    for tam in range(80, 130):  # tamaño cuyo 8 mide lo mismo que el 6 original
        fuente = fuente.font_variant(size=tam)
        fuente.set_variation_by_name("Bold")
        caja = fuente.getbbox("8")
        if caja[3] - caja[1] >= alto:
            break
    cx = (x0 + x1) / 2
    d = ImageDraw.Draw(out)
    d.text((cx - (caja[0] + caja[2]) / 2, y1 + 1 - caja[3]), "8", font=fuente, fill=tuple(int(c) for c in color))
    return out


IMG_VIAJEMOS = RAIZ / "imagenes_referencia" / "WhatsApp Image 2026-10-09 at 11.09.46 PM.jpeg"


def hoja_desde_imagen(origen, destino, ancho=1100, alto=1700, escala=1.15, recorte_sup=40):
    """Lleva una imagen vertical 9:16 al formato de hoja (1100x1700).
    La amplía, recorta un poco arriba y abajo (sin tocar los textos) y completa
    los costados reflejando el borde de la propia imagen, desenfocado."""
    img = Image.open(origen).convert("RGB")
    w, h = round(img.width * escala), round(img.height * escala)
    img = img.resize((w, h), Image.LANCZOS).crop((0, recorte_sup, w, recorte_sup + alto))
    hoja = Image.new("RGB", (ancho, alto))
    izq = (ancho - w) // 2
    if izq > 0:
        franja = 48
        borde_i = img.crop((0, 0, franja, alto)).transpose(Image.FLIP_LEFT_RIGHT).filter(ImageFilter.GaussianBlur(6))
        borde_d = img.crop((w - franja, 0, w, alto)).transpose(Image.FLIP_LEFT_RIGHT).filter(ImageFilter.GaussianBlur(6))
        hoja.paste(borde_i.resize((izq + 2, alto)), (0, 0))
        hoja.paste(borde_d.resize((ancho - izq - w + 2, alto)), (izq + w - 2, 0))
    hoja.paste(img, (izq, 0))
    hoja.save(destino, quality=84, method=6)
    print("página", pathlib.Path(destino).name, hoja.size)


def sello_viajemos(destino):
    """Sello del stand "Viajemos juntos" (no viene en el PDF): mismo estilo de
    tinta que los de las empresas, con doble marco, texto y bordes gastados."""
    W, H = 900, 620
    fuente = RAIZ / "tools" / "fuentes" / "Montserrat-VariableFont.ttf"
    capa = Image.new("L", (W, H), 0)  # alfa del marco
    texto = Image.new("L", (W, H), 0)  # alfa del texto
    d = ImageDraw.Draw(capa)
    d.rounded_rectangle((30, 40, W - 30, H - 40), radius=70, outline=255, width=22)
    d.rounded_rectangle((70, 80, W - 70, H - 80), radius=42, outline=255, width=8)
    dt = ImageDraw.Draw(texto)
    grande = ImageFont.truetype(str(fuente), 132)
    grande.set_variation_by_name("ExtraBold")
    chica = ImageFont.truetype(str(fuente), 54)
    chica.set_variation_by_name("Bold")
    for txt, f, y in (("VIAJEMOS", grande, 200), ("JUNTOS", grande, 350), ("CUEE 2.0", chica, 470)):
        dt.text((W / 2, y), txt, font=f, fill=255, anchor="mm")
    # Estrellas a los lados de "CUEE 2.0" (la fuente no trae el carácter ★).
    import math
    for cx in (W / 2 - 190, W / 2 + 190):
        pts = [(cx + (26 if k % 2 == 0 else 11) * math.sin(k * math.pi / 5),
                470 - (26 if k % 2 == 0 else 11) * math.cos(k * math.pi / 5)) for k in range(10)]
        dt.polygon(pts, fill=255)
    # Desgaste: manchas sin tinta, más fuertes en el marco.
    rng = np.random.default_rng(2026)
    ruido = Image.fromarray((rng.random((H // 6, W // 6)) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
    ruido = np.asarray(ruido.filter(ImageFilter.GaussianBlur(2))).astype(np.float32) / 255
    finos = rng.random((H, W)) > 0.035
    a_marco = np.asarray(capa).astype(np.float32) / 255 * (ruido > 0.32) * finos
    a_texto = np.asarray(texto).astype(np.float32) / 255 * (ruido > 0.12)
    rgba = np.zeros((H, W, 4), np.float32)
    marco_rgb, texto_rgb = np.array([138, 152, 184]), np.array([96, 125, 156])
    alfa = np.clip(a_marco + a_texto, 0, 1)
    peso = a_texto / np.maximum(alfa, 1e-4)
    rgba[..., :3] = marco_rgb * (1 - peso[..., None]) + texto_rgb * peso[..., None]
    rgba[..., 3] = alfa * 255
    img = Image.fromarray(rgba.astype(np.uint8), "RGBA").rotate(-8, resample=Image.BICUBIC, expand=True)
    img = img.crop(img.getbbox())
    img.thumbnail((640, 640))
    img.save(destino, quality=88, method=6)
    print("sello viajemos", img.size)


def constancias(pdf):
    CON.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for pagina, nombre in CONSTANCIAS.items():
            img = render(pdf, pagina, 200, pathlib.Path(tmp) / f"c{pagina}").convert("RGB")
            if nombre == "mentor":
                # La constancia de mentor va sin cédula: se borra "Identificado(a) con C.C:" y su línea.
                ImageDraw.Draw(img).rectangle((800, 776, 1960, 822), fill=(255, 255, 255))
            img.save(CON / f"{nombre}.webp", quality=88, method=6)
            print("constancia", nombre, img.size)


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
            hoja = img.crop(caja)
            if nombre == "09-destino-8":
                hoja = corregir_destino_8(hoja)
            hoja.save(PAG / f"{nombre}.webp", quality=82, method=6)
            print("página", nombre)
        for pagina, nombre in SELLOS.items():
            img = render(pdf, pagina, 100, tmp / f"s{pagina}")
            sello = blanco_a_alfa(img)
            sello.thumbnail((640, 640))
            sello.save(SEL / f"{nombre}.webp", quality=88, method=6)
            print("sello", nombre, sello.size)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else str(PDF_PASAPORTE))
    constancias(sys.argv[2] if len(sys.argv) > 2 else str(PDF_CONSTANCIAS))
    if IMG_VIAJEMOS.exists():
        hoja_desde_imagen(IMG_VIAJEMOS, PAG / "01b-viajemos.webp")
    sello_viajemos(SEL / "viajemos.webp")

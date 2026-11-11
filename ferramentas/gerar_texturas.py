"""Gera as imagens de textura do Rio Zero (pasta texturas/).

Todas as texturas são desenhadas por este script, sem fotos nem arte de terceiros. As que cobrem
superfícies grandes (chão, paredes, tecidos) emendam sem costura: o ruído é periódico, então a borda
da direita continua na da esquerda e a de cima na de baixo, e a imagem pode se repetir pelo objeto.

Uso:  python ferramentas/gerar_texturas.py
Precisa de numpy e Pillow.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

PASTA = Path(__file__).resolve().parent.parent / "texturas"
PASTA.mkdir(exist_ok=True)


# ------------------------------------------------------------------------------------------------
# Ruídos periódicos (emendam nas bordas)
# ------------------------------------------------------------------------------------------------
def ruido(n, celulas, semente):
    """Ruído de valor suave, n x n pixels, com 'celulas' pontos sorteados por lado."""
    rng = np.random.default_rng(semente)
    g = rng.random((celulas, celulas))
    coord = np.arange(n) * celulas / n
    i0 = np.floor(coord).astype(int)
    f = coord - i0
    f = f * f * (3 - 2 * f)
    i1 = (i0 + 1) % celulas
    a = g[np.ix_(i0, i0)]
    b = g[np.ix_(i0, i1)]
    c = g[np.ix_(i1, i0)]
    d = g[np.ix_(i1, i1)]
    fy = f[:, None]
    fx = f[None, :]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def fbm(n, celulas, oitavas, semente):
    """Soma de ruídos cada vez mais finos (resultado entre 0 e 1)."""
    total = np.zeros((n, n))
    peso = 1.0
    soma = 0.0
    for o in range(oitavas):
        total += ruido(n, celulas * 2**o, semente + o) * peso
        soma += peso
        peso *= 0.5
    return total / soma


def worley(n, celulas, semente):
    """Células irregulares (pedrinhas): devolve F1, F2 e o centro da célula mais próxima."""
    rng = np.random.default_rng(semente)
    c = n / celulas
    jit = rng.random((celulas, celulas, 2)) * 0.8 + 0.1
    ys, xs = np.mgrid[0:n, 0:n].astype(float) + 0.5
    cy = np.floor(ys / c).astype(int)
    cx = np.floor(xs / c).astype(int)
    f1 = np.full((n, n), 1e9)
    f2 = np.full((n, n), 1e9)
    centro_x = np.zeros((n, n))
    centro_y = np.zeros((n, n))
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            ny, nx = cy + dy, cx + dx
            j = jit[ny % celulas, nx % celulas]
            px = (nx + j[..., 0]) * c
            py = (ny + j[..., 1]) * c
            d = np.hypot(xs - px, ys - py)
            menor = d < f1
            f2 = np.where(menor, f1, np.minimum(f2, d))
            centro_x = np.where(menor, px % n, centro_x)
            centro_y = np.where(menor, py % n, centro_y)
            f1 = np.where(menor, d, f1)
    return f1, f2, centro_x, centro_y


def cor(rgb):
    return np.array(rgb, dtype=float) / 255.0


def suave(a, b, x):
    """Transição suave de 0 (x <= a) a 1 (x >= b), sem borda dura."""
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def salvar(nome, img, qualidade=90):
    img = np.clip(img, 0, 1)
    if img.ndim == 2:
        img = np.stack([img] * 3, axis=-1)
    im = Image.fromarray((img * 255).round().astype(np.uint8))
    caminho = PASTA / nome
    if caminho.suffix == ".jpg":
        im.save(caminho, quality=qualidade)
    else:
        im.save(caminho, optimize=True)
    print(f"{nome:24s} {im.width}x{im.height}")
    return im


def tingir(base, rgb):
    return base[..., None] * cor(rgb)[None, None, :]


# ------------------------------------------------------------------------------------------------
# Cenário
# ------------------------------------------------------------------------------------------------
def calcadao():
    """Calçadão de Copacabana: pedrinhas portuguesas em ondas pretas e brancas (3 m por imagem)."""
    n = 512
    f1, f2, cxp, cyp = worley(n, 72, 11)
    # a onda é decidida no centro de cada pedrinha: cada pedra é inteira preta ou inteira branca
    fase = 2 * np.pi * (cyp / n) + 1.25 * np.sin(2 * np.pi * cxp / n)
    preta = np.sin(fase) > 0
    var = ruido(n, 72, 3)  # tom de cada pedra
    tom_pedra = np.interp(cxp + cyp * 7.0, [0, n * 8], [0, 1])
    branco = 0.86 + 0.08 * var[cyp.astype(int) % n, cxp.astype(int) % n] - 0.03 * tom_pedra
    preto = 0.11 + 0.06 * var[cyp.astype(int) % n, cxp.astype(int) % n]
    base = np.where(preta, preto, branco)
    # relevo: cada pedra é abaulada, e o rejunte entre elas é fundo e escuro
    c = n / 72
    abaulado = 1 - 0.18 * np.clip(f1 / (c * 0.75), 0, 1) ** 2
    rejunte = np.clip((f2 - f1) / 2.2, 0, 1)
    sujeira = fbm(n, 4, 4, 21)
    lum = base * abaulado * (0.55 + 0.45 * rejunte) * (0.9 + 0.15 * sujeira)
    rgb = np.stack([lum * 1.0, lum * 0.98, lum * 0.94], axis=-1)
    rgb = np.where(rejunte[..., None] < 0.5, cor((120, 112, 100)) * (0.7 + 0.3 * sujeira[..., None]), rgb)
    salvar("calcadao.png", rgb)
    altura = abaulado * rejunte
    salvar("calcadao_relevo.png", altura)


def asfalto():
    """Asfalto gasto: base escura, brita clara, manchas de óleo (4 m por imagem)."""
    n = 512
    rng = np.random.default_rng(5)
    base = 0.19 + 0.05 * (fbm(n, 8, 5, 31) - 0.5) + 0.04 * (rng.random((n, n)) - 0.5)
    brita = rng.random((n, n)) > 0.985
    base = np.where(brita, base + 0.12 + 0.1 * rng.random((n, n)), base)
    oleo = fbm(n, 3, 4, 41)
    base *= 1 - 0.18 * suave(0.55, 0.72, oleo)
    rgb = np.stack([base * 1.02, base * 1.0, base * 1.04], axis=-1)
    salvar("asfalto.jpg", rgb)


def areia():
    """Areia da praia com grãos e marcas de vento (3 m por imagem)."""
    n = 512
    rng = np.random.default_rng(8)
    grao = rng.random((n, n)) - 0.5
    torcao = fbm(n, 4, 3, 51)
    ys = np.arange(n)[:, None]
    marcas = 0.5 + 0.5 * np.sin(2 * np.pi * (ys / 42.667 + 1.6 * torcao))
    lum = 0.92 + 0.07 * grao + 0.06 * (fbm(n, 6, 4, 52) - 0.5) - 0.05 * marcas
    rgb = tingir(lum, (205, 180, 134))
    salvar("areia.jpg", rgb)


def reboco():
    """Reboco de fachada com marcas de chuva e a faixa de cada laje (6,4 m por imagem, dois andares).
    Fica em tons de cinza: a cor de cada prédio vem do material."""
    n = 512
    rng = np.random.default_rng(13)
    lum = 0.84 + 0.06 * (fbm(n, 8, 5, 61) - 0.5) + 0.03 * (rng.random((n, n)) - 0.5)
    # faixas das lajes (em v = 0,3125 e 0,8125, que caem entre as janelas)
    linhas = np.arange(n)[:, None]
    for v in (0.3125, 0.8125):
        y = int((1 - v) * n)
        faixa = (linhas >= y - 7) & (linhas <= y + 7)
        lum = np.where(faixa, lum * 0.9, lum)
        sombra = (linhas > y + 7) & (linhas < y + 14)
        lum = np.where(sombra, lum * 0.82, lum)
        # escorrido de chuva abaixo da laje
        colunas = ruido(n, 24, 70 + y)[0:1, :]
        dist = np.clip((linhas - (y + 7)) % n, 0, n)
        escorre = np.exp(-dist / (30 + 70 * colunas)) * suave(0.55, 0.8, colunas)
        lum -= 0.08 * escorre
    lum -= 0.06 * np.clip(fbm(n, 3, 3, 62) - 0.55, 0, 1) * 4
    salvar("reboco.jpg", lum)


def concreto():
    """Concreto das barricadas e do meio-fio, com poros e manchas (1 m por imagem)."""
    n = 256
    rng = np.random.default_rng(17)
    lum = 0.66 + 0.1 * (fbm(n, 6, 5, 81) - 0.5) + 0.04 * (rng.random((n, n)) - 0.5)
    poros = (rng.random((n, n)) > 0.992)
    lum = np.where(poros, lum * 0.55, lum)
    mancha = fbm(n, 2, 4, 82)
    lum *= 1 - 0.14 * suave(0.5, 0.7, mancha)
    salvar("concreto.jpg", lum)
    relevo = 0.6 + 0.4 * fbm(n, 12, 4, 83)
    relevo = np.where(poros, 0.1, relevo)
    salvar("concreto_relevo.png", relevo)


def madeira():
    """Tábuas verticais dos quiosques, com veio, frestas e pregos (1,5 m por imagem)."""
    n = 512
    tabuas = 6
    larg = n / tabuas
    xs = np.arange(n)[None, :]
    ys = np.arange(n)[:, None]
    indice = (xs // larg).astype(int)
    rng = np.random.default_rng(23)
    tom = rng.random(tabuas) * 0.18
    torcao = ruido(n, 8, 91)
    veio = 0.5 + 0.5 * np.sin((xs * 0.9 + 18 * torcao + indice * 13) * 0.55)
    fibras = ruido(n, 64, 92)[:, :] * 0.5 + fbm(n, 4, 3, 93) * 0.5
    lum = 0.82 - tom[indice] - 0.1 * veio - 0.08 * (fibras - 0.5)
    fresta = (xs % larg) < 3
    lum = np.where(fresta, 0.22, lum)
    rgb = tingir(lum, (176, 124, 74))
    for i in range(tabuas):
        for py in (26, n - 26):
            px = int(i * larg + larg / 2)
            rgb[py - 3:py + 3, px - 3:px + 3] = cor((60, 52, 48))
    salvar("madeira.jpg", rgb)


def telha():
    """Telhas de barro em fileiras (1 m por imagem)."""
    n = 256
    xs = np.arange(n)[None, :]
    ys = np.arange(n)[:, None]
    fileiras = 8
    alt = n / fileiras
    coluna = 32
    deslocamento = ((ys // alt) % 2) * (coluna / 2)
    u = ((xs + deslocamento) % coluna) / coluna
    v = (ys % alt) / alt
    curva = np.sin(np.pi * u) ** 0.6
    rng = np.random.default_rng(29)
    tom = rng.random((fileiras, n // coluna + 1))
    t = tom[(ys // alt).astype(int) % fileiras, ((xs + deslocamento) // coluna).astype(int) % (n // coluna + 1)]
    lum = (0.55 + 0.4 * curva) * (0.85 + 0.15 * t) * (1 - 0.35 * (v > 0.86))
    lum *= 0.92 + 0.12 * fbm(n, 6, 3, 101)
    rgb = tingir(lum, (182, 84, 52))
    salvar("telha.jpg", rgb)


def lataria():
    """Lataria velha, com riscos e ferrugem embaixo. Em cinza: a cor vem do carro."""
    n = 256
    rng = np.random.default_rng(31)
    lum = 0.9 + 0.05 * (fbm(n, 4, 4, 111) - 0.5)
    img = Image.fromarray((np.clip(lum, 0, 1) * 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    for _ in range(40):
        x, y = rng.random(2) * n
        ang = rng.random() * 0.6 - 0.3
        comp = 20 + rng.random() * 70
        tom = int(255 * (0.6 + 0.35 * rng.random()))
        d.line([(x, y), (x + comp * np.cos(ang), y + comp * np.sin(ang))], fill=tom, width=1)
    lum = np.asarray(img).astype(float) / 255
    ys = np.arange(n)[:, None] / n
    ferrugem = np.clip((ys - 0.7) * 3, 0, 1) * fbm(n, 8, 4, 112)
    rgb = np.stack([lum] * 3, axis=-1)
    rgb = rgb * (1 - ferrugem[..., None] * 0.9) + cor((120, 60, 28)) * ferrugem[..., None] * 0.9
    salvar("lataria.jpg", rgb)


def tronco():
    """Tronco de coqueiro: anéis e fibras (o cilindro dá a volta na imagem)."""
    n = 256
    ys = np.arange(n)[:, None]
    anel = (ys % 32) / 32
    sulco = np.exp(-((anel - 0.9) ** 2) / 0.004)
    fibras = ruido(n, 48, 121)
    lum = 0.75 - 0.35 * sulco - 0.12 * (fibras - 0.5) - 0.06 * fbm(n, 4, 3, 122)
    rgb = tingir(lum, (128, 100, 68))
    salvar("tronco.jpg", rgb)


# ------------------------------------------------------------------------------------------------
# Personagens
# ------------------------------------------------------------------------------------------------
def jeans():
    """Brim de sarja (linhas diagonais). Em cinza: cada calça tinge com a sua cor."""
    n = 256
    xs = np.arange(n)[None, :]
    ys = np.arange(n)[:, None]
    sarja = 0.5 + 0.5 * np.sin(2 * np.pi * (xs + ys) / 4)
    rng = np.random.default_rng(37)
    fio = rng.random((n, n))
    desbotado = fbm(n, 4, 4, 131)
    lum = 0.72 + 0.12 * sarja + 0.08 * (fio - 0.5) + 0.18 * (desbotado - 0.5)
    salvar("jeans.jpg", lum)


def couro():
    """Couro da jaqueta do Rafael: vincos e brilho gasto."""
    n = 256
    torcao = fbm(n, 4, 3, 141)
    vinco = np.abs(np.sin(2 * np.pi * (fbm(n, 3, 4, 142) * 3 + torcao)))
    poros = ruido(n, 128, 143)
    lum = 0.7 + 0.18 * (vinco - 0.5) * -1 + 0.06 * (poros - 0.5)
    gasto = np.clip(fbm(n, 5, 3, 144) - 0.5, 0, 1) * 0.6
    lum += gasto
    rgb = tingir(lum, (120, 86, 56))
    salvar("couro.jpg", rgb)


def malha():
    """Malha de camiseta (pontos em V). Em cinza: tinge com a cor da peça."""
    n = 256
    xs = np.arange(n)[None, :]
    ys = np.arange(n)[:, None]
    ponto = np.abs(((xs % 8) - 3.5) / 3.5) * 0.5 + ((ys + np.abs((xs % 8) - 3.5)) % 6) / 6 * 0.5
    rng = np.random.default_rng(41)
    lum = 0.82 + 0.1 * (ponto - 0.5) + 0.05 * (rng.random((n, n)) - 0.5) + 0.06 * (fbm(n, 4, 3, 151) - 0.5)
    salvar("malha.jpg", lum)


def camisa_rasgada():
    """Camisa de zumbi: malha suja, manchas de sangue seco e rasgos."""
    n = 256
    xs = np.arange(n)[None, :]
    ys = np.arange(n)[:, None]
    ponto = np.abs(((xs % 8) - 3.5) / 3.5) * 0.5 + ((ys + np.abs((xs % 8) - 3.5)) % 6) / 6 * 0.5
    sujeira = fbm(n, 5, 4, 161)
    lum = 0.9 + 0.08 * (ponto - 0.5) - 0.25 * np.clip(sujeira - 0.45, 0, 1) * 2
    rgb = np.stack([lum] * 3, axis=-1)
    sangue = fbm(n, 3, 5, 162)
    mancha = np.clip((sangue - 0.6) * 6, 0, 1)
    rgb = rgb * (1 - mancha[..., None]) + cor((70, 16, 14)) * mancha[..., None]
    img = Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    # rasgos: fendas compridas e irregulares, mais largas no meio
    rng = np.random.default_rng(43)
    for x, y, ang in ((70, 70, 0.35), (180, 150, 2.6), (95, 200, 1.9)):
        x += rng.random() * 10
        y += rng.random() * 10
        comp = 50 + rng.random() * 40
        lado = []
        outro = []
        for k in range(9):
            t = k / 8
            px = x + np.cos(ang) * comp * (t - 0.5) + rng.random() * 4 - 2
            py = y + np.sin(ang) * comp * (t - 0.5) + rng.random() * 4 - 2
            larg = 7 * np.sin(np.pi * t) + 1
            lado.append((px - np.sin(ang) * larg, py + np.cos(ang) * larg))
            outro.append((px + np.sin(ang) * larg, py - np.cos(ang) * larg))
        d.polygon(lado + outro[::-1], fill=(38, 28, 26))
    salvar("camisa_rasgada.png", np.asarray(img).astype(float) / 255)


def _rosto_base(pele, n=256):
    rng = np.random.default_rng(int(sum(pele)))
    lum = 1 + 0.05 * (fbm(n, 6, 4, 171) - 0.5) + 0.02 * (rng.random((n, n)) - 0.5)
    return tingir(lum, pele)


def rosto_rafael():
    """Rosto do Rafael, para a face da frente da cabeça (0,42 x 0,46 m). Os olhos e o nariz são
    peças do modelo; a textura traz sobrancelhas, olheiras, barba por fazer e a boca."""
    n = 256
    rgb = _rosto_base((201, 154, 114), n)
    img = Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    # barba por fazer: pontinhos na metade de baixo e nas laterais
    rng = np.random.default_rng(51)
    for _ in range(1500):
        x = rng.random() * n
        y = 130 + rng.random() * 126
        if 76 < x < 180 and y < 160:
            continue
        d.point((x, y), fill=(150, 108, 80))
    # olheiras em volta de onde ficam os olhos (u = 0,26 e 0,74; v = 0,59)
    for cx in (67, 189):
        d.ellipse([cx - 22, 92, cx + 22, 122], fill=(180, 134, 100))
    # sobrancelhas grossas, um pouco franzidas
    d.line([(44, 84), (68, 78), (92, 82)], fill=(48, 32, 24), width=8)
    d.line([(164, 82), (188, 78), (212, 84)], fill=(48, 32, 24), width=8)
    # boca
    d.line([(100, 202), (128, 205), (156, 202)], fill=(120, 64, 54), width=5)
    d.line([(108, 210), (148, 210)], fill=(170, 112, 90), width=3)
    # franja do cabelo no alto da testa
    d.rectangle([0, 0, n, 14], fill=(43, 27, 18))
    salvar("rosto_rafael.png", np.asarray(img).astype(float) / 255)


def rosto_zumbi():
    """Rosto de zumbi: pele esverdeada, veias, olhos fundos, boca aberta com dentes e a ferida."""
    n = 256
    rgb = _rosto_base((143, 163, 145), n)
    img = Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    # veias: linhas longas e finas que descem pelas têmporas e bochechas, quase da cor da pele
    rng = np.random.default_rng(61)
    for x0 in (14, 30, 226, 242, 120):
        x, y = x0 + rng.random() * 8, 20 + rng.random() * 30
        pontos = [(x, y)]
        for _ in range(10):
            x += rng.random() * 6 - 3
            y += 8 + rng.random() * 6
            pontos.append((x, y))
        d.line(pontos, fill=(108, 122, 128), width=2)
    for cx in (67, 189):
        d.ellipse([cx - 26, 86, cx + 26, 128], fill=(64, 52, 60))
    d.line([(46, 80), (90, 86)], fill=(52, 50, 44), width=5)
    d.line([(166, 86), (210, 80)], fill=(52, 50, 44), width=5)
    # boca aberta, com dentes amarelados
    d.polygon([(88, 190), (168, 188), (160, 222), (96, 224)], fill=(40, 16, 18))
    for i in range(7):
        x = 94 + i * 10
        d.rectangle([x, 190, x + 7, 199], fill=(214, 200, 150))
        d.rectangle([x + 2, 214, x + 8, 222], fill=(200, 186, 138))
    # sangue escorrendo da boca e a ferida da bochecha direita (u = 0,74; v = 0,24)
    d.line([(150, 222), (154, 252)], fill=(96, 14, 14), width=5)
    d.ellipse([168, 172, 214, 206], fill=(110, 22, 20))
    d.ellipse([178, 180, 204, 198], fill=(60, 10, 12))
    d.rectangle([0, 0, n, 12], fill=(59, 47, 47))
    salvar("rosto_zumbi.png", np.asarray(img).astype(float) / 255)


# ------------------------------------------------------------------------------------------------
# Grade UV para a demonstração do mapeamento
# ------------------------------------------------------------------------------------------------
def grade_uv():
    """Grade 8 x 8 com letra (coluna, eixo u) e número (linha, eixo v). As cores crescem com u
    (vermelho) e com v (verde), então dá para ler a coordenada de qualquer ponto do objeto."""
    n = 512
    img = Image.new("RGB", (n, n))
    d = ImageDraw.Draw(img)
    try:
        fonte = ImageFont.load_default(size=22)
        fonte_peq = ImageFont.load_default(size=16)
    except TypeError:
        fonte = fonte_peq = ImageFont.load_default()
    cel = n // 8
    for linha in range(8):  # linha 0 = v perto de 0 = parte de baixo da imagem
        for col in range(8):
            u = (col + 0.5) / 8
            v = (linha + 0.5) / 8
            claro = (col + linha) % 2 == 0
            r = int(70 + 150 * u)
            g = int(70 + 150 * v)
            b = 150 if claro else 90
            x0, y0 = col * cel, n - (linha + 1) * cel
            d.rectangle([x0, y0, x0 + cel - 1, y0 + cel - 1], fill=(r, g, b))
            d.text((x0 + cel / 2, y0 + cel / 2), f"{'ABCDEFGH'[col]}{linha + 1}", fill=(255, 255, 255),
                   font=fonte, anchor="mm")
    for i in range(9):
        d.line([(i * cel, 0), (i * cel, n)], fill=(255, 255, 255), width=2)
        d.line([(0, i * cel), (n, i * cel)], fill=(255, 255, 255), width=2)
    d.text((n - 8, n - 6), "u →", fill=(255, 255, 255), font=fonte_peq, anchor="rs")
    d.text((8, 8), "v ↑", fill=(255, 255, 255), font=fonte_peq, anchor="lt")
    salvar("grade_uv.png", np.asarray(img).astype(float) / 255)


def catalogo():
    """Folha com todas as texturas lado a lado, para o relatório."""
    arquivos = sorted(p for p in PASTA.iterdir() if p.suffix in (".png", ".jpg"))
    lado = 180
    colunas = 6
    linhas = (len(arquivos) + colunas - 1) // colunas
    folha = Image.new("RGB", (colunas * (lado + 16) + 16, linhas * (lado + 40) + 16), (245, 245, 247))
    d = ImageDraw.Draw(folha)
    try:
        fonte = ImageFont.load_default(size=15)
    except TypeError:
        fonte = ImageFont.load_default()
    for i, arq in enumerate(arquivos):
        im = Image.open(arq).convert("RGB").resize((lado, lado))
        x = 16 + (i % colunas) * (lado + 16)
        y = 16 + (i // colunas) * (lado + 40)
        folha.paste(im, (x, y))
        d.text((x + lado / 2, y + lado + 8), arq.name, fill=(40, 40, 46), font=fonte, anchor="mt")
    destino = PASTA.parent / "relatorio" / "prints"
    destino.mkdir(parents=True, exist_ok=True)
    folha.save(destino / "texturas-catalogo.jpg", quality=90)
    print("catálogo salvo em relatorio/prints/texturas-catalogo.jpg")


if __name__ == "__main__":
    calcadao()
    asfalto()
    areia()
    reboco()
    concreto()
    madeira()
    telha()
    lataria()
    tronco()
    jeans()
    couro()
    malha()
    camisa_rasgada()
    rosto_rafael()
    rosto_zumbi()
    grade_uv()
    catalogo()

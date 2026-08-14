"""Tira o fundo verde de assets/green_background/*.png e grava em assets/icons/.

    python assets/build_icons.py            # processa o que mudou
    python assets/build_icons.py --force    # refaz tudo

Duas decisões que importam:

1. O fundo sai por preenchimento a partir das bordas, não por chave de cor
   global. Ícone que tem verde de verdade no meio (gema verde, escama de
   dragão, golpe de terra) ficaria furado com chave global.
2. O enquadramento do arquivo de entrada é preservado — nada de recortar e
   recentralizar. Assim um ícone enviado hoje combina com um enviado semana que
   vem, sem depender de um lote comum.
"""
import sys, os, glob
import cv2
import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
ENTRADA = os.path.join(AQUI, 'green_background')
SAIDA = os.path.join(AQUI, 'icons')
LADO = 128          # os ícones do jogo são exibidos entre 22 e 41 px
CORES = 64          # arte chapada: 64 cores não dá banding e corta ~90% do peso
TOL = 40            # tolerância do preenchimento, por canal
TOL_PRESO = 25      # bolsão preso é a cor CHAPADA do fundo; largo demais come
                    # roupa da mesma matiz (capuz verde a 73 do fundo verde)


def sem_fundo(caminho):
    img = cv2.imread(caminho, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise SystemExit('não consegui ler ' + caminho)
    if img.shape[2] == 4:                      # já tem alpha: respeita o que veio
        img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
    h, w = img.shape[:2]

    # cor do fundo = mediana das quatro quinas
    quinas = np.array([img[0, 0], img[0, -1], img[-1, 0], img[-1, -1]], np.float32)
    fundo = np.median(quinas, axis=0)

    mask = np.zeros((h + 2, w + 2), np.uint8)
    flags = 4 | (255 << 8) | cv2.FLOODFILL_MASK_ONLY | cv2.FLOODFILL_FIXED_RANGE
    for s in ([(x, y) for x in range(0, w, 4) for y in (0, h - 1)] +
              [(x, y) for y in range(0, h, 4) for x in (0, w - 1)]):
        if mask[s[1] + 1, s[0] + 1] == 0 and np.abs(img[s[1], s[0]].astype(np.float32) - fundo).max() <= TOL:
            cv2.floodFill(img, mask, s, 0, (TOL,) * 3, (TOL,) * 3, flags)
    bg = mask[1:-1, 1:-1] > 0
    if not bg.any():
        raise SystemExit('nenhum fundo encontrado em ' + os.path.basename(caminho))

    # Bolsões fechados: fundo cercado pelo próprio desenho (o vão entre a corda
    # e o arco, por exemplo) não é alcançado pela borda e ficaria verde opaco.
    # Casar pela cor exata do fundo resolve sem comer verde do desenho, que é
    # bem mais escuro — medido no ranger: fundo G=198, empunhadura G=70.
    preso = (np.abs(img.astype(np.float32) - fundo).max(axis=2) <= TOL_PRESO) & ~bg
    n_preso = int(preso.sum())
    bg |= preso

    alpha = np.full((h, w), 255, np.uint8)
    alpha[bg] = 0

    # faixa de transição: a borda do desenho é suavizada e mistura com o verde.
    # Só aqui o alpha vira parcial e o verde é removido — o miolo fica intacto.
    faixa = (cv2.dilate(bg.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0) & ~bg
    if faixa.any():
        d = np.linalg.norm(img[faixa].astype(np.float32) - fundo, axis=1)
        alpha[faixa] = np.clip(d / 90.0, 0, 1) * 255

        # despill: no meio da mistura o verde domina e deixaria auréola numa
        # célula escura. Puxa G para a média de R e B onde ele estourou.
        px = img[faixa].astype(np.float32)
        limite = (px[:, 0] + px[:, 2]) / 2                 # BGR: B e R
        px[:, 1] = np.minimum(px[:, 1], limite + 12)
        img[faixa] = px.astype(np.uint8)

    # Reduzir com alpha pré-multiplicado. Sem isso o resize mistura o RGB dos
    # pixels transparentes — que continuam verde-vivo — de volta na borda, e o
    # ícone ganha auréola verde sobre a célula escura do inventário.
    a = (alpha / 255.0)[:, :, None]
    pm = cv2.resize((img.astype(np.float32) * a), (LADO, LADO), interpolation=cv2.INTER_AREA)
    ar = cv2.resize(alpha, (LADO, LADO), interpolation=cv2.INTER_AREA)
    seguro = np.maximum(ar.astype(np.float32) / 255.0, 1e-6)[:, :, None]
    rgb = np.clip(pm / seguro, 0, 255).astype(np.uint8)
    return np.dstack([rgb, ar]), n_preso


def paletiza(caminho):
    from PIL import Image
    im = Image.open(caminho).convert('RGBA')
    im.quantize(colors=CORES, method=Image.FASTOCTREE).save(caminho, optimize=True)


def main():
    forcar = '--force' in sys.argv
    os.makedirs(SAIDA, exist_ok=True)
    fontes = sorted(glob.glob(os.path.join(ENTRADA, '*.png')))
    if not fontes:
        print('nada em', ENTRADA); return
    feitos = 0
    for src in fontes:
        nome = os.path.basename(src)
        dst = os.path.join(SAIDA, nome)
        if not forcar and os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
            continue
        icone, n_preso = sem_fundo(src)
        cv2.imwrite(dst, icone)
        paletiza(dst)
        print('%-22s %7.0f KB -> %5.1f KB%s' % (nome, os.path.getsize(src) / 1e3, os.path.getsize(dst) / 1e3,
              '   (%d px de fundo preso removidos)' % n_preso if n_preso else ''))
        feitos += 1
    print('%d de %d atualizados · %s' % (feitos, len(fontes), SAIDA))


if __name__ == '__main__':
    main()

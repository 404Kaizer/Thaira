"""Tira o cast OLIVA de uma armadura que deveria ser preta, poupando o dourado.

    python assets/corrige_oliva.py <pasta>            # so mostra e grava previa
    python assets/corrige_oliva.py <pasta> --aplicar  # regrava os PNGs

O gerador entregou a armadura do knight_commom em oliva escuro (matiz ~60 graus,
R aprox G, B bem abaixo) onde as outras folhas do jogo usam preto quase neutro.
Medido: o veteran nao tem NENHUM tom de 60 graus — os quentes dele ficam todos
entre 15 e 30 graus, que e marrom de couro.

O que separa a armadura do dourado NAO e o matiz, porque os dois sao amarelados:
e o BRILHO. O ouro do debrum e claro e saturado; a placa e escura. Entao o corte
e por valor, e o limite tem folga dos dois lados.

Poupa tudo que nao for oliva escuro: pele, cabelo, couro (matiz abaixo de 45) e
o dourado (valor acima do teto) passam intactos.
"""
import sys, os, glob
import numpy as np
from PIL import Image

MATIZ = (38, 75)     # graus: MEDIDO no perfil do knight — 24,6%% do tronco cai aqui
                     # (contra 4,9%% na frente, que ja estava preta)
VALOR_MAX = .40      # acima disto e dourado, nao placa: o debrum mede ~.55,
                     # a placa oliva mede ~.13 de valor mediano
SAT_MIN = .10        # abaixo disto ja e neutro, nao ha o que corrigir
# alvo: quase neutro com um resto de calor, como o preto do veteran
CALOR = (1.03, .99, .96)


def hsv(a):
    r, g, b = a[..., 0] / 255., a[..., 1] / 255., a[..., 2] / 255.
    mx, mn = np.maximum.reduce([r, g, b]), np.minimum.reduce([r, g, b])
    d = np.where(mx - mn == 0, 1e-9, mx - mn)
    h = np.where(mx == r, (g - b) / d % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return h, np.where(mx == 0, 0, (mx - mn) / np.where(mx == 0, 1, mx)), mx


def corrige(png):
    im = Image.open(png).convert('RGBA')
    a = np.asarray(im).astype(float)
    h, s, v = hsv(a)
    alvo = (a[..., 3] > 16) & (h >= MATIZ[0]) & (h <= MATIZ[1]) & (v <= VALOR_MAX) & (s >= SAT_MIN)
    if not alvo.any():
        return im, 0.
    lum = (a[..., 0] * .299 + a[..., 1] * .587 + a[..., 2] * .114)
    for c in range(3):
        canal = a[..., c]
        canal[alvo] = np.clip(lum[alvo] * CALOR[c], 0, 255)
    return Image.fromarray(a.astype(np.uint8)), 100. * alvo.sum() / (a[..., 3] > 16).sum()


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    pasta = sys.argv[1].rstrip('/\\')
    aplicar = '--aplicar' in sys.argv
    nome = os.path.basename(pasta)
    pngs = sorted(glob.glob(os.path.join(pasta, nome + '_*.png')))
    if not pngs:
        print('nada em %s' % pasta)
        return
    antes, depois = [], []
    for p in pngs:
        novo, pct = corrige(p)
        print('  %-44s %5.1f%% dos pixels corrigidos' % (os.path.basename(p), pct))
        if os.path.basename(p).endswith('idle_front_01.png'):
            antes.append(Image.open(p).convert('RGBA'))
            depois.append(novo)
        if aplicar:
            novo.save(p)
    if antes:
        a, d = antes[0], depois[0]
        fol = Image.new('RGB', (a.width * 2 + 90, a.height + 60), (255, 0, 255))
        fol.paste(a, (30, 30), a)
        fol.paste(d, (a.width + 60, 30), d)
        saida = os.path.join(pasta, '_previa_oliva.png')
        fol.save(saida)
        print('previa (antes | depois): %s' % saida)
    print('GRAVADO' if aplicar else '(sem --aplicar: nada regravado)')


if __name__ == '__main__':
    main()

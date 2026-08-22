"""Recorta a folha de moedas em três montes e tinge os três metais.

    1. salve a folha em assets/skins/loot/coins.png (fundo magenta)
    2. python assets/build_coins.py
    3. python assets/build_skins.py --aplicar

O passo 2 grava 9 PNGs transparentes ao lado da folha; o passo 3 é o pipeline
de sempre, que os transforma em ícone e refaz src/icones.js. Dois comandos e
não um porque o de sempre não precisa saber que moeda existe.

TINGE EM HSV, não multiplica cor: multiplicar escurece o realce junto e a moeda
perde o brilho que faz ela ler como metal. Trocando só matiz e saturação, o
sombreado do desenho original fica inteiro — é a mesma peça em outro metal, que
é o pedido ("a cor de cada coin deve ser diferente, do mesmo png").

O RECORTE é por componente conexo do alfa, não por terços da largura: os montes
não têm a mesma largura nem espaçamento regular, e cortar em três pedaços iguais
decepava o monte grande. Componentes pequenos (respingo solto) são descartados.

O FUNDO é medido na folha, não presumido: a que veio tinha (224,3,219), não
magenta puro. Com a chave cravada em (255,0,255) o miolo passava raspando na
tolerância e a franja antisserrilhada da borda sobrevivia — era o ruído em volta
da moeda. E a máscara é ERODIDA alguns pixels antes de encolher: a franja é
mistura de moeda com fundo, então não há tom certo para ela; o jeito de não ter
halo é não levar a franja.

O TAMANHO RELATIVO entre os montes NÃO sai daqui: o build_skins.py normaliza
todo ícone para encher os 54px do slot, então qualquer escala gravada no arquivo
é desfeita no passo seguinte. Quem dá a moeda solta menor que a pilha é o CSS
(ver .ii-coin-1 no index.html), pela mesma régua do anel e da bota.
"""
import os, sys
import numpy as np
import cv2
from PIL import Image
from build_folhas import sombra_do_fundo

AQUI = os.path.dirname(os.path.abspath(__file__))
FOLHA = os.path.join(AQUI, 'skins', 'loot', 'coins.png')
SAIDA = os.path.join(AQUI, 'skins', 'loot')
LADO = 54                     # o mesmo vão de slot do resto dos ícones
MARGEM = 2                    # respiro em volta do recorte, em pixel do destino
TOL = 60                      # distância até a cor de fundo que ainda é fundo
ERODE = 3                     # pixels de franja comidos na resolução da folha

# nome do monte por quantidade: 1 moeda, um punhado, uma pilha
MONTES = ['1', 'few', 'many']
# (matiz 0-179 do OpenCV, fator de saturação, fator de brilho)
METAIS = {
    'gold':     (23, 1.00, 1.00),
    'platinum': (105, .16, 1.12),
    'crystal':  (95,  .55, 1.06),
}


def cor_de_fundo(rgb):
    """A cor mais comum da folha. É o fundo por construção: ele é a maior área."""
    cores, cont = np.unique(rgb.reshape(-1, 3), axis=0, return_counts=True)
    return cores[cont.argmax()].astype(np.int16)


def recorta_montes(caminho):
    im = Image.open(caminho).convert('RGBA')
    a = np.array(im)
    rgb, alfa = a[:, :, :3], a[:, :, 3]
    fundo_cor = cor_de_fundo(rgb)
    fundo = np.abs(rgb.astype(np.int16) - fundo_cor).max(axis=2) <= TOL
    vazio = fundo | (alfa < 40) | sombra_do_fundo(rgb, tuple(int(c) for c in fundo_cor), alfa)
    cheio = cv2.erode((~vazio).astype(np.uint8), np.ones((3, 3), np.uint8), iterations=ERODE)
    a[:, :, 3] = cheio * 255

    n, rot, stats, _ = cv2.connectedComponentsWithStats(cheio, 8)
    # descarta respingo: só entra quem tem pelo menos 2% da área do maior monte
    areas = stats[1:, cv2.CC_STAT_AREA]
    if not len(areas):
        sys.exit('a folha saiu vazia — o fundo é magenta puro?')
    corte = areas.max() * .02
    caixas = [stats[i + 1] for i in range(n - 1) if areas[i] >= corte]
    caixas.sort(key=lambda s: s[cv2.CC_STAT_LEFT])
    return a, caixas


def quadrado(a, caixa):
    """Recorta a caixa e centraliza no slot, sem esticar."""
    x, y, w, h = (caixa[cv2.CC_STAT_LEFT], caixa[cv2.CC_STAT_TOP],
                  caixa[cv2.CC_STAT_WIDTH], caixa[cv2.CC_STAT_HEIGHT])
    peca = Image.fromarray(a[y:y + h, x:x + w])
    útil = LADO - MARGEM * 2
    k = útil / max(w, h)
    peca = peca.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
    fora = Image.new('RGBA', (LADO, LADO), (0, 0, 0, 0))
    fora.paste(peca, ((LADO - peca.width) // 2, (LADO - peca.height) // 2))
    return fora


def tinge(img, matiz, fsat, fval):
    a = np.array(img)
    rgb, alfa = a[:, :, :3], a[:, :, 3]
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(np.float32)
    hsv[:, :, 0] = matiz
    hsv[:, :, 1] = np.clip(hsv[:, :, 1] * fsat, 0, 255)
    hsv[:, :, 2] = np.clip(hsv[:, :, 2] * fval, 0, 255)
    out = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)
    return Image.fromarray(np.dstack([out, alfa]))


def main():
    if not os.path.exists(FOLHA):
        sys.exit(f'não achei {FOLHA}\nsalve a folha de moedas ali (fundo magenta) e rode de novo.')
    a, caixas = recorta_montes(FOLHA)
    if len(caixas) != len(MONTES):
        sys.exit(f'achei {len(caixas)} monte(s) na folha, esperava {len(MONTES)} '
                 f'(1 moeda, punhado, pilha) — confira se os montes não se encostam.')
    for caixa, monte in zip(caixas, MONTES):
        peca = quadrado(a, caixa)
        for metal, (h, s, v) in METAIS.items():
            nome = f'{metal}_coin_{monte}.png'
            tinge(peca, h, s, v).save(os.path.join(SAIDA, nome))
            print('gravado', nome)
    print('\nagora rode: python assets/build_skins.py --aplicar')


if __name__ == '__main__':
    main()

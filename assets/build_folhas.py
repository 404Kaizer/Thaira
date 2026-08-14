"""Corta as folhas de arte (vários itens numa imagem só) em PNGs separados.

    python assets/build_folhas.py <folha.png>            # numera e mostra o mapa
    python assets/build_folhas.py <folha.png> --aplicar  # grava os recortes

Os recortes caem em assets/skins/_recortes/, que é entrada normal do
build_skins.py — então o caminho completo de uma folha nova é:

    python assets/build_folhas.py assets/skins/weapons/weapons_01.png --aplicar
    python assets/build_skins.py --aplicar

Como dizer qual item é qual: rode SEM --aplicar. O script separa os desenhos,
numera na ordem de leitura (esquerda→direita, cima→baixo) e imprime a grade.
Escolha os números que interessam e escreva um `<folha>.json` ao lado da folha:

    { "ids": { "sword": 5, "axe": 13, "bow": 1 } }

Só o que está no json é gravado — folha de 28 desenhos onde você quer 2 gera 2
arquivos, não 28.

Os desenhos são achados por cor de fundo, não por grade fixa: a folha pode ter
espaçamento irregular ou linha incompleta (shields_01 tem 4 numa fileira só) que
o resultado é o mesmo. O fundo é lido das quinas, então serve magenta, verde ou
o que o desenhista tiver usado.

CUIDADO — FOLHA DE CONJUNTO NÃO É FONTE DE ÍCONE GENÉRICO. As folhas em
sets/*_set.png são peças de um conjunto, com brasão e identidade própria. Tirar
delas o `armor` ou o `helmet` genérico faz TODA armadura sem arte virar a
armadura daquele conjunto — e brigar com o conjunto quando ele for implementado.
Genérico só sai de coleção avulsa: weapons/, loot/, shields. Peça de conjunto
vira ícone daquele conjunto (gg_armor, ah_boots), nunca do fallback.
"""
import sys, os, json
import numpy as np
import cv2
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, 'skins', '_recortes')
TOL = 60          # distância da cor de fundo que ainda conta como fundo
MIN_AREA = 400    # blob menor que isso é sujeira, não desenho
FOLGA = 3         # borda de respiro em volta do recorte


def separa(caminho):
    """Devolve [(x, y, w, h, imagem_rgba)] na ordem de leitura."""
    im = Image.open(caminho).convert('RGBA')
    a = np.array(im)
    rgb = a[:, :, :3].astype(np.int16)

    # fundo = mediana das quinas (magenta nestas folhas, mas não fica preso a isso)
    quinas = np.array([rgb[0, 0], rgb[0, -1], rgb[-1, 0], rgb[-1, -1]])
    fundo = np.median(quinas, axis=0)
    dist = np.abs(rgb - fundo).max(axis=2)
    tinta = ((dist > TOL) & (a[:, :, 3] > 40)).astype(np.uint8)

    # fecha vãos finos (a corda do arco, a teia) para o desenho não virar 5 pedaços
    tinta = cv2.morphologyEx(tinta, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    n, rot, stats, _ = cv2.connectedComponentsWithStats(tinta, 8)

    achados = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area < MIN_AREA:
            continue
        x0, y0 = max(0, x - FOLGA), max(0, y - FOLGA)
        x1, y1 = min(a.shape[1], x + w + FOLGA), min(a.shape[0], y + h + FOLGA)
        pedaco = a[y0:y1, x0:x1].copy()
        # o que era fundo vira transparente de verdade
        pr = pedaco[:, :, :3].astype(np.int16)
        pedaco[:, :, 3] = np.where(np.abs(pr - fundo).max(axis=2) > TOL, pedaco[:, :, 3], 0)
        achados.append([x, y, w, h, Image.fromarray(pedaco)])

    # ordem de leitura: agrupa por faixa horizontal, depois ordena por x
    achados.sort(key=lambda r: r[1])
    linhas, atual = [], []
    for r in achados:
        if atual and r[1] > atual[0][1] + atual[0][3] * 0.6:
            linhas.append(atual); atual = []
        atual.append(r)
    if atual:
        linhas.append(atual)
    fora = []
    for ln in linhas:
        fora.extend(sorted(ln, key=lambda r: r[0]))
    return fora


def main():
    arg = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not arg:
        print(__doc__)
        return
    folha = arg[0]
    aplicar = '--aplicar' in sys.argv
    pecas = separa(folha)
    cfg = {}
    jz = os.path.splitext(folha)[0] + '.json'
    if os.path.exists(jz):
        with open(jz, encoding='utf-8') as f:
            cfg = json.load(f)
    ids = {int(v): k for k, v in cfg.get('ids', {}).items()}

    print('%s — %d desenhos encontrados\n' % (os.path.basename(folha), len(pecas)))
    linha_atual, y_ant = [], None
    for i, (x, y, w, h, im) in enumerate(pecas, 1):
        if y_ant is not None and y > y_ant + h * 0.6:
            print('   ' + '  '.join(linha_atual)); linha_atual = []
        y_ant = y
        marca = ids.get(i)
        linha_atual.append('%2d%s' % (i, '=' + marca if marca else '  '))
    if linha_atual:
        print('   ' + '  '.join(linha_atual))

    if not ids:
        print('\nNenhum id escolhido. Crie %s com, por exemplo:' % os.path.basename(jz))
        print('   { "ids": { "sword": 5, "axe": 13 } }')
        return

    # Folha de conjunto grava na própria pasta do conjunto (vira peça de lá);
    # folha avulsa grava em _recortes. Assim o build_skins dá o prefixo certo.
    pasta_folha = os.path.dirname(os.path.abspath(folha))
    destino = pasta_folha if os.path.basename(pasta_folha).endswith('_set') else SAIDA
    os.makedirs(destino, exist_ok=True)
    print()
    for i, nome in sorted(ids.items()):
        if i < 1 or i > len(pecas):
            print('  %-16s numero %d nao existe nesta folha' % (nome, i))
            continue
        im = pecas[i - 1][4]
        dst = os.path.join(destino, nome + '.png')
        if aplicar:
            im.save(dst)
        print('  %-16s <- desenho %-3d %dx%d  %s' % (nome, i, im.size[0], im.size[1],
              'gravado' if aplicar else 'seria gravado'))
    print('\n%s · depois rode: python assets/build_skins.py --aplicar'
          % ('gravado em skins/_recortes' if aplicar else 'nada gravado (use --aplicar)'))


if __name__ == '__main__':
    main()

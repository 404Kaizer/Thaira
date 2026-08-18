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
CHAVE_BAIXO, CHAVE_ALTO = 24, 90   # faixa em que o pixel vai de fundo puro a tinta pura
# Quão perto da MATIZ do fundo um pixel escuro ainda é sombra dele. Medido na
# folha: sombra de maçã dá .22, e a tinta roxa mais próxima (o cristal do vazio)
# dá .35 — .26 separa os dois sem comer nenhum item roxo.
CHAVE_MATIZ = .26
MIN_AREA = 400    # blob menor que isso é sujeira, não desenho
FOLGA = 3         # borda de respiro em volta do recorte


def sombra_do_fundo(rgb, fundo, alfa=None):
    """Máscara do que é SOMBRA do fundo, não desenho.

    A sombra vem pintada como o fundo escurecido; como cor ela passa longe do
    fundo puro, então escapa da chave e sai um borrão magenta colado no item.
    Achar pela cor sozinha não serve: pixel quase preto tem matiz instável (R≈B,
    G≈0, que é a do magenta) e o preto do couro da bota ia junto. Então a cor só
    diz quem é CANDIDATO, e a geometria decide: sombra é candidato que se alcança
    a partir da borda da imagem, andando por fundo e por sombra. O que está
    cercado pelo desenho é desenho, por mais roxo que pareça.
    O limite de matiz foi medido na folha: sombra de maçã dá .22 e a tinta roxa
    mais próxima (cristal do vazio) dá .35."""
    rgb = rgb.astype(np.float32)
    b = np.asarray(fundo, dtype=np.float32)
    mx = np.maximum(rgb.max(axis=2), 1)
    dif = np.abs(rgb / mx[:, :, None] - b / max(b.max(), 1)).max(axis=2)
    cand = (dif < CHAVE_MATIZ) & (mx < b.max() * .8)
    # por onde o "lado de fora" passa: fundo puro, transparente e a própria sombra
    fora = cand | (np.abs(rgb - b).max(axis=2) <= TOL)
    if alfa is not None:
        fora |= alfa < 40
    fora = np.pad(fora, 1, constant_values=True)      # moldura, caso a sombra encoste na borda
    n, rot = cv2.connectedComponents(fora.astype(np.uint8), 4)
    return cand & (rot[1:-1, 1:-1] == rot[0, 0])


def chaveia(pedaco, fundo):
    """Tira o fundo do recorte, inclusive de quem está MISTURADO com ele.

    Zerar o alfa só onde a cor é exatamente o fundo deixa magenta na borda serrilhada
    e na sombra do desenho — os dois são mistura de tinta com fundo, então passam
    no teste de "não é fundo" e ficam com a cor errada e alfa cheio. Aqui o alfa
    sai da DISTÂNCIA até o fundo (0 = fundo puro, 1 = tinta pura) e a cor é
    desmisturada: C = a·F + (1-a)·B, então F = (C - (1-a)·B) / a. A sombra
    continua sombra, só que escura e translúcida em vez de rosa."""
    p = pedaco.astype(np.float32)
    b = np.asarray(fundo, dtype=np.float32)
    d = np.abs(p[:, :, :3] - b).max(axis=2)
    al = np.clip((d - CHAVE_BAIXO) / float(CHAVE_ALTO - CHAVE_BAIXO), 0, 1)
    al = np.where(sombra_do_fundo(p[:, :, :3], b), 0, al)
    a3 = al[:, :, None]
    cor = np.where(a3 > 0.004, (p[:, :, :3] - (1 - a3) * b) / np.maximum(a3, 0.004), p[:, :, :3])
    fora = np.empty_like(p)
    fora[:, :, :3] = np.clip(cor, 0, 255)
    fora[:, :, 3] = np.minimum(p[:, :, 3], al * 255)
    return fora.astype(np.uint8)


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
        achados.append([x, y, w, h, Image.fromarray(chaveia(a[y0:y1, x0:x1], fundo))])

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


def junta(pecas, nums):
    """Cola vários recortes num só, guardando a posição que tinham na folha.

    Bota é desenhada em PAR, e o separador entrega um pé em cada recorte porque
    entre eles há fundo. Colar de volta pelo x/y original mantém a distância e a
    altura de um para o outro — juntar encostando um no outro sairia torto."""
    itens = [pecas[n - 1] for n in nums]
    x0 = min(p[0] for p in itens); y0 = min(p[1] for p in itens)
    x1 = max(p[0] + p[4].width for p in itens); y1 = max(p[1] + p[4].height for p in itens)
    fora = Image.new('RGBA', (x1 - x0, y1 - y0), (0, 0, 0, 0))
    for x, y, w, h, im in itens:
        fora.alpha_composite(im, (x - x0, y - y0))
    return fora


def corta_metade(im, parte):
    """Fica com metade do recorte e reaperta no alfa."""
    w, h = im.size
    caixa = {'cima': (0, 0, w, h // 2), 'baixo': (0, h // 2, w, h),
             'esq': (0, 0, w // 2, h), 'dir': (w // 2, 0, w, h)}[parte]
    im = im.crop(caixa)
    # a metade descartada deixa lascas do vizinho na borda; fica só a mancha maior
    a = np.array(im)
    n, rot, stats, _ = cv2.connectedComponentsWithStats((a[:, :, 3] > 40).astype(np.uint8), 8)
    if n > 2:
        maior = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        a[:, :, 3] = np.where(rot == maior, a[:, :, 3], 0)
        im = Image.fromarray(a)
    b = im.split()[3].point(lambda v: 255 if v > 16 else 0).getbbox()
    return im.crop(b) if b else im


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
    # valor pode ser o número do desenho ou [número, metade]: às vezes dois
    # desenhos vizinhos saem no mesmo recorte (bota logo acima do escudo, e o
    # fecho de vãos finos gruda os dois). Aí se diz com qual metade ficar.
    ids, metade, juntar = {}, {}, {}
    for k, v in cfg.get('ids', {}).items():
        if isinstance(v, list) and len(v) > 1 and all(isinstance(x, int) for x in v):
            juntar[int(v[0])] = [int(x) for x in v]   # par de botas: um pé em cada recorte
            n, parte = v[0], None
        else:
            n, parte = (v, None) if isinstance(v, int) else (v[0], v[1])
        ids[int(n)] = k
        if parte:
            metade[int(n)] = parte

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
        if i in juntar:
            im = junta(pecas, juntar[i])
        if i in metade:
            im = corta_metade(im, metade[i])
        dst = os.path.join(destino, nome + '.png')
        if aplicar:
            im.save(dst)
        print('  %-16s <- desenho %-3d %dx%d  %s' % (nome, i, im.size[0], im.size[1],
              'gravado' if aplicar else 'seria gravado'))
    print('\n%s · depois rode: python assets/build_skins.py --aplicar'
          % ('gravado em skins/_recortes' if aplicar else 'nada gravado (use --aplicar)'))


if __name__ == '__main__':
    main()

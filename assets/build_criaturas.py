"""Monta a folha de animação de uma criatura a partir dos quadros soltos.

    python assets/build_criaturas.py            # confere e mostra o que mudaria
    python assets/build_criaturas.py --aplicar  # grava assets/creatures/<nome>.png

Entrada: assets/skins/creatures/<nome>/<nome>_<acao>_<lado>_<nn>.png, fundo
transparente. `acao` é idle ou walk, `lado` é front/left/back/right; os quadros
de tombado são <nome>_dead_<nn>.png. Quadro que falta é substituído: sem walk
repete o parado, e um lado sem arte sai espelhado do lado oposto.

Saída: uma folha com célula FIXA (mesma para toda criatura, é o que o art.js
sabe de cor), 3 colunas × 5 linhas:

    coluna  0 parado · 1 passo · 2 passo
    linha   0 sul · 1 oeste · 2 norte · 3 leste · 4 tombado

A ordem das linhas é a das direções do jogo (DIR_S, DIR_W, DIR_N, DIR_E). Cada
quadro é recortado no alfa, encolhido e colado com os PÉS na linha da base e o
corpo centrado — assim a âncora é a mesma em toda célula e o desenho não precisa
de tabela por quadro.

A escala sai por LADO, não por quadro: os quadros de um mesmo lado guardam a
diferença de altura entre si (que é a animação), mas frente, lado e costas
saem do mesmo tamanho mesmo tendo sido desenhados em resolução diferente.
"""
import sys, os, glob
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
ENTRADA = os.path.join(AQUI, 'skins', 'creatures')
SAIDA = os.path.join(AQUI, 'creatures')

CW, CH = 208, 248        # célula: o art.js repete estes três números
PES = 244                # linha do chão dentro da célula
ALVO_H, ALVO_W = 240, 200

LADOS = ['front', 'left', 'back', 'right']   # = DIR_S, DIR_W, DIR_N, DIR_E
ESPELHO = {'left': 'right', 'right': 'left'}


def recorta(p):
    im = Image.open(p).convert('RGBA')
    b = im.split()[3].point(lambda a: 255 if a > 16 else 0).getbbox()
    return im.crop(b) if b else None


def quadros(pasta, nome, lado):
    """[parado, passo, passo] em caminho de arquivo, já com os remendos."""
    def achar(acao):
        return sorted(glob.glob(os.path.join(pasta, '%s_%s_%s_*.png' % (nome, acao, lado))))
    parado, anda = achar('idle'), achar('walk')
    if not parado and not anda:
        return None
    a = (parado or anda)[0]
    b = anda[0] if anda else a
    c = anda[-1] if len(anda) > 1 else b     # o do meio, quando existe, é a perna passando
    return [a, b, c]


def linha(pasta, nome, lado):
    """[(imagem_recortada, espelhar)] × 3, ou None se nem o lado oposto existe."""
    q = quadros(pasta, nome, lado)
    if q:
        return [(recorta(f), False) for f in q]
    q = quadros(pasta, nome, ESPELHO.get(lado, ''))
    return [(recorta(f), True) for f in q] if q else None


def folha(pasta):
    nome = os.path.basename(pasta)
    linhas = [linha(pasta, nome, l) for l in LADOS]
    mortos = sorted(glob.glob(os.path.join(pasta, '%s_dead_*.png' % nome)))
    linhas.append([(recorta(f), False) for f in mortos[:3]] if mortos else None)

    saida = Image.new('RGBA', (CW * 3, CH * len(linhas)), (0, 0, 0, 0))
    relato = []
    for r, quadro in enumerate(linhas):
        if not quadro:
            relato.append((r, 'vazio', 0))
            continue
        # escala por linha: o maior quadro do lado é quem cabe na célula
        w = max(im.width for im, _ in quadro)
        h = max(im.height for im, _ in quadro)
        e = min(ALVO_H / h, ALVO_W / w)
        for c, (im, espelhar) in enumerate(quadro):
            d = im.resize((max(1, round(im.width * e)), max(1, round(im.height * e))), Image.LANCZOS)
            if espelhar:
                d = d.transpose(Image.FLIP_LEFT_RIGHT)
            saida.alpha_composite(d, (c * CW + (CW - d.width) // 2, r * CH + PES - d.height))
        relato.append((r, '%dx%d' % (round(w * e), round(h * e)), len(quadro)))
    return nome, saida, relato


def confere(im):
    """Nada pode vazar da célula nem flutuar acima da linha dos pés."""
    for r in range(im.height // CH):
        for c in range(3):
            b = im.crop((c * CW, r * CH, c * CW + CW, r * CH + CH)).split()[3].getbbox()
            assert not b or b[3] <= PES, 'quadro %d,%d passa da linha dos pés' % (r, c)


def main():
    aplicar = '--aplicar' in sys.argv
    pastas = [p for p in sorted(glob.glob(os.path.join(ENTRADA, '*'))) if os.path.isdir(p)]
    if not pastas:
        print('nada em %s' % ENTRADA)
        return
    for pasta in pastas:
        nome, im, relato = folha(pasta)
        confere(im)
        print('%s: %dx%d' % (nome, im.width, im.height))
        for r, tam, n in relato:
            print('  linha %d (%-5s) %-9s %d quadro(s)' % (r, (LADOS + ['dead'])[r], tam, n))
        dst = os.path.join(SAIDA, nome + '.png')
        if aplicar:
            os.makedirs(SAIDA, exist_ok=True)
            im.save(dst)
            print('  gravado em %s' % os.path.relpath(dst, os.path.dirname(AQUI)))
        else:
            print('  (sem --aplicar: nada gravado)')


if __name__ == '__main__':
    main()

"""Monta a folha de animação de uma criatura a partir dos quadros soltos.

    python assets/build_criaturas.py            # confere e mostra o que mudaria
    python assets/build_criaturas.py --aplicar  # grava assets/creatures/<nome>.png

Entrada: assets/skins/creatures/<nome>/<nome>_<acao>_<lado>_<nn>.png, fundo
transparente. `acao` é idle ou walk, `lado` é front/left/back/right; os quadros
de tombado são <nome>_dead_<nn>.png. Quadro que falta é substituído: sem walk
repete o parado, e um lado sem arte sai espelhado do lado oposto.

Saída: uma folha com célula FIXA (mesma para toda criatura, é o que o art.js
sabe de cor) e 5 linhas:

    coluna  os parados e depois os passos, na ordem dos arquivos
    linha   0 sul · 1 oeste · 2 norte · 3 leste · 4 tombado

TODO quadro da pasta entra — quem desenhou quatro passos vê os quatro. Quantos
são vai para `src/criaturas.js`, que o jogo carrega junto com o resto: sem essa
conta o art.js não teria como saber onde acaba o parado e começa o passo (ler
pixel não serve, abrir o jogo por file:// proíbe).

A ordem das linhas é a das direções do jogo (DIR_S, DIR_W, DIR_N, DIR_E). Cada
quadro é recortado no alfa, encolhido e colado com os PÉS na linha da base e o
corpo centrado — assim a âncora é a mesma em toda célula e o desenho não precisa
de tabela por quadro.

A escala é UMA para a criatura inteira: quadro agachado tem que sair menor que
quadro esticado, senão o bicho cresce e encolhe ao virar. Quem desenhou cada
lado numa resolução diferente (não dá para saber isso do desenho) marca isso
num `_conjunto.json` na pasta:

    { "escala": "lado" }    # cada lado se ajeita sozinho

"""
import sys, os, glob, json, io
from PIL import Image
import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
ENTRADA = os.path.join(AQUI, 'skins', 'creatures')
# As skins de VOCAÇÃO são a mesma folha com outro nome: quadros soltos, célula
# fixa, lida por creatureSheet(). Moram em skins/voc_<voca>/<skin>/ porque não
# são criatura, mas passam pelo mesmo moinho.
# O segundo nivel e a convencao (skins/voc_<voca>/<skin>/), mas a skin que serve
# a TODAS as vocacoes nao tem vocacao dona: ela mora direto em skins/voc_all_*.
# Os dois niveis entram, e pasta sem quadro nenhum ja e pulada com aviso.
RAIZES = [os.path.join(ENTRADA, '*'),
          os.path.join(AQUI, 'skins', 'voc_*', '*'),
          os.path.join(AQUI, 'skins', 'voc_*')]
SAIDA = os.path.join(AQUI, 'creatures')
TABELA = os.path.join(os.path.dirname(AQUI), 'src', 'criaturas.js')

CW, CH = 352, 248        # célula: o art.js repete estes três números
PES = 244                # linha do chão dentro da célula
ALVO_H, ALVO_W = 240, 340   # largo o bastante para o gigante de porrete e o corpo caído

LADOS = ['front', 'left', 'back', 'right']   # = DIR_S, DIR_W, DIR_N, DIR_E
LIMITE = 90              # o quanto um quadro pode escorregar atrás do corpo do primeiro
ESPELHO = {'left': 'right', 'right': 'left'}


def sem_farelo(im):
    """Apaga sobra do quadro VIZINHO: quem cortou os quadros de um atlas deixou
    faixas de outro desenho encostadas na borda, e elas flutuavam no ar ao lado
    do bicho. Só sai mancha solta que (a) toca a borda e (b) tem menos de 1% da
    mancha principal — detalhe solto no meio do desenho fica."""
    a = im.split()[3].point(lambda v: 255 if v > 16 else 0)
    w, h = a.size
    px = a.load()
    visto = [False] * (w * h)
    manchas = []
    for y0 in range(h):
        for x0 in range(w):
            if not px[x0, y0] or visto[y0 * w + x0]:
                continue
            fila, i, mancha, borda = [(x0, y0)], 0, [], False
            visto[y0 * w + x0] = True
            while i < len(fila):
                x, y = fila[i]; i += 1
                mancha.append((x, y))
                borda = borda or x == 0 or y == 0 or x == w - 1 or y == h - 1
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny] and not visto[ny * w + nx]:
                        visto[ny * w + nx] = True
                        fila.append((nx, ny))
            manchas.append((mancha, borda))
    if not manchas:
        return im
    maior = max(len(m) for m, _ in manchas)
    apaga = [m for m, borda in manchas if borda and len(m) < maior * .01]
    if apaga:
        al = im.split()[3]
        pa = al.load()
        for m in apaga:
            for x, y in m:
                pa[x, y] = 0
        im.putalpha(al)
    return im


def recorta(p):
    im = sem_farelo(Image.open(p).convert('RGBA'))
    b = im.split()[3].point(lambda a: 255 if a > 16 else 0).getbbox()
    return im.crop(b) if b else None


def quadros(pasta, nome, lado):
    """(parados, passos) em caminho de arquivo, já com os remendos."""
    def achar(acao):
        return sorted(glob.glob(os.path.join(pasta, '%s_%s_%s_*.png' % (nome, acao, lado))))
    parado, anda = achar('idle'), achar('walk')
    if not parado and not anda:
        return None
    return (parado or anda[:1]), (anda or parado)


def linha(pasta, nome, lado):
    """([(imagem, espelhar)], quantos são parados) ou None se nem o oposto existe."""
    q, espelhar = quadros(pasta, nome, lado), False
    if not q:
        q, espelhar = quadros(pasta, nome, ESPELHO.get(lado, '')), True
    if not q:
        # Sem o lado nem o oposto: usa a FRENTE. Linha vazia vira célula
        # transparente na folha, e o jogo desenha nada — boneco invisível ao
        # virar. Substituir já é a política do script (sem walk repete o parado);
        # o knight comum só foi desenhado de frente.
        q, espelhar = quadros(pasta, nome, 'front'), False
    if not q:
        return None
    parado, anda = q
    return [(recorta(f), espelhar) for f in parado + anda], len(parado)


def _mask(im):
    return np.asarray(im.split()[3]) > 16


def alinha(quadros):
    """dx de cada quadro para o CORPO cair no mesmo lugar do primeiro.

    O recorte apertado de cada PNG apagou a posição que os quadros tinham na
    folha original, e cada um centrado na própria caixa faz o bicho tremer de
    lado enquanto anda — o porrete esticado puxa a caixa para o lado dele. Aqui
    cada quadro escorrega até cobrir o máximo do primeiro: o que sobra de
    diferença é a animação (perna passando, braço subindo), não a caixa."""
    ref = _mask(quadros[0])
    fora = [0]
    for im in quadros[1:]:
        cur = _mask(im)
        h = min(ref.shape[0], cur.shape[0])           # os dois pisam na mesma linha
        a, b = ref[-h:], cur[-h:]
        # dx = 0 já é o dos dois centrados na caixa; procura em volta disso
        meio = (a.shape[1] - b.shape[1]) // 2
        melhor, quanto = 0, -1
        for dx in range(-LIMITE, LIMITE + 1):
            x = meio + dx
            ax0, bx0 = max(0, x), max(0, -x)
            n = min(a.shape[1] - ax0, b.shape[1] - bx0)
            if n <= 0:
                continue
            v = np.count_nonzero(a[:, ax0:ax0 + n] & b[:, bx0:bx0 + n])
            if v > quanto:
                melhor, quanto = dx, v
        fora.append(melhor)
    return fora


def _erode(m, k):
    for _ in range(k):
        e = m.copy()
        e[1:] &= m[:-1]; e[:-1] &= m[1:]
        e[:, 1:] &= m[:, :-1]; e[:, :-1] &= m[:, 1:]
        m = e
    return m


def eixo(im, k=9):
    """Eixo do TRONCO, que e quem pisa no tile.

    Nem a caixa nem o pe servem: a caixa vem esticada para o lado da arma, e o
    pe muda de lugar a cada quadro (ora um, ora os dois, e o porrete as vezes
    encosta no chao). O tronco fica. Ele sai por erosao: o cabo do porrete e
    fino e some com poucas passadas, a bola vira um caroco, o corpo aguenta.
    Depois ficam so as colunas grossas do que sobrou, e o eixo e o meio da
    maior sequencia delas."""
    m = _mask(im)
    e = _erode(m, k)
    if not e.any():
        e = m
    col = e.sum(axis=0)
    xs = np.where(col >= col.max() * .3)[0]
    grupos = np.split(xs, np.where(np.diff(xs) > 1)[0] + 1)
    g = max(grupos, key=len)
    return (g[0] + g[-1] + 1) / 2


def cabe(quadros):
    """Fator que faz o MAIOR quadro do grupo caber na célula."""
    w = max(im.width for im in quadros)
    h = max(im.height for im in quadros)
    return min(ALVO_H / h, ALVO_W / w)


def folha(pasta):
    nome = os.path.basename(pasta)
    linhas = [linha(pasta, nome, l) for l in LADOS]
    mortos = sorted(glob.glob(os.path.join(pasta, '%s_dead_*.png' % nome)))
    linhas.append(([(recorta(f), False) for f in mortos], 0) if mortos else None)
    if not any(linhas):
        return nome, None, [], None
    conj = json.load(open(os.path.join(pasta, '_conjunto.json'), encoding='utf-8'))         if os.path.exists(os.path.join(pasta, '_conjunto.json')) else {}
    por_lado = conj.get('escala') == 'lado'
    geral = cabe([im for q in linhas if q for im, _ in q[0]])
    cols = max(len(q[0]) for q in linhas if q)

    saida = Image.new('RGBA', (CW * cols, CH * len(linhas)), (0, 0, 0, 0))
    relato, conta = [], []
    for r, lin in enumerate(linhas):
        if not lin:
            relato.append((r, 'vazio', 0))
            conta.append([0, 0])
            continue
        quadro, n_parado = lin
        w = max(im.width for im, _ in quadro)
        h = max(im.height for im, _ in quadro)
        e = cabe([im for im, _ in quadro]) if por_lado else geral
        pronto = []
        for im, espelhar in quadro:
            d = im.resize((max(1, round(im.width * e)), max(1, round(im.height * e))), Image.LANCZOS)
            pronto.append(d.transpose(Image.FLIP_LEFT_RIGHT) if espelhar else d)
        # tombado não tem pé nem sequência: cada corpo é uma pose, centrado pela caixa
        if r == 4:
            fora, ajuste = [0] * len(pronto), 0
        else:
            fora = alinha(pronto)
            # A linha INTEIRA anda junto, e quem manda no meio do tile são as
            # poses PARADAS: bicho fica parado a maior parte do tempo, então é
            # ela que não pode estar torta. O passo ginga em volta dela, que é o
            # que corpo andando faz. Mediana, não média, para uma pose torta não
            # puxar a fileira.
            eixos = sorted((CW - d.width) / 2 + fora[c] + eixo(d)
                           for c, d in enumerate(pronto[:n_parado] or pronto))
            ajuste = round(CW / 2 - eixos[len(eixos) // 2])
        for c, d in enumerate(pronto):
            x = c * CW + min(max(0, round((CW - d.width) / 2 + fora[c] + ajuste)), CW - d.width)
            saida.alpha_composite(d, (x, r * CH + PES - d.height))
        relato.append((r, '%dx%d' % (round(w * e), round(h * e)), len(quadro)))
        conta.append([n_parado, len(quadro) - n_parado])
    quantos = {'linhas': conta[:4], 'morto': conta[4][1]}
    # os quadros de tombado ou são poses do mesmo corpo (sorteia uma) ou são o
    # bicho apodrecendo (passa por elas enquanto o corpo esfria). O desenho não
    # conta qual é: quem sabe é quem desenhou, no _conjunto.json da pasta
    if conj.get('tombado'):
        quantos['tombado'] = conj['tombado']
    return nome, saida, relato, quantos


def confere(im):
    """Nada pode vazar da célula, nada flutua acima da linha dos pés, e as
    quatro direções têm desenho — linha vazia é boneco invisível, e isso não
    dá erro nenhum na hora de jogar."""
    for r in range(min(4, im.height // CH)):
        assert im.crop((0, r * CH, CW, r * CH + CH)).split()[3].getbbox(),             'linha %d (%s) saiu vazia' % (r, LADOS[r])
    for r in range(im.height // CH):
        for c in range(im.width // CW):
            b = im.crop((c * CW, r * CH, c * CW + CW, r * CH + CH)).split()[3].getbbox()
            assert not b or b[3] <= PES, 'quadro %d,%d passa da linha dos pés' % (r, c)


def main():
    aplicar = '--aplicar' in sys.argv
    pastas = [p for r in RAIZES for p in sorted(glob.glob(r)) if os.path.isdir(p)]
    if not pastas:
        print('nada em %s' % ' nem '.join(RAIZES))
        return
    conta = {}
    for pasta in pastas:
        nome, im, relato, quantos = folha(pasta)
        if im is None:
            print('%s: sem quadro nenhum, pulado' % nome)
            continue
        confere(im)
        conta[nome] = quantos
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
    if aplicar and conta:
        corpo = ',\n'.join('  %s: %s' % (n, json.dumps(q)) for n, q in sorted(conta.items()))
        io.open(TABELA, 'w', encoding='utf-8').write(
            u'/* GERADO por assets/build_criaturas.py \u2014 n\u00e3o edite \u00e0 m\u00e3o.\n'
            u'   [parados, passos] de cada linha da folha, e quantos tombados existem.\n'
            u'   O art.js usa para saber em que coluna come\u00e7a o passo. */\n'
            u"'use strict';\nconst CRIA_FOLHA = {\n" + corpo + u'\n};\n')
        print('tabela em %s' % os.path.relpath(TABELA, os.path.dirname(AQUI)))


if __name__ == '__main__':
    main()

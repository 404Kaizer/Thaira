#!/usr/bin/env python3
"""build_terreno.py — recorta uma FOLHA de tiles de terreno e costura cada um
para que ladrilhe sem emenda.

    python assets/build_terreno.py assets/scenario/tiles_02.png --aplicar

A folha de origem mora em `assets/scenario/`, junto com as outras (tiles_01,
objects_*, trees_*). Uma segunda pasta de referência só criaria dúvida sobre
qual arquivo é a fonte de verdade.

O alvo é reaproveitar imagem gerada por IA como textura de chão. O que esta
leva mediu na primeira folha, e que vale para as próximas:

  * O CHROMA NÃO É CHAPADO. O fundo "magenta" varia de (211,12,208) a
    (230,5,224) — comparar por igualdade não recorta nada. A chave é por
    REGIÃO de cor: R e B altos, G baixo, R perto de B. A arte é verde, marrom e
    cinza, e nenhuma delas entra nessa região.

  * NÃO HÁ GRADE DE PIXEL. Medido: cada pixel difere do vizinho, corridas de
    cor idêntica de 1 px em 99% dos casos. A folha não é pixel art numa
    resolução nativa baixa — é imagem contínua que PARECE pixel art. Procurar o
    "pixel verdadeiro" para recortar 1:1 é perder tempo; o caminho é reduzir com
    filtro de área.

  * O TILE TEM BORDA SERRILHADA. Cada quadro vem com um contorno escuro
    irregular, que é bonito na folha e fatal no mapa: ladrilhado, ele desenha
    justamente a grade que não deve existir. A borda é ERODIDA fora, e só o
    miolo sólido é aproveitado.

  * COSTURA POR CROSS-FADE DE TRANSBORDO, e é ela que faz o tile fechar.
    Recorta-se N+b do miolo; as b primeiras colunas da saída são um
    esmaecimento entre a coluna N+i (o que vem DEPOIS da borda direita) e a
    coluna i. Assim a coluna N-1 desemboca naturalmente na coluna 0, que é o que
    "ladrilhar sem emenda" quer dizer. Mesma conta na vertical.

  * SAÍDA EM 96×96, e não em 32. O `tileTexture` do jogo devolve uma folha de
    96×96 que o render recorta por `x%3, y%3` — nove células de 32. Entregando
    96 costurado, as nove células saem DIFERENTES entre si e mesmo assim
    contínuas, e o mapa inteiro ladrilha sem emenda porque o 96 fecha em si.
    Entregar 32 daria a mesma célula nove vezes e o chão viraria papel de parede.
"""
import sys, os, json, glob
from PIL import Image, ImageFilter, PngImagePlugin
import numpy as np

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, 'assets', 'terreno')

# Nome de cada quadro, POR FOLHA e em ordem de leitura.
# Era uma lista solta, e isso era uma armadilha esperando: a lista abaixo é da
# tiles_02, então rodar `--aplicar` em qualquer outra folha gravaria os quadros
# dela por cima de `grama.png`, `terra.png` e das outras oito que já estão no
# jogo — sem erro e sem aviso, que é a pior forma de perder arte aprovada.
# Agora o nome é indexado pela folha, e folha sem lista sai numerada COM O NOME
# DELA na frente (`tiles_01_07`), então colidir passou a ser impossível.
NOMES = {
    'tiles_02.png': [
        'grama_clara', 'grama', 'grama_mata', 'grama_seca', 'grama_rala',
        'terra_escura', 'terra', 'cascalho', 'calcada', 'pedra',
    ],
}

TRABALHO = 192      # tamanho em que a costura acontece (múltiplo de 96 e de 32)
BANDA = 32          # largura do esmaecimento; TRABALHO+BANDA tem de caber no miolo
                    # 192+32=224, e os miolos medidos na primeira folha ficaram
                    # entre 254 e 260. A banda foi de 64 para 32 por duas
                    # medições: com 64 metade da folha era recusada por um ou
                    # dois pixels de falta, e o borrão que ela deixa é leve
                    # (contraste dentro da faixa entre 0,68 e 1,10 do de fora),
                    # então a banda larga não estava comprando nada — enquanto a
                    # sobra que ela consome é justamente a folga de que a busca
                    # de recorte abaixo precisa.
FINALISTAS = 60     # quantos candidatos da peneira grossa são reavaliados na saída
FINAL = 96          # o que o jogo consome: a folha 3×3 do tileTexture

# ESCALA é a correção de PROPORÇÃO, e ela é o número mais importante do arquivo.
# Cada quadro da folha é UM tile de chão — foi assim que a arte foi enquadrada.
# A primeira versão reduzia o quadro para 96 e entregava isso como folha, mas o
# motor lê a folha de 96 como NOVE tiles (recorte por x%3, y%3): um quadro
# passava a cobrir nove tiles e o motivo saía ampliado três vezes. Medido no
# calçamento, cujo passo dá para medir por autocorrelação: passo de 30 px num
# quadro de 285, ou seja 9,5 pedras por quadro; entregue daquele jeito, o tile
# do jogo mostrava 2,5 pedras, e o dono do projeto viu na hora — "parece que a
# pedra é maior que o personagem".
# Agora o quadro vira ESCALA pixels e a folha de 96 é ele LADRILHADO. Tem de
# dividir 96 e 192: 32 (3×3 por folha) e 48 (2×2) servem.
#
# 48 e não 32, e o que decidiu foi a MEDIÇÃO, não a densidade do Tibia. Em 32 o
# quadro vira exatamente um tile — a leitura literal do enquadramento —, e o
# resultado é pior em tudo que dá para medir: as nove células do `x%3` saem
# IDÊNTICAS (uma distinta de nove), o período de repetição no mapa cai para um
# tile, e a autocorrelação da grama e do cascalho passa a encontrar passo de
# 32 px, ou seja o motivo mais forte do chão vira A PRÓPRIA GRADE. Isso é papel
# de parede, e agora medido em vez de temido.
# Em 48: nove células distintas, período de 1,5 tile, autocorrelação sem período
# nenhum na grama e no cascalho, pedra de 5 px em vez de 3 (que é onde a forma
# ainda sobrevive — em 3 px não cabe contorno nem luz de um lado, que é a receita
# do #49), e a emenda até melhora, de 0,83–0,88 para 0,67–0,80.

ESCALA = 48         # quantos pixels de saída vale UM QUADRO da folha

# O miolo de qualquer folha é reamostrado para este tamanho antes da costura —
# ver `normaliza`. 257 é a mediana dos miolos de tiles_02.png, a folha que
# calibrou TRABALHO e BANDA, então para ela a normalização é quase identidade.
# MIOLO_MIN é o piso de arte de ORIGEM que ainda vale a pena: abaixo dele a
# ampliação para 257 passa de 3× e o tile de 48 sai de menos de 80 px de fonte.
MIOLO_ALVO = 257
MIOLO_MIN = 80



def mascara_arte(a):
    """True onde há ARTE. Ver a nota sobre o chroma no topo."""
    R, G, B = a[:, :, 0].astype(int), a[:, :, 1].astype(int), a[:, :, 2].astype(int)
    mag = (R > 150) & (B > 140) & (G < 90) & (np.abs(R - B) < 60)
    return ~mag


def faixas(v):
    out, ini = [], None
    for i, val in enumerate(v):
        if val and ini is None:
            ini = i
        elif not val and ini is not None:
            out.append((ini, i - 1)); ini = None
    if ini is not None:
        out.append((ini, len(v) - 1))
    return out


def quadros(a):
    """As caixas de cada tile, por projeção da máscara de arte."""
    art = mascara_arte(a)
    fc = [f for f in faixas(art.any(axis=0)) if f[1] - f[0] > 40]
    fr = [f for f in faixas(art.any(axis=1)) if f[1] - f[0] > 40]
    return [(x0, y0, x1, y1) for (y0, y1) in fr for (x0, x1) in fc]


def miolo_solido(a, caixa, folga=3):
    """Descarta a borda serrilhada e devolve o retângulo de arte CHEIA.

    Encolhe os quatro lados EM CONJUNTO até que as quatro bordas do retângulo
    corrente sejam inteiramente arte. A primeira versão testava "linha cheia" e
    "coluna cheia" de forma independente, e isso não converge: uma coluna
    atravessa o serrilhado de cima e o de baixo, então NENHUMA coluna do quadro
    é 100% arte enquanto as linhas de cima não tiverem saído. Medido na primeira
    folha: 24 linhas cheias e ZERO colunas cheias, e a erosão batia no teto e
    devolvia um miolo de 96×96 onde havia 250 de sobra.

    A `folga` corta alguns pixels a mais depois de fechar. O serrilhado é
    antialiasado: o pixel logo depois dele ainda carrega meio tom do contorno
    escuro, e meio tom de contorno é o bastante para desenhar a grade que a
    referência de Tibia justamente não tem.
    """
    x0, y0, x1, y1 = caixa
    art = mascara_arte(a[y0:y1 + 1, x0:x1 + 1])
    h, w = art.shape
    t, b, l, r = 0, h - 1, 0, w - 1
    for _ in range(max(h, w)):
        mudou = False
        if t < b and not art[t, l:r + 1].all():
            t += 1; mudou = True
        if b > t and not art[b, l:r + 1].all():
            b -= 1; mudou = True
        if l < r and not art[t:b + 1, l].all():
            l += 1; mudou = True
        if r > l and not art[t:b + 1, r].all():
            r -= 1; mudou = True
        if not mudou:
            break
    t += folga; b -= folga; l += folga; r -= folga
    return x0 + l, y0 + t, x0 + r, y0 + b


def costura(src):
    """Cross-fade de transbordo. `src` é (N+b)² e a saída é N² e LADRILHA.

    Dois passes, e cada um se prova sozinho.

    HORIZONTAL. A coluna i da saída, para i < b, é o esmaecimento entre a
    coluna N+i do source — o que CONTINUA depois da borda direita — e a própria
    coluna i:
        o[:, i] = (1-t)·src[:, N+i] + t·src[:, i],  t = i/(b-1)
    Em i=0 isso dá exatamente src[:, N]. E a última coluna, o[:, N-1], nunca foi
    tocada e vale src[:, N-1]. Ladrilhando, N-1 passa a ser vizinha de 0, ou
    seja src[:,N-1] encosta em src[:,N] — que eram vizinhas no source. Fecha.

    VERTICAL. A mesma conta nas linhas, aplicada SOBRE o resultado horizontal.
    Como cada linha dele já fecha na horizontal, e a saída é combinação convexa
    de duas dessas linhas, o fechamento horizontal sobrevive ao segundo passe.

    A primeira versão desta função tentou fazer os dois de uma vez, com um termo
    de canto, e saiu ilegível e errada. Dois passes em sequência é a mesma
    costura, provável linha a linha.
    """
    N, b = TRABALHO, BANDA
    s = src.astype(np.float64)
    t = (np.arange(b) / (b - 1.0))                              # 0 → 1

    # --- passe horizontal: mantém a altura N+b, largura vira N
    o = s[:, :N].copy()
    o[:, :b] = (1 - t)[None, :, None] * s[:, N:N + b] + t[None, :, None] * s[:, :b]

    # --- passe vertical: altura vira N
    p = o[:N, :].copy()
    p[:b, :] = (1 - t)[:, None, None] * o[N:N + b, :] + t[:, None, None] * o[:b, :]

    return np.clip(p, 0, 255).astype(np.uint8)


def normaliza(nucleo):
    """Põe o miolo no tamanho de trabalho, quadrado, seja qual for a folha.

    Sem isto o pipeline só serve para folhas com o enquadramento da primeira.
    Medido: `tiles_02.png` tem quadros de 285 px e miolos de 254 a 260, e as
    constantes foram afinadas contra eles (prec 224, ou 87% do miolo). Já
    `tiles_01.png` é 9×9 em 1254, ou seja 139 px por quadro, e o miolo sólido
    fica em ~100 — os 81 quadros eram recusados por MIOLO PEQUENO, todos.

    Baixar as constantes não resolve, e é o erro que quase cometi: `reduz` exige
    TRABALHO múltiplo de ESCALA, então o degrau abaixo de 192 é 96 e depois 48.
    Com TRABALHO 48 a `costura` entrega 48 pixels de FONTE sem redução nenhuma —
    ou seja, o tile do jogo passaria a mostrar 48 px de um quadro de 139, menos
    da metade do motivo, AMPLIADO duas vezes. É exatamente o defeito que o
    ESCALA veio consertar ("parece que a pedra é maior que o personagem"), e ele
    voltaria pela porta dos fundos.

    O certo é o contrário: o miolo é reamostrado para o tamanho de trabalho, e
    o quadro inteiro continua valendo um tile. `MIOLO_ALVO` é a mediana dos
    miolos da folha que calibrou as constantes, então para ela isto é quase
    identidade (fator 1,01) e nada do que já foi gravado se move.

    Ampliar não inventa detalhe, e não é para inventar: quem manda na nitidez
    final é a fonte, e 100 px de arte para um tile de 48 ainda é redução de 2×.
    O custo medido de passar por 257 em vez de ir direto está no relatório do
    `--nitidez`.
    """
    n = min(nucleo.shape[0], nucleo.shape[1])
    q = nucleo[:n, :n]
    if n == MIOLO_ALVO:
        return q
    im = Image.fromarray(q).resize((MIOLO_ALVO, MIOLO_ALVO), Image.LANCZOS)
    return np.asarray(im)


def melhor_recorte(a, miolo, prec):
    """Onde recortar, de todos os lugares que cabem no miolo.

    A costura fecha o tile por CONSTRUÇÃO: a coluna 0 da saída é a coluna N do
    source, e a última é a N-1 — duas colunas que eram vizinhas no original.
    Medido e confirmado: a diferença na emenda da saída bate com a do par
    vizinho na fonte até a segunda casa (cascalho 13,77 contra 13,71).

    O que sobra em aberto não é SE fecha, é ONDE fecha. Se aquele par vizinho
    calhar de cair na quina de uma pedra, o tile ladrilha sem emenda e mesmo
    assim mostra uma linha de contraste repetida — não é costura aberta, é
    conteúdo forte alinhado com a grade. Então a escolha do recorte é feita, e
    não centrada: vence o que põe a emenda no lugar mais QUIETO.

    DUAS PENEIRAS, e a segunda existe porque a primeira media a coisa errada.
    A versão anterior julgava o candidato pelo par de colunas na FONTE de 224 —
    barato, e enganoso: o que ladrilha no mapa é a saída de ESCALA px, e a
    redução redistribui o contraste. Com ESCALA em 48, três tiles saíram com
    emenda horizontal acima de 1,0 escolhendo pelo critério da fonte.
    Agora a peneira grossa continua na fonte (é ela que permite varrer mil
    candidatos), mas os melhores são reavaliados na SAÍDA DE VERDADE — costurada,
    reduzida, do tamanho que o jogo consome. Medir na régua do que vai para a
    tela é a mesma regra de sempre.
    """
    mx0, my0, mx1, my1 = miolo
    mw, mh = mx1 - mx0 + 1, my1 - my0 + 1
    N = TRABALHO
    grossa = []
    for oy in range(my0, my0 + mh - prec + 1):
        for ox in range(mx0, mx0 + mw - prec + 1):
            s = a[oy:oy + prec, ox:ox + prec].astype(np.float64)
            cv = np.abs(s[:N, N] - s[:N, N - 1]).mean()
            ch = np.abs(s[N, :N] - s[N - 1, :N]).mean()
            grossa.append((cv + ch, ox, oy))
    grossa.sort()
    melhor, custo_min = (grossa[0][1], grossa[0][2]), float('inf')
    for _, ox, oy in grossa[:FINALISTAS]:
        saida = reduz(costura(a[oy:oy + prec, ox:ox + prec]), ESCALA)
        f = saida.astype(np.float64)
        dv = np.abs(np.diff(f, axis=1)).mean(axis=(0, 2))
        dh = np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))
        ev = np.abs(f[:, 0] - f[:, -1]).mean() / max(np.median(dv), 1e-6)
        eh = np.abs(f[0, :] - f[-1, :]).mean() / max(np.median(dh), 1e-6)
        # o PIOR dos dois eixos, e não a soma: um tile com emenda ótima na
        # vertical e ruim na horizontal mostra a linha ruim do mesmo jeito
        custo = max(ev, eh)
        if custo < custo_min:
            custo_min, melhor = custo, (ox, oy)
    return melhor, custo_min


def qualidade(src, saida):
    """A emenda contra a distribuição de junções da FONTE.

    Contra a saída seria enganoso: o cross-fade abaixa um pouco o contraste da
    faixa que ele mistura, então a mediana das junções da SAÍDA vem menor e a
    razão infla sem que nada tenha piorado. A pergunta honesta é se a emenda se
    parece com uma junção qualquer do desenho ORIGINAL.
    """
    s, o = src.astype(np.float64), saida.astype(np.float64)
    N = TRABALHO
    dv = np.abs(np.diff(s, axis=1)).mean(axis=(0, 2))
    dh = np.abs(np.diff(s, axis=0)).mean(axis=(1, 2))
    ev = np.abs(o[:, 0] - o[:, -1]).mean()
    eh = np.abs(o[0, :] - o[-1, :]).mean()
    return {'v': round(float(ev / np.median(dv)), 2), 'h': round(float(eh / np.median(dh)), 2)}


def reduz(a, destino):
    """Reduz com LANCZOS sobre borda continuada por WRAP.

    Duas coisas em tensão, e o wrap resolve as duas de uma vez.

    A primeira é NITIDEZ. Média de área com fator inteiro é a redução mais
    honesta que existe e preserva a costura de graça — mas ela suaviza, e o
    dono do projeto apontou o risco antes de eu medir: tile embaçado no mundo do
    jogo. Medido no mesmo tamanho, a média de área devolve gradiente médio de
    11,72 onde o Lanczos devolve 12,33 e o Lanczos direto da fonte, 14,08. A
    perda é real.

    A segunda é a COSTURA. Lanczos tem suporte largo: nos pixels da borda ele
    busca vizinhos que não existem, e o que a biblioteca faz é repetir a borda —
    inventando ali um degrau que não estava no desenho e reabrindo justamente a
    emenda que a costura fechou.

    Preenchendo por `wrap` antes de reduzir, o filtro encontra do lado de fora
    exatamente o que existe do outro lado do tile, que é o que ele vai encostar
    quando ladrilhar. A borda deixa de ser borda para o filtro. Depois é só
    recortar a folga — e ela é múltipla do fator, senão o recorte cairia em meio
    pixel e desalinharia tudo.
    """
    n = a.shape[0]
    assert n % destino == 0, f'{n} não é múltiplo de {destino}'
    k = n // destino
    folga = 8                                    # em pixels de SAÍDA
    pad = folga * k                              # e em pixels de entrada
    ext = np.pad(a, ((pad, pad), (pad, pad), (0, 0)), mode='wrap')
    alvo = destino + 2 * folga
    im = Image.fromarray(ext).resize((alvo, alvo), Image.LANCZOS)
    return np.asarray(im)[folga:folga + destino, folga:folga + destino]


def erro_de_costura(a):
    """Em que PERCENTIL a emenda cai, contra todas as outras junções do tile.

    A primeira régua foi "diferença média na emenda dividida pela diferença
    média do interior", e ela mente por variância: o interior é a média de 95
    junções e a emenda é UMA, então uma junção que calhe de cair num veio de
    pedra dá razão 1,8 sem haver emenda nenhuma. Foi o que apareceu no cascalho
    e na terra.

    A régua certa compara a emenda com a DISTRIBUIÇÃO das junções: calcula-se a
    diferença média de cada par de colunas vizinhas (são N-1 delas) e pergunta-se
    em que percentil a emenda cai. Costura perfeita cai no meio do bolo — perto
    de 50. Emenda visível cai em 100, porque é a maior de todas por uma larga
    margem. É a mesma ideia de medir com a régua do jogo: a pergunta não é
    "quanto ela difere", é "ela se distingue das outras".
    """
    f = a.astype(np.float64)
    def perc(eixo):
        d = np.abs(np.diff(f, axis=eixo)).mean(axis=(1 - eixo, 2))   # uma por junção
        emenda = (np.abs(f[:, 0] - f[:, -1]) if eixo == 1
                  else np.abs(f[0, :] - f[-1, :])).mean()
        return round(float((d < emenda).mean() * 100), 1)
    return {'vertical': perc(1), 'horizontal': perc(0)}


# ── CORREÇÃO DE MATIZ: tira o cast OLIVA da vegetação ────────────────────────
# O gerador entrega vegetação oliva, e a `tiles_02` — de onde saiu TODA a grama
# do jogo — é a pior folha do projeto nisto. Matiz p10/p50/p90 da vegetação,
# medido por folha em `assets/scenario/`:
#
#     tiles_02    68 /  78 /  84     ← as dez texturas de chão em uso
#     tiles_01    66 /  80 / 124
#     trees_01    67 /  89 / 127
#     objects_01  65 /  81 / 156
#
# A tiles_02 não é só mais amarela: ela é CHAPADA. 90% dos pixels dela cabem
# numa faixa de 16°, enquanto as outras folhas têm cauda até o verde de verdade
# (`trees_01_12` mede p50 131). Girar o matiz conserta metade do defeito e
# deixa a outra metade: grama de matiz único lê como papel pintado. O que se
# faz aqui é ABRIR a faixa, e por isso o mapa tem GANHO e não deslocamento.
#
# O viés é do GERADOR, não deste pipeline — o `corrige_oliva.py` documenta o
# mesmo na armadura do knight. Medido ponta a ponta: folha 77,1° -> PNG gravado
# 74,4°, Δ 2,7°. Recorte, erosão, costura e reamostragem não tiram matiz.
#
# O nó de baixo é 62° porque o corte entre seco e vivo é limpo e medido:
#
#     seco e musgo   p50 entre 56 e 64   (grama_seca 56, mato_seco 60, musgo 60)
#     grama viva     p50 entre 74 e 82   (grama 75, grama_densa 77, clara 81)
#
# Palha tem de continuar palha. E terra, pedra, calçada, areia e tábua medem
# 0,0% de pixel dentro da janela — o filtro não tem como alcançá-las.
#
# O nó de cima existe para o mapa ser MONÓTONO e virar identidade fora da
# banda. Sem ele, o jeito óbvio (ganho com peso que esvai) INVERTE o matiz na
# saída da janela — 88° sairia mais verde que 96° —, e um ganho sem teto
# nenhum manda a água e o gelo (matiz ~195) para dentro do verde.
PIVO = 62.0       # daqui para baixo é seco e musgo: não se move
ALVO = 95.0       # onde a mediana de toda grama viva vai parar
VIVO = (70., 84.) # p50 aqui dentro é grama viva. Fora, não se toca.
SAT_MIN = .15     # abaixo disto é cinza, e girar matiz de cinza é ruído

# A PRIMEIRA VERSÃO deste mapa era global — ganho 2,0 ancorado no pivô — e saiu
# errada de um jeito que só a folha de contato mostrou: o deslocamento cresce
# com a distância do pivô, então ela empurrou MAIS justamente as texturas que já
# estavam MENOS oliva. `grama` (p50 75) foi para 88 e ficou boa; `grama_clara` e
# `grama_alta` (p50 80,5 e 82) foram para 99 e 102 e ficaram verde neon.
#
# E o croma disse que o defeito não era o que parecia: 0,565 antes, 0,565 depois
# (rotação de matiz não mexe em croma), contra o teto de 0,85 da casa. Nada
# ficou gritante — o que apareceu foi DISPERSÃO ENTRE VARIANTES: 14° separando
# gramas que são a mesma família e, pela régua da casa, têm de se parecer.
#
# Então a mediana de CADA textura é recentrada em ALVO, e a expansão da faixa
# sai como consequência das duas inclinações.
#
# O ALVO saiu da ESCADA, não de conta: as seis gramas renderizadas lado a lado
# em 80, 86, 95 e 102, julgadas a 1×. Em 80 quase nada muda; em 86 `grama` e
# `grama_clara` ainda leem oliva; em 102 `grama_densa` e `grama_pedra` viram
# esmeralda sintética. 95 é onde as seis viram grama sem estourar, e bate com a
# leitura das capturas de Stardew que motivaram a leva (95-105).
#
# A primeira escolha foi 86, ancorada em `trees_01` (p50 89), e o erro de método
# vale anotado: `trees_01` é saída do MESMO gerador oliva, então ancorar nela
# limitava o conserto ao próprio viés que se estava consertando.
#
# O pântano fica de fora (p50 86 e 87, acima da janela VIVO) e passa a ler mais
# AMARELO que a grama — que é o certo para água parada, e mantém os dois
# separados por 9°, do outro lado.

MARCA = 'verdeja'


def _hsv(a):
    r, g, b = a[..., 0] / 255., a[..., 1] / 255., a[..., 2] / 255.
    mx, mn = np.maximum.reduce([r, g, b]), np.minimum.reduce([r, g, b])
    d = np.where(mx - mn == 0, 1e-9, mx - mn)
    h = np.where(mx == r, ((g - b) / d) % 6,
                 np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return h, np.where(mx == 0, 0, (mx - mn) / np.where(mx == 0, 1, mx)), mx


def _rgb(h, s, v):
    i, f = np.floor(h / 60.) % 6, h / 60. - np.floor(h / 60.)
    p, q, t = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s)
    c = [i == 0, i == 1, i == 2, i == 3, i == 4]
    return np.clip(np.stack([np.select(c, [v, q, p, p, t], v),
                             np.select(c, [t, v, v, q, p], p),
                             np.select(c, [p, p, t, v, v], q)], -1) * 255, 0, 255)


def nos(p50):
    """Os nós do mapa de matiz para uma textura de mediana `p50`, em graus.
    Linear por partes e MONÓTONO por construção, identidade fora de [62,150] —
    é isso que deixa água e gelo (matiz ~195) de fora sem precisar de guarda."""
    return ([0., PIVO, p50, 150., 360.], [0., PIVO, ALVO, 150., 360.])


def verdeja(a):
    """Aplica o mapa de matiz. Saturação e valor passam intactos — o defeito
    isolado foi de MATIZ, e mexer no brilho de passagem trocaria a direção de
    arte escura do jogo sem ninguém pedir."""
    p50 = matiz_p50(a)
    if p50 is None or not VIVO[0] <= p50 <= VIVO[1]:
        return a.copy()
    rgb = a[..., :3].astype(np.float64)
    h, s, v = _hsv(rgb)
    alvo = s >= SAT_MIN
    novo = _rgb(np.where(alvo, np.interp(h, *nos(p50)), h), s, v)
    out = a.copy()
    out[..., :3] = np.where(alvo[..., None], novo, rgb).astype(a.dtype)
    return out


def matiz_p50(a):
    """Mediana do matiz na banda da vegetação — a régua do já-corrigido."""
    h, s, _ = _hsv(a[..., :3].astype(np.float64))
    m = (h >= 55) & (h <= 150) & (s >= SAT_MIN)
    return float(np.median(h[m])) if m.sum() > 200 else None


def grava(a, caminho):
    """Grava carimbando a marca — todo caminho que escreve terreno passa aqui."""
    meta = PngImagePlugin.PngInfo()
    meta.add_text(MARCA, f'alvo={ALVO}')
    Image.fromarray(a).save(caminho, pnginfo=meta)


def verdeja_pasta(pasta, aplicar):
    """Corrige os PNG JÁ GRAVADOS. Existe porque só dez dos 66 arquivos de
    `assets/terreno/` saem da folha com lista de nomes em NOMES — os outros 56
    não têm como ser regerados por este script, e sofrem do mesmo cast."""
    for png in sorted(glob.glob(os.path.join(pasta, '*.png'))):
        nome = os.path.basename(png)[:-4]
        im = Image.open(png)
        a = np.asarray(im)
        if MARCA in im.info:
            print(f'  {nome:22} JÁ CORRIGIDO, pulado'); continue
        antes = matiz_p50(a)
        if antes is None:
            print(f'  {nome:22} sem vegetação, gravado sem mudança')
        else:
            print(f'  {nome:22} p50 {antes:5.1f} -> {matiz_p50(verdeja(a)):5.1f}')
        if aplicar:
            grava(verdeja(a), png)
    print('\n' + ('gravado' if aplicar else '(nada gravado — rode com --aplicar)'))


def checa():
    """A régua. Roda com `--checa`, e as três primeiras não precisam dos PNG:
    elas cobram o MAPA, que é onde mora a decisão."""
    for p50 in (70., 75., 81., 84.):
        g = np.array([0., 30., 55., 62., 70., 88., 120., 150., 195., 300.])
        assert np.all(np.diff(np.interp(g, *nos(p50))) > 0), f'mapa não é monótono em p50={p50}'
        for x in (0., 30., 55., 62., 150., 195., 300.):
            assert abs(np.interp(x, *nos(p50)) - x) < 1e-9, f'{x}° devia ser identidade'
        assert abs(np.interp(p50, *nos(p50)) - ALVO) < 1e-9, 'a mediana tem de cair no alvo'
    # e o caminho inteiro em disco: oliva vira verde, terra e palha não se movem
    oliva = np.full((20, 20, 3), (82, 98, 11), np.uint8)   # `grama.png` medida
    terra = np.full((20, 20, 3), (121, 77, 32), np.uint8)  # `terra.png` medida
    seco = np.full((20, 20, 3), (105, 94, 19), np.uint8)   # `grama_seca.png` medida
    assert abs(matiz_p50(verdeja(oliva)) - ALVO) < .5, 'oliva não caiu no alvo'
    assert np.array_equal(verdeja(terra), terra), 'terra se mexeu'
    assert np.array_equal(verdeja(seco), seco), 'palha virou grama'
    print('checa: ok')


def prova_visual(a, vezes=3):
    """O tile ladrilhado, para o olho conferir o que o percentil afirma."""
    return np.tile(a, (vezes, vezes, 1))


def main():
    if len(sys.argv) < 2:
        print(__doc__); return 1
    aplicar = '--aplicar' in sys.argv
    if '--checa' in sys.argv:
        checa(); return 0
    # Modo PASTA: corrige o matiz do que já está gravado, sem recortar de novo.
    if '--verde' in sys.argv:
        verdeja_pasta(SAIDA, aplicar); return 0
    folha = sys.argv[1]
    # Folha em avaliação não escreve na pasta do jogo: `assets/terreno/` é o que
    # o motor carrega, e misturar dezenas de cortes por julgar com os aprovados
    # tira o sentido de olhar a pasta. `--saida` manda o corte para outro lugar.
    saida = SAIDA
    if '--saida' in sys.argv:
        saida = os.path.abspath(sys.argv[sys.argv.index('--saida') + 1])
    im = Image.open(folha).convert('RGB')
    a = np.asarray(im)
    cx = quadros(a)
    base = os.path.basename(folha)
    nomes = NOMES.get(base, [])
    stem = os.path.splitext(base)[0]
    print(f'{base}  {im.size[0]}x{im.size[1]}  ·  {len(cx)} quadros  ->  {saida}')
    os.makedirs(saida, exist_ok=True)
    rel = []
    for i, caixa in enumerate(cx):
        nome = nomes[i] if i < len(nomes) else f'{stem}_{i:02d}'
        bx0, by0, bx1, by1 = miolo_solido(a, caixa)
        bw, bh = bx1 - bx0 + 1, by1 - by0 + 1
        prec = TRABALHO + BANDA
        if min(bw, bh) < MIOLO_MIN:
            print(f'  {nome:14} MIOLO PEQUENO: {bw}x{bh}, preciso de {MIOLO_MIN}. Pulado.')
            continue
        # Miolo que JÁ cabe segue o caminho de sempre, sem passar por
        # `normaliza`: a folha calibrada tem dez tiles em uso no jogo, e mexer
        # no recorte deles de passagem trocaria arte aprovada sem ninguém pedir.
        # A normalização é só para a folha que não cabe.
        if min(bw, bh) >= prec:
            nucleo, mx0, my0, mw, mh = a, bx0, by0, bw, bh
        else:
            nucleo = normaliza(a[by0:by1 + 1, bx0:bx1 + 1])
            mx0, my0 = 0, 0
            mw = mh = nucleo.shape[0]
        # centrado, que era o recorte antigo, só para comparar
        cx0, cy0 = mx0 + (mw - prec) // 2, my0 + (mh - prec) // 2
        centro = nucleo[cy0:cy0 + prec, cx0:cx0 + prec]
        q_centro = qualidade(centro, costura(centro))
        # e o melhor de todos os que cabem
        (ox, oy), _ = melhor_recorte(nucleo, (mx0, my0, mx0 + mw - 1, my0 + mh - 1), prec)
        src = nucleo[oy:oy + prec, ox:ox + prec]
        unidade = reduz(costura(src), ESCALA)
        # a folha do motor é o QUADRO ladrilhado, e não o quadro esticado: é isso
        # que mantém a proporção e ainda assim entrega a folha de 96 que o
        # `tileTexture` sempre devolveu.
        rep = FINAL // ESCALA
        final = np.tile(unidade, (rep, rep, 1))
        q = qualidade(src, costura(src))
        rel.append((nome, bw, bh, q_centro, q))
        print(f'  {nome:14} miolo {bw}x{bh}  recorte +{ox-mx0},{oy-my0}  ->  {FINAL}x{FINAL}  ·  '
              f'emenda/junção  centrado v{q_centro["v"]:4} h{q_centro["h"]:4}  ->  '
              f'escolhido v{q["v"]:4} h{q["h"]:4}')
        if aplicar:
            final = verdeja(final)
            grava(final, os.path.join(saida, nome + '.png'))
            # A PROVA: o tile ladrilhado 3×3. O percentil diz que a emenda não se
            # distingue; a prova é para o olho conferir o que o número afirma —
            # que é a régua final deste projeto para qualquer coisa visual.
            os.makedirs(os.path.join(saida, 'prova'), exist_ok=True)
            Image.fromarray(prova_visual(final)).save(
                os.path.join(saida, 'prova', nome + '_3x3.png'))
    if aplicar:
        # SEM índice gerado, e isto é correção e não esquecimento: o carregador
        # do art.js já explica por quê — "um `terrenos.js` gerado seria uma
        # segunda fonte de verdade sobre o conteúdo de uma pasta". Nada lia o
        # `indice.json`, e depois da folha 01 ele passou a MENTIR: listava os dez
        # nomes da última execução com 64 PNG na pasta. Quem manda é o
        # `TEX_PNG_MAP`, que é onde o tile diz de qual arquivo ele vem.
        print(f'\ngravados {len(rel)} PNG em {saida}')
    else:
        print('\n(nada gravado — rode com --aplicar)')
    return 0


if __name__ == '__main__':
    sys.exit(main())

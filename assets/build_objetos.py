#!/usr/bin/env python3
"""build_objetos.py — recorta uma FOLHA de objetos de cenário em PNGs soltos,
com alfa, âncora e span, prontos para a tabela `OBJ` do jogo.

    python assets/build_objetos.py assets/scenario/objects_01.png
    python assets/build_objetos.py assets/scenario/objects_01.png --aplicar

Irmão do `build_terreno.py` e deliberadamente NÃO o mesmo caminho. O CLAUDE.md
já decidiu por quê: "só CHÃO passa por aqui — objeto e parede ladrilhados viram
papel de parede, e o caminho deles é outro: `span`, `cx`/`feet` e sombra do
motor". Então aqui não há costura, não há transbordo e não há 96×96. Há recorte,
alfa e âncora.

O que esta leva mediu nas quatro folhas de `assets/scenario/`, e que decide o
script inteiro:

  * NÃO HÁ GRADE DE COLUNA nos objetos. Projetando a máscara de arte, as folhas
    de objeto dão UMA coluna só: os desenhos se encostam horizontalmente e não
    existe corredor de fundo entre eles. É a "célula fracionária" que o #19
    catalogou como risco — e é por isso que aqui o recorte é por COMPONENTE
    CONEXO, não por grade. As de árvore têm grade (5 colunas, célula de 250 px),
    e mesmo assim o componente conexo as separa igual: 25 e 30, batendo com a
    contagem visual.

  * FECHAR ANTES DE ROTULAR, e o raio importa. Sem fechamento a folha 01 dá 224
    componentes para 104 desenhos — corrente de lustre, varal e cabo de bandeira
    quebram em pedaços soltos. Medido: r=0 -> 224, r=1 -> 126, r=2 -> 107,
    r=3 -> 105 componentes para os mesmos 104 desenhos de área útil. Em r=5 a
    conta CAI para 101, que é fusão de vizinhos: passou do ponto. Fica r=3.

  * O CHROMA NÃO É CHAPADO, e a régua do terreno NÃO BASTA aqui. Ela tem
    limiares absolutos e serve lá porque o tile preenche a célula. Aqui o
    artista desenhou uma SOMBRA MOLE sob os objetos, e o que ela produz é
    magenta ESCURECIDO — luminância mediana 46 contra 94 do fundo chapado.
    Pelos limiares absolutos isso vira arte, e o recorte sai com uma mancha rosa
    colada no pé de meio catálogo (carroça, cama, mesa, lareira, cerca, lápide,
    bigorna, tapete). A régua daqui é a mesma ideia em forma INVARIANTE A
    ESCALA, e ela é um SUPERSET medido: pega 3,25% a mais da folha e devolve
    0,00% do que a do terreno já chamava de fundo. Ver `mascara_objeto`.

  * A ESCALA É UMA SÓ NAS QUATRO FOLHAS. `PX_TILE` = 89 px de arte por tile de
    32. Sai da árvore: o desenho tem ~201 px de altura e a árvore que já está no
    jogo tem 72 px, ou 2,25 tiles — 201/2,25 = 89. Com esse número o objeto
    mediano da folha 01 sai em 0,96 × 0,92 tile, que é o barril e o caixote em
    um tile, e o maior sai em 1,6 × 1,5. Não é chute: é a escada de tamanho do
    CLAUDE.md caindo em cima da folha.

  * A LARGURA É A ÚNICA TRAVA DURA. Medido no motor com `span` até 12×12: o
    índice, o passo e o rastro não têm teto, e a ALTURA é livre porque o render
    desenha `spr.height` e ancora o pé no fim do rastro. Quem trava é a largura,
    que o render manda como `t * span[0]` — sprite mais largo sai espremido e
    mais estreito sai esticado, os dois sem erro nenhum. Por isso a saída é
    centralizada e preenchida em EXATAMENTE `32 * span[0]` px.
"""
import sys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_terreno import mascara_arte as _arte_do_terreno


def mascara_objeto(a):
    """True onde ha ARTE — e a regra do terreno NAO basta aqui.

    A do terreno pergunta "isto e o fundo chapado?", com limiares absolutos
    (R>150, B>140, G<90). Serve la porque o tile PREENCHE a celula e nao ha
    sombra por cima do fundo. Aqui ha: o artista desenhou uma sombra mole sob os
    objetos, e o que ela produz e MAGENTA ESCURECIDO — luminancia mediana 46
    contra 94 do fundo chapado. Pelos limiares absolutos isso vira ARTE, e o
    recorte sai com uma mancha rosa colada no pe de meio catalogo (carroca,
    cama, mesa, lareira, cerca, lapide, bigorna, tapete).

    A regra daqui e a MESMA IDEIA em forma INVARIANTE A ESCALA: magenta e "R e B
    muito acima de G, e R perto de B", em qualquer luminosidade. Medido na folha
    01: pega 3,25% a mais da folha, e devolve 0,00% do que a regra do terreno ja
    chamava de fundo — e superset, nao uma segunda opiniao.

    Nao virou uma alteracao na regra do terreno de proposito: o `build_terreno`
    tem a garantia de que reprocessar a `tiles_02` sai byte a byte igual aos dez
    PNG em uso, e mexer na mascara dele quebraria isso para resolver um problema
    que la nao existe. As duas respondem perguntas diferentes, e o comentario
    acima e o que impede de virarem duas copias divergentes da mesma.
    """
    R, G, B = a[:, :, 0].astype(int), a[:, :, 1].astype(int), a[:, :, 2].astype(int)
    mx = np.maximum(R, B)
    mag = (R > G * 1.6) & (B > G * 1.6) & (np.abs(R - B) < 0.28 * np.maximum(mx, 1)) & (mx > 20)
    return ~(mag | ~_arte_do_terreno(a))

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, 'assets', 'objetos')

TILE = 32
PX_TILE = 89          # px de arte por tile; ver a nota da escala no topo
FECHA = 3             # raio do fechamento antes de rotular; ver a nota
AREA_MIN = 300        # abaixo disso é respingo do chroma, não desenho
SNAP = .15            # quanto a peça pode encolher para não gastar um span a mais

# Nome de cada desenho, POR FOLHA e em ordem de leitura (linha, depois coluna).
# Indexado pela folha pelo mesmo motivo do `build_terreno`: uma lista solta
# gravaria os quadros de uma folha por cima dos nomes de outra, sem erro e sem
# aviso. Folha sem lista sai numerada com o nome dela na frente.
NOMES = {}

# O CATÁLOGO é quem manda no tamanho, e ele é por PEÇA. Vale a pena dizer por
# quê, porque três voltas foram gastas até aqui: (1) uma constante global saiu
# de medir a árvore da folha contra a árvore do jogo — boneco contra boneco, e
# as duas podiam estar erradas juntas, errou por 1,88×; (2) constante nenhuma
# serve, porque o artista desenha tudo preenchendo a mesma célula e isso
# comprime a faixa de tamanho: o px que cada peça pede vai de 33 a 219; (3)
# declarar a ALTURA e aplicá-la sobre a extensão vertical do sprite é errado,
# porque em perspectiva essa extensão é altura MAIS profundidade projetada — a
# cama saiu mais estreita e mais baixa que quem dorme nela.
# A LARGURA não sofre projeção: largura na tela é largura no mundo. Por isso a
# ficha declara `w` em tiles e a altura sai proporcional. A exceção é quem
# LADRILHA (cerca, grade, portão): ali a largura é 1 tile por construção, é por
# ela que o render emenda o lance, e quem cresce é a altura — essas declaram `h`.
CATALOGO = os.path.join(SAIDA, 'catalogo.json')


def catalogo():
    """{chave -> ficha} do catalogo.json, ou {} se ele ainda não existe.

    Folha nova não tem catálogo: o primeiro corte sai na régua global só para o
    dono poder olhar e anotar, e a partir daí manda a ficha.
    """
    try:
        with open(CATALOGO, encoding='utf-8') as f:
            return json.load(f).get('pecas', {})
    except (OSError, ValueError):
        return {}


def rotula(m):
    """Componentes conexos em 8 vizinhos, depois de FECHAR os vãos finos."""
    est = np.ones((2 * FECHA + 1, 2 * FECHA + 1), bool)
    fechada = ndimage.binary_erosion(ndimage.binary_dilation(m, est), est)
    # o fechamento serve para AGRUPAR, não para engordar o desenho: a máscara
    # que vira alfa continua sendo a original
    lab, n = ndimage.label(fechada, structure=np.ones((3, 3), bool))
    return lab, n


def recorta(a, m, sl, rotulo, lab):
    """Um desenho: RGBA recortado na caixa, com o fundo fora."""
    sub = a[sl]
    # só o que é DESTE componente — dois desenhos podem dividir a caixa
    dono = (lab[sl] == rotulo)
    arte = m[sl] & dono
    if not arte.any():
        return None
    # ponytail: a borda antialiasada contra o magenta deixa uma franja rosa de
    # ~1 px. Ela é erodida fora em vez de descontada por unmultiply — a 2,8x de
    # redução um pixel de origem vale 0,36 px de saída e some na média, enquanto
    # franja magenta não some nunca. Se a silhueta sair roída, o degrau é
    # estimar o alfa e desfazer a mistura contra o magenta de fundo.
    alfa = ndimage.binary_erosion(arte, np.ones((3, 3), bool))
    if not alfa.any():
        alfa = arte
    # aperta na arte de verdade, depois de tirar a franja
    ys, xs = np.where(alfa)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    rgba[:, :, :3] = sub[y0:y1, x0:x1]
    rgba[:, :, 3] = alfa[y0:y1, x0:x1] * 255
    return rgba


def reduz(rgba, alvo_w, alvo_h):
    """LANCZOS sobre RGBA premultiplicado.

    Sem premultiplicar, o filtro mistura a COR dos pixels transparentes (que
    aqui é o magenta que sobrou por baixo do alfa zero) na borda do desenho, e a
    franja rosa volta pela porta dos fundos depois de ter sido erodida.
    """
    a = rgba.astype(np.float32)
    al = a[:, :, 3:4] / 255.0
    a[:, :, :3] *= al
    im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')
    im = im.resize((max(1, alvo_w), max(1, alvo_h)), Image.LANCZOS)
    b = np.asarray(im).astype(np.float32)
    al2 = b[:, :, 3:4] / 255.0
    with np.errstate(divide='ignore', invalid='ignore'):
        b[:, :, :3] = np.where(al2 > 0.004, b[:, :, :3] / np.maximum(al2, 1e-6), 0)
    return np.clip(b, 0, 255).astype(np.uint8)


def encaixa(rgba, span_w):
    """Centraliza o desenho numa lona de EXATAMENTE `32 * span_w` px de largura.

    É o contrato que a régua da suíte cobra e que o render assume: ele manda
    `t * span[0]` como largura de destino, então qualquer outro tamanho sai
    deformado — e sem erro nenhum, que é o que torna isto perigoso.
    """
    alvo = TILE * span_w
    h, w = rgba.shape[:2]
    if w == alvo:
        return rgba
    out = np.zeros((h, alvo, 4), np.uint8)
    if w < alvo:
        ini = (alvo - w) // 2
        out[:, ini:ini + w] = rgba
    else:                                  # mais largo que o span: apara os dois lados
        ini = (w - alvo) // 2
        out[:] = rgba[:, ini:ini + alvo]
    return out


def despolui(rgba):
    """Mata a franja rosa que sobra DENTRO do alfa depois da erosão.

    O `recorta` erode 1 px para tirar a borda antialiasada, e o `ponytail:` dele
    já previa este degrau. A erosão não alcança ESTRUTURA FINA — grade, galho,
    degrau de escada, ponta de estaca, graveto —, porque ali o desenho todo tem
    2 a 3 px de espessura e erodir mais o apagaria. Medido: 544 px em 80 das 105
    peças, e visíveis no 2×, que é o zoom em que se joga.

    A cor é trocada pela do vizinho de arte mais próximo, e não o alfa zerado:
    zerar comeria a silhueta justamente onde ela já é fina.

    A EXCEÇÃO é peça cuja cor de MATERIAL é roxa, e ela não é escrúpulo: o
    chroma da folha e um orbe violeta são a mesma cor, e nenhuma régua de cor
    ou de topologia os separa — medido, o que a régua acusa no orbe roxo é a
    borda do crescente, arte legítima. Na folha 01 a cor de material separa
    exatamente uma peça, que é justamente ela.
    """
    op = rgba[:, :, 3] > 0
    if not op.any():
        return rgba
    R, G, B = (rgba[:, :, i].astype(int) for i in range(3))
    c = cor_material(rgba)
    cr, cg, cb = (c >> 16) & 255, (c >> 8) & 255, c & 255
    # A exceção do roxo exige AZUL DE VERDADE, não só "mais que o verde". Como as
    # duas condições eram razões contra `cg`, elas deixavam de dizer qualquer
    # coisa quando o verde ia a zero: sangue é #86020c — R 134, G 2, B 12 — e
    # 12 > 2·1,25 é verdade, então TODA mancha caía na exceção do orbe violeta e
    # não era despoluída. Medido: 1.096 px de chroma nas 20, contra 48 nas 105 da
    # folha antiga. O que separa violeta de vermelho escuro é o azul valer perto
    # do vermelho; no sangue ele é 9% dele.
    if cr > cg * 1.25 and cb > cg * 1.25 and cb > cr * .5:
        return rgba
    mx = np.maximum(R, B)
    ruim = op & (R > G * 2.2) & (B > G * 2.2) & (np.abs(R - B) < 0.35 * np.maximum(mx, 1))
    bom = op & ~ruim
    if not ruim.any() or not bom.any():
        return rgba
    # vizinho de arte mais próximo: a transformada de distância devolve, para
    # cada pixel, o índice do `bom` mais perto — é o preenchimento certo e sai
    # de uma chamada só
    _, (iy, ix) = ndimage.distance_transform_edt(~bom, return_indices=True)
    for k in range(3):
        canal = rgba[:, :, k]
        canal[ruim] = canal[iy[ruim], ix[ruim]]
    return rgba


def franja_magenta(rgba):
    """Quantos px de chroma sobraram DENTRO do alfa. Medido na SAÍDA.

    Vai para o manifesto porque é o que dá régua a isto: a suíte do `tools/` não
    decodifica PNG (o projeto não tem dependência), então quem mede é o script —
    mas ele mede o que de fato gravou, DEPOIS do `despolui`. Tirar a despoluição
    faz o número subir, e a régua pega.
    """
    op = rgba[:, :, 3] > 8
    if not op.any():
        return 0
    R, G, B = (rgba[:, :, i].astype(int) for i in range(3))
    mx = np.maximum(R, B)
    return int((op & (R > G * 2.2) & (B > G * 2.2)
                & (np.abs(R - B) < 0.35 * np.maximum(mx, 1))).sum())


def cor_material(rgba):
    """A cor do MATERIAL, para a planta e o minimapa.

    Mediana dos pixels opacos, e não média: média entre um telhado escuro e uma
    parede clara devolve um cinza que não existe no desenho. É `c` na ficha do
    objeto, e o CLAUDE.md já decidiu que ela é constante PRÓPRIA — nunca a cor
    do chão em que a coisa se apoia.
    """
    op = rgba[:, :, 3] > 200
    if not op.any():
        op = rgba[:, :, 3] > 0
    px = rgba[:, :, :3][op]
    r, g, b = (int(np.median(px[:, i])) for i in range(3))
    return (r << 16) | (g << 8) | b


def sombra_na_base(rgba):
    """Quanto do quinto inferior é pixel ESCURO e SEM cor — o candidato a sombra
    assada, que o CLAUDE.md proíbe ("sombra é do MOTOR, não assada no sprite").

    Não apaga nada: mede e relata. Apagar por heurística arrancaria a base
    escura de um barril tanto quanto uma mancha de sombra, e a diferença entre
    as duas não está em nenhum número — está em olhar.
    """
    h = rgba.shape[0]
    faixa = rgba[int(h * 0.8):]
    op = faixa[:, :, 3] > 128
    if not op.any():
        return 0.0
    px = faixa[:, :, :3][op].astype(int)
    lum = px[:, 0] * .3 + px[:, 1] * .6 + px[:, 2] * .1
    croma = px.max(axis=1) - px.min(axis=1)
    return float(((lum < 70) & (croma < 30)).mean())


FONTE = os.path.join(RAIZ, 'src', 'objetos.js')
NL = chr(10)


def grava_fonte(manifesto):
    """Escreve `src/objetos.js`, no mesmo padrão do `icones.js` e do
    `criaturas.js`: GERADO, e o jogo o carrega como script global.

    O motor precisa de `cx`, `feet` e `span` para desenhar, e ler o
    `manifest.json` por `fetch` poria uma requisição assíncrona no caminho do
    primeiro quadro — o `TEX_PNG_MAP` já resolveu isto para o terreno sendo uma
    tabela no código, e este é o mesmo caso. Fica só o que o RENDER usa: nome,
    tamanho, âncora e span. O resto do manifesto (cor, franja, escuro na base) é
    para a bancada e para a régua, e não sobe para o jogo.
    """
    linhas = []
    for n in sorted(manifesto, key=lambda k: k.lower()):
        v = manifesto[n]
        linhas.append('  %s: { w: %d, h: %d, cx: %d, feet: %d, span: [%d, %d] }'
                      % (n, v['w'], v['h'], v['cx'], v['feet'], v['span'][0], v['span'][1]))
    cab = [
        '/* GERADO por assets/build_objetos.py — nao edite a mao.',
        '   Tamanho, ancora e span de cada peca recortada das folhas de',
        '   `assets/scenario/`. O `OBJ` do world.js aponta para uma destas',
        '   chaves pelo campo `png`, e o `objSprite` do art.js monta o sprite. */',
        "'use strict';",
        'const OBJ_FOLHA = {',
    ]
    txt = NL.join(cab) + NL + (',' + NL).join(linhas) + NL + '};' + NL
    with open(FONTE, 'w', encoding='utf-8') as f:
        f.write(txt)
    print('gravado %s (%d peças)' % (os.path.relpath(FONTE, RAIZ), len(manifesto)))


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    folha = sys.argv[1]
    aplicar = '--aplicar' in sys.argv
    px_tile = PX_TILE
    if '--px-tile' in sys.argv:
        px_tile = float(sys.argv[sys.argv.index('--px-tile') + 1])
    base = os.path.basename(folha)
    nomes = NOMES.get(base, [])
    pre = os.path.splitext(base)[0] + '_'

    a = np.asarray(Image.open(folha).convert('RGB'))
    m = mascara_objeto(a)
    if '--grade' in sys.argv:
        # CORTE POR CÉLULA, para folha em grade regular. Componente conexo agrupa
        # o que se toca, e mancha de sangue é feita de um blob mais respingos
        # SOLTOS em volta: a `blood_01` saiu com 32 peças para 10 desenhos, cada
        # gota satélite virando peça própria. Aumentar o `FECHA` até colar as
        # gotas colaria também desenhos vizinhos — a régua certa aqui não é
        # proximidade, é a célula que o artista usou.
        cols, rows = (int(v) for v in sys.argv[sys.argv.index('--grade') + 1].split('x'))
        H, W = m.shape
        yy, xx = np.mgrid[0:H, 0:W]
        cel = (yy * rows // H) * cols + (xx * cols // W)
        lab = np.where(m, cel + 1, 0)
        caixas = ndimage.find_objects(lab)
    else:
        lab, n = rotula(m)
        caixas = ndimage.find_objects(lab)

    itens = []
    for i, sl in enumerate(caixas):
        if sl is None:
            continue
        rot = i + 1
        if (lab[sl] == rot).sum() < AREA_MIN:
            continue
        # ordem de leitura: linha primeiro, depois coluna
        itens.append((sl[0].start, sl[1].start, rot, sl))
    itens.sort(key=lambda t: (t[0] // 60, t[1]))

    print('%s  %dx%d  %d desenhos  (px por tile = %g)'
          % (base, a.shape[1], a.shape[0], len(itens), px_tile))
    print('%-22s %-12s %-9s %-11s %-8s %s'
          % ('nome', 'arte', 'span', 'saida', 'cor', 'escuro na base'))

    fichas = catalogo()
    saidas, manifesto = [], {}
    for k, (_, _, rot, sl) in enumerate(itens):
        rgba = recorta(a, m, sl, rot, lab)
        if rgba is None:
            continue
        h0, w0 = rgba.shape[:2]
        nome = nomes[k] if k < len(nomes) else '%s%02d' % (pre, k + 1)
        fic = fichas.get(nome, {})
        # a LARGURA do desenho, não a da lona: o recorte ainda não foi
        # centralizado aqui, então `w0` já é o desenho — mas depois do
        # `encaixa` deixa de ser, e é por isso que a conta é feita AGORA.
        if fic.get('h'):
            esc = fic['h'] * TILE / h0
        elif fic.get('w'):
            esc = fic['w'] * TILE / w0
        else:
            esc = TILE / px_tile
        aw = max(1, int(round(w0 * esc)))
        ah = max(1, int(round(h0 * esc)))
        # SNAP para o tile de baixo quando a peça passa dele por pouco. O `span`
        # é footprint de COLISÃO, não só lona de desenho: uma coluna de 35 px
        # (1,09 tile) com span 2 bloqueia dois tiles no mapa, e no jogo uma
        # coluna ocupa um. Medido: 53 das 105 gastavam um tile inteiro a mais,
        # as piores passando do tile por 3 px. Encolher esses 3 px é
        # imperceptível; reservar o tile não é. Acima de SNAP a peça sobe de span
        # de verdade — quem mede 1,4 tile ocupa 2, e isso é honesto.
        cheio = TILE * max(1, aw // TILE)
        if 0 < aw - cheio <= SNAP * cheio:
            ah = max(1, int(round(ah * cheio / aw)))
            aw = cheio
        peq = reduz(rgba, aw, ah)
        # CEIL, não round: com `round`, uma peça de 1,35 tile virava span 1 e o
        # `encaixa` aparava 11 px dos lados para ela caber na lona. Medido: 32
        # das 105 saíam mutiladas, a pior perdendo 29% da largura — e sem erro
        # nenhum, que é o que tornava isto perigoso. Sobrar lona transparente ao
        # lado é inofensivo; comer o desenho não é. O preço é o objeto reservar
        # o tile que ele de fato ocupa: quem mede 1,35 tile não cabe em 1.
        span_w = max(1, -(-aw // TILE))
        peq = encaixa(peq, span_w)
        peq = despolui(peq)
        cor = cor_material(peq)
        escuro = sombra_na_base(peq)
        # `feet` é onde a linha do chão cai DENTRO do sprite. Para um recorte sem
        # informação de chão, o pé é o fim do desenho — o objeto se apoia na
        # própria base. `cx` é o meio da lona, que é o meio do span.
        # SOMBRA POR PADRÃO, decisão do dono: objeto que está no mapa projeta
        # sombra. Quem a desenha é o motor (`dropShadow`: mancha de contato mais
        # silhueta projetada, alfa seguindo o sol) — nunca uma elipse assada no
        # PNG, que entraria no passe de luz junto com o objeto e o faria virar
        # papel colado no chão. Duas exceções existem no motor e as duas são
        # medidas, não esquecimento: o que CORRE EM LINHA (cerca, escoramento)
        # fica de fora porque sombra projetada por tile num lance vira serrilha,
        # e PAREDE usa o `edgeShadow` do vizinho, que é oclusão de contato e já
        # segue a altura do sol. Nada desta leva cai nas duas: são objetos
        # soltos, que é justamente quem tem sombra de motor.
        # `pxTile` viaja no manifesto porque a bancada precisa saber de QUE
        # escala este PNG saiu para poder mostrar outra sem re-rodar o script.
        # Sem ele a página teria a escala cravada em dois lugares, e o dia em
        # que o corte mudasse ela mentiria calada sobre o tamanho.
        manifesto[nome] = {
            'png': nome, 'span': [span_w, 1], 'sombra': 1,
            'w': int(peq.shape[1]), 'h': int(peq.shape[0]),
            'cx': int(peq.shape[1] // 2), 'feet': int(peq.shape[0]),
            'c': cor, 'escuroNaBase': round(escuro, 3),
            'pxTile': round(TILE / esc, 1),
            'franja': franja_magenta(peq),
            # a largura do DESENHO dentro da lona. Sem ela não há como uma régua
            # ver mutilação: com o span saindo de `round`, a lona continua sendo
            # `span * 32` e só a ARTE é aparada — a régua que mede a lona passa
            # verde sobre a peça cortada. Foi assim que a primeira versão desta
            # suíte deixou passar a mutação que importava.
            'artW': aw,
        }
        saidas.append((nome, peq))
        print('%-22s %-12s %-9s %-11s %-8s %.0f%%'
              % (nome, '%dx%d' % (w0, h0), '%dx1' % span_w,
                 '%dx%d' % (peq.shape[1], peq.shape[0]),
                 '#%06x' % cor, escuro * 100))

    altos = [v for v in manifesto.values() if v['h'] > TILE * 2.5]
    print('\n%d desenhos; %d passam de 2,5 tiles de altura (o topo da escada do CLAUDE.md)'
          % (len(saidas), len(altos)))
    sus = [k for k, v in manifesto.items() if v['escuroNaBase'] > .25]
    print('%d com mais de 25%% de pixel escuro e sem cor na base — candidatos a SOMBRA ASSADA%s'
          % (len(sus), (': ' + ', '.join(sus[:8])) if sus else ''))

    if not aplicar:
        print('\n(seco — nada gravado; use --aplicar)')
        return 0

    os.makedirs(SAIDA, exist_ok=True)
    for nome, arr in saidas:
        Image.fromarray(arr, 'RGBA').save(os.path.join(SAIDA, nome + '.png'))
    mpath = os.path.join(SAIDA, 'manifest.json')
    antigo = {}
    if os.path.exists(mpath):
        antigo = json.load(open(mpath, encoding='utf-8'))
    antigo.update(manifesto)
    json.dump(antigo, open(mpath, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    # O FONTE SAI DO MANIFESTO FUNDIDO, não da folha desta rodada. Enquanto ele
    # saía de `manifesto`, rodar `--aplicar` numa folha NOVA reescrevia o
    # `objetos.js` só com ela e APAGAVA as peças de todas as outras — em
    # silêncio, porque o `manifest.json` sempre fundiu e só o fonte não fundia.
    # Não mordeu antes porque o script só tinha sido rodado com uma folha; a
    # segunda folha teria levado as 88 primeiras junto.
    grava_fonte(antigo)
    print('\ngravados %d PNG em %s' % (len(saidas), SAIDA))
    return 0


if __name__ == '__main__':
    sys.exit(main())

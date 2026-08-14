"""Transforma a arte de assets/skins/ nos ícones que o jogo usa, sozinho.

    python assets/build_skins.py              # confere e mostra o que mudaria
    python assets/build_skins.py --aplicar    # grava de verdade
    python assets/build_skins.py --aplicar --sem-trava   # ver "trava" abaixo

COMO ADICIONAR ARTE NOVA (não precisa mexer neste arquivo):

  1. Jogue o PNG em assets/skins/<pasta>/ com fundo transparente.
  2. Rode o script.
  3. Use o id que ele imprimir no data.js.

O id sai do nome do arquivo. Em pasta de conjunto, o prefixo comprido do arquivo
vira a sigla do conjunto:

    skins/sets/golden_guardian_set/golden_guardian_armor.png  ->  gg_armor
    skins/loot/bone.png                                       ->  bone

A sigla é montada com as iniciais do nome da pasta (golden_guardian_set -> gg).
Para mandar em qualquer parte disso, ponha um _conjunto.json na pasta:

    { "id": "gg", "lado": 54, "apelidos": { "ohsword": "sword", "graves": "boots" } }

  id        sigla do conjunto (padrão: iniciais do nome da pasta)
  lado      tamanho do ícone em px (padrão: 54, o vão do slot de equipamento)
  apelidos  renomeia peças cujo nome do desenhista não é o do jogo
  ignorar   lista de peças que não viram ícone (folhas de referência, etc.)
  pular     true = a pasta inteira não é ícone de item. É o caso dos quadros de
            animação do personagem, que o jogo desenha no mundo, não no slot.

POR QUE 54px E NÃO "QUANTO MAIOR MELHOR": o navegador encolhe imagem com filtro
barato, então mandar 128px para um slot de 54 borra mais do que mandar 54. O
ganho vem de reduzir AQUI, com Lanczos, e entregar o pixel no tamanho em que ele
vai aparecer. Medido na armadura: png de 128 -> 5.642 de nitidez na tela; png de
54 em 1:1 -> 28.146; com o realce -> 42.856. Sai também um @2x para tela densa,
e o srcset em data.js escolhe.

Três cuidados que não são opcionais:

1. O RGB é pré-multiplicado pelo alpha antes de encolher. Sem isso o filtro
   mistura a cor dos pixels transparentes (lixo arbitrário) na borda do desenho.
2. A proporção é preservada — o desenho encosta nas bordas do lado mais comprido
   e centraliza no outro. Esticar para o quadrado achataria o elmo.
3. Antes de gravar, compara a silhueta com o ícone que já existe; se destoar
   demais, PULA em vez de sobrescrever arte boa por um mapeamento errado.
   Essa trava compara com o ícone ANTERIOR, então quando você reenquadra a arte
   de origem ela acusa todo mundo — é aí, e só aí, que --sem-trava serve.
"""
import sys, os, json, glob
import numpy as np
from PIL import Image, ImageFilter

AQUI = os.path.dirname(os.path.abspath(__file__))
SKINS = os.path.join(AQUI, 'skins')
ICONS = os.path.join(AQUI, 'icons')
LISTA = os.path.join(os.path.dirname(AQUI), 'src', 'icones.js')
LADO_PADRAO = 54
REALCE = 50              # repõe o contraste que a redução come. Escolhido no olho:
                         # 80+ endurece a borda dourada e serrilha o contorno.
LIMITE_SILHUETA = 0.30
# Conferidos a olho: são o item certo, mas a silhueta destoa por motivo conhecido.
VISTOS = {'gg_ring'}     # o vão do meio do anel muda demais num quadro de 32px


def sigla(nome_pasta):
    """golden_guardian_set -> gg · loot -> loot"""
    partes = [p for p in nome_pasta.split('_') if p and p != 'set']
    return ''.join(p[0] for p in partes) if len(partes) > 1 else nome_pasta


def conjuntos():
    """Toda pasta de skins vira um conjunto, com config opcional."""
    for cam in sorted(glob.glob(os.path.join(SKINS, '**'), recursive=True)):
        if not os.path.isdir(cam) or not glob.glob(os.path.join(cam, '*.png')):
            continue
        nome = os.path.basename(cam)
        cfg = {}
        arq = os.path.join(cam, '_conjunto.json')
        if os.path.exists(arq):
            with open(arq, encoding='utf-8') as f:
                cfg = json.load(f)
        yield cam, nome, cfg


def id_do_arquivo(arquivo, pasta, cfg):
    """Nome do png -> id do ícone.

    Dois casos, e a diferença é se o arquivo repete o nome da pasta:
      golden_guardian_set/golden_guardian_armor -> peça de conjunto -> gg_armor
      novice_set/leather_hood                   -> nome próprio     -> leather_hood
    Nome próprio vira o id direto, o que deixa a arte cair num item que já
    existe só por se chamar igual. Os apelidos valem nos dois casos.
    """
    base = os.path.basename(arquivo)[:-4]
    apel = cfg.get('apelidos', {})
    tronco = pasta[:-4] if pasta.endswith('_set') else pasta
    if base.startswith(tronco + '_'):
        peca = base[len(tronco) + 1:]
        return '%s_%s' % (cfg.get('id', sigla(pasta)), apel.get(peca, peca))
    return apel.get(base, base)


def recorta(p):
    a = np.array(Image.open(p).convert('RGBA'))
    ys, xs = np.where(a[:, :, 3] > 40)
    if not len(ys):
        return None
    return Image.fromarray(a[ys.min():ys.max() + 1, xs.min():xs.max() + 1])


def encaixa(im, lado, realce=REALCE):
    w, h = im.size
    e = min(lado / w, lado / h)
    nw, nh = max(1, round(w * e)), max(1, round(h * e))
    a = np.asarray(im.convert('RGBA'), dtype=np.float32)
    al = a[:, :, 3:4] / 255.0
    pm = Image.fromarray(np.clip(a[:, :, :3] * al, 0, 255).astype(np.uint8)).resize((nw, nh), Image.LANCZOS)
    ai = Image.fromarray(a[:, :, 3].astype(np.uint8)).resize((nw, nh), Image.LANCZOS)
    if realce:
        pm = pm.filter(ImageFilter.UnsharpMask(radius=1.0, percent=realce, threshold=6))
    pmn = np.asarray(pm, dtype=np.float32)
    aln = np.asarray(ai, dtype=np.float32)[:, :, None]
    rgb = np.clip(pmn / np.maximum(aln / 255.0, 1e-6), 0, 255).astype(np.uint8)
    r = Image.fromarray(np.dstack([rgb, np.asarray(ai)]))
    fundo = Image.new('RGBA', (lado, lado), (0, 0, 0, 0))
    fundo.paste(r, ((lado - nw) // 2, (lado - nh) // 2))
    return fundo


def silhueta(im, n=32):
    return np.array(im.resize((n, n), Image.LANCZOS))[:, :, 3] > 110


def disponiveis():
    """Todo ícone que existe em assets/icons, e se ele tem par @2x."""
    fora = {}
    for p in sorted(glob.glob(os.path.join(ICONS, '*.png'))):
        n = os.path.basename(p)[:-4]
        if n.endswith('@2x'):
            continue
        fora[n] = os.path.exists(p[:-4] + '@2x.png')
    return fora


def escreve_lista():
    """Gera src/icones.js: é ele que faz o jogo achar a arte pelo id do item,
    sem ninguém manter lista à mão em lugar nenhum."""
    ic = disponiveis()
    com2x = sorted(n for n, tem in ic.items() if tem)
    linhas = ["/* GERADO por assets/build_skins.py — não edite à mão.",
              "   Rode o script depois de mexer na arte e este arquivo se refaz.",
              "",
              "   ICONES  : todo id que tem PNG próprio. data.js usa para achar a arte",
              "             pelo id do item, então basta o arquivo se chamar como o id.",
              "   ICONES2X: quem também tem @2x, para o srcset entregar 1:1 em tela densa. */",
              "'use strict';",
              "const ICONES = new Set(%s);" % json.dumps(sorted(ic), ensure_ascii=False),
              "const ICONES2X = new Set(%s);" % json.dumps(com2x, ensure_ascii=False)]
    with open(LISTA, 'w', encoding='utf-8') as f:
        f.write('\n'.join(linhas) + '\n')


def main():
    aplicar = '--aplicar' in sys.argv
    sem_trava = '--sem-trava' in sys.argv
    if sem_trava:
        print('AVISO: trava de silhueta desligada — confira os pares a olho.\n')
    os.makedirs(ICONS, exist_ok=True)

    print('%-16s %-34s %-9s %s' % ('id no jogo', 'origem', 'silhueta', 'resultado'))
    print('-' * 82)
    ok = pulados = 0
    novos = []
    for cam, pasta, cfg in conjuntos():
        if cfg.get('pular'):
            continue
        lado = int(cfg.get('lado', LADO_PADRAO))
        for src in sorted(glob.glob(os.path.join(cam, '*.png'))):
            base = os.path.basename(src)[:-4]
            if base.startswith('_') or base in cfg.get('ignorar', []):
                continue
            nome = id_do_arquivo(src, pasta, cfg)
            corte = recorta(src)
            if corte is None:
                continue
            # Folha de referência (a arte com o conjunto inteiro) não vira ícone.
            # O corte é pelo MENOR lado: folha é grande nas duas medidas (1536x1024),
            # enquanto peça comprida — cajado, lança — é alta e estreita e passaria
            # por folha se o teste olhasse só a altura.
            if min(corte.size) > 900:
                print('%-16s %-34s %-9s pulado: parece folha de conjunto (%dx%d)'
                      % (nome, pasta + '/' + base, '-', corte.size[0], corte.size[1]))
                continue
            dst = os.path.join(ICONS, nome + '.png')
            novo = encaixa(corte, lado)
            existia = os.path.exists(dst)
            nota = '-' if not existia else ''
            if existia:
                difere = float((silhueta(novo) != silhueta(Image.open(dst).convert('RGBA'))).mean())
                nota = '%.0f%% dif' % (difere * 100)
                if difere > LIMITE_SILHUETA and (nome in VISTOS or sem_trava):
                    nota += '*'
                elif difere > LIMITE_SILHUETA:
                    print('%-16s %-34s %-9s RECUSADO (mapeamento suspeito)' % (nome, pasta + '/' + base, nota))
                    pulados += 1
                    continue
            if aplicar:
                novo.save(dst, optimize=True)
                encaixa(corte, lado * 2, REALCE // 2).save(dst[:-4] + '@2x.png', optimize=True)
            if not existia:
                novos.append(nome)
            print('%-16s %-34s %-9s %s' % (nome, pasta + '/' + base, nota,
                  ('gravado' if aplicar else 'ok') + (' · NOVO' if not existia else '')))
            ok += 1

    print('-' * 82)
    print('%d prontos, %d recusados · %s' % (ok, pulados,
          'gravado em assets/icons' if aplicar else 'nada gravado (rode com --aplicar)'))

    if aplicar:
        escreve_lista()
        print('src/icones.js atualizado (%d ícones)' % len(disponiveis()))
    if novos:
        print('\n%d id(s) novo(s). Declare no data.js — modelos em assets/COMO_ADICIONAR.md:' % len(novos))
        for n in novos[:10]:
            print('  ' + n)
        if len(novos) > 10:
            print('  ... e mais %d' % (len(novos) - 10))
        print('\nO ícone é achado pelo id (SPRITE_ID em data.js), e o @2x sai junto,')
        print('então não há lista de arquivos para manter em lugar nenhum.')


if __name__ == '__main__':
    main()

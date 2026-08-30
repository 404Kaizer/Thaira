"""Monta a tira de referência de ESTILO: assets/skins/_ref_estilo.png

    python assets/build_ref_estilo.py

Ela existe por um motivo só. Anexar uma imagem ao gerador leva estilo E
identidade juntos, e pedir "copie o estilo, não o personagem" é uma NEGAÇÃO —
o gerador ignora, e devolve o mesmo personagem de novo. Com cinco corpos
diferentes na mesma imagem (um olho só, asa, robe, placa, moicano), não existe
"o personagem" para copiar: o que sobra de comum entre eles é exatamente o que
se quer levar — contorno, bandas de sombra, direção da luz, proporção, paleta.

Para gerar OUTRA pose do MESMO personagem, esta tira é a errada: aí se anexa
`_ref_<skin>.png`, onde copiar a identidade é o objetivo. A §6 do
COMO_ADICIONAR.md tem a tabela.

Todos entram na mesma altura, porque o que se compara aqui é o traço e não o
tamanho. Nome começando com `_` de propósito: o build_skins.py pula arquivo
assim, e o build_criaturas.py só olha diretórios.
"""
import os
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, 'skins', '_ref_estilo.png')
CW, CH = 352, 248          # célula das folhas montadas, igual ao build_criaturas
ALTURA = 300               # altura comum de todos na tira
ESPACO, MARGEM = 70, 60
CHAVE = (255, 0, 255)

# (arquivo, célula) — célula None quer dizer quadro solto. A escolha é por
# CONTRASTE entre eles: quanto mais diferentes os corpos, menos identidade
# sobra para o gerador copiar por engano.
FONTES = [
    ('creatures/cyclops.png', (0, 0)),
    ('creatures/demon.png', (0, 0)),
    ('creatures/voc_knight_commom.png', (0, 0)),
    ('creatures/voc_sorcerer_common.png', (0, 0)),
    ('skins/voc_knight/voc_knight_veteran/voc_knight_veteran_idle_front_01.png', None),
]


def recorta(rel, celula):
    im = Image.open(os.path.join(AQUI, rel)).convert('RGBA')
    if celula:
        r, c = celula
        im = im.crop((c * CW, r * CH, c * CW + CW, r * CH + CH))
    b = im.split()[3].point(lambda a: 255 if a > 16 else 0).getbbox()
    if not b:
        return None
    im = im.crop(b)
    return im.resize((max(1, round(im.width * ALTURA / im.height)), ALTURA), Image.LANCZOS)


def main():
    figs = []
    for rel, cel in FONTES:
        if not os.path.exists(os.path.join(AQUI, rel)):
            print('  falta %s, pulado' % rel)
            continue
        f = recorta(rel, cel)
        if f:
            figs.append(f)
    assert len(figs) >= 3, 'a tira perde a graça com menos de 3 corpos diferentes'
    w = sum(f.width for f in figs) + ESPACO * (len(figs) - 1) + MARGEM * 2
    fol = Image.new('RGB', (w, ALTURA + MARGEM * 2), CHAVE)
    x = MARGEM
    for f in figs:
        fol.paste(f, (x, fol.height - MARGEM - f.height), f)
        x += f.width + ESPACO
    fol.save(SAIDA)
    print('%s  %dx%d  — %d corpos diferentes, um estilo só'
          % (os.path.relpath(SAIDA, os.path.dirname(AQUI)), fol.width, fol.height, len(figs)))


if __name__ == '__main__':
    main()

"""Confere uma folha recém-gerada ANTES de cortar.

    python assets/confere_folha.py <folha.png> [quantas_poses]

Responde as quatro perguntas que decidem se a folha presta, e todas elas já
reprovaram folha de verdade nesta casa:

    1. as poses estão todas na mesma altura?      (a escala do build e uma so)
    2. alguma tem peça solta ou linha desenhada?  (o corte por mancha quebra)
    3. as passadas são OPOSTAS ou a mesma duas vezes?
    4. o fundo é chapado, e qual é ele?

A pergunta 3 é a que mais escapa, e por um motivo medido: **duas passadas
opostas têm quase a mesma silhueta**. As duas pernas ocupam o mesmo contorno; o
que muda é qual está na frente, e isso é COR. Medir máscara de alfa aqui dá
6,9% onde a resposta certa é 48%, e conclui-se exatamente o contrário do que se
vê. Por isso a conta olha cor, e só abaixo de 70% da altura — cabelo, barba e
capa mexem sozinhos e inflam o número.

Réguas, calibradas em folhas reais do projeto:

    pernas com 45% ou mais de mudança de cor  ->  passadas opostas, aprovado
    pernas com menos de 20%                   ->  a mesma passada duas vezes
    altura entre poses abaixo de 94%          ->  o boneco cresce ao virar

E o desempate visual, que não precisa de régua: numa vista de frente ou de
costas, a bota que está à frente é a que DESCE MAIS. Se for a mesma bota nas
duas passadas, é o mesmo passo — não importa o que a porcentagem diga.
"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage

TOL = 60          # distância da cor do fundo, a mesma do build_folhas
FUNDO_H = .70     # abaixo disto é "perna", para a conta de passada
OPOSTA, IGUAL = 45., 20.
ALTURA_MIN = 94.
MIN_AREA = 400    # mancha menor que isto é sujeira, a mesma régua do build_folhas


def separa(caminho, quantas):
    im = Image.open(caminho).convert('RGBA')
    a = np.asarray(im)
    if a[:, :, 3].min() < 40:
        m, fundo = a[:, :, 3] > 16, 'transparente'
    else:
        rgb = a[:, :, :3].astype(int)
        quinas = np.vstack([rgb[:20, :20].reshape(-1, 3), rgb[:20, -20:].reshape(-1, 3),
                            rgb[-20:, :20].reshape(-1, 3), rgb[-20:, -20:].reshape(-1, 3)])
        cor = np.median(quinas, axis=0)
        m = np.sqrt(((rgb - cor) ** 2).sum(axis=2)) > TOL
        fundo = 'RGB %s (desvio %.0f)' % (cor.astype(int), quinas.std(axis=0).max())
    m = ndimage.binary_closing(m, np.ones((5, 5)))
    rot, n = ndimage.label(m)
    tam = ndimage.sum(m, rot, range(1, n + 1))
    ids = [i + 1 for i in np.argsort(-tam)[:quantas]]
    ids.sort(key=lambda i: np.where(rot == i)[1].mean())      # ordem de leitura
    poses, soltas = [], int((tam >= MIN_AREA).sum()) - len(ids)
    for i in ids:
        ys, xs = np.where(rot == i)
        px = np.asarray(im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))).copy()
        px[:, :, 3] = np.where((rot == i)[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 255, 0)
        poses.append(px)
    return poses, fundo, soltas


def norm(px, lado=120, alto=160):
    return np.asarray(Image.fromarray(px).resize((lado, alto), Image.NEAREST)).astype(int)


def difere(a, b, so_pernas):
    A, B = norm(a), norm(b)
    if so_pernas:
        c = int(A.shape[0] * FUNDO_H)
        A, B = A[c:], B[c:]
    both = (A[:, :, 3] > 127) & (B[:, :, 3] > 127)
    if not both.any():
        return 0.
    return float((np.abs(A[:, :, :3] - B[:, :, :3]).max(axis=2)[both] > 40).mean() * 100)


def bota_a_frente(px):
    """Numa vista frontal, a bota à frente é a que desce mais."""
    A = px[:, :, 3] > 16
    w = A.shape[1]
    ye = np.where(A[:, :w // 2].any(axis=1))[0].max()
    yd = np.where(A[:, w // 2:].any(axis=1))[0].max()
    return 'esquerda' if ye > yd + 4 else 'direita' if yd > ye + 4 else 'nivelada'


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    caminho = sys.argv[1]
    quantas = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    poses, fundo, soltas = separa(caminho, quantas)
    print('%s — %d pose(s)' % (os.path.basename(caminho), len(poses)))
    print('  fundo: %s' % fundo)
    if soltas > 0:
        print('  [X] %d mancha(s) solta(s) alem das poses — peca destacada ou linha desenhada' % soltas)

    alt = [p.shape[0] for p in poses]
    r = 100. * min(alt) / max(alt)
    print('  alturas: %s   min/max %.0f%%  %s' % (alt, r, 'ok' if r >= ALTURA_MIN else '[X] o boneco cresce ao virar'))

    print('  bota a frente por pose (so vale de frente/costas): %s'
          % ', '.join('%d=%s' % (i + 1, bota_a_frente(p)) for i, p in enumerate(poses)))

    print('  diferenca entre poses:')
    for i in range(len(poses)):
        for j in range(i + 1, len(poses)):
            per = difere(poses[i], poses[j], True)
            tudo = difere(poses[i], poses[j], False)
            sil = float(((norm(poses[i])[:, :, 3] > 127) ^ (norm(poses[j])[:, :, 3] > 127)).mean() * 100)
            nota = 'passadas OPOSTAS' if per >= OPOSTA else ('a MESMA passada' if per < IGUAL else 'duvidoso, olhe')
            print('    %d vs %d: pernas %5.1f%%  (corpo %5.1f%%, silhueta %5.1f%%)  -> %s'
                  % (i + 1, j + 1, per, tudo, sil, nota))


if __name__ == '__main__':
    main()

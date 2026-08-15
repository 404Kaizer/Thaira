#!/usr/bin/env python3
"""Busca e baixa preview CC0 do Freesound, pra alimentar assets/build_sfx.py.

    python tools/freesound.py busca "drink gulp" [quantos]
    python tools/freesound.py baixa eat 12345 67890 ...

A key sai de ~/.freesound-key (uma linha, fora do repo) ou da env FREESOUND_KEY.
Filtro de licença fixo em CC0: o jogo declara em assets/CREDITOS.md que nada
exige atribuição.

`baixa` grava em ~/Downloads/freesound/<nome>-<n>.mp3, que é onde o MAPA do
build_sfx.py aponta. Rodar de novo o mesmo nome sobrescreve.

ponytail: preview mp3 (~128k), não o original — original exigiria OAuth2, e pra
efeito de meio segundo a diferença não aparece. Se um dia precisar do WAV, o
caminho é trocar a autenticação, não este script.
"""
import json
import os
import sys
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

API = 'https://freesound.org/apiv2/search/text/?'
# Mesma raiz de pacotes que o build_sfx.py lê, numa subpasta própria: assim o
# `freesound/*.mp3` do MAPA resolve sem ninguém ter que copiar nada na mão.
DESTINO = Path(tempfile.gettempdir()) / 'aud' / 'freesound'


def key():
    k = os.environ.get('FREESOUND_KEY') or ''
    arq = Path.home() / '.freesound-key'
    if not k and arq.exists():
        k = arq.read_text(encoding='utf8').strip()
    if not k:
        sys.exit('sem key: salve em %s ou exporte FREESOUND_KEY' % arq)
    return k


def pegar(url):
    with urllib.request.urlopen(url, timeout=30) as r:
        return r.read()


def busca(termo, quantos=15, dur=6):
    p = urllib.parse.urlencode({
        'query': termo,
        'filter': 'license:"Creative Commons 0" duration:[0.1 TO %s]' % dur,
        'fields': 'id,name,duration,avg_rating,num_downloads,previews,username',
        'sort': 'score',
        'page_size': quantos,
        'token': key(),
    })
    achados = json.loads(pegar(API + p)).get('results', [])
    if not achados:
        print('  (nada — a busca é E, não OU: tire palavras)')
    for s in achados:
        print('%8d  %5.2fs  %s%4d  %-42s  %s' % (
            s['id'], s['duration'],
            ('%.1f* ' % s['avg_rating']) if s.get('avg_rating') else '  -  ',
            s.get('num_downloads', 0), s['name'][:42], s['username']))


def baixa(nome, ids):
    # Uma busca por id em vez de N: o filtro id:(a OR b) resolve tudo de uma vez.
    p = urllib.parse.urlencode({
        'query': '',
        'filter': 'id:(%s)' % ' OR '.join(ids),
        'fields': 'id,name,previews,license,username',
        'page_size': len(ids),
        'token': key(),
    })
    achados = {str(s['id']): s for s in json.loads(pegar(API + p)).get('results', [])}
    DESTINO.mkdir(parents=True, exist_ok=True)
    # A ordem da linha de comando é a ordem das variações no jogo, não a que a
    # API devolveu.
    for i, sid in enumerate(ids, 1):
        s = achados.get(sid)
        if not s:
            print('  !! %s não veio (id errado ou não é CC0)' % sid)
            continue
        url = s['previews'].get('preview-hq-mp3') or s['previews']['preview-lq-mp3']
        alvo = DESTINO / ('%s-%d.mp3' % (nome, i))
        alvo.write_bytes(pegar(url))
        print('  %s  <- %s (%s, %s)' % (alvo.name, s['name'][:40], s['license'].rsplit('/', 2)[-2], s['username']))


if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    if sys.argv[1] == 'busca':
        busca(sys.argv[2], *map(int, sys.argv[3:]))
    elif sys.argv[1] == 'baixa':
        baixa(sys.argv[2], sys.argv[3:])
    else:
        sys.exit(__doc__)

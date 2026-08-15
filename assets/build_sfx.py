#!/usr/bin/env python3
"""Monta assets/sfx a partir dos pacotes baixados.

Todo som do jogo vira N arquivos numerados (`hit.ogg`, `hit-2.ogg`, ...) mais uma
linha no manifest.json. O mapa abaixo é a única coisa que se edita: cada nome do
jogo aponta para uma lista de arquivos de origem, na ordem em que viram variação.

Rodar de novo é seguro — reescreve assets/sfx do zero.

    python assets/build_sfx.py /tmp/aud
"""
import json
import shutil
import tempfile
import time
import sys
from pathlib import Path

# Raiz dos pacotes de origem. Era '/tmp/aud' escrito na mão, que no Windows o
# Python resolve como C:\tmp\aud — pasta que não existe. Resultado: o build
# apagava assets/sfx e não achava nenhuma fonte pra repor.
PACOTES = Path(tempfile.gettempdir()) / 'aud'

# nome no jogo -> (lista de arquivos de origem, ganho)
# O ganho existe porque as fontes vêm com volumes bem diferentes entre si.
#
# Impacto vai em DUAS camadas, ligadas por MIX lá embaixo: um transiente de
# ataque rápido por cima de um corpo grave. A primeira montagem usava
# impactPunch, que medido tem 32 ms de ataque e 0% de energia acima de 1,8 kHz —
# por isso soava chapado. Os escolhidos aqui atacam em 1 ms.
# Entradas que começam com "_" são camadas: o jogo nunca as chama pelo nome.
MAPA = {
    # --- corpos graves, usados como camada de baixo
    '_corpo_medio': (['impact-sounds/**/impactSoft_medium_00%d.ogg' % i for i in range(4)], 0.3),
    '_corpo_forte': (['impact-sounds/**/impactMetal_heavy_00%d.ogg' % i for i in range(3)], 0.3),

    # --- impacto e defesa
    'hit':      (['impact-sounds/**/impactPlate_medium_00%d.ogg' % i for i in range(4)], 0.65),
    'crit':     (['impact-sounds/**/impactPlate_heavy_00%d.ogg' % i for i in range(4)], 0.75),
    'hurt':     (['oga80/**/creature_hurt_0%d.ogg' % i for i in (1, 2)], 0.6),
    'block':    (['impact-sounds/**/impactMetal_medium_00%d.ogg' % i for i in range(4)], 0.5),

    # --- armas
    'atk_sword':    (['oga80/**/blade_0%d.ogg' % i for i in (1, 2, 3)], 0.5),
    'atk_axe':      (['rpg-audio/**/chop.ogg', 'oga80/**/blade_01.ogg'], 0.55),
    'atk_club':     (['impact-sounds/**/impactWood_heavy_00%d.ogg' % i for i in range(3)], 0.55),
    'atk_fist':     (['impact-sounds/**/impactGeneric_light_00%d.ogg' % i for i in range(3)], 0.5),
    'atk_distance': (['oga80/**/blade_0%d.ogg' % i for i in (2, 3)], 0.4),
    'atk_wand':     (['oga80/**/spell_0%d.ogg' % i for i in (1, 2)], 0.45),
    'shoot':        (['oga80/**/blade_0%d.ogg' % i for i in (2, 3)], 0.4),

    # --- magia por elemento
    'spell_fire':   (['oga80/**/spell_fire_0%d.ogg' % i for i in (1, 2, 3, 4)], 0.5),
    'spell_ice':    (['impact-sounds/**/impactGlass_light_00%d.ogg' % i for i in range(3)], 0.5),
    'spell_energy': (['oga80/**/spell_0%d.ogg' % i for i in (1, 2)], 0.5),
    'spell_earth':  (['oga80/**/stones_0%d.ogg' % i for i in (1, 2, 3, 4)], 0.5),
    'spell_holy':   (['cure/**/Cure%d.wav' % i for i in (1, 2, 3)], 0.4),
    'spell_death':  (['oga80/**/creature_monster_0%d.ogg' % i for i in (1, 2)], 0.5),
    'fire':         (['oga80/**/spell_fire_0%d.ogg' % i for i in (5, 6, 7)], 0.5),
    'ice':          (['impact-sounds/**/impactGlass_medium_00%d.ogg' % i for i in range(3)], 0.5),
    'energy':       (['oga80/**/spell_0%d.ogg' % i for i in (1, 2)], 0.5),
    'rune':         (['oga80/**/item_gem_0%d.ogg' % i for i in (1, 2, 3, 4)], 0.5),

    # --- cura e reforço
    'heal': (['cure/**/Cure%d.wav' % i for i in (4, 5, 6, 7)], 0.4),
    'buff': (['oga80/**/item_gem_0%d.ogg' % i for i in (1, 2)], 0.45),

    # --- morte
    'die':   (['oga80/**/creature_die_01.ogg', 'oga80/**/creature_roar_01.ogg',
               'oga80/**/creature_roar_02.ogg'], 0.55),
    # morte do jogador: PIZZI07 e a mais descendente do pacote
    'death': (['music-jingles/**/jingles_PIZZI07.ogg'], 0.5),

    # --- progresso
    # PIZZI02 mede a maior subida de centroide do pacote (+0,96 kHz): e a
    # ascendente triunfal. PIZZI16 e curto e sobe pouco, do tamanho de um
    # ganho de skill. NES era chiptune e destoava de tudo.
    'levelup': (['music-jingles/**/jingles_PIZZI02.ogg'], 0.45),
    'skillup': (['music-jingles/**/jingles_PIZZI16.ogg',
                 'music-jingles/**/jingles_PIZZI00.ogg'], 0.3),

    # --- itens e interface
    # freesound/ vem de tools/freesound.py (preview mp3, CC0). Gravação de campo
    # entra mais alta que os pacotes de jogo, por isso os ganhos aqui são
    # menores que os vizinhos — é esse número que se mexe se soar alto demais.
    'loot':     (['freesound/loot-%d.mp3' % i for i in (1, 2, 3, 4)], 0.5),
    'coin':     (['freesound/coin-%d.mp3' % i for i in (1, 2, 3, 4)], 0.4),
    'equip':    (['rpg-audio/**/cloth%d.ogg' % i for i in (1, 2, 3)], 0.6),
    'unequip':  (['rpg-audio/**/cloth%d.ogg' % i for i in (3, 4)], 0.5),
    'potion':   (['freesound/potion-%d.mp3' % i for i in (1, 2, 3)], 0.45),
    'eat':      (['freesound/eat-%d.mp3' % i for i in (1, 2, 3, 4)], 0.45),
    'stairs':   (['rpg-audio/**/creak%d.ogg' % i for i in (1, 2, 3)], 0.5),
    'error':    (['interface-sounds/**/error_00%d.ogg' % i for i in (1, 2)], 0.4),
    # ui_click sai em TODO botão, então é o som que mais toca no jogo depois do
    # passo: ganho baixo de propósito, e três variações porque repetir o mesmo
    # arquivo em menu é o que faz interface soar máquina de escrever.
    'ui_click': (['freesound/ui_click-%d.mp3' % i for i in (1, 2, 3)], 0.3),
    'ui_close': (['freesound/ui_close-1.mp3'], 0.35),

    # --- passos por terreno. Água e lava não entram: TILE marca as duas como
    # não caminháveis, então o som nunca dispararia.
    'step_grass': (['impact-sounds/**/footstep_grass_00%d.ogg' % i for i in range(5)], 0.35),
    'step_dirt':  (['rpg-audio/**/footstep0%d.ogg' % i for i in range(5)], 0.35),
    'step_sand':  (['impact-sounds/**/footstep_snow_00%d.ogg' % i for i in range(5)], 0.35),
    'step_stone': (['impact-sounds/**/footstep_concrete_00%d.ogg' % i for i in range(5)], 0.3),
    'step_rock':  (['impact-sounds/**/footstep_concrete_00%d.ogg' % i for i in range(5)], 0.3),
    'step_cave':  (['impact-sounds/**/footstep_concrete_00%d.ogg' % i for i in range(5)], 0.3),
}


# som -> camadas extras tocadas junto. Só o que precisa de peso entra aqui.
MIX = {
    'hit': ['_corpo_medio'],
    'crit': ['_corpo_forte'],
    'block': ['_corpo_medio'],
    'atk_club': ['_corpo_medio'],
    'atk_fist': ['_corpo_medio'],
    'atk_axe': ['_corpo_medio'],
    'die': ['_corpo_forte'],
}


def achar(raiz: Path, padrao: str):
    """Resolve um padrão do mapa em um caminho real, ou None."""
    achados = sorted(raiz.glob(padrao))
    return achados[0] if achados else None


def main():
    origem = Path(sys.argv[1]) if len(sys.argv) > 1 else PACOTES
    destino = Path(__file__).parent / 'sfx'
    exemplo = destino / 'manifest.example.json'
    guardado = exemplo.read_bytes() if exemplo.exists() else None
    if destino.exists():
        shutil.rmtree(destino)
    destino.mkdir(parents=True)
    if guardado:
        exemplo.write_bytes(guardado)

    manifesto = {}
    faltando = []
    for nome, (padroes, vol) in MAPA.items():
        copiados = 0
        ext = None
        for padrao in padroes:
            src = achar(origem, padrao)
            if src is None:
                faltando.append(padrao)
                continue
            if ext is None:
                ext = src.suffix.lstrip('.')
            elif src.suffix.lstrip('.') != ext:
                faltando.append('%s (extensão mista, ignorado)' % padrao)
                continue
            copiados += 1
            sufixo = '' if copiados == 1 else '-%d' % copiados
            shutil.copy2(src, destino / ('%s%s.%s' % (nome, sufixo, ext)))
        if copiados:
            entrada = {'n': copiados, 'v': vol}
            if ext != 'ogg':
                entrada['ext'] = ext
            if nome in MIX:
                entrada['mix'] = MIX[nome]
            manifesto[nome] = entrada
        else:
            faltando.append('!! %s ficou sem nenhum arquivo' % nome)

    manifesto['ext'] = 'ogg'
    # rev vira ?v= na URL de cada som. Sem isso, trocar um arquivo mantendo o
    # nome deixa o navegador servindo o antigo para sempre.
    manifesto['rev'] = str(int(time.time()))
    (destino / 'manifest.json').write_text(
        json.dumps(manifesto, indent=2, ensure_ascii=False) + '\n', encoding='utf8')

    total = sum(f.stat().st_size for f in destino.iterdir() if f.is_file())
    print('sons montados : %d' % len([k for k in manifesto if k not in ('ext', 'rev')]))
    print('arquivos      : %d' % len(list(destino.glob('*.ogg')) + list(destino.glob('*.wav'))))
    print('peso           : %.1f MB' % (total / 1048576))
    if faltando:
        print('\nnao encontrados (%d):' % len(faltando))
        for f in faltando:
            print('  ' + f)


if __name__ == '__main__':
    main()

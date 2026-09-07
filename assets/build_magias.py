#!/usr/bin/env python3
"""build_magias.py — sintetiza os sons de MAGIA e de HABILIDADE de criatura.

    python assets/build_magias.py

Diferente do build_sfx.py, aqui não há pacote de origem: cada som sai de
oscilador e ruído filtrado. Existe porque o que faltava não se acha em banco
pronto — "grito de mudança de fase de chefe" e "dreno de mana" não são categoria
de pacote de efeitos, e o jogo estava tocando o jingle de SUBIR DE NÍVEL na
virada de fase justamente por não haver som para aquilo.

DUAS CAMADAS, e é isso que evita 35 arquivos:
  gesto    (cast_*)  — o que a magia FAZ: dardo, onda, estouro, conjuração, grito
  elemento (spell_*) — do que ela é FEITA: fogo, gelo, energia, terra, sagrado,
                       morte, físico
O jogo toca as duas na mesma posição (`castSpell`, game.js). 5 gestos × 7
elementos sairiam de 35 arquivos; assim são 12 nomes.

Sai WAV porque não há codificador ogg nesta máquina (nem ffmpeg nem oggenc) e o
manifesto aceita extensão por entrada. Se um dia entrar codificador, troca-se
`grava()` e mais nada.

Roda no fim do build_sfx.py: aquele apaga assets/sfx do zero, então som que não
seja regerado por script se perde no próximo build.
"""
import json
import shutil
import time
import wave
from datetime import date
from pathlib import Path

import numpy as np
from scipy import signal

SR = 32000          # 32 kHz: nenhum destes sons tem conteúdo útil acima de 16k
SFX = Path(__file__).parent / 'sfx'


# ------------------------------------------------------------- primitivas
def _t(d):
    return np.arange(int(SR * d)) / SR


def ruido(d, r):
    return r.uniform(-1, 1, int(SR * d))


def env(d, atk=.004, curva=5.):
    """Ataque curto + queda exponencial. `curva` alta = seco, baixa = arrastado."""
    e = np.exp(-curva * _t(d) / d)
    n = max(1, int(SR * atk))
    e[:n] *= np.linspace(0, 1, n)
    return e


def sobe(d, cauda=.06):
    """Envelope que CRESCE. É o que separa sugar de bater: um dreno de mana com
    envelope de percussão soa como soco, não como sucção."""
    n = int(SR * d)
    e = np.linspace(0, 1, n) ** 2
    k = int(SR * cauda)
    e[n - k:] *= np.linspace(1, 0, k)
    return e


def sweep(d, f0, f1, forma='sine'):
    f = f0 * (f1 / f0) ** (_t(d) / d)
    fase = 2 * np.pi * np.cumsum(f) / SR
    if forma == 'saw':
        return 2 * ((fase / (2 * np.pi)) % 1) - 1
    if forma == 'tri':
        return 2 * np.abs(2 * ((fase / (2 * np.pi)) % 1) - 1) - 1
    return np.sin(fase)


def _sos(f, tipo):
    ny = SR / 2
    if tipo == 'band':
        lo, hi = max(30., f / 2.2), min(f * 2.2, ny * .95)
        return signal.butter(2, [lo / ny, hi / ny], 'band', output='sos')
    return signal.butter(2, min(f, ny * .95) / ny, tipo, output='sos')


def filtro(x, f0, f1=None, tipo='low'):
    """Butterworth de 2ª ordem. Com `f1`, a frequência de corte VARRE — é a
    varredura que faz whoosh soar como coisa passando, e não como chiado."""
    if f1 is None or abs(f1 - f0) < 1:
        return signal.sosfilt(_sos(f0, tipo), x)
    saida = np.empty_like(x)
    B, zi = 128, None
    for i in range(0, len(x), B):
        sos = _sos(f0 * (f1 / f0) ** (i / max(1, len(x) - 1)), tipo)
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        saida[i:i + B], zi = signal.sosfilt(sos, x[i:i + B], zi=zi)
    return saida


def norm(x, pico=.85):
    m = np.abs(x).max()
    return x * (pico / m) if m > 1e-9 else x


def coloca(dest, sinal, atraso):
    i = int(SR * atraso)
    n = min(len(sinal), len(dest) - i)
    if n > 0:
        dest[i:i + n] += sinal[:n]
    return dest


def estalos(d, r, quantos, f0, f1, dur=.012, ganho=1.):
    """Impulsos esparsos. É o que separa fogo de vento e terra de trovão."""
    out = np.zeros(int(SR * d))
    for p in r.uniform(0, d - dur, quantos):
        coloca(out, filtro(ruido(dur, r), f0, f1, 'band') * env(dur, .0005, 10)
               * r.uniform(.4, 1.) * ganho, p)
    return out


# ------------------------------------------------------- camada ELEMENTO
# Ganho baixo de propósito no manifesto: isto entra POR BAIXO do gesto.
def spell_fire(r):
    d = .55
    # 2800->420, não 1600->260: medido por banda, o corte escuro punha 74% da
    # energia abaixo de 500 Hz e fogo virava o mesmo grave que terra e morte
    corpo = filtro(ruido(d, r), 2800, 420, 'low') * env(d, .012, 3.2)
    grave = sweep(d, 90 * r.uniform(.9, 1.1), 45, 'saw') * env(d, .02, 4) * .32
    return norm(corpo + grave + estalos(d, r, 7, 2600, 900) * .55)


def spell_ice(r):
    d = .5
    s = np.zeros(int(SR * d))
    for k, f in enumerate((2100, 2790, 3550)):
        s += np.sin(2 * np.pi * f * r.uniform(.94, 1.06) * _t(d)) * env(d, .002, 6 + k) * .3
    ar = filtro(ruido(d, r), 4200, 7000, 'high') * env(d, .05, 3.5) * .3
    lasca = filtro(ruido(d, r), 1400, 3200, 'band') * env(d, .001, 12) * .4
    return norm(s + ar + lasca)


def spell_energy(r):
    d = .32
    z = sweep(d, 380 * r.uniform(.9, 1.1), 2600, 'saw') * env(d, .002, 6)
    z *= .6 + .4 * np.sin(2 * np.pi * r.uniform(60, 95) * _t(d))   # tremor de corrente
    return norm(z * .7 + estalos(d, r, 5, 3000, 1400, .008) * .5)


def spell_earth(r):
    d = .6
    grave = filtro(ruido(d, r), 320, 120, 'low') * env(d, .02, 3)
    return norm(grave + estalos(d, r, 9, 900, 480, .028) * .45)


def spell_holy(r):
    d = .8
    base = 660 * r.uniform(.98, 1.02)
    s = np.zeros(int(SR * d))
    for k, mult in enumerate((1, 1.5, 2)):      # fundamental, quinta, oitava
        s += np.sin(2 * np.pi * base * mult * _t(d)) * env(d, .008, 3. + k) * (.36 / (k + 1))
    # ar discreto: a 5-9 kHz e ganho .16 o centroide media 8 kHz e a tríade
    # sumia debaixo do chiado — sagrado passava a soar como gelo
    ar = filtro(ruido(d, r), 3800, 6000, 'high') * env(d, .12, 2.2) * .07
    return norm(s + ar)


def spell_death(r):
    d = .7
    f0 = 240 * r.uniform(.9, 1.1)
    # duas serras desafinadas: o batimento é o que faz o lamento soar doente
    gemido = (sweep(d, f0, 70, 'saw') + sweep(d, f0 * 1.012, 71, 'saw')) * .5 * env(d, .06, 2.6)
    sopro = filtro(ruido(d, r), 700, 300, 'low') * env(d, .1, 2.2) * .35
    return norm(gemido * .7 + sopro)


def spell_physical(r):
    """Flecha e lança: só o ar rasgado. Sem cor mágica nenhuma — é justamente
    isso que o elemento 'physical' quer dizer."""
    d = .28
    return norm(filtro(ruido(d, r), 900, 2600, 'band') * env(d, .006, 5))


# ---------------------------------------------------------- camada GESTO
def cast_bolt(r):
    d = .18
    w = filtro(ruido(d, r), 3200, 900, 'band') * env(d, .002, 7)
    return norm(w + sweep(d, 700, 200, 'tri') * env(d, .001, 9) * .4)


def cast_wave(r):
    """Onda e raio: projeção para longe. O volume CRESCE enquanto a varredura
    sobe — é o que dá a sensação de coisa que sai de você e vai embora."""
    d = .45
    n = int(SR * d)
    w = filtro(ruido(d, r), 900, 3000, 'band') * np.linspace(.2, 1, n) ** 1.5 * env(d, .02, 2.4)
    # o triângulo grave dá corpo, mas a .35 ele levava 88% da energia para baixo
    # de 500 Hz e a onda soava igual ao estouro em área
    return norm(w + sweep(d, 160, 340, 'tri') * env(d, .02, 2.6) * .16)


def cast_aoe(r):
    d = .65
    boom = sweep(d, 260 * r.uniform(.95, 1.05), 70, 'sine') * env(d, .004, 3.2) * .8
    corpo = filtro(ruido(d, r), 1800, 200, 'low') * env(d, .002, 4.5) * .6
    # estalo agudo na cabeça: sem ele o estouro do jogador media 98% abaixo de
    # 500 Hz, o mesmo lugar do baque de bicho (hab_area), e os dois se confundiam
    trinco = filtro(ruido(.09, r), 3200, 1400, 'band') * env(.09, .0005, 8) * 1.6
    return norm(coloca(boom * .9 + corpo, trinco, 0))


def cast_conjure(r):
    """Ao contrário de todo o resto: sopra para DENTRO e termina num tinido. Runa
    não é golpe — com ataque de percussão soaria como acertar alguém."""
    d = .42
    n = int(SR * d)
    s = filtro(ruido(d, r), 900, 3400, 'band') * np.linspace(0, 1, n) ** 2.5 * .5
    return norm(coloca(s, np.sin(2 * np.pi * 1750 * _t(.1)) * env(.1, .001, 8) * .5, .33))


def cast_taunt(r):
    d = .5
    horn = sweep(d, 210 * r.uniform(.95, 1.05), 160, 'saw') * env(d, .03, 2.2)
    horn *= 1 + .25 * np.sin(2 * np.pi * 7 * _t(d))                # rouquidão
    rasgo = filtro(ruido(d, r), 800, 1600, 'band') * env(d, .02, 2.6) * .35
    return norm(horn * .8 + rasgo)


# ----------------------------------------------------- HABILIDADE de bicho
def hab_area(r):
    """Baque no chão, não estouro no ar: é o que separa da AoE do jogador."""
    d = .75
    thud = sweep(d, 110 * r.uniform(.95, 1.05), 34, 'sine') * env(d, .002, 3.8)
    terra = filtro(ruido(d, r), 900, 130, 'low') * env(d, .001, 4.2) * .55
    detrito = coloca(np.zeros(int(SR * d)), estalos(.4, r, 8, 700, 400, .02), .06)
    return norm(thud + terra + detrito * .35)


def hab_lento(r):
    d = .85
    vidro = sweep(d, 1500 * r.uniform(.95, 1.05), 420, 'tri') * env(d, .05, 2.4) * .45
    ar = filtro(ruido(d, r), 5000, 1200, 'band') * env(d, .08, 2.) * .35
    return norm(vidro + ar)


def hab_cura(r):
    """Sobe, porque é cura — mas em tríade MENOR e desafinada, porque é do
    inimigo. Se soar igual ao `heal` do jogador, ele comemora o que devia o
    assustar."""
    d = .7
    s = np.zeros(int(SR * d))
    for i, f in enumerate((311, 370, 466)):
        f *= r.uniform(.99, 1.01)
        # a oitava não é enfeite: só as fundamentais punham 98% da energia abaixo
        # de 500 Hz, e ali a cura do bicho some debaixo de qualquer luta
        coloca(s, (np.sin(2 * np.pi * f * _t(.34)) + .3 * np.sin(4 * np.pi * f * _t(.34)))
               * env(.34, .012, 4) * .3, i * .085)
    return norm(s + filtro(ruido(d, r), 600, 1400, 'band') * env(d, .06, 2.4) * .18)


def hab_mana(r):
    d = .6
    suga = filtro(ruido(d, r), 400, 3000, 'band') * sobe(d) * .6
    tom = sweep(d, 130, 520, 'tri') * sobe(d) * .35
    return norm(suga + tom)


def hab_fase(r):
    """Virada de fase de chefe. Cresce e desaba: o aviso é o crescimento, o soco
    é o fim."""
    d = 1.2
    n = int(SR * d)
    sopro = filtro(ruido(d, r), 200, 700, 'low') * np.linspace(0, 1, n) ** 2.2 * .5
    trompa = sweep(d, 70, 120, 'saw') * np.linspace(0, 1, n) ** 1.6 * .5
    s = sopro + trompa
    coloca(s, sweep(.35, 180, 40, 'sine') * env(.35, .002, 4) * .9, .85)
    coloca(s, filtro(ruido(.35, r), 2200, 300, 'low') * env(.35, .001, 5) * .5, .85)
    # o soco precisa de médio para atravessar a luta: só grave, ele some
    coloca(s, filtro(ruido(.2, r), 1400, 700, 'band') * env(.2, .001, 6) * .45, .85)
    return norm(s)


# nome -> (função, variações, ganho no manifesto)
SONS = {
    'spell_fire':     (spell_fire, 4, .34),
    'spell_ice':      (spell_ice, 3, .34),
    'spell_energy':   (spell_energy, 3, .34),
    'spell_earth':    (spell_earth, 3, .34),
    'spell_holy':     (spell_holy, 3, .30),
    'spell_death':    (spell_death, 3, .34),
    'spell_physical': (spell_physical, 3, .38),

    'cast_bolt':      (cast_bolt, 3, .50),
    'cast_wave':      (cast_wave, 3, .48),
    'cast_aoe':       (cast_aoe, 3, .52),
    'cast_conjure':   (cast_conjure, 2, .45),
    'cast_taunt':     (cast_taunt, 2, .50),

    'hab_area':       (hab_area, 3, .55),
    'hab_lento':      (hab_lento, 2, .50),
    'hab_cura':       (hab_cura, 2, .48),
    'hab_mana':       (hab_mana, 2, .48),
    'hab_fase':       (hab_fase, 2, .60),
}


def grava(caminho, x):
    dados = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(str(caminho), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(dados.tobytes())


def confere(manifesto):
    """Régua: o jogo pede pelo NOME, e nome que ninguém gravou sai mudo sem erro
    nenhum — foi assim que `spell_physical` deixou três magias de ranger caladas.
    Então a conferência lê os nomes DO FONTE, não uma lista escrita aqui."""
    import re
    src = SFX.parent.parent / 'src'
    fonte = (src / 'game.js').read_text(encoding='utf8')
    dados = (src / 'data.js').read_text(encoding='utf8')
    pedidos = set(re.findall(r"'((?:spell_|cast_|hab_)[a-z_]+)'", fonte + dados))
    # nomes montados por concatenação, que a busca por literal não enxerga
    pedidos |= {'hab_' + t for t in re.findall(r"tipo: '(\w+)'", dados)}
    pedidos |= {'spell_' + e for e in re.findall(r"el: '(\w+)'", dados)}
    faltam = sorted(p for p in pedidos if p not in manifesto)
    assert not faltam, 'o jogo pede sons que ninguém gravou: %s' % faltam
    return len(pedidos)


def main():
    SFX.mkdir(parents=True, exist_ok=True)
    man_arq = SFX / 'manifest.json'
    try:
        man = json.loads(man_arq.read_text(encoding='utf8'))
    except Exception:
        man = {}

    # Amostra de pacote que este script substitui não é apagada: vai para pasta
    # datada. Som gerado é opinião, e opinião se revoga.
    velhos = [f for n in SONS for f in SFX.glob(n + '*') if f.suffix != '.wav']
    bkp = None
    if velhos:
        bkp = SFX.parent / ('sfx_antigo_%s' % date.today())
        bkp.mkdir(exist_ok=True)
        for f in velhos:
            shutil.move(str(f), str(bkp / f.name))

    total = 0
    for nome, (fn, n, vol) in SONS.items():
        for i in range(1, n + 1):
            r = np.random.default_rng(abs(hash((nome, i))) % 2**32)
            x = fn(r)
            assert np.isfinite(x).all(), '%s-%d tem NaN' % (nome, i)
            assert np.abs(x).max() > .2, '%s-%d saiu praticamente mudo' % (nome, i)
            arq = SFX / ('%s%s.wav' % (nome, '' if i == 1 else '-%d' % i))
            grava(arq, x)
            total += arq.stat().st_size
        man[nome] = {'n': n, 'v': vol, 'ext': 'wav'}

    pedidos = confere(man)
    man['rev'] = str(int(time.time()))
    man_arq.write_text(json.dumps(man, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
    print('sons sintetizados : %d nomes, %d arquivos, %.1f MB'
          % (len(SONS), sum(n for _, n, _ in SONS.values()), total / 1048576))
    print('nomes conferidos  : %d pedidos pelo fonte, nenhum mudo' % pedidos)
    if velhos:
        print('amostras antigas  : %d movidas para %s' % (len(velhos), bkp.name))


if __name__ == '__main__':
    main()

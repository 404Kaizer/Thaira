#!/usr/bin/env python3
"""Gera audicao.html — a página onde VOCÊ ouve e decide.

Existe porque quem monta o pacote de som aqui não escuta nada: as escolhas saem
de medição (tempo de ataque, energia por banda, tags da fonte) e isso pega som
chapado ou chiptune no meio do medieval, mas não pega gosto. A página toca cada
faixa e cada efeito, você marca o que fica e para onde vai, e ela cospe os dois
manifestos prontos para colar.

    python assets/build_audicao.py
"""
import json
from pathlib import Path

RAIZ = Path(__file__).parent
MUS = RAIZ / 'music'
SFX = RAIZ / 'sfx'

# tags declaradas pelo autor na fonte — é o que sobrou de objetivo para orientar
TAGS = {
    'dia-taverna': 'medieval, inn, lute, calm — The Old Tower Inn',
    'dia-bardo': 'medieval, fantasy, RPG — The Bards Tale',
    'dia-exploracao': 'medieval, fantasy — Medieval: Exploration',
    'dia-colheita': 'medieval, fantasy — Medieval: Harvest Season',
    'dia-mercado': 'medieval, fantasy — Medieval: Market Day',
    'dia-vila': 'fantasy, RPG, calm, HOME, town — Town Theme',
    'dia-celta': 'knights, celtic, folk, irish, medieval, strings',
    'dia-campina': 'classical, bells, horn, medieval, overworld, strings',
    'dia-menestrel': 'DnD, inn, lute, dance, feast, medieval',
    'dia-banquete': 'DnD, inn, folk, king, feast, calm',
    'noite-lamento': 'DnD, fantasy, castle, ancient, arcane, calm',
    'noite-campos': 'fantasy, RPG, cinematic, instrumental',
    'noite-espadas': 'ambient, fantasy',
    'caverna-eco': 'fantasy, cave',
    'caverna-masmorra': 'dungeon, ambience',
    'caverna-templo': 'dark, ruins, temple',
    'abismo-caverna': 'dark, cavern, ambient',
}
AMBIENTES = ['superficie-dia', 'superficie-noite', 'caverna', 'abismo']


def main():
    faixas = sorted(f.name for f in MUS.glob('*') if f.suffix in ('.mp3', '.ogg'))
    try:
        atual = json.loads((MUS / 'manifest.json').read_text(encoding='utf8'))
    except Exception:
        atual = {}
    onde = {}
    for amb, lista in atual.items():
        for f in lista:
            onde[f] = amb

    try:
        msfx = json.loads((SFX / 'manifest.json').read_text(encoding='utf8'))
    except Exception:
        msfx = {}

    dados = {
        'faixas': [{'arq': f, 'tags': TAGS.get(Path(f).stem, ''), 'amb': onde.get(f, '')}
                   for f in faixas],
        'ambientes': AMBIENTES,
        'sfx': msfx,
    }
    (RAIZ.parent / 'audicao.html').write_text(
        PAGINA.replace('__DADOS__', json.dumps(dados, ensure_ascii=False)), encoding='utf8')
    print('audicao.html gerado — %d faixas, %d efeitos' % (len(faixas), len(msfx) - 1))


PAGINA = r"""<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Thaira — audição</title>
<style>
:root{--line:#4a4335;--gold:#d9a441;--gold2:#f0cd7a;--txt:#ddd5c2;--dim:#8f8874}
*{box-sizing:border-box}
body{margin:0;background:#0b0c0f;color:var(--txt);font:14px/1.5 "Segoe UI",system-ui,sans-serif;padding:20px 24px 60px}
h1{font:700 22px Georgia,serif;color:var(--gold2);letter-spacing:.06em;margin:0 0 4px}
h2{font:700 13px Georgia,serif;color:var(--gold2);text-transform:uppercase;letter-spacing:.08em;
   margin:26px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px}
p.nota{color:var(--dim);margin:0 0 16px;max-width:70ch}
table{border-collapse:collapse;width:100%;max-width:1000px}
td,th{padding:6px 8px;border-bottom:1px solid #241f18;text-align:left;vertical-align:middle}
th{color:var(--dim);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.05em}
button{background:linear-gradient(#2b2823,#1a1815);color:var(--txt);border:1px solid var(--line);
  border-radius:5px;padding:5px 12px;cursor:pointer;font:600 12px Georgia,serif}
button:hover{border-color:var(--gold);color:var(--gold2)}
button.on{background:linear-gradient(#4a3f28,#2a2318);color:var(--gold2);border-color:var(--gold)}
select{background:#1a1815;color:var(--txt);border:1px solid var(--line);border-radius:4px;padding:4px 6px}
.tags{color:var(--dim);font-size:12px}
.arq{font-family:ui-monospace,monospace;font-size:12px}
textarea{width:100%;max-width:1000px;height:220px;background:#111;color:#cfc9ba;border:1px solid var(--line);
  border-radius:6px;padding:10px;font-family:ui-monospace,monospace;font-size:12px}
input[type=range]{width:110px;vertical-align:middle}
.barra{position:sticky;top:0;background:#0b0c0fee;padding:10px 0;border-bottom:1px solid var(--line);z-index:5}
</style></head><body>
<h1>Audição</h1>
<p class="nota">Ouça, decida e cole o resultado. Quem montou o pacote não escuta nada — as escolhas
saíram de medição e das tags do autor, o que evita som chapado ou chiptune fora de lugar, mas não
acerta gosto. Aqui você acerta.</p>

<div class="barra"><button id="parar">■ parar tudo</button>
<span class="tags" id="tocando" style="margin-left:12px"></span></div>

<h2>Trilha — para onde vai cada faixa</h2>
<table id="tmus"><thead><tr><th></th><th>arquivo</th><th>tags da fonte</th><th>ambiente</th></tr></thead><tbody></tbody></table>
<h2>Manifesto da trilha</h2>
<p class="nota">Cole em <span class="arq">assets/music/manifest.json</span>.</p>
<textarea id="outmus" readonly></textarea>
<div><button id="copmus">copiar</button></div>

<h2>Efeitos — volume de cada um</h2>
<p class="nota">O botão toca uma variação sorteada, como no jogo. O controle ajusta o ganho
(<span class="arq">v</span>) sem precisar recortar o arquivo.</p>
<table id="tsfx"><thead><tr><th></th><th>som</th><th>var.</th><th>ganho</th></tr></thead><tbody></tbody></table>
<h2>Manifesto dos efeitos</h2>
<p class="nota">Cole em <span class="arq">assets/sfx/manifest.json</span>.</p>
<textarea id="outsfx" readonly></textarea>
<div><button id="copsfx">copiar</button></div>

<script>
const D = __DADOS__;
const $ = s => document.querySelector(s);
let atual = null;
function tocar(url, rot){
  if(atual){ atual.pause(); atual = null; }
  const a = new Audio(url); a.volume = .8; a.play();
  atual = a; $('#tocando').textContent = '♪ ' + rot;
  a.onended = () => { if(atual===a){ atual=null; $('#tocando').textContent=''; } };
}
$('#parar').onclick = () => { if(atual){atual.pause();atual=null;} $('#tocando').textContent=''; };

/* ---- trilha */
const tb = $('#tmus tbody');
D.faixas.forEach(f => {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td><button>▶</button></td><td class="arq">${f.arq}</td>
    <td class="tags">${f.tags}</td>
    <td><select><option value="">— descartar —</option>${
      D.ambientes.map(a=>`<option value="${a}"${a===f.amb?' selected':''}>${a}</option>`).join('')}</select></td>`;
  tr.querySelector('button').onclick = e => { tocar('assets/music/'+f.arq, f.arq);
    document.querySelectorAll('#tmus button').forEach(b=>b.classList.remove('on'));
    e.target.classList.add('on'); };
  tr.querySelector('select').onchange = e => { f.amb = e.target.value; saidaMus(); };
  tb.appendChild(tr);
});
function saidaMus(){
  const m = {};
  D.ambientes.forEach(a => { const l = D.faixas.filter(f=>f.amb===a).map(f=>f.arq); if(l.length) m[a]=l; });
  $('#outmus').value = JSON.stringify(m, null, 2);
}
saidaMus();
$('#copmus').onclick = () => navigator.clipboard.writeText($('#outmus').value);

/* ---- efeitos */
const sb = $('#tsfx tbody');
const extGeral = D.sfx.ext || 'ogg';
Object.keys(D.sfx).filter(k=>k!=='ext').sort().forEach(nome => {
  const cfg = D.sfx[nome], ext = cfg.ext || extGeral;
  const tr = document.createElement('tr');
  tr.innerHTML = `<td><button>▶</button></td><td class="arq">${nome}${cfg.mix?' <span class="tags">+'+cfg.mix.join(',')+'</span>':''}</td>
    <td class="tags">${cfg.n}</td>
    <td><input type="range" min="0" max="1.5" step="0.05" value="${cfg.v}"> <span class="tags">${cfg.v}</span></td>`;
  tr.querySelector('button').onclick = () => {
    const i = 1 + Math.floor(Math.random()*cfg.n);
    tocar(`assets/sfx/${nome}${i>1?'-'+i:''}.${ext}`, nome);
    // camada junto, como o jogo faz
    (cfg.mix||[]).forEach(c => { const cc=D.sfx[c]; if(!cc) return;
      const j = 1 + Math.floor(Math.random()*cc.n);
      const a = new Audio(`assets/sfx/${c}${j>1?'-'+j:''}.${cc.ext||extGeral}`); a.volume=.8; a.play(); });
  };
  const r = tr.querySelector('input');
  r.oninput = e => { cfg.v = +e.target.value; e.target.nextElementSibling.textContent = cfg.v; saidaSfx(); };
  sb.appendChild(tr);
});
function saidaSfx(){ $('#outsfx').value = JSON.stringify(D.sfx, null, 2); }
saidaSfx();
$('#copsfx').onclick = () => navigator.clipboard.writeText($('#outsfx').value);
</script></body></html>
"""

if __name__ == '__main__':
    main()

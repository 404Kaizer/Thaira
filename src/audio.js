/* audio.js — todos os sons são sintetizados na hora com WebAudio.
   Zero arquivo, zero download, zero licença. O contexto só nasce no primeiro
   clique/tecla porque o navegador bloqueia áudio antes de interação. */
'use strict';

let AC = null, master = null, ambNodes = [];
let SFX_ON = localStorage.getItem('thaira.mute') !== '1';

/* Um ganho por categoria, todos pendurados no master. Assim dá para baixar só o
   passo sem mexer no resto — e o volume de cada um sobrevive ao recarregar.
   Passo tem barramento próprio porque é o som que mais toca no jogo: quem achar
   demais precisa poder abaixar só ele. */
const VOL_CATS = ['musica', 'efeitos', 'passos', 'ambiente'];
const VOL_PADRAO = { geral: .5, musica: .6, efeitos: 1, passos: .8, ambiente: .7 };
let VOL = Object.assign({}, VOL_PADRAO);
try { Object.assign(VOL, JSON.parse(localStorage.getItem('thaira.vol') || '{}')); } catch (e) { }
const BUS = {};

function audioVol(cat, v) {
  VOL[cat] = v;
  localStorage.setItem('thaira.vol', JSON.stringify(VOL));
  if (!AC) return;
  if (cat === 'geral') { if (SFX_ON) master.gain.setTargetAtTime(v, AC.currentTime, .05); }
  else if (BUS[cat]) BUS[cat].gain.setTargetAtTime(v, AC.currentTime, .05);
}
const audioVols = () => Object.assign({}, VOL);
function audioVolReset() { VOL = Object.assign({}, VOL_PADRAO); for (const k in VOL) audioVol(k, VOL[k]); }

function audioInit() {
  if (AC) return AC;
  const Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!Ctx) return null;
  AC = new Ctx();
  master = AC.createGain();
  master.gain.value = SFX_ON ? VOL.geral : 0;
  master.connect(AC.destination);
  for (const k of VOL_CATS) { BUS[k] = AC.createGain(); BUS[k].gain.value = VOL[k]; BUS[k].connect(master); }
  carregarAmostras();          // solta e segue; até chegar, toca sintetizado
  return AC;
}
function audioToggle() {
  audioInit();
  SFX_ON = !SFX_ON;
  localStorage.setItem('thaira.mute', SFX_ON ? '0' : '1');
  if (master) master.gain.setTargetAtTime(SFX_ON ? VOL.geral : 0, AC.currentTime, 0.05);
  return SFX_ON;
}

/* -------------------------------------------------------- som posicionado */
/* Um som com posição no mundo entra por aqui: perde volume com a distância e
   anda para o lado certo no estéreo. É isso que faz passo de monstro atrás de
   você soar atrás de você, em vez de tudo sair colado no centro.
   `destino` é o truque que evita ter de passar o nó de saída por dentro de cada
   entrada da tabela SFX: tone()/noise() escrevem em `destino || master`, e como
   toda a montagem de um som é síncrona, trocar antes e limpar depois é seguro. */
let destino = null;
const ALCANCE = 14;                 // tiles até o som sumir
function noMundo(x, y, bus) {
  if (!AC || x === undefined || typeof P === 'undefined' || !P) return null;
  const dx = x - P.px, dy = y - P.py, d = Math.hypot(dx, dy);
  if (d > ALCANCE) return false;                       // longe demais: nem monta
  const g = AC.createGain();
  const k = 1 - d / ALCANCE;
  g.gain.value = k * k;                                // queda quadrática, como no mundo real
  let no = g;
  if (AC.createStereoPanner) {
    const pan = AC.createStereoPanner();
    pan.pan.value = Math.max(-1, Math.min(1, dx / (ALCANCE * .45)));
    g.connect(pan); no = pan;
  }
  no.connect(bus || BUS.efeitos || master);
  return g;
}

/* ------------------------------------------------------------- primitivas */
function tone(o) {
  if (!AC || !SFX_ON) return;
  const t = AC.currentTime + (o.delay || 0);
  const osc = AC.createOscillator(), g = AC.createGain();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.f, t);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + o.d);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.v || 0.2, t + (o.atk || 0.008));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.d);
  osc.connect(g); g.connect(destino || master);
  osc.start(t); osc.stop(t + o.d + 0.02);
}
/* ruído: base de impacto, passo, vento, fogo */
function noise(o) {
  if (!AC || !SFX_ON) return;
  const t = AC.currentTime + (o.delay || 0), n = Math.floor(AC.sampleRate * o.d);
  const buf = AC.createBuffer(1, n, AC.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = AC.createBufferSource(); src.buffer = buf;
  const flt = AC.createBiquadFilter();
  flt.type = o.filter || 'lowpass';
  flt.frequency.setValueAtTime(o.f || 900, t);
  if (o.f2) flt.frequency.exponentialRampToValueAtTime(Math.max(60, o.f2), t + o.d);
  const g = AC.createGain();
  g.gain.setValueAtTime(o.v || 0.25, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.d);
  src.connect(flt); flt.connect(g); g.connect(destino || master);
  src.start(t);
}
const arp = (notas, passo, tipo, vol) => notas.forEach((f, i) =>
  tone({ f, d: passo * 2.2, delay: i * passo, type: tipo || 'triangle', v: vol || 0.16 }));

/* ------------------------------------------------------------ banco de sons */
const SFX = {
  hit:      () => { noise({ d: .12, f: 1400, f2: 260, v: .22 }); tone({ f: 150, f2: 70, d: .1, type: 'square', v: .1 }); },
  crit:     () => { noise({ d: .18, f: 2600, f2: 300, v: .3 }); tone({ f: 320, f2: 90, d: .18, type: 'sawtooth', v: .16 }); },
  hurt:     () => { tone({ f: 220, f2: 110, d: .22, type: 'sawtooth', v: .17 }); noise({ d: .1, f: 700, v: .12 }); },
  block:    () => { tone({ f: 900, f2: 500, d: .1, type: 'square', v: .12 }); noise({ d: .07, f: 3200, v: .14 }); },
  shoot:    () => { noise({ d: .09, f: 3000, f2: 900, v: .16, filter: 'bandpass' }); },
  fire:     () => { noise({ d: .35, f: 500, f2: 120, v: .22 }); tone({ f: 120, f2: 60, d: .3, type: 'sawtooth', v: .1 }); },
  ice:      () => { arp([1400, 1900, 2400], .045, 'sine', .12); noise({ d: .18, f: 5200, v: .08, filter: 'highpass' }); },
  energy:   () => { tone({ f: 900, f2: 2400, d: .18, type: 'square', v: .12 }); tone({ f: 1800, f2: 400, d: .2, type: 'sawtooth', v: .07, delay: .04 }); },
  rune:     () => { tone({ f: 700, f2: 1600, d: .16, type: 'triangle', v: .14 }); noise({ d: .12, f: 2400, v: .1 }); },
  heal:     () => arp([523, 659, 784, 1047], .06, 'sine', .13),
  buff:     () => arp([392, 523, 659], .07, 'triangle', .12),
  die:      () => { tone({ f: 300, f2: 60, d: .5, type: 'sawtooth', v: .18 }); noise({ d: .4, f: 800, f2: 100, v: .16 }); },
  death:    () => arp([392, 330, 262, 196, 131], .13, 'sawtooth', .18),
  levelup:  () => arp([523, 659, 784, 1047, 1319], .085, 'triangle', .2),
  skillup:  () => arp([784, 988, 1175], .06, 'sine', .14),
  loot:     () => { tone({ f: 1200, d: .06, type: 'square', v: .1 }); tone({ f: 1700, d: .07, delay: .05, type: 'square', v: .09 }); },
  coin:     () => arp([1568, 2093], .045, 'square', .12),
  equip:    () => { noise({ d: .1, f: 2200, f2: 600, v: .16 }); tone({ f: 420, f2: 260, d: .09, type: 'square', v: .1 }); },
  unequip:  () => { tone({ f: 260, f2: 420, d: .08, type: 'square', v: .09 }); },
  potion:   () => { tone({ f: 340, f2: 620, d: .18, type: 'sine', v: .14 }); noise({ d: .1, f: 1800, v: .07, delay: .1 }); },
  stairs:   () => { tone({ f: 300, f2: 520, d: .22, type: 'triangle', v: .14 }); },
  error:    () => tone({ f: 180, f2: 120, d: .12, type: 'square', v: .12 })
};
/* ------------------------------------------------- amostras (arquivo real) */
/* O sintetizador acima continua sendo o padrão E o plano B. Se existir
   `assets/sfx/manifest.json`, os nomes listados nele passam a tocar arquivo e o
   sintetizado some sozinho, sem tocar em nenhuma chamada de sfx() no jogo.
   O manifesto evita 22 requisições que dariam 404 quando não há pacote nenhum
   instalado: sem ele é UMA falha e pronto.
   Formato — a chave é o nome do som (as mesmas chaves de SFX):
     { "hit": 3, "crit": 1, "coin": { "n": 2, "v": 0.7 } }
   `n` = quantas variações existem, arquivos `hit.ogg`, `hit-2.ogg`, `hit-3.ogg`.
   `v` = ganho, porque arquivo de banco vem com volume de qualquer jeito e
   ninguém quer reeditar o wav só para baixar a espada. */
const SFX_BUF = {}, SFX_VOL = {}, SFX_MIX = {};
let amostrasPedidas = false;
/* Extensão: `"ext"` na raiz vale para todos, e cada entrada pode passar a sua em
   `{ "ext": "wav" }`. Não é enfeite — um pacote montado de duas fontes vem
   misturado (Kenney entrega ogg, banco de cura entrega wav) e reconverter tudo
   exigiria ferramenta que nem sempre existe na máquina. */
let audioExt = 'ogg';
/* `rev` do manifesto vira ?v= na URL de cada arquivo. Os nomes sao fixos (hit.ogg
   continua hit.ogg quando o som muda), entao sem isso o navegador serve o som
   antigo para sempre. Trocar o pacote passa a bastar: build_sfx.py sobe o rev. */
let audioRev = '';

/* Aviso na tela quando o pacote não entra. Antes isto falhava calado e o jogo
   voltava ao sintetizador sem dizer nada — quem abriu o index direto do disco
   ouvia os sons velhos e não tinha como saber por quê. Falha silenciosa aqui
   custa mais caro do que a linha no chat. */
function _avisarSemSom(motivo) {
  const msg = location.protocol === 'file:'
    ? 'Som: abrindo por file:// o navegador bloqueia a leitura dos arquivos. Feche e abra o jogo pelo JOGAR.bat para ouvir o pacote real.'
    : 'Som: pacote não carregou (' + motivo + '). Tocando os sons sintetizados.';
  if (typeof log === 'function') log(msg, 'bad'); else console.warn(msg);
}

async function carregarAmostras(base = 'assets/sfx') {
  if (!AC || amostrasPedidas) return;
  amostrasPedidas = true;
  let man;
  try {
    /* no-cache no manifesto: ele e minusculo e e a fonte da verdade. Se ele
       vier velho, tudo depois vem velho junto. */
    const r = await fetch(base + '/manifest.json', { cache: 'no-cache' });
    if (!r.ok) { _avisarSemSom('manifesto ' + r.status); return; }
    man = await r.json();
  } catch (e) { _avisarSemSom('sem acesso ao arquivo'); return; }
  if (man.ext) audioExt = String(man.ext).replace(/^\./, '');
  if (man.rev) audioRev = '?v=' + man.rev;
  await Promise.all(Object.entries(man).map(async ([nome, cfg]) => {
    if (nome === 'ext' || nome === 'rev') return;
    const n = typeof cfg === 'number' ? cfg : (cfg && cfg.n) || 1;
    SFX_VOL[nome] = cfg && cfg.v != null ? cfg.v : 1;
    if (cfg && cfg.mix) SFX_MIX[nome] = cfg.mix;
    const ext = (cfg && cfg.ext ? String(cfg.ext).replace(/^\./, '') : audioExt);
    const bufs = [];
    for (let i = 1; i <= n; i++) {
      try {
        const r = await fetch(`${base}/${nome}${i > 1 ? '-' + i : ''}.${ext}` + audioRev);
        if (!r.ok) continue;
        bufs.push(await AC.decodeAudioData(await r.arrayBuffer()));
      } catch (e) { /* um arquivo torto não leva os outros junto */ }
    }
    if (bufs.length) SFX_BUF[nome] = bufs;
  }));
  const n = Object.keys(SFX_BUF).length;
  if (!n) _avisarSemSom('nenhum arquivo abriu');
}

/* Sorteia a variação e desafina de leve. A desafinação não é enfeite: repetir o
   mesmo arquivo idêntico em sequência é exatamente o que faz um golpe soar
   mecânico, e ±4% resolve sem virar efeito audível. */
function _umaCamada(nome, saida) {
  const bufs = SFX_BUF[nome];
  if (!bufs) return false;
  const src = AC.createBufferSource();
  src.buffer = bufs[(Math.random() * bufs.length) | 0];
  src.playbackRate.value = 1 + (Math.random() - .5) * .08;
  const g = AC.createGain();
  g.gain.value = SFX_VOL[nome];
  src.connect(g); g.connect(saida || BUS.efeitos || master);
  src.start();
  return true;
}
/* Impacto que soa bem nunca é um arquivo só: é um transiente seco por cima de um
   corpo grave. Um golpe com só uma das duas metades soa chapado — foi exatamente
   o defeito da primeira montagem, onde `hit` era um punch de 32ms de ataque e
   zero energia aguda. `mix` no manifesto lista as camadas extras, que são
   entradas normais e portanto têm variação e volume próprios. Uma camada não
   puxa outra: duas de profundidade bastam e evitam laço. */
function tocarAmostra(nome, saida) {
  if (!_umaCamada(nome, saida)) return false;
  const camadas = SFX_MIX[nome];
  if (camadas) for (const c of camadas) _umaCamada(c, saida);
  return true;
}

/* `x`,`y` são tile no mundo e são opcionais: som de interface (loot, nível,
   erro) não tem lugar nenhum e toca centrado. */
function sfx(nome, x, y) {
  if (!AC || !SFX_ON) return;
  // passo tem barramento próprio; o resto dos efeitos divide o mesmo
  const bus = (nome.lastIndexOf('step_', 0) === 0 ? BUS.passos : BUS.efeitos) || master;
  let saida = bus;
  if (x !== undefined) {
    saida = noMundo(x, y, bus);
    if (saida === false) return;                 // fora de alcance
  }
  try { if (tocarAmostra(nome, saida)) return; } catch (e) { /* cai no sintetizado */ }
  const f = SFX[nome] || SFX[SFX_ALT[nome]];
  if (!f) return;
  destino = saida;
  try { f(); } catch (e) { /* som nunca derruba o jogo */ }
  destino = null;
}
/* Passo: o nome sai do terreno pisado, então `step_grass`, `step_stone`, etc.
   Sem arquivo não sai som nenhum — passo sintetizado soa pior que silêncio, e
   este é justamente o som que precisa ser bom para dar presença. */
function passo(x, y, z) {
  if (!AC || !SFX_ON || typeof TILE === 'undefined') return;
  const def = TILE[tileAt(x, y, z)];
  if (!def || !def.tex) return;
  sfx('step_' + def.tex, x, y);
}

/* Os nomes específicos (atk_sword, spell_fire, step_grass) não existem no banco
   sintetizado. Enquanto não houver arquivo para eles, caem aqui no som genérico
   de antes, então nada emudece na troca. Passo é a exceção proposital: fica em
   silêncio, porque passo sintetizado soa pior que passo nenhum. */
const SFX_ALT = {
  atk_sword: 'hit', atk_axe: 'hit', atk_club: 'hit', atk_fist: 'hit',
  atk_distance: 'shoot', atk_wand: 'energy',
  spell_fire: 'fire', spell_ice: 'ice', spell_energy: 'energy',
  spell_earth: 'fire', spell_holy: 'buff', spell_death: 'energy'
};

/* ---------------------------------------------------------------- trilha */
/* Uma faixa em laço vira tortura em dez minutos de jogo: o ouvido decora a volta
   e passa a esperar por ela. Então cada ambiente tem uma LISTA e as faixas se
   encadeiam — quando uma acaba, a próxima entra por passagem cruzada.
   A ordem é embaralhada a cada volta, e a primeira da volta nova nunca repete a
   última da anterior, senão o embaralhamento entrega justamente o que ele devia
   esconder.
   `assets/music/manifest.json` mapeia ambiente -> lista de arquivos:
     { "superficie-dia": ["dia-taverna.mp3", "dia-mercado.mp3"], ... }
   O nome do arquivo traz a extensão, então ogg e mp3 convivem na mesma lista.
   Sem manifesto, `musica()` devolve falso e o ambiente sintetizado assume. */
const MUS_CROSS = 3;
const MUS = { lista: null, amb: null, fila: [], i: 0, node: null, gain: null, timer: null, ultima: null };

async function musListas(base) {
  if (MUS.lista !== null) return MUS.lista;
  MUS.lista = {};                                  // marca como tentado antes do await
  try {
    const r = await fetch(base + '/manifest.json', { cache: 'no-cache' });
    if (r.ok) MUS.lista = await r.json();
  } catch (e) { /* sem trilha instalada */ }
  return MUS.lista;
}
/* Embaralha evitando que a volta nova comece com a faixa que acabou de tocar. */
function _embaralhar(arr, evitar) {
  const f = arr.slice();
  for (let i = f.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [f[i], f[j]] = [f[j], f[i]];
  }
  if (f.length > 1 && f[0] === evitar) [f[0], f[1]] = [f[1], f[0]];
  return f;
}
async function _decodificar(base, arq) {
  try {
    const r = await fetch(base + '/' + arq);
    if (!r.ok) return null;
    return await AC.decodeAudioData(await r.arrayBuffer());
  } catch (e) { return null; }
}
function _pararFaixa(node, gain) {
  if (!node) return;
  gain.gain.setTargetAtTime(0, AC.currentTime, MUS_CROSS / 3);
  setTimeout(() => { try { node.stop(); } catch (e) { } }, MUS_CROSS * 1000 + 300);
}
/* Toca a faixa `i` da fila e agenda a troca para MUS_CROSS antes do fim.
   O relógio é o `duration` do buffer, não o evento `ended`: agendando antes dá
   para sobrepor as duas e cruzar de verdade, em vez de deixar um buraco. */
async function _tocarFila(base, amb) {
  if (MUS.amb !== amb) return;                     // trocou de ambiente no meio do await
  const fila = MUS.fila;
  if (!fila.length) return;
  const arq = fila[MUS.i % fila.length];
  const buf = await _decodificar(base, arq);
  if (MUS.amb !== amb) return;
  if (!buf) {                                      // arquivo torto: pula para a próxima
    fila.splice(MUS.i % fila.length, 1);
    if (fila.length) return _tocarFila(base, amb);
    return;
  }
  _pararFaixa(MUS.node, MUS.gain);
  const t = AC.currentTime;
  const src = AC.createBufferSource(); src.buffer = buf;
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.32, t + MUS_CROSS);
  src.connect(g); g.connect(BUS.musica || master); src.start(t);
  MUS.node = src; MUS.gain = g; MUS.ultima = arq;
  clearTimeout(MUS.timer);
  const espera = Math.max(4, buf.duration - MUS_CROSS) * 1000;
  MUS.timer = setTimeout(() => {
    MUS.i++;
    if (MUS.i % fila.length === 0) MUS.fila = _embaralhar(fila, MUS.ultima), MUS.i = 0;
    _tocarFila(base, amb);
  }, espera);
}
async function musica(amb, base = 'assets/music') {
  if (!AC || !SFX_ON || amb === MUS.amb) return !!MUS.node;
  const listas = await musListas(base);
  const faixas = listas[amb];
  if (!faixas || !faixas.length) return false;
  MUS.amb = amb;
  MUS.fila = _embaralhar(faixas, MUS.ultima);
  MUS.i = 0;
  clearTimeout(MUS.timer);
  await _tocarFila(base, amb);
  return true;
}
function pararMusica() {
  clearTimeout(MUS.timer);
  try { if (MUS.node) MUS.node.stop(); } catch (e) { }
  MUS.node = MUS.gain = null; MUS.amb = null;
}

/* -------------------------------------------------------------- ambiente */
/* superfície: vento filtrado. caverna: pingos aleatórios. abismo: rumor grave.
   A trilha em arquivo, quando existe, toca por cima disso. */
function ambience(z) {
  if (!audioInit()) return;
  pararAmbiente();
  if (!SFX_ON) return;
  musica(z <= 1 ? (ehNoite() ? 'superficie-noite' : 'superficie-dia') : z === 3 ? 'abismo' : 'caverna');
  const t = AC.currentTime;
  if (z === 0 || z === 1) {                       // vento
    const n = AC.sampleRate * 4, buf = AC.createBuffer(1, n, AC.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1;
    const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
    const flt = AC.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 420;
    const g = AC.createGain(); g.gain.value = 0.035;
    const lfo = AC.createOscillator(), lg = AC.createGain();
    lfo.frequency.value = 0.09; lg.gain.value = 0.022;
    lfo.connect(lg); lg.connect(g.gain);
    src.connect(flt); flt.connect(g); g.connect(BUS.ambiente || master);
    src.start(t); lfo.start(t);
    ambNodes.push(src, lfo);
  } else {                                        // rumor grave da caverna
    const osc = AC.createOscillator(), g = AC.createGain();
    osc.type = 'sine'; osc.frequency.value = z === 3 ? 44 : 62;
    g.gain.value = 0.05;
    osc.connect(g); g.connect(BUS.ambiente || master);
    osc.start(t);
    ambNodes.push(osc);
    ambNodes.push(setInterval(() => {             // pingos
      if (Math.random() < 0.35) tone({ f: 900 + Math.random() * 900, f2: 300, d: .25, type: 'sine', v: .07 });
    }, 1700));
  }
}
/* Chuva: o mesmo loop de ruído do vento, filtrado para o agudo. Nasce na primeira
   chuva e não morre mais — em ganho zero um BufferSource em loop não custa nada, e
   montar/desmontar o grafo a cada virada de tempo dá estalo. Vai no `master`, então
   o botão de som continua mandando nele. A rampa é longa de propósito: o tempo vira
   devagar, som que entra de estalo denuncia o gatilho. */
let chuvaGain = null;
function chuvaSom(v) {
  if (!chuvaGain && !v) return;                  // nunca choveu: nem monta o grafo
  if (!audioInit()) return;
  if (!chuvaGain) {
    const n = AC.sampleRate * 4, buf = AC.createBuffer(1, n, AC.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1;
    const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
    const flt = AC.createBiquadFilter(); flt.type = 'highpass'; flt.frequency.value = 1100;
    chuvaGain = AC.createGain(); chuvaGain.gain.value = 0;
    src.connect(flt); flt.connect(chuvaGain); chuvaGain.connect(BUS.ambiente || master);
    src.start(AC.currentTime);
    // fora de ambNodes de propósito: chuva é do céu, não do andar — pararAmbiente()
    // roda a cada escada e mataria o loop no meio do temporal
  }
  chuvaGain.gain.setTargetAtTime(v * .07, AC.currentTime, 1.5);
}

/* ambNodes guarda osciladores e também o setInterval dos pingos — cada um morre do seu jeito */
function pararAmbiente() {
  for (const n of ambNodes) {
    try {
      if (typeof n === 'number') clearInterval(n);
      else if (n.stop) n.stop();
      else n.disconnect();
    } catch (e) { /* já parado */ }
  }
  ambNodes = [];
}
addEventListener('beforeunload', () => { pararAmbiente(); pararMusica(); });

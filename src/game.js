/* game.js — personagem, combate, IA, loot, UI e loop principal.
   Depende de THREE (global), data.js e world.js. */
'use strict';

const G = {
  mobs: [], corpses: [], drops: [], proj: [], fx: [], blood: [], plates: new Map(),
  now: 0, target: null, path: [], pendingLoot: null, lootOpen: null,
  keys: {}, walkDir: null, started: false, lastSpawn: 0, lastRegen: 0, lastSave: 0, dead: false,
  pausa: 0, abalo: null                       // hitstop e tremor de tela
};
let P = null;
const $ = s => document.querySelector(s);
const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

/* ------------------------------------------------------------------ itens */
function rollRarity(bonus = 0) {
  const w = RARITY.map((r, i) => r.w * (i ? 1 + bonus : 1));
  let t = w.reduce((a, b) => a + b, 0) * Math.random();
  for (let i = 0; i < w.length; i++) { t -= w[i]; if (t <= 0) return i; }
  return 0;
}
function mkItem(id, rarity = 0, count = 1) {
  const base = ITEMS[id];
  if (!base) return null;
  if (base.stack || !base.slot) return { id, r: 0, af: [], count, ch: base.charges };
  const af = [];
  const pool = [PREFIXES, SUFFIXES];
  for (let i = 0; i < RARITY[rarity].affixes; i++) {
    // re-sorteia em caso de repetido: antes o afixo duplicado era descartado e
    // o item saía com menos bônus do que a raridade promete
    const list = pool[i % 2];
    let pick = null;
    for (let t = 0; t < 12 && !pick; t++) {
      const c = list[Math.floor(Math.random() * list.length)];
      if (!af.some(a => a.n === c.n)) pick = c;
    }
    if (pick) af.push(pick);
  }
  return { id, r: rarity, af, count: 1 };
}
function itemStats(it) {
  const b = ITEMS[it.id], s = {
    name: b.n, ico: b.ico, slot: b.slot, wt: b.wt, el: b.el, lvl: b.lvl || 0, voc: b.voc,
    atk: b.atk || 0, def: b.def || 0, arm: b.arm || 0, dmg: b.dmg, price: b.price || 0,
    sell: b.sell || Math.round((b.price || 0) * 0.4), color: RARITY[it.r].color, bonus: {}
  };
  const add = o => { for (const k in o) s.bonus[k] = (s.bonus[k] || 0) + o[k]; };
  if (b.b) add(b.b);
  let atkPct = 0, defPct = 0;
  for (const a of it.af) {
    for (const k in a.b) {
      if (k === 'atkPct') atkPct += a.b[k];
      else if (k === 'defPct') defPct += a.b[k];
      else if (k === 'arm') s.arm += a.b[k];
      else add({ [k]: a.b[k] });
    }
  }
  s.atk = Math.round(s.atk * (1 + atkPct));
  s.def = Math.round(s.def * (1 + defPct));
  if (s.dmg) s.dmg = [Math.round(s.dmg[0] * (1 + atkPct)), Math.round(s.dmg[1] * (1 + atkPct))];
  const pre = it.af.filter(a => PREFIXES.includes(a)).map(a => a.n).join(' ');
  const suf = it.af.filter(a => SUFFIXES.includes(a)).map(a => a.n).join(' ');
  s.name = [pre, b.n, suf].filter(Boolean).join(' ');
  return s;
}
const BAG_SLOTS = 30;   // mais loot empilhável cabendo antes de precisar voltar pra loja
/* postura de combate, como as três setas do Tibia: quanto mais ataque, menos defesa */
const STANCE = {
  atk: { n: 'Ataque', ico: '⚔️', dmg: 1.0, def: 0.55, hint: 'dano cheio, defesa fraca' },
  bal: { n: 'Equilíbrio', ico: '⚖️', dmg: 0.78, def: 1.0, hint: 'meio termo' },
  def: { n: 'Defesa', ico: '🛡️', dmg: 0.45, def: 1.9, hint: 'quase não machuca, mas aguenta' }
};
const BUFF_LABEL = { haste: 'Pressa', mshield: 'Escudo Mágico', regen: 'Regeneração', light: 'Luz',
  rage: 'Fúria Sanguínea', guard: 'Protetor', sharp: 'Atirador de Elite', invis: 'Invisibilidade',
  lento: 'Lentidão' };
const BUFF_ICO = { haste: '💨', mshield: '🔵', regen: '🌱', light: '🔦',
  rage: '🩸', guard: '🛡️', sharp: '🎯', invis: '👻', lento: '🕸️' };
/* o que o efeito FAZ, em número — cada um lê o `val` do seu jeito (ver recalc):
   haste/regen/sharp somam direto, rage/guard são percentuais e lento é fração */
const BUFF_DESC = {
  haste: v => `Velocidade <b>+${v}</b>`,
  regen: v => `Recupera <b>+${v}</b> de vida e mana a cada 3s`,
  sharp: v => `Habilidade de distância <b>+${v}</b>`,
  lento: v => `Velocidade <b>−${Math.round(v * 100)}%</b>`,
  rage: v => `Dano causado <b>+${v}%</b>`,
  guard: v => `Defesa <b>+${v}%</b>`,
  mshield: () => 'Sua mana absorve o dano no lugar da vida',
  invis: () => 'Criaturas não enxergam você',
  light: () => 'Ilumina o terreno ao redor'
};
const BUFF_RUIM = { lento: 1 };
const BONUS_LABEL = {
  atkPct: 'Ataque', defPct: 'Defesa', arm: 'Armadura', speed: 'Velocidade', maxhp: 'Vida Máx',
  maxmana: 'Mana Máx', crit: 'Crítico', lifesteal: 'Roubo de Vida', hpReg: 'Regen. Vida', mpReg: 'Regen. Mana',
  sword: 'Espada', axe: 'Machado', club: 'Clava', distance: 'Distância', shielding: 'Escudo', magic: 'Magic Level', fist: 'Punho'
};
// rótulo das resistências: sai da própria tabela de elementos, não de uma lista à parte
for (const k in ELEM) BONUS_LABEL['res' + k[0].toUpperCase() + k.slice(1)] = 'Res. ' + ELEM[k].n;

const fmtBon = (k, v) => `+${k === 'crit' || k === 'lifesteal' || k.startsWith('res') || k.endsWith('Pct') ? Math.round(v * 100) + '%' : v} ${BONUS_LABEL[k] || k}`;
/* peças de um conjunto vestidas agora — vale para o bônus e para o tooltip */
const setCount = k => Object.values(P.eq).filter(it => it && ITEMS[it.id].set === k).length;

/* -------------------------------------------------------------- personagem */
function newPlayer(name, voc) {
  const p = {
    name, voc, level: 1, exp: 0, hp: 150, mana: 30, kills: 0,
    x: WORLD.temple.x, y: WORLD.temple.y + 2, z: SURF, px: WORLD.temple.x, py: WORLD.temple.y + 2, dir: 0,
    sk: { fist: { l: 10, t: 0 }, sword: { l: 10, t: 0 }, axe: { l: 10, t: 0 }, club: { l: 10, t: 0 }, distance: { l: 10, t: 0 }, shielding: { l: 10, t: 0 } },
    ml: { l: 0, t: 0 },
    eq: { helmet: null, amulet: null, armor: null, legs: null, boots: null, weapon: null, shield: null, ring: null, light: null },
    bag: [], gold: 200, buffs: {}, cd: {}, nextStep: 0, nextAtk: 0, stance: 'bal', follow: true,
    best: {}, charm: 0, charms: {}, seen: {}
  };
  P = p;
  /* Todo nível 1 sai do templo vestido igual: couro fechado e escudo de madeira.
     O que separa as vocações é a arma, que é o que decide como se luta — antes
     o cavaleiro nascia de sabre e os outros sem elmo nem escudo, e a diferença
     de armadura entre eles não era escolha de ninguém, só sobra de kit. */
  const ARMA_INICIAL = { knight: 'short_sword', ranger: 'short_bow', sorcerer: 'wand_of_vortex', druid: 'snakebite_rod' };
  // a tocha já sai acesa: sem ela o nível 1 deixa o templo cego assim que anoitece
  ['leather_helmet', 'leather_armor', 'leather_legs', 'leather_boots', 'wooden_shield', 'torch', ARMA_INICIAL[voc]]
    .forEach(id => equipItem(mkItem(id), true));   // silent: o kit ignora nível/vocação
  bagAdd(mkItem('health_potion', 0, 5));
  bagAdd(mkItem('mana_potion', 0, 5));
  recalc(); p.hp = p.st.maxhp; p.mana = p.st.maxmana;
  return p;
}

function recalc() {
  const v = VOCATIONS[P.voc];
  const st = {
    arm: 0, shieldDef: 0, speed: Math.round(220 * (1 + v.spd / 100 * (P.level - 1))), crit: 0.04, lifesteal: 0,
    maxhp: 150 + (P.level - 1) * v.hp, maxmana: 30 + (P.level - 1) * v.mana,
    hpReg: v.hpReg, mpReg: v.mpReg, sk: { fist: 0, sword: 0, axe: 0, club: 0, distance: 0, shielding: 0, magic: 0 },
    res: {}
  };
  const add = o => {
    for (const k in o) {
      if (k in st.sk) st.sk[k] += o[k];
      // resFire, resIce... a chave carrega o elemento; um ramo aqui e o afixo,
      // o conjunto e o bônus de base entram todos pelo mesmo caminho de sempre
      else if (k.startsWith('res')) {
        const e = k.slice(3).toLowerCase();
        st.res[e] = (st.res[e] || 0) + o[k];
      }
      else if (k in st) st[k] += o[k];
    }
  };
  for (const slot in P.eq) {
    const it = P.eq[slot]; if (!it) continue;
    const s = itemStats(it);
    st.arm += s.arm;
    if (slot === 'shield') st.shieldDef += s.def;
    add(s.bonus);
  }
  /* conjunto: os degraus são cumulativos, então valem todos os que a contagem
     de peças vestidas já passou */
  for (const k in SETS) {
    const n = setCount(k);
    for (const [q, b] of SETS[k].tiers) if (n >= q) add(b);
  }
  if (P.buffs.haste) st.speed += P.buffs.haste.val;
  if (P.buffs.regen) { st.hpReg += P.buffs.regen.val; st.mpReg += P.buffs.regen.val; }
  if (P.buffs.sharp) st.sk.distance += P.buffs.sharp.val;
  // teia e paralisia entram como buff de valor negativo: já ganham de graça o
  // relógio de expiração e o ícone na barra, que o resto dos efeitos usa
  if (P.buffs.lento) st.speed = Math.max(40, Math.round(st.speed * (1 - P.buffs.lento.val)));
  P.st = st;
  P.hp = Math.min(P.hp, st.maxhp); P.mana = Math.min(P.mana, st.maxmana);
}
const skillOf = k => (k === 'magic' ? P.ml.l : P.sk[k].l) + P.st.sk[k];

function weaponInfo() {
  const it = P.eq.weapon;
  if (!it) return { wt: 'fist', atk: 7, range: 1 };
  const s = itemStats(it);
  // a varinha atira na cor do que ela lança: o roxo fixo fazia a Varinha do
  // Inferno cuspir a mesma bola da Varinha da Podridão. Roxo só sobra de reserva
  if (s.wt === 'wand') return { wt: 'wand', dmg: s.dmg, range: 4, el: s.el, col: (ELEM[s.el] || 0).cor || 0xbb77ff };
  if (s.wt === 'distance') return { wt: 'distance', atk: s.atk, range: 5, col: 0xd9c48a };
  return { wt: s.wt, atk: s.atk, range: 1 };
}

/* ----------------------------------------------------------- progressão */
function addExp(n) {
  P.exp += n;
  while (P.exp >= expForLevel(P.level + 1)) {
    P.level++; recalc(); P.hp = P.st.maxhp; P.mana = P.st.maxmana;
    log(`Você avançou para o nível ${P.level}!`, 'good');
    notify('⭐', 'Nível ' + P.level, `${P.st.maxhp} de vida · ${P.st.maxmana} de mana`);
    fxBurst(P.x, P.y, 0xffd166, 1.6);
    sfx('levelup');
    renderHotbar(); renderSpells();
  }
  renderBars();
}
function addSkillTry(k, n = 1) {
  const s = P.sk[k]; s.t += n;
  if (s.t >= triesFor(k, s.l, P.voc)) {
    s.t = 0; s.l++; recalc();
    log(`Sua habilidade de ${SKILL_NAMES[k]} subiu para ${s.l}.`, 'good');
    notify('💪', `${SKILL_NAMES[k]} ${s.l}`, 'habilidade aprimorada');
    sfx('skillup');
    float(P.x, P.y, SKILL_NAMES[k] + ' ' + s.l, '#ffd166');
  }
  renderSkills();   // acontece no máximo a cada golpe (~2s): barato e a barra anda na tela
}
function addMagic(mana) {
  P.ml.t += mana;
  if (P.ml.t >= manaForML(P.ml.l, P.voc)) {
    P.ml.t = 0; P.ml.l++; recalc();
    log(`Seu Magic Level subiu para ${P.ml.l}.`, 'good');
    notify('🔮', `Magic Level ${P.ml.l}`, 'suas magias ficaram mais fortes');
    sfx('skillup');
    float(P.x, P.y, 'Magic Level ' + P.ml.l, '#8fd0ff');
  }
  renderSkills();
}

/* ------------------------------------------------------------ inventário */
/* Quanto o jogador ilumina, em tiles. Luz é item EQUIPADO: só o que está no slot
   `light` acende, a tocha guardada na mochila não vale nada — igual à espada, que
   não corta de dentro da bolsa. Sem fonte o raio é 0 e o escuro da noite e da
   caverna passa a ser problema seu; antes o herói brilhava sozinho, de graça e o
   tempo todo, o que tirava a razão de existir da tocha e do feitiço de luz.
   A MAIOR fonte manda, não a soma: tocha mais magia fraca não viram farol. */
function luzCarregada() {
  const it = P.eq.light;
  return Math.max(it ? (ITEMS[it.id] || 0).luz || 0 : 0, P.buffs.light ? P.buffs.light.val : 0);
}

function bagAdd(it) {
  if (!it) return false;
  if (it.id === 'gold') { P.gold += it.count; renderInv(); return true; }
  if (ITEMS[it.id].stack) {
    const ex = P.bag.find(b => b.id === it.id && b.count < 100);
    if (ex) { ex.count += it.count; renderInv(); return true; }
  }
  if (P.bag.length >= BAG_SLOTS) { log('Sua mochila está cheia.', 'bad'); return false; }
  P.bag.push(it); renderInv(); return true;
}
function canEquip(s) {
  if (P.level < s.lvl) { log(`Precisa de nível ${s.lvl} para usar isso.`, 'bad'); return false; }
  if (s.voc && !s.voc.includes(P.voc)) { log('Sua vocação não pode usar isso.', 'bad'); return false; }
  return true;
}
function equipItem(it, silent) {
  const s = itemStats(it);
  if (!s.slot) return false;
  if (!silent && !canEquip(s)) return false;
  const old = P.eq[s.slot];
  P.eq[s.slot] = it;
  const i = P.bag.indexOf(it); if (i >= 0) P.bag.splice(i, 1);
  if (old) P.bag.push(old);
  recalc(); renderInv(); renderBars();
  if (!silent) { log(`Equipou ${s.name}.`); sfx('equip'); }
  return true;
}
function unequip(slot) {
  const it = P.eq[slot]; if (!it) return;
  if (P.bag.length >= BAG_SLOTS) return log('Mochila cheia.', 'bad');
  P.eq[slot] = null; P.bag.push(it); recalc(); renderInv(); renderBars(); sfx('unequip');
}
/* runa: magia engarrafada. Qualquer vocação usa, o poder vem do nível + magic level. */
function useRune(it, b) {
  if (G.now < (P.cd.rune || 0)) return;
  if (b.rune.type !== 'heal' && emZonaSegura()) return log(AVISO_SEGURA, 'bad');
  const r = b.rune, ml = skillOf('magic');
  const pow = v => (v * (1 + ml * 0.1) + P.level * 0.25) * rnd(0.88, 1.12);
  const cor = '#' + (r.col || 0xffffff).toString(16).padStart(6, '0');
  if (r.type === 'heal') {
    curar(pow(r.base), r.n || 'runa'); fxBurst(P.x, P.y, 0x55dd55, 1.2);
    sfx('heal');
  } else {
    const m = G.target;
    if (!m || m.hp <= 0 || m.z !== P.z || distT(P.x, P.y, m.x, m.y) > 7) return log('Sem alvo válido para a runa.', 'bad');
    if (r.type === 'attack') shoot(P.px, P.py, m.px, m.py, r.col, () => dealDamage(m, pow(r.base), r.el, cor), 22, r.el);
    else {
      const tiles = [];
      for (let dy = -r.r; dy <= r.r; dy++) for (let dx = -r.r; dx <= r.r; dx++) tiles.push([m.x + dx, m.y + dy]);
      tiles.forEach(([x, y], i) => setTimeout(() => fxBurst(x, y, r.col, 0.9), i * 14));
      G.mobs.filter(o => o.z === P.z && tiles.some(([x, y]) => x === o.x && y === o.y))
        .forEach(o => dealDamage(o, pow(r.base), r.el, cor));
    }
    sfx('rune');
  }
  P.cd.rune = G.now + 1000;
  addMagic(Math.round(18 + r.base / 3));           // usar runa treina um pouco de magic level
  if (--it.ch <= 0) { P.bag.splice(P.bag.indexOf(it), 1); log('A runa se desfez.'); }
  renderInv(); renderBars();
}
function useItem(it) {
  const b = ITEMS[it.id];
  if (b.rune) return useRune(it, b);
  if (b.use) {
    if (G.now < (P.cd.potion || 0)) return;
    if (b.lvl && P.level < b.lvl) return log(`Precisa de nível ${b.lvl}.`, 'bad');
    P.cd.potion = G.now + 500;
    if (b.use.hp) curar(b.use.hp, b.n);
    if (b.use.mp) curar(b.use.mp, b.n, true);
    if (b.food) comer(b);
    // mesma placa da fala das magias: dá pra ver de longe quem bebeu ou comeu
    say(P, b.food ? 'Hmm...' : 'Gulp gulp...');
    if (--it.count <= 0) P.bag.splice(P.bag.indexOf(it), 1);
    sfx('potion');
    renderInv(); renderBars(); return;
  }
  if (b.slot) equipItem(it);
}
/* Comer enche por um tempo: soma no mesmo buff `regen` que a magia usa, então
   quem come regenera mais vida E mais mana por tique. Duas regras que o teto e o
   máximo resolvem: comer de novo SOMA no relógio em vez de reiniciar (até 10 min,
   senão uma mochila de presunto vira regeneração o dia inteiro), e nunca troca um
   efeito melhor por um pior — carne depois de presunto de dragão não pode piorar
   o que você já tem. */
const COMIDA_TETO = 10 * 60000;
function comer(b) {
  const a = P.buffs.regen;
  P.buffs.regen = {
    val: Math.max(b.food.v, a ? a.val : 0),
    end: Math.min(G.now + COMIDA_TETO, Math.max(G.now, a ? a.end : 0) + b.food.t * 1000)
  };
  recalc();
  log(`Você come ${b.n}. Regeneração por mais ${Math.round((P.buffs.regen.end - G.now) / 1000)}s.`);
}
/* Toda cura do jogador passa por aqui: clampa no teto, mostra o número na tela e
   escreve no log de combate. Estava repetido em quatro lugares (poção, runa,
   magia, roubo de vida) e cada um esquecia uma parte — um não flutuava, outro não
   aparecia no chat. Devolve o quanto curou de verdade, que é o que importa quando
   a vida já estava cheia. */
function curar(v, fonte, mana) {
  const teto = mana ? P.st.maxmana : P.st.maxhp, atual = mana ? P.mana : P.hp;
  const real = Math.max(0, Math.min(Math.round(v), teto - atual));
  if (!real) return 0;
  if (mana) P.mana += real; else P.hp += real;
  float(P.x, P.y, '+' + real, mana ? '#5aa9ff' : '#6ee36e');
  log(`+${real} de ${mana ? 'mana' : 'vida'}${fonte ? ' (' + fonte + ')' : ''}.`, 'cbt ' + (mana ? 'mana' : 'cura'));
  return real;
}
function dropItem(it) {
  P.bag.splice(P.bag.indexOf(it), 1);
  spawnDrop(P.x, P.y, P.z, it);
  renderInv();
}

/* --------------------------------------------------------------- visual */
/* as tabelas guardam cor como número (0xrrggbb) e a UI como '#rrggbb' */
const cssCol = c => typeof c === 'number' ? '#' + (c >>> 0).toString(16).padStart(6, '0') : c;
/* fala sobre a cabeça, estilo Tibia: chat e palavras de magia aparecem na tela */
function say(ent, txt) { ent.say = { txt, until: G.now + 4200 }; }
function float(x, y, txt, color) { G.fx.push({ kind: 'text', x, y, txt, color, t: G.now, dur: 950, el: null }); }
/* `el` é opcional e só decide a LUZ do estouro: explosão de terra não acende o
   terreno, de fogo acende. Sem elemento fica em 1, que é como era — cura, buff e
   conjuração não têm elemento e continuam brilhando. */
/* Tremor de tela. `amp` é em pixels de tela e some sozinho no tempo de `dur`.
   Guarda o pedido MAIS FORTE em vez de somar: numa área que acerta seis bichos
   o somatório viraria terremoto, e o tremor deixaria de significar "aquele
   golpe foi grande" para significar "acertou muita coisa". */
function abalo(amp, dur = 220) {
  const a = G.abalo;
  if (a && G.now - a.t < a.dur && a.amp * (1 - (G.now - a.t) / a.dur) > amp) return;
  G.abalo = { amp, dur, t: G.now };
}
/* Hitstop: o quadro inteiro para por alguns ms. Só em crítico e em morte — numa
   pancada comum viraria soluço, porque o ataque sai a cada 2 segundos. */
const congelar = ms => { G.pausa = Math.max(G.pausa, ms); };

function fxBurst(x, y, color, scale = 1, el) {
  G.fx.push({ kind: 'burst', x, y, color: cssCol(color), scale, luz: ELEM[el] ? ELEM[el].luz : 1,
    t: G.now, dur: 380 });
}
/* Sangue da morte: um esguicho curto de gotas e a mancha que fica no chão.
   As duas metades vivem em lugares diferentes de propósito — a gota é efeito e
   entra em G.fx, desenhado por cima; a mancha é chão e entra em G.blood, que o
   render pinta junto com o piso. Botar a mancha em G.fx faria ela aparecer por
   cima de quem pisasse nela.
   Deslocamentos em fração de tile, não em pixel, para acompanharem o zoom. */
/* Impacto: o que o golpe deixa na tela. Três leituras, à distância e sem ler
   número: físico espirra sangue (na cor do bicho — inseto verde, morto-vivo pó),
   mágico solta faísca na cor do elemento, e golpe que não passou solta fumaça.
   É um só efeito com três desenhos; o que muda é a partícula e como ela viaja.
   Sangue aqui NÃO deixa mancha no chão: mancha é coisa de morte, e uma poça por
   pancada cobriria a hunt inteira em um minuto. */
function impacto(x, y, tipo, cor, el) {
  const p = [];
  for (let i = 0, n = tipo === 'erro' ? 5 : 9; i < n; i++)
    p.push({ a: Math.random() * Math.PI * 2, v: .3 + Math.random() * .9, r: .7 + Math.random() * 1.6 });
  /* `tipo` continua respondendo "que golpe foi este" (é o que o log e o teste
     leem); o elemento entra por fora e traz o DESENHO: forma da partícula, para
     onde ela vai e se acende o terreno. Sem elemento, nada muda do que era. */
  const e = ELEM[el];
  G.fx.push({ kind: 'impacto', tipo, x, y, color: cssCol(e ? e.cor : (cor || SANGUE_PADRAO.cor)), p,
    forma: e && e.forma, grav: e ? e.grav : 1, luz: e ? e.luz : 0,
    t: G.now, dur: tipo === 'erro' ? 560 : 380 });
}

const SANGUE_MAX = 60;
function bloodSpray(x, y, z, sangue, forca = 1) {
  const s = sangue || SANGUE_PADRAO, c = cssCol(s.cor), seco = !!s.seco;
  const gotas = [];
  for (let i = 0; i < 10 + (Math.random() * 8 | 0); i++)
    gotas.push({ a: Math.random() * Math.PI * 2, v: (.35 + Math.random() * 1.3) * forca, r: .8 + Math.random() * 2 });
  G.fx.push({ kind: 'blood', x, y, color: c, gotas, seco, t: G.now, dur: 520 });
  // osso não escorre: o caco voa e acabou, sem poça no chão
  if (seco) return;
  const manchas = [];
  for (let i = 0; i < 4 + (Math.random() * 4 | 0); i++)
    manchas.push({ dx: (Math.random() - .5) * .9 * forca, dy: (Math.random() - .5) * .8 * forca,
      rx: (.09 + Math.random() * .2) * forca, ry: (.06 + Math.random() * .14) * forca });
  G.blood.push({ x, y, z, cor: c, manchas, t: G.now, dur: 70000 });
  // ponytail: teto simples no total de manchas. Cada uma custa ~6 elipses por
  // quadro; sem o corte, uma caçada longa vira engasgo. Se um dia incomodar,
  // pré-desenhar cada mancha num canvas resolve melhor que baixar o limite.
  while (G.blood.length > SANGUE_MAX) G.blood.shift();
}
/* `el` é opcional e só serve ao desenho: a cor continua vindo de quem atira,
   mas o rastro e a luz do projétil saem da tabela — flecha comum não acende
   nada, bola de fogo acende, torrão de terra não. */
function shoot(x0, y0, x1, y1, color, onHit, speed = 22, el) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  G.proj.push({ x0, y0, x1, y1, color: cssCol(color), el, t: G.now, dur: Math.max(90, d / speed * 1000), onHit });
}

/* ------------------------------------------------------------- monstros */
let mobSeq = 1;
/* O elite é sorteado no PONTO de spawn, não a cada aparição. A diferença
   importa: `refreshSpawns` remove e recria o bicho toda vez que você se afasta
   40 tiles, então sortear na aparição faria o mesmo orc piscar entre veterano e
   comum enquanto você anda pra frente e pra trás. Sorteado no ponto, ele é
   aquele bicho até morrer — e só a morte manda sortear de novo (em `removeMob`).
   Chefe não entra no sorteio: ele já é o extremo da espécie. */
function spawnMob(sp) {
  let d = MONSTERS[sp.m];
  if (sp.el === undefined) sp.el = (!sp.boss && Math.random() < ELITE_CHANCE) ? ri(0, ELITES.length - 1) : -1;
  if (sp.el >= 0) d = defModificada(d, ELITES[sp.el]);
  const m = {
    uid: mobSeq++, id: sp.m, def: d, n: d.n, hp: d.hp, maxhp: d.hp, x: sp.x, y: sp.y, z: sp.z,
    px: sp.x, py: sp.y, nextStep: 0, nextAtk: 0, atkT: 0, taunt: 0, chase: false, sp
  };
  sp.live = m; G.mobs.push(m);
  return m;
}
function removeMob(m, killed) {
  const i = G.mobs.indexOf(m); if (i >= 0) G.mobs.splice(i, 1);
  m.sp.live = null;
  /* Relógio de parede, não G.now: o respawn tem de correr com o jogo fechado.
     Voltar depois de uma hora e achar a caça repovoada é o certo; voltar e achar
     tudo exatamente como você deixou seria um mundo congelado.
     Chefe volta em minutos, não em segundos: é o que o faz valer a viagem. */
  m.sp.dead = killed ? Date.now() + (m.sp.boss ? ri(480000, 900000) : ri(25000, 60000)) : 0;
  if (killed) m.sp.el = undefined;             // morreu: o próximo sorteia elite de novo
  if (G.target === m) G.target = null;
  const pl = G.plates.get('m' + m.uid); if (pl) { pl.remove(); G.plates.delete('m' + m.uid); }
}
function occupied(x, y, z, self) {
  if (P.x === x && P.y === y && P.z === z && self !== P) return true;
  return G.mobs.some(m => m !== self && m.z === z && m.x === x && m.y === y);
}
/* Linha de VISTA, que não é linha de passo. Só o que é alto corta a vista, e alto
   é `top > 0.5` — a mesma régua que o render usa para saber o que desenha como
   parede. Água, lava e buraco impedem o pé e não os olhos: é isso que faz a box
   fechada segurar quem bate de perto (não tem como chegar) sem segurar quem
   atira (continua vendo e acertando). Pedra e parede de caverna cortam os dois,
   que é o certo — ninguém enxerga através de uma montanha. Criatura nunca entra
   na conta: bicho não tapa a mira de bicho. */
const tapaVista = (x, y, z) => TILE[tileAt(x, y, z)].top > 0.5;
/* Zona segura: o piso do templo é a própria fronteira, então não existe raio
   mágico aqui — quem está no tile TEMPLE não é perseguido nem atingido, e
   criatura nenhuma pisa nele. A geração já não NASCE spawn perto (world.js),
   mas isso não impedia o bicho de perseguir de longe até dentro do templo. */
const noTemplo = (x, y, z) => tileAt(x, y, z) === T.TEMPLE;
/* A proteção corta a violência dos DOIS lados: se a criatura não te alcança lá
   dentro, você também não alcança ela — senão o templo vira torre de tiro e a
   zona segura deixa de ser abrigo pra virar exploit. Cura, buff e conjuração
   continuam liberados: o que se proíbe é agredir, não se cuidar. */
const emZonaSegura = () => noTemplo(P.x, P.y, P.z);
const AVISO_SEGURA = 'Zona segura: aqui você não ataca nem conjura magia ofensiva.';
const SPELL_PACIFICA = { heal: 1, buff: 1, conjure: 1 };
function lineClear(x0, y0, x1, y1, z) {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0, n = 0;
  while ((x !== x1 || y !== y1) && n++ < 40) {
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
    if ((x !== x1 || y !== y1) && tapaVista(x, y, z)) return false;
  }
  return true;
}

/* Vagas na roda do jogador: os 8 tiles colados nele que dá para pisar. Cada
   perseguidor corpo a corpo reserva UMA, e o mais perto escolhe primeiro. Sem
   isso todo mundo mira o mesmo tile: o primeiro chega, os outros empurram a fila
   atrás dele e nunca cercam — era o que fazia os minotauros virarem coluna.
   Quem já está numa vaga reserva a própria (distância 0), então ninguém dança. */
function reservarVagas() {
  const livres = [];
  for (const [dx, dy] of DIRS) {
    const x = P.x + dx, y = P.y + dy;
    if (!isWalkable(x, y, P.z)) continue;
    livres.push([x, y]);
  }
  const vagas = new Map();
  const fila = G.mobs.filter(m => m.hp > 0 && m.chase && m.z === P.z && !m.def.ranged)
    .sort((a, b) => distT(a.x, a.y, P.x, P.y) - distT(b.x, b.y, P.x, P.y));
  for (const m of fila) {
    if (!livres.length) break;                 // mais bicho que lugar: o resto faz fila
    let bi = 0;
    for (let i = 1; i < livres.length; i++)
      if (distT(livres[i][0], livres[i][1], m.x, m.y) < distT(livres[bi][0], livres[bi][1], m.x, m.y)) bi = i;
    vagas.set(m, livres.splice(bi, 1)[0]);
  }
  return vagas;
}

/* Um passo rumo ao destino, contornando parede E quem está no caminho. Era passo
   guloso: só aceitava vizinho que DIMINUÍSSE a distância, então bastava um
   companheiro na frente para nenhum vizinho servir e o bicho travar de vez.
   Se o caminho limpo não existe (roda cheia), tenta de novo ignorando os corpos:
   assim ele ao menos anda até a fila e espera, em vez de desistir. */
function passoAte(m, gx, gy) {
  if (m.x === gx && m.y === gy) return null;
  // ponytail: A* inteiro a cada passo de cada bicho (700 nós, lista aberta em
  // varredura linear). Se um dia houver dezenas perseguindo ao mesmo tempo,
  // guardar o caminho em m.path e só refazer quando o primeiro passo quebrar.
  const bloq = (x, y) => occupied(x, y, m.z, m);
  const p = findPath(m.x, m.y, gx, gy, m.z, 700, bloq) || findPath(m.x, m.y, gx, gy, m.z, 700);
  return p && p.length ? p[0] : null;
}

/* Um passo para LONGE do jogador. Só serve o tile que aumenta a distância; sem
   nenhum (encurralado) devolve null e o bicho fica e luta — recuar para dentro de
   um canto é pior do que não recuar. */
function passoDeFuga(m) {
  let best = null, bd = distT(m.x, m.y, P.x, P.y);
  for (const [dx, dy] of DIRS) {
    const nx = m.x + dx, ny = m.y + dy;
    if (!isWalkable(nx, ny, m.z) || occupied(nx, ny, m.z, m)) continue;
    const nd = distT(nx, ny, P.x, P.y) + Math.random() * .4;
    if (nd > bd) { bd = nd; best = [nx, ny]; }
  }
  return best;
}

function updateMobs(dt) {
  const vagas = reservarVagas();
  const abrigado = noTemplo(P.x, P.y, P.z);   // vale pro quadro todo, não por criatura
  for (const m of G.mobs) {
    if (m.hp <= 0) continue;
    lerpEntity(m);
    const d = distT(m.x, m.y, P.x, P.y);
    const provocado = m.taunt > G.now;
    if (!G.dead && !P.buffs.invis && d <= 8 && G.now > (m.desistiu || 0) && lineClear(m.x, m.y, P.x, P.y, m.z)) m.chase = true;
    if (provocado) m.chase = true;
    // templo depois do taunt de propósito: zona segura ganha até de exeta res
    if ((d > 14 || G.dead || abrigado || (P.buffs.invis && !provocado))) m.chase = false;
    if (!m.chase) {
      if (G.now > m.nextStep && Math.random() < 0.01) {
        const [dx, dy] = DIRS[ri(0, 7)];
        tryStep(m, m.x + dx, m.y + dy);
      }
      continue;
    }
    /* MEDO: abaixo da fração de vida da espécie a criatura desiste e corre. Quem
       não tem `medo` na tabela luta até morrer — bicho burro não avalia perigo,
       morto-vivo não teme e brutamontes não recua. Provocado (exeta res) ignora o
       medo: é para isso que a magia serve. Encurralado, vira e luta. */
    if (m.def.medo && m.hp < m.def.medo * m.maxhp && !provocado) {
      const fuga = passoDeFuga(m);
      // tem para onde correr: corre e não ataca. Encurralado: cai para o normal e luta
      if (fuga) { if (G.now > m.nextStep) tryStep(m, fuga[0], fuga[1]); continue; }
    }
    if (m.def.hab) habilidade(m, d);
    /* Tiro e recuo são coisas separadas. Todo mundo com `ranged` atira quando tem
       alcance e linha; só quem tem `recua` é ATIRADOR e mantém distância — se o
       jogador entra dentro do alcance, abre espaço em vez de trocar soco, e sem
       para onde recuar fica e luta de perto. Dragão e demônio não recuam: queimam
       de longe enquanto avançam e terminam no corpo a corpo.
       Vale lembrar: `lineClear` olha só o mapa, então bicho não tapa a mira de
       bicho — arqueiro atrás da parede de minotauros continua acertando. */
    const r = m.def.ranged;
    if (r) {
      if (d <= r.range && d > 1 && lineClear(m.x, m.y, P.x, P.y, m.z) && G.now > m.nextAtk) {
        m.nextAtk = G.now + 2200; m.atkT = G.now;
        const dmg = ri(r.min, r.max);
        shoot(m.px, m.py, P.px, P.py, r.col, () => hitPlayer(dmg, m.n, r.el), 22, r.el);
      }
      if (r.recua) {
        if (d < r.range && G.now > m.nextStep) {
          const fuga = passoDeFuga(m);
          if (fuga) { tryStep(m, fuga[0], fuga[1]); continue; }
        }
        if (d > 1 && d <= r.range) continue;     // na distância boa: fica e atira
      }
    }
    if (d <= 1) {
      if (G.now > m.nextAtk) { m.nextAtk = G.now + 2000; m.atkT = G.now; hitPlayer(ri(m.def.atk[0], m.def.atk[1]), m.n); }
      continue;
    }
    if (G.now > m.nextStep) {
      // corpo a corpo vai até a vaga que reservou; sem vaga, entra na fila do
      // tile do próprio jogador e espera abrir
      const [gx, gy] = vagas.get(m) || [P.x, P.y];
      const passo = passoAte(m, gx, gy);
      /* Sem NENHUM caminho — nem ignorando quem está no meio — o jogador está em
         box. Para quem só bate de perto isso vale por cegueira: não tem como
         chegar, então larga e volta a vagar. Quem atira NÃO larga: enxerga por
         cima da água e continua caçando dali mesmo.
         O `desistiu` é o que segura a desistência: sem ele a linha de vista, que
         a box não corta, reacenderia a perseguição no quadro seguinte. */
      if (!passo) {
        if (!r) { m.chase = false; m.desistiu = G.now + 6000; }
        m.nextStep = G.now + 800;
        continue;
      }
      if (!tryStep(m, passo[0], passo[1])) m.nextStep = G.now + 400;
    }
  }
}
/* Bicho fora de briga se cura, 2% da vida cheia a cada tique de regeneração — o
   mesmo relógio de 3 s do jogador. Fora de briga OU fugindo com medo: quem está
   batendo de verdade não cura (viraria corrida contra a régua de dano), mas quem
   está fugindo não está batendo, então regenerar aqui é o que devolve o bicho pro
   combate sozinho — o próprio `habilidade`/checagem de medo em updateMobs já olha
   a vida a cada tique e para de fugir na hora em que ela passa do limiar de novo.
   Sem isso, um bicho encurralado (sem pra onde fugir, mas ainda perto demais pra
   `chase` cair) ficava preso fugindo pra sempre, incapaz de curar e de escapar.
   Monstro aqui não tem mana, então não há o que regenerar do outro lado. */
function regenMobs() {
  for (const m of G.mobs) {
    if (m.hp <= 0 || m.hp >= m.maxhp) continue;
    const fugindo = m.chase && m.def.medo && m.hp < m.def.medo * m.maxhp;
    if (m.chase && !fugindo) continue;
    m.hp = Math.min(m.maxhp, m.hp + Math.max(1, Math.round(m.maxhp * .02)));
  }
}
/* Habilidade da criatura. Uma por espécie, definida na tabela — aqui só mora o
   que cada tipo FAZ. Sempre com aviso na cabeça antes do efeito: o jogador tem de
   poder sair do raio, senão não é dificuldade, é imposto.
   O raio é medido do bicho, não do jogador, e a linha tem de estar limpa: sopro de
   dragão não dobra esquina. */
function habilidade(m, d) {
  const h = m.def.hab;
  if (G.now < (m.habT || 0)) return;
  if (h.tipo !== 'cura' && (d > h.r || !lineClear(m.x, m.y, P.x, P.y, m.z))) return;
  if (h.tipo === 'cura' && m.hp > m.maxhp * .6) return;      // só se cura quando dói
  m.habT = G.now + h.cd;
  if (h.grito) say(m, h.grito);
  fxBurst(m.x, m.y, h.col, (h.r || 1) * .9);
  if (h.tipo === 'cura') {
    const v = Math.min(h.val, m.maxhp - m.hp);
    m.hp += v; float(m.x, m.y, '+' + v, '#6ee36e');
    log(`${m.n} se cura em ${v}.`, 'cbt morte');
    renderBattle();
    return;
  }
  if (h.dano) hitPlayer(ri(h.dano[0], h.dano[1]), m.n, h.el);
  if (h.lento) {
    P.buffs.lento = { val: h.lento, end: G.now + h.dur };
    recalc();
    log(`${m.n} te atinge: ${Math.round(h.lento * 100)}% mais lento por ${Math.round(h.dur / 1000)}s.`, 'cbt apanha');
  }
}

const DIAG_PAUSA = .4;          // fração do passo que a diagonal espera a mais
function tryStep(e, nx, ny) {
  if (!isWalkable(nx, ny, e.z) || occupied(nx, ny, e.z, e)) return false;
  // funil único de passo: barrar aqui cobre perseguição, fuga e vagar de uma vez
  if (e !== P && noTemplo(nx, ny, e.z)) return false;
  const diag = nx !== e.x && ny !== e.y;
  const spd = e === P ? P.st.speed : e.def.spd;
  e.fx = e.px; e.fy = e.py; e.x = nx; e.y = ny;
  e.stepT = G.now; e.stepD = (100000 / spd) * (diag ? 1.5 : 1);
  /* A diagonal já anda mais devagar (o 1,5 acima), e ainda paga uma pausa depois
     de chegar: `stepD` é a animação, `nextStep` é quando pode andar de novo, e
     separar os dois é o que dá o "peso" de cortar caminho na diagonal em vez de
     ela ser sempre o melhor negócio. Vale para todo mundo, bicho inclusive. */
  e.nextStep = G.now + e.stepD * (diag ? 1 + DIAG_PAUSA : 1);
  // todo mundo que anda passa por aqui, então o passo de monstro sai de graça —
  // e com posição, que é o que faz ouvir de onde vem. Outro andar não se ouve.
  if (e.z === P.z) passo(nx, ny, e.z);
  return true;
}
function lerpEntity(e) {
  if (e.stepD) {
    const k = clamp((G.now - e.stepT) / e.stepD, 0, 1);
    e.px = e.fx + (e.x - e.fx) * k; e.py = e.fy + (e.y - e.fy) * k;
    if (k >= 1) e.stepD = 0;
  } else { e.px = e.x; e.py = e.y; }
}
const atkPhase = e => { const k = (G.now - (e.atkT || -9e9)) / 320; return k > 0 && k < 1 ? k : 0; };

/* ---------------------------------------------------------------- combate */
function damageFormula(atk, skill) {
  const max = 0.09 * atk * (skill + 4) + P.level / 5;
  const mult = STANCE[P.stance || 'bal'].dmg * (1 + (P.buffs.rage ? P.buffs.rage.val / 100 : 0));
  return rnd(P.level / 5, max) * mult;
}
function dealDamage(m, raw, el, color) {
  if (m.hp <= 0) return;
  if (P.charms && P.charms[m.id]) raw *= 1 + CHARM_BONUS;   // presa marcada no bestiário
  /* Resistência elemental. Imune sai antes de tudo: sem isto o `Math.max(1, ...)`
     transformaria zero em 1 de dano por golpe, que é o pior dos dois mundos —
     não mata e ainda esconde do jogador que o elemento está errado. */
  const rm = resistOf(m.def, el);
  if (rm === 0) {
    impacto(m.x, m.y, 'erro');
    float(m.x, m.y, 'imune', '#9aa0a8');
    sfx('block', m.x, m.y);
    log(`${m.n} é imune a ${ELEM[el || 'physical'].n}.`, 'cbt mana');
    return;
  }
  let dmg = Math.max(1, Math.round(raw * rm - rnd(m.def.arm / 2, m.def.arm)));
  const crit = Math.random() < P.st.crit;
  if (crit) dmg = Math.round(dmg * 2);
  sfx(crit ? 'crit' : 'hit', m.x, m.y);
  // o carimbo do clarão: o render pinta a silhueta branca por cima por ~90ms
  m.hitT = G.now;
  if (crit) { congelar(70); abalo(5); } else abalo(1.6);
  // `el` diz de que é o golpe: físico espirra o sangue da espécie, elemento
  // solta a partícula da própria tabela — cor, forma e queda saem todas dali
  impacto(m.x, m.y, el ? 'magico' : 'fisico', el ? (color || 0x8ad4ff) : (m.def.sangue || SANGUE_PADRAO).cor, el);
  m.hp -= dmg;
  /* A seta é a única coisa que ensina o sistema. Resistência sem marca visível
     não é mecânica, é dano que varia sozinho — o jogador nunca descobre que
     trocar de magia resolve. */
  const marca = rm > 1.05 ? '▲' : rm < .95 ? '▼' : '';
  /* golpe sem `el` é físico — e `resistOf` já lê a linha 'physical'. Sem este
     fallback, bater num Gigante (resiste a físico) estourava em ELEM[undefined]
     e o resto do golpe não rodava: o bicho ficava com hp<=0 sem morrer, some da
     tela e nunca larga o loot. */
  const nomeEl = ELEM[el || 'physical'].n;
  log(`${crit ? 'CRÍTICO! ' : ''}Você causa ${dmg} de dano em ${m.n}${marca ? (rm > 1 ? ' (fraco a ' : ' (resiste a ') + nomeEl + ')' : ''}${m.hp > 0 ? ` (${Math.max(0, m.hp)}/${m.maxhp})` : ''}.`, 'cbt dano');
  float(m.x, m.y, (crit ? '★' : '') + marca + dmg, color || '#ff6a6a');
  fxBurst(m.x, m.y, color || 0xff5555, 0.7, el);
  if (P.st.lifesteal) curar(dmg * P.st.lifesteal, 'roubo de vida');
  if (m.hp <= 0) killMob(m);
  renderBattle();
}
function killMob(m) {
  // a morte é o golpe que mais merece ênfase: pausa maior e tremor pelo tamanho
  congelar(95); abalo(4 + m.def.sz * 3, 300);
  const xp = Math.round(m.def.exp * XP_MULT);
  addExp(xp); P.kills++;
  float(m.x, m.y, '+' + xp + ' exp', '#ffd166');
  bestiaryKill(m.id);
  log(`Você matou ${m.n} (+${xp} exp).`, 'good');
  if (m.def.boss) notify('👑', m.def.n, `chefe abatido — +${xp} exp`);
  sfx('die', m.x, m.y);
  bloodSpray(m.x, m.y, m.z, m.def.sangue, .7 + m.def.sz * .6);   // bicho maior, poça maior
  // cada linha da tabela rola sozinha: pode não cair nada, cair um item ou a lista toda
  const items = [];
  for (const [id, ch, mn, mx] of m.def.loot) {
    if (Math.random() > ch) continue;
    const stack = ITEMS[id].stack;
    const maestria = bestStage(m.id) === 3 ? 0.6 : 0;   // conhecer a criatura melhora o saque
    items.push(mkItem(id, stack ? 0 : rollRarity(m.def.tier * 0.35 + maestria), stack && mn ? ri(mn, mx || mn) : 1));
  }
  /* O que caiu vai para o chat antes de o corpo abrir: quem caça em série não
     precisa abrir cada saco para saber se valeu. Classe 'loot', não 'cbt': mora
     na aba Saque, não na de Combate. */
  log(items.length ? `${m.n} larga: ${items.map(descLoot).join(', ')}.` : `${m.n} não larga nada.`, 'loot', !!items.length);
  spawnCorpse(m.x, m.y, m.z, m.n, items, { shape: m.def.shape, color: m.def.col, size: m.def.sz, o: m.def.o, sheet: m.def.sheet });
  removeMob(m, true);
}
/* Empilhável mostra a quantidade; peça única mostra o nome já com os afixos. A cor
   é a da raridade, a MESMA da mochila e do brilho no chão — assim o azul no chat
   quer dizer a mesma coisa que o azul no inventário, e dá para ver que caiu algo
   bom sem parar de bater. */
const descLoot = it => {
  const s = itemStats(it), nome = it.count > 1 ? `${it.count} ${s.name}` : s.name;
  return `<b style="color:${RARITY[it.r || 0].color};font-weight:400">${nome}</b>`;
};
function playerAttack() {
  if (G.dead) return;   // morto não bate: sem isso dava pra matar e ganhar exp na tela de morte
  // silencioso de propósito: roda todo quadro, e avisar aqui entupiria o chat.
  // Quem explica é o ícone da zona segura na barra de status e o aviso do clique.
  if (emZonaSegura()) return;
  const m = G.target;
  if (!m || m.hp <= 0 || m.z !== P.z) { G.target = null; return; }
  const w = weaponInfo(), d = distT(P.x, P.y, m.x, m.y);
  if (d > w.range || (w.range > 1 && !lineClear(P.x, P.y, m.x, m.y, P.z))) return;
  if (G.now < P.nextAtk) return;
  P.nextAtk = G.now + 2000; P.atkT = G.now;
  P.dir = Math.atan2(m.x - P.x, m.y - P.y);
  P.lastDir = [Math.sign(m.x - P.x), Math.sign(m.y - P.y)];
  if (w.wt === 'wand') {
    sfx('atk_wand', P.x, P.y);
    const base = rnd(w.dmg[0], w.dmg[1]) * (1 + skillOf('magic') * 0.035);
    shoot(P.px, P.py, m.px, m.py, w.col, () => dealDamage(m, base, w.el, '#c08bff'), 22, w.el);
    addMagic(6);   // no Tibia varinha não treina ML; aqui treina, senão mago que só ataca não evolui em nada
  } else if (w.wt === 'distance') {
    sfx('atk_distance', P.x, P.y);
    const dmg = damageFormula(w.atk, skillOf('distance'));
    shoot(P.px, P.py, m.px, m.py, w.col, () => dealDamage(m, dmg, null, '#ffd280'), 22, 'physical');
    addSkillTry('distance');
  } else {
    // o golpe de perto ganha o som da arma: espada, machado e clava não soam igual
    sfx('atk_' + (w.wt || 'fist'), P.x, P.y);
    dealDamage(m, damageFormula(w.atk, skillOf(w.wt)), null, '#ff7a7a');
    addSkillTry(w.wt);
  }
}
/* `el` sozinho responde as duas perguntas que antes vinham em campos separados:
   se o golpe é mágico (tem elemento, e não é o físico) e de que cor ele é (a
   tabela). Dois campos que precisavam concordar eram dois campos que podiam
   discordar. Sem elemento = pancada física, que é o caso da garra e da mordida. */
function hitPlayer(raw, src, el) {
  if (G.dead) return;
  const mag = !!el && el !== 'physical';
  let dmg = raw;
  const guarda = STANCE[P.stance || 'bal'].def * (1 + (P.buffs.guard ? P.buffs.guard.val / 100 : 0));
  if (P.st.shieldDef && Math.random() < Math.min(0.8, P.st.shieldDef * (skillOf('shielding') + 4) / 900 * guarda)) {
    addSkillTry('shielding', 2);
    /* Golpe que não passa vira FUMAÇA, não texto. Eram três "BLOQ" e um "0"
       empilhados sobre a cabeça, tapando o próprio boneco — e a informação de
       quem bloqueou o quê já está escrita no log de combate, com hora e nome. */
    impacto(P.x, P.y, 'erro');
    sfx('block', P.x, P.y);
    log(`Você bloqueia o ataque de ${src}.`, 'cbt mana');
    return;
  }
  addSkillTry('shielding');
  dmg = Math.max(0, Math.round(dmg - rnd(P.st.arm / 2, P.st.arm) * (0.6 + guarda * 0.4)));
  /* Resistência do jogador, depois da armadura: a armadura para o golpe, a
     resistência para o ELEMENTO do golpe, e as duas se somam em vez de brigar.
     Teto de 75% — sem ele, empilhar afixo do mesmo elemento vira imunidade, e
     imunidade no jogador apaga o monstro que usa aquele elemento. */
  const resEl = Math.min(.75, P.st.res[el || 'physical'] || 0);
  if (resEl) dmg = Math.round(dmg * (1 - resEl));
  if (dmg <= 0) { impacto(P.x, P.y, 'erro'); log(`Sua armadura absorve o golpe de ${src}.`, 'cbt mana'); return; }
  if (P.buffs.mshield) {
    const absorbed = Math.min(P.mana, dmg);
    P.mana -= absorbed; dmg -= absorbed;
    float(P.x, P.y, '-' + absorbed, '#5aa9ff');
    log(`Escudo mágico absorve ${absorbed} de ${src}.`, 'cbt mana');
    if (P.mana <= 0) { delete P.buffs.mshield; log('Seu escudo mágico acabou.', 'bad'); }
    if (dmg <= 0) { renderBars(); return; }
  }
  P.hp -= dmg;
  // apanhar merece a mesma leitura que bater: clarão no boneco e um tranco leve
  P.hitT = G.now; abalo(2);
  float(P.x, P.y, (resEl ? '▼' : '') + '-' + dmg, '#ff5555');
  impacto(P.x, P.y, mag ? 'magico' : 'fisico', SANGUE_PADRAO.cor, mag ? el : null);
  log(`${src} causa ${dmg} de dano em você (${Math.max(0, P.hp)}/${P.st.maxhp}).`, 'cbt apanha');
  sfx('hurt', P.x, P.y);
  renderBars();
  if (P.hp <= 0) playerDeath(src);
}
function playerDeath(src) {
  G.dead = true; P.hp = 0;
  // perde 10% da exp, mas nunca cai de nível — morrer já dói o bastante
  P.exp = Math.max(expForLevel(P.level), Math.round(P.exp * 0.9));
  recalc();
  log(`Você foi morto por ${src}.`, 'bad');
  sfx('death');
  $('#death-screen').style.display = 'flex';
  $('#death-src').textContent = src;
}
function respawn() {
  G.dead = false;
  P.x = P.px = WORLD.temple.x; P.y = P.py = WORLD.temple.y + 2; P.z = SURF;
  P.hp = P.st.maxhp; P.mana = P.st.maxmana; P.buffs = {}; G.target = null; G.path = [];
  refreshSpawns(true);
  $('#death-screen').style.display = 'none';
  recalc(); renderAll();
}

/* ---------------------------------------------------------------- magias */
function knownSpells() {
  return SPELLS.filter(s => s.voc.includes(P.voc) && P.level >= s.lvl);
}
function castSpell(sp) {
  if (G.dead) return;
  // lista o que é PACÍFICO, não o que é ofensivo: tipo novo nasce bloqueado
  if (!SPELL_PACIFICA[sp.type] && emZonaSegura()) return log(AVISO_SEGURA, 'bad');
  if (!sp.voc.includes(P.voc)) return log('Sua vocação não conhece essa magia.', 'bad');
  if (P.level < sp.lvl) return log(`Precisa de nível ${sp.lvl}.`, 'bad');
  if (G.now < (P.cd[sp.id] || 0) || G.now < (P.cd.gcd || 0)) return;
  if (P.mana < sp.mana) return log('Mana insuficiente.', 'bad');
  if (sp.type === 'attack' || sp.type === 'melee') {
    const m = G.target, alc = sp.type === 'melee' ? weaponInfo().range : 6;
    if (!m || m.hp <= 0 || m.z !== P.z || distT(P.x, P.y, m.x, m.y) > alc) return log('Sem alvo válido.', 'bad');
  }
  if (sp.type === 'conjure' && P.bag.length >= BAG_SLOTS) return log('Mochila cheia.', 'bad');
  P.mana -= sp.mana; P.cd[sp.id] = G.now + sp.cd; P.cd.gcd = G.now + 900;
  say(P, sp.w);
  addMagic(sp.mana);
  // magia soa no lugar de quem conjura; o nome carrega o elemento, então dá para
  // ter gelo diferente de fogo sem tocar em nenhuma tabela de magia
  sfx(sp.type === 'heal' ? 'heal' : sp.type === 'buff' ? 'buff' : 'spell_' + (sp.el || 'energy'), P.x, P.y);
  const ml = skillOf('magic');
  const power = (v) => v * (1 + ml * 0.11) + P.level * 0.25;

  if (sp.type === 'heal') {
    curar(power(sp.base) * rnd(0.9, 1.1), sp.n); fxBurst(P.x, P.y, 0x55dd55, 1.2);
  } else if (sp.type === 'buff') {
    P.buffs[sp.buff] = { val: sp.val || 0, end: G.now + sp.dur };
    if (sp.buff === 'haste') delete P.buffs.lento;   // magia de velocidade cura a lentidão na hora
    fxBurst(P.x, P.y, sp.buff === 'haste' ? 0x88ffcc : 0x88aaff, 1.2);
    log(`${sp.n} ativada.`);
    recalc();
  } else if (sp.type === 'attack') {
    const m = G.target;
    shoot(P.px, P.py, m.px, m.py, sp.col, () => dealDamage(m, power(sp.base) * rnd(0.85, 1.15), sp.el, '#' + sp.col.toString(16).padStart(6, '0')), 22, sp.el);
  } else if (sp.type === 'melee') {
    const m = G.target, w = weaponInfo();
    const base = w.wt === 'wand' ? rnd(w.dmg[0], w.dmg[1]) : damageFormula(w.atk, skillOf(w.wt));
    dealDamage(m, base * sp.mult, null, '#ffcc66');
    if (w.wt !== 'wand') addSkillTry(w.wt);
    fxBurst(m.x, m.y, sp.col, 1);
  } else if (sp.type === 'taunt') {
    const alvos = G.mobs.filter(m => m.z === P.z && distT(m.x, m.y, P.x, P.y) <= sp.r);
    alvos.forEach(m => { m.taunt = G.now + 9000; m.chase = true; fxBurst(m.x, m.y, sp.col, 0.8); });
    log(alvos.length ? `Você provocou ${alvos.length} monstro(s).` : 'Ninguém te ouviu.');
  } else if (sp.type === 'conjure') {
    const it = mkItem(sp.item);
    bagAdd(it);
    log(`Você conjurou ${ITEMS[sp.item].n} (${it.ch} cargas).`, 'good');
    fxBurst(P.x, P.y, 0x9f7aff, 1.1);
  } else {
    const tiles = spellTiles(sp);
    tiles.forEach(([x, y], i) => setTimeout(() => fxBurst(x, y, sp.col, 0.9, sp.el), i * 12));
    const hit = G.mobs.filter(m => m.z === P.z && tiles.some(([x, y]) => x === m.x && y === m.y));
    for (const m of hit) {
      if (sp.type === 'melee_aoe') {
        const w = weaponInfo();
        const base = w.wt === 'wand' ? rnd(w.dmg[0], w.dmg[1]) : damageFormula(w.atk, skillOf(w.wt));
        dealDamage(m, base * sp.mult, null, '#ffcc66');
        if (w.wt !== 'wand') addSkillTry(w.wt);
      } else dealDamage(m, power(sp.base) * rnd(0.85, 1.15), sp.el, '#' + sp.col.toString(16).padStart(6, '0'));
    }
    if (!hit.length) log(`${sp.n} não acertou ninguém.`);
  }
  renderBars(); renderHotbar();
}
function spellTiles(sp) {
  const out = [], r = sp.r || 1;
  if (sp.type === 'aoe' || sp.type === 'melee_aoe') {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++)
      if (dx || dy) out.push([P.x + dx, P.y + dy]);
    return out;
  }
  // direção: alvo atual, senão último passo
  let dx = 0, dy = 1;
  if (G.target) { dx = Math.sign(G.target.x - P.x); dy = Math.sign(G.target.y - P.y); }
  else if (P.lastDir) { dx = P.lastDir[0]; dy = P.lastDir[1]; }
  if (!dx && !dy) dy = 1;
  if (sp.type === 'beam') {
    for (let i = 1; i <= 6; i++) out.push([P.x + dx * i, P.y + dy * i]);
  } else { // wave: cone de 3 de largura
    for (let i = 1; i <= 5; i++) {
      const w = i <= 2 ? 1 : 2;
      for (let s = -w; s <= w; s++) out.push([P.x + dx * i - dy * s, P.y + dy * i + dx * s]);
    }
  }
  return out.filter(([x, y]) => inBounds(x, y));
}

/* ------------------------------------------------------------ corpos/loot */
/* o cadáver é o próprio boneco tombado — muito melhor que a caixinha vermelha.
   Fica onde a criatura morreu, sem desviar pra um tile livre vizinho: matar
   várias no mesmo lugar empilha corpo em cima de corpo, do jeito que devia.
   `corpseAt` (mais abaixo) é quem garante que o saque acha o de baixo — antes
   dela existir, empilhar escondia loot, e daí o desvio pra tile vizinho fazia
   sentido; agora ele só espalhava os corpos sem necessidade. */
function spawnCorpse(x, y, z, name, items, spr) {
  G.corpses.push({ x, y, z, name, items, spr, t: G.now });
}
function spawnDrop(x, y, z, it) {
  G.drops.push({ x, y, z, it });
}
function openLoot(c) {
  G.lootOpen = c;
  const win = $('#loot-win'); win.style.display = 'flex';
  $('#loot-title').textContent = 'Corpo de ' + c.name;
  renderLoot();
}
function renderLoot() {
  const c = G.lootOpen; if (!c) return;
  const box = $('#loot-items'); box.innerHTML = '';
  if (!c.items.length) box.innerHTML = '<div class="empty">vazio</div>';
  c.items.forEach(it => box.appendChild(itemCell(it, () => {
    if (bagAdd(it)) {
      c.items.splice(c.items.indexOf(it), 1);
      const s = itemStats(it);
      log(`Você pegou ${it.id === 'gold' ? it.count + ' moedas de ouro' : s.name}.`, 'loot');
      sfx('loot');
      renderLoot();
    }
  })));
}
function lootAll() {
  const c = G.lootOpen; if (!c) return;
  [...c.items].forEach(it => { if (bagAdd(it)) c.items.splice(c.items.indexOf(it), 1); });
  renderLoot();
}

/* --------------------------------------------------------------- spawns */
function refreshSpawns(force) {
  for (const sp of WORLD.spawns) {
    if (sp.z !== P.z) { if (sp.live) removeMob(sp.live, false); continue; }
    const d = distT(sp.x, sp.y, P.x, P.y);
    if (sp.live) { if (d > 55) removeMob(sp.live, false); continue; }
    if (sp.dead > Date.now()) continue;
    if (d < 42 && d > 6 && !occupied(sp.x, sp.y, sp.z, null)) spawnMob(sp);
  }
}

/* ------------------------------------------------------------------- UI */
/* `html` só é usado pela linha de saque, que precisa colorir item por item pela
   raridade. O texto vem todo das nossas tabelas (nome de item, de afixo, de
   monstro) — nada que o jogador digite passa por aqui. */
function log(msg, cls, html) {
  const d = document.createElement('div');
  if (cls) d.className = cls;
  if (html) d.innerHTML = msg; else d.textContent = msg;
  /* Só acompanha o fim se o jogador JÁ estava no fim. Quem rolou para cima para
     reler alguma coisa fica onde parou; volta a acompanhar sozinho quando ele
     rolar até embaixo de novo. A medida tem de ser antes do appendChild, senão a
     linha nova já mudou o scrollHeight e nunca se está "no fim". */
  const box = $('#log');
  const noFim = box.scrollHeight - box.scrollTop - box.clientHeight < 8;
  box.appendChild(d);
  while (box.children.length > 120) box.removeChild(box.firstChild);
  if (noFim) box.scrollTop = box.scrollHeight;
}
function setStance(v) { P.stance = v; renderStance(); renderBars(); log(`Postura: ${STANCE[v].n} — ${STANCE[v].hint}.`); }
function renderStance() {
  document.querySelectorAll('#stance button').forEach(b => b.classList.toggle('on', b.dataset.s === P.stance));
  const f = $('#follow-btn');
  f.classList.toggle('on', !!P.follow);
  // só o ícone: o rótulo saiu quando o botão entrou na fileira da postura, e
  // quem responde "perseguir ou parado?" é o desenho mais o title abaixo
  f.innerHTML = `<img class="im" src="assets/icons/${P.follow ? 'ui_follow' : 'ui_stand'}.png" alt="${P.follow ? 'Perseguir' : 'Parado'}">`;
  f.title = P.follow ? 'seguindo o alvo — clique para ficar parado' : 'parado — clique para perseguir o alvo';
}
/* notificação de marco no meio da tela: nível, skill, bestiário, área nova */
function notify(ico, titulo, sub) {
  const box = $('#toast');
  const d = document.createElement('div');
  d.className = 'toast';
  d.innerHTML = `<em>${ico}</em><div><b>${titulo}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
  box.appendChild(d);
  setTimeout(() => d.remove(), 3200);
  while (box.children.length > 4) box.firstChild.remove();
}
/* atk/armadura/defesa/veloc./postura: usado pela aba Habilidades (monta os chips)
   e pelo renderBars (mantém os números vivos a cada golpe, sem remontar a aba toda) */
function renderCombatStats() {
  const atkEl = $('#stat-atk'); if (!atkEl) return;
  const w = weaponInfo();
  atkEl.textContent = w.wt === 'wand' ? `${w.dmg[0]}-${w.dmg[1]}` : Math.round(0.09 * w.atk * (skillOf(w.wt === 'fist' ? 'fist' : w.wt) + 4) + P.level / 5);
  $('#stat-arm').textContent = P.st.arm;
  $('#stat-def').textContent = P.st.shieldDef;
  $('#stat-spd').textContent = P.st.speed;
  renderResChips();
}
/* Resistência é a única linha variável do quadro: entra um chip por elemento que
   você realmente resiste e some quando a peça sai. Sem isto o afixo mostrava o
   bônus na ficha do item e desaparecia — não havia onde conferir o total, que é
   o número que decide se vale entrar na caverna de dragão.
   O `chave` evita remontar os nós a cada golpe: renderBars chama isto sempre, e
   a resistência só muda quando o equipamento muda. */
let resChave = null;
/* Cor do texto pela luminância do fundo: as cores de elemento foram escolhidas
   para brilhar sobre terreno escuro, então quase todas pedem texto preto — mas
   `death` é roxo médio e sumiria. Um `if` resolve os sete casos. */
const _corTexto = hex => (0.3 * (hex >> 16 & 255) + 0.59 * (hex >> 8 & 255) + 0.11 * (hex & 255)) > 130
  ? '#1a1410' : '#fff';
function renderResChips() {
  const box = $('#res-strip'); if (!box) return;
  const els = Object.keys(P.st.res).filter(k => P.st.res[k] > 0 && ELEM[k]).sort();
  const chave = els.map(k => k + P.st.res[k]).join();
  if (chave === resChave) return;
  resChave = chave;
  box.innerHTML = '';
  for (const k of els) {
    const pct = Math.round(Math.min(.75, P.st.res[k]) * 100);
    const b = document.createElement('b');
    b.style.background = cssCol(ELEM[k].cor);
    b.style.color = _corTexto(ELEM[k].cor);
    b.textContent = String(pct);
    const nome = 'Resistência a ' + ELEM[k].n;
    const desc = `Corta ${pct}% do dano de ${ELEM[k].n} que chega em você. Vem dos afixos e dos conjuntos que está vestindo. O teto é 75%, mesmo somando peças.`;
    // o quadro fixo ganha o tooltip uma vez na inicialização; estes nascem depois
    b.onmouseenter = e => tipEm(e, `<b>${nome}</b><div class="dim">${desc}</div>`);
    b.onmouseleave = hideTip;
    b.title = nome;
    box.appendChild(b);
  }
}
function renderBars() {
  const need = expForLevel(P.level + 1), prev = expForLevel(P.level);
  $('#hp-fill').style.width = clamp(P.hp / P.st.maxhp * 100, 0, 100) + '%';
  $('#mp-fill').style.width = clamp(P.mana / P.st.maxmana * 100, 0, 100) + '%';
  $('#xp-fill').style.width = clamp((P.exp - prev) / (need - prev) * 100, 0, 100) + '%';
  $('#hp-text').textContent = `${Math.max(0, Math.round(P.hp))} / ${P.st.maxhp}`;
  $('#mp-text').textContent = `${Math.round(P.mana)} / ${P.st.maxmana}`;
  $('#xp-text').textContent = `Nv ${P.level} · ${(need - P.exp).toLocaleString('pt-BR')} exp p/ subir`;
  $('#gold-val').textContent = P.gold.toLocaleString('pt-BR');
  renderCombatStats();
  tickStatus();
}
/* Barra de status: tudo que está agindo em você agora, mágico ou não. A zona
   segura entra aqui junto dos buffs porque, para quem joga, é a mesma pergunta
   — "o que está pegando comigo neste momento?". */
function statusAtivos() {
  const out = [];
  if (noTemplo(P.x, P.y, P.z))
    out.push({ k: 'safe', ico: '⛪', n: 'Zona Segura', desc: 'Criatura nenhuma entra ou ataca aqui', seg: null });
  for (const k in P.buffs) {
    const b = P.buffs[k];
    out.push({
      k, ico: BUFF_ICO[k] || '✨', n: BUFF_LABEL[k] || k,
      desc: (BUFF_DESC[k] || (() => ''))(b.val),
      // escudo mágico não conta tempo: acaba quando a mana acaba
      seg: k === 'mshield' ? null : Math.max(0, Math.ceil((b.end - G.now) / 1000)),
      ruim: !!BUFF_RUIM[k]
    });
  }
  return out;
}
const statusSig = l => l.map(s => s.k).join(',');
function renderStatus(lista) {
  const box = $('#status-icons'); if (!box) return;
  lista = lista || statusAtivos();
  box.innerHTML = '';
  for (const s of lista) {
    const d = document.createElement('div');
    d.className = 'stico ' + (s.ruim ? 'ruim' : 'bom');
    d.innerHTML = s.ico + (s.seg != null ? `<b>${s.seg}s</b>` : '');
    // o texto é uma função para o balão aberto continuar contando junto
    d._tip = () => `<b>${s.n}</b>${s.desc ? `<div>${s.desc}</div>` : ''}` +
      (s.seg != null
        ? `<div class="dim tiny">Termina em ${Math.max(0, Math.ceil((P.buffs[s.k].end - G.now) / 1000))}s</div>`
        : `<div class="dim tiny">${s.k === 'safe' ? 'Enquanto você ficar no templo' : 'Dura enquanto houver mana'}</div>`);
    d.onmouseenter = e => tipEm(e, d._tip());
    d.onmouseleave = hideTip;
    box.appendChild(d);
  }
  box.dataset.sig = statusSig(lista);
}
/* mesmo princípio do tickHotbar: remontar 60x por segundo é desperdício, então
   só o contador anda — a lista inteira só volta quando entra ou sai um efeito */
function tickStatus() {
  // o mundo pode não existir ainda: equipar o kit inicial chama renderBars antes
  // de haver mapa, e a zona segura precisa consultar o tile
  const box = $('#status-icons'); if (!box || !P || !WORLD.floors.length) return;
  const lista = statusAtivos();
  if (box.dataset.sig !== statusSig(lista)) return renderStatus(lista);
  lista.forEach((s, i) => {
    const el = box.children[i], b = el && el.querySelector('b');
    if (b && s.seg != null && b.textContent !== s.seg + 's') b.textContent = s.seg + 's';
  });
  if (tipDono && tipDono._tip) $('#tooltip').innerHTML = tipDono._tip();
}
function itemCell(it, onClick, extra) {
  const s = itemStats(it);
  const d = document.createElement('div');
  d.className = 'cell';
  d.style.borderColor = s.color + '88';
  d.innerHTML = `<span class="ico">${s.ico}</span>` + (it.ch ? `<span class="cnt">${it.ch}</span>` : it.count > 1 ? `<span class="cnt">${it.count}</span>` : '') + (extra || '');
  d.onmouseenter = e => showTip(e, it);
  d.onmouseleave = hideTip;
  d.onclick = onClick;
  d.oncontextmenu = e => { e.preventDefault(); if (P.bag.includes(it)) { dropItem(it); hideTip(); } };
  return d;
}
const SLOT_LABEL = { helmet: 'Elmo', amulet: 'Amuleto', armor: 'Armadura', weapon: 'Arma', shield: 'Escudo', legs: 'Pernas', boots: 'Botas', ring: 'Anel', light: 'Luz' };
/* Paperdoll clássico: corpo no centro e acessórios deslocados meio slot para baixo.
   `light` fecha a coluna da direita embaixo do escudo, no mesmo passo de 61px das
   outras — é a mão que não segura arma, que é onde tocha e acessório de apoio
   pertencem. */
const SLOT_POS = {
  helmet: [61, 0], armor: [61, 61], legs: [61, 122], boots: [61, 183],
  amulet: [0, 25], weapon: [0, 86], ring: [0, 147], shield: [122, 86], light: [122, 147]
};
function renderInv() {
  const eq = $('#eq-slots'); eq.innerHTML = '';
  for (const slot in SLOT_POS) {
    const it = P.eq[slot];
    let d;
    if (it) { d = itemCell(it, () => unequip(slot)); d.classList.add('eq'); }
    else {
      d = document.createElement('div');
      d.className = 'cell eq empty'; d.innerHTML = `<span class="lbl">${SLOT_LABEL[slot]}</span>`;
    }
    d.style.left = SLOT_POS[slot][0] + 'px'; d.style.top = SLOT_POS[slot][1] + 'px';
    eq.appendChild(d);
  }
  const bag = $('#bag'); bag.innerHTML = '';
  P.bag.forEach(it => bag.appendChild(itemCell(it, () => useItem(it))));
  for (let i = P.bag.length; i < BAG_SLOTS; i++) { const d = document.createElement('div'); d.className = 'cell empty'; bag.appendChild(d); }
  $('#gold-val').textContent = P.gold.toLocaleString('pt-BR');
}
function renderSkills() {
  const box = $('#tab-skills'); box.innerHTML = '';
  const rows = [...Object.keys(P.sk), 'magic'];
  for (const k of rows) {
    const isM = k === 'magic';
    const lvl = isM ? P.ml.l : P.sk[k].l, cur = isM ? P.ml.t : P.sk[k].t;
    const need = isM ? manaForML(P.ml.l, P.voc) : triesFor(k, P.sk[k].l, P.voc);
    const bonus = P.st.sk[k] || 0;
    const d = document.createElement('div'); d.className = 'skill';
    d.innerHTML = `<div class="srow"><span>${SKILL_NAMES[k]}
      <small>${Math.round(cur)}/${need}${isM ? ' mana' : ''}</small></span>
      <b>${lvl}${bonus ? `<i class="bon">+${bonus}</i>` : ''}</b></div>
      <div class="sbar"><i style="width:${clamp(cur / need * 100, 0, 100)}%"></i></div>`;
    box.appendChild(d);
  }
}
function renderSpells() {
  const box = $('#tab-spells'); box.innerHTML = '';
  for (const sp of SPELLS.filter(s => s.voc.includes(P.voc))) {
    const ok = P.level >= sp.lvl;
    const d = document.createElement('div');
    d.className = 'spell' + (ok ? '' : ' locked');
    d.innerHTML = `<span class="ico">${sp.ico}</span>
      <span class="sp-n">${sp.n}<i>${sp.w}</i></span>
      <span class="sp-c">${sp.mana}<small>mana</small><br><small>nv ${sp.lvl}</small></span>`;
    if (ok) d.onclick = () => castSpell(sp);
    box.appendChild(d);
  }
}
/* barra de habilidades: slots livres, magia OU item (poção, runa). 20 pra
   render em fileira única e esticar de ponta a ponta do elemento (flex-grow
   no CSS), não só os 12 originais que sobravam espaço vazio na barra.
   Tecla padrão F1–F12 nos 12 primeiros; do 13 em diante nasce sem tecla
   ("?") — clique no rótulo do canto e aperte a tecla nova; Esc cancela. */
const HOT_SLOTS = 20;
const HOT_KEYS_DEFAULT = Array.from({ length: HOT_SLOTS }, (_, i) => i < 12 ? 'f' + (i + 1) : null);
const hotKeyLabel = k => k ? k.toUpperCase() : '?';
function hotDefault() {
  const bar = new Array(HOT_SLOTS).fill(null);
  knownSpells().slice(0, 8).forEach((sp, i) => bar[i] = { k: 'spell', id: sp.id });
  bar[HOT_SLOTS - 2] = { k: 'item', id: 'health_potion' };
  bar[HOT_SLOTS - 1] = { k: 'item', id: 'mana_potion' };
  return bar;
}
function hotEntry(slot) {
  if (!slot) return null;
  if (slot.k === 'spell') { const sp = SPELLS.find(x => x.id === slot.id); return sp && { ico: sp.ico, n: sp.n, sp }; }
  const b = ITEMS[slot.id];
  return b && { ico: b.ico, n: b.n, itemId: slot.id };
}
function hotUse(i) {
  const e = hotEntry(P.hotbar && P.hotbar[i]);
  if (!e) return;
  if (e.sp) return castSpell(e.sp);
  const it = P.bag.find(b => b.id === e.itemId);
  if (!it) { log(`Você não tem ${e.n}.`, 'bad'); sfx('error'); return; }
  useItem(it);
}
/* dono único por tecla: rebindar tira de quem já usava, senão a tecla ficaria
   presa no primeiro slot (indexOf sempre acha o mesmo) e o segundo nunca dispararia */
function setHotkey(i, key) {
  const dup = P.hotkeys.indexOf(key);
  if (dup >= 0 && dup !== i) P.hotkeys[dup] = null;
  P.hotkeys[i] = key;
}
function renderHotbar() {
  const bar = $('#hotbar');
  if (!P.hotbar || P.hotbar.length !== HOT_SLOTS) P.hotbar = hotDefault();
  if (!P.hotkeys || P.hotkeys.length !== HOT_SLOTS) P.hotkeys = HOT_KEYS_DEFAULT.slice();
  bar.innerHTML = '';
  for (let i = 0; i < HOT_SLOTS; i++) {
    const e = hotEntry(P.hotbar[i]);
    const d = document.createElement('div');
    d.className = 'hk' + (e ? '' : ' vazio');
    d.innerHTML = `<b>${hotKeyLabel(P.hotkeys[i])}</b><span>${e ? e.ico : '+'}</span><i>${e ? e.n : 'vazio'}</i><u></u>`;
    d.onclick = () => e ? hotUse(i) : abrirPicker(i);
    d.oncontextmenu = ev => { ev.preventDefault(); P.hotbar[i] = null; renderHotbar(); };
    d.title = e ? `${e.n} — ${hotKeyLabel(P.hotkeys[i])} · botão direito limpa` : 'clique para escolher';
    const key = d.firstChild;
    key.title = 'clique e aperte uma tecla para trocar o atalho';
    key.onclick = ev => {
      ev.stopPropagation();
      G.rebindSlot = i; key.textContent = '…'; d.classList.add('rebind');
    };
    bar.appendChild(d);
  }
}
/* só o cooldown/mana muda a cada frame — remontar a barra inteira em 60fps é desperdício */
function tickHotbar() {
  const bar = $('#hotbar');
  for (let i = 0; i < HOT_SLOTS; i++) {
    const d = bar.children[i], e = hotEntry(P.hotbar && P.hotbar[i]);
    if (!d || !e) continue;
    if (e.sp) {
      d.lastChild.style.height = Math.max(0, ((P.cd[e.sp.id] || 0) - G.now) / e.sp.cd * 100) + '%';
      d.classList.toggle('nomana', P.mana < e.sp.mana);
    } else {
      const tem = P.bag.some(b => b.id === e.itemId);
      d.classList.toggle('nomana', !tem);
      const q = P.bag.filter(b => b.id === e.itemId).reduce((a, b) => a + (b.ch || b.count || 1), 0);
      if (d.dataset.q !== String(q)) { d.dataset.q = q; d.children[2].textContent = e.n + (q ? ' ×' + q : ''); }
    }
  }
}
/* escolhe o que vai no slot: magia conhecida ou item usável */
function abrirPicker(i) {
  const w = $('#pick-win'), box = $('#pick-list');
  box.innerHTML = '';
  const add = (ico, nome, slot) => {
    const d = document.createElement('div'); d.className = 'srow2';
    d.innerHTML = `<span>${ico} ${nome}</span>`;
    d.onclick = () => { P.hotbar[i] = slot; w.style.display = 'none'; renderHotbar(); };
    box.appendChild(d);
  };
  const h = document.createElement('div'); h.className = 'sec'; h.textContent = 'Magias';
  box.appendChild(h);
  knownSpells().forEach(sp => add(sp.ico, sp.n, { k: 'spell', id: sp.id }));
  const h2 = document.createElement('div'); h2.className = 'sec'; h2.textContent = 'Itens';
  box.appendChild(h2);
  // só o que está na mochila agora: a barra reflete o que o personagem tem, não o catálogo inteiro
  const idsNaBag = new Set(P.bag.map(b => b.id));
  for (const id in ITEMS) if ((ITEMS[id].use || ITEMS[id].rune) && idsNaBag.has(id)) add(ITEMS[id].ico, ITEMS[id].n, { k: 'item', id });
  $('#pick-title').textContent = 'Slot ' + hotKeyLabel(P.hotkeys[i]);
  w.style.display = 'flex';
}
function renderBattle() {
  const box = $('#tab-battle'); box.innerHTML = '';
  const near = G.mobs.filter(m => m.hp > 0 && distT(m.x, m.y, P.x, P.y) <= 10)
    .sort((a, b) => distT(a.x, a.y, P.x, P.y) - distT(b.x, b.y, P.x, P.y)).slice(0, 12);
  if (!near.length) box.innerHTML = '<div class="note">Nenhum monstro por perto.</div>';
  near.forEach(m => {
    const d = document.createElement('div');
    d.className = 'bt' + (G.target === m ? ' sel' : '');
    d.innerHTML = `<span>${m.n}</span><div class="hb"><i style="width:${m.hp / m.maxhp * 100}%"></i></div>`;
    d.onclick = () => { G.target = G.target === m ? null : m; renderBattle(); };
    box.appendChild(d);
  });
}
function renderAll() { recalc(); renderStance(); renderInv(); renderSkills(); renderBars(); renderStatus(); renderSpells(); renderHotbar(); renderBattle(); }

/* tooltip */
function showTip(e, it) {
  const s = itemStats(it);
  let html = `<b style="color:${s.color}">${s.name}</b>`;
  if (it.count > 1) html += ` <span class="dim">x${it.count}</span>`;
  html += `<div class="dim">${RARITY[it.r].name}${s.slot ? ' · ' + SLOT_LABEL[s.slot] : ''}</div>`;
  if (s.atk) html += `<div>Ataque: <b>${s.atk}</b></div>`;
  if (s.dmg) html += `<div>Dano mágico: <b>${s.dmg[0]}-${s.dmg[1]}</b></div>`;
  if (s.def) html += `<div>Defesa: <b>${s.def}</b></div>`;
  if (s.arm) html += `<div>Armadura: <b>${s.arm}</b></div>`;
  const u = ITEMS[it.id].use;
  if (u) html += `<div>Restaura <b>${u.hp || u.mp}</b> de ${u.hp ? 'vida' : 'mana'}</div>`;
  const ru = ITEMS[it.id].rune;
  if (ru) html += `<div>Runa · <b>${it.ch}</b> cargas<br>
    <span class="dim">${ru.type === 'heal' ? 'cura você' : ru.type === 'aoe' ? 'explode em área no alvo' : 'atinge o alvo'}</span></div>`;
  if (!s.slot && !u) html += `<div class="dim">Troféu — serve pra vender</div>`;
  for (const k in s.bonus) html += `<div class="bon">${fmtBon(k, s.bonus[k])}</div>`;
  /* conjunto: mostra a contagem e todos os degraus, os apagados inclusive — é o
     que faz o jogador querer a próxima peça em vez de vender */
  const sk = ITEMS[it.id].set;
  if (sk) {
    const n = setCount(sk);
    html += `<div class="dim">Conjunto ${SETS[sk].n} — <b>${n}/${SETS[sk].max}</b></div>`;
    for (const [q, b] of SETS[sk].tiers)
      html += `<div class="${n >= q ? 'bon' : 'dim'}">${q} peças: ${Object.keys(b).map(k => fmtBon(k, b[k])).join(', ')}</div>`;
  }
  if (s.lvl) html += `<div class="${P.level >= s.lvl ? 'dim' : 'bad'}">Nível mínimo: ${s.lvl}</div>`;
  if (s.voc) html += `<div class="${s.voc.includes(P.voc) ? 'dim' : 'bad'}">Só ${s.voc.map(v => VOCATIONS[v].name).join('/')}</div>`;
  if (s.sell) html += `<div class="dim">Vende por <b>${sellPrice({ ...it, count: 1 })}</b> 🪙${it.count > 1 ? ` · lote ${sellPrice(it)}` : ''}</div>`;
  html += `<div class="dim tiny">clique: ${ITEMS[it.id].use ? 'usar' : s.slot ? 'equipar/desequipar' : '—'} · botão direito: largar</div>`;
  tipEm(e, html);
}
/* abrir o balão em cima de um elemento qualquer — o de item é só um caso dele */
function tipEm(e, html) {
  const t = $('#tooltip');
  t.innerHTML = html;
  t.style.display = 'block';
  tipDono = e.currentTarget;
  const r = e.currentTarget.getBoundingClientRect();
  t.style.left = Math.min(innerWidth - 250, r.left - 240) + 'px';
  t.style.top = Math.min(innerHeight - t.offsetHeight - 8, r.top) + 'px';
}
const hideTip = () => { tipDono = null; $('#tooltip').style.display = 'none'; };
/* O tooltip vive preso ao mouseleave da célula. Quando a célula some sem o mouse
   sair dela — pegar o item do corpo, fechar a janela de saque, qualquer lista que
   se reconstrói — o evento nunca chega e o balão fica órfão na tela.
   Guardar o dono e conferir uma vez por quadro resolve nos dois casos de uma vez:
   `offsetParent` é nulo tanto para quem saiu do documento quanto para quem tem
   um ancestral com display:none. Consertar em cada render seria o mesmo remendo
   repetido em cinco lugares, e o próximo render novo nasceria quebrado. */
let tipDono = null;
function tipCheck() { if (tipDono && !tipDono.offsetParent) hideTip(); }

/* --------------------------------------------------------------- loja */
/* raridade também vale ouro: um item lendário vende bem mais que o comum */
function sellPrice(it) {
  const s = itemStats(it);
  return Math.max(1, Math.round(s.sell * (1 + it.r * 0.6))) * (it.count || 1);
}
function shopNear() { return P.z === SURF && distT(P.x, P.y, WORLD.temple.x, WORLD.temple.y) <= 8; }
function renderShop() {
  const buy = $('#shop-buy'); buy.innerHTML = '';
  SHOP_STOCK.forEach(id => {
    const b = ITEMS[id];
    const d = document.createElement('div'); d.className = 'srow2';
    d.innerHTML = `<span>${b.ico} ${b.n}</span><b>${b.price} 🪙</b>`;
    d.onclick = () => {
      if (P.gold < b.price) return log('Ouro insuficiente.', 'bad');
      const it = mkItem(id, 0, 1);
      if (!bagAdd(it)) return;
      P.gold -= b.price; log(`Comprou ${b.n}.`); sfx('coin'); renderShop(); renderInv(); renderBars();
    };
    buy.appendChild(d);
  });
  const sell = $('#shop-sell'); sell.innerHTML = '';
  P.bag.forEach(it => {
    const s = itemStats(it);
    const price = sellPrice(it);
    const d = document.createElement('div'); d.className = 'srow2';
    d.innerHTML = `<span style="color:${s.color}">${s.ico} ${s.name}${it.count > 1 ? ' x' + it.count : ''}</span><b>${price} 🪙</b>`;
    d.onclick = () => { P.gold += price; P.bag.splice(P.bag.indexOf(it), 1); log(`Vendeu por ${price} moedas.`); sfx('coin'); renderShop(); renderInv(); renderBars(); };
    sell.appendChild(d);
  });
}

/* ------------------------------------------------------------- entrada */
const tileUnderMouse = (ev, canvas) => screenToTile(ev, canvas);
function clickTile(x, y) {
  /* Alvo é escolha, não estado grudento: clicar de novo em quem já é alvo
     desmarca, e atacar outra criatura troca. Clicar no chão só move — antes
     também desmarcava o alvo, o que forçava reselecionar o bicho toda vez que
     você reposicionava para lutar. */
  const m = G.mobs.find(mo => mo.hp > 0 && mo.z === P.z && mo.x === x && mo.y === y);
  if (m) {
    if (emZonaSegura()) return log(AVISO_SEGURA, 'bad');
    G.target = G.target === m ? null : m; G.path = []; renderBattle(); return;
  }
  const p = findPath(P.x, P.y, x, y, P.z);
  if (p) G.path = p; else log('Não dá para chegar lá.');
}
/* Pilha é LIFO: quem chegou por último (fim do array — morreu por cima ou foi
   arrastado pra cima do monte) é o topo, e é nele que o clique/saque mexe.
   Saquear NÃO tira o corpo da pilha, nem vazio — só o jogador tira, arrastando
   o de cima pra outro tile (ou o relógio de decay, depois de 2 min). Enquanto
   isso, o topo continua sendo o topo mesmo saqueado, e é nele que qualquer
   clique novo mexe — não pula pro de baixo sozinho. */
function corpseAt(x, y) {
  const aqui = G.corpses.filter(c => c.z === P.z && c.x === x && c.y === y);
  return aqui[aqui.length - 1] || null;
}
/* Saque é botão direito agora — separado do clique esquerdo (mira/anda), que antes
   um corpo no meio do caminho travava em "arrastar" e ninguém conseguia só passar. */
function lootTile(x, y) {
  const c = corpseAt(x, y);
  const dr = G.drops.find(d => d.z === P.z && d.x === x && d.y === y);
  if (!c && !dr) return;
  if (distT(P.x, P.y, x, y) <= 1) { if (c) openLoot(c); else if (bagAdd(dr.it)) G.drops.splice(G.drops.indexOf(dr), 1); return; }
  // fora de alcance: anda até ficar ADJACENTE, nunca em cima do corpo — corta o
  // último passo do caminho, igual ao alcance de corpo a corpo faz com o alvo.
  // afterStep() abre sozinho quando chegar perto.
  G.pendingLoot = [x, y];
  const p = findPath(P.x, P.y, x, y, P.z);
  if (p) G.path = p.slice(0, Math.max(1, p.length - 1)); else log('Não dá para chegar lá.');
}
/* Empurrão: rola contra o tamanho da criatura — sz vai de .45 (cobra) a 1.9
   (demônio) na tabela de monstros. Teto de 35% pro menor bicho: empurrar tem
   de ser chance de sorte, não ferramenta confiável, mesmo contra rato. */
function empurrar(m, x, y) {
  const chance = clamp(.35 - (m.def.sz - .45) * .22, .03, .35);
  if (Math.random() < chance) { tryStep(m, x, y); log(`Você empurrou ${m.n}.`); }
  else log(`${m.n} resistiu ao empurrão.`, 'bad');
}
function stepPlayer() {
  if (G.now < P.nextStep || G.dead) return;
  // teclado tem prioridade sobre o caminho clicado
  if (G.walkDir) {
    const [dx, dy] = G.walkDir;
    P.lastDir = [dx, dy];
    if (tryStep(P, P.x + dx, P.y + dy)) { G.path = []; afterStep(); }
    else P.nextStep = G.now + 120;
    return;
  }
  if (P.follow && G.target && G.target.hp > 0 && G.target.z === P.z) {
    const w = weaponInfo(), d = distT(P.x, P.y, G.target.x, G.target.y);
    if (d > w.range && !G.path.length) {
      const p = findPath(P.x, P.y, G.target.x, G.target.y, P.z, 3000);
      if (p && p.length) G.path = p.slice(0, Math.max(1, p.length - w.range));
    }
  }
  if (!G.path.length) return;
  const [nx, ny] = G.path[0];
  P.lastDir = [Math.sign(nx - P.x), Math.sign(ny - P.y)];
  if (tryStep(P, nx, ny)) { G.path.shift(); afterStep(); }
  else { G.path = []; P.nextStep = G.now + 150; }
}
/* bebe a melhor poção que o nível permite — sobreviver puxando várias exige isso */
function drinkBest(ids) {
  for (const id of ids) {
    const it = P.bag.find(b => b.id === id && (!ITEMS[id].lvl || P.level >= ITEMS[id].lvl));
    if (it) return useItem(it);
  }
  log('Você não tem essa poção.', 'bad');
}
/* Volume da chuva: a intensidade do céu, abafada sob teto. Dois chamadores porque
   são duas causas — o teto muda a cada passo, o tempo muda com você parado. */
const chuvaOuvida = () => chuvaSom(climaAgora(P.z).chuva * (souCoberto() ? .3 : 1));

function afterStep() {
  const t = tileAt(P.x, P.y, P.z);
  chuvaOuvida();
  const h = huntAt(P.x, P.y, P.z);
  if ((h && h.id) !== (G.hunt && G.hunt.id)) {
    G.hunt = h;
    if (h) {
      log(`Você entrou em ${h.n} — bom para ${h.best}. Sugerido: nível ${h.lvl}+.`, 'good');
      P.seen = P.seen || {};
      if (!P.seen['h' + h.id]) {                       // descoberta só avisa na primeira vez
        P.seen['h' + h.id] = 1;
        notify('🗺️', 'Nova área: ' + h.n, `bom para ${h.best} · nível ${h.lvl}+`);
      }
    }
    $('#hunt-label').textContent = h ? h.n : '';
  }
  if (t === T.DOWN || t === T.UP) changeFloor(t === T.DOWN ? P.z + 1 : P.z - 1);
  if (G.pendingLoot && distT(P.x, P.y, G.pendingLoot[0], G.pendingLoot[1]) <= 1) {
    const [lx, ly] = G.pendingLoot; G.pendingLoot = null;
    const c = corpseAt(lx, ly);
    if (c) openLoot(c);
    const dr = G.drops.find(d => d.z === P.z && d.x === lx && d.y === ly);
    if (dr && bagAdd(dr.it)) G.drops.splice(G.drops.indexOf(dr), 1);
  }
  $('#shop-btn').style.display = shopNear() ? 'block' : 'none';
}
function changeFloor(nz) {
  if (nz < 0 || nz >= FLOORS) return;
  P.z = nz; G.path = []; G.target = null;
  /* Andar é recorte do mesmo mundo, não mundo novo: corpo, sangue e item largado
     ficam onde estavam, cada um com o seu `z`, e reaparecem quando você voltar.
     Corpo apodrece sozinho em 2 min (updateFx), então isso não cresce sem fim.
     Bicho é o único que some, e quem cuida disso é o refreshSpawns logo abaixo:
     ele já tira do mapa todo spawn que não é do andar atual. */
  refreshSpawns(true); sfx('stairs'); ambience(nz);
  $('#floor-label').textContent = FLOOR_NAMES[nz];
  log('Você chegou em: ' + FLOOR_NAMES[nz]);
  P.seen = P.seen || {};
  if (!P.seen['f' + nz]) { P.seen['f' + nz] = 1; notify('🪜', 'Nova área: ' + FLOOR_NAMES[nz], 'andar desbloqueado no mapa'); }
}
/* ESC fecha o que estiver aberto por cima do jogo. Varre `.win` em vez de listar
   janela por janela: a lista fixa que existia aqui já tinha ficado para trás —
   bestiário, mapa, slots e interface nasceram depois e nunca entraram nela, então
   ESC não fechava nenhum dos quatro. Varrendo, janela nova entra de graça.
   A tela de morte fica de fora de propósito: sair dela é escolha, não descuido. */
function fecharJanelas() {
  let fechou = false;
  for (const w of document.querySelectorAll('.win'))
    if (w.style.display && w.style.display !== 'none') { w.style.display = 'none'; fechou = true; }
  const h = $('#help');
  if (h && h.style.display && h.style.display !== 'none') { h.style.display = 'none'; fechou = true; }
  if (G.lootOpen) { G.lootOpen = null; fechou = true; }
  hideTip();
  return fechou;
}
const KEYDIR = { w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0] };
function bindInput(canvas) {
  canvas.addEventListener('mousedown', e => {
    const t = tileUnderMouse(e, canvas); if (!t) return;
    /* Só o tile decide o alvo/alcance. Houve aqui uma tentativa de mirar pela
       caixa desenhada do sprite, para compensar o boneco cobrir só metade do
       próprio quadrado — mas sprite é alto e transborda para cima, então a
       caixa de quem está embaixo invade o quadrado de quem está em cima, e
       clicar na criatura de cima selecionava a de baixo. Quadrado não tem
       essa ambiguidade. */
    if (e.button === 2) {
      // botão direito: só corpo/item. Nunca anda, então nunca disputa com o
      // clique esquerdo — corpo no meio do caminho parava de travar passagem.
      const c = corpseAt(t[0], t[1]);
      if (c && distT(P.x, P.y, c.x, c.y) <= 1) G.dragCorpse = c;
      else lootTile(t[0], t[1]);
      return;
    }
    if (e.button !== 0) return;
    // criatura viva ao alcance: começa arrasto pro empurrão. Clique simples
    // (solta no mesmo tile) ainda mira — é o mouseup que decide qual foi.
    const m = G.mobs.find(mo => mo.hp > 0 && mo.z === P.z && mo.x === t[0] && mo.y === t[1]);
    if (m && distT(P.x, P.y, m.x, m.y) <= 1) { G.dragMob = m; return; }
    clickTile(t[0], t[1]);
  });
  canvas.addEventListener('mouseup', e => {
    const c = G.dragCorpse; G.dragCorpse = null;
    const m = G.dragMob; G.dragMob = null;
    const t = tileUnderMouse(e, canvas); if (!t) return;
    if (c) {
      if (t[0] === c.x && t[1] === c.y) return lootTile(t[0], t[1]);   // clique simples = saquear
      if (distT(t[0], t[1], c.x, c.y) > 1 || !isWalkable(t[0], t[1], P.z)) return log('Arraste o corpo para um tile vizinho livre.');
      c.x = t[0]; c.y = t[1];
      // vai pro fim do array = vira o TOPO da pilha no tile novo (LIFO)
      G.corpses.splice(G.corpses.indexOf(c), 1); G.corpses.push(c);
      return;
    }
    if (m) {
      if (t[0] === m.x && t[1] === m.y || m.hp <= 0) return clickTile(t[0], t[1]);   // clique simples = mira
      if (distT(t[0], t[1], m.x, m.y) !== 1 || !isWalkable(t[0], t[1], P.z) || occupied(t[0], t[1], P.z, m))
        return log('Arraste a criatura para um tile vizinho livre.');
      empurrar(m, t[0], t[1]);
    }
  });
  // tile sob o cursor: só guarda aqui, quem desenha é o render
  canvas.addEventListener('mousemove', e => { G.hover = tileUnderMouse(e, canvas); });
  canvas.addEventListener('mouseleave', () => { G.hover = null; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    // faixa fechada nos dois extremos que o próprio jogador testou e aprovou:
    // 2 = mais aberto que dá pra jogar sem perder contexto, 3.25 = mais perto
    // que ainda mostra o que tá em volta
    CAM.zoom = clamp(+(CAM.zoom + (e.deltaY > 0 ? -.25 : .25)).toFixed(2), 2, 3.25);
    resizeCam(canvas);
  }, { passive: false });
  addEventListener('keydown', e => {
    if (document.activeElement.tagName === 'INPUT') return;
    // captura a próxima tecla pra virar o atalho do slot; Esc cancela sem trocar nada
    if (G.rebindSlot != null) {
      e.preventDefault();
      const nk = e.key.toLowerCase();
      if (nk !== 'escape') setHotkey(G.rebindSlot, nk);
      G.rebindSlot = null;
      renderHotbar();
      return;
    }
    const k = e.key.toLowerCase();
    if (KEYDIR[k]) { G.keys[k] = 1; G.walkDir = KEYDIR[k]; e.preventDefault(); }
    else if (P.hotkeys && P.hotkeys.indexOf(k) >= 0) { e.preventDefault(); hotUse(P.hotkeys.indexOf(k)); }
    else if (k === ' ') {
      e.preventDefault();
      const near = G.mobs.filter(m => m.hp > 0 && m.z === P.z).sort((a, b) => distT(a.x, a.y, P.x, P.y) - distT(b.x, b.y, P.x, P.y))[0];
      if (near) { G.target = near; renderBattle(); }
    }
    else if (k === 'f') {
      const perto = G.corpses.filter(c => c.z === P.z && distT(c.x, c.y, P.x, P.y) <= 1);
      const c = perto[perto.length - 1];   // LIFO, igual corpseAt
      if (c) { openLoot(c); lootAll(); }
    }
    else if (k === 'g') {
      const dr = G.drops.find(d => d.z === P.z && distT(d.x, d.y, P.x, P.y) <= 1);
      if (dr && bagAdd(dr.it)) G.drops.splice(G.drops.indexOf(dr), 1);
    }
    else if (k === 'x') drinkBest(['great_health_potion', 'strong_health_potion', 'health_potion', 'weak_health_potion']);
    else if (k === 'c') drinkBest(['great_mana_potion', 'strong_mana_potion', 'mana_potion']);
    else if (k === 'tab') {
      e.preventDefault();
      const perto = G.mobs.filter(m => m.hp > 0 && m.z === P.z && distT(m.x, m.y, P.x, P.y) <= 8)
        .sort((a, b) => a.uid - b.uid);
      if (perto.length) {
        const i = perto.indexOf(G.target);
        G.target = perto[(i + 1) % perto.length];
        renderBattle();
      }
    }
    else if (k === 'm') { const w = $('#map-win'); w.style.display === 'flex' ? w.style.display = 'none' : openMap(); }
    else if (k === 'b') $('#best-btn').onclick();
    else if (k === 'h') $('#help').style.display = $('#help').style.display === 'flex' ? 'none' : 'flex';
    else if (k === 'escape') fecharJanelas();
    else if (k === 'enter') { $('#chat').focus(); e.preventDefault(); }
  });
  // troca de aba/janela no meio da captura: cancela em vez de prender a próxima tecla
  addEventListener('blur', () => { if (G.rebindSlot != null) { G.rebindSlot = null; renderHotbar(); } });
  addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (KEYDIR[k]) {
      delete G.keys[k];
      const left = Object.keys(G.keys).find(kk => KEYDIR[kk]);
      G.walkDir = left ? KEYDIR[left] : null;
    }
  });
  addEventListener('resize', () => resizeCam(canvas));
  /* o canvas nasce com o tamanho de antes das sidebars do HUD entrarem, e ficava
     esticado até o primeiro zoom; o observer casa o buffer com a caixa real. */
  new ResizeObserver(() => resizeCam(canvas)).observe($('#stage'));
  $('#chat').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const txt = e.target.value.trim().toLowerCase(); e.target.value = '';
    e.target.blur();
    if (!txt) return;
    const sp = SPELLS.find(s => s.w === txt);
    if (sp) { castSpell(sp); return; }
    say(P, txt);
    log('Você diz: ' + txt);
  });
}

/* ------------------------------------------------------------- placas/fx */
/* project() vive no render2d: as placas seguem a mesma transformação do mundo */
function updateOverlay() {
  const ov = $('#overlay'), seen = new Set();
  const cvW = gcv ? gcv.clientWidth : 0, cvH = gcv ? gcv.clientHeight : 0;
  const naTela = ([sx, sy]) => sx > -24 && sx < cvW + 24 && sy > -24 && sy < cvH + 24;
  const ents = [{ key: 'p', ent: P, n: P.name, hp: P.hp, max: P.st.maxhp, col: VOCATIONS[P.voc].color, anchor: plateAnchor(P) }];
  // nome/vida só pra quem está de fato na tela: `distT < 22` valia até pra bicho
  // fora do andar (x/y se repete entre andares, o raio não olhava `z`) e pra
  // bicho dentro do raio mas fora da área visível de verdade, dependendo do zoom
  for (const m of G.mobs) {
    if (m.hp <= 0 || m.z !== P.z) continue;
    const a = plateAnchor(m);
    // elite e chefe se anunciam pela cor do nome: dá pra decidir se vale a briga
    // antes de encostar, que é o único aviso justo quando a vida é 3x a esperada
    if (naTela(a)) ents.push({ key: 'm' + m.uid, ent: m, n: m.n, hp: m.hp, max: m.maxhp, col: G.target === m ? '#ff5252' : (m.def.plateCol || '#ddd'), anchor: a });
  }
  for (const e of ents) {
    seen.add(e.key);
    let el = G.plates.get(e.key);
    if (!el) {
      el = document.createElement('div'); el.className = 'plate';
      el.innerHTML = '<u class="say"></u><span class="nm"></span><div class="pb"><i></i></div>';
      ov.appendChild(el); G.plates.set(e.key, el);
    }
    const [sx, sy] = e.anchor;
    // em zoom alto o bicho cresce e empurra a placa pra fora do topo do canvas
    // — travada em 22px ela some por trás da moldura em vez de voar tela afora
    el.style.transform = `translate(${sx}px,${Math.max(sy, 22)}px) translate(-50%,-100%)`;
    const sayEl = el.children[0], sp = el.children[1];
    const fala = e.ent.say && e.ent.say.until > G.now ? e.ent.say.txt : '';
    if (sayEl.textContent !== fala) sayEl.textContent = fala;
    sayEl.style.display = fala ? 'block' : 'none';
    if (sp.textContent !== e.n) sp.textContent = e.n;
    sp.style.color = e.col;
    el.children[2].firstChild.style.width = clamp(e.hp / e.max * 100, 0, 100) + '%';
  }
  for (const [k, el] of G.plates) if (!seen.has(k)) { el.remove(); G.plates.delete(k); }

  // textos flutuantes
  for (const f of G.fx) {
    if (f.kind !== 'text') continue;
    if (!f.el) { f.el = document.createElement('div'); f.el.className = 'ftext'; f.el.textContent = f.txt; f.el.style.color = f.color; ov.appendChild(f.el); }
    const k = (G.now - f.t) / f.dur;
    const [sx, sy] = project(f.x, f.y, 1.2 + k * 1.2);
    f.el.style.transform = `translate(${sx}px,${sy}px) translate(-50%,-50%)`;
    f.el.style.opacity = 1 - k;
  }
}
function updateFx() {
  for (let i = G.fx.length - 1; i >= 0; i--) {
    const f = G.fx[i];
    if (G.now - f.t < f.dur) continue;
    if (f.el) f.el.remove();
    G.fx.splice(i, 1);
  }
  for (let i = G.proj.length - 1; i >= 0; i--) {
    const p = G.proj[i];
    if (G.now - p.t < p.dur) continue;
    p.onHit && p.onHit(); G.proj.splice(i, 1);
  }
  for (let i = G.blood.length - 1; i >= 0; i--)
    if (G.now - G.blood[i].t > G.blood[i].dur) G.blood.splice(i, 1);
  for (let i = G.corpses.length - 1; i >= 0; i--) {
    const c = G.corpses[i];
    if (G.now - c.t > 120000) {
      if (G.lootOpen === c) { G.lootOpen = null; $('#loot-win').style.display = 'none'; }
      G.corpses.splice(i, 1);
    }
  }
}
/* ox/oy: pan em tiles a partir do jogador (dbl-click recentra). R: metade da
   janela visível em tiles — o zoom do minimapa, menor R = mais perto. */
const miniView = { ox: 0, oy: 0, R: 34 };
let miniDragMoved = false;
function drawMinimap() {
  const cv = $('#minimap'), ctx = cv.getContext('2d'), src = miniCanvas[P.z];
  const cx = P.x + miniView.ox, cy = P.y + miniView.oy, R = miniView.R;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.drawImage(src, cx - R, cy - R, R * 2, R * 2, 0, 0, cv.width, cv.height);
  const sc = cv.width / (R * 2);
  const dot = (x, y, c, s) => { ctx.fillStyle = c; ctx.fillRect((x - cx + R) * sc - s / 2, (y - cy + R) * sc - s / 2, s, s); };
  G.mobs.forEach(m => m.hp > 0 && dot(m.x, m.y, G.target === m ? '#ff4444' : '#ff9a4a', 3));
  G.corpses.forEach(c => dot(c.x, c.y, '#8a3a3a', 3));
  if (P.z === SURF) dot(WORLD.temple.x, WORLD.temple.y, '#ffe08a', 5);
  dot(P.x, P.y, '#ffffff', 4);
}
/* Arrastar move o recorte (ox/oy), roda dá zoom (R). `moved` some o clique de
   abrir o mapa grande quando o gesto era arrasto, não clique — sem isso todo
   arrasto no minimapa também disparava a janela do mapa. */
function bindMiniMap(cv) {
  let dragging = false, lastX = 0, lastY = 0;
  cv.addEventListener('mousedown', e => {
    dragging = true; miniDragMoved = false; lastX = e.clientX; lastY = e.clientY; cv.style.cursor = 'grabbing';
  });
  addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) miniDragMoved = true;
    const sc = cv.width / (miniView.R * 2);
    miniView.ox -= dx / sc; miniView.oy -= dy / sc;
    lastX = e.clientX; lastY = e.clientY;
  });
  addEventListener('mouseup', () => { dragging = false; cv.style.cursor = 'grab'; });
  cv.addEventListener('dblclick', e => { e.preventDefault(); miniView.ox = 0; miniView.oy = 0; });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    miniView.R = clamp(miniView.R * (e.deltaY > 0 ? 1.15 : .87), 10, 90);
  }, { passive: false });
}

/* -------------------------------------------------------------- persistência */
/* Cada personagem agora tem seu próprio save. O formato antigo (`tibia3d.save`)
   continua sendo lido para migrar instalações existentes sem perder progresso. */
const SAVE_KEY = 'tibia3d.save';
const CHARACTERS_KEY = 'thaira.characters';
const ACTIVE_CHARACTER_KEY = 'thaira.activeCharacter';
let ACTIVE_CHARACTER_ID = null;

function charId() {
  return 'char_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function fixSave(d) {
  if (!d || !d.p) return null;
  // Compatibilidade: saves antigos usavam a vocação 'paladin'.
  if (d.p.voc === 'paladin') d.p.voc = 'ranger';
  // JSON guarda apenas nome+bônus dos afixos; remontamos as referências às tabelas.
  const fixAf = it => {
    if (it && it.af) it.af = it.af.map(a => PREFIXES.find(x => x.n === a.n) || SUFFIXES.find(x => x.n === a.n)).filter(Boolean);
    return it;
  };
  for (const k in (d.p.eq || {})) fixAf(d.p.eq[k]);
  (d.p.bag || []).forEach(fixAf);
  d.corpses = (d.corpses || []).filter(c => c && c.items);
  d.corpses.forEach(c => { c.t = 0; c.items.forEach(fixAf); });
  /* Carimbo de G.now não sobrevive ao save, pelo mesmo motivo do `c.t` acima: o
     relógio DO JOGO recomeça em zero a cada carregamento, então stamp gravado
     volta no futuro e o que dura 90ms passa a durar a partida inteira. Era o
     que pintava o herói de branco — `hitT` do último dano voltava adiantado e o
     clarão do acerto nunca terminava. */
  d.p.hitT = d.p.stepT = d.p.stepD = 0;
  d.drops = (d.drops || []).filter(dr => dr && dr.it);
  d.drops.forEach(dr => fixAf(dr.it));
  return d;
}

function readCharacters() {
  try {
    const raw = JSON.parse(localStorage.getItem(CHARACTERS_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch (e) { return {}; }
}

function writeCharacters(chars) {
  localStorage.setItem(CHARACTERS_KEY, JSON.stringify(chars));
}

function migrateLegacySave() {
  const chars = readCharacters();
  if (Object.keys(chars).length) return chars;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return chars;
    const d = fixSave(JSON.parse(raw));
    if (!d) return chars;
    const id = charId();
    chars[id] = d;
    writeCharacters(chars);
    localStorage.setItem(ACTIVE_CHARACTER_KEY, id);
    return chars;
  } catch (e) { return chars; }
}

function listCharacters() {
  const chars = migrateLegacySave();
  return Object.entries(chars)
    .map(([id, d]) => ({ id, d: fixSave(d) }))
    .filter(x => x.d && x.d.p)
    .sort((a, b) => (b.d.p.level || 1) - (a.d.p.level || 1));
}

/* apaga o save legado junto quando some o último: migrateLegacySave o ressuscitaria */
function deleteCharacter(id) {
  const chars = readCharacters();
  delete chars[id];
  writeCharacters(chars);
  if (localStorage.getItem(ACTIVE_CHARACTER_KEY) === id) localStorage.removeItem(ACTIVE_CHARACTER_KEY);
  if (!Object.keys(chars).length) localStorage.removeItem(SAVE_KEY);
  if (ACTIVE_CHARACTER_ID === id) ACTIVE_CHARACTER_ID = null;
}

function loadCharacter(id) {
  const chars = migrateLegacySave();
  const d = fixSave(chars[id]);
  if (!d) return null;
  ACTIVE_CHARACTER_ID = id;
  localStorage.setItem(ACTIVE_CHARACTER_KEY, id);
  return d;
}

function load() {
  const chars = migrateLegacySave();
  const active = localStorage.getItem(ACTIVE_CHARACTER_KEY);
  if (active && chars[active]) return loadCharacter(active);
  const first = Object.keys(chars)[0];
  return first ? loadCharacter(first) : null;
}

/* O save guarda somente o que não pode ser recalculado: terreno, estado dos
   bichos, corpos/itens no chão e o personagem. O arquivo legado continua sendo
   atualizado para compatibilidade com ferramentas antigas. */
function save() {
  if (!P) return;
  const { st, ...rest } = P;
  const agora = Date.now();
  const d = {
    seed: WORLD.seed, p: rest, corpses: G.corpses, drops: G.drops,
    mobs: G.mobs.filter(m => m.hp > 0).map(m => ({ i: WORLD.spawns.indexOf(m.sp), x: m.x, y: m.y, hp: m.hp }))
      .filter(o => o.i >= 0),
    mortos: WORLD.spawns.map((sp, i) => sp.dead > agora ? [i, sp.dead] : null).filter(Boolean),
    /* O sorteio de elite tem de sobreviver ao save pelo mesmo motivo que
       sobrevive ao respawn de proximidade: o veterano que você deixou com 20%
       de vida precisa ser o mesmo quando você voltar, senão o `hp` restaurado
       cai pro teto de um bicho comum e a briga recomeça do zero. */
    elites: WORLD.spawns.map((sp, i) => sp.el >= 0 ? [i, sp.el] : null).filter(Boolean)
  };
  const id = ACTIVE_CHARACTER_ID || charId();
  ACTIVE_CHARACTER_ID = id;
  const chars = readCharacters();
  chars[id] = d;
  writeCharacters(chars);
  localStorage.setItem(ACTIVE_CHARACTER_KEY, id);
  // Compatibilidade com a versão anterior do jogo.
  localStorage.setItem(SAVE_KEY, JSON.stringify(d));
}

/* --------------------------------------------------------------- loop */
let lastT = 0;
function frame(t) {
  requestAnimationFrame(frame);
  const passo = Math.min(50, t - lastT); lastT = t;
  /* G.now é o relógio DO JOGO: ele acumula em vez de copiar o carimbo do
     requestAnimationFrame. É isso que torna o hitstop possível — passo, ataque,
     quadro de animação e efeito leem todos G.now, então segurar este número
     congela a cena inteira, e não só a inteligência dos bichos. O desenho
     continua saindo durante a pausa, senão o navegador mostraria o quadro velho
     e o efeito viraria engasgo em vez de ênfase. */
  if (G.pausa > 0 && G.started) { G.pausa -= passo; drawWorld(); updateOverlay(); return; }
  G.now += passo; const dt = G.dt = passo;
  if (!G.started) return;

  stepPlayer();
  lerpEntity(P);
  updateMobs(dt);
  playerAttack();
  updateFx();
  tipCheck();

  if (G.now - G.lastSpawn > 700) {
    G.lastSpawn = G.now; refreshSpawns(); renderBattle();
    const c = G.lootOpen;                       // saiu de perto do corpo: fecha o saque
    if (c && (c.z !== P.z || distT(P.x, P.y, c.x, c.y) > 1)) {
      G.lootOpen = null; $('#loot-win').style.display = 'none';
    }
  }
  if (G.now - G.lastRegen > 3000) {
    G.lastRegen = G.now;
    if (!G.dead) {
      P.hp = Math.min(P.st.maxhp, P.hp + P.st.hpReg);
      P.mana = Math.min(P.st.maxmana, P.mana + P.st.mpReg);
    }
    for (const k in P.buffs) if (P.buffs[k].end < G.now) { delete P.buffs[k]; recalc(); log('Efeito acabou: ' + (BUFF_LABEL[k] || k)); }
    regenMobs();
    // vira o dia: sem aviso o jogador acha que a tela quebrou
    const noite = ehNoite();
    if (G.noite !== noite) { G.noite = noite; if (P.z <= SURF) log(noite ? 'Anoitece.' : 'Amanhece.'); }
    // clima do céu, não do andar: entrar na caverna não pode fazer a chuva "passar"
    const chove = climaAgora(SURF).chuva > 0;
    if (G.chuva !== chove) { G.chuva = chove; if (P.z <= SURF) log(chove ? 'Começa a chover.' : 'A chuva passa.'); }
    chuvaOuvida();
    // a trilha muda com o andar E com a hora; musica() sai na hora quando já é a
    // lista certa, então chamar de novo aqui não custa nada
    musica(P.z <= SURF ? (noite ? 'superficie-noite' : 'superficie-dia') : P.z === 3 ? 'abismo' : 'caverna');
    renderBars();
  }
  if (G.now - G.lastSave > 15000) { G.lastSave = G.now; save(); }
  if (G.now - (G.lastMap || 0) > 200 && $('#map-win').style.display === 'flex') { G.lastMap = G.now; drawBigMap(); }

  drawWorld();
  updateOverlay();
  drawMinimap();
  tickHotbar();
  tickStatus();
}

/* ---------------------------------------------------------------- início */
/* genWorld trava a thread, então a tela de carregamento precisa ser pintada antes:
   dois rAF garantem um quadro na tela; o fade sai quando o mundo já está de pé. */
const LOADING_FADE = 550; // igual à transition do #loading-screen
const LOADING_MIN = 1200; // genWorld é rápido: sem um piso a tela só piscaria
function startGame(name, voc, saved, charIdArg) {
  const tela = $('#loading-screen');
  tela.classList.remove('fade');
  tela.style.display = 'flex';
  $('#loading-msg').textContent = saved
    ? 'Acordando os bichos onde você parou…'
    : 'Cavando as cavernas e povoando o abismo…';
  fadeMusicaMenu();                   // a trilha do menu sai enquanto o mundo sobe
  const t0 = performance.now();
  let feito = false;
  const construir = () => {
    if (feito) return;
    feito = true;
    if (charIdArg) { ACTIVE_CHARACTER_ID = charIdArg; localStorage.setItem(ACTIVE_CHARACTER_KEY, charIdArg); }
    const canvas = $('#c');
    const seed = saved ? saved.seed : (Math.random() * 1e9) | 0;
    genWorld(seed);
    resizeCam(canvas);
    finishStart(canvas, saved, name, voc);
    setTimeout(() => {
      tela.classList.add('fade');
      setTimeout(() => tela.style.display = 'none', LOADING_FADE);
    }, Math.max(0, LOADING_MIN - (performance.now() - t0)));
  };
  requestAnimationFrame(() => requestAnimationFrame(construir));
  setTimeout(construir, 120); // rAF não roda em aba sem renderização; o timer garante a partida
}
/* Devolve o mundo vivo do save. A ordem importa: primeiro os mortos, senão o
   refreshSpawns lá embaixo repovoaria justamente o que você limpou antes de sair;
   depois os vivos, cada um no lugar e na vida em que estava — quem tinha se
   afastado do próprio spawn continua onde tinha chegado.
   Respawn pendente que já venceu enquanto o jogo estava fechado simplesmente não
   entra: o bicho voltou nesse meio-tempo, que é o comportamento certo. */
function restaurarBichos(saved) {
  const agora = Date.now();
  for (const [i, ate] of saved.mortos || [])
    if (WORLD.spawns[i] && ate > agora) WORLD.spawns[i].dead = ate;
  // antes de qualquer spawnMob: é o `sp.el` que decide a definição do bicho
  for (const [i, el] of saved.elites || [])
    if (WORLD.spawns[i] && ELITES[el]) WORLD.spawns[i].el = el;
  for (const o of saved.mobs || []) {
    const sp = WORLD.spawns[o.i];
    if (!sp || sp.live || !MONSTERS[sp.m] || !isWalkable(o.x, o.y, sp.z)) continue;
    const m = spawnMob(sp);
    m.x = m.px = o.x; m.y = m.py = o.y;
    m.hp = Math.min(m.maxhp, Math.max(1, o.hp));
  }
}
function finishStart(canvas, saved, name, voc) {
  buildMinimaps();
  showScreen(null);

  if (saved) {
    P = saved.p; P.buffs = {}; P.cd = {}; P.nextStep = P.nextAtk = 0;
    P.best = P.best || {}; P.charm = P.charm || 0; P.charms = P.charms || {};
    P.stance = P.stance || 'bal'; if (P.follow === undefined) P.follow = true; P.seen = P.seen || {};
    delete P.say;
    G.corpses = saved.corpses || [];
    G.drops = saved.drops || [];
    restaurarBichos(saved);
    recalc();
  }
  else newPlayer(name, voc);

  $('#floor-label').textContent = FLOOR_NAMES[P.z];
  G.noite = ehNoite();
  G.chuva = climaAgora(SURF).chuva > 0;
  refreshSpawns(true);
  bindInput(canvas);
  bindMiniMap($('#minimap'));
  resizeCam(canvas);
  renderAll();
  afterStep();
  ambience(P.z);
  log(`Bem-vindo a Thaira, ${P.name}. Pressione H para ver os comandos.`, 'good');
  G.started = true;
  // Personagem novo entra no mundo já persistido; não depende do autosave.
  save();
  requestAnimationFrame(frame);
}

/* ---------------------------------------------------------------- menus */
/* as três telas de entrada se revezam; passar null esconde todas (o jogo começou).
   A lista fica de fora do seletor .screen porque #death-screen também é .screen. */
const ENTRY_SCREENS = ['home-screen', 'menu-screen', 'create-screen'];
function showScreen(id) {
  ENTRY_SCREENS.forEach(s => $('#' + s).style.display = s === id ? 'flex' : 'none');
  $('#home-audio').style.display = id ? 'flex' : 'none';
}

/* a trilha do menu só pode começar depois de um gesto do usuário (política de
   autoplay), então quem chama é o primeiro clique/tecla da página */
function tocarMusicaMenu() {
  // `style.display` é vazio antes do primeiro showScreen: no boot a home vem só do CSS
  if (!G.started) musicaMenu();
}

function showHome() { showScreen('home-screen'); }

function showMenu() {
  showScreen('menu-screen');
  renderCharacterSelection();
}

function showCreate() {
  showScreen('create-screen');
  $('#name-input').value = '';
  vocIndex = 0;
  renderVoc();
  setTimeout(() => $('#name-input').focus(), 0);
}

let selectedCharacterId = null;
let vocKeys = Object.keys(VOCATIONS);
let vocIndex = 0;

/* confirmação no lugar do confirm() do navegador; Esc/backdrop = cancelar */
function askConfirm(titulo, msg, okLabel = 'Confirmar', soOk = false) {
  const d = $('#confirm-dlg');
  $('#confirm-title').textContent = titulo;
  $('#confirm-msg').textContent = msg;
  $('#confirm-ok').textContent = okLabel;
  $('#confirm-cancel').style.display = soOk ? 'none' : '';   // soOk = só avisar
  $('#confirm-ok').classList.toggle('danger', !soOk);        // aviso não é ação de risco
  d.showModal();
  return new Promise(r => {
    const fim = v => { d.oncancel = null; d.close(); r(v); };
    $('#confirm-ok').onclick = () => fim(true);
    $('#confirm-cancel').onclick = () => fim(false);
    d.oncancel = () => fim(false); // Esc
  });
}

function renderCharacterSelection() {
  const box = $('#character-list');
  box.innerHTML = '';
  const chars = listCharacters();
  const active = localStorage.getItem(ACTIVE_CHARACTER_KEY);
  selectedCharacterId = chars.some(x => x.id === active) ? active : (chars[0]?.id || null);

  if (!chars.length) {
    const empty = document.createElement('div');
    empty.className = 'character-empty';
    empty.textContent = 'Nenhum personagem por aqui. O nível 8 chega rápido; o 50, nem tanto.';
    box.appendChild(empty);
  } else {
    chars.forEach(({ id, d }) => {
      const p = d.p, v = VOCATIONS[p.voc] || VOCATIONS.knight;
      const card = document.createElement('div');
      card.className = 'character-card' + (id === selectedCharacterId ? ' sel' : '');
      card.style.setProperty('--voc', v.color);
      card.style.setProperty('--voc-glow', v.color + '55');
      card.innerHTML = `<div class="character-portrait">
          <div class="character-voc-icon">${v.emoji}</div>
          <b class="character-lvl"></b>
        </div>
        <div class="character-info"><strong></strong><span></span><small></small></div>
        <div class="character-enter">JOGAR ›</div>
        <button class="character-del" title="Excluir personagem">✕</button>`;
      card.querySelector('strong').textContent = p.name;
      card.querySelector('.character-lvl').textContent = p.level || 1;
      card.querySelector('span').textContent = v.name;
      card.querySelector('small').textContent = `${p.kills || 0} criaturas derrotadas`;
      card.onclick = () => { selectedCharacterId = id; playSelectedCharacter(); };
      card.querySelector('.character-del').onclick = async e => {
        e.stopPropagation();
        const ok = await askConfirm('Excluir personagem',
          `${p.name}, nível ${p.level || 1}. O save some para sempre — não dá para desfazer.`, 'Excluir');
        if (!ok) return;
        deleteCharacter(id);
        renderCharacterSelection();
      };
      box.appendChild(card);
    });
  }
}

/* Export/import do baú inteiro: o localStorage é por origem, então trocar de
   endereço (file://, localhost, site, app) deixa os saves para trás sem isto. */
function exportarPersonagens() {
  const chars = readCharacters();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(chars)], { type: 'application/json' }));
  a.download = `thaira-personagens-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* Arquivo é entrada não confiável: só entra quem passa pelo fixSave e tem nome.
   Id repetido não sobrescreve o personagem de casa — o de fora ganha id novo. */
async function importarPersonagens(file) {
  let vindo = null;
  try { vindo = JSON.parse(await file.text()); } catch (e) { /* json torto */ }
  if (!vindo || typeof vindo !== 'object' || Array.isArray(vindo))
    return askConfirm('Arquivo inválido', 'Esse arquivo não é um backup de personagens do Thaira.', 'Entendi', true);
  const chars = readCharacters();
  let n = 0;
  for (const [id, d] of Object.entries(vindo)) {
    const ok = fixSave(d);
    if (!ok || !ok.p || !ok.p.name) continue;
    chars[chars[id] ? charId() : id] = d;
    n++;
  }
  writeCharacters(chars);
  renderCharacterSelection();
  askConfirm('Importação', n ? `${n} personagem(ns) adicionado(s).` : 'Nenhum personagem válido no arquivo.', 'Fechar', true);
}

function playSelectedCharacter() {
  if (!selectedCharacterId) return;
  const saved = loadCharacter(selectedCharacterId);
  if (saved) startGame(null, null, saved, selectedCharacterId);
}

/* os cards são só a arte de assets/vocations/<chave>.png — moldura e nome já vêm nela */
function renderVocGrid() {
  const box = $('#voc-grid');
  box.innerHTML = '';
  vocKeys.forEach((k, i) => {
    const v = VOCATIONS[k];
    const card = document.createElement('button');
    card.className = 'voc-card';
    card.style.setProperty('--voc', v.art);
    card.style.backgroundImage = `url("assets/vocations/card/${k}.png")`;
    card.setAttribute('aria-label', v.name);
    card.onclick = () => { vocIndex = i; renderVoc(); };
    card.ondblclick = () => $('#create-character-btn').click();
    box.appendChild(card);
  });
  renderVoc();
}

function renderVoc() {
  const v = VOCATIONS[vocKeys[vocIndex]];
  $('#voc-grid').querySelectorAll('.voc-card').forEach((c, i) => c.classList.toggle('sel', i === vocIndex));
  $('#voc-emblem').innerHTML = v.emoji;
  $('#voc-current-name').textContent = v.name;
  $('#voc-current-desc').textContent = v.desc;
  $('#voc-tags').innerHTML = v.tags.map(t => `<span>${t}</span>`).join('');
  $('#voc-hp').textContent = '+' + v.hp;
  $('#voc-mana').textContent = '+' + v.mana;
  $('#voc-hpreg').textContent = v.hpReg;
  $('#voc-mpreg').textContent = v.mpReg;
  $('.voc-info').style.setProperty('--voc', v.art);
}

function cycleVoc(delta) {
  vocIndex = (vocIndex + delta + vocKeys.length) % vocKeys.length;
  renderVoc();
}

addEventListener('DOMContentLoaded', () => {
  $('#loot-all').onclick = lootAll;
  $('#loot-close').onclick = () => { $('#loot-win').style.display = 'none'; G.lootOpen = null; };
  $('#respawn-btn').onclick = respawn;
  $('#shop-btn').onclick = () => { $('#shop-win').style.display = 'flex'; renderShop(); };
  $('#shop-close').onclick = () => $('#shop-win').style.display = 'none';
  $('#help-close').onclick = () => $('#help').style.display = 'none';
  $('#pick-close').onclick = () => $('#pick-win').style.display = 'none';
  document.querySelectorAll('#stance button').forEach(b => b.onclick = () => setStance(b.dataset.s));
  $('#follow-btn').onclick = () => { P.follow = !P.follow; if (!P.follow) G.path = []; renderStance(); };
  /* recarregar é a saída honesta: P, G, WORLD e os listeners do jogo são globais,
     desmontar tudo à mão daria muito mais código do que um boot limpo */
  $('#logout-btn').onclick = async () => {
    if (!await askConfirm('Sair para a tela inicial',
      'Seu personagem é salvo agora e você volta para o menu.', 'Sair')) return;
    save();
    // mesma tela da entrada, só que entrando em fade: começa transparente, o
    // reflow deixa a transição valer e o reload acontece com ela já cheia
    const tela = $('#loading-screen');
    $('#loading-msg').textContent = 'Guardando sua jornada…';
    tela.style.display = 'flex';
    tela.classList.add('fade');
    void tela.offsetWidth;
    tela.classList.remove('fade');
    setTimeout(() => location.reload(), LOADING_FADE + 450);
  };
  $('#mute-btn').onclick = () => {
    const ligado = audioToggle();
    $('#mute-btn').innerHTML = `<img class="im" src="assets/icons/ui_sound_${ligado ? 'on' : 'off'}.png" alt="">`;
    $('#mute-btn').classList.toggle('on', !!ligado);
  };
  // nome e explicação de cada indicador moram no data- do próprio elemento
  document.querySelectorAll('#combat-stats .cst').forEach(c => {
    c.onmouseenter = e => tipEm(e, `<b>${c.dataset.n}</b><div class="dim">${c.dataset.d}</div>`);
    c.onmouseleave = hideTip;
  });

  /* mudo = volume da música em 0; o valor anterior volta ao desmutar */
  const vol = $('#home-vol'), semSom = () => +vol.value === 0;
  let ultimoVol = Math.round((audioVols().musica || .6) * 100) || 60;
  const syncVol = () => {
    $('#home-audio').classList.toggle('mudo', semSom());
    $('#home-mute img').src = `assets/icons/ui_sound_${semSom() ? 'off' : 'on'}.png`;
  };
  vol.value = ultimoVol; syncVol();
  vol.oninput = () => { audioVol('musica', +vol.value / 100); if (!semSom()) ultimoVol = +vol.value; syncVol(); };
  $('#home-mute').onclick = () => { vol.value = semSom() ? ultimoVol : 0; vol.oninput(); };

  $('#home-select-btn').onclick = showMenu;
  $('#home-create-btn').onclick = showCreate;
  $('#menu-back').onclick = showHome;
  $('#export-btn').onclick = exportarPersonagens;
  $('#import-btn').onclick = () => $('#import-file').click();
  $('#import-file').onchange = e => {
    const f = e.target.files[0];
    e.target.value = '';                 // escolher o mesmo arquivo de novo dispara change
    if (f) importarPersonagens(f);
  };
  $('#create-cancel').onclick = showHome;
  $('#create-character-btn').onclick = () => {
    const name = $('#name-input').value.trim();
    if (!name) { $('#name-input').focus(); return; }
    const id = charId();
    ACTIVE_CHARACTER_ID = id;
    localStorage.setItem(ACTIVE_CHARACTER_KEY, id);
    startGame(name, vocKeys[vocIndex], null, id);
  };
  $('#name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') $('#create-character-btn').click();
    if (e.key === 'Escape') showHome();
  });
  addEventListener('keydown', e => {
    if ($('#create-screen').style.display === 'flex') {
      if (e.key === 'ArrowLeft') cycleVoc(-1);
      else if (e.key === 'ArrowRight') cycleVoc(1);
      else if (e.key === 'Escape') showHome();  // a seta de voltar saiu; Esc é a saída pelo teclado
    } else if ($('#menu-screen').style.display === 'flex' && e.key === 'Escape') showHome();
  });

  renderVocGrid();
  prepararMusicaMenu();               // baixa a trilha do menu enquanto a home aparece
  addEventListener('pointerdown', tocarMusicaMenu, { once: true });
  addEventListener('keydown', tocarMusicaMenu, { once: true });
});

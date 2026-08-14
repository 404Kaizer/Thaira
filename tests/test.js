/* test.js — self-check do jogo em node (sem browser).
   Roda com:  node tests/test.js
   Carrega data/world/game com stubs mínimos de THREE e DOM e verifica a lógica
   que quebra silenciosamente: geração do mapa, pares de escada, pathfinding,
   fórmulas de progressão, afixos e o ciclo dano->morte->loot->exp. */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');

/* ---- stubs -------------------------------------------------------------- */
const vec = () => ({ x: 0, y: 0, z: 0, set() { return this }, setScalar() { return this }, project() { return this } });
const chain = () => new Proxy(function () { }, { get: () => chain(), apply: () => chain() });
/* qualquer método desconhecido de THREE vira no-op encadeável */
class Any {
  constructor() {
    this.x = 0; this.y = 0; this.z = 0; this.visible = true; this.intensity = 0; this.distance = 0;
    this.position = vec(); this.scale = vec(); this.rotation = vec(); this.userData = {};
    this.material = { dispose() { }, opacity: 1 }; this.geometry = { dispose() { } };
    this.instanceMatrix = {}; this.instanceColor = {}; this.domElement = { clientWidth: 1200, clientHeight: 800 };
    return new Proxy(this, { get: (t, k) => k in t ? t[k] : chain() });
  }
}
const THREE = new Proxy({}, {
  get: (t, k) => k === 'Color'
    ? class { constructor(c) { this.c = c } getHex() { return 0xffffff } setHex() { return this } multiplyScalar() { return this } setScalar() { return this } }
    : Any
});

const els = new Map();
/* parser bobo de innerHTML: só o suficiente p/ firstChild/lastChild funcionarem */
const VOID = /^(?:img|br|hr|input|source|meta|link)$/i;   // sem tag de fecho
function parseChildren(html) {
  const kids = [], re = /<(\/?)(\w+)[^>]*?>/g;
  let m, depth = 0, start = 0, tag = null;
  while ((m = re.exec(html))) {
    if (m[1] === '/') {
      if (--depth === 0) { const el = fakeEl(); el.tag = tag; el.innerHTML = html.slice(start, m.index); kids.push(el); }
    } else if (VOID.test(m[2])) {
      /* void não abre nível: sem isso ele engole o resto e some com os irmãos */
      if (depth === 0) { const el = fakeEl(); el.tag = m[2]; kids.push(el); }
    } else {
      if (depth === 0) { tag = m[2]; start = re.lastIndex; }
      depth++;
    }
  }
  return kids;
}
/* contexto 2D falso: create/getImageData devolvem buffer real, o resto é no-op
   encadeável. getImageData tem de ser buffer também — as máscaras de borda leem
   o alfa que acabaram de pintar, e um proxy encadeável explode na divisão. */
const ctx2d = () => new Proxy({
  imageSmoothingEnabled: false, fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) })
}, { get: (t, k) => k in t ? t[k] : chain(), set: (t, k, v) => (t[k] = v, true) });
function fakeEl() {
  const el = {
    style: {}, dataset: {}, children: [], className: '', textContent: '', title: '', value: '',
    width: 170, height: 170, offsetHeight: 100, tagName: 'DIV',
    /* truthy = elemento visível. Vira null quando sai do documento ou quando um
       ancestral esconde — é assim que o navegador se comporta, e o tooltip usa
       isso para saber que o dono sumiu. Um teste pode zerar para simular. */
    offsetParent: {},
    classList: { add() { }, remove() { }, toggle() { } },
    get firstChild() { return this.children[0] || null },
    get lastChild() { return this.children[this.children.length - 1] || null },
    appendChild(c) { if (c.parent) c.parent.removeChild(c); c.parent = this; this.children.push(c); return c },
    insertBefore(c, ref) { c.parent = this; this.children.unshift(c); return c },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parent = null; } },
    // remove() precisa desanexar de verdade: código que faz `while (n) el.firstChild.remove()`
    // entra em laço infinito se o stub mentir
    remove() { if (this.parent) this.parent.removeChild(this); },
    addEventListener() { }, focus() { }, blur() { }, getContext: ctx2d,
    querySelector() { return fakeEl() }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 })
  };
  Object.defineProperty(el, 'innerHTML', {
    get() { return el._h || '' },
    set(v) { el._h = v; el.children = v ? parseChildren(v) : []; }
  });
  return el;
}
const document = {
  querySelector: s => els.get(s) || (els.set(s, fakeEl()), els.get(s)),
  querySelectorAll: () => [], createElement: () => fakeEl(), addEventListener() { }
};
const sandbox = {
  THREE, document, console, Math, Date, JSON, performance: { now: () => 0 },
  addEventListener() { }, requestAnimationFrame() { }, setTimeout() { },
  localStorage: (m => ({ getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }))(new Map()),
  /* sem rede aqui: a imagem nunca fica pronta, que é justamente o caminho de
     fallback que ícone de item e folha do ranger têm de saber percorrer */
  Image: class { constructor() { this.complete = false; this.naturalWidth = 0; this.src = ''; } },
  innerWidth: 1200, innerHeight: 800, devicePixelRatio: 1
};
sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);
for (const f of ['audio.js', 'icones.js', 'data.js', 'art.js', 'world.js', 'render2d.js', 'game.js', 'ui.js', 'hud.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx, { filename: f });

// expõe os bindings léxicos (let/const de script) para o runner
vm.runInContext(`
  Object.assign(globalThis, { genWorld, findPath, WORLD, T, TILE, isWalkable, tileAt, W, H, FLOORS, SURF, distT,
    ITEMS, MONSTERS, SPELLS, VOCATIONS, SHOP_STOCK, PREFIXES, SUFFIXES, RARITY, XP_MULT,
    expForLevel, triesFor, manaForML, SKILL_RATE, mkItem, itemStats, newPlayer, dealDamage, weaponInfo,
    damageFormula, skillOf, recalc, G, creatureSprite, TEX_DRAW, tileTexture, decoSprite, buildMinimaps, drawWorld, w2s,
    corDoCeu, ehNoite, ambienteAgora, climaAgora, souCoberto, FLOOR_AMBIENCE, silhouette, edgeShadow, cloudTexture,
    TERRAIN_PRIO, edgeMask, _mulberry, RANGER_DIR, SHEET_POS, rangerSprite,
    SANGUE_CLASSE, SANGUE_PADRAO, SANGUE_MAX, bloodSpray, plateAnchor, resizeCam, CAM,
    itemCell, showTip, hideTip, tipCheck,
    HUNTS, huntAt, BEST_DIFF, MOB_META, bestStage, bestiaryKill, bestKills, toggleCharm, spawnCorpse, CHARM_COST, CHARM_BONUS,
    STANCE, HOT_SLOTS, useItem, castSpell, stepPlayer, hitPlayer, hotEntry, notify, updateMobs, clickTile,
    regenMobs, descLoot, save, load, changeFloor, spawnDrop, tryStep, spawnMob, removeMob, restaurarBichos,
    habilidade, impacto, cssColOu: cssCol, ELEM, RES, resistOf,
    ELITES, ELITE_CHANCE, defModificada, mixCol, SETS,
    HUD_PANELS, HUD_DEF, hudApply, hudMove, hudLoad, luzCarregada, SLOT_POS, SLOT_LABEL, equipItem, unequip,
    getHUD: () => HUD, setHUD: v => HUD = v, getP: () => P });

  /* O templo é zona segura: lá o jogador não ataca nem é atacado. Quem for medir
     combate precisa sair de cima dele antes, senão mede a proteção, não a briga. */
  globalThis.saiDoTemplo = () => {
    for (let d = 6; d < 40; d++)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = WORLD.temple.x + dx * d, y = WORLD.temple.y + dy * d;
        if (isWalkable(x, y, SURF) && tileAt(x, y, SURF) !== T.TEMPLE &&
            isWalkable(x + 1, y, SURF) && isWalkable(x + 2, y, SURF)) {
          P.x = P.px = x; P.y = P.py = y; P.z = SURF; P.stepD = 0;
          return [x, y];
        }
      }
    throw new Error('não achei terreno livre fora do templo');
  };
`, ctx);
const S = sandbox;

/* ---- asserts ------------------------------------------------------------ */
let ok = 0, bad = 0;
const A = (cond, msg) => cond ? ok++ : (bad++, console.error('  ✗ ' + msg));
const idx = (x, y) => y * S.W + x;

/* 1. geração do mundo */
S.genWorld(20260807);
const walkCount = z => { let n = 0; for (let i = 0; i < S.W * S.H; i++) if (S.TILE[S.WORLD.floors[z].t[i]].walk) n++; return n; };
for (let z = 0; z < S.FLOORS; z++) A(walkCount(z) > 200, `andar ${z} tem chão andável (tem ${walkCount(z)})`);
A(S.TILE[S.tileAt(S.WORLD.temple.x, S.WORLD.temple.y, S.SURF)].walk, 'templo é andável');

/* 2. escadas: todo par sobe/desce casa e os dois lados são andáveis */
let pares = 0;
for (let z = 0; z < S.FLOORS; z++) {
  const t = S.WORLD.floors[z].t;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === S.T.DOWN) {
      A(z + 1 < S.FLOORS && S.WORLD.floors[z + 1].t[i] === S.T.UP, `buraco em ${z}:${i} tem escada de volta`);
      pares++;
    }
    if (t[i] === S.T.UP) A(z - 1 >= 0 && S.WORLD.floors[z - 1].t[i] === S.T.DOWN, `escada em ${z}:${i} tem buraco de volta`);
  }
}
A(pares >= 20, `mapa tem escadas suficientes (${pares})`);

/* 3. spawns válidos */
A(S.WORLD.spawns.length > 150, `mundo povoado (${S.WORLD.spawns.length} spawns)`);
A(S.WORLD.spawns.every(s => S.MONSTERS[s.m] && S.TILE[S.tileAt(s.x, s.y, s.z)].walk), 'todo spawn é monstro real em tile andável');
A([0, 1, 2, 3].every(z => S.WORLD.spawns.some(s => s.z === z)), 'todos os andares têm monstros');
A(!S.WORLD.spawns.some(s => s.z === S.SURF && S.distT(s.x, s.y, S.WORLD.temple.x, S.WORLD.temple.y) < 14), 'zona segura do templo sem spawn');

/* 4. pathfinding: caminho contíguo, andável e chegando no destino */
const tx = S.WORLD.temple.x, ty = S.WORLD.temple.y;
let alvo = null;
for (let r = 6; r < 30 && !alvo; r++)
  for (let a = 0; a < 8 && !alvo; a++) {
    const x = tx + Math.round(Math.cos(a) * r), y = ty + Math.round(Math.sin(a) * r);
    if (S.isWalkable(x, y, S.SURF)) alvo = [x, y];
  }
const p = S.findPath(tx, ty, alvo[0], alvo[1], S.SURF);
A(p && p.length, 'achou caminho até um ponto próximo');
if (p) {
  let prev = [tx, ty], contiguo = true;
  for (const step of p) {
    if (S.distT(prev[0], prev[1], step[0], step[1]) !== 1 || !S.isWalkable(step[0], step[1], S.SURF)) contiguo = false;
    prev = step;
  }
  A(contiguo, 'todo passo do caminho é adjacente e andável');
  A(prev[0] === alvo[0] && prev[1] === alvo[1], 'caminho termina no destino');
}
A(S.findPath(tx, ty, 0, 0, S.SURF) === null, 'não devolve caminho para dentro da água/borda');

/* 5. fórmulas de progressão */
A(S.expForLevel(2) === 100 && S.expForLevel(1) === 0, 'curva de exp bate com a do Tibia');
let cresce = true;
for (let l = 2; l < 60; l++) if (S.expForLevel(l + 1) <= S.expForLevel(l)) cresce = false;
A(cresce, 'exp por nível é sempre crescente');
A(S.triesFor('sword', 20, 'knight') < S.triesFor('sword', 20, 'sorcerer'), 'cavaleiro sobe espada mais rápido que feiticeiro');
A(S.triesFor('sword', 30, 'knight') > S.triesFor('sword', 20, 'knight'), 'cada nível de skill custa mais que o anterior');
A(S.manaForML(5, 'sorcerer') < S.manaForML(5, 'knight'), 'feiticeiro sobe magic level mais rápido');

/* 6. integridade das tabelas */
const idsLoot = new Set();
for (const m of Object.values(S.MONSTERS)) m.loot.forEach(l => idsLoot.add(l[0]));
A([...idsLoot].every(id => S.ITEMS[id]), 'todo item de loot existe: ' + [...idsLoot].filter(id => !S.ITEMS[id]));
A(S.SHOP_STOCK.every(id => S.ITEMS[id]), 'todo item da loja existe');
A(S.SPELLS.every(s => s.voc.every(v => S.VOCATIONS[v])), 'magias referenciam vocações válidas');
A(Object.keys(S.VOCATIONS).every(v => S.SPELLS.some(s => s.voc.includes(v) && s.type !== 'buff')), 'toda vocação tem magia ofensiva/cura');

/* 7. itens e afixos */
const raro = S.mkItem('sword', 3);
A(raro.af.length === 3, 'raridade épica gera 3 afixos');
const st = S.itemStats(raro);
A(st.name.includes('Espada'), 'nome composto mantém o item base: ' + st.name);
A(st.atk >= S.ITEMS.sword.atk, 'afixos nunca pioram o ataque base');
const comum = S.itemStats(S.mkItem('sword', 0));
A(comum.atk === S.ITEMS.sword.atk && comum.af === undefined, 'item comum fica igual à base');

/* 8. personagem novo */
const P = (S.newPlayer('Teste', 'knight'), S.getP());
A(P.hp === P.st.maxhp && P.mana === P.st.maxmana, 'nasce com vida/mana cheias');
A(P.eq.weapon && P.eq.armor, 'nasce equipado');
A(P.st.arm > 0, 'armadura inicial conta nos stats');
A(P.bag.some(i => i.id === 'health_potion'), 'nasce com poções');
const atkAntes = S.weaponInfo().atk;
S.dealDamage; // no-op p/ manter referência

/* 9. equipar melhora o ataque */
const espada = S.mkItem('knight_sword', 0);
P.level = 30; S.recalc();
const eq = vm.runInContext('equipItem', ctx);
eq(espada);
A(S.weaponInfo().atk > atkAntes, 'arma melhor aumenta o ataque');

/* 10. ciclo de combate: dano -> morte -> exp -> corpo com loot */
const dummy = {
  uid: 999, id: 'rat', def: S.MONSTERS.dragon, n: 'Dragão', hp: 700, maxhp: 700,
  x: P.x + 1, y: P.y, z: P.z, px: P.x + 1, py: P.y, sp: {}
};
S.G.mobs.push(dummy);
const expAntes = P.exp, corposAntes = S.G.corpses.length;
let golpes = 0;
while (dummy.hp > 0 && golpes < 500) { S.dealDamage(dummy, S.damageFormula(50, 60)); golpes++; }
A(golpes < 500, `dragão morre em tempo finito (${golpes} golpes)`);
A(P.exp > expAntes, 'matar dá experiência');
A(S.G.corpses.length === corposAntes + 1, 'deixa um corpo');
A(!S.G.mobs.includes(dummy), 'monstro morto sai da lista');
const corpo = S.G.corpses[S.G.corpses.length - 1];
A(corpo.items.every(i => S.ITEMS[i.id]), 'loot gerado é válido');

/* 11. dano cresce com skill e com arma (média, não uma amostra) */
const media = (atk, sk) => { let s = 0; for (let i = 0; i < 400; i++) s += S.damageFormula(atk, sk); return s / 400; };
A(media(16, 80) > media(16, 10) * 3, 'skill alta bate muito mais forte');
A(media(45, 40) > media(16, 40), 'arma melhor bate mais forte');

/* 12. caminho de render/UI: monta a cena e roda o loop (pega typo/undefined) */
let erro = null;
try {
  vm.runInContext(`
    resizeCam(document.querySelector('#c'));
    buildMinimaps();
    renderAll();
    G.started = true;
    for (let i = 1; i <= 60; i++) frame(i * 16);
    G.walkDir = [1, 0];
    for (let i = 61; i <= 200; i++) frame(i * 16);
  `, ctx);
} catch (e) { erro = e; }
A(!erro, 'cena + 200 frames sem erro →\n' + (erro && erro.stack));
A(S.G.mobs.length > 0, `monstros nasceram perto do jogador (${S.G.mobs.length})`);
A(getComputed(), 'jogador andou com o teclado');
function getComputed() { const p = S.getP(); return p.x !== S.WORLD.temple.x || p.px !== S.WORLD.temple.x; }

/* 13. combate completo pela UI: mira, ataca, magia */
let erro2 = null;
try {
  vm.runInContext(`
    G.walkDir = null;
    G.target = G.mobs[0];
    for (let i = 201; i <= 400; i++) { P.nextAtk = 0; frame(i * 16); }
    for (const id of ['exura', 'exori', 'exori_hur', 'utamo_vita', 'utani_hur']) {
      P.cd = {}; P.mana = P.st.maxmana;              // sem esperar cooldown/mana no teste
      castSpell(SPELLS.find(s => s.id === id));
    }
    hitPlayer(20, 'teste');
    save();
  `, ctx);
} catch (e) { erro2 = e; }
A(!erro2, 'ataque + magias + dano recebido sem erro →\n' + (erro2 && erro2.stack));
A(S.getP().buffs.haste, 'buff de pressa fica ativo');
A(S.getP().st.speed > 220 + (S.getP().level - 1) * 2, 'pressa aumenta a velocidade de fato');

/* 14. morte e renascimento (repete: um golpe pode ser bloqueado pelo escudo) */
vm.runInContext('for (let i = 0; i < 60 && !G.dead; i++) hitPlayer(999999, "teste");', ctx);
A(S.G.dead, 'jogador morre quando a vida zera');
vm.runInContext('respawn();', ctx);
A(!S.G.dead && S.getP().hp === S.getP().st.maxhp && S.getP().z === S.SURF, 'renasce no templo com vida cheia');

/* 15. skills sobem LUTANDO (o teste 10 chamava dealDamage direto e não pegava isto) */
let erro3 = null;
try {
  vm.runInContext(`
    WORLD.spawns.forEach(s => s.dead = 1e12);        // sem interferência: só o boneco de treino
    G.mobs.slice().forEach(m => removeMob(m, false));
    newPlayer('Treino', 'knight');
    saiDoTemplo();                                   // no templo não se bate: é zona segura
    G.walkDir = null; G.path = []; G.dead = false;
    const alvo = {
      uid: 1000, id: 'rat', n: 'Boneco', hp: 1e9, maxhp: 1e9, chase: true,
      def: Object.assign({}, MONSTERS.rat, { hp: 1e9, exp: 0, arm: 0, atk: [0, 0] }),
      x: P.x + 1, y: P.y, z: P.z, px: P.x + 1, py: P.y, sp: {}, nextAtk: 0, nextStep: 0
    };
    G.mobs.push(alvo); G.target = alvo; G.started = true;
    for (let t = 1e5; t < 1e5 + 120000; t += 50) { alvo.x = P.x + 1; alvo.y = P.y; frame(t); }
  `, ctx);
} catch (e) { erro3 = e; }
const T2 = S.getP();
A(!erro3, 'treino de 2 min sem erro →\n' + (erro3 && erro3.stack));
A(T2.sk.sword.l > 10, `espada sobe batendo (chegou a ${T2.sk.sword.l} em 2 min)`);
A(T2.sk.shielding.l > 10, `escudo sobe apanhando (chegou a ${T2.sk.shielding.l})`);
A(S.triesFor('sword', 10, 'knight') === Math.ceil(50 / S.SKILL_RATE), 'SKILL_RATE realmente encurta a curva');

/* 16. mago que só ataca de varinha também evolui (magic level) */
vm.runInContext(`
  newPlayer('Mago', 'sorcerer');
  saiDoTemplo();                                     // zona segura não deixa atacar
  G.mobs.slice().forEach(m => removeMob(m, false));
  const alvo2 = {
    uid: 1001, id: 'rat', n: 'Boneco', hp: 1e9, maxhp: 1e9, chase: false, nextAtk: 1e12, nextStep: 1e12,
    def: Object.assign({}, MONSTERS.rat, { hp: 1e9, exp: 0, arm: 0, atk: [0, 0] }),
    x: P.x + 2, y: P.y, z: P.z, px: P.x + 2, py: P.y, sp: {}
  };
  G.mobs.push(alvo2); G.target = alvo2; G.walkDir = null; G.path = []; G.dead = false;
  for (let t = 3e5; t < 3e5 + 120000; t += 50) { alvo2.x = P.x + 2; alvo2.y = P.y; frame(t); }
`, ctx);
A(S.getP().ml.l > 0, `varinha treina magic level (chegou a ${S.getP().ml.l} em 2 min)`);

/* 17. loot: cada linha rola sozinha, então a quantidade de itens varia por morte */
vm.runInContext(`
  globalThis.sellPrice = sellPrice;
  globalThis.amostraLoot = (id, n) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      killMob({ uid: 5e3 + i, id, def: MONSTERS[id], n: MONSTERS[id].n, hp: 0, maxhp: 1,
                x: P.x, y: P.y, z: P.z, sp: {} });
      out.push(G.corpses[G.corpses.length - 1].items);
    }
    G.corpses.length = 0;
    return out;
  };
`, ctx);
const drops = S.amostraLoot('dragon', 1500);   // amostra grande: 500 dava falha aleatória
const tam = drops.map(d => d.length), medio = tam.reduce((a, b) => a + b, 0) / tam.length;
A(Math.min(...tam) <= 1, 'às vezes o monstro larga quase nada');
A(Math.max(...tam) >= 4, `às vezes larga meia lista de uma vez (máx ${Math.max(...tam)})`);
A(medio > 1.5 && medio < 6, `média de itens por morte é sensata (${medio.toFixed(1)})`);
const todos = drops.flat();
A(todos.some(i => i.count > 1 && i.id !== 'gold'), 'empilhável cai em quantidade (2 escamas, 5 flechas…)');
A(todos.some(i => S.ITEMS[i.id].slot), 'equipamento aparece no loot');
A(todos.some(i => i.id === 'dragon_scale'), 'parte do corpo aparece no loot');
A(todos.some(i => i.r > 0), 'equipamento dropado às vezes vem com afixo');
A(drops.filter(d => d.some(i => i.id === 'gold')).length / drops.length > 0.94, 'dragão larga ouro em ~98% das mortes');
A([1, 2, 3, 4].every(r => S.mkItem('sword', r).af.length === r), 'item nasce com exatamente os afixos da raridade');
A(todos.every(i => i.id === 'gold' || S.sellPrice(i) > 0), 'tudo que cai tem valor de venda');
A(Object.values(S.MONSTERS).every(m => m.loot.length >= 4), 'todo monstro tem lista de loot variada');
A(Object.values(S.MONSTERS).every(m => m.loot.every(([id]) =>
  id === 'gold' || S.ITEMS[id].slot || S.ITEMS[id].use || S.ITEMS[id].sell)), 'nenhum item de loot é inútil');

/* 17b. conjunto: os degraus acendem por peça vestida, e o set do Guardião
   Dourado só cai de anão — as duas coisas quebram em silêncio, porque item com
   `set` errado continua equipando normalmente e ninguém vê o bônus faltar. */
{
  const gg = ['gg_helmet', 'gg_armor', 'gg_legs', 'gg_boots', 'gg_shield', 'gg_amulet', 'gg_ring', 'gg_sword'];
  vm.runInContext(`newPlayer('Set', 'knight'); P.level = 40; for (const k in P.eq) P.eq[k] = null; recalc();`, ctx);
  const p = S.getP(), eqp = vm.runInContext('equipItem', ctx);
  const arm = [], hp = [];
  for (const id of gg) { eqp(S.mkItem(id, 0), true); arm.push(p.st.arm); hp.push(p.st.maxhp); }
  A(arm[0] === S.ITEMS.gg_helmet.arm, 'uma peça só do conjunto não dá bônus de conjunto');
  A(arm[1] === S.ITEMS.gg_helmet.arm + S.ITEMS.gg_armor.arm + 2, 'a segunda peça acende o degrau de 2 (+2 armadura)');
  A(hp[7] - hp[6] === 80, 'a oitava peça acende o degrau do conjunto completo (+80 vida)');
  A(p.st.lifesteal === .05 && p.st.speed > 0, 'conjunto completo dá o roubo de vida do último degrau');
  vm.runInContext(`for (const k in P.eq) P.eq[k] = null; recalc();`, ctx);
  A(p.st.lifesteal === 0, 'tirar as peças apaga o bônus de conjunto');

  const donos = Object.entries(S.MONSTERS).filter(([, m]) => m.loot.some(([id]) => S.ITEMS[id].set === 'gg'));
  A(donos.length && donos.every(([id]) => id.startsWith('dwarf')), 'set do Guardião Dourado só cai de anão: ' + donos.map(d => d[0]));
  const caem = new Set(donos.flatMap(([, m]) => m.loot.map(([id]) => id)).filter(id => S.ITEMS[id].set === 'gg'));
  A(Object.values(S.ITEMS).filter(i => i.set === 'gg').every(i => caem.has(i.id)), 'toda peça do conjunto tem de onde cair');
}

/* 18. camada de arte: forma válida e boneco montado para todo monstro */
const SHAPES = ['biped', 'quadruped', 'arachnid', 'serpent', 'worm', 'dragon'];
A(Object.values(S.MONSTERS).every(m => !m.shape || SHAPES.includes(m.shape)),
  'nenhuma forma de monstro escrita errada: ' + [...new Set(Object.values(S.MONSTERS).map(m => m.shape))].filter(x => x && !SHAPES.includes(x)));
/* 4 direções x 3 quadros: o sprite tem de sair com tamanho > 0 em todas */
A(Object.values(S.MONSTERS).every(m => [0, 1, 2, 3].every(d => [0, 1, 2].every(f => {
  const c = S.creatureSprite(m.shape || 'biped', m.col, m.sz, m.o || {}, d, f);
  return c && c.width > 0 && c.height > 0 && c.feet > 0;
}))), 'todo monstro vira sprite nas 4 direções e 3 quadros');
A([0, 1, 2].every(k => { const d = S.decoSprite(k, 3); return d && d.width > 0 && d.feet > 0; }),
  'árvore, pedra e arbusto viram sprite');
A(Object.values(S.TILE).every(t => !t.tex || S.TEX_DRAW[t.tex]), 'todo tile texturizado tem rotina de desenho');
/* prioridade faltando não quebra nada em tempo de execução: o terreno só passa a
   valer 0 e para de fazer borda em silêncio. Por isso o alerta é aqui. */
/* Tooltip órfão: a célula some sem o mouse sair dela (pegar o item do corpo,
   fechar a janela de saque) e o mouseleave nunca chega. O balão tem de morrer
   junto com o dono, não ficar preso na tela. */
A((() => {
  const dica = S.document.querySelector('#tooltip');
  const cel = S.itemCell(S.mkItem('health_potion'), () => { });
  S.showTip({ currentTarget: cel }, S.mkItem('health_potion'));
  if (dica.style.display !== 'block') return false;      // abriu?
  S.tipCheck();
  if (dica.style.display !== 'block') return false;      // dono vivo: continua aberto
  cel.offsetParent = null;                               // célula sumiu da tela
  S.tipCheck();
  return dica.style.display === 'none';
})(), 'tooltip fecha sozinho quando a célula que o abriu some');

/* A placa é HTML por cima do canvas: tem de sair em pixel de CSS, não de canvas.
   Com dpr>1 os dois deixam de ser o mesmo número e o nome do jogador voa para a
   borda da tela — some do lugar sem quebrar nada, que é o pior tipo de defeito. */
S.G.hover = [S.getP().x + 1, S.getP().y];      // com o cursor sobre um tile: o quadro tem de sair igual
A((() => {
  const cv = S.document.querySelector('#c'), antes = S.devicePixelRatio;
  const cxDe = d => {
    S.devicePixelRatio = d;
    S.resizeCam(cv); S.drawWorld();
    return S.plateAnchor(S.getP())[0];
  };
  const r = [1, 2, 3].map(cxDe);
  S.devicePixelRatio = antes; S.resizeCam(cv); S.drawWorld();
  return r.every(x => Math.abs(x - r[0]) < 0.01);        // mesma posição em CSS nos três
})(), 'placa fica no mesmo ponto em CSS seja qual for o devicePixelRatio');

/* sangue: toda criatura tem cor definida, e o esqueleto não pode escorrer */
A(Object.values(S.MONSTERS).every(m => m.sangue && m.sangue.cor >= 0),
  'todo monstro tem sangue: ' + Object.entries(S.MONSTERS).filter(([, m]) => !m.sangue).map(([k]) => k));
A(Object.values(S.MONSTERS).filter(m => m.cls === 'Morto-vivo').every(m => m.sangue.seco) &&
  Object.values(S.MONSTERS).filter(m => m.cls === 'Inseto' || m.cls === 'Aracnídeo').every(m => !m.sangue.seco && (m.sangue.cor >> 8 & 255) > (m.sangue.cor >> 16 & 255)),
  'morto-vivo estilhaça seco, inseto/aracnídeo escorre verde');
/* o teto do acúmulo tem de segurar mesmo com morte em rajada */
A((() => {
  S.G.blood.length = 0;
  for (let i = 0; i < S.SANGUE_MAX * 3; i++) S.bloodSpray(i % 20, (i / 20) | 0, 1, S.SANGUE_PADRAO);
  const n = S.G.blood.length; S.G.blood.length = 0;
  return n <= S.SANGUE_MAX;
})(), 'manchas de sangue param no teto em vez de crescer sem fim');
A(Object.values(S.TILE).every(t => !t.tex || S.TERRAIN_PRIO[t.tex] !== undefined),
  'todo tile texturizado tem prioridade de borda: ' + Object.values(S.TILE).filter(t => t.tex && S.TERRAIN_PRIO[t.tex] === undefined).map(t => t.tex));
A([0, 1, 2, 3, 4, 5, 6, 7].every(m => S.edgeMask(m).width === 32), 'as 8 máscaras de borda saem em 32×32');
/* a folha do ranger tem linhas de 7,6,6,5: apontar para um quadro inexistente
   não estoura, só desenha a célula vazia da ponta da linha e o boneco some */
A(Object.values(S.RANGER_DIR).every(f => f.length === 3 && f.every(k => S.SHEET_POS[k])),
  'todo quadro do mapa do ranger existe na folha (3 por direção)');
A(S.rangerSprite(0, 0) === null, 'sem o PNG carregado o ranger cai no sprite procedural');
/* a costura das texturas depende disto: 9 passadas com a mesma semente têm de
   desenhar exatamente a mesma coisa, senão viram 9 texturas empilhadas */
A((() => {
  const a = S._mulberry(1234), b = S._mulberry(1234);
  for (let i = 0; i < 500; i++) if (a() !== b()) return false;
  return true;
})(), 'sorteio semeado repete a sequência (costura das texturas)');

/* 19. ciclo dia/noite: cor válida o dia inteiro, sem corte brusco, e o subsolo
   continua escuro independente da hora */
{
  const amostras = [];
  for (let i = 0; i <= 200; i++) amostras.push(S.corDoCeu(i / 200));
  A(amostras.every(c => c.length === 3 && c.every(v => v >= 0 && v <= 255)), 'cor do céu válida o dia inteiro');
  const luz = c => c[0] * .3 + c[1] * .6 + c[2] * .1;
  A(luz(S.corDoCeu(0.5)) > luz(S.corDoCeu(0)) * 2.5, 'meio-dia é bem mais claro que a madrugada');
  A(S.ehNoite(0) && !S.ehNoite(0.5) && S.ehNoite(0.9), 'madrugada e crepúsculo são noite, meio-dia não');
  let salto = 0;
  for (let i = 1; i < amostras.length; i++) salto = Math.max(salto, Math.abs(luz(amostras[i]) - luz(amostras[i - 1])));
  // o amanhecer legítimo sobe ~6 por amostra; um erro na busca do segmento daria
  // o degrau inteiro entre duas paradas do CEU, dezenas. 15 separa os dois casos.
  A(salto < 15, `céu muda sem corte brusco (maior salto ${salto.toFixed(1)})`);
  A(S.ambienteAgora(2).amb === S.FLOOR_AMBIENCE[2].amb, 'caverna ignora o relógio');
  // hora fixa: com o relógio de parede esta linha falhava sozinha ao meio-dia
  A(S.ehNoite(0) && S.ambienteAgora(1, 0).amb, 'superfície ganha ambiente quando é noite');
}

/* 19b. clima: valores sempre no intervalo, chuva de vez em quando (nem sempre,
   nem nunca) e subsolo sem céu — que é o que impede sombra de nuvem na caverna */
{
  let chovendo = 0, comSombra = 0, fora = 0;
  const n = 5000;
  for (let i = 0; i < n; i++) {
    const c = S.climaAgora(S.SURF, i * 37000);
    for (const v of [c.nublado, c.chuva, c.nuvens]) if (!(v >= 0 && v <= 1)) fora++;
    if (c.chuva > 0) chovendo++;
    if (c.nuvens > .01) comSombra++;
  }
  A(fora === 0, `clima fica em 0..1 o tempo todo (${fora} fora)`);
  A(chovendo > n * .05 && chovendo < n * .6, `chove às vezes (${(chovendo / n * 100).toFixed(0)}% do tempo)`);
  A(comSombra > n * .2, `sombra de nuvem aparece na maior parte dos dias (${(comSombra / n * 100).toFixed(0)}%)`);
  A([0, 1, 2, 3].every(z => S.FLOOR_AMBIENCE[z].amb ? S.climaAgora(z).chuva === 0 && S.climaAgora(z).nuvens === 0 : true),
    'andar sem céu não tem chuva nem sombra de nuvem');
  A(S.cloudTexture() === S.cloudTexture(), 'folha de nuvem vem do cache na segunda vez');
  /* teto: no andar 0 não existe nada por cima, e onde o andar de cima é VOID
     chove — é a mesma conta que decide se o teto é desenhado */
  A([0, 40, 80].every(d => !S.souCoberto(S.WORLD.temple.x + d % S.W, S.WORLD.temple.y, 0)),
    'andar do topo nunca está coberto');
  {
    let cob = 0, aberto = 0;
    for (let y = 0; y < S.H; y += 7) for (let x = 0; x < S.W; x += 7)
      S.souCoberto(x, y, S.SURF) ? cob++ : aberto++;
    A(aberto > cob, `a superfície é mais céu aberto que teto (${aberto} x ${cob})`);
  }
}

{
  /* silhueta e sombra de borda saem com tamanho e com pixel de verdade */
  const spr = S.creatureSprite('biped', 0x888888, 1, {}, 0, 0);
  /* a silhueta cresce de propósito, para o desfoque não ser cortado na borda. O que
   não pode mudar é onde ela cai: a folga tem de ser igual nos quatro lados e a
   âncora tem de andar junto, senão a sombra desgruda do boneco. */
{
  const sil = S.silhouette(spr), folga = (sil.width - spr.width) / 2;
  A(folga >= 0 && sil.height - spr.height === folga * 2 && sil.cx - spr.cx === folga && sil.feet - spr.feet === folga,
    `silhueta cresce igual nos 4 lados e a âncora acompanha (folga ${folga})`);
}
  A(S.silhouette(spr) === S.silhouette(spr), 'silhueta vem do cache na segunda vez');
  A(S.edgeShadow(0) !== S.edgeShadow(1), 'sombra de contato tem versão norte e oeste');
}

/* 20. velocidade por vocação: mago > druida > ranger > cavaleiro */
const vel = v => { vm.runInContext(`newPlayer('V','${v}'); P.level = 50; recalc();`, ctx); return S.getP().st.speed; };
const vs = { sorcerer: vel('sorcerer'), druid: vel('druid'), ranger: vel('ranger'), knight: vel('knight') };
A(vs.sorcerer > vs.druid && vs.druid > vs.ranger && vs.ranger > vs.knight,
  `ordem de velocidade no nível 50: ${JSON.stringify(vs)}`);
A(vs.knight > 220, 'todo mundo fica mais rápido subindo de nível');

/* 21. hunts: todas colocadas, no andar certo, sem sobrepor, e com spawn dedicado */
const H = S.WORLD.hunts;
A(H.length === S.HUNTS.length, `todas as hunts entraram no mapa (${H.length}/${S.HUNTS.length})`);
A(H.every(h => h.z === S.HUNTS.find(d => d.id === h.id).z), 'cada hunt no andar que foi definido');
A(H.every((a, i) => H.every((b, j) => i === j || a.z !== b.z || S.distT(a.x, a.y, b.x, b.y) >= a.r + b.r + 8)),
  'hunts não se sobrepõem');
A(H.every(h => S.isWalkable(h.x, h.y, h.z)), 'centro de toda hunt é andável');
A(!H.some(h => h.z === S.SURF && S.distT(h.x, h.y, S.WORLD.temple.x, S.WORLD.temple.y) < 26), 'nenhuma hunt colada no templo');
const dentro = S.WORLD.spawns.filter(sp => sp.hunt);
A(dentro.length > 60, `hunts têm respawn denso (${dentro.length} pontos)`);
A(dentro.every(sp => { const h = S.huntAt(sp.x, sp.y, sp.z); return h && (h.mobs.includes(sp.m) || sp.m === h.boss); }),
  'dentro da hunt só nasce a família dela (ou o chefe)');

/* 21b. chefes: um por hunt, no centro, e nenhum deles vaza pro mundo aberto */
const chefes = S.WORLD.spawns.filter(sp => sp.boss);
A(chefes.length === S.HUNTS.filter(h => h.boss).length, `todo chefe entrou no mapa (${chefes.length})`);
A(chefes.every(sp => S.MONSTERS[sp.m].boss && S.MONSTERS[sp.m].diff === 'boss'), 'ponto de chefe aponta pra criatura marcada como chefe');
A(chefes.every(sp => { const h = S.WORLD.hunts.find(h => h.id === sp.hunt); return h && sp.x === h.x && sp.y === h.y; }),
  'chefe fica no centro exato da hunt');
A(new Set(chefes.map(sp => sp.m)).size === chefes.length, 'nenhum chefe se repete em duas regiões');
A(!S.WORLD.spawns.some(sp => !sp.boss && S.MONSTERS[sp.m].boss), 'chefe não aparece como spawn comum');
/* chefe tem de ser um degrau acima do que mora em volta, senão é só um bicho
   com nome bonito — a régua é a criatura mais forte da própria hunt */
A(S.WORLD.hunts.every(h => {
  const b = S.MONSTERS[h.boss], maior = Math.max(...h.mobs.map(m => S.MONSTERS[m].hp));
  return b.hp > maior * 1.5 && !b.medo;
}), 'todo chefe é bem mais duro que a família dele e não foge');

/* 21c. elites: a mesma espécie com outra régua, sem virar espécie nova */
{
  const base = S.MONSTERS.orc, e = S.defModificada(base, S.ELITES[0]);
  A(e.hp > base.hp && e.exp > base.exp && e.tier > base.tier, 'elite tem mais vida, mais xp e loot melhor');
  A(e.n !== base.n && e.n.includes(base.n), `elite mantém o nome da espécie (${e.n})`);
  A(base.hp === S.MONSTERS.orc.hp && !base.plateCol, 'a definição original não é modificada no lugar');
  A(e.shape === base.shape && e.loot === base.loot, 'elite continua a mesma criatura: forma e loot da espécie');
  A(S.ELITES.every(mod => {
    const d = S.defModificada(S.MONSTERS.dragon, mod);
    return d.ranged.max > S.MONSTERS.dragon.ranged.max && d.hab.dano[1] > S.MONSTERS.dragon.hab.dano[1];
  }), 'elite escala também o tiro e a habilidade, não só o soco');
  /* quem já tem habilidade própria fica com a sua: trocar descaracteriza o bicho */
  A(S.defModificada(S.MONSTERS.cyclops, S.ELITES[3]).hab.tipo === 'area' &&
    S.defModificada(S.MONSTERS.rat, S.ELITES[3]).hab.tipo === 'area',
    'ancião dá habilidade a quem não tem e respeita a de quem tem');
  A(!S.defModificada(S.MONSTERS.rat, S.ELITES[0]).hab, 'os outros elites não inventam habilidade');
}

/* 21d. o sorteio de elite gruda no ponto de spawn, não na aparição — senão o
   mesmo orc pisca entre veterano e comum enquanto você anda pra frente e pra trás */
vm.runInContext(`
  G.mobs.length = 0;
  const spEl = { x: P.x + 3, y: P.y, z: P.z, m: 'orc', dead: 0, live: null, el: 0 };
  const el1 = spawnMob(spEl);
  removeMob(el1, false);                     // saiu de perto: some sem morrer
  const el2 = spawnMob(spEl);
  globalThis.eliteGruda = el1.n === el2.n && el1.maxhp === el2.maxhp && spEl.el === 0;
  removeMob(el2, true);                      // morreu: o próximo sorteia de novo
  globalThis.eliteRessorteia = spEl.el === undefined;
  globalThis.esperaComum = spEl.dead - Date.now();
  const spBoss = { x: P.x + 4, y: P.y, z: P.z, m: 'alpha_wolf', dead: 0, live: null, boss: true };
  const chefe = spawnMob(spBoss);
  globalThis.chefeNuncaElite = spBoss.el === -1 && chefe.n === MONSTERS.alpha_wolf.n;
  removeMob(chefe, true);
  globalThis.esperaChefe = spBoss.dead - Date.now();
  G.mobs.length = 0;
`, ctx);
A(S.eliteGruda, 'elite sobrevive ao respawn de proximidade: mesmo bicho até morrer');
A(S.eliteRessorteia, 'depois de morto, o ponto sorteia elite de novo');
A(S.chefeNuncaElite, 'chefe nunca vira elite: já é o extremo da espécie');
A(S.esperaChefe > S.esperaComum * 5, `chefe demora muito mais pra voltar (${Math.round(S.esperaChefe / 60000)}min x ${Math.round(S.esperaComum / 1000)}s)`);

/* 22. bestiário: marcos, revelação e pontos de carisma */
vm.runInContext(`newPlayer('Bes', 'knight');`, ctx);
const B = S.getP(), dRat = S.BEST_DIFF[S.MONSTERS.rat.diff];
A(S.bestStage('rat') === 0, 'criatura começa bloqueada no bestiário');
for (let i = 0; i < dRat.k[0]; i++) S.bestiaryKill('rat');
A(S.bestStage('rat') === 1, `primeiro marco em ${dRat.k[0]} mortes`);
A(B.charm === 0, 'ponto de carisma só vem no fim');
while (S.bestKills('rat') < dRat.k[2]) S.bestiaryKill('rat');
A(S.bestStage('rat') === 3, 'terceiro marco completa a entrada');
A(B.charm === dRat.cp, `entrada completa rende ${dRat.cp} ponto(s) de carisma`);
A(Object.keys(S.MONSTERS).filter(id => S.bestStage(id) === 3).length === 1, 'matar rato não desbloqueia os outros');

/* 23. carisma: custa pontos, tem limite e aumenta o dano */
B.charm = S.CHARM_COST * 5;
S.toggleCharm('rat');
A(B.charms.rat && B.charm === S.CHARM_COST * 4, 'marcar presa cobra os pontos');
const dummy2 = { uid: 77, id: 'rat', def: S.MONSTERS.rat, n: 'Rato', hp: 1e9, maxhp: 1e9, x: B.x, y: B.y, z: B.z, sp: {} };
S.G.mobs.push(dummy2);
// média de 300 golpes: crítico é aleatório, uma amostra só dava falso negativo
const bate = () => { let s = 0; for (let i = 0; i < 300; i++) { const h = dummy2.hp; S.dealDamage(dummy2, 100); s += h - dummy2.hp; } return s / 300; };
const comCharm = bate();
S.toggleCharm('rat');
const semCharm = bate();
A(comCharm > semCharm * 1.05, `presa marcada bate mais forte (${comCharm.toFixed(0)} vs ${semCharm.toFixed(0)})`);
S.G.mobs.length = 0;

/* 24. corpos empilham no mesmo tile, LIFO — o último a morrer é o topo */
vm.runInContext(`
  G.corpses.length = 0;
  spawnCorpse(P.x, P.y, P.z, 'A', []);
  spawnCorpse(P.x, P.y, P.z, 'B', []);
  spawnCorpse(P.x, P.y, P.z, 'C', []);
  globalThis.topo = corpseAt(P.x, P.y);
`, ctx);
const cs = S.G.corpses;
A(cs.length === 3 && new Set(cs.map(c => c.x + ',' + c.y)).size === 1, 'três mortes no mesmo tile empilham no mesmo lugar');
A(S.topo && S.topo.name === 'C', 'corpseAt acha o topo da pilha (o último a morrer)');

/* 25. postura de combate muda dano e defesa */
vm.runInContext(`newPlayer('Pos', 'knight'); P.level = 30; recalc();`, ctx);
const mediaDano = st => {
  vm.runInContext(`P.stance = '${st}';`, ctx);
  let s = 0; for (let i = 0; i < 400; i++) s += S.damageFormula(20, 40);
  return s / 400;
};
const dAtk = mediaDano('atk'), dBal = mediaDano('bal'), dDef = mediaDano('def');
A(dAtk > dBal && dBal > dDef, `postura muda o dano: ${dAtk.toFixed(0)}/${dBal.toFixed(0)}/${dDef.toFixed(0)}`);
// mede golpe a golpe: subir escudo chama recalc(), que corta a vida no máximo
// e estragaria a conta de uma tacada só
const apanha = st => {
  vm.runInContext(`P.stance = '${st}';`, ctx);
  let tot = 0;
  for (let i = 0; i < 400; i++) {
    vm.runInContext('P.hp = P.st.maxhp;', ctx);
    const a = S.getP().hp;
    vm.runInContext('hitPlayer(60, "t");', ctx);
    tot += a - S.getP().hp;
  }
  return tot;
};
A(apanha('def') < apanha('atk'), 'postura defensiva apanha menos');

/* 26. follow attack desligado não faz o personagem andar até o alvo */
vm.runInContext(`
  newPlayer('Fol', 'knight'); G.dead = false; G.walkDir = null; G.path = [];
  G.mobs.length = 0;
  const longe = { uid: 900, id: 'rat', def: MONSTERS.rat, n: 'Rato', hp: 50, maxhp: 50,
    x: P.x + 6, y: P.y, z: P.z, px: P.x + 6, py: P.y, sp: {}, nextAtk: 1e12, nextStep: 1e12 };
  G.mobs.push(longe); G.target = longe;
  P.follow = false; P.nextStep = 0; globalThis.x0 = P.x;
  for (let i = 0; i < 20; i++) stepPlayer();
`, ctx);
A(S.getP().x === S.x0, 'com follow desligado o personagem fica parado');
vm.runInContext('P.follow = true; P.nextStep = 0; stepPlayer();', ctx);
A(S.getP().x !== S.x0, 'com follow ligado ele anda até o alvo');

/* 27. runas: cargas, cura, dano e sumiço */
vm.runInContext(`newPlayer('Run', 'sorcerer'); P.level = 30; recalc(); P.hp = 10;`, ctx);
const R = S.getP();
const runaCura = S.mkItem('rune_ih');
A(runaCura.ch === S.ITEMS.rune_ih.charges, `runa nasce com ${runaCura.ch} cargas`);
R.bag.push(runaCura);
vm.runInContext('P.cd = {};', ctx); S.useItem(runaCura);
A(R.hp > 10, 'runa de cura curou');
A(runaCura.ch === S.ITEMS.rune_ih.charges - 1, 'gastou uma carga');
for (let i = 0; i < 10; i++) { vm.runInContext('P.cd = {};', ctx); if (R.bag.includes(runaCura)) S.useItem(runaCura); }
A(!R.bag.includes(runaCura), 'runa some quando acabam as cargas');

/* 28. conjurar cria a runa e cobra mana */
vm.runInContext(`newPlayer('Conj', 'sorcerer'); P.level = 40; recalc(); P.mana = P.st.maxmana; P.cd = {}; G.now = 1e6;`, ctx);
const C = S.getP(), manaAntes = C.mana;
S.castSpell(S.SPELLS.find(sp => sp.id === 'adori_min_vis'));
A(C.bag.some(i => i.id === 'rune_hmm'), 'conjurou a runa na mochila');
A(C.mana < manaAntes, 'conjuração cobrou mana');

/* 29. provocação puxa o box */
vm.runInContext(`
  newPlayer('Tau', 'knight'); saiDoTemplo();         // provocar é ofensivo: não vale no templo
  P.level = 30; recalc(); P.mana = 999; P.cd = {}; G.now = 2e6; G.mobs.length = 0;
  for (let i = 0; i < 4; i++) G.mobs.push({ uid: 800 + i, id: 'rat', def: MONSTERS.rat, n: 'Rato', hp: 20, maxhp: 20,
    x: P.x + 2 + i, y: P.y, z: P.z, px: P.x, py: P.y, sp: {}, chase: false, taunt: 0, nextAtk: 1e12, nextStep: 1e12 });
  castSpell(SPELLS.find(s => s.id === 'exeta_res'));
`, ctx);
A(S.G.mobs.every(m => m.chase && m.taunt > 0), 'exeta res provoca todos os monstros por perto');
S.G.mobs.length = 0;

/* 29b. IA: corpo a corpo cerca, atirador mantém distância.
   O caso da coluna é o que quebrava antes: com o passo guloso, o bicho da frente
   tapava o único vizinho que diminuía a distância e os de trás travavam. */
vm.runInContext(`
  newPlayer('IA', 'knight'); G.dead = false; G.mobs.length = 0; G.now = 1e6; P.buffs = {};
  // arena: um bloco 7x7 inteiramente andável, senão o teste mede o mapa e não a IA
  const aberto = (() => {
    for (let y = 4; y < H - 4; y++) for (let x = 4; x < W - 4; x++) {
      let ok = true;
      for (let j = -3; j <= 3 && ok; j++) for (let i = -3; i <= 3; i++) if (!isWalkable(x + i, y + j, SURF)) { ok = false; break; }
      if (ok) return [x, y];
    }
    return null;
  })();
  P.x = aberto[0]; P.y = aberto[1]; P.z = SURF; P.px = P.x; P.py = P.y; P.stepD = 0;
  globalThis.mkMob = (id, dx, dy) => {
    const d = MONSTERS[id];
    const m = { uid: 500 + G.mobs.length, id, def: d, n: d.n, hp: d.hp, maxhp: d.hp,
      x: P.x + dx, y: P.y + dy, z: P.z, px: P.x + dx, py: P.y + dy, sp: {},
      nextStep: 0, nextAtk: 1e12, atkT: 0, taunt: 0, chase: true };   // nextAtk alto: ninguém apanha aqui
    G.mobs.push(m); return m;
  };
  globalThis.rodar = n => { for (let i = 0; i < n; i++) { G.now += 120; updateMobs(120); } };
  // fila indiana ao norte, o clássico "todos empilhados atrás de um só"
  for (const dy of [-2, -3, -4, -5]) mkMob('rat', 0, dy);
  rodar(500);
`, ctx);
A(S.G.mobs.every(m => S.distT(m.x, m.y, S.getP().x, S.getP().y) <= 1),
  'toda a fila de corpo a corpo chega à adjacência: ' + S.G.mobs.map(m => S.distT(m.x, m.y, S.getP().x, S.getP().y)));
A(new Set(S.G.mobs.map(m => m.x + ',' + m.y)).size === S.G.mobs.length, 'cada um na sua vaga, ninguém sobreposto');

/* muro entre o bicho e o jogador, com a única passagem para o lado: o passo
   guloso trava aqui de vez (nenhum vizinho diminui a distância), o caminho de
   verdade dá a volta. É este caso que a mudança tem de garantir. */
vm.runInContext(`
  G.mobs.length = 0; G.now += 1e5;
  const t = WORLD.floors[SURF].t;
  globalThis.muro = [];
  for (let dx = -3; dx <= 1; dx++) { const i = (P.y - 2) * W + (P.x + dx); muro.push([i, t[i]]); t[i] = T.ROCK; }
  mkMob('rat', 0, -3);
  rodar(600);
  globalThis.dMuro = distT(G.mobs[0].x, G.mobs[0].y, P.x, P.y);
  for (const [i, v] of muro) t[i] = v;                 // devolve o mapa como estava
`, ctx);
A(S.dMuro <= 1, `bicho contorna o muro até encostar (parou a ${S.dMuro})`);

vm.runInContext(`
  G.mobs.length = 0; G.now += 1e5;
  globalThis.arqueiro = mkMob('orc_spearman', 2, 0);   // alcance 5, começa colado
  globalThis.dIni = distT(arqueiro.x, arqueiro.y, P.x, P.y);
  rodar(500);
`, ctx);
A(S.arqueiro.def.ranged && S.distT(S.arqueiro.x, S.arqueiro.y, S.getP().x, S.getP().y) > S.dIni,
  `atirador recua quando o jogador está dentro do alcance (${S.dIni} → ${S.distT(S.arqueiro.x, S.arqueiro.y, S.getP().x, S.getP().y)})`);

/* cercado: os corpos dos outros bichos não tapam a mira de quem atira */
vm.runInContext(`
  G.mobs.length = 0; G.now += 1e5; G.proj.length = 0; P.hp = P.st.maxhp = 1e6;
  for (const [dx, dy] of DIRS) mkMob('minotaur', dx, dy);        // muralha de corpos ao redor
  globalThis.atirador = mkMob('orc_spearman', 3, 0);
  atirador.nextAtk = 0;
  rodar(60);
`, ctx);
A(S.G.proj.length > 0, 'atirador acerta o jogador cercado — criatura não tapa a mira de criatura');

/* Box fechada de água: corta o passo e não corta a vista. Quem bate de perto
   desiste e volta a vagar; quem atira continua vendo por cima e acertando. */
vm.runInContext(`
  G.mobs.length = 0; G.now += 1e5; G.proj.length = 0;
  const tb = WORLD.floors[SURF].t;
  globalThis.box = [];
  for (const [dx, dy] of DIRS) { const i = (P.y + dy) * W + (P.x + dx); box.push([i, tb[i]]); tb[i] = T.WATER; }
  globalThis.preso = mkMob('minotaur', 0, -3);
  globalThis.deFora = mkMob('orc_spearman', 0, -3); deFora.x = P.x + 3; deFora.px = P.x + 3; deFora.y = P.y; deFora.py = P.y;
  deFora.nextAtk = 0;
  rodar(80);
  globalThis.desistiu = !preso.chase;
  globalThis.tiros = G.proj.length;
  for (const [i, v] of box) WORLD.floors[SURF].t[i] = v;
`, ctx);
A(S.desistiu, 'box fechada: quem bate de perto perde o interesse e volta a vagar');
A(S.tiros > 0, `box fechada não segura quem atira: ${S.tiros} tiros por cima da água`);

/* parede de pedra é outra história: corta o passo E a vista, ninguém atira através */
vm.runInContext(`
  G.mobs.length = 0; G.now += 1e5; G.proj.length = 0;
  const tp = WORLD.floors[SURF].t;
  globalThis.pedra = [];
  for (const [dx, dy] of DIRS) { const i = (P.y + dy) * W + (P.x + dx); pedra.push([i, tp[i]]); tp[i] = T.ROCK; }
  const a = mkMob('orc_spearman', 3, 0); a.nextAtk = 0;
  rodar(80);
  globalThis.tirosPedra = G.proj.length;
  for (const [i, v] of pedra) WORLD.floors[SURF].t[i] = v;
`, ctx);
A(S.tirosPedra === 0, 'ninguém atira através de parede de pedra');

/* 29c. medo: quem tem instinto foge ferido, quem não tem morre no lugar */
vm.runInContext(`
  G.mobs.length = 0; G.now += 1e5;
  globalThis.lobo = mkMob('wolf', 1, 0); lobo.hp = lobo.maxhp * .1;
  globalThis.ciclope = mkMob('cyclops', -1, 0); ciclope.hp = ciclope.maxhp * .1;
  rodar(200);
  globalThis.dLobo = distT(lobo.x, lobo.y, P.x, P.y);
  globalThis.dCiclope = distT(ciclope.x, ciclope.y, P.x, P.y);
  /* exeta res: provocado, o medo não vale — é para isso que a magia existe.
     O lobo volta para perto antes: a fuga é aleatória e pode tê-lo largado fora
     da coleira de 14 tiles, onde nada traz ninguém de volta. */
  lobo.x = lobo.px = P.x + 3; lobo.y = lobo.py = P.y; lobo.stepD = 0; lobo.chase = true;
  lobo.taunt = G.now + 9e5;
  rodar(200);
  globalThis.dLoboProvocado = distT(lobo.x, lobo.y, P.x, P.y);
`, ctx);
A(S.MONSTERS.wolf.medo && S.dLobo > 1, `lobo ferido foge (chegou a ${S.dLobo} tiles)`);
A(!S.MONSTERS.cyclops.medo && S.dCiclope <= 1, 'ciclope ferido não recua um passo');
A(S.dLoboProvocado <= 1, `provocado, o lobo volta mesmo ferido (${S.dLoboProvocado})`);
S.G.mobs.length = 0;

/* 29c-bis. alvo: clicar de novo no mesmo bicho desmarca; clicar no chão só
   anda e mantém o alvo — desmarcar no chão forçava reselecionar toda hora que
   o jogador se reposicionava pra lutar. */
vm.runInContext(`
  G.mobs.length = 0; G.now += 1e5;
  globalThis.bicho = mkMob('rat', 2, 0);
  clickTile(bicho.x, bicho.y); globalThis.marcou = G.target === bicho;
  clickTile(bicho.x, bicho.y); globalThis.desmarcou = G.target === null;
  clickTile(bicho.x, bicho.y); clickTile(P.x + 1, P.y);   // chão vazio ao lado
  globalThis.chaoMantem = G.target === bicho;
`, ctx);
A(S.marcou, 'clicar na criatura marca o alvo');
A(S.desmarcou, 'clicar de novo na mesma criatura desmarca');
A(S.chaoMantem, 'clicar no chão não desmarca o alvo, só anda');
S.G.mobs.length = 0;

/* 29c-ter. regeneração do monstro: só fora de briga, e nunca passa do teto */
vm.runInContext(`
  G.mobs.length = 0; G.now += 1e5;
  globalThis.ferido = mkMob('minotaur', 5, 0); ferido.hp = 50; ferido.chase = false;
  globalThis.brigando = mkMob('minotaur', 6, 0); brigando.hp = 50; brigando.chase = true;
  globalThis.inteiro = mkMob('minotaur', 7, 0); inteiro.chase = false;
  for (let i = 0; i < 200; i++) regenMobs();
`, ctx);
A(S.ferido.hp > 50, `bicho fora de briga se cura (50 → ${S.ferido.hp})`);
A(S.brigando.hp === 50, 'bicho em perseguição não se cura no meio da luta');
A(S.ferido.hp === S.ferido.maxhp && S.inteiro.hp === S.inteiro.maxhp, 'a cura para na vida cheia');
S.G.mobs.length = 0;

/* comida: regeneração por tempo, soma no relógio e nunca piora o que já vale */
vm.runInContext(`
  newPlayer('Com', 'knight'); G.now = 1e6; P.cd = {}; P.buffs = {};
  globalThis.regBase = P.st.hpReg;
  P.bag.push(mkItem('meat', 0, 5));
  useItem(P.bag.find(i => i.id === 'meat'));
  globalThis.pos1 = { val: P.buffs.regen.val, dur: P.buffs.regen.end - G.now, hpReg: P.st.hpReg, mpReg: P.st.mpReg };
  P.cd = {}; useItem(P.bag.find(i => i.id === 'meat'));
  globalThis.pos2dur = P.buffs.regen.end - G.now;
  P.bag.push(mkItem('dragon_ham', 0, 2));
  P.cd = {}; useItem(P.bag.find(i => i.id === 'dragon_ham'));
  globalThis.posBom = P.buffs.regen.val;
  P.cd = {}; useItem(P.bag.find(i => i.id === 'meat'));
  globalThis.posRuim = P.buffs.regen.val;
  // mochila cheia de presunto não vira regeneração o dia inteiro
  for (let i = 0; i < 40; i++) { P.cd = {}; P.bag.push(mkItem('dragon_ham', 0, 1)); useItem(P.bag.find(x => x.id === 'dragon_ham')); }
  globalThis.teto = P.buffs.regen.end - G.now;
`, ctx);
A(S.pos1.val === S.ITEMS.meat.food.v && S.pos1.dur === S.ITEMS.meat.food.t * 1000, 'comer liga a regeneração pelo tempo do alimento');
A(S.pos1.hpReg > S.regBase && S.pos1.mpReg > 0, 'comer aumenta regeneração de vida E de mana');
A(S.pos2dur === S.pos1.dur * 2, 'comer de novo soma no relógio em vez de reiniciar');
A(S.posBom === S.ITEMS.dragon_ham.food.v && S.posRuim === S.posBom, 'alimento pior não derruba o efeito do melhor');
A(S.teto <= 10 * 60000, `o efeito tem teto (${Math.round(S.teto / 1000)}s)`);

/* linha de loot no chat */
/* o chat de combate tem de receber as três informações, cada uma na sua classe */
vm.runInContext(`
  newPlayer('Log', 'knight'); G.now = 1e6; G.mobs.length = 0; P.buffs = {}; P.cd = {};
  // sem equipamento: com armadura o golpe de teste seria absorvido e nunca viraria dano
  P.eq = {}; recalc(); P.hp = P.st.maxhp; P.mana = 0;
  const cx = document.querySelector('#log'); cx.children.length = 0;
  const saco = mkMob('rat', 1, 0); saco.hp = 1e6; saco.maxhp = 1e6;
  dealDamage(saco, 50);
  for (let i = 0; i < 12; i++) hitPlayer(4, 'Rato');
  curar(30, 'teste');
  curar(20, 'teste', true);
  globalThis.linhas = cx.children.map(e => e.className);
`, ctx);
A(S.linhas.some(c => /\bdano\b/.test(c)), 'dano causado entra no log de combate');
A(S.linhas.some(c => /\bapanha\b/.test(c)), 'dano recebido entra no log de combate');
A(S.linhas.some(c => /\bcura\b/.test(c)) && S.linhas.some(c => /\bmana\b/.test(c)), 'cura de vida e de mana entram com cores próprias');
A(S.linhas.every(c => !c || c.includes('cbt') || c.includes('good') || c.includes('bad')),
  'toda linha de combate está marcada para a aba Combate mostrar');

const semTag = s => s.replace(/<[^>]+>/g, '');
A(semTag(S.descLoot(S.mkItem('gold', 0, 56))) === '56 Moedas de Ouro', 'empilhável mostra a quantidade no log');
A(semTag(S.descLoot(S.mkItem('spear', 0, 1))) === 'Lança', 'peça única mostra só o nome');
A(S.descLoot(S.mkItem('spear', 0, 1)).includes(S.RARITY[0].color) &&
  S.descLoot(S.mkItem('sword', 3, 1)).includes(S.RARITY[3].color), 'a cor no log é a da raridade do item');

/* 29e. o mundo persiste: trocar de andar não limpa o chão, e o save traz de volta */
vm.runInContext(`
  newPlayer('Persistente', 'knight'); G.mobs.length = 0; G.now = 1e6;
  G.corpses.length = 0; G.drops.length = 0; P.z = SURF; P.seen = { f0:1, f1:1, f2:1, f3:1 };
  spawnCorpse(P.x, P.y + 1, SURF, 'Orc', [mkItem('gold', 0, 33)], { shape: 'biped', color: 0x888888, size: 1 });
  spawnDrop(P.x + 1, P.y, SURF, mkItem('sword', 2, 1));
  changeFloor(SURF + 1);
  globalThis.noOutroAndar = { corpos: G.corpses.length, itens: G.drops.length };
  changeFloor(SURF);
  globalThis.aoVoltar = { corpos: G.corpses.filter(c => c.z === SURF).length, itens: G.drops.filter(d => d.z === SURF).length };
  P.hitT = P.stepT = G.now; P.stepD = 400;   // apanhou e estava no meio do passo ao salvar
  save();
  globalThis.recarregado = load();
`, ctx);
A(S.noOutroAndar.corpos === 1 && S.noOutroAndar.itens === 1, 'descer não apaga o corpo e o item do andar de cima');
A(S.aoVoltar.corpos === 1 && S.aoVoltar.itens === 1, 'ao voltar, o chão está como você deixou');
A(S.recarregado.corpses.length === 1 && S.recarregado.corpses[0].items[0].count === 33,
  'o save traz o corpo de volta com o que tinha dentro');
A(S.recarregado.corpses[0].t === 0, 'o corpo volta com o relógio zerado, senão nasce podre');
A(S.recarregado.p.hitT === 0 && S.recarregado.p.stepT === 0 && S.recarregado.p.stepD === 0,
  'o herói volta sem carimbo de G.now — com ele, o clarão de 90ms dura a partida toda');
A((() => {
  const af = S.recarregado.drops[0].it.af;
  return af && af.length && af.every(a => S.PREFIXES.includes(a) || S.SUFFIXES.includes(a));
})(), 'item largado volta com os afixos remontados, não com cópias soltas do JSON');

/* 29f. o passo diagonal custa mais e ainda paga uma pausa depois */
vm.runInContext(`
  newPlayer('Diag', 'knight'); G.mobs.length = 0; G.now = 1e6;
  P.x = aberto[0]; P.y = aberto[1]; P.z = SURF; P.px = P.x; P.py = P.y; P.stepD = 0; P.nextStep = 0;
  tryStep(P, P.x + 1, P.y);
  globalThis.esperaReto = P.nextStep - G.now;
  G.now += 1e5; P.stepD = 0; P.nextStep = 0;
  tryStep(P, P.x + 1, P.y + 1);
  globalThis.esperaDiag = P.nextStep - G.now;
  globalThis.animDiag = P.stepD;
`, ctx);
A(S.esperaDiag > S.esperaReto * 1.5, `diagonal espera mais que reto (${Math.round(S.esperaReto)}ms x ${Math.round(S.esperaDiag)}ms)`);
A(S.esperaDiag > S.animDiag, 'a espera da diagonal é maior que a animação — existe pausa de verdade');

/* 29g. spawn e respawn atravessam o save: o que estava vivo volta onde estava,
   o que você matou continua morto até a hora dele */
vm.runInContext(`
  newPlayer('Mundo', 'knight'); G.mobs.length = 0; G.corpses.length = 0; G.drops.length = 0;
  G.now = 1e6;
  const sps = WORLD.spawns.filter(s => s.z === P.z).slice(0, 2);
  sps.forEach(s => { s.live = null; s.dead = 0; });
  const vivo = spawnMob(sps[0]); vivo.hp = 33; vivo.x = vivo.px = sps[0].x + 2;
  removeMob(spawnMob(sps[1]), true);              // esse morre e fica devendo respawn
  globalThis.iVivo = WORLD.spawns.indexOf(sps[0]);
  globalThis.iMorto = WORLD.spawns.indexOf(sps[1]);
  save();
  const d = load();
  G.mobs.length = 0; WORLD.spawns.forEach(s => { s.live = null; s.dead = 0; });
  restaurarBichos(d);
  globalThis.voltou = G.mobs.map(m => ({ hp: m.hp, dx: m.x - WORLD.spawns[iVivo].x }));
  globalThis.segueMorto = WORLD.spawns[iMorto].dead > Date.now();
  globalThis.mortoNaLista = (d.mortos || []).some(([i]) => i === iMorto);
`, ctx);
A(S.voltou.length === 1 && S.voltou[0].hp === 33 && S.voltou[0].dx === 2,
  'o bicho vivo volta na posição e na vida em que estava');
A(S.mortoNaLista && S.segueMorto, 'quem você matou continua morto depois de recarregar');
S.G.mobs.length = 0;

/* 29h. tiro não é recuo: só o atirador mantém distância; dragão avança e queima */
vm.runInContext(`
  G.mobs.length = 0; G.now += 1e5; P.buffs = {}; P.hp = P.st.maxhp = 1e6; P.mana = 1e6;
  G.dead = false;                                  // um bloco anterior mata o jogador
  // de volta à arena: o bloco anterior deixou o jogador no templo, entre paredes
  P.x = aberto[0]; P.y = aberto[1]; P.z = SURF; P.px = P.x; P.py = P.y; P.stepD = 0;
  globalThis.drag = mkMob('dragon', 4, 0); drag.nextAtk = 0;
  /* Saco de pancada de verdade: a vida volta a encher a cada tique. Marcar
     P.st.maxhp = 1e6 uma vez so nao segura, porque qualquer recalc() no meio da
     rodada devolve o maximo real (150) e o sopro do dragao mata o jogador. E
     jogador morto faz TODO bicho largar a caca e vagar, entao a distancia final
     media a vagabundagem pos-morte, nao a IA. Era essa a instabilidade. */
  for (let i = 0; i < 400; i++) { P.hp = P.st.maxhp; G.now += 120; updateMobs(120); }
  globalThis.dDragao = distT(drag.x, drag.y, P.x, P.y);
  globalThis.dragVivo = !G.dead;
`, ctx);
A(S.MONSTERS.dragon.ranged && !S.MONSTERS.dragon.ranged.recua, 'dragão tem sopro mas não é atirador');
A(S.MONSTERS.orc_spearman.ranged.recua && S.MONSTERS.minotaur_archer.ranged.recua, 'lanceiro e arqueiro são os que recuam');
A(S.dragVivo && S.dDragao <= 1, `dragão fecha a distância em vez de fugir (parou a ${S.dDragao}, jogador vivo: ${S.dragVivo})`);

/* 29i. habilidades: área machuca no raio, teia atrasa, morto-vivo se cura */
vm.runInContext(`
  G.mobs.length = 0; G.now += 1e5; P.buffs = {}; P.eq = {}; G.dead = false; recalc();
  P.hp = P.st.maxhp = 1e6; P.x = aberto[0]; P.y = aberto[1]; P.px = P.x; P.py = P.y;
  globalThis.velNormal = P.st.speed;
  const ar = mkMob('spider', 2, 0); ar.habT = 0;
  habilidade(ar, distT(ar.x, ar.y, P.x, P.y));
  globalThis.lentoDepois = { buff: !!P.buffs.lento, vel: P.st.speed };
  const ci = mkMob('cyclops', 1, 0); ci.habT = 0;
  const hpAntes = P.hp; habilidade(ci, 1);
  globalThis.danoArea = hpAntes - P.hp;
  const ci2 = mkMob('cyclops', 9, 0); ci2.habT = 0;
  const hp2 = P.hp; habilidade(ci2, 9);
  globalThis.danoLonge = hp2 - P.hp;
  const es = mkMob('demon_skeleton', 3, 0); es.habT = 0; es.hp = 100;
  habilidade(es, 3); globalThis.curou = es.hp;
  const es2 = mkMob('demon_skeleton', 3, 1); es2.habT = 0;
  habilidade(es2, 3); globalThis.naoCurou = es2.hp === es2.maxhp && es2.habT === 0;
`, ctx);
A(S.lentoDepois.buff && S.lentoDepois.vel < S.velNormal, `teia da aranha atrasa o jogador (${S.velNormal} → ${S.lentoDepois.vel})`);
A(S.danoArea > 0, `estouro do ciclope machuca quem está no raio (${S.danoArea})`);
A(S.danoLonge === 0, 'fora do raio ninguém se machuca');
A(S.curou > 100, `esqueleto demoníaco se cura (100 → ${S.curou})`);
A(S.naoCurou, 'quem está de vida cheia não gasta a habilidade de cura');
A(Object.values(S.MONSTERS).every(d => !d.hab || (d.hab.cd > 0 && ['area','lento','cura'].includes(d.hab.tipo))),
  'toda habilidade tem tipo conhecido e descanso');
S.G.mobs.length = 0;

/* 29j. impacto: um efeito por tipo de dano, e nada de texto empilhado no bloqueio */
vm.runInContext(`
  G.mobs.length = 0; G.fx.length = 0; G.now += 1e5; G.dead = false;
  P.eq = {}; recalc(); P.hp = P.st.maxhp = 1e6;
  const bicho = mkMob('bug', 1, 0);                 // inseto: sangue verde
  /* Vida absurda de propósito: o que se mede aqui é o TIPO do efeito, não morte.
     Sem isto o crítico (que dobra o dano) matava o besouro de 45 no primeiro
     golpe, o segundo dealDamage saía no if (m.hp <= 0) return e o teste falhava
     em ~1 de cada 10 execuções — flutuação que tirava a confiança da suíte
     inteira, não só desta linha. */
  bicho.hp = bicho.maxhp = 1e6;
  dealDamage(bicho, 30);                            // físico
  dealDamage(bicho, 30, 'fire', 0xff8020);          // mágico
  globalThis.efeitos = G.fx.filter(f => f.kind === 'impacto').map(f => ({ tipo: f.tipo, cor: f.color }));
  G.fx.length = 0;
  P.st.shieldDef = 0; P.st.arm = 1e6;               // armadura absurda: nada passa
  hitPlayer(5, 'Rato');
  globalThis.aoErrar = G.fx.filter(f => f.kind === 'impacto').map(f => f.tipo);
  globalThis.textoAoErrar = G.fx.filter(f => f.kind === 'text').length;
`, ctx);
A(S.efeitos.length === 2 && S.efeitos[0].tipo === 'fisico' && S.efeitos[1].tipo === 'magico',
  'golpe físico e golpe mágico deixam efeitos diferentes');
A(S.efeitos[0].cor === S.cssColOu(S.MONSTERS.bug.sangue.cor), `o sangue sai na cor da espécie (${S.efeitos[0].cor})`);
A(S.aoErrar.length === 1 && S.aoErrar[0] === 'erro', 'golpe que não passa vira fumaça');
A(S.textoAoErrar === 0, 'e não vira mais texto empilhado sobre a cabeça');

/* 29k. elementos: a tabela é lida pelo dano, pelo desenho e pela UI ---------
   O que se protege aqui não é o número, é a regra de desenho: nenhuma vocação
   pode encontrar um monstro em que nada do arsenal dela funciona. */
{
  const E = S.ELEM, els = Object.keys(E);
  A(els.every(k => E[k].n && E[k].cor >= 0 && E[k].forma && E[k].luz !== undefined),
    `os ${els.length} elementos têm nome, cor, forma e luz`);

  // toda referência a elemento no jogo existe na tabela
  const usados = new Set();
  S.SPELLS.forEach(s => s.el && usados.add(s.el));
  Object.values(S.ITEMS).forEach(i => i.el && usados.add(i.el));
  Object.values(S.MONSTERS).forEach(m => {
    if (m.ranged && m.ranged.el) usados.add(m.ranged.el);
    if (m.hab && m.hab.el) usados.add(m.hab.el);
  });
  A([...usados].every(k => E[k]), `todo elemento usado existe na tabela (${[...usados].sort().join(', ')})`);

  /* `el` é a única fonte: quem tem elemento é mágico, quem não tem é pancada.
     Não existe mais um `mag` para discordar dele. O que se protege aqui é a
     travessia — se um dia o elemento sumir das fichas, o jogador fica sem como
     se defender daquele golpe e nada mais avisa. */
  const comEl = Object.values(S.MONSTERS).filter(m =>
    (m.ranged && m.ranged.el) || (m.hab && m.hab.el));
  A(comEl.length >= 15, `os ataques mágicos declaram elemento (${comEl.length} criaturas)`);
  A(S.MONSTERS.dragon.ranged.el === 'fire' && S.MONSTERS.demon.ranged.el === 'death',
    'sopro de dragão é fogo e o do demônio é morte');
  const sobrou = Object.values(S.MONSTERS).filter(m =>
    (m.ranged && m.ranged.mag !== undefined) || (m.hab && m.hab.mag !== undefined));
  A(sobrou.length === 0, 'nenhuma ficha guarda `mag` além do elemento');

  // cor: a tabela é o padrão, `col` na ficha é exceção — e nenhuma magia fica sem
  const semCor = S.SPELLS.filter(s => s.el && s.col === undefined);
  A(semCor.length === 0, 'toda magia com elemento acaba com cor, própria ou da tabela');
  const herdou = S.SPELLS.filter(s => s.el && s.col === E[s.el].cor);
  const propria = S.SPELLS.filter(s => s.el && s.col !== E[s.el].cor);
  A(herdou.length > 0 && propria.length > 0,
    `${herdou.length} magias herdam a cor do elemento, ${propria.length} mantêm a própria`);

  const R = S.resistOf, M = S.MONSTERS;
  A(R(M.skeleton, 'holy') > 1 && R(M.skeleton, 'death') === 0, 'morto-vivo queima no sagrado e ignora a morte');
  A(R(M.dragon, 'fire') === 0 && R(M.dragon, 'ice') > 1, 'dragão é imune a fogo e frágil no gelo');
  A(R(M.demon_skeleton, 'fire') === .5 && R(M.skeleton, 'fire') > 1,
    '`res` na ficha sobrescreve a classe (esqueleto demoníaco aguenta fogo)');
  A(R(M.rat, 'physical') === 1 && R(M.orc) === 1, 'golpe sem elemento conta como físico');

  /* Golpe físico em quem RESISTE a físico: o log montava ELEM[undefined] e
     estourava no meio do dealDamage — a vida já tinha sido descontada, mas
     killMob nunca rodava. O bicho ficava com hp<=0 vivo na lista, sumia da tela
     e nunca largava loot. Varre espécie x elemento porque o defeito estava na
     travessia, não numa ficha. */
  vm.runInContext(`
    G.mobs.length = 0; G.now += 1e5; G.dead = false;
    P.eq = {}; recalc(); P.hp = P.st.maxhp = 1e6;
    globalThis.falhas = [];
    for (const id in MONSTERS) for (const el of [null, ...Object.keys(ELEM)]) {
      const m = mkMob(id, 1, 0); m.hp = m.maxhp = 1e6;
      try { dealDamage(m, 40, el); } catch (e) { falhas.push(id + '/' + el + ': ' + e.message); }
      G.mobs.length = 0;
    }
    const gig = mkMob('cyclops', 1, 0);
    dealDamage(gig, 1e6);
    globalThis.gigMorreu = gig.hp <= 0 && !G.mobs.includes(gig);
    G.mobs.length = 0;
  `, ctx);
  A(!S.falhas.length, `dano de qualquer elemento em qualquer criatura não quebra (${S.falhas[0] || 'ok'})`);
  A(S.gigMorreu, 'quem resiste a físico ainda morre e sai da lista (ciclope)');

  // regra 1: nada barra o cavaleiro
  const barraFisico = Object.keys(M).filter(k => R(M[k], 'physical') < .5);
  A(barraFisico.length === 0, `nenhum monstro resiste a físico abaixo de .5 (${barraFisico.join(', ') || 'nenhum'})`);

  // regra 2: toda vocação tem saída em todo monstro
  const arsenal = {};
  for (const v of ['knight', 'ranger', 'sorcerer', 'druid']) {
    arsenal[v] = new Set(['physical']);   // toda vocação bate com a arma na mão
    S.SPELLS.filter(s => s.voc.includes(v) && s.el).forEach(s => arsenal[v].add(s.el));
  }
  const parede = [];
  for (const k in M) for (const v in arsenal)
    if (![...arsenal[v]].some(el => R(M[k], el) >= .5)) parede.push(`${v} x ${M[k].n}`);
  A(parede.length === 0, `nenhuma vocação fica sem resposta contra um monstro (${parede.join(', ') || 'nenhuma parede'})`);
}

/* 29l. resistência muda o dano dos dois lados, e o jogador vê que mudou */
vm.runInContext(`
  G.mobs.length = 0; G.fx.length = 0; G.now += 1e5; G.dead = false; linhas.length = 0;
  P.eq = {}; recalc(); P.st.crit = 0;                       // crítico dobra e embaralha a medida
  const alvoEl = mkMob('skeleton', 3, 0);
  alvoEl.hp = alvoEl.maxhp = 1e6; alvoEl.def = Object.assign({}, alvoEl.def, { arm: 0 });
  dealDamage(alvoEl, 100, 'holy');   globalThis.dSagrado = 1e6 - alvoEl.hp;
  alvoEl.hp = 1e6;
  dealDamage(alvoEl, 100, 'ice');    globalThis.dGelo = 1e6 - alvoEl.hp;
  alvoEl.hp = 1e6; G.fx.length = 0;
  dealDamage(alvoEl, 100, 'death');  globalThis.dMorte = 1e6 - alvoEl.hp;
  globalThis.fxImune = G.fx.filter(f => f.kind === 'impacto').map(f => f.tipo);
  globalThis.txtImune = G.fx.filter(f => f.kind === 'text').map(f => f.txt);
`, ctx);
A(S.dSagrado > 140 && S.dSagrado < 180, `sagrado no esqueleto bate 1.6x (${S.dSagrado})`);
A(S.dGelo > 60 && S.dGelo < 80, `gelo no esqueleto bate 0.7x (${S.dGelo})`);
A(S.dMorte === 0, 'imune não perde vida nenhuma');
A(S.fxImune.length === 1 && S.fxImune[0] === 'erro', 'golpe imune sai como fumaça, não como acerto');
A(S.txtImune.some(t => /imune/.test(t)), 'e o jogador lê "imune" na tela');

vm.runInContext(`
  G.fx.length = 0;
  const alvo2El = mkMob('skeleton', 4, 0);
  alvo2El.hp = alvo2El.maxhp = 1e6; alvo2El.def = Object.assign({}, alvo2El.def, { arm: 0 });
  dealDamage(alvo2El, 100, 'holy');
  globalThis.marcaFraco = G.fx.filter(f => f.kind === 'text').map(f => f.txt).join('');
  G.fx.length = 0;
  dealDamage(alvo2El, 100, 'ice');
  globalThis.marcaForte = G.fx.filter(f => f.kind === 'text').map(f => f.txt).join('');
`, ctx);
A(/▲/.test(S.marcaFraco) && /▼/.test(S.marcaForte), 'o número flutuante marca fraqueza (▲) e resistência (▼)');

/* resistência do jogador: afixo -> P.st.res -> menos dano do elemento */
vm.runInContext(`
  P.eq = {}; recalc();
  P.st.shieldDef = 0; P.st.arm = 0; P.hp = P.st.maxhp = 1e6;
  hitPlayer(200, 'Dragão', 'fire'); globalThis.semRes = 1e6 - P.hp;
  P.hp = 1e6;
  P.st.res.fire = .5;
  hitPlayer(200, 'Dragão', 'fire'); globalThis.comRes = 1e6 - P.hp;
  P.hp = 1e6;
  P.st.res.fire = 5;                                   // afixo empilhado além do teto
  hitPlayer(200, 'Dragão', 'fire'); globalThis.tetoRes = 1e6 - P.hp;
  P.hp = 1e6; P.st.res.fire = 0; G.fx.length = 0;
  hitPlayer(200, 'Dragão', 'fire');
  globalThis.fxDoFogo = G.fx.filter(f => f.kind === 'impacto').map(f => f.forma + '/' + f.tipo).join();
  P.hp = 1e6; G.fx.length = 0;
  hitPlayer(200, 'Rato');                              // sem elemento = pancada
  globalThis.fxDaGarra = G.fx.filter(f => f.kind === 'impacto').map(f => (f.forma || '-') + '/' + f.tipo).join();
  const peca = mkItem('leather_armor', 0);
  peca.af = [PREFIXES.find(a => a.n === 'Ígnea')];
  globalThis.bonusAfixo = itemStats(peca).bonus.resFire;
`, ctx);
A(S.semRes === 200 && S.comRes === 100, `resistência do jogador corta o dano do elemento (${S.semRes} -> ${S.comRes})`);
A(S.tetoRes === 50, `e o teto de 75% impede imunidade por empilhamento (${S.tetoRes})`);
A(S.bonusAfixo === 0.15, 'afixo de resistência chega em itemStats como bônus normal');
A(S.fxDoFogo === 'brasa/magico', 'golpe elemental do monstro sai com a partícula do elemento');

/* luz do estouro: quem não brilha na tabela não acende o chão */
vm.runInContext(`
  G.fx.length = 0;
  fxBurst(P.x, P.y, 0xff7a20, 1, 'fire');
  fxBurst(P.x, P.y, 0x7ac24a, 1, 'earth');
  fxBurst(P.x, P.y, 0x55dd55, 1);                    // cura: sem elemento
  globalThis.luzes = G.fx.filter(f => f.kind === 'burst').map(f => f.luz);
`, ctx);
A(S.luzes[0] === S.ELEM.fire.luz && S.luzes[1] === 0 && S.luzes[2] === 1,
  `explosão acende conforme a tabela (fogo ${S.luzes[0]}, terra ${S.luzes[1]}, sem elemento ${S.luzes[2]})`);

/* varinha atira na cor do que lança */
vm.runInContext(`
  const cor = id => { P.eq.weapon = mkItem(id); recalc(); return weaponInfo().col; };
  globalThis.corInferno = cor('wand_of_inferno');
  globalThis.corPodridao = cor('wand_of_decay');
  globalThis.corNevasca = cor('hailstorm_rod');
  P.eq.weapon = null; recalc();
`, ctx);
A(S.corInferno === S.ELEM.fire.cor && S.corPodridao === S.ELEM.death.cor && S.corNevasca === S.ELEM.ice.cor,
  'cada varinha dispara na cor do próprio elemento');
A(S.corInferno !== S.corPodridao, 'e duas varinhas de elementos diferentes não saem iguais');

/* conjunto completo paga resistência, e ela chega em P.st.res pelo mesmo add() */
{
  const semRes = Object.entries(S.SETS).filter(([, s]) =>
    !Object.keys(s.tiers[s.tiers.length - 1][1]).some(k => k.startsWith('res')));
  A(semRes.length === 0, `todo conjunto completo dá resistência (${Object.keys(S.SETS).length} conjuntos)`);
}
vm.runInContext(`
  P.eq = {};
  for (const id in ITEMS) if (ITEMS[id].set === 'ns' && ITEMS[id].slot) equipItem(mkItem(id), true);
  recalc();
  globalThis.pecasNS = setCount('ns');
  globalThis.resNS = P.st.res.death || 0;
  P.eq = {}; recalc();
  globalThis.resVazio = P.st.res.death || 0;
`, ctx);
A(S.pecasNS >= 8 && S.resNS === .12, `vestir o Escudeiro Nobre inteiro dá 12% contra Morte (${S.pecasNS} peças, ${S.resNS})`);
A(S.resVazio === 0, 'e tirar o conjunto zera a resistência');

/* o quadro de status mostra o total, não só a ficha de cada peça */
vm.runInContext(`
  const chipsRes = () => $('#res-strip').children;
  P.eq = {}; recalc(); renderCombatStats();
  globalThis.chipsVazio = chipsRes().length;
  P.st.res.fire = .3; P.st.res.ice = .9;               // acima do teto de propósito
  renderCombatStats();
  globalThis.chips = chipsRes().map(e => e.textContent);
  globalThis.dicaGelo = chipsRes().map(e => e.title).join('|');
`, ctx);
A(S.chipsVazio === 0, 'sem resistência nenhuma o quadro não ganha chip');
A(S.chips.length === 2 && S.chips.includes('30'), `cada resistência vira um badge na faixa (${S.chips.join(' · ')})`);
A(S.chips.includes('75'), 'e o badge mostra o teto de 75, não o número cru empilhado');
A(/Resistência a Gelo/.test(S.dicaGelo), 'o chip tem tooltip explicando de onde vem');
A(S.fxDaGarra === '-/fisico', 'e golpe sem elemento continua sendo pancada física');

/* bestiário: a tela de "o que eu sei sobre este bicho" tem de saber disto */
vm.runInContext(`
  P.best = { skeleton: 999, rat: 0 };
  bestSel = 'skeleton'; renderBestDetail();
  globalThis.fichaEsqueleto = $('#best-detail').innerHTML;
  bestSel = 'orc'; renderBestDetail();
  globalThis.fichaOrc = $('#best-detail').innerHTML;
`, ctx);
A(/Elementos/.test(S.fichaEsqueleto) && /Sagrado/.test(S.fichaEsqueleto) && /imune/.test(S.fichaEsqueleto),
  'a ficha do esqueleto mostra fraqueza a Sagrado e imunidade a Morte');
A(!/Elementos/.test(S.fichaOrc), 'criatura sem entrada no bestiário não revela elemento');

/* 29d. velocidade por natureza: a régua do jogador é 220 */
{
  const M = S.MONSTERS, v = k => M[k].spd;
  A(v('wolf') > v('bug') + 100, `lobo é muito mais rápido que besouro (${v('wolf')} x ${v('bug')})`);
  A(v('dragon') > v('orc') + 30, `dragão não anda como orc (${v('dragon')} x ${v('orc')})`);
  A(['bug', 'rotworm', 'cyclops', 'skeleton', 'ghoul'].every(k => v(k) < 220), 'os pesados ficam abaixo do jogador');
  A(['wolf', 'spider', 'giant_spider', 'dragon', 'demon'].every(k => v(k) > 280), 'os caçadores passam de 280');
  A(new Set(Object.values(M).map(d => d.spd)).size >= 12, 'as velocidades não caem todas no mesmo punhado de valores');
  A(Object.values(M).every(d => !d.medo || (d.medo > 0 && d.medo < .6)), 'medo é uma fração de vida sensata');
}

/* 30. toda vocação tem o que fazer no nível 1 */
A(Object.keys(S.VOCATIONS).every(v => {
  const n1 = S.SPELLS.filter(sp => sp.voc.includes(v) && sp.lvl <= 1);
  return n1.some(sp => sp.type !== 'buff') && n1.length >= 2;
}), 'toda vocação nasce com ataque/cura no nível 1');
A(S.SPELLS.every(sp => sp.voc.every(v => S.VOCATIONS[v])), 'magias novas apontam para vocações válidas');
A(S.SPELLS.filter(sp => sp.type === 'conjure').every(sp => S.ITEMS[sp.item] && S.ITEMS[sp.item].rune),
  'toda conjuração cria uma runa que existe');
/* nenhum dos dois falha em voz alta: sem `base` o dano vira NaN, sem `r` a área
   encolhe para raio 1 pelo padrão do spellTiles. Melhor quebrar aqui. */
A(S.SPELLS.filter(sp => ['aoe', 'wave', 'beam', 'attack'].includes(sp.type)).every(sp => sp.base > 0),
  'toda magia de dano mágico tem base: ' + S.SPELLS.filter(sp => ['aoe', 'wave', 'beam', 'attack'].includes(sp.type) && !(sp.base > 0)).map(sp => sp.id));
A(S.SPELLS.filter(sp => sp.type === 'aoe' || sp.type === 'melee_aoe').every(sp => sp.r > 0),
  'toda magia de estouro tem raio: ' + S.SPELLS.filter(sp => (sp.type === 'aoe' || sp.type === 'melee_aoe') && !(sp.r > 0)).map(sp => sp.id));
/* o ranger tinha um vão do nível 1 ao 30 sem nenhuma área */
A((() => {
  const a = S.SPELLS.filter(sp => sp.voc.includes('ranger') && ['aoe', 'wave', 'beam'].includes(sp.type)).map(sp => sp.lvl).sort((x, y) => x - y);
  return a.length >= 3 && a[0] <= 15 && a[a.length - 1] >= 40;
})(), 'ranger tem área em nível baixo, médio e alto');

/* 31. barra de habilidades */
vm.runInContext(`newPlayer('Hot', 'druid'); P.level = 40; recalc(); renderHotbar();`, ctx);
const HB = S.getP().hotbar;
A(HB && HB.length === S.HOT_SLOTS, `barra com ${S.HOT_SLOTS} slots`);
A(HB.filter(Boolean).length >= 3, 'barra vem preenchida por padrão');
A(HB.every(sl => !sl || (sl.k === 'spell' ? S.SPELLS.some(sp => sp.id === sl.id) : S.ITEMS[sl.id])),
  'todo slot aponta para magia ou item que existe');

/* 32. HUD configurável: lado, ordem, esconder, modo das barras e persistência */
vm.runInContext('hudApply();', ctx);
A(S.getHUD().panels.bag.dock === 'r', 'mochila começa na barra da direita');
vm.runInContext("hudMove('bag', 'dock');", ctx);
A(S.getHUD().panels.bag.dock === 'l', 'trocar de lado move o painel de sidebar');
vm.runInContext("hudMove('bag', 'show');", ctx);
A(S.getHUD().panels.bag.show === false, 'fechar esconde o painel');
const salvo = JSON.parse(S.localStorage.getItem('thaira.hud') || 'null');
A(salvo && salvo.panels.bag.dock === 'l' && salvo.panels.bag.show === false, 'layout fica salvo no localStorage');
const ordAntes = S.getHUD().panels.skills.ord;
vm.runInContext("hudMove('skills', 'ord', -1);", ctx);
A(S.getHUD().panels.skills.ord !== ordAntes, 'setas ↑↓ reordenam o painel');
vm.runInContext("getHUD().status = 'sidebar'; hudApply();", ctx);
A(S.getHUD().panels.status.show === true, 'barras na lateral acendem o painel de status');
vm.runInContext("getHUD().status = 'none'; hudApply();", ctx);
A(S.getHUD().panels.status.show === false, 'modo escondido apaga o painel de status');
vm.runInContext('setHUD(HUD_DEF()); hudApply();', ctx);
A(S.getHUD().panels.bag.dock === 'r' && S.getHUD().panels.bag.show, 'restaurar padrão volta tudo ao lugar');
A(S.HUD_PANELS.every(p => S.getHUD().panels[p.id]), 'todo painel declarado tem configuração');

/* 33. notificações de marco não entopem a tela */
vm.runInContext("$('#toast').innerHTML = ''; for (let i = 0; i < 7; i++) notify('⭐', 'Nível ' + i, 'sub');", ctx);
A(S.document.querySelector('#toast').children.length === 4, 'no máximo 4 notificações empilhadas');

/* 34. luz é item equipado: só a tocha no slot `light` acende */
vm.runInContext("newPlayer('Luz', 'knight');", ctx);
const Pl = S.getP();
A(S.SLOT_POS.light && S.SLOT_POS.light[0] === S.SLOT_POS.shield[0] && S.SLOT_POS.light[1] > S.SLOT_POS.shield[1],
  'o slot de luz fica na mesma coluna do escudo, logo abaixo dele');
A(Pl.eq.light && Pl.eq.light.id === 'torch', 'o kit inicial já sai com a tocha equipada');
A(S.luzCarregada() === S.ITEMS.torch.luz, 'tocha equipada ilumina');
vm.runInContext("unequip('light');", ctx);
A(S.luzCarregada() === 0, 'tocha na mochila não acende nada — tem de estar no slot');
A(Pl.bag.some(b => b.id === 'torch'), 'e ela volta para a mochila, não some');
Pl.buffs.light = { val: 4 };
A(S.luzCarregada() === 4, 'a magia de luz ilumina sozinha, sem item');
vm.runInContext("equipItem(P.bag.find(b => b.id === 'torch'));", ctx);
A(S.luzCarregada() === S.ITEMS.torch.luz, 'com tocha e magia fraca vale a MAIOR, não a soma');
Pl.buffs.light = null;
A(S.itemStats(Pl.eq.light).slot === 'light', 'a tocha só cabe no slot de luz');

console.log(`  espada ${T2.sk.sword.l} · escudo ${T2.sk.shielding.l} após 2 min de treino`);
console.log(`  dragão: ${Math.min(...tam)}–${Math.max(...tam)} itens por morte, média ${medio.toFixed(1)}`);
console.log(bad ? `\n${ok} ok, ${bad} FALHA(S)\n` : `\ntudo certo: ${ok} verificações passaram\n`);
process.exit(bad ? 1 : 0);

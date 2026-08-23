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
    /* classList mexe no className de verdade em vez de ser no-op: `contains()`
       tem de responder sobre o que `add()` acabou de pôr, senão quem filtra por
       classe (hudEncaixa) recebe uma lista vazia — ou, quando o stub nem tinha
       `contains`, estourava e derrubava o resto da suíte. */
    classList: {
      add(...c) { for (const k of c) if (!this.contains(k)) el.className += (el.className ? ' ' : '') + k },
      remove(...c) { el.className = el.className.split(/\s+/).filter(k => k && !c.includes(k)).join(' ') },
      contains(k) { return el.className.split(/\s+/).includes(k) },
      toggle(k, f) { (f === undefined ? !this.contains(k) : f) ? this.add(k) : this.remove(k) }
    },
    get firstChild() { return this.children[0] || null },
    get lastChild() { return this.children[this.children.length - 1] || null },
    appendChild(c) { if (c.parent) c.parent.removeChild(c); c.parent = this; this.children.push(c); return c },
    /* insertBefore MOVE o nó: no DOM real, reinserir quem já está na lista não
       duplica. O stub só empilhava, e como `syncCells` reaproveita as mesmas
       células vazias, a caixa ficava com o MESMO objeto duas vezes. Aí o
       `while (children.length > n) last.remove()` removia a primeira cópia,
       zerava o `parent` do objeto — e a segunda cópia virava um remove() mudo:
       laço infinito, a suíte inteira pendurada sem imprimir uma linha. */
    insertBefore(c, ref) {
      if (c.parent) c.parent.removeChild(c);
      c.parent = this;
      const i = ref ? this.children.indexOf(ref) : -1;
      i >= 0 ? this.children.splice(i, 0, c) : this.children.push(c);
      return c
    },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parent = null; } },
    // remove() precisa desanexar de verdade: código que faz `while (n) el.firstChild.remove()`
    // entra em laço infinito se o stub mentir
    remove() { if (this.parent) this.parent.removeChild(this); },
    addEventListener() { }, focus() { }, blur() { }, getContext: ctx2d,
    // todo Element real tem os dois; sem querySelectorAll, qualquer render que
    // religue handlers depois de montar por innerHTML estoura só no teste
    querySelector() { return fakeEl() }, querySelectorAll() { return [] },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 })
  };
  Object.defineProperty(el, 'innerHTML', {
    get() { return el._h || '' },
    set(v) { el._h = v; el.children = v ? parseChildren(v) : []; }
  });
  return el;
}
const document = {
  querySelector: s => els.get(s) || (els.set(s, fakeEl()), els.get(s)),
  querySelectorAll: () => [], createElement: () => fakeEl(), addEventListener() { },
  documentElement: fakeEl()
};
const sandbox = {
  THREE, document, console, Math, Date, JSON, performance: { now: () => 0 },
  addEventListener() { }, requestAnimationFrame() { }, setTimeout() { },
  localStorage: (m => ({ getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }))(new Map()),
  /* sem rede aqui: a imagem nunca fica pronta, que é justamente o caminho de
     fallback que ícone de item e folha do ranger têm de saber percorrer */
  Image: class { constructor() { this.complete = false; this.naturalWidth = 0; this.src = ''; } },
  /* Path2D existe em todo navegador e o render usa um para recortar as poças.
     Sem o stub, `new Path2D()` estourava dentro de drawWorld e derrubava a suíte
     inteira no meio — as três cenas de integração e tudo que vinha depois. */
  Path2D: class { rect() { } moveTo() { } lineTo() { } arc() { } ellipse() { } closePath() { } },
  /* Sem CSS aqui: `tok()` lê os tokens de cor do :root e cacheia. Devolvendo ''
     ele cai no fallback de cada chamador, que é o caminho certo para o teste —
     o que importa é que a lógica rode, não o tom exato do pixel. Sem este stub a
     suíte estourava no meio e ~300 linhas nunca chegavam a rodar. */
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
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
    COINS, COIN_V, COIN_MONTE, moedaDe,
    expForLevel, triesFor, manaForML, SKILL_RATE, mkItem, itemStats, newPlayer, dealDamage, weaponInfo,
    damageFormula, skillOf, recalc, G, creatureSprite, TEX_DRAW, tileTexture, decoSprite, buildMinimaps, drawWorld, w2s,
    corDoCeu, ehNoite, ambienteAgora, climaAgora, souCoberto, FLOOR_AMBIENCE, silhouette, edgeShadow, cloudTexture,
    horaDoJogo, CLIMA_AVISO, poolTexture,
    TERRAIN_PRIO, OBJ_DRAW, PAREDE_DRAW, CERCA_TOP, WALL_TOP, paredeSprite, cercaSprite, escoraSprite, teiaSprite, edgeMask, _mulberry, RANGER_DIR, SHEET_POS, rangerSprite,
    SANGUE_CLASSE, SANGUE_PADRAO, SANGUE_MAX, bloodSpray, plateAnchor, resizeCam, CAM,
    itemCell, showTip, hideTip, tipCheck,
    HUNTS, huntAt, BEST_DIFF, MOB_META, bestStage, bestiaryKill, bestKills, toggleCharm, spawnCorpse, CHARM_COST, CHARM_BONUS,
    STANCE, HOT_SLOTS, useItem, castSpell, stepPlayer, hitPlayer, hotEntry, notify, updateMobs, clickTile,
    regenMobs, descLoot, save, load, changeFloor, spawnDrop, tryStep, spawnMob, removeMob, restaurarBichos,
    habilidade, impacto, cssColOu: cssCol, ELEM, RES, resistOf,
    ELITES, ELITE_CHANCE, defModificada, mixCol, SETS,
    lerpEntity, HUD_PANELS, HUD_DEF, hudApply, hudMove, hudSolta, hudLoad, luzCarregada, SLOT_POS, SLOT_LABEL, equipItem, unequip,
    playerDeath, BENCAOS, blessPrice, bagAdd, DEEP, SPAWN_POOLS,
    taskEstado, taskAceitar, taskReceber, taskProgresso, taskOfertas, nivelDe, shopNear, SKILL_NAMES, fixSave,
    POIS, poiAt, abrirTesouro, BIOMA_POOLS,
    COLETA, SKILLS_COLETA, colher, coletaDe, COLETA_EXITO, COLETA_SORTE, chaveTile, ALCANCE_TIRO, lineClear, IMBUEMENTS, imbuir, contaMat, renderForja,
    magPower, MAG_K, lootEV, lootAlvo, updateFx, virarPara, refreshSpawns, playerAttack, DIRS, DANO_TIPOS, cdDe, ATAQUE_MS,
    distAcao, emZonaSegura, ESTADOS, ESTADO_DE, aplicaEstado, tickEstados, estadoFlash, frame, tingido, FX_PERFIL, estiloEstado, estadoDaMagia, itemStats,
    mapaSerializa, mapaAplica, TILE_CHAR, CHAR_TILE, tileAt, TILE, T, CAMPO_DRAW, campoSprite, INTEL, INTEL_DESVIA, intelOf, CAMPO_DUR, CAMPO_MAX, CAMPO_FORCA, CAMPO_CHANCE, CAMPO_FASES, campoFase, campoDano, criaCampo, campoEm, tickCampos, evitaCampo, passoAte, spellTiles,
    getForjaSlot: () => forjaSlot, setForjaSlot: v => forjaSlot = v,
    getHUD: () => HUD, setHUD: v => HUD = v, getP: () => P });

  /* O templo é zona segura: lá o jogador não ataca nem é atacado. Quem for medir
     combate precisa sair de cima dele antes, senão mede a proteção, não a briga. */
  globalThis.ordemHUD = () => Object.keys(HUD.panels).sort((a, b) => HUD.panels[a].ord - HUD.panels[b].ord);
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
A(P.st.def > 0, 'armadura inicial conta na defesa — `arm` e `def` são um contador só');
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
A(todos.some(i => i.count > 1 && !S.COIN_V[i.id]), 'empilhável cai em quantidade (2 escamas, 5 flechas…)');
A(todos.some(i => S.ITEMS[i.id].slot), 'equipamento aparece no loot');
A(todos.some(i => i.id === 'dragon_scale'), 'parte do corpo aparece no loot');
A(todos.some(i => i.r > 0), 'equipamento dropado às vezes vem com afixo');
// o id do dinheiro agora depende da denominação que coube (ver moedaDe)
A(drops.filter(d => d.some(i => S.COIN_V[i.id])).length / drops.length > 0.94, 'dragão larga dinheiro em ~98% das mortes');
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
  for (const id of gg) { eqp(S.mkItem(id, 0), true); arm.push(p.st.def); hp.push(p.st.maxhp); }
  // armadura da peça e defesa da peça caem no mesmo `st.def`, então a régua é a soma dos dois
  const defBase = ids => ids.reduce((a, id) => a + (S.ITEMS[id].arm || 0) + (S.ITEMS[id].def || 0), 0);
  A(arm[0] === defBase(['gg_helmet']), 'uma peça só do conjunto não dá bônus de conjunto');
  A(arm[1] === defBase(['gg_helmet', 'gg_armor']) + 2, 'a segunda peça acende o degrau de 2 (+2 armadura)');
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
const SHAPES = ['biped', 'quadruped', 'arachnid', 'serpent', 'worm', 'dragon', 'mote'];
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
  let chovendo = 0, comSombra = 0, fora = 0, secoEMolhado = 0, chuvaSemSombra = 0;
  const estados = {};
  const n = 5000;
  for (let i = 0; i < n; i++) {
    const c = S.climaAgora(S.SURF, i * 37000);
    for (const v of [c.nublado, c.chuva, c.nuvens, c.frente, c.vento, c.raio, c.molhado, c.luz])
      if (!(v >= 0 && v <= 1)) fora++;
    if (c.chuva > 0) chovendo++;
    if (c.nuvens > .01) comSombra++;
    estados[c.estado] = (estados[c.estado] || 0) + 1;
    // chovendo, o chão tem de estar molhando e a nuvem tem de estar escura: são
    // as duas coisas que antes AFINAVAM justo quando a chuva começava
    if (c.chuva > .5 && c.molhado < .05) secoEMolhado++;
    if (c.chuva > .5 && c.nuvens < .35) chuvaSemSombra++;
  }
  A(fora === 0, `clima fica em 0..1 o tempo todo (${fora} fora)`);
  A(chovendo > n * .05 && chovendo < n * .6, `chove às vezes (${(chovendo / n * 100).toFixed(0)}% do tempo)`);
  A(comSombra > n * .2, `sombra de nuvem aparece na maior parte dos dias (${(comSombra / n * 100).toFixed(0)}%)`);
  A(secoEMolhado === 0, `temporal sempre encharca o chão (${secoEMolhado} quadros secos debaixo de chuva)`);
  A(chuvaSemSombra === 0, `a nuvem fica escura enquanto chove (${chuvaSemSombra} quadros claros)`);
  A(Object.keys(estados).every(e => S.CLIMA_AVISO[e]) && Object.keys(estados).length >= 3,
    `todo rótulo de clima tem aviso no log (${Object.keys(estados).join(', ')})`);
  A([0, 1, 2, 3].every(z => S.FLOOR_AMBIENCE[z].amb ? S.climaAgora(z).chuva === 0 && S.climaAgora(z).nuvens === 0 : true),
    'andar sem céu não tem chuva nem sombra de nuvem');
  A(S.cloudTexture() === S.cloudTexture(), 'folha de nuvem vem do cache na segunda vez');
  A(S.cloudTexture(1) !== S.cloudTexture(2), 'semente diferente dá folha de nuvem diferente');
  /* Relâmpago sai de hash do relógio, não de sorteio guardado: a MESMA hora tem
     de dar o MESMO clarão, senão ele não sobrevive ao reload nem casa entre abas */
  A([0, 1e6, 5e7].every(ms => S.climaAgora(S.SURF, ms).raio === S.climaAgora(S.SURF, ms).raio),
    'o relâmpago é função do relógio, não sorteio');
  {
    let comRaio = 0, raioSemChuva = 0;
    for (let ms = 0; ms < 9e5; ms += 60) {
      const c = S.climaAgora(S.SURF, ms);
      if (c.raio > 0) { comRaio++; if (c.chuva < .45) raioSemChuva++; }
    }
    A(comRaio > 0, `cai raio de vez em quando (${comRaio} quadros em 15 min de relógio)`);
    A(raioSemChuva === 0, 'e nunca com o céu aberto');
  }
  /* Fases do relógio têm de acompanhar a rampa do CÉU: se "Manhã" começasse
     antes de o céu clarear, o painel mentiria para quem olha pela janela */
  A(S.horaDoJogo(0).fase === 'Madrugada' && S.horaDoJogo(5 * 60000).fase === 'Tarde',
    `o relógio nomeia a fase certa (${S.horaDoJogo(5 * 60000).h}h = ${S.horaDoJogo(5 * 60000).fase})`);
  A(S.ehNoite(0.05) && S.horaDoJogo(9 * 60000).fase === 'Noite',
    'e a fase "Noite" cai junto com o céu escuro');
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
/* Duas armadilhas, as duas descobertas medindo em vez de chutando:

   1. `hitPlayer` começa com `if (G.dead) return`. Se um bloco anterior deixou o
      personagem morto, as 4000 pancadas não fazem NADA e as duas somas dão zero
      — e `0 < 0` é falso. Era essa a falha intermitente (1 em 6 execuções), não
      variância: quando falhava, def e atk vinham ambos 0. Com o jogador vivo a
      margem é enorme e estável (~40 mil contra ~90 mil).
   2. `hitPlayer` também chama addSkillTry('shielding') a todo golpe, então a
      primeira postura medida TREINAVA o personagem e a segunda era medida com
      mais escudo — a conta media a ordem de execução, não a postura.

   Por isso cada medição zera as duas coisas antes de começar. Aumentar a amostra
   não resolvia nenhuma das duas (e na segunda, piorava). */
const apanha = st => {
  vm.runInContext(`
    P.stance = '${st}';
    P.sk.shielding = { l: 10, t: 0 };   // mesmo ponto de partida nas duas medidas
    G.dead = false;                     // ver comentário acima: morto não apanha
    recalc();
  `, ctx);
  let tot = 0;
  for (let i = 0; i < 2000; i++) {
    vm.runInContext('P.hp = P.st.maxhp;', ctx);
    const a = S.getP().hp;
    vm.runInContext('hitPlayer(60, "t");', ctx);
    tot += a - S.getP().hp;
  }
  return tot;
};
const apDef = apanha('def'), apAtk = apanha('atk');
A(apDef < apAtk, `postura defensiva apanha menos (${apDef} contra ${apAtk})`);

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
  /* arena: bloco 13x13 inteiramente andável. Tem de cobrir o bicho mais distante
     da fila (dy = -5) COM folga de manobra — com 7x7 o último rato nascia fora
     da área garantida e o teste passava a medir o relevo do mapa, não a IA. */
  const aberto = (() => {
    for (let y = 7; y < H - 7; y++) for (let x = 7; x < W - 7; x++) {
      let ok = true;
      for (let j = -6; j <= 6 && ok; j++) for (let i = -6; i <= 6; i++) if (!isWalkable(x + i, y + j, SURF)) { ok = false; break; }
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
  globalThis.tilesPreso = new Set();
  for (let i = 0; i < 80; i++) { G.now += 120; updateMobs(120); tilesPreso.add(preso.x + ',' + preso.y); }
  globalThis.vagou = tilesPreso.size > 1;
  globalThis.dPreso = distT(preso.x, preso.y, P.x, P.y);
  globalThis.tiros = G.proj.length;
  for (const [i, v] of box) WORLD.floors[SURF].t[i] = v;
`, ctx);
A(S.vagou && S.dPreso > 1, `box fechada: quem bate de perto não alcança e vaga em vez de virar estátua (${S.tilesPreso.size} tiles, parou a ${S.dPreso})`);
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

/* 29b-bis. #22: jogador encostado numa parede, 14 minotauros chegando pelo mesmo
   lado. O relato era de uma criatura a 2 tiles imóvel por 9,6 s com 4 vizinhos
   livres — oscilação entre `reservarVagas` e `passoVagar`. Medido depois da
   inversão da varredura de vagas, o pior imóvel longe do jogador é ~1,3 s.
   A imortalidade é REAFIRMADA a cada tique de propósito: um `recalc()` devolve
   maxhp ao valor real, o cavaleiro morre debaixo da horda, e `G.dead` derruba o
   `chase` de TODO mundo — o que lê exatamente como "criatura travada" e faz a
   cena inteira virar falso positivo. Foi assim que a primeira medição errou. */
vm.runInContext(`
  G.mobs.length = 0; G.now += 1e5; G.dead = false;
  const tm = WORLD.floors[SURF].t;
  globalThis.paredeN = [];
  for (let dx = -4; dx <= 4; dx++) { const i = (P.y - 1) * W + (P.x + dx); paredeN.push([i, tm[i]]); tm[i] = T.ROCK; }
  const postos = [];
  for (let r = 2; r <= 4 && postos.length < 14; r++)
    for (let dx = -r; dx <= r && postos.length < 14; dx++)
      for (let dy = 0; dy <= r && postos.length < 14; dy++)
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r && isWalkable(P.x + dx, P.y + dy, SURF)) postos.push([dx, dy]);
  for (const [dx, dy] of postos) { const m = mkMob('minotaur', dx, dy); m.nextAtk = 0; }   // com briga
  const trilha = G.mobs.map(() => []);
  for (let i = 0; i < 150; i++) {
    G.dead = false; P.hp = P.st.maxhp = 1e9;
    G.now += 120; updateMobs(120);
    G.mobs.forEach((m, k) => trilha[k].push(m.x + ',' + m.y));
  }
  const livresDe = m => DIRS.filter(([dx, dy]) => isWalkable(m.x + dx, m.y + dy, P.z)
    && !G.mobs.some(o => o !== m && o.x === m.x + dx && o.y === m.y + dy)
    && !(P.x === m.x + dx && P.y === m.y + dy)).length;
  globalThis.travou = G.mobs.filter((m, k) => {
    if (distT(m.x, m.y, P.x, P.y) <= 1 || !livresDe(m)) return false;   // colado é ataque, não travamento
    let pior = 1, seq = 1;
    for (let i = 1; i < trilha[k].length; i++) { seq = trilha[k][i] === trilha[k][i - 1] ? seq + 1 : 1; if (seq > pior) pior = seq; }
    return pior * 120 >= 3000;
  }).length;
  globalThis.coladosParede = G.mobs.filter(m => distT(m.x, m.y, P.x, P.y) <= 1).length;
  for (const [i, v] of paredeN) WORLD.floors[SURF].t[i] = v;
`, ctx);
A(S.travou === 0, `#22: ninguém fica 3s+ imóvel longe do jogador com vaga livre (${S.travou} travados)`);
A(S.coladosParede >= 3, `encostado na parede ainda dá para ser cercado (${S.coladosParede} colados)`);

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

/* ---------------------------------------------------------------- moedas */
/* O que não pode acontecer nunca: o número que aparece na peça valer diferente
   do que entra em P.gold. Por isso a checagem é de ida e volta, e não de casos
   escolhidos a dedo. */
for (const v of [1, 7, 99, 100, 101, 999, 9999, 10000, 55555, 99999, 100000, 7777777]) {
  const m = S.moedaDe(v), vale = m.count * S.COIN_V[m.id];
  A(vale <= v, `moeda de ${v} não infla o valor (deu ${vale})`);
  A(v - vale < S.COIN_V[m.id], `moeda de ${v} usa a maior denominação que cabe (${m.count}x ${m.id})`);
  A(m.count >= 1, `moeda de ${v} nunca sai com zero peças`);
}
A(S.moedaDe(0).id === 'gold_coin' && S.moedaDe(0).count === 1, 'valor zero ainda dá uma peça, não some do corpo');
A(S.moedaDe(99).id === 'gold_coin' && S.moedaDe(100).id === 'platinum_coin' &&
  S.moedaDe(10000).id === 'crystal_coin', 'cada degrau troca de metal na hora certa');
A(S.COIN_V.gold === S.COIN_V.gold_coin, 'o id legado `gold` vale o mesmo que a moeda de ouro');
A(S.COIN_MONTE(1) === '1' && S.COIN_MONTE(2) === 'few' && S.COIN_MONTE(50) === 'few' &&
  S.COIN_MONTE(51) === 'many', 'o monte desenhado acompanha a quantidade');

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
  /* o ponto tem de ter vizinho andável: restaurarBichos recusa posição que não dá
     pé (senão o save devolveria bicho dentro da pedra), e um deslocamento fixo de
     +2 caía na parede dependendo do mapa */
  const sps = WORLD.spawns.filter(s => s.z === P.z && isWalkable(s.x + 2, s.y, s.z)).slice(0, 2);
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
  'o bicho vivo volta na posição e na vida em que estava: ' + JSON.stringify(S.voltou));
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
const HAB_TIPOS = ['area', 'lento', 'cura', 'mana'];
A(Object.values(S.MONSTERS).every(d => !d.hab || (d.hab.cd > 0 && HAB_TIPOS.includes(d.hab.tipo))),
  'toda habilidade tem tipo conhecido e descanso');
/* Fase de chefe: a segunda habilidade passa pelo mesmo `habilidade()`, então tem
   de obedecer às mesmas regras — e só chefe pode ter, senão vira elite disfarçado */
A(Object.values(S.MONSTERS).every(d => !d.fase || (d.boss && d.hab && d.fase.hab
  && d.fase.hab.cd > 0 && HAB_TIPOS.includes(d.fase.hab.tipo) && d.fase.hp > 0 && d.fase.hp < 1)),
  'fase de chefe é válida e exclusiva de chefe');
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
  /* Armadura absurda + golpe pequeno: DANO_MIN garante 12% do golpe bruto por
     baixo da defesa, então só um golpe de 4 ou menos chega a zerar de verdade —
     é esse o caso que vira fumaça em vez de número. */
  P.st.def = 1e6;
  hitPlayer(4, 'Rato');
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
  P.st.def = 0; P.hp = P.st.maxhp = 1e6;            // sem defesa: o corte visto aqui é só a resistência
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

/* 29c-bis. PORTA: colisão e mecânica. Nasceu de um relato de que porta não
   barrava nada — `T.DOOR` é `walk:true` na tabela, e sem estado ela era um
   buraco na parede com desenho de porta. */
vm.runInContext(`
  const px = WORLD.temple.x, py = WORLD.temple.y;
  /* Uma casinha de teste ao lado do templo — e o terreno é DEVOLVIDO no fim.
     A primeira versão não devolvia, e três blocos adiante o teste da área de
     fogo passou a falhar porque as paredes continuavam lá: estado de mundo
     compartilhado é a mesma armadilha que a seção "Armadilhas conhecidas"
     documenta para estado inicial de assertiva probabilística. */
  const zz = WORLD.temple.z, T0 = WORLD.floors[zz].t;
  const antes = [];
  const põe = (x, y, t) => { antes.push([x, y, T0[y * W + x]]); T0[y * W + x] = t; };
  for (let i = -1; i <= 1; i++) { põe(px + 4 + i, py - 1, T.WALL); põe(px + 4 + i, py + 1, T.WALL); }
  põe(px + 3, py, T.WALL); põe(px + 5, py, T.FLOOR); põe(px + 4, py, T.DOOR);
  globalThis.rFechada = isWalkable(px + 4, py, zz);
  /* PORTA FECHADA TAPA A VISTA. Sem isto ela barrava o pé e não barrava mais
     nada: dava para flechar e queimar através dela, e o bicho do outro lado
     enxergava o jogador e vinha. Foi o segundo relato do dono do projeto sobre
     a mesma porta, e é o que separa "obstáculo" de abrigo. */
  globalThis.rVistaFechada = lineClear(px + 5, py, px + 3, py, zz);
  usaPorta(px + 4, py, zz);
  globalThis.rAberta  = isWalkable(px + 4, py, zz);
  globalThis.rVistaAberta = lineClear(px + 5, py, px + 3, py, zz);
  usaPorta(px + 4, py, zz);
  globalThis.rFechaDeNovo = isWalkable(px + 4, py, zz);
  /* ANDAR CONTRA A PORTA NÃO ABRE. Houve uma versão em que abria, e o dono do
     projeto reprovou: a porta se abria sozinha ao passar e o jogador nem
     percebia que tinha aberto, o que a esvazia de função contra o que vem
     atrás. Abrir é gesto de propósito — Ctrl + clique. */
  P.x = P.px = px + 5; P.y = P.py = py; P.z = zz; P.nextStep = 0;
  globalThis.rAndouNaoAbriu = (tryStep(P, px + 4, py) === false) && !portaAberta(px + 4, py, zz);
  globalThis.rNaoAtravessou = P.x === px + 5;
  /* E o caminho do jogador NÃO atravessa porta fechada: prometer passagem por
     onde está fechado é pior que dizer que não dá para chegar. */
  globalThis.rCaminhoBarra = findPath(px + 5, py, px + 3, py, zz) === null;
  for (const [x, y, t] of antes) T0[y * W + x] = t;   // devolve o chão
  WORLD.portas = new Set();
`, ctx);
A(S.rAndouNaoAbriu === true, 'andar contra a porta fechada NÃO abre: abrir é gesto de propósito');
A(S.rNaoAtravessou === true, 'e o passo não passa');
A(S.rFechada === false, 'porta nasce FECHADA e barra o passo');
A(S.rAberta === true, 'e abre');
A(S.rFechaDeNovo === false, 'e fecha de novo — as duas metades, senão passa uma porta que só abre');
/* As duas juntas, e é a segunda que pega o defeito relatado: só barrar o pé
   deixa passar flecha, magia e o olhar do bicho. */
A(S.rVistaFechada === false, 'porta fechada corta a linha: nada de flechar nem enxergar através dela');
A(S.rVistaAberta === true, 'e aberta o vão é vão');
A(S.rCaminhoBarra === true, 'o caminho do jogador não atravessa porta fechada');
/* E o terceiro relato: aberta e fechada tinham o MESMO desenho, então abrir não
   mudava nada na tela e o jogador só descobria tentando passar. Duas texturas
   distintas, e as duas com rotina e com prioridade de borda — sem prioridade o
   tile cai calado no 0 e some sob a borda de qualquer vizinho. */
A(!!S.TEX_DRAW.door && !!S.TEX_DRAW.door_open, 'porta aberta e fechada têm desenhos distintos');
A(S.TERRAIN_PRIO.door_open !== undefined, 'e a porta aberta tem prioridade de borda');

/* 29c-quater. O MAPA MUDA EMBAIXO DO PERSONAGEM. Desde que existe editor de
   mapas, a terra muda entre uma sessao e outra — e o primeiro lugar que se
   pinta por cima e justamente onde o personagem parou, porque e para la que se
   olha. O save guarda a posicao crua; sem resgate ele acorda DENTRO da parede,
   e cercado fica preso num save que nao tem conserto de dentro do jogo. */
vm.runInContext(`
  const zRes = WORLD.temple.z, tRes = WORLD.floors[zRes].t;
  const bxRes = WORLD.temple.x, byRes = WORLD.temple.y;
  const antesRes = [];
  const poeRes = (x, y, t) => { antesRes.push([x, y, tRes[y * W + x]]); tRes[y * W + x] = t; };
  // soterra o personagem: o tile dele e os oito em volta viram parede
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) poeRes(bxRes + i, byRes + j, T.SWALL);
  globalThis.rSoterrado = !isWalkable(bxRes, byRes, zRes);
  const achRes = chaoMaisPerto(bxRes, byRes, zRes);
  globalThis.rAchou = !!achRes && isWalkable(achRes[0], achRes[1], zRes);
  globalThis.rPerto = achRes ? Math.max(Math.abs(achRes[0] - bxRes), Math.abs(achRes[1] - byRes)) : -1;
  // quem esta em chao bom NAO e movido
  globalThis.rNaoMexe = chaoMaisPerto(achRes[0], achRes[1], zRes) === null;
  // coordenada fora do mapa tambem tem de ser resgatada
  globalThis.rFora = !!chaoMaisPerto(W + 50, H + 50, zRes);
  for (const [x, y, t] of antesRes) tRes[y * W + x] = t;
`, ctx);
A(S.rSoterrado === true, 'o cenário do teste soterra mesmo o personagem');
A(S.rAchou === true, 'quem foi soterrado pela edição do mapa é posto em chão andável');
A(S.rPerto === 2, 'e no anel mais próximo que tem chão, não em qualquer lugar');
/* A outra metade, e é ela que impede o conserto de virar defeito: resgate que
   move quem está bem teleportaria o personagem a cada carregamento. */
A(S.rNaoMexe === true, 'e quem está em chão bom não é movido');
A(S.rFora === true, 'coordenada fora do mapa também é resgatada — a terra pode encolher');

/* 29d. velocidade por natureza: a régua do jogador é 220 */
{
  const M = S.MONSTERS, v = k => M[k].spd;
  A(v('wolf') - v('bug') >= 60, `a natureza pesa: lobo x besouro (${v('wolf')} x ${v('bug')})`);
  A(v('dragon') > v('orc') + 30, `dragão não anda como orc (${v('dragon')} x ${v('orc')})`);
  A(['bug', 'rotworm', 'cyclops', 'skeleton', 'ghoul'].every(k => v(k) < 220), 'os pesados ficam abaixo do jogador');
  /* Esta linha dizia o CONTRÁRIO até 2026-08-23 — afirmava que os caçadores
     partem de 245, "acima da régua 220 do jogador" — e com isso travava o
     defeito no lugar em vez de guardar contra ele. Escapar a pé é o modelo que
     o data.js diz seguir, e medido, 68 das 83 criaturas passavam um jogador de
     nível 1: rato, lebre e cervo inclusive. Teste que afirma o número errado é
     pior que teste nenhum, porque dá cobertura ao que devia acusar. */
  A(Object.values(M).filter(d => d.tier <= 2).every(d => d.spd < 220),
    'nenhuma criatura de tier 0 a 2 passa o jogador nível 1: escapar a pé existe desde o começo');
  /* Mesmo tier, três naturezas: é assim que se afirma "a natureza pesa" sem
     cravar número, e sem deixar alguém achatar as classes ao recalibrar. */
  A(v('wolf') > v('orc') && v('orc') > v('fire_beetle'),
    `no mesmo tier, caçador > andarilho > peso morto (${v('wolf')}/${v('orc')}/${v('fire_beetle')})`);
  A(Object.values(M).some(d => d.spd > 325) &&
    Object.values(M).filter(d => d.spd > 325).every(d => d.tier >= 10),
    'e só o tier alto alcança um knight nível 300 — as duas metades, senão passa um mundo onde nada corre');
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
// lado/coluna/ordem viraram arraste; hudMove só alterna os liga-desliga
vm.runInContext("hudSolta('bag', 'l', 0, ordemHUD(), 0);", ctx);
A(S.getHUD().panels.bag.dock === 'l', 'arrastar para o outro lado move o painel de sidebar');
vm.runInContext("hudMove('bag', 'show');", ctx);
A(S.getHUD().panels.bag.show === false, 'fechar esconde o painel');
const salvo = JSON.parse(S.localStorage.getItem('thaira.hud') || 'null');
A(salvo && salvo.panels.bag.dock === 'l' && salvo.panels.bag.show === false, 'layout fica salvo no localStorage');
const ordAntes = S.getHUD().panels.skills.ord;
vm.runInContext("hudSolta('skills', HUD.panels.skills.dock, HUD.panels.skills.col, ordemHUD(), 0);", ctx);
A(S.getHUD().panels.skills.ord === 0 && ordAntes !== 0, `soltar em outra posição reordena a coluna (${ordAntes} → 0)`);
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
A(S.luzCarregada().r === S.ITEMS.torch.luz, 'tocha equipada ilumina');
A(S.luzCarregada().magica === false, 'e o halo dela é de chama, não de magia');
vm.runInContext("unequip('light');", ctx);
A(S.luzCarregada().r === 0, 'tocha na mochila não acende nada — tem de estar no slot');
A(Pl.bag.some(b => b.id === 'torch'), 'e ela volta para a mochila, não some');
Pl.buffs.light = { val: 4 };
A(S.luzCarregada().r === 4 && S.luzCarregada().magica, 'a magia de luz ilumina sozinha, sem item');
vm.runInContext("equipItem(P.bag.find(b => b.id === 'torch'));", ctx);
const luzMista = S.luzCarregada();
A(luzMista.r === S.ITEMS.torch.luz, 'com tocha e magia fraca vale a MAIOR, não a soma');
A(luzMista.magica === false, 'e quem vence a comparação também decide a cor do halo');
Pl.buffs.light = null;
A(S.itemStats(Pl.eq.light).slot === 'light', 'a tocha só cabe no slot de luz');

/* 25. morte que dói: exp cai, nível pode cair junto, suprimento queima e quem
   morre sem bênção larga uma peça. É a régua de risco do jogo — se ela voltar a
   ser de graça, hunt acima da faixa vira tentativa sem custo e o endgame some. */
/* `expBase` é onde DENTRO do nível o personagem estava. Importa: quem morre com
   a barra quase cheia perde menos níveis que quem acabou de subir, porque a
   perda é fração da exp TOTAL e o começo do nível não tem folga nenhuma abaixo.
   O padrão é o topo do nível (garante queda de pelo menos um). */
const morte = (bless, lvl = 40, expBase = `expForLevel(${lvl} + 1) - 1`) => {
  vm.runInContext(`
    newPlayer('Defunto', 'knight');
    P.level = ${lvl}; P.exp = ${expBase}; P.bless = ${bless};
    bagAdd(mkItem('health_potion', 0, 20)); bagAdd(mkItem('rune_sd', 0, 3)); bagAdd(mkItem('bone', 0, 5));
    globalThis.antes = { exp: P.exp, lvl: P.level, eq: Object.values(P.eq).filter(Boolean).length, bag: P.bag.length };
    G.dead = false; playerDeath('teste');
  `, ctx);
  const p = S.getP();
  return { antes: S.antes, exp: p.exp, lvl: p.level, bless: p.bless, bag: p.bag.slice(), eq: Object.values(p.eq).filter(Boolean).length };
};
{
  const sem = morte(0), com = morte(S.BENCAOS);
  A(sem.exp < sem.antes.exp * 0.905 && sem.exp > sem.antes.exp * 0.895, `sem bênção perde 10% da exp (${sem.antes.exp} → ${sem.exp})`);
  A(com.exp > sem.exp, `bênção reduz a perda de exp (${sem.exp} → ${com.exp})`);
  A(sem.lvl < sem.antes.lvl, `a exp perdida DERRUBA o nível (${sem.antes.lvl} → ${sem.lvl})`);
  /* Quanto o nível cai, exatamente. Sem esta régua o teste só dizia "caiu", e
     "caiu" cobre tanto o certo quanto uma queda de 45 níveis — que foi o susto
     que uma sonda de teste deu ao forçar P.level sem tocar em P.exp. O nível
     depois da morte tem de ser o que a exp restante vale, nem mais nem menos.
     Os números são a curva cúbica do Tibia: no 60 caem 3, no 200 caem 7, e a
     bênção corta isso pra 1 e 3. Se mexerem em expForLevel ou na fração de
     perda, é aqui que estoura. */
  const nivelReal = exp => { let l = 1; while (S.expForLevel(l + 1) <= exp) l++; return l; };
  const base = lvl => `expForLevel(${lvl})`;      // acabou de subir: o pior caso
  for (const [lvl, esperadoSem, esperadoCom] of [[60, 3, 1], [100, 4, 1], [200, 7, 3]]) {
    const s = morte(0, lvl, base(lvl)), c = morte(S.BENCAOS, lvl, base(lvl));
    A(s.lvl === nivelReal(s.exp), `nv ${lvl}: o nível depois da morte é o que a exp restante vale (${s.lvl})`);
    A(lvl - s.lvl === esperadoSem, `nv ${lvl} sem bênção cai ${esperadoSem} nível(is) — caiu ${lvl - s.lvl}`);
    A(lvl - c.lvl === esperadoCom, `nv ${lvl} com bênção cai ${esperadoCom} nível(is) — caiu ${lvl - c.lvl}`);
    // morrer com a barra cheia dói menos que morrer recém-subido
    A(lvl - morte(0, lvl).lvl <= esperadoSem, `nv ${lvl}: morrer com a barra cheia não custa mais que recém-subido`);
  }
  A(sem.bag.length === 0, `sem bênção a mochila inteira fica no corpo (sobraram ${sem.bag.length})`);
  A(com.bag.length === com.antes.bag, `as bênçãos seguram a mochila inteira (${com.bag.length}/${com.antes.bag})`);
  A(sem.eq === sem.antes.eq, 'com mochila para perder, o equipamento não é tocado');
  A(com.eq === com.antes.eq, 'com bênção o equipamento fica inteiro');
  /* Mochila vazia não pode virar morte de graça: aí a peça equipada mais cara é
     que cai. É o outro lado da regra acima, e sem esta linha ninguém a protege. */
  vm.runInContext(`
    newPlayer('Pelado', 'knight');
    P.level = 40; P.exp = expForLevel(41) - 1; P.bless = 0; P.bag.length = 0;
    globalThis.eqPelado = Object.values(P.eq).filter(Boolean).length;
    G.dead = false; playerDeath('teste');
  `, ctx);
  const eqDepois = Object.values(S.getP().eq).filter(Boolean).length;
  A(eqDepois === S.eqPelado - 1, `mochila vazia: aí sim larga uma peça equipada (${S.eqPelado} → ${eqDepois})`);
  A(sem.bless === 0 && com.bless === 0, 'as bênçãos somem na morte, com ou sem');
  A(S.blessPrice(100) > S.blessPrice(40), 'a bênção fica mais cara conforme o nível sobe');
  // nível 1 não pode cair para 0 nem para exp negativa
  const bebe = morte(0, 1);
  A(bebe.lvl === 1 && bebe.exp >= 0, 'nível 1 não cai abaixo de 1 nem fica com exp negativa');
}

/* 26. andares novos: o endgame tem onde morar e nada dele vaza pra superfície */
{
  const fundos = S.HUNTS.filter(h => h.z >= S.DEEP);
  A(S.FLOORS === 6 && fundos.length >= 3, `os andares de endgame existem e têm hunt (${fundos.length})`);
  A(fundos.every(h => h.lvl >= 100), 'toda hunt de andar fundo é de nível alto');
  const rasos = new Set(S.SPAWN_POOLS[1].flatMap(p => p.mobs).concat(S.SPAWN_POOLS[0][0].mobs));
  /* Dragão e afins já eram 'challenging' na montanha desde antes — a régua aqui
     é a faixa NOVA: nada de 'Pesadelo' pode vazar para andar de cima, senão o
     nível 20 encontra um Colosso indo caçar lobo. */
  A(![...rasos].some(id => S.MONSTERS[id].diff === 'nightmare'),
    'nenhuma criatura de Pesadelo nasce na superfície nem na montanha');
  A(S.SPAWN_POOLS[5][0].mobs.every(id => S.MONSTERS[id].diff === 'nightmare'),
    'o Coração do Abismo só tem criatura de Pesadelo');
}

/* 27. contratos de caça: o laço templo → hunt → templo. O contador é o mesmo do
   bestiário, então o que este teste protege é o CERCO — aceitar e receber só no
   templo, e a base de contagem gravada na hora do aceite (sem ela, quem já matou
   500 minotauros ganharia o contrato de 200 já cumprido). */
{
  vm.runInContext(`
    newPlayer('Contratado', 'knight');
    P.level = 100; P.gold = 0; P.charm = 0; P.tasks = null;
    P.best = { minotaur: 400, dragon: 30 };
    P.x = WORLD.temple.x + 2; P.y = WORLD.temple.y + 2; P.z = SURF;
    globalThis.ofertas = taskEstado().ofertas;
  `, ctx);
  A(S.ofertas.length > 0 && S.ofertas.every(o => S.MONSTERS[o.mob] && o.alvo > 0 && o.ouro > 0),
    `o quadro oferece contratos válidos (${S.ofertas.length})`);
  A(S.ofertas.every(o => S.getP().best[o.mob] > 0), 'só oferece criatura que o jogador já matou');

  // fora do templo não se aceita
  vm.runInContext('P.x = 20; P.y = 20; taskAceitar(0);', ctx);
  A(!S.getP().tasks.ativo, 'contrato não é aceito longe do templo');

  vm.runInContext('P.x = WORLD.temple.x + 2; P.y = WORLD.temple.y + 2; taskAceitar(0);', ctx);
  const at = S.getP().tasks.ativo;
  A(at && at.base === S.getP().best[at.mob], 'aceitar grava a contagem de partida (mortes velhas não valem)');
  A(S.taskProgresso(at) === 0, 'contrato começa em zero mesmo com 400 mortes no bestiário');

  // cumpre, tenta receber longe, depois perto
  vm.runInContext(`for (let i = 0; i < P.tasks.ativo.alvo; i++) bestiaryKill(P.tasks.ativo.mob);`, ctx);
  A(S.taskProgresso(S.getP().tasks.ativo) === at.alvo, 'as mortes contam para o contrato');
  vm.runInContext('P.x = 20; P.y = 20; taskReceber();', ctx);
  A(S.getP().tasks.ativo && S.getP().gold === 0, 'não paga longe do templo');
  // carisma tem de ser medido em DELTA: as mortes do contrato também completam
  // entradas do bestiário, e essas rendem carisma por conta própria
  vm.runInContext(`P.x = WORLD.temple.x + 2; P.y = WORLD.temple.y + 2;
    globalThis.expAntes = P.exp; globalThis.charmAntes = P.charm; taskReceber();`, ctx);
  const P4 = S.getP();
  A(!P4.tasks.ativo && P4.tasks.feitos === 1, 'entregar no templo fecha o contrato');
  A(P4.gold === at.ouro && P4.charm - S.charmAntes === at.carisma && P4.exp - S.expAntes >= at.exp,
    `paga ouro, carisma e exp (${P4.gold} 🪙 · +${P4.charm - S.charmAntes} carisma)`);
  A(P4.tasks.ofertas && P4.tasks.ofertas.length > 0, 'o quadro se reabastece depois da entrega');
  // teto do carisma: 3 presas custam 300, então nenhum contrato pode pagar isso sozinho
  A(S.taskOfertas().every(o => o.carisma <= S.CHARM_COST), 'nenhum contrato paga uma presa inteira de uma vez');
}

/* 28. POIs: existem, não pisam nas hunts, têm guarda em volta, e o tesouro abre
   UMA vez. O uma-vez é o que este teste protege — sem ele o POI vira uma máquina
   de ouro infinita que se saqueia andando em círculo em cima do mesmo tile. */
{
  const ps = S.WORLD.pois;
  A(ps.length >= 30, `o mundo tem pontos de interesse (${ps.length})`);
  A(ps.every(p => typeof p.z === 'number' && S.POIS.find(d => d.id === p.id).z.includes(p.z)),
    'todo POI está num andar previsto pelo molde dele');
  A(ps.every(p => S.isWalkable(p.x, p.y, p.z)), 'o centro de todo POI é andável');
  A(ps.every(p => !S.huntAt(p.x, p.y, p.z)), 'nenhum POI cai dentro de hunt');
  A(ps.every(p => S.distT(p.x, p.y, S.WORLD.temple.x, S.WORLD.temple.y) >= 22 || p.z !== S.SURF),
    'nenhum POI colado no templo');
  A(new Set(ps.map(p => p.uid)).size === ps.length, 'cada POI tem identidade própria (o saque é por uid)');
  const guardas = S.WORLD.spawns.filter(s => s.poi);
  A(guardas.length > 40, `os POIs têm guarda em volta (${guardas.length} pontos)`);
  A(guardas.every(s => { const p = ps.find(p => p.uid === s.poi); return p && p.mobs.includes(s.m); }),
    'guarda de POI é da família do POI');

  vm.runInContext(`
    newPlayer('Saqueador', 'knight');
    const p = WORLD.pois[0];
    P.z = p.z; P.x = p.x; P.y = p.y; P.seen = {};
    G.drops.length = 0; abrirTesouro(p);
    globalThis.primeiro = G.drops.length;
    abrirTesouro(p); abrirTesouro(p);
    globalThis.depois = G.drops.length;
    globalThis.noChao = G.drops.every(d => isWalkable(d.x, d.y, d.z) && distT(d.x, d.y, p.x, p.y) <= 1);
  `, ctx);
  A(S.primeiro > 0, `o tesouro larga item ao ser aberto (${S.primeiro})`);
  A(S.depois === S.primeiro, 'abrir de novo não larga mais nada — o POI é de uma vez só');
  A(S.noChao, 'o tesouro cai no chão em volta, em tile andável (mochila cheia não come nada)');
}

/* 29. biomas: tundra e pântano existem na superfície e têm fauna própria */
{
  const conta = t => { let n = 0; const f = S.WORLD.floors[S.SURF].t; for (let i = 0; i < f.length; i++) if (f[i] === t) n++; return n; };
  A(conta(S.T.SNOW) > 200 && conta(S.T.SWAMP) > 200, `tundra e pântano existem (${conta(S.T.SNOW)} / ${conta(S.T.SWAMP)} tiles)`);
  A(Object.values(S.BIOMA_POOLS).every(pools => pools.every(p => p.mobs.every(id => S.MONSTERS[id]))),
    'toda fauna de bioma é criatura de verdade');
  A(Object.values(S.TILE).every(t => !t.tex || S.TEX_DRAW[t.tex]), 'os tiles novos têm rotina de desenho');
}

/* 29b. arma de endgame tem de ser melhor que TUDO abaixo dela.
   A régua vale só para os conjuntos `sa` e `vz` — nos conjuntos do meio do jogo
   (gg, ns, ah…) a peça é de propósito um pouco mais fraca que a melhor arma solta
   da faixa, porque ela paga em bônus de conjunto e existe alternativa fora dele.
   Acima do nível 50 NÃO existe alternativa: se a peça do conjunto não ganhar de
   tudo que veio antes, aquela vocação simplesmente nunca troca de arma — foi o
   que aconteceu com o Arco da Sentinela (44 contra os 45 da Besta Real). */
{
  const pot = i => i.atk || (i.dmg ? (i.dmg[0] + i.dmg[1]) / 2 : 0);
  const armas = Object.values(S.ITEMS).filter(i => i.slot === 'weapon');
  const ruins = armas.filter(i => (i.set === 'sa' || i.set === 'vz')).filter(i =>
    armas.some(o => o.wt === i.wt && (o.lvl || 0) < (i.lvl || 0) && pot(o) >= pot(i)));
  A(!ruins.length, 'toda arma de endgame ganha de tudo que vem abaixo dela: '
    + (ruins.map(i => `${i.n} (nv${i.lvl}, ${pot(i)})`).join(', ') || 'ok'));
}

/* 29c. arma que não se compra nem cai NÃO EXISTE. Cinco varinhas e uma besta
   estavam declaradas na tabela e fora de toda loja e de toda lista de loot — o
   druida chegava ao nível 25 ainda com o cajado do nível 6 porque literalmente
   não havia caminho até o próximo. É o defeito mais barato de cometer de novo:
   basta declarar um item e esquecer de plugar. */
{
  const noLoot = new Set();
  Object.values(S.MONSTERS).forEach(m => m.loot.forEach(([id]) => noLoot.add(id)));
  const naLoja = new Set(S.SHOP_STOCK);
  const orfas = Object.values(S.ITEMS).filter(i => i.slot === 'weapon' && !naLoja.has(i.id) && !noLoot.has(i.id));
  A(!orfas.length, 'toda arma tem como ser obtida (loja ou loot): '
    + (orfas.map(i => `${i.n} (nv${i.lvl || 0})`).join(', ') || 'ok'));

  /* Sem buraco maior que 12 níveis na linha de cada vocação. O ranger passava 26
     níveis sem arma nova e o mago 20 — a ficha dizia que ele evoluía e a mão
     dizia que não. 12 é aproximadamente o tempo de uma faixa de hunt. */
  const pot = i => i.atk || (i.dmg ? (i.dmg[0] + i.dmg[1]) / 2 : 0);
  for (const [wt, voc] of [['distance', null], ['wand', 'sorcerer'], ['wand', 'druid']]) {
    const l = Object.values(S.ITEMS)
      .filter(i => i.slot === 'weapon' && i.wt === wt && (!voc || !i.voc || i.voc.includes(voc)))
      .sort((a, b) => (a.lvl || 0) - (b.lvl || 0));
    // só conta degrau quem é de fato mais forte que tudo que veio antes
    const degraus = []; let melhor = 0;
    for (const i of l) if (pot(i) > melhor) { melhor = pot(i); degraus.push(i); }
    const buracos = degraus.slice(1)
      .map((i, x) => [degraus[x], i, (i.lvl || 0) - (degraus[x].lvl || 0)])
      .filter(([, , d]) => d > 12);
    A(!buracos.length, `${wt}${voc ? '/' + voc : ''}: nenhum buraco maior que 12 níveis — `
      + (buracos.map(([a, b, d]) => `${a.n} nv${a.lvl} → ${b.n} nv${b.lvl} (${d})`).join('; ') || 'ok'));
  }
}

/* 30. coleta: pedra, árvore e água viram recurso, o tile se esgota e a skill sobe.
   O esgotamento é o que este teste guarda — sem ele o jogador fica num tile só
   clicando, e mineração deixa de ser uma coisa a fazer no mundo. */
{
  A(S.SKILLS_COLETA.every(k => S.SKILL_NAMES && S.COLETA[k]
    && Object.values(S.VOCATIONS).every(v => v.sk[k] > 0)),
    'toda skill de coleta tem nome, curva por vocação e tabela');
  A(Object.values(S.VOCATIONS).every(v => S.SKILLS_COLETA.every(k => v.sk[k] === S.VOCATIONS.knight.sk[k])),
    'nenhuma vocação colhe melhor que outra — coleta não é ofício de classe');
  A(Object.values(S.COLETA).every(c => c.tab.every(([id, ch, lv]) => S.ITEMS[id] && ch > 0 && lv >= 10)),
    'toda linha de colheita aponta pra item real, com chance e nível');
  A(Object.values(S.COLETA).every(c => c.tab.some(([, , lv]) => lv <= 10)),
    'toda coleta rende alguma coisa já no nível inicial');
  A(Object.values(S.COLETA).every(c => c.tiles.every(t => S.T[t] !== undefined)),
    'todo tile de coleta existe na tabela de terreno');

  A(Object.values(S.COLETA).every(c => c.ferramenta && c.ferramenta.length && c.ferramenta.every(id => S.ITEMS[id] && S.ITEMS[id].slot === 'weapon')),
    'toda coleta exige ferramenta, e toda ferramenta é item de slot de arma');
  A(Object.values(S.COLETA).every(c => c.n && c.v && c.n !== c.v),
    'toda coleta tem infinitivo e terceira pessoa — com um só dava "Você minerar e obtém"');
  /* §17: emoji não é ícone de gameplay. O log de coleta abria com ⛏️/🪓/🎣. */
  A(!JSON.stringify(S.COLETA).match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u),
    'nenhuma coleta carrega emoji — o log fala por escrito');
  A(Object.values(S.COLETA).every(c => c.ferramenta.some(id => S.SHOP_STOCK.includes(id))),
    'a ferramenta de todo ofício se compra na loja — ofício não pode depender de sorte no drop');
  /* A tabela é lida da mais rara para a mais comum e a última linha é o consolo:
     escrita fora de ordem, a rara nunca sairia (a comum casaria antes). */
  A(Object.values(S.COLETA).every(c => c.tab.every((l, i) => !i || l[1] >= c.tab[i - 1][1])),
    'toda tabela de colheita vai da linha mais rara para a mais comum');
  A(Object.values(S.COLETA).every(c => c.tab[c.tab.length - 1][2] <= 10 && c.tab[c.tab.length - 1][1] >= 1),
    'a última linha é o consolo: nível inicial e chance cheia');
  /* Minerar não pode voltar a ser infinito: caverna é feita de CWALL, e com ela
     na lista havia 46.899 tiles mineráveis contra ~3.500 de árvore e de água. */
  A(!S.COLETA.mining.tiles.includes('CWALL'),
    'parede de caverna não é minerável — era o único recurso sem fim do jogo');

  vm.runInContext(`
    newPlayer('Colhedor', 'knight'); P.bag.length = 0; G.drops.length = 0; G.now = 5e6;
    globalThis.pontos = {};
    for (const [nome, tt] of [['mining', T.ROCK], ['woodcut', T.TREE], ['fishing', T.WATER]]) {
      for (let y = 5; y < H - 5 && !pontos[nome]; y++) for (let x = 5; x < W - 5; x++) {
        if (tileAt(x, y, SURF) !== tt) continue;
        const v = DIRS.map(([dx, dy]) => [x + dx, y + dy]).find(([a, b]) => isWalkable(a, b, SURF));
        if (v) { pontos[nome] = { x, y, v }; break; }
      }
    }
    /* Uma tentativa: leva o jogador ao ponto, zera o relógio da ação e devolve o
       que mudou. \`limpa\` apaga a marca de esgotado para a próxima tentativa cair
       num ponto fresco — o que este teste mede é o sorteio, não o descanso. */
    globalThis.tentar = (nome, ferramenta, nivel, limpa) => {
      const p = pontos[nome];
      P.z = SURF; P.x = P.px = p.v[0]; P.y = P.py = p.v[1];
      P.eq.weapon = ferramenta ? mkItem(ferramenta) : null;
      /* Zera as tentativas junto com o nível: \`addSkillTry\` zera \`t\` ao subir de
         habilidade, e sem isto o teste forçava nível 40 com \`t\` acumulando, subia
         de nível dentro da própria medição e apagava o treino que queria medir. */
      if (nivel) { P.sk[nome].l = nivel; P.sk[nome].t = 0; }
      const k = chaveTile(p.x, p.y, SURF);
      if (limpa && P.colhido) delete P.colhido[k];
      const antes = P.bag.length, tAntes = P.sk[nome].t;
      G.colheitaCd = 0; colher(p.x, p.y);
      return { ganhou: P.bag.length - antes, treinou: P.sk[nome].t - tAntes, gasto: !!(P.colhido && P.colhido[k]) };
    };
    globalThis.FERR = { mining: 'pickaxe', woodcut: 'axe', fishing: 'fishing_rod' };
    globalThis.semFerr = {}, globalThis.comFerr = {}, globalThis.treinouFalhando = {};
    for (const nome in FERR) {
      P.bag.length = 0;
      semFerr[nome] = tentar(nome, null, 40, true);
      /* Com ferramenta o êxito é sorteado, então uma tentativa não prova nada:
         100 delas provam. Sem ferramenta, ZERO é a regra — uma basta. */
      let ganhos = 0, tentativas = 0, falhouSemGastar = 0, treinos = 0;
      for (let i = 0; i < 100; i++) {
        const r = tentar(nome, FERR[nome], 40, true);
        tentativas++; ganhos += r.ganhou; treinos += r.treinou > 0 ? 1 : 0;
        if (!r.ganhou && !r.gasto) falhouSemGastar++;
        P.bag.length = 0;
      }
      comFerr[nome] = { ganhos, tentativas, falhouSemGastar, treinos };
    }
    /* Raridade pela skill: mesma tabela, mesmo ponto, skill 10 contra skill 90.
       Mede o valor médio do que saiu — se a skill não pesar, os dois empatam. */
    globalThis.valorPorSkill = nivel => {
      P.bag.length = 0;
      let soma = 0, n = 0;
      for (let i = 0; i < 400; i++) {
        const r = tentar('mining', 'pickaxe', nivel, true);
        if (r.ganhou) { const it = P.bag[P.bag.length - 1]; soma += (ITEMS[it.id].sell || 0) * (it.count || 1); n++; }
        P.bag.length = 0;
      }
      return n ? soma / n : 0;
    };
    globalThis.vBaixo = valorPorSkill(10);
    globalThis.vAlto = valorPorSkill(90);
  `, ctx);
  for (const k of ['mining', 'woodcut', 'fishing']) {
    const sem = S.semFerr[k], com = S.comFerr[k];
    A(sem.ganhou === 0 && !sem.gasto, `${k}: sem a ferramenta não colhe nem gasta o ponto`);
    A(com.ganhos > 20 && com.ganhos < com.tentativas, `${k}: colher às vezes rende e às vezes falha (${com.ganhos}/${com.tentativas})`);
    A(com.treinos === com.tentativas, `${k}: treina a habilidade mesmo na tentativa que falha`);
    A(com.falhouSemGastar > 0, `${k}: falhar NÃO esgota o ponto (${com.falhouSemGastar} falhas sem gastar)`);
  }
  /* Alcance: a vara pesca de longe, como o arco; picareta e machado exigem
     encostar. O número é o MESMO do tiro de propósito — quem mexer num tem de
     ver o outro andar junto. */
  A(S.COLETA.fishing.alcance === S.ALCANCE_TIRO && S.COLETA.fishing.alcance > 1,
    `a vara alcança o mesmo que o arco (${S.COLETA.fishing.alcance} tiles)`);
  A(S.COLETA.mining.alcance === 1 && S.COLETA.woodcut.alcance === 1,
    'picareta e machado só trabalham no tile encostado');
  vm.runInContext(`(() => {
    P.eq.weapon = mkItem('fishing_rod'); P.sk.fishing.l = 90;   // êxito alto: mede alcance, não sorte
    /* A água de \`pontos.fishing\` é a borda do oceano, onde tudo em volta também
       é água — dali não existe posto a 3 tiles. Procura uma margem de verdade:
       tile de água com chão firme a 2+ tiles e linha limpa até ele. */
    let posto = null, alvo = null;
    for (let y = 5; y < H - 5 && !posto; y++) for (let x = 5; x < W - 5 && !posto; x++) {
      if (tileAt(x, y, SURF) !== T.WATER) continue;
      for (let dy = -4; dy <= 4 && !posto; dy++) for (let dx = -4; dx <= 4; dx++) {
        const nx = x + dx, ny = y + dy, d = distT(nx, ny, x, y);
        if (d >= 2 && d <= 4 && isWalkable(nx, ny, SURF) && lineClear(nx, ny, x, y, SURF)) {
          posto = [nx, ny, d]; alvo = [x, y]; break;
        }
      }
    }
    let semAndar = 0, andou = false;
    if (posto) for (let i = 0; i < 40; i++) {
      P.z = SURF; P.x = P.px = posto[0]; P.y = P.py = posto[1]; P.stepD = 0;
      if (P.colhido) delete P.colhido[chaveTile(alvo[0], alvo[1], SURF)];
      P.bag.length = 0; G.colheitaCd = 0; G.path = null; G.pendingColheita = null;
      colher(alvo[0], alvo[1]);
      if (G.path) { andou = true; break; }        // pediu para andar: não alcançou de longe
      if (P.bag.length) semAndar++;
    }
    globalThis.pescaLonge = { dist: posto && posto[2], semAndar, andou, achou: !!posto };
  })();`, ctx);
  A(S.pescaLonge.achou, 'achou um posto de pesca a 2+ tiles da água com linha limpa');
  A(!S.pescaLonge.andou, 'pescar de longe não manda o personagem andar até a margem');
  A(S.pescaLonge.semAndar > 10, `a vara pesca a ${S.pescaLonge.dist} tiles sem sair do lugar (${S.pescaLonge.semAndar}/40)`);

  /* As duas metades do pedido, juntas: uma sem a outra deixaria metade da curva
     de skill sem sentido — êxito sem raridade faz skill alta render mais lixo. */
  A(S.COLETA_EXITO(90) > S.COLETA_EXITO(10) + .2,
    `skill alta acerta bem mais que skill baixa (${(S.COLETA_EXITO(10) * 100).toFixed(0)}% → ${(S.COLETA_EXITO(90) * 100).toFixed(0)}%)`);
  A(S.vAlto > S.vBaixo * 1.5,
    `skill alta também tira coisa MELHOR, não só mais vezes (${S.vBaixo.toFixed(0)}g → ${S.vAlto.toFixed(0)}g por colheita)`);
  /* A comparação acima mistura duas coisas: skill 90 abre linhas que a 10 não
     alcança. Para isolar o PESO da skill na raridade, medir entre dois níveis
     que abrem exatamente o mesmo conjunto — aí a diferença só pode vir do
     COLETA_SORTE. Sem isto, apagar o fator passava verde. */
  {
    const abertas = nv => S.COLETA.mining.tab.filter(([, , lv]) => nv >= lv).map(l => l[0]).join(',');
    A(abertas(35) === abertas(47), 'skill 35 e 47 abrem as mesmas linhas de mineração — dá para isolar a sorte');
    /* Medir COMPOSIÇÃO e não valor: a quantidade também cresce com a skill
       (1 + nível/25), então comparar ouro deixava o teste passar mesmo com o
       peso da raridade apagado — o lote maior da linha comum cobria a conta. */
    vm.runInContext(`(() => {
      const p = pontos.mining, raras = COLETA.mining.tab.filter(l => l[1] < .5).map(l => l[0]);
      /* Sorteio SEMEADO, e a mesma semente nas duas medições: sem isso o teste
         falhava sozinho 2 vezes em 16 — a diferença real (36% → 43%) é firme,
         mas a de uma amostra solta encostava no limiar. Com a semente fixa as
         duas rodadas veem a mesma sequência e o que sobra é só o peso da skill.
         É a regra da própria seção "Armadilhas conhecidas": assertiva
         probabilística precisa de estado inicial igual, e aumentar a amostra não
         resolve viés. */
      const fatia = nivel => {
        const real = Math.random;
        Math.random = _mulberry(20260818);
        let n = 0, raro = 0;
        for (let i = 0; i < 4000; i++) {
          P.z = SURF; P.x = P.px = p.v[0]; P.y = P.py = p.v[1];
          P.eq.weapon = mkItem('pickaxe'); P.sk.mining.l = nivel; P.sk.mining.t = 0;
          if (P.colhido) delete P.colhido[chaveTile(p.x, p.y, SURF)];
          P.bag.length = 0; G.colheitaCd = 0;
          colher(p.x, p.y);
          if (!P.bag.length) continue;
          n++; if (raras.includes(P.bag[0].id)) raro++;
        }
        Math.random = real;
        return n ? raro / n : 0;
      };
      globalThis.fatia36 = fatia(35); globalThis.fatia47 = fatia(47);
    })();`, ctx);
    A(S.fatia47 > S.fatia36 * 1.08,
      `com as mesmas linhas abertas, a skill ainda aumenta a fatia de achado raro (${(S.fatia36 * 100).toFixed(0)}% na 35 → ${(S.fatia47 * 100).toFixed(0)}% na 47)`);
  }
  /* Quantidade é volume, não achado: sem esta, a skill 80 tirava "4× Barra de
     Ouro" de uma britada, e sozinha isso devolvia a mineração aos 20.000/min. */
  vm.runInContext(`(() => {
    const p = pontos.mining;
    let maiorRaro = 0, maiorComum = 0;
    for (let i = 0; i < 600; i++) {
      P.z = SURF; P.x = P.px = p.v[0]; P.y = P.py = p.v[1];
      P.eq.weapon = mkItem('pickaxe'); P.sk.mining.l = 90; P.sk.mining.t = 0;
      if (P.colhido) delete P.colhido[chaveTile(p.x, p.y, SURF)];
      P.bag.length = 0; G.colheitaCd = 0;
      colher(p.x, p.y);
      if (!P.bag.length) continue;
      const it = P.bag[0], linha = COLETA.mining.tab.find(l => l[0] === it.id);
      if (!linha) continue;
      if (linha[1] >= .5) maiorComum = Math.max(maiorComum, it.count || 1);
      else maiorRaro = Math.max(maiorRaro, it.count || 1);
    }
    globalThis.qtdRaro = maiorRaro; globalThis.qtdComum = maiorComum;
  })();`, ctx);
  A(S.qtdRaro === 1, `linha rara sai sempre em 1 — ninguém tira lote de gema numa britada (maior visto: ${S.qtdRaro})`);
  A(S.qtdComum > 1, `linha de volume ainda sai em lote com skill alta (maior visto: ${S.qtdComum})`);
}

/* 31. imbuement: gasta material e ouro, entra como afixo, um por peça, e
   SOBREVIVE ao save. O fixSave é o ponto frágil: ele descarta afixo que não
   reconhece, então um imbuement fora da lista dele sumiria em silêncio. */
{
  vm.runInContext(`
    newPlayer('Ferreiro', 'knight');
    P.x = WORLD.temple.x + 2; P.y = WORLD.temple.y + 2; P.z = SURF;
    P.gold = 1e6; P.bag.length = 0;
    equipItem(mkItem('plate_armor'), true);
    setForjaSlot('armor');
    const vit = IMBUEMENTS.find(i => i.id === 'vitalidade');
    const arc = IMBUEMENTS.find(i => i.id === 'arcano');
    globalThis.semMat = (imbuir('vitalidade'), P.eq.armor.imb);      // sem material: não aplica
    vit.mats.forEach(([id, q]) => bagAdd(mkItem(id, 0, q)));
    globalThis.hpAntes = P.st.maxhp; globalThis.ouroAntes = P.gold;
    imbuir('vitalidade');
    globalThis.r1 = { imb: P.eq.armor.imb, hp: P.st.maxhp, ouro: ouroAntes - P.gold,
                      mats: vit.mats.map(([id]) => contaMat(id)) };
    // longe do templo não forja
    arc.mats.forEach(([id, q]) => bagAdd(mkItem(id, 0, q)));
    P.x = 20; P.y = 20; imbuir('arcano');
    globalThis.longeNaoForja = P.eq.armor.imb === 'vitalidade';
    P.x = WORLD.temple.x + 2; P.y = WORLD.temple.y + 2;
    imbuir('arcano');
    globalThis.r2 = { af: (P.eq.armor.af || []).map(a => a.n), hp: P.st.maxhp, mana: P.st.maxmana };
    save();
    globalThis.afNoSave = (fixSave(load()).p.eq.armor.af || []).map(a => a.n);
  `, ctx);
  A(S.semMat === undefined, 'sem material o imbuement não é aplicado');
  A(S.r1.imb === 'vitalidade' && S.r1.hp === S.hpAntes + 150, `imbuir soma o bônus (${S.hpAntes} → ${S.r1.hp} de vida)`);
  A(S.r1.ouro === S.IMBUEMENTS[0].ouro && S.r1.mats.every(n => n === 0), 'imbuir cobra o ouro e consome os materiais');
  A(S.longeNaoForja, 'longe do templo não se forja');
  A(S.r2.af.length === 1 && S.r2.af[0] === 'Arcano' && S.r2.hp === S.hpAntes,
    `trocar o imbuement apaga o anterior (${JSON.stringify(S.r2.af)})`);
  A(S.afNoSave.length === 1 && S.afNoSave[0] === 'Arcano', 'o imbuement sobrevive ao save/load');
  A(S.IMBUEMENTS.every(i => i.mats.every(([id]) => S.ITEMS[id]) && i.ouro > 0 && Object.keys(i.b).length),
    'todo imbuement usa material real, cobra ouro e dá bônus');
}

/* 40. ícone de item pré-carregado. O desenho do drop no chão usa itemIcon, que
   só PEDE o PNG no primeiro quadro em que o item aparece — sem a pré-carga da
   tela de início, o primeiro drop de cada tipo nasce como o quadradinho de
   raridade e vira ícone alguns quadros depois. */
vm.runInContext(`
  for (const k in ICON_CACHE) delete ICON_CACHE[k];
  startGame('Pre', 'knight');
  globalThis.spritesFaltando = [...new Set(Object.values(ITEMS).filter(i => i.spr).map(i => i.spr))]
    .filter(k => !ICON_CACHE[k]);
`, ctx);
A(S.spritesFaltando.length === 0, 'todo sprite de item é pedido antes de o jogo abrir: falta ' + S.spritesFaltando.join(', '));
/* O chão desenha o PNG quando existe e o emoji quando não existe — item sem
   nenhum dos dois viraria um vazio no tile. */
A(Object.values(S.ITEMS).every(i => i.spr || (i.ico && i.ico[0] !== '<')),
  'todo item tem PNG ou emoji para o chão desenhar: ' +
  Object.values(S.ITEMS).filter(i => !i.spr && (!i.ico || i.ico[0] === '<')).map(i => i.id).join(', '));

/* 32. #43 — as invariantes que o tasks.html afirmava ter e não tinha.
   Auditoria de 2026-08-18: das 32 regras listadas em "Regras que não devem ser
   quebradas", 18 não existiam aqui. As mais caras de perder são as do #38a–d,
   que foi o trabalho de balanceamento mais caro do projeto e estava sem rede:
   desfazer `magPower`, o relógio de dano ou a varinha sem ML passava verde. */
{
  /* --- #38b: a varinha é a faixa crua da arma, sem magic level ------------ */
  /* Medido no caminho REAL (playerAttack → shoot → updateFx → dealDamage), e
     não em `weaponInfo`: o defeito de origem estava no ataque básico, não na
     ficha da arma, e um teste que olhasse só a tabela não pegaria a volta. */
  vm.runInContext(`
    globalThis.danoVarinha = (ml, n) => {
      newPlayer('Varinha', 'sorcerer'); saiDoTemplo();
      P.level = 76; P.ml.l = ml; P.eq.weapon = mkItem('wand_of_inferno'); recalc();
      G.mobs.length = 0; G.proj.length = 0; G.dead = false; G.now = 1e6;
      const alvo = spawnMob({ x: P.x + 1, y: P.y, z: P.z, m: 'rat', el: -1, dead: false });
      alvo.def = Object.assign({}, alvo.def, { res: {} });        // sem resistência no meio
      alvo.hp = alvo.maxhp = 1e9;
      G.target = alvo;
      let total = 0;
      for (let i = 0; i < n; i++) {
        P.mana = P.st.maxmana; P.nextAtk = 0;
        const antes = alvo.hp;
        playerAttack();
        G.now += 2000; updateFx();                                 // o projétil chega
        total += antes - alvo.hp;
      }
      return total / n;
    };
    globalThis.vML1 = danoVarinha(1, 240);
    globalThis.vML250 = danoVarinha(250, 240);
  `, ctx);
  const razaoML = S.vML250 / S.vML1;
  A(razaoML > 0.85 && razaoML < 1.18,
    `a varinha não escala com magic level (ML 1 dá ${S.vML1.toFixed(0)}, ML 250 dá ${S.vML250.toFixed(0)} — ${razaoML.toFixed(2)}×)`);
  {
    /* A terceira sem as duas primeiras deixaria alguém achatar a tabela de
       varinhas e matar a progressão do mago, que é o que sobrou dele. */
    const varas = Object.values(S.ITEMS).filter(i => i.wt === 'wand' && i.dmg)
      .sort((a, b) => (a.lvl || 0) - (b.lvl || 0));
    const med = i => (i.dmg[0] + i.dmg[1]) / 2;
    A(med(varas[varas.length - 1]) / med(varas[0]) >= 5,
      `a linha de varinhas cresce 5×+ do primeiro ao último degrau (${med(varas[0]).toFixed(0)} → ${med(varas[varas.length - 1]).toFixed(0)})`);
  }

  /* --- #38c: a inclinação de ML é sublinear e o espalhamento tem teto ----- */
  {
    const bases = Object.values(S.SPELLS).filter(sp => S.DANO_TIPOS.includes(sp.type) && sp.base).map(sp => sp.base);
    const mn = Math.min(...bases), mx = Math.max(...bases);
    const ml = 253, nv = 320;
    const esp = S.magPower(mx, ml, nv) / S.magPower(mn, ml, nv);
    A(esp <= 6, `o ganho por ponto de ML tem espalhamento limitado (${esp.toFixed(1)}× no fim de curva; era 16,2×)`);
    /* Achatar não é igualar: magia de base maior TEM de escalar mais, senão a
       régua vira imposto e a escolha de magia deixa de existir. */
    A(S.magPower(mx, ml, nv) - mx > S.magPower(mn, ml, nv) - mn,
      'magia de base maior ainda ganha mais por ponto de ML — a régua achata, não iguala');
    /* A ponta de baixo já estava certa: MAG_K foi calibrado para não mexer nela.
       Sem isto, alguém "conserta" o espalhamento cortando a magia fraca. */
    A(S.magPower(mn, 45, 50) > mn * 2,
      `a magia mais fraca sobreviveu à mudança (base ${mn} vira ${S.magPower(mn, 45, 50).toFixed(0)} com ML 45)`);
  }

  /* --- #38c: a cura não pode crescer mais rápido que a vida --------------- */
  /* Era plana em 332% da barra do nível 50 ao 320 — cura total garantida em
     qualquer nível, para qualquer vocação. A forma certa do invariante é a
     razão ENCOLHER, não um teto fixo: teto vira cópia do dado. */
  vm.runInContext(`
    globalThis.curaPorVida = (voc, nivel) => {
      newPlayer('C', voc); P.level = nivel;
      P.sk.magic = P.sk.magic || {}; P.ml.l = Math.round(nivel * .8); recalc();
      const curas = SPELLS.filter(sp => sp.type === 'heal' && (!sp.voc || sp.voc.includes(voc)) && sp.base);
      if (!curas.length) return null;
      const melhor = Math.max(...curas.map(sp => magPower(sp.base, P.ml.l, P.level)));
      return melhor / P.st.maxhp;
    };
    globalThis.curaCurva = {};
    for (const v of ['knight', 'ranger', 'sorcerer', 'druid'])
      curaCurva[v] = { n50: curaPorVida(v, 50), n320: curaPorVida(v, 320) };
  `, ctx);
  for (const v of ['knight', 'ranger', 'sorcerer', 'druid']) {
    const c = S.curaCurva[v];
    if (!c || c.n50 === null) { A(false, `${v} tem magia de cura para medir`); continue; }
    /* A doença era "cura total garantida em QUALQUER nível": 332% da barra,
       plana do 50 ao 320. Duas metades guardam isso, e nenhuma é cópia do dado —
       a razão não pode CRESCER com o nível, e no fim de curva uma conjuração não
       pode encher a barra. No meio do jogo ela ainda passa de 100% e isso é
       sabido: quem resolve é vida, não a fórmula (ver #38d). */
    A(c.n320 <= c.n50 * 1.05, `${v}: a cura não cresce mais rápido que a vida (${(c.n50 * 100).toFixed(0)}% da barra no nv 50 → ${(c.n320 * 100).toFixed(0)}% no 320)`);
    A(c.n320 < 1, `${v}: no fim de curva uma cura não enche a barra sozinha (${(c.n320 * 100).toFixed(0)}%)`);
  }

  /* --- #38d: o druida é outro personagem, não o sorcerer de outra cor ----- */
  /* Antes eram numericamente idênticos: mesma vida, mesma mana, mesma
     regeneração, mesmas skills — só divergiam em velocidade e cor. O que está
     travado aqui é a FORMA da identidade, não o valor de ajuste fino: o número
     exato da base da Cura Suprema fica de fora de propósito (ver #38d). */
  vm.runInContext(`
    globalThis.perfil = (voc, nivel) => {
      newPlayer('P', voc); P.level = nivel; P.ml.l = Math.round(nivel * .8); recalc();
      const meu = sp => !sp.voc || sp.voc.includes(voc);
      const dano = SPELLS.filter(sp => DANO_TIPOS.includes(sp.type) && sp.base && meu(sp) && sp.lvl <= nivel);
      const cura = SPELLS.filter(sp => sp.type === 'heal' && sp.base && meu(sp) && sp.lvl <= nivel);
      return {
        dano: dano.length ? Math.max(...dano.map(sp => magPower(sp.base, P.ml.l, P.level))) : 0,
        cura: cura.length ? Math.max(...cura.map(sp => magPower(sp.base, P.ml.l, P.level))) : 0,
        vida: P.st.maxhp
      };
    };
    globalThis.pf = {};
    for (const v of ['knight', 'ranger', 'sorcerer', 'druid']) pf[v] = { n50: perfil(v, 50), n320: perfil(v, 320) };
  `, ctx);
  for (const nv of ['n50', 'n320']) {
    const d = S.pf.druid[nv], so = S.pf.sorcerer[nv];
    A(d.dano <= so.dano * 0.92, `nv ${nv.slice(1)}: o druida bate no máximo 92% do sorcerer (${(100 * d.dano / so.dano).toFixed(0)}%)`);
    /* Piso de 1,20 e não 1,40: o medido é 125% no nv 50 e 137% no 320, e a
       seção de Regras do tasks.html afirmava 140% — número que nunca foi
       verdade, contrariado pelos próprios valores registrados no #38d. O que o
       piso precisa separar é o deliberado (125%) do acidental de antes de haver
       identidade (96%), e 1,20 faz isso com folga dos dois lados. */
    A(d.vida >= so.vida * 1.2, `nv ${nv.slice(1)}: o druida aguenta 20%+ a mais (${(100 * d.vida / so.vida).toFixed(0)}%)`);
    A(d.cura > so.cura, `nv ${nv.slice(1)}: o druida cura mais que o sorcerer`);
  }
  A(S.pf.druid.n320.cura > S.pf.ranger.n320.cura && S.pf.ranger.n320.cura > S.pf.sorcerer.n320.cura
    && S.pf.sorcerer.n320.cura >= S.pf.knight.n320.cura,
    'a hierarquia de curandeiro é druida > ranger > sorcerer > knight');

  /* --- degrau de magia nunca anda para trás ------------------------------- */
  /* É o defeito do Arco da Sentinela outra vez, do outro lado: no #38d o corte
     de 12% no druida levaria Golpe de Terra (nv13) e Golpe de Gelo (nv14) para
     ABAIXO do Golpe de Fogo (nv12), que é compartilhado e não podia se mover.
     Só nível ESTRITAMENTE menor conta: duas do mesmo nível são escolha de
     elemento, não degrau. */
  {
    const ruins = [];
    for (const voc of ['knight', 'ranger', 'sorcerer', 'druid'])
      for (const tipo of [...new Set(Object.values(S.SPELLS).map(sp => sp.type))]) {
        const l = Object.values(S.SPELLS)
          .filter(sp => sp.type === tipo && sp.base && (!sp.voc || sp.voc.includes(voc)))
          .sort((a, b) => a.lvl - b.lvl);
        for (let i = 1; i < l.length; i++)
          for (let j = 0; j < i; j++)
            if (l[j].lvl < l[i].lvl && l[i].base < l[j].base)
              ruins.push(`${voc}/${tipo}: ${l[i].n} (nv${l[i].lvl}) é mais fraca que ${l[j].n} (nv${l[j].lvl})`);
      }
    A(!ruins.length, 'nenhuma magia é mais fraca que uma de nível estritamente menor do mesmo tipo e vocação — ' + (ruins[0] || 'ok'));
  }

  /* --- #28: todo saque bate a régua dificuldade × natureza ---------------- */
  {
    let pior = 0, quem = '';
    for (const id in S.MONSTERS) {
      const m = S.MONSTERS[id];
      if (!m.loot || !m.loot.length) continue;
      const r = S.lootEV(m) / S.lootAlvo(m), d = Math.max(r, 1 / r);
      if (d > pior) { pior = d; quem = id; }
    }
    A(pior < 1.35, `todo saque bate a régua de dificuldade × natureza (pior: ${quem} a ${pior.toFixed(2)}×)`);
  }

  /* --- a trava que segura a régua de loot de comer a forja ---------------- */
  /* Se a régua ajustasse a chance de MATERIAL para fechar a conta de ouro, rabo
     de rato e osso ficariam raros e a forja pararia — sem erro e sem teste, só
     um jogador descobrindo que não dá mais para forjar. */
  {
    const mats = new Set();
    S.IMBUEMENTS.forEach(im => im.mats.forEach(([id]) => mats.add(id)));
    const melhor = {};
    for (const id of mats) melhor[id] = 0;
    for (const k in S.MONSTERS)
      (S.MONSTERS[k].loot || []).forEach(([id, ch]) => { if (mats.has(id)) melhor[id] = Math.max(melhor[id], ch); });
    const some = [...mats].filter(id => !melhor[id]);
    const raros = [...mats].filter(id => melhor[id] && melhor[id] < 0.02);
    A(!some.length, `os ${mats.size} materiais da forja continuam caindo — ${some.join(', ') || 'todos'}`);
    A(!raros.length, `nenhum material de forja tem chance irrisória (menor máxima: ${Math.min(...Object.values(melhor)).toFixed(2)})`);
  }

  /* --- #21: nenhuma cor crua no ui.js ------------------------------------ */
  /* A varredura roda no FONTE, então hexadecimal novo quebra a suíte no mesmo
     dia — é o único jeito de guardar uma regra sobre código que não é chamado. */
  {
    const fonte = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui.js'), 'utf8');
    const cruas = fonte.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    A(!cruas.length, `nenhuma cor crua em ui.js (achei ${cruas.length}: ${cruas.slice(0, 5).join(' ')})`);
    A(fonte.includes('tok('), 'ui.js pega cor por tok(), não por literal');
  }

  /* --- revitalização da paleta: cor voltou a ser informação --------------- */
  /* Os pares saem do MUNDO, não de uma lista à mão: escrever os seis pares aqui
     envelheceria no dia em que um bioma novo encostasse noutro. Foi assim que a
     dúvida sobre SAND/TEMPLE se resolveu — os dois nunca se tocam. */
  {
    const cor = t => S.TILE[t].c;
    const dist = (a, b) => Math.abs((a >> 16 & 255) - (b >> 16 & 255))
      + Math.abs((a >> 8 & 255) - (b >> 8 & 255)) + Math.abs((a & 255) - (b & 255));
    const contatos = {};
    for (let z = 0; z < S.FLOORS; z++)
      for (let y = 1; y < S.H - 1; y++)
        for (let x = 1; x < S.W - 1; x++) {
          const a = S.tileAt(x, y, z);
          if (a === S.T.VOID) continue;
          for (const [dx, dy] of [[1, 0], [0, 1]]) {
            const b = S.tileAt(x + dx, y + dy, z);
            if (b === S.T.VOID || a === b) continue;
            const k = Math.min(a, b) + ',' + Math.max(a, b);
            contatos[k] = (contatos[k] || 0) + 1;
          }
        }
    const vizinhos = Object.entries(contatos).filter(([, n]) => n > 500).map(([k]) => k.split(',').map(Number));
    const perto = vizinhos.filter(([a, b]) => dist(cor(a), cor(b)) < 60);
    A(vizinhos.length >= 6, `o mundo encosta terreno diferente em ${vizinhos.length} pares (amostra suficiente)`);
    A(!perto.length, `terreno vizinho é distinguível (mínimo de 60; pior par ${Math.min(...vizinhos.map(([a, b]) => dist(cor(a), cor(b))))})`);

    const sat = h => {
      const r = (h >> 16 & 255) / 255, g = (h >> 8 & 255) / 255, b = (h & 255) / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
      return mx === mn ? 0 : (l > .5 ? (mx - mn) / (2 - mx - mn) : (mx - mn) / (mx + mn));
    };
    const tiles = Object.values(S.T).filter(t => t !== S.T.VOID);
    const media = tiles.reduce((a, t) => a + sat(cor(t)), 0) / tiles.length;
    A(media >= .33, `a saturação média do terreno não caiu para o cinza (${(media * 100).toFixed(0)}%, piso 33%)`);
    /* O TETO importa tanto quanto o piso: uma régua que só empurrasse saturação
       para cima convidaria o neon que o §23 do CLAUDE.md veta. */
    const fora = tiles.filter(t => sat(cor(t)) < .10 || sat(cor(t)) > .90);
    A(!fora.length, `nenhum tile fora da faixa 10–90% de saturação (${fora.length} fora)`);
  }

  /* --- #48: vocabulário de tile, um material por significado -------------- */
  /* A vila de Varrokgaard virou pedregulho porque casa, mureta e matacão eram
     todos T.ROCK. É essa a confusão que se trava aqui, e SÓ ela: exigir 60 de
     distância entre todo par de tile construído seria medir identidade com a
     régua de legibilidade, que é o erro que o CLAUDE.md registra — parede e
     cerca são a mesma madeira de propósito, e quem as separa é a silhueta.
     Adjacência real continua guardada pelo teste de paleta derivado do mundo. */
  {
    const cor = t => S.TILE[t].c;
    const dist = (a, b) => Math.abs((a >> 16 & 255) - (b >> 16 & 255))
      + Math.abs((a >> 8 & 255) - (b >> 8 & 255)) + Math.abs((a & 255) - (b & 255));
    /* Lista explícita do que é COISA CONSTRUÍDA — tile novo de construção entra
       aqui. Natural e orgânico (veio, brita, cinza, musgo, ossada, teia) fica
       de fora de propósito: são da família da pedra, e o veio em especial tem
       de ser perto dela, senão minério se avista do outro lado do andar em vez
       de se procurar. */
    const CONSTRUIDO = ['WALL', 'FLOOR', 'DOOR', 'FENCE', 'CROP', 'PIER', 'HAY', 'PROP',
                        'SWALL', 'PAVE', 'RUBBLE', 'GORE', 'RUNE'];
    const perto = CONSTRUIDO.filter(k => dist(cor(S.T[k]), cor(S.T.ROCK)) < 60);
    A(!perto.length, `coisa construída não se confunde com rocha (${perto.join(', ')})`);

    /* Dois tiles de TERRENO com a mesma textura e a mesma cor são o mesmo tile
       com dois nomes — é assim que um vocabulário volta a encolher sem ninguém
       notar.
       Objeto fica de fora, e a régua é a que o próprio #48b escreveu: num tile
       de objeto, `c` e `tex` são o CHÃO sob o objeto, não o material dele. Duas
       coisas em cima da mesma terra batida têm de ter a mesma terra batida —
       carroça e barril, cerca e escoramento —, e quem as separa é a SILHUETA.
       Aplicar distância de cor aqui é medir legibilidade achando que se mede
       identidade, que é o erro que este projeto já cometeu três vezes.
       O que guarda o objeto é a linha logo abaixo: sprite próprio, um por um. */
    const iguais = [];
    const chaves = Object.keys(S.T);
    const ehObj = d => !!(d.obj || d.parede);
    for (let i = 0; i < chaves.length; i++) for (let j = i + 1; j < chaves.length; j++) {
      const a = S.TILE[S.T[chaves[i]]], b = S.TILE[S.T[chaves[j]]];
      if (ehObj(a) || ehObj(b)) continue;
      if (a.tex && a.tex === b.tex && dist(a.c, b.c) < 30) iguais.push(chaves[i] + '/' + chaves[j]);
    }
    A(!iguais.length, `nenhum par de tiles de terreno é o mesmo material com dois nomes (${iguais.join(', ')})`);

    /* E a contrapartida: nenhum objeto empresta o desenho de outro. É isto que
       impede o vocabulário de encolher pelo lado dos objetos, agora que a cor
       deles deixou de ser a prova. */
    const desenhos = chaves.map(k => S.TILE[S.T[k]]).filter(ehObj).map(d => d.obj || d.parede);
    A(new Set(desenhos).size === desenhos.length,
      `cada objeto tem desenho próprio (${desenhos.join(', ')})`);

    /* Sem rotina de textura o tileTexture estoura, e sem prioridade o tile cai
       calado na prioridade 0 e some sob a borda de qualquer vizinho. Os dois
       são silenciosos o bastante para atravessar uma revisão inteira. */
    const semTex = [], semPrio = [];
    for (const k in S.T) {
      const tex = S.TILE[S.T[k]].tex;
      if (!tex) continue;
      if (!S.TEX_DRAW[tex]) semTex.push(k + ':' + tex);
      if (S.TERRAIN_PRIO[tex] === undefined) semPrio.push(k + ':' + tex);
    }
    A(!semTex.length, `toda textura de tile tem rotina em TEX_DRAW (${semTex.join(', ')})`);
    A(!semPrio.length, `toda textura de tile tem prioridade de borda (${semPrio.join(', ')})`);
    /* OBJETO DE MAIS DE UM TILE. Nasceu do relato de que o poço ficava minúsculo:
       um tile tem 32 px, e poço, moinho e fonte desenhados dentro de um só serão
       pequenos por construção. Quem prova a necessidade é o moinho — dois tiles
       MILL lado a lado desenhavam DOIS MOINHOS colados.
       As duas metades juntas: o sprite tem de ter o tamanho que o `span` promete
       (senão a âncora desenha esticado ou sobra buraco), e quem tem `span` tem de
       barrar o passo — objeto multi-tile andável seria desenho por cima do
       jogador em metade do rastro. */
    for (const k in S.T) {
      const d = S.TILE[S.T[k]];
      if (!d.span) continue;
      const [sw, sh] = d.span;
      A(sw >= 1 && sh >= 1 && (sw > 1 || sh > 1), `${k} declara span de mais de um tile (${sw}x${sh})`);
      A(!d.walk, `${k} barra o passo em todo o rastro`);
      const alto = d.obj ? S.CERCA_TOP : S.WALL_TOP;
      const spr = d.obj ? S.OBJ_DRAW[d.obj](false) : S.PAREDE_DRAW[d.parede](d.tex, d.c, 0);
      A(spr.width === 32 * sw, `o desenho de ${k} tem a largura do span (${spr.width} para ${32 * sw})`);
      A(spr.height === alto + 32 * sh, `e a altura (${spr.height} para ${alto + 32 * sh})`);
    }

    /* E o lado de LÁ da mesma régua, que é o que pega o defeito de verdade:
       todo desenho maior que um tile TEM de ter `span`. A primeira versão só
       conferia os tiles que já declaravam span — tirar o span do poço deixava a
       suíte inteira verde, e o resultado no jogo seria o desenho de 64 px
       espremido em 32. O silêncio é sempre desse lado: sobra sprite, falta
       declaração, e nada acusa. */
    for (const k in S.T) {
      const d = S.TILE[S.T[k]];
      if (!d.obj && !d.parede) continue;
      /* A assinatura é a do `paredeSprite`: (tex, cor, variante). A teia usa os
         três; o moinho ignora, porque desenho de prédio não varia por tile. */
      const spr = d.obj ? S.OBJ_DRAW[d.obj](false) : S.PAREDE_DRAW[d.parede](d.tex, d.c, 0);
      if (spr.width > 32) A(!!d.span, `${k} desenha ${spr.width}px de largura e declara span`);
      const alto = d.obj ? S.CERCA_TOP : S.WALL_TOP;
      if (spr.height > alto + 32) A(!!d.span, `${k} desenha ${spr.height}px de altura e declara span`);
    }

    /* Parede com física própria: `parede` sem desenho cai em undefined e o 2º
       passe estoura no primeiro quadro em que o tile aparece na tela.
       A segunda metade entrou com o moinho: quem declara desenho de parede TEM
       de ser parede. Um prédio com `top` de objeto seria desenhado pelo passe
       errado e o jogador enxergaria através dele. */
    for (const k in S.T) {
      const d = S.TILE[S.T[k]];
      if (!d.parede) continue;
      A(!!S.PAREDE_DRAW[d.parede], `${k} tem desenho de parede (${d.parede})`);
      A(d.top > 0.5 && !d.walk, `${k} é prédio: tapa a vista e barra o pé (top ${d.top})`);
    }

    /* Parede barra os dois; objeto barra só o pé. As duas juntas, porque só a
       primeira passaria com uma cerca que não barrasse nada, e só a segunda
       passaria com a cerca virando mureta — o defeito de origem do #46. */
    for (const k of ['WALL', 'SWALL', 'WEB', 'ORE'])
      A(!S.TILE[S.T[k]].walk && S.TILE[S.T[k]].top > 0.5, `${k} barra o passo e a vista`);
    /* Objeto de tile é a terceira categoria e existe justamente por causa deles:
       cerca e escoramento barram o pé sem barrar a vista. Todo `obj` declarado
       tem de ter desenho, senão o tile some do 2º passe sem erro nenhum. */
    for (const k in S.T) {
      const d = S.TILE[S.T[k]];
      if (!d.obj) continue;
      A(!d.walk && d.top > 0 && d.top <= 0.5, `${k} barra o pé e deixa ver por cima (top ${d.top})`);
      A(!!S.OBJ_DRAW[d.obj], `${k} tem desenho de objeto (${d.obj})`);
    }
    for (const k of ['DOOR', 'FLOOR', 'CROP', 'PIER', 'HAY', 'PAVE', 'RUBBLE', 'GRAVEL',
                     'WEBF', 'BONE', 'ASH', 'MOSS', 'GORE', 'RUNE'])
      A(S.TILE[S.T[k]].walk && S.TILE[S.T[k]].top === 0, `${k} é chão: atravessa a pé`);

    /* O veio entra na mineração e a parede de caverna continua fora — a trava
       contra o recurso infinito de 46.899 tiles voltar por uma porta nova. */
    A(S.COLETA.mining.tiles.includes('ORE') && !S.COLETA.mining.tiles.includes('CWALL'),
      'o veio é minerável e a parede de caverna não');
  }

  /* --- #38a: o relógio único de dano, medido ALTERNANDO magias ------------ */
  /* O piso de cdDe() é por magia e o GCD é 900 ms: o sorcerer alternava entre
     as três de ataque e, ao voltar na primeira, os 2 s dela já tinham passado —
     conjurava a cada 896 ms. Por isso o teste TEM de alternar: lançar a mesma
     repetidas vezes passa mesmo com o defeito presente, que é exatamente como
     ele sobreviveu ao #23. */
  vm.runInContext(`(() => {
    newPlayer('Relogio', 'sorcerer'); saiDoTemplo();
    P.level = 50; P.ml.l = 45; recalc();
    G.mobs.length = 0; G.dead = false; G.now = 1e6; P.cd = {};
    const ataque = SPELLS.filter(sp => DANO_TIPOS.includes(sp.type) && sp.lvl <= P.level && (!sp.voc || sp.voc.includes('sorcerer')));
    globalThis.nAtaque = ataque.length;
    /* Sem alvo o dano não sai, então põe um saco de pancada imortal ao lado. */
    const saco = spawnMob({ x: P.x + 1, y: P.y, z: P.z, m: 'rat', el: -1 });
    saco.hp = saco.maxhp = 1e9; G.target = saco;
    globalThis.instantes = [];
    let i = 0;
    for (let t = 0; t < 20000; t += 50) {
      G.now = 1e6 + t; P.mana = P.st.maxmana;
      const antes = P.mana;
      castSpell(ataque[i % ataque.length]);            // ALTERNA
      if (P.mana < antes) { instantes.push(t); i++; }
    }
    globalThis.menorIntervalo = Math.min(...instantes.slice(1).map((v, k) => v - instantes[k]));
    /* A outra metade: travar tudo no mesmo relógio tiraria a defesa de quem
       conjura, então a cura TEM de sair durante o cooldown de dano. */
    G.now = 1e6; P.cd = {}; P.mana = P.st.maxmana; P.hp = 1;
    castSpell(ataque[0]);
    G.now += 1000;                                      // passou o GCD (900), dentro do relógio de dano (2000)
    const cura = SPELLS.find(sp => sp.type === 'heal' && sp.lvl <= P.level && (!sp.voc || sp.voc.includes('sorcerer')));
    const mAntes = P.mana; castSpell(cura);
    globalThis.curouNoCooldown = P.mana < mAntes;
  })();`, ctx);
  A(S.nAtaque >= 2, `o sorcerer tem ${S.nAtaque} magias de ataque no nível 50 — alternar faz sentido`);
  A(S.menorIntervalo >= S.ATAQUE_MS,
    `magia de dano não sai mais rápido que o ataque básico, alternando magias (${S.menorIntervalo} ms, piso ${S.ATAQUE_MS})`);
  A(S.curouNoCooldown, 'a cura sai durante o cooldown de dano — o GCD curto é de propósito');

  /* --- #6: bicho manso ---------------------------------------------------- */
  /* As três juntas: só "não persegue" faz saco de pancada, e só "foge" não
     impede o coelho de caçar o jogador. */
  vm.runInContext(`(() => {
    newPlayer('Fauna', 'knight'); saiDoTemplo();
    P.hp = P.st.maxhp = 1e9; G.dead = false; G.mobs.length = 0; G.now = 2e6;
    globalThis.passivos = Object.keys(MONSTERS).filter(k => MONSTERS[k].passivo);
    const bicho = () => {
      G.mobs.length = 0;
      const m = spawnMob({ x: P.x + 3, y: P.y, z: P.z, m: passivos[0], el: -1 });
      m.nextAtk = 0; return m;
    };
    /* 1. vê o jogador e não liga o encalço */
    const parado = bicho();
    for (let i = 0; i < 60; i++) { G.now += 120; updateMobs(120); }
    globalThis.mansoNaoEncalca = !parado.chase;
    /* 2. apanhou, foge */
    const ferido = bicho();
    ferido.x = ferido.px = P.x + 1; ferido.y = ferido.py = P.y;
    dealDamage(ferido, 1);
    const dAntes = distT(ferido.x, ferido.y, P.x, P.y);
    for (let i = 0; i < 80; i++) { G.now += 120; updateMobs(120); }
    globalThis.mansoFoge = distT(ferido.x, ferido.y, P.x, P.y) > dAntes;
    globalThis.mansoAcordou = ferido.chase;
  })();`, ctx);
  A(S.passivos.length >= 4, `a fauna passiva existe (${S.passivos.length} espécies)`);
  A(S.mansoNaoEncalca, 'bicho manso não liga o encalço só por ver o jogador');
  A(S.mansoAcordou && S.mansoFoge, 'apanhar acorda o bicho manso, e ele foge em vez de revidar');

  /* --- #6: criatura noturna nasce de noite, e no refreshSpawns de verdade -- */
  /* Verificado no laço real e não na ficha: `noite: true` na tabela não prova
     que alguém consulta o relógio. */
  vm.runInContext(`(() => {
    globalThis.noturnas = Object.keys(MONSTERS).filter(k => MONSTERS[k].noite);
    globalThis.nasceuDeDia = null; globalThis.nasceuDeNoite = null;
    if (noturnas.length) {
      const alvo = noturnas[0];
      /* A 10 tiles, não colado: refreshSpawns tem "se não foi avisado e d < 7,
         pula" — ponto frio nunca instancia perto do jogador. Com o spawn a 2
         tiles o teste media OUTROS pontos do mundo e não o seu, e por isso não
         pegava a volta na mutação. */
      let sx = P.x + 10, sy = P.y;
      for (let k = 10; k <= 20 && !isWalkable(sx, sy, P.z); k++) { sx = P.x + k; }
      const sp = { x: sx, y: sy, z: P.z, m: alvo, dead: 0, el: -1 };
      WORLD.spawns.push(sp);
      /* O relógio sai de Date.now(), e ehNoite é um const de world.js — não dá
         para trocá-lo por fora, porque refreshSpawns o resolve lexicalmente.
         Stub no Date.now exercita o caminho inteiro de verdade: DIA_MS é 10 min,
         e nessa volta o ms 0 cai na noite e o 141000 no dia. */
      const relogioReal = Date.now;
      const tenta = ms => {
        sp.live = null; sp.dead = 0; G.mobs.length = 0;
        Date.now = () => ms;
        try { refreshSpawns(true); } finally { Date.now = relogioReal; }
        return !!sp.live;                                  // ESTE ponto, não o mundo inteiro
      };
      globalThis.pontoAndavel = isWalkable(sx, sy, P.z);
      nasceuDeNoite = tenta(0);
      nasceuDeDia = tenta(141000);
      WORLD.spawns.pop();
    }
  })();`, ctx);
  A(S.noturnas.length > 0, `existe criatura noturna (${S.noturnas.length})`);
  A(S.pontoAndavel, 'o ponto de spawn do teste caiu em chão andável');
  A(S.nasceuDeNoite === true, 'criatura noturna nasce de noite');
  A(S.nasceuDeDia === false, 'e NÃO nasce de dia — o relógio é consultado no refreshSpawns de verdade');

  /* --- #34: virar sem andar ----------------------------------------------- */
  /* A lógica virou função justamente para poder ser verificada: no harness o
     addEventListener global é no-op, então o que só existe dentro do keydown
     não tem como ser testado. */
  vm.runInContext(`(() => {
    newPlayer('Vira', 'knight'); saiDoTemplo(); G.dead = false; P.stepD = 0;
    const p0 = [P.x, P.y];
    globalThis.dirs = [];
    for (const d of [[0,-1],[1,0],[0,1],[-1,0]]) { virarPara(d); dirs.push(P.lastDir.join(',')); }
    globalThis.virouSemAndar = P.x === p0[0] && P.y === p0[1];
    globalThis.dirsUnicas = new Set(dirs).size;
    G.dead = true; const antes = P.lastDir.join(',');
    virarPara([1, 1]);
    globalThis.mortoNaoVira = P.lastDir.join(',') === antes;
    G.dead = false;
  })();`, ctx);
  A(S.virouSemAndar, 'virar não move o personagem');
  A(S.dirsUnicas === 4, `as quatro direções são alcançáveis (${S.dirsUnicas})`);
  A(S.mortoNaoVira, 'morto não vira');
}

/* 33. #32 — estados elementais no corpo. Até aqui o elemento só decidia cor de
   partícula e resistência: fogo não queimava, terra não envenenava. */
{
  A(Object.values(S.ESTADOS).every(e => e.n && e.dano > 0 && e.dur > 0 && e.chance > 0 && e.chance <= 1),
    `todo estado tem nome, dano, duração e chance (${Object.keys(S.ESTADOS).length})`);
  /* Ou o estado é de um elemento REAL, e tira cor e partícula de ELEM, ou não
     tem elemento e traz as suas — meio-termo sairia sem desenho na tela. */
  A(Object.values(S.ESTADOS).every(e => e.el ? !!S.ELEM[e.el] : (e.cor >= 0 && e.forma)),
    'estado com elemento aponta um real; estado sem elemento traz a própria cor e partícula');
  /* Físico, sagrado e morte ficam de fora de propósito: são tipos de dano e não
     condições que o corpo carrega. Sagrado que queimasse seria fogo azul. */
  A(!S.ESTADO_DE.physical && !S.ESTADO_DE.holy && !S.ESTADO_DE.death,
    'nenhum estado é alcançável por físico, sagrado ou morte pelo elemento');
  const comEl = Object.values(S.ESTADOS).filter(e => e.el);
  A(new Set(comEl.map(e => e.el)).size === comEl.length,
    'um estado por elemento — dois no mesmo elemento fariam a cor piscar entre duas');
  /* §17: o selo na barra não pode ser emoji. A cor do elemento é a pista que o
     jogador já aprendeu na partícula e no tiro da varinha. */
  A(!JSON.stringify(S.ESTADOS).match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u),
    'nenhum estado carrega emoji — o selo sai da cor do elemento');

  vm.runInContext(`(() => {
    newPlayer('Estado', 'knight'); saiDoTemplo();
    P.hp = P.st.maxhp = 1e9; G.dead = false; G.mobs.length = 0; G.now = 3e6;
    globalThis.alvoDe = id => {
      G.mobs.length = 0;
      const m = spawnMob({ x: P.x + 1, y: P.y, z: P.z, m: id, el: -1 });
      m.hp = m.maxhp = 1e6; m.estados = {}; return m;
    };
    /* Sorteio semeado: a chance é de 22% a 28%, então "aplicou ou não" numa
       tentativa só é ruído. Semente fixa deixa o resultado reprodutível. */
    const real = Math.random; Math.random = _mulberry(4242);

    /* fogo aplica queimando; físico não aplica nada */
    const rato = alvoDe('rat');
    for (let i = 0; i < 40; i++) aplicaEstado(rato, 'queimando', 100);
    globalThis.pegouFogo = !!rato.estados.queimando;
    const rato2 = alvoDe('rat');
    for (let i = 0; i < 40; i++) aplicaEstado(rato2, ESTADO_DE.physical, 100);
    globalThis.pegouFisico = Object.keys(rato2.estados).length > 0;

    /* imune não pega o estado: o dragão é imune a fogo */
    const drag = alvoDe('dragon');
    globalThis.dragImuneFogo = resistOf(drag.def, 'fire') === 0;
    for (let i = 0; i < 60; i++) aplicaEstado(drag, 'queimando', 100);
    globalThis.imunePegou = Object.keys(drag.estados).length > 0;

    /* acúmulo: reaplicar RESETA a duração e nunca empilha */
    const alvo = alvoDe('rat');
    for (let i = 0; i < 40 && !alvo.estados.queimando; i++) aplicaEstado(alvo, 'queimando', 100);
    const primeiro = alvo.estados.queimando.end;
    G.now += 4000;
    for (let i = 0; i < 40; i++) aplicaEstado(alvo, 'queimando', 100);
    globalThis.chaves = Object.keys(alvo.estados).length;
    globalThis.resetou = alvo.estados.queimando.end > primeiro;

    /* o tique tira vida, e o veneno que MATA passa por killMob: larga loot e dá
       experiência igual a uma espadada, senão morrer de veneno seria de graça */
    const fraco = alvoDe('rat');
    for (let i = 0; i < 40 && !fraco.estados.queimando; i++) aplicaEstado(fraco, 'queimando', 100);
    const antes = fraco.hp; tickEstados();
    globalThis.tiqueDoeu = fraco.hp < antes;
    fraco.hp = 1; G.drops.length = 0;
    const expAntes = P.exp, vivos = G.mobs.length;
    tickEstados();
    globalThis.venenoMatou = G.mobs.length < vivos;
    globalThis.venenoDeuExp = P.exp > expAntes;

    /* jogador: o gelo além de doer deixa lento, e o recalc tem de enxergar */
    P.buffs = {}; recalc(); const vAntes = P.st.speed;
    for (let i = 0; i < 60 && !P.buffs.congelado; i++) aplicaEstado(P, 'congelado', 100);
    globalThis.jogadorCongelou = !!P.buffs.congelado;
    globalThis.congeladoLento = P.st.speed < vAntes;
    const hpAntes = P.hp; tickEstados();
    globalThis.jogadorSofreu = P.hp < hpAntes;
    /* e expira pelo mesmo relógio de sempre, sem cronômetro próprio */
    P.buffs.congelado.end = G.now - 1;
    for (const k in P.buffs) if (P.buffs[k].end < G.now) delete P.buffs[k];
    recalc();
    globalThis.expirou = !P.buffs.congelado && P.st.speed === vAntes;

    Math.random = real;
  })();`, ctx);
  A(S.pegouFogo, 'golpe de fogo põe a criatura para queimar');
  A(!S.pegouFisico, 'golpe físico não aplica estado nenhum');
  A(S.dragImuneFogo && !S.imunePegou, 'imune não pega o estado, não só o dano — dragão não pega fogo');
  A(S.chaves === 1 && S.resetou, `reaplicar reseta a duração e não empilha (${S.chaves} relógio)`);
  A(S.tiqueDoeu, 'o tique de 3s tira vida de quem está com estado');
  A(S.venenoMatou && S.venenoDeuExp, 'estado que mata passa por killMob — dá experiência e larga loot');
  A(S.jogadorCongelou && S.jogadorSofreu, 'o jogador também pega estado e sofre o tique');
  A(S.congeladoLento, 'congelado entra no recalc e derruba a velocidade');
  A(S.expirou, 'o estado expira no mesmo relógio dos buffs e devolve a velocidade');

  /* As duas acima medem as PEÇAS chamando `aplicaEstado` e `tickEstados` na mão.
     Esta mede a LIGAÇÃO: golpe elemental de verdade pelo `dealDamage`, e o
     relógio do jogo correndo pelo `frame`. Sem ela, arrancar a chamada de dentro
     do dealDamage ou do tique de 3 s passava verde — foi o que a mutação achou.
     O controle é um segundo bicho igual e intacto: `regenMobs` cura 2% por tique
     de quem não persegue, e sem o par a regeneração escondia o dano do veneno. */
  vm.runInContext(`(() => {
    newPlayer('Liga', 'sorcerer'); saiDoTemplo();
    P.hp = P.st.maxhp = 1e9; G.dead = false; G.mobs.length = 0; G.now = 4e6;
    G.lastRegen = G.now; G.path = []; G.pendingColheita = null; G.target = null;
    const real = Math.random; Math.random = _mulberry(777);
    const par = ['rat', 'rat'].map((id, i) => {
      const m = spawnMob({ x: P.x + 1 + i, y: P.y, z: P.z, m: id, el: -1 });
      m.hp = m.maxhp = 1e6; return m;
    });
    const [queima, controle] = par;
    /* pelo caminho real: dealDamage com elemento é quem acende o estado */
    for (let i = 0; i < 60 && !(queima.estados && queima.estados.queimando); i++) dealDamage(queima, 50, 'fire', null, 'queimando');
    globalThis.ligouNoGolpe = !!(queima.estados && queima.estados.queimando);
    for (let i = 0; i < 60; i++) dealDamage(controle, 50, 'physical', null, null);   // mesmo dano, sem estado
    globalThis.controleLimpo = !controle.estados || !Object.keys(controle.estados).length;
    const hqAntes = queima.hp, hcAntes = controle.hp;
    /* relógio do jogo: dois tiques de 3 s, sem ninguém bater em nada */
    for (let t = 0; t < 7000; t += 100) frame(4e6 + t);
    globalThis.perdeuQueimando = hqAntes - queima.hp;
    globalThis.perdeuControle = hcAntes - controle.hp;
    Math.random = real;
  })();`, ctx);
  A(S.ligouNoGolpe, 'o golpe elemental de verdade acende o estado — não só a chamada direta');
  A(S.controleLimpo, 'o golpe físico do controle não acendeu nada');
  A(S.perdeuQueimando > S.perdeuControle,
    `o relógio do jogo cobra o estado sozinho (queimando perdeu ${S.perdeuQueimando}, controle ${S.perdeuControle})`);

  /* Metade do pedido é VISUAL, e essa metade é a que some sem ninguém notar: o
     dano continua acontecendo e o jogador não sabe por quê. Duas coisas mostram
     o estado no corpo — o tingimento do sprite e a partícula contínua —, e as
     duas saem de `ELEM`, então fogo sobe como brasa e gelo cai como caco sem uma
     linha de desenho por estado. */
  vm.runInContext(`(() => {
    newPlayer('Visual', 'knight'); saiDoTemplo();
    P.hp = P.st.maxhp = 1e9; G.dead = false; G.mobs.length = 0; G.now = 5e6;
    G.path = []; G.target = null; G.fx.length = 0; G.lastRegen = G.now;
    const m = spawnMob({ x: P.x + 1, y: P.y, z: P.z, m: 'rat', el: -1 });
    m.hp = m.maxhp = 1e6;
    m.estados = { queimando: { end: G.now + 6e5, dano: 1, el: 'fire', val: 0 } };
    /* ter o estado NÃO acende o corpo: o efeito é do dano, não da posse */
    globalThis.antesDoTique = estadoFlash(m);
    tickEstados();
    globalThis.noTique = estadoFlash(m);
    globalThis.elNoTique = m.estadoK;
    const fx = G.fx.filter(f => f.tipo === 'estado');
    globalThis.fxEstado = fx.length;
    globalThis.fxDoFogo = fx.length ? fx[0].forma === ELEM.fire.forma && fx[0].grav === ELEM.fire.grav : false;
    globalThis.fxForte = fx.length ? fx[0].p.length : 0;
    globalThis.fxGolpe = (impacto(m.x, m.y, 'magico', 0, 'fire'), G.fx[G.fx.length - 1].p.length);
    /* e apaga sozinho: passada a janela, o corpo volta ao normal */
    G.now += 1500;
    globalThis.depoisDaJanela = estadoFlash(m);
    globalThis.aindaTemEstado = !!m.estados.queimando;
  })();`, ctx);
  A(S.antesDoTique === 0, 'ter o estado não acende o corpo — o efeito é do dano, não da posse');
  A(S.noTique > 0 && S.elNoTique === 'queimando', 'no tique do dano o corpo acende na cor do elemento');
  A(S.depoisDaJanela === 0 && S.aindaTemEstado,
    'e apaga sozinho passada a janela, com o estado ainda ativo — quem conta o resto é o selo na barra');
  A(S.fxEstado > 0, `o dano do estado solta partícula (${S.fxEstado})`);
  A(S.fxDoFogo, 'e a partícula é a do próprio elemento — brasa que sobe, não um efeito genérico');
  A(S.fxForte > S.fxGolpe, `o efeito do estado é mais forte que o do golpe (${S.fxForte} partículas contra ${S.fxGolpe})`);
  A(typeof S.tingido === 'function', 'existe o corpo tingido na cor do elemento');

  /* --- quem tem direito de aplicar estado ---------------------------------- */
  /* Golpe e tiro NÃO aplicam por serem de fogo: magia e habilidade aplicam por
     serem magia e habilidade, e arma só aplica se declarar a propriedade. Sem
     esta regra toda varinha de fogo queimava de graça e o estado virava imposto
     do lado mágico — cavaleiro e ranger ficavam de fora do sistema inteiro. */
  {
    const varinhasComEl = Object.values(S.ITEMS).filter(i => i.wt === 'wand' && i.el);
    A(varinhasComEl.length > 0 && varinhasComEl.every(i => !i.estado),
      `nenhuma varinha aplica estado pelo ataque básico (${varinhasComEl.length} têm elemento)`);
    const magiasEl = Object.values(S.SPELLS).filter(sp => S.DANO_TIPOS.includes(sp.type) && S.ESTADO_DE[sp.el]);
    A(magiasEl.length > 0, `magia de elemento aplica o estado dele (${magiasEl.length} magias)`);
  }
  vm.runInContext(`(() => {
    newPlayer('Fonte', 'sorcerer'); saiDoTemplo();
    P.level = 60; P.ml.l = 50; P.hp = P.st.maxhp = 1e9; recalc();
    G.dead = false; G.now = 6e6; G.path = []; G.proj.length = 0;
    const real = Math.random; Math.random = _mulberry(31337);
    const alvo = () => { G.mobs.length = 0; const m = spawnMob({ x: P.x + 1, y: P.y, z: P.z, m: 'minotaur', el: -1 }); m.hp = m.maxhp = 1e7; m.estados = {}; return m; };
    /* varinha de fogo, ataque básico, 60 tiros: não pode queimar ninguém */
    const v = alvo();
    P.eq.weapon = mkItem(Object.values(ITEMS).find(i => i.wt === 'wand' && i.el === 'fire').id); recalc();
    G.target = v;
    for (let i = 0; i < 60; i++) { P.mana = P.st.maxmana; P.nextAtk = 0; playerAttack(); G.now += 50; updateFx(); }
    globalThis.varinhaQueimou = Object.keys(v.estados).length > 0;
    /* a MESMA arma, com a propriedade declarada, passa a aplicar */
    const v2 = alvo(); G.target = v2;
    P.eq.weapon.__estado = 'queimando';
    const st = itemStats(P.eq.weapon); ITEMS[P.eq.weapon.id].estado = 'queimando';
    for (let i = 0; i < 60; i++) { P.mana = P.st.maxmana; P.nextAtk = 0; playerAttack(); G.now += 50; updateFx(); }
    globalThis.propriedadeQueimou = Object.keys(v2.estados).length > 0;
    delete ITEMS[P.eq.weapon.id].estado;
    /* magia de fogo aplica por ser magia */
    const v3 = alvo(); G.target = v3;
    const fogo = SPELLS.find(sp => sp.el === 'fire' && DANO_TIPOS.includes(sp.type) && sp.lvl <= P.level);
    for (let i = 0; i < 40; i++) { P.cd = {}; P.mana = P.st.maxmana; castSpell(fogo); G.now += 60; updateFx(); }
    globalThis.magiaQueimou = !!v3.estados.queimando;
    Math.random = real;
  })();`, ctx);
  A(!S.varinhaQueimou, 'ataque básico de varinha de fogo NÃO queima — golpe é golpe');
  A(S.propriedadeQueimou, 'a mesma arma com a propriedade declarada passa a aplicar');
  A(S.magiaQueimou, 'magia de fogo queima por ser magia, sem precisar declarar nada');

  /* Os outros dois caminhos de golpe: o TIRO da criatura (que também é golpe, e
     por isso não aplica sozinho) e a arma de CORPO A CORPO com a propriedade —
     cada um sai de um `return` diferente do `weaponInfo`, então um teste só
     deixava os outros dois ramos descobertos. */
  vm.runInContext(`(() => {
    newPlayer('Alvo', 'knight'); saiDoTemplo();
    P.level = 60; P.hp = P.st.maxhp = 1e9; P.buffs = {}; recalc();
    G.dead = false; G.now = 8e6; G.path = []; G.proj.length = 0;
    const real = Math.random; Math.random = _mulberry(5150);
    /* tiro elemental de criatura, 80 vezes: não pode acender estado no jogador */
    const id = Object.keys(MONSTERS).find(k => MONSTERS[k].ranged && ESTADO_DE[MONSTERS[k].ranged.el]);
    globalThis.atiradorEl = id ? MONSTERS[id].ranged.el : null;
    /* Pelo caminho REAL: a criatura atira sozinha dentro do updateMobs e o
       projétil resolve no updateFx. Chamar hitPlayer na mão reproduzia o ponto
       de chamada em vez de exercitá-lo, e a mutação passava verde.
       Imortalidade REAFIRMADA a cada quadro: o recalc prende P.hp ao maxhp real,
       o jogador morre no meio da medida e G.dead cala a criatura — é a armadilha
       da seção "Armadilhas conhecidas", de novo. */
    G.mobs.length = 0; P.buffs = {};
    const a = spawnMob({ x: P.x + 3, y: P.y, z: P.z, m: id, el: -1 });
    /* sem habilidade: a criatura escolhida tem sopro do MESMO elemento do tiro,
       e habilidade aplica por regra — com os dois no ar não dá para saber quem
       acendeu o estado. Aqui só o tiro pode agir. */
    a.def = Object.assign({}, a.def, { hab: null });
    a.chase = true; a.nextAtk = 0;
    let tiros = 0;
    for (let i = 0; i < 400; i++) {
      G.dead = false; P.hp = P.st.maxhp = 1e9; P.buffs = {};
      a.x = a.px = P.x + 3; a.y = a.py = P.y; a.hp = a.maxhp;   // segura na mira
      G.now += 120; updateMobs(120);
      tiros += G.proj.length;
      G.now += 400; updateFx();                                  // o projétil chega
      /* olha SÓ o estado do elemento do tiro: a mesma criatura pode ter
         habilidade, e habilidade aplica por regra — misturar os dois media a
         coisa errada e dava falso positivo. */
      if (P.buffs[ESTADO_DE[a.def.ranged.el]]) break;
    }
    globalThis.tirosDados = tiros;
    globalThis.tiroAplicou = !!P.buffs[ESTADO_DE[a.def.ranged.el]];
    G.dead = false; P.hp = P.st.maxhp = 1e9;
    globalThis.tiroAplicou = Object.keys(P.buffs).length > 0;
    /* arma de corpo a corpo COM a propriedade: aplica */
    G.mobs.length = 0;
    const alvo = spawnMob({ x: P.x + 1, y: P.y, z: P.z, m: 'minotaur', el: -1 });
    alvo.hp = alvo.maxhp = 1e7; alvo.estados = {}; G.target = alvo;
    P.eq.weapon = mkItem('sword'); ITEMS.sword.estado = 'sangrando'; recalc();
    for (let i = 0; i < 60; i++) { P.nextAtk = 0; G.dead = false; playerAttack(); G.now += 50; }
    globalThis.espadaComPropriedade = !!alvo.estados.sangrando;
    delete ITEMS.sword.estado;
    /* e sem a propriedade, a mesma espada não aplica nada */
    const alvo2 = spawnMob({ x: P.x + 1, y: P.y - 1, z: P.z, m: 'minotaur', el: -1 });
    alvo2.hp = alvo2.maxhp = 1e7; alvo2.estados = {}; G.target = alvo2;
    P.eq.weapon = mkItem('sword'); recalc();
    for (let i = 0; i < 60; i++) { P.nextAtk = 0; G.dead = false; playerAttack(); G.now += 50; }
    globalThis.espadaSemPropriedade = Object.keys(alvo2.estados).length > 0;
    Math.random = real;
  })();`, ctx);
  A(S.atiradorEl, `existe criatura que atira ${S.atiradorEl} — dá para medir o tiro`);
  A(S.tirosDados > 10, `a criatura atirou de verdade no laço real (${S.tirosDados} tiros)`);
  A(!S.tiroAplicou, 'tiro de criatura também é golpe: não aplica estado sem propriedade');
  /* O outro lado da mesma régua: HABILIDADE aplica, e sem ela a criatura perdia
     o único jeito que tem de acender estado no jogador. Medido no laço real e
     com o tiro neutralizado, para não confundir quem acendeu. */
  vm.runInContext(`(() => {
    const id = Object.keys(MONSTERS).find(k => MONSTERS[k].hab && MONSTERS[k].hab.dano && ESTADO_DE[MONSTERS[k].hab.el]);
    globalThis.habEl = id ? MONSTERS[id].hab.el : null;
    if (!id) { globalThis.habAplicou = null; return; }
    /* semeado: a habilidade tem descanso e a aplicação tem chance, então sem
       semente o bloco falhava sozinho ~2 vezes em 20. Estado inicial igual, como
       manda a seção "Armadilhas conhecidas" — não afrouxar o laço. */
    const realH = Math.random; Math.random = _mulberry(2718);
    G.mobs.length = 0; P.buffs = {}; G.proj.length = 0;
    const h = spawnMob({ x: P.x + 1, y: P.y, z: P.z, m: id, el: -1 });
    h.def = Object.assign({}, h.def, { ranged: null });
    h.chase = true; h.nextAtk = 0; h.sp = h.sp || {};
    const alvoK = ESTADO_DE[h.def.hab.el];
    /* Janela longa de propósito: a habilidade tem descanso próprio, então em 90 s
       de relógio ela dispara umas 11 vezes e, à chance do estado, falhar tudo
       tem ~4% — exatamente a taxa com que este teste falhava sozinho. Com 450 s
       são dezenas de disparos, e a semente fecha o resto. */
    let disparos = 0;
    for (let i = 0; i < 3000 && !P.buffs[alvoK]; i++) {
      G.dead = false; P.hp = P.st.maxhp = 1e9;
      h.x = h.px = P.x + 1; h.y = h.py = P.y; h.hp = h.maxhp;
      const antes = h.habT || 0;
      G.now += 150; updateMobs(150); updateFx();
      if ((h.habT || 0) > antes) disparos++;
    }
    globalThis.habDisparos = disparos;
    globalThis.habAplicou = !!P.buffs[alvoK];
    Math.random = realH;
    G.dead = false; P.hp = P.st.maxhp = 1e9; P.buffs = {};
  })();`, ctx);
  A(S.habEl, `existe criatura com habilidade de ${S.habEl} — dá para medir`);
  A(S.habDisparos > 8, `a habilidade disparou de verdade no laço real (${S.habDisparos} vezes)`);
  A(S.habAplicou, 'habilidade de criatura aplica estado: é habilidade, não golpe');
  A(S.espadaComPropriedade, 'arma de corpo a corpo com a propriedade aplica no golpe básico');
  A(!S.espadaSemPropriedade, 'e a mesma espada sem a propriedade não aplica nada');

  /* --- SANGRANDO: o estado do cavaleiro ------------------------------------ */
  A(S.ESTADOS.sangrando && !S.ESTADOS.sangrando.el,
    'sangrando não tem elemento — corte é ferimento, não matéria');
  {
    const golpes = Object.values(S.SPELLS).filter(sp => /^melee/.test(sp.type) && sp.voc && sp.voc.includes('knight'));
    A(golpes.length > 0 && golpes.every(sp => sp.estado === 'sangrando'),
      `toda magia de golpe do cavaleiro faz sangrar (${golpes.length})`);
  }
  vm.runInContext(`(() => {
    newPlayer('Cav', 'knight'); saiDoTemplo();
    P.level = 40; P.hp = P.st.maxhp = 1e9; recalc();
    G.dead = false; G.now = 7e6; G.path = []; G.blood.length = 0;
    const real = Math.random; Math.random = _mulberry(909);
    const bate = id => {
      G.mobs.length = 0;
      const m = spawnMob({ x: P.x + 1, y: P.y, z: P.z, m: id, el: -1 });
      m.hp = m.maxhp = 1e7; m.estados = {}; G.target = m;
      const golpe = SPELLS.find(sp => sp.id === 'exori_min');
      for (let i = 0; i < 40 && !m.estados.sangrando; i++) { P.cd = {}; P.mana = P.st.maxmana; castSpell(golpe); G.now += 60; }
      return m;
    };
    globalThis.minoSangrou = !!bate('minotaur').estados.sangrando;
    /* quem tem sangue SECO não sangra: sai do campo que a tabela de sangue já
       declara por classe, então esqueleto e elemental ficam de fora sem uma
       lista nova para manter */
    globalThis.esqSeco = MONSTERS.skeleton.sangue.seco;
    globalThis.esqSangrou = !!bate('skeleton').estados.sangrando;
    /* e sangrar pinta o chão: é o manchaChao do combate, sem nada novo */
    const m = bate('minotaur'); G.blood.length = 0;
    tickEstados();
    globalThis.pintouChao = G.blood.length > 0;
    Math.random = real;
  })();`, ctx);
  A(S.minoSangrou, 'o golpe do cavaleiro faz o minotauro sangrar');
  A(S.esqSeco && !S.esqSangrou, 'esqueleto tem sangue seco e não sangra — a régua sai da tabela de sangue');
  A(S.pintouChao, 'quem sangra deixa rastro no chão');
}

/* ================================================ #33 · campo no chão ==== */
{
  /* Quem deixa campo. A régua é a mesma do estado — elemento que vira condição
     marca o chão, elemento que só é tipo de dano estoura e acaba. */
  const comEstado = S.SPELLS.filter(s => s.type === 'aoe' && S.ESTADO_DE[s.el]);
  const semEstado = S.SPELLS.filter(s => s.type === 'aoe' && !S.ESTADO_DE[s.el]);
  A(comEstado.length && semEstado.length,
    `há aoe dos dois lados para comparar (${comEstado.length} com estado, ${semEstado.length} sem)`);

  vm.runInContext(`(() => {
    newPlayer('Campo', 'sorcerer'); saiDoTemplo();
    P.level = 100; recalc(); P.hp = P.st.maxhp = 1e9; G.dead = false;
    G.now = 6e6; G.mobs.length = 0; G.campos.length = 0;

    const tiles = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) tiles.push([P.x + dx, P.y + dy]);
    /* sempre() fixa o sorteio de CAMPO_CHANCE: sem isso todo teste que precisa
       de campo num tile ESPECIFICO vira moeda, que é a armadilha de assertiva
       probabilística que esta suíte já documenta. */
    const real = Math.random;
    const sempre = f => { Math.random = () => 0; const r = f(); Math.random = real; return r; };

    /* fogo tem estado -> deixa chão; sagrado não tem -> não deixa */
    globalThis.nFogo = sempre(() => criaCampo(tiles, P.z, 'fire', 200));
    globalThis.campoFogo = !!campoEm(P.x, P.y, P.z);
    /* e o resíduo é FRAÇÃO do golpe, não o golpe inteiro */
    globalThis.forcaDoCampo = campoEm(P.x, P.y, P.z).dano;
    G.campos.length = 0;
    globalThis.nSagrado = sempre(() => criaCampo(tiles, P.z, 'holy', 200));

    /* espalha: uma área grande NÃO acende inteira */
    G.campos.length = 0;
    Math.random = _mulberry(31337);
    const grande = [];
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) grande.push([P.x + dx, P.y + dy]);
    const andaveis = grande.filter(([x, y]) => isWalkable(x, y, P.z)).length;
    const acesos = criaCampo(grande, P.z, 'fire', 200);
    Math.random = real;
    globalThis.espalhou = acesos > 0 && acesos < andaveis;
    globalThis.fracao = +(acesos / andaveis).toFixed(2);
    G.campos.length = 0;

    /* parede não pega fogo: só tile andável vira campo */
    G.campos.length = 0;
    const naoAndavel = [];
    for (let d = 1; d < 60 && !naoAndavel.length; d++)
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const x = P.x + dx * d, y = P.y + dy * d;
        if (!isWalkable(x, y, P.z)) { naoAndavel.push([x, y]); break; }
      }
    globalThis.achouParede = naoAndavel.length > 0;
    globalThis.nParede = sempre(() => criaCampo(naoAndavel, P.z, 'fire', 200));

    /* reaplicar RESETA e não duplica o tile */
    G.campos.length = 0;
    sempre(() => criaCampo([[P.x, P.y]], P.z, 'fire', 200));
    G.now += 4000;
    sempre(() => criaCampo([[P.x, P.y]], P.z, 'fire', 200));
    globalThis.umSoTile = G.campos.filter(c => c.x === P.x && c.y === P.y && c.z === P.z).length;
    globalThis.relogioResetou = campoEm(P.x, P.y, P.z).t === G.now;

    /* quem PISA pega o estado no tique — jogador e criatura */
    G.campos.length = 0; P.buffs = {}; G.mobs.length = 0;
    sempre(() => criaCampo([[P.x, P.y]], P.z, 'fire', 200));
    const rato = spawnMob({ x: P.x, y: P.y, z: P.z, m: 'rat', el: -1 });
    rato.x = P.x; rato.y = P.y; rato.hp = rato.maxhp = 1e6;
    const hpAntes = P.hp;
    tickCampos();
    globalThis.jogadorQueima = !!P.buffs.queimando;
    globalThis.bichoQueima = !!(rato.estados && rato.estados.queimando);
    tickEstados();
    globalThis.jogadorPerdeuVida = P.hp < hpAntes;

    /* imune não pega o campo, só o dano — dragão atravessa o fogo inteiro */
    G.mobs.length = 0;
    const drag = spawnMob({ x: P.x, y: P.y, z: P.z, m: 'dragon', el: -1 });
    drag.x = P.x; drag.y = P.y; drag.hp = drag.maxhp = 1e6; drag.estados = {};
    tickCampos();
    globalThis.dragaoImune = !(drag.estados && drag.estados.queimando);

    /* o campo EXPIRA e some sozinho no tique */
    G.now += CAMPO_DUR + 1;
    tickCampos();
    globalThis.expirou = G.campos.length === 0;

    /* teto de quantidade: duas magias grandes não comem a memória */
    G.campos.length = 0;
    const muitos = [];
    for (let dy = -14; dy <= 14; dy++) for (let dx = -14; dx <= 14; dx++) muitos.push([P.x + dx, P.y + dy]);
    sempre(() => criaCampo(muitos, P.z, 'fire', 200));
    globalThis.tetoVale = G.campos.length <= CAMPO_MAX;

    /* a magia de área de verdade deixa campo; a de feixe/cone não */
    G.campos.length = 0;
    const aoeFogo = SPELLS.find(s => s.type === 'aoe' && s.el === 'fire');
    P.level = Math.max(P.level, aoeFogo.lvl); P.mana = P.st.maxmana = 1e6;
    P.voc = aoeFogo.voc ? aoeFogo.voc[0] : P.voc; recalc();
    castSpell(aoeFogo);
    globalThis.aoeDeixou = G.campos.length > 0;
    G.campos.length = 0;
    const feixe = SPELLS.find(s => (s.type === 'beam' || s.type === 'wave') && ESTADO_DE[s.el] && s.lvl <= P.level);
    globalThis.temFeixe = !!feixe;
    if (feixe) { P.cd = {}; castSpell(feixe); }
    globalThis.feixeDeixou = G.campos.length > 0;

    /* E o relógio DE VERDADE: as duas acima medem a peça chamando tickCampos na
       mão, e passariam com o tique nunca ligado ao frame. Aqui quem aplica é o
       bloco de 3 s dentro do frame, como em jogo. */
    G.campos.length = 0; P.buffs = {}; G.mobs.length = 0; G.dead = false;
    P.hp = P.st.maxhp = 1e9;
    /* Estado inicial igual, senão isto vira falso negativo: um hitstop de um
       bloco anterior (G.pausa) faz o frame desenhar e voltar antes do relógio
       de 3 s, e o jogo parado (G.started) sai antes ainda. É a armadilha que a
       própria página de repasse documenta. */
    G.pausa = 0; G.started = true;
    sempre(() => criaCampo([[P.x, P.y]], P.z, 'fire', 200));
    G.lastRegen = G.now - 4000;
    frame(G.real + 16);
    globalThis.frameAplicou = !!P.buffs.queimando;
  })();`, ctx);

  A(S.nFogo === 9 && S.campoFogo, 'com o sorteio forçado, a área de fogo marca os 9 tiles');
  A(S.forcaDoCampo === 200 * S.CAMPO_FORCA,
    `o resíduo é fração do golpe (${S.forcaDoCampo} de 200), não o golpe inteiro — atravessar não pode custar mais que levar a magia`);
  A(S.espalhou, `a área NÃO acende inteira: ${S.fracao} dos tiles andáveis pegaram campo`);
  A(S.fracao > .2 && S.fracao < .8,
    `e a fração fica longe dos dois extremos (${S.fracao}) — 0 é campo nenhum, 1 é o muro que tira a escolha de por onde passar`);
  A(S.nSagrado === 0, 'sagrado não deixa campo — só o elemento que vira estado marca o chão');
  A(S.achouParede && S.nParede === 0, 'parede não pega fogo: campo só nasce em tile andável');
  A(S.umSoTile === 1 && S.relogioResetou, 'passar de novo RESETA o relógio e nunca empilha dois campos no tile');
  A(S.jogadorQueima && S.bichoQueima, 'quem está em cima pega o estado no tique — jogador e criatura');
  A(S.jogadorPerdeuVida, 'e o estado é quem cobra o dano, sem um segundo relógio');
  A(S.dragaoImune, 'imune não pega o campo, não só o dano — dragão atravessa o próprio fogo');
  A(S.expirou, 'o campo apaga sozinho quando a duração acaba');
  A(S.tetoVale, `o teto de ${S.CAMPO_MAX} tiles segura uma área enorme`);
  A(S.aoeDeixou, 'a magia de área de verdade deixa chão afetado (não só a chamada direta)');
  A(S.temFeixe && !S.feixeDeixou, 'feixe e cone NÃO deixam campo — são travessia, não zona');
  A(S.frameAplicou, 'o campo queima no relógio de 3s do frame, não só quando o teste chama o tique');

  /* ----------------------------------------- desviar é inteligência ------ */
  const classes = [...new Set(Object.values(S.MONSTERS).map(m => m.cls))];
  A(classes.every(c => S.INTEL[c] !== undefined),
    'toda classe declara inteligência: ' + classes.filter(c => S.INTEL[c] === undefined));
  A(S.intelOf(S.MONSTERS.cyclops) >= S.INTEL_DESVIA, 'o ciclope é esperto o bastante para dar a volta');
  A(S.intelOf(S.MONSTERS.skeleton) < S.INTEL_DESVIA, 'o esqueleto não é — ele atravessa');

  vm.runInContext(`(() => {
    newPlayer('IA', 'knight'); saiDoTemplo();
    P.hp = P.st.maxhp = 1e9; G.dead = false; G.now = 7e6;
    G.mobs.length = 0; G.campos.length = 0;
    const _r = Math.random;
    const sempre = f => { Math.random = () => 0; const v = f(); Math.random = _r; return v; };
    const vizinho = [P.x + 1, P.y];
    sempre(() => criaCampo([vizinho], P.z, 'fire', 200));
    const põe = id => { const m = spawnMob({ x: P.x + 3, y: P.y, z: P.z, m: id, el: -1 }); m.hp = m.maxhp = 1e6; return m; };
    globalThis.espertoEvita = evitaCampo(põe('cyclops'), vizinho[0], vizinho[1]);
    G.mobs.length = 0;
    globalThis.burroNaoEvita = evitaCampo(põe('skeleton'), vizinho[0], vizinho[1]);
    /* e quem é IMUNE não perde tempo desviando do que não o machuca */
    G.mobs.length = 0;
    globalThis.imuneNaoEvita = evitaCampo(põe('dragon'), vizinho[0], vizinho[1]);
    /* a régua vale no passo de verdade, não só na função solta: o esperto que
       tem o campo entre ele e o jogador não pisa nele */
    G.mobs.length = 0; G.campos.length = 0;
    const c = põe('cyclops'); c.x = P.x + 2; c.y = P.y; c.z = P.z;
    sempre(() => criaCampo([[P.x + 1, P.y]], P.z, 'fire', 200));
    const passo = passoAte(c, P.x, P.y);
    globalThis.passoEsperto = passo ? (passo[0] !== P.x + 1 || passo[1] !== P.y) : false;
    globalThis.espertoAndou = !!passo;
    G.mobs.length = 0;
    const e = põe('skeleton'); e.x = P.x + 2; e.y = P.y; e.z = P.z;
    const passoE = passoAte(e, P.x, P.y);
    globalThis.passoBurro = passoE ? (passoE[0] === P.x + 1 && passoE[1] === P.y) : false;
  })();`, ctx);

  A(S.espertoEvita, 'criatura inteligente evita o tile em chamas');
  A(!S.burroNaoEvita, 'criatura burra não evita — atravessa a fogueira');
  A(!S.imuneNaoEvita, 'quem é imune não desvia do que não o machuca (elemental no próprio elemento)');
  A(S.espertoAndou && S.passoEsperto, 'e o desvio vale no passo de verdade: o ciclope contorna o fogo');

  /* ------------------------------------------------ as três fases (#33) --- */
  A(S.CAMPO_DUR >= 120000, `o campo dura minutos, não segundos (${S.CAMPO_DUR / 1000}s)`);
  A(S.CAMPO_FASES.length === 3 && S.CAMPO_FASES[S.CAMPO_FASES.length - 1].ate === 1,
    'são três fases e a última fecha em 1 — sem buraco no fim da vida do campo');
  {
    const d = S.CAMPO_FASES.map(f => f.dano);
    A(d[0] > d[1] && d[1] > d[2] && d[2] === 0,
      `o dano só cai e a última é ZERO (${d.join(' > ')}) — a mínima é marca, não armadilha`);
    const lim = S.CAMPO_FASES.map(f => f.ate);
    A(lim.every((x, i) => i === 0 || x > lim[i - 1]), 'os limites das fases sobem, sem fase de duração negativa');
    A(S.campoFase(0) === 0 && S.campoFase(.99) === 2 && S.campoFase(1) === 2 && S.campoFase(5) === 2,
      'campoFase cobre a vida inteira e não estoura depois do fim');
  }

  vm.runInContext(`(() => {
    newPlayer('Fases', 'knight'); saiDoTemplo();
    P.hp = P.st.maxhp = 1e9; G.dead = false; G.mobs.length = 0; G.campos.length = 0;
    G.pausa = 0; G.started = true; G.now = 9e6;
    const _r = Math.random;
    const sempre = f => { Math.random = () => 0; const x = f(); Math.random = _r; return x; };
    sempre(() => criaCampo([[P.x, P.y]], P.z, 'fire', 400));
    const c = campoEm(P.x, P.y, P.z), nasceu = c.t;
    /* o dano cobrado cai degrau a degrau, medido no meio de cada fase */
    globalThis.porFase = CAMPO_FASES.map((f, i) => {
      const ini = i ? CAMPO_FASES[i - 1].ate : 0;
      G.now = nasceu + c.dur * (ini + (f.ate - ini) / 2);
      return Math.round(campoDano(c));
    });
    /* e pisar na fase mínima não tira vida nem acende estado */
    G.now = nasceu + c.dur * .9;
    P.buffs = {}; const antes = P.hp;
    pisaCampo(P);
    globalThis.minimaNaoDoi = P.hp === antes && !P.buffs.queimando;
    /* enquanto na cheia, o mesmo passo cobra */
    G.now = nasceu + c.dur * .2;
    P.buffs = {}; const antes2 = P.hp;
    pisaCampo(P);
    globalThis.cheiaDoi = antes2 - P.hp > 0;
    /* a criatura esperta desvia da cheia e NÃO desvia da apagada */
    const c2 = spawnMob({ x: P.x + 3, y: P.y, z: P.z, m: 'cyclops', el: -1 });
    c2.hp = c2.maxhp = 1e6;
    G.now = nasceu + c.dur * .2;
    globalThis.desviaDaCheia = evitaCampo(c2, P.x, P.y);
    G.now = nasceu + c.dur * .9;
    globalThis.desviaDaApagada = evitaCampo(c2, P.x, P.y);
    /* E o DESENHO muda de fase junto, senão o dano some da tela e o jogador não
       tem como saber se aquele tile ainda machuca (§20). O canvas do node é um
       stub que não guarda pixel, então a prova é gravar as chamadas de desenho
       e comparar: mesma fase, mesmas chamadas; fase diferente, chamadas
       diferentes. Fica de fora o gelo, que sorteia as agulhas de geada e daria
       traço diferente a cada leitura — ver a armadilha de assertiva
       probabilística mais acima. */
    /* Gravador que mede ÁREA PINTADA, não número de chamadas. A primeira versão
       contava chamadas e reprovou uma correção legítima do fogo: a fase fraca
       desenha as MESMAS colunas, só mais baixas — mesma contagem, metade do
       fogo. Contagem de chamada é proxy de "quantos traços", e o que interessa
       é "quanto do tile ficou coberto".
       Soma retângulo por w×h, elipse por πrxry e polígono pela fórmula do
       laço (shoelace), fechando no fill() para não contar caminho descartado.
       ATENÇÃO: este bloco vive dentro de um template literal — crase aqui
       fecha a string e o arquivo inteiro deixa de compilar. Já aconteceu duas
       vezes; se a suíte parar com "missing ) after argument list", procure crase
       em comentário antes de qualquer outra coisa. */
    const grava = () => {
      const est = { area: 0, ops: 0, pts: [], pend: 0, lw: 1 };
      const g = new Proxy({}, {
        get: (t, k) => {
          if (k === '__est') return est;
          return (...a) => {
            est.ops++;
            if (k === 'beginPath') { est.pts = []; est.pend = 0; }
            else if (k === 'fillRect') est.area += Math.abs(a[2] * a[3]);
            else if (k === 'ellipse' || k === 'arc')
              est.pend += Math.PI * Math.abs(a[2]) * Math.abs(k === 'arc' ? a[2] : a[3]);
            else if (k === 'moveTo' || k === 'lineTo') est.pts.push([a[0], a[1]]);
            // curva conta pelo ponto de chegada: aproxima o comprimento por baixo,
            // que é o lado seguro para um teste de "não ficou invisível"
            else if (k === 'quadraticCurveTo') est.pts.push([a[2], a[3]]);
            else if (k === 'fill') {
              est.area += est.pend; est.pend = 0;
              const p = est.pts;
              if (p.length > 2) {
                let s2 = 0;
                for (let i = 0; i < p.length; i++) {
                  const b = p[(i + 1) % p.length];
                  s2 += p[i][0] * b[1] - b[0] * p[i][1];
                }
                est.area += Math.abs(s2) / 2;
              }
              est.pts = [];
            }
            /* Traço também conta, e por comprimento × espessura: a energia é
               desenhada SÓ com stroke, então sem isto ela media área zero nas
               duas fases vivas e 16 na mínima — a régua acusava exatamente o
               contrário do que os olhos veem. */
            else if (k === 'stroke') {
              const p = est.pts;
              let len = 0;
              for (let i = 1; i < p.length; i++) len += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
              est.area += len * est.lw + est.pend;
              est.pend = 0; est.pts = [];
            }
          };
        },
        set: (t, k, val) => { if (k === 'lineWidth') est.lw = val; return true; }
      });
      return g;
    };
    globalThis.desenhoPorFase = {};
    for (const el of ['fire', 'earth', 'energy']) {
      const area = [0, 1, 2].map(f => {
        const g = grava();
        CAMPO_DRAW[el](g, 32, ELEM[el].cor, 0, 0, f);
        return Math.round(g.__est.area);
      });
      const assinatura = [0, 1, 2].map(f => {
        const vistos = [];
        const g = new Proxy({}, { get: (t, k) => (...a) =>
          vistos.push(k + '(' + a.map(x => typeof x === 'number' ? x.toFixed(2) : x).join() + ')'),
          set: (t, k, val) => (vistos.push(k + '=' + val), true) });
        CAMPO_DRAW[el](g, 32, ELEM[el].cor, 0, 0, f);
        return vistos.join('|');
      });
      globalThis.desenhoPorFase[el] = {
        distintos: new Set(assinatura).size,
        area,
        /* NÃO se afere força por área, e esta é a TERCEIRA régua numérica a
           enganar aqui. A cicatriz de queimado cobre MAIS chão que a chama
           moribunda e é obviamente mais fraca; distância de cor mediu
           legibilidade e não identidade; contagem de chamadas reprovou uma
           correção legítima. O que dá para garantir por teste é o que é
           objetivo:
             1. as três fases desenham DIFERENTE (o jogador consegue separá-las);
             2. nenhuma delas fica INVISÍVEL — inclusive a mínima, que é
                cicatriz e não sumiço. Foi o defeito que o dono do projeto viu:
                veneno e energia na mínima deixavam o tile parecendo limpo.
           Se está bonito e se lê como aquele elemento, só olho humano diz. */
        area
      };
    }
  })();`, ctx);

  A(S.porFase[0] > S.porFase[1] && S.porFase[1] > 0 && S.porFase[2] === 0,
    `o campo cobra menos a cada fase e para na última (${S.porFase.join(' → ')} de dano)`);
  A(S.cheiaDoi, 'pisar na fase cheia cobra');
  A(S.minimaNaoDoi, 'e pisar na fase mínima não tira vida nem acende estado — sobra a marca');
  A(S.desviaDaCheia && !S.desviaDaApagada,
    'a criatura esperta contorna o fogo vivo e atravessa a brasa apagada — desviar do que não machuca seria burrice com cara de esperteza');
  for (const el of ['fire', 'earth', 'energy']) {
    const d = S.desenhoPorFase[el];
    A(d.distintos === 3, `${el}: as três fases DESENHAM diferente (${d.distintos}/3) — sem isso o dano some da tela e o jogador não sabe se o tile ainda dói`);
    /* 90 é piso contra SUMIR, não nota de qualidade: um desenho vazio dá 0 e
       meia dúzia de pontinhos dá ~20. Calibrado nos valores medidos, não
       escolhido antes — e a régua já provou três vezes que número não julga
       arte, só pega o caso em que não há arte nenhuma. */
    A(d.area.every(a => a >= 90),
      `${el}: nenhuma fase fica invisível, a mínima inclusive (${d.area.join('→')} px² num tile de 1024) — mínima é CICATRIZ, não tile limpo`);
  }
  A(S.passoBurro, 'o esqueleto pisa nele em linha reta — as duas metades juntas, senão "ninguém desvia" passaria');

  /* -------------------------------------- entrar CUSTA, atravessar também -- */
  vm.runInContext(`(() => {
    newPlayer('Pisa', 'knight'); saiDoTemplo();
    P.hp = P.st.maxhp = 1e9; G.dead = false; G.mobs.length = 0; G.campos.length = 0;
    G.pausa = 0; G.started = true; G.now = 8e6; G.lastRegen = G.now;
    P.buffs = {};
    const _r = Math.random;
    const sempre = f => { Math.random = () => 0; const v = f(); Math.random = _r; return v; };

    /* anda de um tile limpo para um em chamas, pelo caminho de verdade */
    const destino = [P.x + 1, P.y];
    if (!isWalkable(destino[0], destino[1], P.z)) return globalThis.semDestino = true;
    sempre(() => criaCampo([destino], P.z, 'fire', 400));
    const antes = P.hp;
    tryStep(P, destino[0], destino[1]);
    globalThis.reservaNaoCobra = P.hp === antes;      // reservar o tile não queima
    G.now += 5000; lerpEntity(P);                      // a CHEGADA é que cobra
    globalThis.entrouDoeu = antes - P.hp;
    globalThis.entrouQueimou = !!P.buffs.queimando;

    /* CADA tile cobra: andar de um tile de campo para o vizinho dói de novo */
    const dentro = [P.x, P.y + 1];
    globalThis.temVizinho = isWalkable(dentro[0], dentro[1], P.z);
    if (globalThis.temVizinho) {
      sempre(() => criaCampo([dentro], P.z, 'fire', 400));
      const hp2 = P.hp;
      tryStep(P, dentro[0], dentro[1]); G.now += 5000; lerpEntity(P);
      globalThis.andarDentroDoeu = hp2 - P.hp;
    }

    /* sair e voltar cobra de novo — é o "toda vez que passar" */
    const emChamas = [P.x, P.y];
    const fora = [[0,-1],[0,1],[1,0],[-1,0],[1,1],[-1,-1]]
      .map(([dx, dy]) => [P.x + dx, P.y + dy])
      .find(([x, y]) => isWalkable(x, y, P.z) && !campoEm(x, y, P.z));
    globalThis.temFora = !!fora;
    if (fora) {
      tryStep(P, fora[0], fora[1]); G.now += 5000; lerpEntity(P);
      const hp3 = P.hp, fim = P.buffs.queimando ? P.buffs.queimando.end : 0;
      tryStep(P, emChamas[0], emChamas[1]); G.now += 5000; lerpEntity(P);
      globalThis.voltarDoeu = hp3 - P.hp;
      globalThis.relogioReiniciou = !!(P.buffs.queimando && P.buffs.queimando.end > fim);
    }

    /* e o estado NÃO acumula: uma entrada e três entradas dão um buff só */
    globalThis.umBuffSo = Object.keys(P.buffs).filter(k => k === 'queimando').length;
  })();`, ctx);

  A(!S.semDestino, 'achou tile andável para o teste de pisar');
  A(S.reservaNaoCobra, 'reservar o tile não queima — o campo cobra na chegada, não no tryStep');
  A(S.entrouDoeu > 0 && S.entrouQueimou, `entrar na área custa na hora (${S.entrouDoeu} de vida) e acende o estado`);
  A(S.temVizinho && S.andarDentroDoeu > 0,
    `CADA tile de campo cobra: o segundo tile doeu ${S.andarDentroDoeu}, não zero`);
  A(S.temFora && S.voltarDoeu > 0, `sair e voltar cobra outra vez (${S.voltarDoeu} de vida)`);
  A(S.relogioReiniciou, 'e o relógio do estado reinicia, sem empilhar um segundo');
  A(S.umBuffSo === 1, 'o dano se repete mas o ESTADO não acumula — três passagens, um buff só');
}

/* ============================================ mapa como arquivo (passo 2) == */
{
  /* Ida e volta: o mundo gerado vira texto e o texto vira o MESMO mundo. Sem
     esta trava, o dia em que um tile novo entrar em T sem entrar em TILE_CHAR o
     mapa carrega calado com o chão errado — e o defeito só aparece jogando. */
  A(S.TILE_CHAR.length === Object.keys(S.T).length,
    `toda entrada de T tem caractere no mapa (${S.TILE_CHAR.length} de ${Object.keys(S.T).length})`);
  A(new Set(S.TILE_CHAR).size === S.TILE_CHAR.length, 'nenhum caractere de tile repetido — dois tiles iguais no arquivo');

  vm.runInContext(`(() => {
    genWorld(4242);
    const conta = () => {
      let and = 0, esc = 0;
      for (let z = 0; z < FLOORS; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const t = tileAt(x, y, z);
        if (TILE[t].walk) and++;
        if (t === T.UP || t === T.DOWN) esc++;
      }
      return { and, esc, sp: WORLD.spawns.length, h: WORLD.hunts.length, p: WORLD.pois.length,
               w: W, h2: H, f: FLOORS, tx: WORLD.temple.x, ty: WORLD.temple.y, nomes: FLOOR_NAMES.join('|') };
    };
    globalThis.antesDoMapa = conta();
    const txt = JSON.stringify(mapaSerializa('teste'));
    globalThis.tamanhoKB = Math.round(txt.length / 1024);
    /* zera tudo antes de recarregar: se mapaAplica esquecer um campo, o teste
       tem de acusar em vez de ler o resto que sobrou na memória */
    WORLD.floors = []; WORLD.spawns = []; WORLD.hunts = []; WORLD.pois = [];
    mapaAplica(JSON.parse(txt));
    globalThis.depoisDoMapa = conta();
    globalThis.nomeDoMapa = WORLD.mapa;
    /* Um mapa PEQUENO, escrito à mão. É o teste que importa: o arquivo é quem
       manda no tamanho, e sem isto W e H poderiam continuar cravados em 224
       que nada acusaria — o mundo gerado tem justamente 224. */
    const linhas = z => {
      const L = [];
      for (let y = 0; y < 10; y++) {
        let l = '';
        for (let x = 0; x < 12; x++) l += (x === 0 || y === 0 || x === 11 || y === 9) ? 'R' : (z ? 'c' : 'g');
        L.push(l);
      }
      return L.join(String.fromCharCode(10));   // sem barra invertida: este bloco vive dentro de template literal
    };
    mapaAplica({ nome: 'anao', w: 12, h: 10, andares: 2, sup: 0, origem: 1,
      nomes: ['Cima', 'Baixo'], templo: { x: 5, y: 5, z: 0 },
      hunts: [], pois: [], spawns: [{ x: 3, y: 3, z: 0, m: 'rat' }],
      tiles: [linhas(0), linhas(1)] });
    globalThis.anao = {
      w: W, h: H, f: FLOORS, nomes: FLOOR_NAMES.join('|'),
      meio: tileAt(5, 5, 0), borda: tileAt(0, 0, 0), baixo: tileAt(5, 5, 1),
      foraDireita: isWalkable(12, 5, 0), dentro: isWalkable(5, 5, 0),
      sp: WORLD.spawns.length
    };

    /* e o gerador continua vivo: sem nome de mapa, sorteia como sempre */
    genWorld(777);
    globalThis.geradorVivo = WORLD.floors.length === FLOORS && WORLD.spawns.length > 0 && WORLD.mapa === null;
    /* e volta ao tamanho DELE. Sem esta, o gerador herdava as dimensões do
       último mapa carregado e quebrava nas escadas — que foi como este teste
       nasceu. */
    globalThis.geradorRestaurou = { w: W, h: H, f: FLOORS, sup: SURF, nomes: FLOOR_NAMES.length };
  })();`, ctx);

  const a = S.antesDoMapa, b = S.depoisDoMapa;
  for (const k of ['and', 'esc', 'sp', 'h', 'p', 'w', 'h2', 'f', 'tx', 'ty', 'nomes'])
    A(a[k] === b[k], `ida e volta preserva ${k}: ${a[k]} -> ${b[k]}`);
  A(S.nomeDoMapa === 'teste', 'o mundo carregado sabe de que mapa veio — o save precisa disso');
  {
    const n = S.anao;
    A(n.w === 12 && n.h === 10 && n.f === 2,
      `o ARQUIVO manda no tamanho: ${n.w}x${n.h} em ${n.f} andares, e não os 224x224x6 do gerador`);
    A(n.nomes === 'Cima|Baixo', 'e manda também nos nomes dos andares');
    A(n.meio === S.T.GRASS && n.baixo === S.T.CFLOOR && n.borda === S.T.ROCK,
      'cada caractere volta como o tile certo, no andar certo');
    A(n.dentro && !n.foraDireita, 'a borda do mapa passa a ser a do arquivo — 12 de largura, não 224');
    A(n.sp === 1, 'e os spawns do arquivo entram inteiros');
  }
  A(S.geradorVivo, 'o gerador continua vivo e marca o mundo como SEM mapa');
  {
    const r = S.geradorRestaurou, a = S.antesDoMapa;
    A(r.w === a.w && r.h === a.h2 && r.f === a.f && r.nomes === a.f,
      `o gerador reafirma o tamanho DELE depois de um mapa menor (${r.w}x${r.h}x${r.f}, e não 12x10x2)`);
  }
  console.log(`  mapa de ${a.w}x${a.h2}x${a.f} congelado em ${S.tamanhoKB} KB`);
}

console.log(`  espada ${T2.sk.sword.l} · escudo ${T2.sk.shielding.l} após 2 min de treino`);
console.log(`  dragão: ${Math.min(...tam)}–${Math.max(...tam)} itens por morte, média ${medio.toFixed(1)}`);
console.log(bad ? `\n${ok} ok, ${bad} FALHA(S)\n` : `\ntudo certo: ${ok} verificações passaram\n`);
process.exit(bad ? 1 : 0);

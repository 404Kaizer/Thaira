/* data.js — tabelas do jogo (vocações, itens, afixos, monstros, magias).
   Só dados + fórmulas puras. Nenhuma dependência. */
'use strict';

const XP_MULT = 6;      // ponytail: multiplicador global de xp p/ caber numa sessão; baixe p/ 1 se quiser grind clássico
const SKILL_RATE = 4;   // mesma curva de skill do Tibia, só N× mais rápida (par com XP_MULT); 1 = ritmo original
const MAGIC_BASE = 400; // mana necessária p/ magic level 1
/* Intervalo do ataque básico, e PISO do descanso de toda magia que causa dano.
   Havia magia de dano em 1100–1400 ms contra os 2000 do golpe de arma, o que
   invertia o jogo: com mana e poção bastando, conjurar sem parar batia mais que
   qualquer arma, e conseguir arma boa deixava de valer a pena. Magia pode ser
   mais FORTE que o golpe, nunca mais frequente.
   Cura e utilidade ficam de fora do piso de propósito — elas não competem com a
   arma por dano, e travar `exura` em 2 s tiraria a defesa de quem conjura. */
const ATAQUE_MS = 2000;
/* Alcance do tiro, em tiles. Vale para arco/besta e para a VARA DE PESCA — a
   linha chega tão longe quanto a flecha, e é o mesmo número de propósito: quem
   mexer no alcance do tiro tem de ver a pesca acompanhar. Estava cravado dentro
   do `weaponInfo`. */
const ALCANCE_TIRO = 5;
/* DEFESA: um contador só, e uma conta só.
   Havia dois sistemas empilhados — armadura por subtração plana e escudo por
   bloqueio tudo-ou-nada — e cada um criava o próprio limiar de imunidade. Com
   armadura 60 em postura defensiva a subtração comia de 41 a 82 de dano fixo,
   então criatura que batesse abaixo disso causava ZERO; e o bloqueio saturava
   no teto com um escudo de bronze de nível 1, anulando 60% dos golpes de
   qualquer jogador para sempre. Dois contadores, dois muros, e nenhum dos dois
   escalava com o equipamento depois do começo do jogo.
   Agora toda peça vestida — armadura, elmo, perneira, bota, escudo, arma —
   soma no MESMO número, e ele vira uma fração do golpe:

     defEf = DEFESA × postura × (1 + skillEscudo/100)
     redução = defEf / (defEf + DEF_K)

   Percentual e não subtração: a curva nunca chega a 1, então imunidade deixa
   de ser possível por construção, e o mesmo número funciona contra um golpe de
   12 e contra um de 553 — que é o que achata a dificuldade do nível 8 ao 320.
   O Tibia moderno faz a armadura assim também (`a/100 · c`, armadura como
   percentual do ataque), e é por isso que lá a armadura total fica na casa dos
   30-40: em percentual puro, 100 seria imunidade. A curva dispensa esse teto. */
const DEF_K = 400;
/* Piso: esta fração do golpe bruto sempre passa. Com a curva percentual ele
   nunca chega a valer — a redução máxima hoje é 56% — mas é ele que garante a
   promessa "nada é imune" mesmo se um imbuement ou um conjunto futuro empurrar
   a DEFESA para um número que ninguém previu. Resistência elemental corta
   DEPOIS e tem teto próprio de 75%. */
const DANO_MIN = 0.12;
const DANO_TIPOS = ['attack', 'beam', 'wave', 'aoe', 'melee', 'melee_aoe'];
const cdDe = sp => DANO_TIPOS.includes(sp.type) ? Math.max(sp.cd, ATAQUE_MS) : sp.cd;

/* Dano e cura de magia. A conta antiga era `base × (1 + ML×0.11)`, ou seja o
   ganho por ponto de ML era 0.11×base — PROPORCIONAL ao tamanho da magia. Isso
   fazia a distância entre a magia mais fraca e a mais forte crescer para
   sempre: 1,43 de ganho por ponto na Faísca contra 23,10 na Fúria dos Céus,
   16× de espalhamento. No Tibia o ganho por ML é escrito à mão em cada magia e
   as strikes todas ficam entre 1,4 e 2,2 — o jogo ESCOLHE a distância, ela não
   é consequência da base.

   Aqui a raiz quadrada faz o mesmo trabalho sem 27 campos novos: magia maior
   ainda escala mais, mas sublinearmente. O espalhamento cai para 4×, que é a
   faixa que separa uma strike inicial de uma AoE de fim de jogo.
   K = 0.39 está calibrado para deixar as magias iniciais IGUAIS ao que eram
   (corte de 1%) e cortar só o topo — a ponta de baixo já estava certa.
   Se uma magia um dia precisar fugir da régua, o caminho é um campo `mlk`
   nela e `sp.mlk ?? MAG_K * Math.sqrt(base)`; não vale criar antes de precisar.
   Serve magia e runa: eram duas escalas quase iguais (0.11 e 0.10) por acidente,
   e deixar a runa de fora só mudaria o exagero de lugar. */
const MAG_K = 0.39;
const magPower = (base, ml, level) => base + ml * MAG_K * Math.sqrt(base) + level * 0.25;

/* ---------------------------------------------------------------- vocações */
/* spd = % da velocidade base ganho por nível. No Tibia todos ganham igual;
   aqui o mago é o mais rápido e o cavaleiro o mais lento, como você pediu.
   Os valores caíram para ~1/4 do que eram (knight 0.65, sorcerer 1.25). A
   fórmula é linear e sem teto, então com os antigos um sorcerer passava a
   criatura mais rápida do jogo no nível 47 e no 300 andava a 1042 — três vezes
   o lobo, 96 ms por tile. Fugir de tudo, para sempre, de graça. Agora o nível
   300 fica entre 325 (knight) e 425 (sorcerer): ainda bem acima da criatura de
   meio de jogo, e alcançável pelas classes caçadoras de tier alto. */
const VOCATIONS = {
/* color = a cor da vocação: boneco no mapa, símbolo, criação e lista. Uma só. */
  knight: {
    name: 'Knight', emoji: '🛡️', color: '#d25555',
    hp: 15, mana: 5, hpReg: 5, mpReg: 2, spd: 0.16,
    sk: { fist: 1.1, sword: 1.1, axe: 1.1, club: 1.1, distance: 1.4, shielding: 1.1, mining: 1.1, woodcut: 1.1, fishing: 1.1 }, magic: 3.0,
    desc: 'Ganha três vezes mais vida que um mago e não conjura quase nada. Fica na frente, apanha e devolve com espada, machado ou maça.',
    tags: ['Segura a linha', 'Espada e escudo', 'Magia quase nula']
  },
  ranger: {
    name: 'Ranger', emoji: '🏹', color: '#5587d2',
    hp: 10, mana: 15, hpReg: 4, mpReg: 4, spd: 0.21,
    sk: { fist: 1.2, sword: 1.2, axe: 1.2, club: 1.2, distance: 1.1, shielding: 1.1, mining: 1.1, woodcut: 1.1, fishing: 1.1 }, magic: 1.4,
    desc: 'A melhor mão do jogo para arco e besta, e vida suficiente para errar um passo. Atira, recua e atira de novo.',
    tags: ['Arco e besta', 'Bate e recua', 'Mana para runas']
  },
  sorcerer: {
    name: 'Sorcerer', emoji: '🔥', color: '#ae55d2',
    hp: 5, mana: 30, hpReg: 2, mpReg: 8, spd: 0.31,
    sk: { fist: 1.5, sword: 2.0, axe: 2.0, club: 2.0, distance: 2.0, shielding: 1.5, mining: 1.1, woodcut: 1.1, fishing: 1.1 }, magic: 1.1,
    desc: 'Seis vezes mais mana que vida por nível. Um exevo flam hur limpa o corredor; dois golpes de volta limpam você.',
    tags: ['Fogo e energia', 'Mana de sobra', 'Casca de vidro']
  },
  druid: {
    name: 'Druid', emoji: '❄️', color: '#98d255',
    /* hp 7 contra os 5 do sorcerer: os dois eram numericamente IDÊNTICOS, e a
       tag "aguenta a caçada" dependia inteiramente de ter a Cura Suprema.
       A vida a mais é o que torna o diferencial real — e de quebra derruba a
       cura como fração da barra, que era o resíduo de 124% do #38c. */
    hp: 7, mana: 30, hpReg: 2, mpReg: 8, spd: 0.26,
    sk: { fist: 1.5, sword: 2.0, axe: 2.0, club: 2.0, distance: 2.0, shielding: 1.5, mining: 1.1, woodcut: 1.1, fishing: 1.1 }, magic: 1.1,
    desc: 'A mesma mana do sorcerer e metade a mais de vida, gasta em gelo, terra e no exura vita que te mantém de pé quando a caçada vira. Bate menos que o sorcerer e cai muito depois.',
    tags: ['Gelo e terra', 'Cura pesada', 'Aguenta a caçada']
  }
};
/* símbolo da vocação — o arquivo é assets/vocations/<chave>_symbol.png.
   Mesmo caminho dos itens: quem desenha usa innerHTML, então basta a tag. */
for (const k in VOCATIONS) VOCATIONS[k].emoji = `<img class="ii" src="assets/vocations/${k}_symbol.png" alt="">`;

const SKILL_NAMES = {
  fist: 'Punho', sword: 'Espada', axe: 'Machado', club: 'Clava',
  distance: 'Distância', shielding: 'Escudo', magic: 'Magic Level',
  mining: 'Mineração', woodcut: 'Lenha', fishing: 'Pesca'
};
/* Quem colhe é diferente de quem luta: a skill de coleta não entra em `st.sk`
   como bônus de equipamento, só existe para decidir O QUE se tira do tile. */
const SKILLS_COLETA = ['mining', 'woodcut', 'fishing'];

/* fórmulas de progressão (baseadas nas do Tibia) */
function expForLevel(l) { return Math.floor((50 / 3) * (l * l * l - 6 * l * l + 17 * l - 12)); }
function triesFor(skill, lvl, voc) {
  const base = skill === 'distance' ? 25 : skill === 'shielding' ? 100 : 50;
  return Math.max(1, Math.ceil(base * Math.pow(VOCATIONS[voc].sk[skill], lvl - 10) / SKILL_RATE));
}
function manaForML(ml, voc) { return Math.max(1, Math.ceil(MAGIC_BASE * Math.pow(VOCATIONS[voc].magic, ml) / SKILL_RATE)); }

/* ---------------------------------------------------------------- raridade */
const RARITY = [
  { name: 'Comum', color: '#cfc9ba', affixes: 0, w: 1000 },
  { name: 'Mágico', color: '#5aa9ff', affixes: 1, w: 330 },
  { name: 'Raro', color: '#f2d24b', affixes: 2, w: 105 },
  { name: 'Épico', color: '#c77dff', affixes: 3, w: 30 },
  { name: 'Lendário', color: '#ff8b3d', affixes: 4, w: 7 }
];

/* bônus possíveis: atkPct defPct arm speed maxhp maxmana crit lifesteal
   sword axe club distance shielding magic fist hpReg mpReg */
const PREFIXES = [
  { n: 'Afiada', b: { atkPct: 0.12 } },
  { n: 'Brutal', b: { atkPct: 0.20 } },
  { n: 'Reforçada', b: { arm: 2 } },
  { n: 'Blindada', b: { arm: 4 } },
  { n: 'Ágil', b: { speed: 18 } },
  { n: 'Vampírica', b: { lifesteal: 0.05 } },
  { n: 'Cruel', b: { crit: 0.06 } },
  { n: 'Rúnica', b: { magic: 1 } },
  { n: 'Sólida', b: { defPct: 0.15 } },
  { n: 'Vital', b: { hpReg: 2 } },
  /* resistência do jogador: chave `res<Elemento>`, em fração do dano cortado.
     É o outro lado da tabela RES — lá o monstro resiste por multiplicador, aqui
     o jogador resiste por porcentagem, porque é isso que cabe num equipamento. */
  { n: 'Aterrada', b: { resEnergy: 0.15 } },
  { n: 'Ígnea', b: { resFire: 0.15 } }
];
const SUFFIXES = [
  { n: 'do Urso', b: { maxhp: 30 } },
  { n: 'do Titã', b: { maxhp: 70 } },
  { n: 'do Sábio', b: { maxmana: 40 } },
  { n: 'do Arcano', b: { maxmana: 90, mpReg: 2 } },
  { n: 'do Guerreiro', b: { sword: 2, axe: 2, club: 2 } },
  { n: 'do Caçador', b: { distance: 3 } },
  { n: 'do Guardião', b: { shielding: 3 } },
  { n: 'do Mago', b: { magic: 2 } },
  { n: 'da Sorte', b: { crit: 0.05, lifesteal: 0.03 } },
  { n: 'do Vento', b: { speed: 25 } },
  { n: 'do Dragão', b: { resFire: 0.2 } },
  { n: 'do Inverno', b: { resIce: 0.2 } },
  { n: 'do Sepulcro', b: { resDeath: 0.15, resEarth: 0.1 } }
];

/* ------------------------------------------------------------------- itens */
const ITEMS = {};
/* 13 sprites cobrem arma/equipamento/consumível; o resto continua emoji.
   Trocar aqui vale em inventário, hotbar, loja e bestiário de uma vez, porque
   todos renderizam `ico` via innerHTML. Casa por id, depois tipo de arma,
   depois slot, depois emoji — do mais específico para o mais genérico. */
/* `green_wood` empresta a arte da madeira comum de propósito: é o mesmo material
   em outra qualidade, e o §12 pede que o mesmo item se pareça consigo mesmo. O
   que separa os dois é o nome e o preço, não o desenho. */
const SPRITE_ID = { dagger: 'dagger', green_wood: 'wood' };
const SPRITE_WT = { sword: 'sword', axe: 'axe', distance: 'bow', club: 'mace' };
const SPRITE_SLOT = { helmet: 'helmet', armor: 'armor', shield: 'shield', boots: 'boots' };
/* '🔮' é o ico padrão de toda runa: as 7 já eram idênticas entre si, então o
   disco serve pras 7 — o elemento continua vindo do nome e da cor do efeito */
const SPRITE_ICO = { '🧪': 'potion', '🦴': 'bone', '💎': 'gem', '🔮': 'rune_fire' };
/* Arte própria ganha do genérico: se existe um PNG chamado como o id do item,
   é ele. É o que faz "soltar o arquivo na pasta e rodar o script" bastar —
   ICONES vem de src/icones.js, gerado por assets/build_skins.py. */
const spriteOf = o => (typeof ICONES !== 'undefined' && ICONES.has(o.id) ? o.id : null)
  || SPRITE_ID[o.id] || SPRITE_WT[o.wt] || SPRITE_SLOT[o.slot] || SPRITE_ICO[o.ico];
/* Emoji padrão por slot. Item declarado sem `ico` que também não casa nenhum PNG
   saía com `undefined` no lugar do ícone — a mochila, a loja e o balão mostravam
   a palavra, e o chão desenhava o quadradinho da raridade. Oito peças de conjunto
   do fim de jogo estavam assim (grevas, amuleto e anel de sa/vz). */
const ICO_SLOT = {
  helmet: '⛑️', armor: '🥋', legs: '👖', boots: '🥾', shield: '🛡️',
  amulet: '📿', ring: '💍', weapon: '⚔️', light: '🕯️'
};
/* Monta a <img> de um sprite. Vive fora do `item()` porque a moeda escolhe o
   arquivo pela QUANTIDADE, na hora de desenhar, e não no cadastro. Devolve ''
   quando não existe PNG, para quem chama cair no emoji de sempre.
   O 1x é gravado no tamanho exato do slot, então em tela comum o pixel do
   arquivo cai em cima do pixel da tela; em tela densa o srcset entrega o 2x e o
   encaixe se repete. Sem isso o navegador reamostra e volta o borrão.
   decoding="sync": no decode assíncrono (o padrão) a <img> recém-montada aparece
   um frame depois do resto da célula. A célula é reaproveitada (ver itemCell),
   então isso só pesa em item que entra na tela pela primeira vez — que é
   justamente onde o pisca-pisca ainda apareceria.
   A classe do slot deixa a mochila e o equipamento darem a anel, colar e bota o
   tamanho que eles têm de verdade — a mesma régua do chão (CHAO_ESCALA em
   render2d.js). Em linha de texto ela não casa com nada. */
function spriteImg(spr, slot) {
  if (typeof ICONES === 'undefined' || !ICONES.has(spr)) return '';
  const dobro = ICONES2X.has(spr)
    ? ` srcset="assets/icons/${spr}.png 1x, assets/icons/${spr}@2x.png 2x"` : '';
  return `<img class="ii ii-${slot || 'x'}" decoding="sync" src="assets/icons/${spr}.png"${dobro} alt="">`;
}
const item = o => {
  if (!o.ico) o.ico = ICO_SLOT[o.slot] || '📦';
  const s = spriteOf(o);
  // `spr` fica guardado porque depois de trocar `ico` pelo <img> o spriteOf não
  // casa mais o emoji — e o desenho do item no chão precisa do nome do arquivo
  if (s) {
    // `spr` fica guardado porque o desenho do item no chão precisa do nome do arquivo
    o.spr = s;
    o.ico = spriteImg(s, o.slot);
  }
  return (ITEMS[o.id] = o, o);
};

/* armas — atk usa a fórmula de dano com skill; wand/rod usam dmg fixo */
item({ id: 'dagger', n: 'Adaga', ico: '🗡️', slot: 'weapon', wt: 'sword', atk: 8, def: 4, lvl: 0, price: 20 });
item({ id: 'short_sword', n: 'Espada Curta', ico: '🗡️', slot: 'weapon', wt: 'sword', atk: 11, def: 8, lvl: 0, price: 90 });
item({ id: 'sabre', n: 'Sabre', ico: '🗡️', slot: 'weapon', wt: 'sword', atk: 13, def: 10, lvl: 0, price: 200 });
item({ id: 'sword', n: 'Espada', ico: '⚔️', slot: 'weapon', wt: 'sword', atk: 16, def: 12, lvl: 5, price: 500 });
item({ id: 'serpent_sword', n: 'Espada Serpente', ico: '⚔️', slot: 'weapon', wt: 'sword', atk: 22, def: 16, lvl: 12, price: 1800 });
item({ id: 'knight_sword', n: 'Espada do Cavaleiro', ico: '⚔️', slot: 'weapon', wt: 'sword', atk: 26, def: 20, lvl: 20, price: 4500 });
item({ id: 'fire_sword', n: 'Espada Flamejante', ico: '🔥', slot: 'weapon', wt: 'sword', atk: 33, def: 22, lvl: 30, price: 12000, b: { crit: 0.05 } });
item({ id: 'magic_sword', n: 'Espada Mágica', ico: '✨', slot: 'weapon', wt: 'sword', atk: 45, def: 30, lvl: 45, price: 60000, b: { crit: 0.08, magic: 1 } });

item({ id: 'hand_axe', n: 'Machadinha', ico: '🪓', slot: 'weapon', wt: 'axe', atk: 9, def: 5, lvl: 0, price: 25 });
item({ id: 'axe', n: 'Machado', ico: '🪓', slot: 'weapon', wt: 'axe', atk: 15, def: 9, lvl: 0, price: 250 });
/* Ferramentas de coleta. Ocupam o slot da ARMA: minerar exige guardar a espada,
   e é essa a escolha de jogo — você colhe desarmado. Por isso são armas ruins de
   verdade em vez de zeradas: quem for pego colhendo ainda revida, mal.
   O machado de lenhador não existe porque `axe` e `hand_axe` já servem — ver
   COLETA.woodcut, que aceita os dois. */
item({ id: 'pickaxe', n: 'Picareta', slot: 'weapon', wt: 'axe', atk: 7, def: 3, lvl: 0, price: 90 });
item({ id: 'fishing_rod', n: 'Vara de Pesca', slot: 'weapon', wt: 'club', atk: 3, def: 1, lvl: 0, price: 60 });
item({ id: 'battle_axe', n: 'Machado de Batalha', ico: '🪓', slot: 'weapon', wt: 'axe', atk: 21, def: 13, lvl: 10, price: 1200 });
item({ id: 'war_axe', n: 'Machado de Guerra', ico: '🪓', slot: 'weapon', wt: 'axe', atk: 32, def: 18, lvl: 25, price: 9000 });
item({ id: 'stonecutter_axe', n: 'Machado Corta-Pedra', ico: '🪓', slot: 'weapon', wt: 'axe', atk: 48, def: 26, lvl: 45, price: 70000, b: { atkPct: 0.05 } });

item({ id: 'mace', n: 'Maça', ico: '🔨', slot: 'weapon', wt: 'club', atk: 14, def: 9, lvl: 0, price: 90 });
item({ id: 'clerical_mace', n: 'Maça Clerical', ico: '🔨', slot: 'weapon', wt: 'club', atk: 20, def: 13, lvl: 8, price: 1000, b: { maxmana: 20 } });
item({ id: 'war_hammer', n: 'Martelo de Guerra', ico: '🔨', slot: 'weapon', wt: 'club', atk: 30, def: 17, lvl: 22, price: 8000 });
item({ id: 'thunder_hammer', n: 'Martelo do Trovão', ico: '⚡', slot: 'weapon', wt: 'club', atk: 46, def: 25, lvl: 45, price: 65000, b: { crit: 0.07 } });

item({ id: 'short_bow', n: 'Arco Curto', ico: '🏹', slot: 'weapon', wt: 'distance', atk: 12, def: 2, lvl: 0, price: 100 });
item({ id: 'bow', n: 'Arco', ico: '🏹', slot: 'weapon', wt: 'distance', atk: 18, def: 3, lvl: 5, price: 400 });
item({ id: 'crossbow', n: 'Besta', ico: '🏹', slot: 'weapon', wt: 'distance', atk: 24, def: 3, lvl: 12, price: 1600 });
item({ id: 'arbalest', n: 'Arbalesta', ico: '🏹', slot: 'weapon', wt: 'distance', atk: 34, def: 4, lvl: 28, price: 14000 });
item({ id: 'steel_crossbow', n: 'Besta de Aço', ico: '🏹', slot: 'weapon', wt: 'distance', atk: 38, def: 5, lvl: 36, price: 26000 });
item({ id: 'elvish_bow', n: 'Arco Élfico', ico: '🎯', slot: 'weapon', wt: 'distance', atk: 44, def: 6, lvl: 45, price: 60000, b: { crit: 0.08, distance: 2 } });

item({ id: 'wand_of_vortex', n: 'Varinha do Vórtice', ico: '🪄', slot: 'weapon', wt: 'wand', dmg: [9, 19], el: 'energy', lvl: 6, voc: ['sorcerer'], price: 500 });
item({ id: 'wand_of_dragonbreath', n: 'Varinha do Dragão', ico: '🪄', slot: 'weapon', wt: 'wand', dmg: [15, 28], el: 'fire', lvl: 13, voc: ['sorcerer'], price: 2000 });
item({ id: 'wand_of_decay', n: 'Varinha da Podridão', ico: '🪄', slot: 'weapon', wt: 'wand', dmg: [25, 44], el: 'death', lvl: 22, voc: ['sorcerer'], price: 6000 });
item({ id: 'wand_of_inferno', n: 'Varinha do Inferno', ico: '🪄', slot: 'weapon', wt: 'wand', dmg: [40, 62], el: 'fire', lvl: 36, voc: ['sorcerer'], price: 22000 });
item({ id: 'snakebite_rod', n: 'Cajado Serpente', ico: '🌿', slot: 'weapon', wt: 'wand', dmg: [9, 19], el: 'earth', lvl: 6, voc: ['druid'], price: 500 });
item({ id: 'moonlight_rod', n: 'Cajado do Luar', ico: '🌿', slot: 'weapon', wt: 'wand', dmg: [15, 28], el: 'ice', lvl: 13, voc: ['druid'], price: 2000 });
item({ id: 'terra_rod', n: 'Cajado da Terra', ico: '🌿', slot: 'weapon', wt: 'wand', dmg: [25, 44], el: 'earth', lvl: 22, voc: ['druid'], price: 6000 });
item({ id: 'hailstorm_rod', n: 'Cajado da Nevasca', ico: '❄️', slot: 'weapon', wt: 'wand', dmg: [40, 62], el: 'ice', lvl: 36, voc: ['druid'], price: 22000 });

/* escudos */
item({ id: 'wooden_shield', n: 'Escudo de Madeira', ico: '🛡️', slot: 'shield', def: 9, lvl: 0, price: 40 });
item({ id: 'studded_shield', n: 'Escudo Cravejado', ico: '🛡️', slot: 'shield', def: 13, lvl: 0, price: 200 });
item({ id: 'brass_shield', n: 'Escudo de Latão', ico: '🛡️', slot: 'shield', def: 16, lvl: 0, price: 500 });
item({ id: 'battle_shield', n: 'Escudo de Batalha', ico: '🛡️', slot: 'shield', def: 21, lvl: 8, price: 1400 });
item({ id: 'dwarven_shield', n: 'Escudo Anão', ico: '🛡️', slot: 'shield', def: 26, lvl: 15, price: 4000 });
item({ id: 'tower_shield', n: 'Escudo Torre', ico: '🛡️', slot: 'shield', def: 31, lvl: 25, price: 11000 });
item({ id: 'guardian_shield', n: 'Escudo do Guardião', ico: '🛡️', slot: 'shield', def: 35, lvl: 35, price: 26000, b: { shielding: 1 } });
item({ id: 'demon_shield', n: 'Escudo Demoníaco', ico: '😈', slot: 'shield', def: 39, lvl: 45, price: 75000, b: { shielding: 2, arm: 1 } });

/* elmos */
item({ id: 'leather_helmet', n: 'Elmo de Couro', ico: '⛑️', slot: 'helmet', arm: 2, lvl: 0, price: 15 });
item({ id: 'studded_helmet', n: 'Elmo Cravejado', ico: '⛑️', slot: 'helmet', arm: 3, lvl: 0, price: 80 });
item({ id: 'soldier_helmet', n: 'Elmo de Soldado', ico: '⛑️', slot: 'helmet', arm: 4, lvl: 0, price: 220 });
item({ id: 'brass_helmet', n: 'Elmo de Latão', ico: '⛑️', slot: 'helmet', arm: 5, lvl: 5, price: 600 });
item({ id: 'steel_helmet', n: 'Elmo de Aço', ico: '⛑️', slot: 'helmet', arm: 6, lvl: 12, price: 1800 });
item({ id: 'crown_helmet', n: 'Elmo da Coroa', ico: '👑', slot: 'helmet', arm: 7, lvl: 22, price: 6000 });
item({ id: 'royal_helmet', n: 'Elmo Real', ico: '👑', slot: 'helmet', arm: 8, lvl: 32, price: 20000 });
item({ id: 'demon_helmet', n: 'Elmo Demoníaco', ico: '😈', slot: 'helmet', arm: 10, lvl: 45, price: 80000, b: { maxhp: 40 } });

/* armaduras */
item({ id: 'leather_armor', n: 'Armadura de Couro', ico: '🥋', slot: 'armor', arm: 4, lvl: 0, price: 40 });
item({ id: 'studded_armor', n: 'Armadura Cravejada', ico: '🥋', slot: 'armor', arm: 5, lvl: 0, price: 150 });
item({ id: 'chain_armor', n: 'Cota de Malha', ico: '🥋', slot: 'armor', arm: 7, lvl: 0, price: 400 });
item({ id: 'brass_armor', n: 'Armadura de Latão', ico: '🥋', slot: 'armor', arm: 9, lvl: 8, price: 1200 });
item({ id: 'plate_armor', n: 'Armadura de Placas', ico: '🥋', slot: 'armor', arm: 11, lvl: 15, price: 3500 });
item({ id: 'knight_armor', n: 'Armadura do Cavaleiro', ico: '🥋', slot: 'armor', arm: 13, lvl: 25, price: 11000 });
item({ id: 'crown_armor', n: 'Armadura da Coroa', ico: '👑', slot: 'armor', arm: 14, lvl: 32, price: 22000 });
item({ id: 'dragon_scale_mail', n: 'Malha de Escamas', ico: '🐲', slot: 'armor', arm: 16, lvl: 40, price: 55000, b: { maxhp: 30 } });
item({ id: 'magic_plate_armor', n: 'Armadura Mágica', ico: '✨', slot: 'armor', arm: 18, lvl: 50, price: 120000, b: { maxmana: 80, magic: 1 } });

/* pernas */
item({ id: 'leather_legs', n: 'Calças de Couro', ico: '👖', slot: 'legs', arm: 2, lvl: 0, price: 15 });
item({ id: 'studded_legs', n: 'Calças Cravejadas', ico: '👖', slot: 'legs', arm: 3, lvl: 0, price: 90 });
item({ id: 'brass_legs', n: 'Grevas de Latão', ico: '👖', slot: 'legs', arm: 5, lvl: 5, price: 350 });
item({ id: 'plate_legs', n: 'Grevas de Placas', ico: '👖', slot: 'legs', arm: 7, lvl: 15, price: 1800 });
item({ id: 'knight_legs', n: 'Grevas do Cavaleiro', ico: '👖', slot: 'legs', arm: 8, lvl: 25, price: 7000 });
item({ id: 'crown_legs', n: 'Grevas da Coroa', ico: '👑', slot: 'legs', arm: 9, lvl: 32, price: 18000 });

/* botas */
item({ id: 'leather_boots', n: 'Botas de Couro', ico: '🥾', slot: 'boots', arm: 1, lvl: 0, price: 10 });
item({ id: 'steel_boots', n: 'Botas de Aço', ico: '🥾', slot: 'boots', arm: 3, lvl: 15, price: 5000 });
item({ id: 'boots_of_haste', n: 'Botas da Velocidade', ico: '👟', slot: 'boots', arm: 1, lvl: 20, price: 30000, b: { speed: 40 } });

/* amuletos e anéis */
item({ id: 'bronze_amulet', n: 'Amuleto de Bronze', ico: '📿', slot: 'amulet', arm: 1, lvl: 0, price: 100 });
item({ id: 'protection_amulet', n: 'Amuleto de Proteção', ico: '📿', slot: 'amulet', arm: 3, lvl: 8, price: 900 });
item({ id: 'dragon_necklace', n: 'Colar do Dragão', ico: '🐲', slot: 'amulet', arm: 4, lvl: 20, price: 5000, b: { maxhp: 25 } });
item({ id: 'platinum_amulet', n: 'Amuleto de Platina', ico: '💠', slot: 'amulet', arm: 6, lvl: 35, price: 25000, b: { maxhp: 40, maxmana: 40 } });
item({ id: 'might_ring', n: 'Anel do Poder', ico: '💍', slot: 'ring', arm: 3, lvl: 0, price: 1500 });
item({ id: 'energy_ring', n: 'Anel de Energia', ico: '💍', slot: 'ring', lvl: 0, price: 1800, b: { maxmana: 50, mpReg: 2 } });
item({ id: 'life_ring', n: 'Anel da Vida', ico: '💍', slot: 'ring', lvl: 0, price: 2000, b: { maxhp: 45, hpReg: 2 } });
item({ id: 'sword_ring', n: 'Anel da Espada', ico: '💍', slot: 'ring', lvl: 10, price: 4000, b: { sword: 3 } });
item({ id: 'axe_ring', n: 'Anel do Machado', ico: '💍', slot: 'ring', lvl: 10, price: 4000, b: { axe: 3 } });
item({ id: 'club_ring', n: 'Anel da Clava', ico: '💍', slot: 'ring', lvl: 10, price: 4000, b: { club: 3 } });

/* consumíveis (empilháveis) */
/* degrau de entrada: cura pouco, mas é a poção mais barata por ponto de vida
   (2,3 hp/ouro contra 1,8 da comum). Fica obsoleta sozinha — lá pra frente
   seriam goles demais por briga. */
item({ id: 'weak_health_potion', n: 'Poção Fraca de Vida', ico: '🧪', use: { hp: 35 }, stack: true, price: 15 });
item({ id: 'health_potion', n: 'Poção de Vida', ico: '🧪', use: { hp: 90 }, stack: true, price: 50 });
item({ id: 'strong_health_potion', n: 'Poção de Vida Forte', ico: '🧪', use: { hp: 200 }, stack: true, lvl: 20, price: 130 });
item({ id: 'great_health_potion', n: 'Poção de Vida Suprema', ico: '🧪', use: { hp: 400 }, stack: true, lvl: 40, price: 320 });
item({ id: 'mana_potion', n: 'Poção de Mana', ico: '🔷', use: { mp: 80 }, stack: true, price: 55 });
item({ id: 'strong_mana_potion', n: 'Poção de Mana Forte', ico: '🔷', use: { mp: 170 }, stack: true, lvl: 20, price: 130 });
item({ id: 'great_mana_potion', n: 'Poção de Mana Suprema', ico: '🔷', use: { mp: 300 }, stack: true, lvl: 40, price: 300 });
/* Suprimento de endgame. O preço sobe MAIS rápido que a cura: a suprema cura
   4.4x a poção de vida e custa 6.4x. É de propósito — descer é caro, e o custo
   da ida contra o loot da volta é o que faz uma hunt ser difícil, não o dano do
   bicho (a lição que o Tibia ensina e que faltava aqui). */
item({ id: 'supreme_health_potion', n: 'Poção de Vida Abissal', ico: '🧪', use: { hp: 800 }, stack: true, lvl: 60, price: 900 });
item({ id: 'ultimate_health_potion', n: 'Poção de Vida Primordial', ico: '🧪', use: { hp: 1500 }, stack: true, lvl: 90, price: 2200 });
item({ id: 'supreme_mana_potion', n: 'Poção de Mana Abissal', ico: '🔷', use: { mp: 550 }, stack: true, lvl: 60, price: 800 });
item({ id: 'ultimate_mana_potion', n: 'Poção de Mana Primordial', ico: '🔷', use: { mp: 950 }, stack: true, lvl: 90, price: 1900 });
item({ id: 'gold', n: 'Moedas de Ouro', ico: '🪙', stack: true, price: 1 });

/* ------------------------------------------------------------------ moedas
   A moeda é camada de APRESENTAÇÃO, não economia nova. O valor continua sendo
   uma unidade só, continua indo para `P.gold`, e loja, venda e save não sabem
   que isto existe. O que muda é a PEÇA que o jogador vê no chão e no saque:
   um monte de 4.000 unidades vira "40 moedas de ouro" em vez de "4000 moedas",
   e um de 12 vira "12 de bronze".
   `gold` fica onde está: umas oitenta tabelas de saque falam esse id, e ele
   também é o que save antigo carrega na mochila. Ele é o bronze com outro nome.
   O SPRITE varia com a quantidade (uma moeda, um punhado, uma pilha) e a COR
   varia com o metal — as doze peças saem da mesma folha, tingidas em HSV pelo
   assets/build_coins.py, e não de doze desenhos diferentes. */
const COIN_MONTE = c => c === 1 ? '1' : c <= 50 ? 'few' : 'many';
const COINS = [
  { id: 'crystal_coin',  n: 'Moedas de Cristal', v: 10000 },
  { id: 'platinum_coin', n: 'Moedas de Platina', v: 100 },
  { id: 'gold_coin',     n: 'Moedas de Ouro',    v: 1 }
];
/* O ouro é a UNIDADE: todo preço do jogo já está escrito nele, e `P.gold` conta
   nele. Platina e cristal são só empacotamento de 100 e de 10.000.
   `gold` é o id legado das tabelas de saque e de save antigo — vale o mesmo que
   `gold_coin`, e é o único motivo de os dois existirem. */
const COIN_V = { gold: 1 };
for (const c of COINS) {
  COIN_V[c.id] = c.v;
  item({ id: c.id, n: c.n, ico: '🪙', stack: true, price: c.v });
  ITEMS[c.id].moeda = c.id;   // marca de moeda: o render usa para achar o monte
}
/* Escolhe a maior denominação que cabe e arredonda PARA BAIXO: assim o número
   que aparece é exatamente o que entra em P.gold. Arredondar para cima daria ao
   jogador dinheiro que a tabela de saque não prometeu. */
function moedaDe(valor) {
  valor = Math.max(1, Math.floor(valor));
  const c = COINS.find(c => valor >= c.v) || COINS[COINS.length - 1];
  return { id: c.id, count: Math.max(1, Math.floor(valor / c.v)) };
}

/* comida — cura pouco, mas é de graça e cai o tempo todo */
/* Comida: além da mordida que cura na hora, `food` dá regeneração por um tempo —
   { t: segundos que enche, v: quanto soma em hpReg e mpReg por tique }. Comer de
   novo soma no relógio até o teto (COMIDA_TETO), não substitui. */
item({ id: 'meat', n: 'Carne', ico: '🍗', use: { hp: 45 }, food: { t: 120, v: 3 }, stack: true, sell: 4 });
item({ id: 'ham', n: 'Presunto', ico: '🍖', use: { hp: 90 }, food: { t: 240, v: 5 }, stack: true, sell: 12 });
item({ id: 'dragon_ham', n: 'Presunto de Dragão', ico: '🥩', use: { hp: 250 }, food: { t: 480, v: 8 }, stack: true, sell: 120 });

/* fonte de luz — `luz` é o raio em TILES do halo. Vai no slot `light`, embaixo do
   escudo: só acende equipada, carregar na mochila não vale. É o que decide se o
   escuro da noite e da caverna é problema seu ou não. */
item({ id: 'torch', n: 'Tocha', ico: '🔦', slot: 'light', luz: 6, price: 12, sell: 3 });

/* munição — hoje serve como item de venda (arma de distância não gasta flecha) */
item({ id: 'arrow', n: 'Flecha', ico: '➤', stack: true, sell: 2 });
item({ id: 'bolt', n: 'Virote', ico: '➟', stack: true, sell: 3 });
item({ id: 'spear', n: 'Lança', ico: '🔱', stack: true, sell: 9 });

/* partes de monstro — troféu empilhável, valor de venda cresce com o bicho */
item({ id: 'rat_tail', n: 'Rabo de Rato', ico: '🐁', stack: true, sell: 3 });
item({ id: 'snake_hide', n: 'Pele de Cobra', ico: '🐍', stack: true, sell: 22 });
item({ id: 'bug_shell', n: 'Carapaça de Besouro', ico: '🪲', stack: true, sell: 16 });
item({ id: 'wolf_paw', n: 'Pata de Lobo', ico: '🐾', stack: true, sell: 65 });
item({ id: 'spider_silk', n: 'Seda de Aranha', ico: '🕸️', stack: true, sell: 95 });
item({ id: 'bone', n: 'Osso', ico: '🦴', stack: true, sell: 7 });
/* despojo de caça: o que a fauna passiva larga. Vale pouco de propósito — caçar
   bicho manso é sustento e troco, não fonte de renda; quem paga bem é hunt. */
item({ id: 'pelt', n: 'Pele de Caça', ico: '🟤', stack: true, sell: 14 });
item({ id: 'antler', n: 'Galhada', ico: '🦌', stack: true, sell: 45 });
item({ id: 'boar_tusk', n: 'Presa de Javali', ico: '🐗', stack: true, sell: 34 });
item({ id: 'glow_gland', n: 'Glândula Luminosa', ico: '🟡', stack: true, sell: 20 });
item({ id: 'skull', n: 'Crânio', ico: '💀', stack: true, sell: 34 });
item({ id: 'orc_tooth', n: 'Dente de Orc', ico: '🦷', stack: true, sell: 58 });
item({ id: 'rotten_flesh', n: 'Carne Podre', ico: '🥩', stack: true, sell: 11 });
item({ id: 'worm_slime', n: 'Gosma de Verme', ico: '💧', stack: true, sell: 24 });
item({ id: 'copper_ore', n: 'Minério de Cobre', ico: '🟫', stack: true, sell: 5 });
item({ id: 'iron_ore', n: 'Minério de Ferro', ico: '🪨', stack: true, sell: 145 });
item({ id: 'minotaur_leather', n: 'Couro de Minotauro', ico: '🟫', stack: true, sell: 130 });
item({ id: 'minotaur_horn', n: 'Chifre de Minotauro', ico: '📯', stack: true, sell: 240 });
item({ id: 'cyclops_toe', n: 'Dedão de Ciclope', ico: '🦶', stack: true, sell: 210 });
item({ id: 'dragon_scale', n: 'Escama de Dragão', ico: '🟩', stack: true, sell: 600 });
item({ id: 'red_dragon_scale', n: 'Escama Rubra', ico: '🟥', stack: true, sell: 1250 });
item({ id: 'dragon_head', n: 'Cabeça de Dragão', ico: '🐲', stack: true, sell: 2600 });
item({ id: 'demon_dust', n: 'Pó Demoníaco', ico: '🟣', stack: true, sell: 950 });
item({ id: 'demon_horn', n: 'Chifre Demoníaco', ico: '😈', stack: true, sell: 1600 });
item({ id: 'demon_skull', n: 'Crânio Demoníaco', ico: '💀', stack: true, sell: 900 });
item({ id: 'cyclops_eye', n: 'Olho de Ciclope', ico: '👁️', stack: true, sell: 260 });
item({ id: 'demon_wing', n: 'Asa Demoníaca', ico: '🦇', stack: true, sell: 1900 });
item({ id: 'tentacle', n: 'Tentáculo', ico: '🐙', stack: true, sell: 340 });
/* despojos dos andares fundos — a moeda de troca do endgame */
item({ id: 'frozen_core', n: 'Núcleo Congelado', ico: '🧊', stack: true, sell: 2200 });
item({ id: 'ember_core', n: 'Núcleo de Brasa', ico: '🔥', stack: true, sell: 2200 });
item({ id: 'storm_core', n: 'Núcleo de Tempestade', ico: '⚡', stack: true, sell: 2600 });
item({ id: 'soul_shard', n: 'Fragmento de Alma', ico: '👻', stack: true, sell: 3200 });
item({ id: 'void_shard', n: 'Estilhaço do Vazio', ico: '🟪', stack: true, sell: 5200 });
item({ id: 'seraph_feather', n: 'Pena de Serafim', ico: '🪶', stack: true, sell: 6400 });
item({ id: 'primordial_heart', n: 'Coração Primordial', ico: '❤️‍🔥', stack: true, sell: 14000 });
/* colheita — o que sai da pedra, da árvore e da água.

   Os preços destes caíram de 3× a 5× (carvão 20→6, cobre 60→14, prata 380→70,
   mithril 1500→300, resina 30→18, lei 48→40). Medido antes: minerar rendia
   ~100 de ouro por colheita já na skill inicial e ~23.000/min na skill 45,
   contra os ~14.300 que um bicho de tier 9 larga por morte — parado, sem risco,
   desde o nível 1. Coleta é ofício seguro: tem de pagar menos que caçar.

   Só entra aqui quem é EXCLUSIVO de coleta. Ferro, gemas, pérolas e barra de
   ouro também caem de monstro, e o preço deles está amarrado à régua do #28
   (dificuldade × natureza) — mexer neles moveria o loot do jogo inteiro. Esses
   ficam com o preço que têm e viram linha rara na tabela de colheita. */
item({ id: 'wood', n: 'Madeira', ico: '🪵', stack: true, sell: 6 });
item({ id: 'hard_wood', n: 'Madeira de Lei', ico: '🪵', stack: true, sell: 40 });
item({ id: 'resin', n: 'Resina', ico: '🟠', stack: true, sell: 18 });
item({ id: 'coal', n: 'Carvão', ico: '⬛', stack: true, sell: 6 });
item({ id: 'silver_ore', n: 'Minério de Prata', ico: '⬜', stack: true, sell: 40 });
item({ id: 'mithril_ore', n: 'Minério de Mithril', ico: '🟦', stack: true, sell: 180 });
/* A escada de qualidade que faltava. Arte própria em todos: `herb`, `mushroom`,
   `shell` e `worm` já tinham PNG em assets/icons e não eram item nenhum — então
   diversificar não custou arte nova nem um emoji a mais (§17). */
item({ id: 'green_wood', n: 'Madeira Verde', ico: '🪵', stack: true, sell: 2 });
item({ id: 'herb', n: 'Erva do Mato', ico: '🌿', use: { mp: 30 }, stack: true, sell: 9 });
item({ id: 'mushroom', n: 'Cogumelo Pálido', ico: '🍄', use: { hp: 30 }, food: { t: 120, v: 2 }, stack: true, sell: 12 });
item({ id: 'shell', n: 'Concha', ico: '🐚', stack: true, sell: 4 });
item({ id: 'worm', n: 'Minhoca', ico: '🪱', stack: true, sell: 1 });
/* mantimentos — a comida barata que a loja do templo passa a vender. Cura pouco
   e enche pouco: é o que segura o nível baixo até a primeira poção, e o que dá
   uso ao ouro miúdo. A arte veio das folhas de loot. */
item({ id: 'apple', n: 'Maçã', ico: '🍎', use: { hp: 20 }, food: { t: 70, v: 2 }, stack: true, price: 6, sell: 1 });
item({ id: 'bread', n: 'Pão', ico: '🍞', use: { hp: 25 }, food: { t: 90, v: 2 }, stack: true, price: 8, sell: 2 });
item({ id: 'egg', n: 'Ovo', ico: '🥚', use: { hp: 22 }, food: { t: 80, v: 2 }, stack: true, price: 7, sell: 2 });
item({ id: 'grapes', n: 'Cacho de Uvas', ico: '🍇', use: { hp: 30 }, food: { t: 110, v: 2 }, stack: true, price: 12, sell: 3 });
item({ id: 'cheese', n: 'Queijo', ico: '🧀', use: { hp: 35 }, food: { t: 150, v: 3 }, stack: true, price: 18, sell: 5 });
item({ id: 'honeycomb', n: 'Favo de Mel', ico: '🍯', use: { hp: 60 }, food: { t: 200, v: 4 }, stack: true, sell: 24 });
/* A pesca paga em sustento, não em ouro: o preço de venda caiu e a comida subiu.
   Peixe graúdo passa a ser a melhor regeneração que se consegue sem matar nada
   (t 360/v 7 contra 240/5 do presunto comprado e 480/8 do presunto de dragão),
   e é o que faz caçar longe do templo durar. */
item({ id: 'fish', n: 'Peixe', ico: '🐟', use: { hp: 40 }, food: { t: 130, v: 3 }, stack: true, sell: 5 });
item({ id: 'big_fish', n: 'Peixe Graúdo', ico: '🐠', use: { hp: 160 }, food: { t: 360, v: 7 }, stack: true, sell: 30 });
item({ id: 'shrimp', n: 'Crustáceo', ico: '🦐', use: { hp: 80 }, food: { t: 210, v: 5 }, stack: true, sell: 12 });

/* tesouros — não servem pra nada além de virar ouro na loja */
item({ id: 'white_pearl', n: 'Pérola Branca', ico: '⚪', stack: true, sell: 170 });
item({ id: 'black_pearl', n: 'Pérola Negra', ico: '⚫', stack: true, sell: 290 });
item({ id: 'small_ruby', n: 'Rubi Pequeno', ico: '🔴', stack: true, sell: 520 });
item({ id: 'small_sapphire', n: 'Safira Pequena', ico: '🔵', stack: true, sell: 520 });
item({ id: 'small_diamond', n: 'Diamante Pequeno', ico: '💎', stack: true, sell: 950 });
item({ id: 'talon', n: 'Garra', ico: '🪝', stack: true, sell: 1300 });
item({ id: 'gold_ingot', n: 'Barra de Ouro', ico: '🟨', stack: true, sell: 1800 });


/* ---- lote 2 de itens (inspirados no TibiaWiki) --------------------------- */
item({ id: 'rapier', n: 'Rapieira', ico: '🗡️', slot: 'weapon', wt: 'sword', atk: 10, def: 7, lvl: 0, price: 60 });
item({ id: 'spike_sword', n: 'Espada Espinho', ico: '⚔️', slot: 'weapon', wt: 'sword', atk: 24, def: 18, lvl: 15, price: 3000 });
item({ id: 'bright_sword', n: 'Espada Radiante', ico: '⚔️', slot: 'weapon', wt: 'sword', atk: 30, def: 24, lvl: 26, price: 9500 });
item({ id: 'giant_sword', n: 'Espada Gigante', ico: '⚔️', slot: 'weapon', wt: 'sword', atk: 42, def: 26, lvl: 40, price: 34000 });
item({ id: 'barbarian_axe', n: 'Machado Bárbaro', ico: '🪓', slot: 'weapon', wt: 'axe', atk: 26, def: 15, lvl: 18, price: 4200 });
item({ id: 'halberd', n: 'Alabarda', ico: '🪓', slot: 'weapon', wt: 'axe', atk: 35, def: 20, lvl: 30, price: 15000 });
item({ id: 'guardian_halberd', n: 'Alabarda do Guardião', ico: '🪓', slot: 'weapon', wt: 'axe', atk: 45, def: 28, lvl: 45, price: 52000, b: { shielding: 2 } });
item({ id: 'morning_star', n: 'Estrela da Manhã', ico: '🔨', slot: 'weapon', wt: 'club', atk: 25, def: 14, lvl: 15, price: 3200 });
item({ id: 'skull_staff', n: 'Cajado de Crânio', ico: '💀', slot: 'weapon', wt: 'club', atk: 35, def: 20, lvl: 30, price: 18000, b: { magic: 2 } });
item({ id: 'royal_crossbow', n: 'Besta Real', ico: '🎯', slot: 'weapon', wt: 'distance', atk: 45, def: 6, lvl: 50, price: 78000, b: { distance: 3 } });

/* ---- armas que faltavam entre o nível 36 e o 76 --------------------------
   O buraco era real e media 26 níveis: quem atira ia da Besta Real (nv 50)
   direto ao Arco do Vazio (nv 76) sem NADA no meio, e a varinha pulava do
   nv 36 ao 56. Vocação que passa vinte níveis sem trocar de arma para de
   sentir que evoluiu, por mais que a ficha diga que sim.
   A escada de distância fecha assim: 34 → 38 → 44 → 45 → 47 → 51 → 55 → 58. */
item({ id: 'spectral_bow', n: 'Arco Espectral', ico: '🎯', slot: 'weapon', wt: 'distance', atk: 51, def: 8, lvl: 62, price: 130000, b: { distance: 2, crit: 0.05 } });
item({ id: 'abyssal_ballista', n: 'Balista Abissal', ico: '🎯', slot: 'weapon', wt: 'distance', atk: 55, def: 9, lvl: 70, price: 180000, b: { distance: 3, crit: 0.06 } });

/* Varinhas e cajados em par, como todo o resto da linha: o sorcerer fica em
   fogo/energia/morte, o druida em gelo/terra. Média de dano: 51 (nv36) → 63
   (nv46) → 77 (nv56, Sentinela) → 90 (nv66) → 104 (nv76, Vazio). */
item({ id: 'void_wand', n: 'Vareta do Vazio', ico: '🪄', slot: 'weapon', wt: 'wand', dmg: [48, 78], el: 'energy', lvl: 46, voc: ['sorcerer'], price: 45000 });
item({ id: 'glacier_rod', n: 'Cajado do Gelo', ico: '❄️', slot: 'weapon', wt: 'wand', dmg: [48, 78], el: 'ice', lvl: 46, voc: ['druid'], price: 45000 });
/* ---- alternativas de elemento ----
   Cada faixa de nível tinha UMA varinha por vocação, com o elemento decidido pela
   tabela — quem caçava bicho imune ao fogo no nível 36 não tinha o que fazer.
   Estas são irmãs das que já existiam: mesmo nível, mesmo dano, mesmo preço, o
   que muda é o elemento (e o desenho, que veio das folhas de varinha). A escolha
   passa a ser do jogador, contra o que ele vai enfrentar. */
item({ id: 'brasa_wand', n: 'Varinha da Brasa', ico: '🪄', slot: 'weapon', wt: 'wand', dmg: [25, 44], el: 'fire', lvl: 22, voc: ['sorcerer'], price: 6000 });
item({ id: 'umbral_wand', n: 'Varinha Umbral', ico: '🪄', slot: 'weapon', wt: 'wand', dmg: [32, 52], el: 'death', lvl: 26, voc: ['sorcerer'], price: 12000 });
item({ id: 'ossuary_staff', n: 'Cajado do Ossário', ico: '🪄', slot: 'weapon', wt: 'wand', dmg: [40, 62], el: 'death', lvl: 36, voc: ['sorcerer'], price: 22000 });
item({ id: 'flame_trident', n: 'Tridente Flamejante', ico: '🪄', slot: 'weapon', wt: 'wand', dmg: [48, 78], el: 'fire', lvl: 46, voc: ['sorcerer'], price: 45000 });
item({ id: 'arcane_eye_wand', n: 'Vareta do Olho Arcano', ico: '🪄', slot: 'weapon', wt: 'wand', dmg: [62, 102], el: 'energy', lvl: 60, voc: ['sorcerer'], price: 115000 });
item({ id: 'light_staff', n: 'Cajado da Luz', ico: '🪄', slot: 'weapon', wt: 'wand', dmg: [72, 118], el: 'holy', lvl: 70, voc: ['sorcerer'], price: 185000 });
item({ id: 'fullmoon_rod', n: 'Cajado da Lua Cheia', ico: '🌿', slot: 'weapon', wt: 'wand', dmg: [25, 44], el: 'ice', lvl: 22, voc: ['druid'], price: 6000 });
item({ id: 'crescent_rod', n: 'Báculo Crescente', ico: '🌿', slot: 'weapon', wt: 'wand', dmg: [32, 52], el: 'ice', lvl: 26, voc: ['druid'], price: 12000 });
item({ id: 'grove_rod', n: 'Cajado do Bosque', ico: '🌿', slot: 'weapon', wt: 'wand', dmg: [40, 62], el: 'earth', lvl: 36, voc: ['druid'], price: 22000 });
item({ id: 'verdant_rod', n: 'Báculo Verdejante', ico: '🌿', slot: 'weapon', wt: 'wand', dmg: [48, 78], el: 'earth', lvl: 46, voc: ['druid'], price: 45000 });
item({ id: 'frostgem_rod', n: 'Cajado de Cristal', ico: '🌿', slot: 'weapon', wt: 'wand', dmg: [62, 102], el: 'ice', lvl: 60, voc: ['druid'], price: 115000 });
item({ id: 'antler_rod', n: 'Báculo da Galhada', ico: '🌿', slot: 'weapon', wt: 'wand', dmg: [72, 118], el: 'ice', lvl: 70, voc: ['druid'], price: 185000 });
/* O único que as duas vocações usam: não bate mais forte que o cajado de nível
   66, paga passo. É o prêmio de quem enfrenta o Oco. */
item({ id: 'time_staff', n: 'Báculo do Tempo', ico: '🪄', slot: 'weapon', wt: 'wand', dmg: [68, 112], el: 'energy', lvl: 66, voc: ['sorcerer', 'druid'], price: 160000, b: { speed: 20 } });
/* Os seis degraus que faltavam entre o 46 e o 76: o conjurador ia do Vazio/Gelo
   direto para os cajados de nível 66 e depois para a Regalia, com vinte níveis
   sem troca de arma no meio. A arte estava sobrando na folha de varinhas, com
   elemento escrito na legenda — é dela que sai o elemento de cada um.
   Dano interpolado da régua que já existia: 48-78 no nv 46, 68-112 no nv 66. */
item({ id: 'storm_staff', n: 'Cajado da Tempestade', ico: '🪄', slot: 'weapon', wt: 'wand', dmg: [58, 95], el: 'energy', lvl: 52, voc: ['sorcerer'], price: 88000 });
item({ id: 'wind_rod', n: 'Báculo dos Ventos', ico: '🌿', slot: 'weapon', wt: 'wand', dmg: [58, 95], el: 'ice', lvl: 52, voc: ['druid'], price: 88000 });
item({ id: 'soul_wand', n: 'Vareta da Alma', ico: '🪄', slot: 'weapon', wt: 'wand', dmg: [62, 102], el: 'death', lvl: 60, voc: ['sorcerer'], price: 115000 });
item({ id: 'plague_rod', n: 'Vareta da Praga', ico: '🌿', slot: 'weapon', wt: 'wand', dmg: [62, 102], el: 'earth', lvl: 60, voc: ['druid'], price: 115000 });
/* Os dois do nível 70 pagam um extra em vez de só dano: é o degrau que segura o
   mago até a Regalia (nv 76), e sem isso ninguém trocaria de arma tão perto. */
item({ id: 'blood_staff', n: 'Cajado do Sangue', ico: '🪄', slot: 'weapon', wt: 'wand', dmg: [72, 118], el: 'death', lvl: 70, voc: ['sorcerer'], price: 185000, b: { lifesteal: .06 } });
item({ id: 'celestial_rod', n: 'Báculo Celestial', ico: '🌿', slot: 'weapon', wt: 'wand', dmg: [72, 118], el: 'holy', lvl: 70, voc: ['druid'], price: 185000, b: { mpReg: 4 } });
item({ id: 'spirit_staff', n: 'Cajado dos Espíritos', ico: '🪄', slot: 'weapon', wt: 'wand', dmg: [68, 112], el: 'death', lvl: 66, voc: ['sorcerer'], price: 140000 });
item({ id: 'nature_staff', n: 'Cajado da Natureza', ico: '🌿', slot: 'weapon', wt: 'wand', dmg: [68, 112], el: 'earth', lvl: 66, voc: ['druid'], price: 140000 });
item({ id: 'wand_of_cosmic_energy', n: 'Varinha da Energia Cósmica', ico: '🪄', slot: 'weapon', wt: 'wand', dmg: [32, 52], el: 'energy', lvl: 26, voc: ['sorcerer'], price: 12000 });
item({ id: 'springsprout_rod', n: 'Cajado do Broto', ico: '🌿', slot: 'weapon', wt: 'wand', dmg: [32, 52], el: 'earth', lvl: 26, voc: ['druid'], price: 12000 });

item({ id: 'viking_shield', n: 'Escudo Viking', ico: '🛡️', slot: 'shield', def: 18, lvl: 5, price: 800 });
item({ id: 'plate_shield', n: 'Escudo de Placas', ico: '🛡️', slot: 'shield', def: 22, lvl: 12, price: 2200 });
item({ id: 'black_shield', n: 'Escudo Negro', ico: '🛡️', slot: 'shield', def: 32, lvl: 30, price: 16000 });
item({ id: 'vampire_shield', n: 'Escudo Vampírico', ico: '🩸', slot: 'shield', def: 35, lvl: 35, price: 40000, b: { lifesteal: 0.05 } });

item({ id: 'viking_helmet', n: 'Elmo Viking', ico: '⛑️', slot: 'helmet', arm: 4, lvl: 0, price: 260 });
item({ id: 'warrior_helmet', n: 'Elmo de Guerreiro', ico: '⛑️', slot: 'helmet', arm: 9, lvl: 35, price: 32000 });
item({ id: 'horned_helmet', n: 'Elmo Chifrudo', ico: '👹', slot: 'helmet', arm: 10, lvl: 45, price: 90000, b: { sword: 1, axe: 1, club: 1 } });

item({ id: 'scale_armor', n: 'Armadura de Escamas', ico: '🥋', slot: 'armor', arm: 9, lvl: 5, price: 1000 });
item({ id: 'noble_armor', n: 'Armadura Nobre', ico: '🥋', slot: 'armor', arm: 12, lvl: 20, price: 6500 });
item({ id: 'blue_robe', n: 'Manto Azul', ico: '🧿', slot: 'armor', arm: 13, lvl: 25, price: 30000, b: { maxmana: 60, magic: 1 } });
item({ id: 'golden_armor', n: 'Armadura Dourada', ico: '👑', slot: 'armor', arm: 15, lvl: 32, price: 45000 });
item({ id: 'golden_legs', n: 'Grevas Douradas', ico: '👑', slot: 'legs', arm: 10, lvl: 40, price: 60000 });
item({ id: 'soft_boots', n: 'Botas Macias', ico: '🥿', slot: 'boots', arm: 2, lvl: 30, price: 48000, b: { hpReg: 3, mpReg: 3 } });

item({ id: 'silver_amulet', n: 'Amuleto de Prata', ico: '📿', slot: 'amulet', arm: 2, lvl: 0, price: 350 });
item({ id: 'elven_amulet', n: 'Amuleto Élfico', ico: '📿', slot: 'amulet', arm: 2, lvl: 8, price: 1200, b: { maxmana: 35 } });
item({ id: 'ruby_necklace', n: 'Colar de Rubi', ico: '❤️', slot: 'amulet', arm: 3, lvl: 15, price: 3500, b: { maxhp: 35 } });
item({ id: 'dwarven_ring', n: 'Anel Anão', ico: '💍', slot: 'ring', lvl: 0, price: 2200, b: { mpReg: 3 } });
item({ id: 'ring_of_healing', n: 'Anel da Cura', ico: '💍', slot: 'ring', lvl: 10, price: 5000, b: { hpReg: 4, mpReg: 2 } });
item({ id: 'time_ring', n: 'Anel do Tempo', ico: '💍', slot: 'ring', lvl: 15, price: 8000, b: { speed: 30 } });

item({ id: 'brown_mushroom', n: 'Cogumelo Marrom', ico: '🍄', use: { mp: 60 }, stack: true, sell: 18 });
item({ id: 'green_gem', n: 'Gema Verde', ico: '💚', stack: true, sell: 2400 });
item({ id: 'blue_gem', n: 'Gema Azul', ico: '💙', stack: true, sell: 1900 });
item({ id: 'shimmering_pearl', n: 'Pérola Reluzente', ico: '🫧', stack: true, sell: 1400 });

/* ---- set do Guardião Dourado -------------------------------------------
   Só cai de anão, e é o prêmio de longo prazo da Mina dos Anões: cada peça
   sozinha vale o nível 30-38 da hunt (par de Coroa/Real, abaixo de dragão e
   demônio), e o que empurra o jogador a completar são os degraus de SETS.
   `set` marca a peça; o recalc conta quantas estão vestidas. Cada uma tem PNG
   próprio, então o id vira nome de arquivo — SPRITE_ID casa antes do genérico
   por tipo de arma e por slot, senão a espada do set usava o ícone comum. */
const GG = o => (SPRITE_ID[o.id] = o.id, item(Object.assign({ set: 'gg' }, o)));
GG({ id: 'gg_helmet', n: 'Elmo do Guardião Dourado', slot: 'helmet', arm: 8, lvl: 32, price: 21000, b: { shielding: 1 } });
GG({ id: 'gg_armor', n: 'Armadura do Guardião Dourado', slot: 'armor', arm: 14, lvl: 34, price: 26000, b: { maxhp: 25 } });
GG({ id: 'gg_legs', n: 'Grevas do Guardião Dourado', slot: 'legs', arm: 9, lvl: 32, price: 19000 });
GG({ id: 'gg_boots', n: 'Botas do Guardião Dourado', slot: 'boots', arm: 3, lvl: 30, price: 14000, b: { speed: 15 } });
GG({ id: 'gg_shield', n: 'Escudo do Guardião Dourado', slot: 'shield', def: 33, lvl: 33, price: 20000, b: { shielding: 2 } });
GG({ id: 'gg_amulet', n: 'Amuleto do Guardião Dourado', slot: 'amulet', arm: 5, lvl: 30, price: 12000, b: { maxhp: 30 } });
GG({ id: 'gg_ring', n: 'Anel do Guardião Dourado', slot: 'ring', arm: 3, lvl: 30, price: 11000, b: { hpReg: 2 } });
/* as sete armas cobrem espada/machado/clava em uma mão e em duas: a peça de arma
   do conjunto tem de existir para as três vocações de porrada, senão o oitavo
   degrau só valeria para quem usa espada */
GG({ id: 'gg_mace', n: 'Maça do Guardião Dourado', slot: 'weapon', wt: 'club', atk: 30, def: 22, lvl: 32, price: 12000 });
GG({ id: 'gg_sword', n: 'Espada do Guardião Dourado', slot: 'weapon', wt: 'sword', atk: 31, def: 24, lvl: 32, price: 13000 });
GG({ id: 'gg_axe', n: 'Machado do Guardião Dourado', slot: 'weapon', wt: 'axe', atk: 32, def: 20, lvl: 32, price: 13500 });
GG({ id: 'gg_halberd', n: 'Alabarda do Guardião Dourado', slot: 'weapon', wt: 'axe', atk: 37, def: 22, lvl: 34, price: 18000 });
GG({ id: 'gg_maul', n: 'Martelo do Guardião Dourado', slot: 'weapon', wt: 'club', atk: 38, def: 24, lvl: 36, price: 20000 });
GG({ id: 'gg_greatsword', n: 'Espada Longa do Guardião Dourado', slot: 'weapon', wt: 'sword', atk: 39, def: 26, lvl: 36, price: 21000 });
GG({ id: 'gg_greataxe', n: 'Machado Duplo do Guardião Dourado', slot: 'weapon', wt: 'axe', atk: 40, def: 24, lvl: 36, price: 22000 });

/* Os conjuntos do meio do caminho. O ícone sai do id (ICONES, em icones.js),
   então aqui não se declara arte nenhuma — basta o arquivo se chamar igual.
   A escada de nível é o que separa os quatro: couro no 0, estes entre 12 e 22,
   Guardião Dourado no 30. Cada um puxa para uma vocação sem trancar as outras —
   só a varinha do arcano é exclusiva, porque varinha já é por vocação no jogo. */
const conjunto = sigla => o => item(Object.assign({ set: sigla }, o));

/* Caçador Ancestral — primeiro conjunto de quem atira, leve e barato */
const AH = conjunto('ah');
AH({ id: 'ah_hood', n: 'Capuz do Caçador Ancestral', slot: 'helmet', arm: 4, lvl: 12, price: 1400, b: { distance: 1 } });
AH({ id: 'ah_armor', n: 'Gibão do Caçador Ancestral', slot: 'armor', arm: 7, lvl: 12, price: 2400 });
AH({ id: 'ah_legs', n: 'Calças do Caçador Ancestral', slot: 'legs', arm: 4, lvl: 12, price: 1500 });
AH({ id: 'ah_boots', n: 'Botas do Caçador Ancestral', slot: 'boots', arm: 2, lvl: 12, price: 1200, b: { speed: 8 } });
AH({ id: 'ah_shield', n: 'Escudo do Caçador Ancestral', slot: 'shield', def: 14, lvl: 12, price: 1600 });
AH({ id: 'ah_amulet', n: 'Amuleto do Caçador Ancestral', slot: 'amulet', arm: 2, lvl: 12, price: 1300, b: { maxhp: 15 } });
AH({ id: 'ah_ring', n: 'Anel do Caçador Ancestral', slot: 'ring', arm: 1, lvl: 12, price: 1200, b: { distance: 1 } });
AH({ id: 'ah_bow', n: 'Arco do Caçador Ancestral', slot: 'weapon', wt: 'distance', atk: 19, def: 4, lvl: 13, price: 2600 });

/* Iniciado Arcano — o primeiro conjunto de mago; o tomo ocupa a mão do escudo */
const AI = conjunto('ai');
AI({ id: 'ai_hood', n: 'Capuz do Iniciado Arcano', slot: 'helmet', arm: 3, lvl: 12, price: 1500, b: { maxmana: 20 } });
AI({ id: 'ai_armor', n: 'Túnica do Iniciado Arcano', slot: 'armor', arm: 6, lvl: 12, price: 2500, b: { maxmana: 30 } });
AI({ id: 'ai_legs', n: 'Vestes do Iniciado Arcano', slot: 'legs', arm: 3, lvl: 12, price: 1600, b: { maxmana: 20 } });
AI({ id: 'ai_boots', n: 'Botas do Iniciado Arcano', slot: 'boots', arm: 2, lvl: 12, price: 1300, b: { mpReg: 1 } });
AI({ id: 'ai_tome', n: 'Grimório do Iniciado Arcano', slot: 'shield', def: 10, lvl: 12, price: 1900, b: { magic: 1 } });
AI({ id: 'ai_amulet', n: 'Amuleto do Iniciado Arcano', slot: 'amulet', arm: 2, lvl: 12, price: 1400, b: { maxmana: 25 } });
AI({ id: 'ai_ring', n: 'Anel do Iniciado Arcano', slot: 'ring', lvl: 12, price: 1300, b: { mpReg: 2 } });
AI({ id: 'ai_staff', n: 'Cajado do Iniciado Arcano', slot: 'weapon', wt: 'wand', dmg: [14, 26], el: 'energy', lvl: 13, voc: ['sorcerer', 'druid'], price: 2800 });

/* Espreitador da Floresta — o degrau seguinte de quem atira */
const FS = conjunto('fs');
FS({ id: 'fs_hood', n: 'Capuz do Espreitador', slot: 'helmet', arm: 6, lvl: 20, price: 4200, b: { distance: 2 } });
FS({ id: 'fs_armor', n: 'Gibão do Espreitador', slot: 'armor', arm: 10, lvl: 20, price: 6500 });
FS({ id: 'fs_legs', n: 'Calças do Espreitador', slot: 'legs', arm: 6, lvl: 20, price: 4400 });
FS({ id: 'fs_boots', n: 'Botas do Espreitador', slot: 'boots', arm: 3, lvl: 20, price: 3800, b: { speed: 14 } });
FS({ id: 'fs_shield', n: 'Escudo do Espreitador', slot: 'shield', def: 21, lvl: 20, price: 4800 });
FS({ id: 'fs_amulet', n: 'Amuleto do Espreitador', slot: 'amulet', arm: 3, lvl: 20, price: 3600, b: { maxhp: 25 } });
FS({ id: 'fs_ring', n: 'Anel do Espreitador', slot: 'ring', arm: 2, lvl: 20, price: 3400, b: { speed: 10 } });
FS({ id: 'fs_bow', n: 'Arco do Espreitador', slot: 'weapon', wt: 'distance', atk: 27, def: 6, lvl: 21, price: 7000 });

/* Escudeiro Nobre — o conjunto de aguentar pancada antes do Guardião Dourado */
const NS = conjunto('ns');
NS({ id: 'ns_helmet', n: 'Elmo do Escudeiro Nobre', slot: 'helmet', arm: 7, lvl: 20, price: 4600, b: { shielding: 1 } });
NS({ id: 'ns_armor', n: 'Armadura do Escudeiro Nobre', slot: 'armor', arm: 12, lvl: 20, price: 7200, b: { maxhp: 20 } });
NS({ id: 'ns_legs', n: 'Grevas do Escudeiro Nobre', slot: 'legs', arm: 7, lvl: 20, price: 4800 });
NS({ id: 'ns_boots', n: 'Botas do Escudeiro Nobre', slot: 'boots', arm: 3, lvl: 20, price: 3900 });
NS({ id: 'ns_shield', n: 'Escudo do Escudeiro Nobre', slot: 'shield', def: 25, lvl: 20, price: 5600, b: { shielding: 2 } });
NS({ id: 'ns_amulet', n: 'Amuleto do Escudeiro Nobre', slot: 'amulet', arm: 4, lvl: 20, price: 3800, b: { maxhp: 25 } });
NS({ id: 'ns_ring', n: 'Anel do Escudeiro Nobre', slot: 'ring', arm: 2, lvl: 20, price: 3600, b: { hpReg: 1 } });
NS({ id: 'ns_sword', n: 'Espada do Escudeiro Nobre', slot: 'weapon', wt: 'sword', atk: 24, def: 18, lvl: 21, price: 6800 });

/* ---- conjuntos de endgame: o que se veste depois do Guardião Dourado -------
   Um por andar novo. A régua de nível (55 e 75) é o que garante que o jogador
   de 60 não vista o topo do jogo na primeira descida — ele desce, morre, sobe
   nível com o que caiu do primeiro andar e só então encara o segundo.
   Cinco armas cada (as três de porrada, arco e varinha) porque abaixo da caverna
   nenhuma vocação pode ficar sem degrau — sem varinha o mago para no nível 36. */


/* ------------------------------------------------------------------------
   Os cinco conjuntos das folhas de _define_set_name. Cada folha trazia seis
   variantes da mesma peça; entrou uma de cada, a que fecha o visual.
   Eles preenchem buracos da escada, não a repetem: mago só tinha conjunto no
   nível 12 e no 76, e druida não tinha nenhum. A régua de números é a dos
   outros — armadura do Guardião Dourado 14 no nv 34, da Sentinela 20 no nv 56;
   quem entra no meio fica entre os dois. */

/* Bosque Ancião — o conjunto de druida que faltava, folha e galhada */
const BO = conjunto('bo');
BO({ id: 'bo_hood', n: 'Capuz do Bosque Ancião', slot: 'helmet', arm: 6, lvl: 24, price: 6200, b: { magic: 1, maxmana: 30 } });
BO({ id: 'bo_armor', n: 'Manto do Bosque Ancião', slot: 'armor', arm: 12, lvl: 24, price: 9800, b: { maxmana: 45, hpReg: 2 } });
BO({ id: 'bo_legs', n: 'Vestes do Bosque Ancião', slot: 'legs', arm: 7, lvl: 24, price: 6600, b: { maxmana: 30 } });
BO({ id: 'bo_boots', n: 'Botas do Bosque Ancião', slot: 'boots', arm: 3, lvl: 24, price: 5400, b: { speed: 12, mpReg: 1 } });
BO({ id: 'bo_shield', n: 'Escudo do Bosque Ancião', slot: 'shield', def: 24, lvl: 24, price: 7400, b: { resEarth: .06 } });
BO({ id: 'bo_staff', n: 'Cajado do Bosque Ancião', slot: 'weapon', wt: 'wand', dmg: [26, 46], el: 'earth', lvl: 25, voc: ['druid', 'sorcerer'], price: 11000 });

/* Guarda do Leão — aço claro e brasão; o degrau de cavaleiro entre o Escudeiro
   Nobre (nv 20) e o Guardião Dourado (nv 34) */
const GL = conjunto('gl');
GL({ id: 'gl_helmet', n: 'Elmo da Guarda do Leão', slot: 'helmet', arm: 8, lvl: 26, price: 8600, b: { shielding: 1 } });
GL({ id: 'gl_armor', n: 'Peitoral da Guarda do Leão', slot: 'armor', arm: 13, lvl: 26, price: 13000, b: { maxhp: 30 } });
GL({ id: 'gl_legs', n: 'Grevas da Guarda do Leão', slot: 'legs', arm: 8, lvl: 26, price: 8800, b: { maxhp: 15 } });
GL({ id: 'gl_boots', n: 'Botas da Guarda do Leão', slot: 'boots', arm: 4, lvl: 26, price: 7000 });
GL({ id: 'gl_shield', n: 'Escudo da Guarda do Leão', slot: 'shield', def: 28, lvl: 26, price: 10500, b: { shielding: 2 } });
GL({ id: 'gl_sword', n: 'Espada da Guarda do Leão', slot: 'weapon', wt: 'sword', atk: 27, def: 20, lvl: 27, price: 12000 });
GL({ id: 'gl_mace', n: 'Maça da Guarda do Leão', slot: 'weapon', wt: 'club', atk: 28, def: 18, lvl: 27, price: 12000 });

/* Chama Abissal — feitiçaria de fogo, entre o Iniciado Arcano e a Regalia. Tomo
   e escudo dividem a mão: quem quer dano leva o tomo, quem apanha leva o escudo */
const CH = conjunto('ch');
CH({ id: 'ch_hood', n: 'Capuz da Chama Abissal', slot: 'helmet', arm: 10, lvl: 44, price: 34000, b: { magic: 2, maxmana: 60 } });
CH({ id: 'ch_armor', n: 'Traje da Chama Abissal', slot: 'armor', arm: 17, lvl: 45, price: 52000, b: { maxmana: 90, resFire: .08 } });
CH({ id: 'ch_legs', n: 'Vestes da Chama Abissal', slot: 'legs', arm: 11, lvl: 44, price: 36000, b: { maxmana: 50 } });
CH({ id: 'ch_boots', n: 'Botas da Chama Abissal', slot: 'boots', arm: 4, lvl: 44, price: 28000, b: { speed: 16, mpReg: 2 } });
CH({ id: 'ch_shield', n: 'Escudo da Chama Abissal', slot: 'shield', def: 36, lvl: 45, price: 42000, b: { resFire: .10 } });
CH({ id: 'ch_tome', n: 'Grimório da Chama Abissal', slot: 'shield', def: 22, lvl: 45, price: 46000, b: { magic: 2, maxmana: 40 } });
CH({ id: 'ch_staff', n: 'Cajado da Chama Abissal', slot: 'weapon', wt: 'wand', dmg: [44, 74], el: 'fire', lvl: 45, voc: ['sorcerer', 'druid'], price: 54000 });

/* Fúria do Norte — o xamã de pele de urso; mesmo nível da Chama, mas puxa para
   aguentar em vez de queimar */
const FN = conjunto('fn');
FN({ id: 'fn_helmet', n: 'Capuz da Fúria do Norte', slot: 'helmet', arm: 11, lvl: 44, price: 33000, b: { maxhp: 45, resIce: .06 } });
FN({ id: 'fn_armor', n: 'Peles da Fúria do Norte', slot: 'armor', arm: 17, lvl: 45, price: 51000, b: { maxhp: 70, resIce: .08 } });
FN({ id: 'fn_legs', n: 'Saiote da Fúria do Norte', slot: 'legs', arm: 11, lvl: 44, price: 35000, b: { maxhp: 35 } });
FN({ id: 'fn_boots', n: 'Botas da Fúria do Norte', slot: 'boots', arm: 5, lvl: 44, price: 27000, b: { speed: 14, hpReg: 2 } });
FN({ id: 'fn_shield', n: 'Escudo da Fúria do Norte', slot: 'shield', def: 38, lvl: 45, price: 43000, b: { shielding: 2, resIce: .08 } });
FN({ id: 'fn_tome', n: 'Códice da Fúria do Norte', slot: 'shield', def: 24, lvl: 45, price: 45000, b: { magic: 1, hpReg: 3 } });
FN({ id: 'fn_staff', n: 'Cajado da Fúria do Norte', slot: 'weapon', wt: 'wand', dmg: [42, 70], el: 'ice', lvl: 45, voc: ['druid', 'sorcerer'], price: 53000 });

/* Culto Sepulcral — necromancia; o degrau de mago entre a Sentinela e a Regalia */
const CS = conjunto('cs');
CS({ id: 'cs_hood', n: 'Capuz do Culto Sepulcral', slot: 'helmet', arm: 13, lvl: 60, price: 105000, b: { magic: 2, maxmana: 80 } });
CS({ id: 'cs_armor', n: 'Sudário do Culto Sepulcral', slot: 'armor', arm: 21, lvl: 61, price: 155000, b: { maxmana: 110, resDeath: .10 } });
CS({ id: 'cs_legs', n: 'Vestes do Culto Sepulcral', slot: 'legs', arm: 14, lvl: 60, price: 110000, b: { maxmana: 70 } });
CS({ id: 'cs_boots', n: 'Botas do Culto Sepulcral', slot: 'boots', arm: 6, lvl: 60, price: 88000, b: { speed: 22, mpReg: 3 } });
CS({ id: 'cs_shield', n: 'Broquel do Culto Sepulcral', slot: 'shield', def: 48, lvl: 61, price: 125000, b: { resDeath: .10 } });
CS({ id: 'cs_tome', n: 'Grimório do Culto Sepulcral', slot: 'shield', def: 30, lvl: 61, price: 130000, b: { magic: 3, maxmana: 60 } });
CS({ id: 'cs_staff', n: 'Cajado do Culto Sepulcral', slot: 'weapon', wt: 'wand', dmg: [62, 104], el: 'death', lvl: 61, voc: ['sorcerer', 'druid'], price: 150000 });

/* Sentinela do Abismo — placa pesada, feita do que vive na Fenda */
const SA = conjunto('sa');
SA({ id: 'sa_helmet', n: 'Elmo da Sentinela do Abismo', slot: 'helmet', arm: 12, lvl: 55, price: 68000, b: { shielding: 2, maxhp: 30 } });
SA({ id: 'sa_armor', n: 'Couraça da Sentinela do Abismo', slot: 'armor', arm: 20, lvl: 56, price: 92000, b: { maxhp: 60 } });
SA({ id: 'sa_legs', n: 'Grevas da Sentinela do Abismo', slot: 'legs', arm: 13, lvl: 55, price: 64000, b: { maxhp: 25 } });
SA({ id: 'sa_boots', n: 'Botas da Sentinela do Abismo', slot: 'boots', arm: 5, lvl: 54, price: 48000, b: { speed: 20 } });
SA({ id: 'sa_shield', n: 'Escudo da Sentinela do Abismo', slot: 'shield', def: 46, lvl: 56, price: 78000, b: { shielding: 3 } });
SA({ id: 'sa_amulet', n: 'Amuleto da Sentinela do Abismo', slot: 'amulet', arm: 7, lvl: 54, price: 44000, b: { maxhp: 50, resDeath: .08 } });
SA({ id: 'sa_ring', n: 'Anel da Sentinela do Abismo', slot: 'ring', arm: 4, lvl: 54, price: 40000, b: { hpReg: 4 } });
SA({ id: 'sa_sword', n: 'Espada da Sentinela do Abismo', slot: 'weapon', wt: 'sword', atk: 48, def: 32, lvl: 56, price: 74000 });
SA({ id: 'sa_axe', n: 'Machado da Sentinela do Abismo', slot: 'weapon', wt: 'axe', atk: 50, def: 28, lvl: 56, price: 75000 });
SA({ id: 'sa_maul', n: 'Malho da Sentinela do Abismo', slot: 'weapon', wt: 'club', atk: 49, def: 30, lvl: 56, price: 74000 });
/* 47 e não 44: a Besta Real (nv 50) tem 45, e um arco de nível 56 com 44 era um
   downgrade disfarçado de upgrade — o ranger passava do 50 ao 76 sem nunca
   trocar de arma. Fica logo abaixo da espada do mesmo conjunto (48), que é a
   régua de distância deste jogo: quem bate de longe bate um pouco menos. */
SA({ id: 'sa_bow', n: 'Arco da Sentinela do Abismo', slot: 'weapon', wt: 'distance', atk: 47, def: 10, lvl: 56, price: 76000 });
SA({ id: 'sa_rod', n: 'Cetro da Sentinela do Abismo', slot: 'weapon', wt: 'wand', dmg: [58, 96], el: 'death', lvl: 56, voc: ['sorcerer', 'druid'], price: 76000 });

/* Regalia do Vazio — o topo do jogo; leve, cortante e cara de manter */
const VZ = conjunto('vz');
VZ({ id: 'vz_crown', n: 'Coroa do Vazio', slot: 'helmet', arm: 16, lvl: 75, price: 210000, b: { magic: 2, maxmana: 80 } });
VZ({ id: 'vz_armor', n: 'Manto do Vazio', slot: 'armor', arm: 27, lvl: 76, price: 290000, b: { maxhp: 90, maxmana: 90 } });
VZ({ id: 'vz_legs', n: 'Vestes do Vazio', slot: 'legs', arm: 17, lvl: 75, price: 200000, b: { maxmana: 60 } });
VZ({ id: 'vz_boots', n: 'Passos do Vazio', slot: 'boots', arm: 7, lvl: 74, price: 150000, b: { speed: 32 } });
VZ({ id: 'vz_aegis', n: 'Égide do Vazio', slot: 'shield', def: 60, lvl: 76, price: 240000, b: { shielding: 4, magic: 1 } });
VZ({ id: 'vz_amulet', n: 'Amuleto do Vazio', slot: 'amulet', arm: 9, lvl: 74, price: 140000, b: { maxhp: 70, maxmana: 70 } });
VZ({ id: 'vz_ring', n: 'Anel do Vazio', slot: 'ring', arm: 5, lvl: 74, price: 130000, b: { crit: .08, lifesteal: .05 } });
VZ({ id: 'vz_sword', n: 'Lâmina do Vazio', slot: 'weapon', wt: 'sword', atk: 63, def: 40, lvl: 76, price: 230000 });
VZ({ id: 'vz_axe', n: 'Ceifadeira do Vazio', slot: 'weapon', wt: 'axe', atk: 66, def: 34, lvl: 76, price: 235000 });
VZ({ id: 'vz_maul', n: 'Marreta do Vazio', slot: 'weapon', wt: 'club', atk: 64, def: 37, lvl: 76, price: 230000 });
VZ({ id: 'vz_bow', n: 'Arco do Vazio', slot: 'weapon', wt: 'distance', atk: 58, def: 14, lvl: 76, price: 236000 });
VZ({ id: 'vz_staff', n: 'Cajado do Vazio', slot: 'weapon', wt: 'wand', dmg: [78, 130], el: 'energy', lvl: 76, voc: ['sorcerer', 'druid'], price: 236000 });

/* Degraus do conjunto: cumulativos, contados por peça vestida. `max` é 8 porque
   são 7 slots de vestir mais a arma — o oitavo degrau é o conjunto completo.
   Os bônus usam as mesmas chaves dos afixos, então o recalc aplica do mesmo
   jeito e o tooltip já sabe escrever todas. */
const SETS = {
  gg: {
    n: 'Guardião Dourado', max: 8,
    tiers: [
      [2, { arm: 2 }],
      [4, { maxhp: 40, shielding: 2 }],
      [6, { arm: 4, crit: .05 }],
      /* O degrau completo de cada conjunto paga uma resistência, escolhida pelo
         que aquela vocação vai enfrentar quando chegar lá: quem veste o dourado
         inteiro está indo em dragão, o escudeiro encara morto-vivo, o arcano
         apanha de energia. Resistência de conjunto é a única fonte que não
         depende de sorte de afixo — é o que se ganha por completar. */
      [8, { maxhp: 80, speed: 20, lifesteal: .05, resFire: .12 }]
    ]
  },
  /* Cada conjunto puxa para o que a vocação dele já faz, em vez de dar armadura
     para todo mundo: quem atira ganha alcance e passo, quem conjura ganha mana,
     quem segura escudo ganha o que o mantém de pé. */
  ah: {
    n: 'Caçador Ancestral', max: 8,
    tiers: [
      [2, { distance: 1 }],
      [4, { speed: 10, maxhp: 20 }],
      [6, { distance: 2, crit: .03 }],
      [8, { speed: 15, distance: 2, maxhp: 40, resEarth: .12 }]
    ]
  },
  ai: {
    n: 'Iniciado Arcano', max: 8,
    tiers: [
      [2, { maxmana: 30 }],
      [4, { magic: 1, mpReg: 2 }],
      [6, { maxmana: 60, magic: 1 }],
      [8, { magic: 2, mpReg: 4, maxmana: 90, resEnergy: .12 }]
    ]
  },
  fs: {
    n: 'Espreitador da Floresta', max: 8,
    tiers: [
      [2, { speed: 10 }],
      [4, { distance: 2, crit: .04 }],
      [6, { speed: 18, maxhp: 40 }],
      [8, { distance: 3, crit: .07, speed: 25, resIce: .12 }]
    ]
  },
  ns: {
    n: 'Escudeiro Nobre', max: 8,
    tiers: [
      [2, { arm: 2 }],
      [4, { shielding: 2, maxhp: 40 }],
      [6, { arm: 3, hpReg: 2 }],
      [8, { maxhp: 90, shielding: 3, arm: 3, resDeath: .12 }]
    ]
  },
  /* Os cinco das folhas novas. Seis ou sete peças em vez de oito (a folha não
     trazia amuleto nem anel), então o degrau cheio vem antes — o bônus total
     acompanha o nível, não o número de peças. */
  bo: {
    n: 'Bosque Ancião', max: 6,
    tiers: [
      [2, { maxmana: 40 }],
      [4, { magic: 1, hpReg: 2 }],
      [6, { magic: 2, maxmana: 80, mpReg: 3, resEarth: .12 }]
    ]
  },
  gl: {
    n: 'Guarda do Leão', max: 7,
    tiers: [
      [2, { arm: 2 }],
      [4, { maxhp: 45, shielding: 2 }],
      [7, { arm: 4, maxhp: 70, shielding: 2, resHoly: .10 }]
    ]
  },
  ch: {
    n: 'Chama Abissal', max: 7,
    tiers: [
      [2, { maxmana: 60 }],
      [4, { magic: 2, resFire: .10 }],
      [7, { magic: 3, maxmana: 120, mpReg: 4, resFire: .15 }]
    ]
  },
  fn: {
    n: 'Fúria do Norte', max: 7,
    tiers: [
      [2, { maxhp: 60 }],
      [4, { hpReg: 4, resIce: .10 }],
      [7, { maxhp: 120, arm: 4, magic: 1, resIce: .15 }]
    ]
  },
  cs: {
    n: 'Culto Sepulcral', max: 7,
    tiers: [
      [2, { maxmana: 90 }],
      [4, { magic: 2, mpReg: 3, resDeath: .10 }],
      [7, { magic: 4, maxmana: 160, crit: .06, resDeath: .15 }]
    ]
  },
  /* Os dois de endgame pagam RESISTÊNCIA em degrau, não só no oitavo: abaixo da
     caverna quase todo golpe é elemental, e sem corte de elemento o jogador de
     nível 100 leva 300 de dano por sopro com armadura cheia. É o que faz vestir
     o conjunto inteiro valer mais que juntar quatro peças lendárias soltas. */
  sa: {
    n: 'Sentinela do Abismo', max: 8,
    tiers: [
      [2, { arm: 3, maxhp: 40 }],
      [4, { shielding: 3, resFire: .10, resDeath: .10 }],
      [6, { arm: 5, hpReg: 4, maxhp: 80 }],
      [8, { maxhp: 160, arm: 5, shielding: 4, lifesteal: .06, resFire: .12, resDeath: .12 }]
    ]
  },
  vz: {
    n: 'Regalia do Vazio', max: 8,
    tiers: [
      [2, { maxmana: 60, speed: 12 }],
      [4, { magic: 2, crit: .05, resEnergy: .12 }],
      [6, { maxhp: 120, maxmana: 120, mpReg: 5 }],
      [8, { magic: 3, crit: .10, speed: 30, lifesteal: .08, resEnergy: .13, resIce: .13, resHoly: .10 }]
    ]
  }
};

/* ---- runas: usam magia engarrafada, com cargas, e qualquer vocação usa ----
   `rune.type`: attack (alvo), aoe (área no alvo), heal (em você).
   Dano/cura escala com nível e magic level, como no Tibia. */
const rune = o => item(Object.assign({ ico: '🔮', slot: null, charges: 3 }, o));
rune({ id: 'rune_hmm', n: 'Míssil Mágico Pesado', charges: 6, price: 400, sell: 120, rune: { type: 'attack', base: 22, f: 1.4, el: 'energy', col: 0x8fb8ff } });
rune({ id: 'rune_explosion', n: 'Runa de Explosão', charges: 6, price: 700, sell: 200, rune: { type: 'aoe', r: 1, base: 26, f: 1.5, el: 'fire', col: 0xff8a3a } });
rune({ id: 'rune_gfb', n: 'Bola de Fogo Grande', charges: 3, price: 900, sell: 260, rune: { type: 'aoe', r: 1, base: 34, f: 1.9, el: 'fire', col: 0xff6a10 } });
rune({ id: 'rune_avalanche', n: 'Runa Avalanche', charges: 3, price: 950, sell: 280, rune: { type: 'aoe', r: 1, base: 36, f: 2.0, el: 'ice', col: 0x9fe4ff } });
rune({ id: 'rune_sd', n: 'Runa da Morte Súbita', charges: 3, price: 2400, sell: 700, rune: { type: 'attack', base: 75, f: 3.2, el: 'death' } });
rune({ id: 'rune_ih', n: 'Runa de Cura Intensa', charges: 5, price: 600, sell: 170, rune: { type: 'heal', base: 65, f: 2.2 } });
rune({ id: 'rune_uh', n: 'Runa de Cura Suprema', charges: 3, price: 1600, sell: 460, rune: { type: 'heal', base: 190, f: 5.0 } });

const SHOP_STOCK = ['weak_health_potion', 'health_potion', 'strong_health_potion', 'great_health_potion',
  'supreme_health_potion', 'ultimate_health_potion', 'mana_potion',
  'strong_mana_potion', 'great_mana_potion', 'supreme_mana_potion', 'ultimate_mana_potion', 'dagger', 'sabre', 'axe', 'mace', 'short_bow', 'bow',
  /* A loja vendia SÓ as duas varinhas iniciais (nv 6), e as varinhas do meio do
     jogo não caíam de ninguém — três delas não existiam em nenhuma tabela de
     loot. Resultado: druida de nível 25 ainda com o cajado do nível 6, porque
     não havia caminho nenhum até o próximo. Agora a linha de conjurador e a de
     tiro se compram até o nv 36, como qualquer armadura; do 46 pra cima é loot,
     que é onde o drop tem de importar. */
  'crossbow', 'arbalest', 'steel_crossbow', 'clerical_mace', 'bright_sword', 'halberd',
  'wand_of_vortex', 'wand_of_dragonbreath', 'wand_of_decay', 'wand_of_cosmic_energy', 'wand_of_inferno',
  'snakebite_rod', 'moonlight_rod', 'terra_rod', 'springsprout_rod', 'hailstorm_rod',
  /* As ferramentas de coleta são de loja e não de loot: sem elas o ofício não
     abre, e ofício que depende de sorte no drop não é ofício. O machado já
     estava aqui e serve de lenhador. */
  'pickaxe', 'fishing_rod',
  'apple', 'bread', 'egg', 'grapes', 'cheese',
  'wooden_shield', 'brass_shield', 'leather_helmet', 'soldier_helmet',
  'leather_armor', 'chain_armor', 'scale_armor', 'leather_legs', 'brass_legs', 'leather_boots',
  'bronze_amulet', 'silver_amulet', 'rapier', 'viking_helmet', 'viking_shield', 'morning_star', 'torch',
  'rune_hmm', 'rune_explosion', 'rune_gfb', 'rune_avalanche', 'rune_ih', 'rune_uh', 'rune_sd'];

/* -------------------------------------------------------------- elementos */
/* Uma linha por elemento, lida por três lados: o render tira daqui a cor, a luz
   e o jeito da partícula; o dano tira a resistência; a UI tira o nome. Antes
   cada magia carregava a própria `col` e o elemento era um rótulo que ninguém
   consultava — 45 magias com o mesmo desenho e a mesma conta.
     luz   quanto o efeito acende o terreno em volta (0 = não acende)
     grav  para onde a partícula vai: -1 sobe, +1 cai, 0 segue reto
     forma o desenho da partícula, lido por drawEffects
   Terra é o único ataque sem luz nenhuma de propósito: torrão e espinho não
   brilham, e é isso que o separa do sagrado, que é a mesma cor clara de longe. */
/* Estados elementais no corpo. Até aqui o elemento decidia cor de partícula e
   multiplicador de resistência, e mais nada: fogo não queimava, terra não
   envenenava. Um estado é um efeito com relógio, então ele É um buff — entra no
   mesmo `P.buffs` que já hospeda a lentidão, e ganha de graça a expiração, a
   barra de status, o `recalc` e a limpeza no save. A criatura ganha o mesmo mapa
   em `m.estados`, que é a estrutura que faltava do lado dela.

   `dano` é fração do GOLPE que aplicou, não da vida máxima: assim o veneno de
   quem bate fraco é fraco, e um chefe de 130 mil de vida não derrete por causa
   de um tique percentual. Com o tique de 3 s, cada estado soma de 40% a 45% do
   golpe inicial ao longo da duração — reforço, nunca a fonte principal.

   `physical`, `holy` e `death` ficam de fora de propósito: são tipos de dano, e
   não condições que o corpo carrega. Sagrado que queimasse seria fogo com outro
   nome. */
const ESTADOS = {
  queimando:    { el: 'fire',   n: 'Queimando',    dano: .15, dur: 9000,  chance: .25 },
  envenenado:   { el: 'earth',  n: 'Envenenado',   dano: .08, dur: 15000, chance: .25 },
  eletrocutado: { el: 'energy', n: 'Eletrocutado', dano: .20, dur: 6000,  chance: .22 },
  /* Gelo cobra em movimento, não em dano: congelar por dano seria fogo azul. O
     `lento` reaproveita a lentidão da teia, que o recalc já sabe ler. */
  congelado:    { el: 'ice',    n: 'Congelado',    dano: .05, dur: 9000,  chance: .28, lento: .35 },
  /* SANGRANDO é o estado do cavaleiro, e o único SEM elemento: corte não é
     matéria, é ferimento. Por isso traz a própria cor e a própria partícula em
     vez de puxar de ELEM, e por isso `precisaSangue` — esqueleto, elemental e
     quem mais tem sangue seco não sangra, o que reaproveita o `seco` que a
     tabela de sangue já declara por classe.
     Existir resolve uma assimetria: estado elemental nasceu inteiro do lado
     mágico, porque espada e flecha são dano físico. O cavaleiro é quem menos dá
     dano do jogo (ver #39) e agora tem a própria fonte de dano contínuo. */
  sangrando:    { n: 'Sangrando', dano: .10, dur: 12000, chance: .30,
                  cor: 0x8e1414, forma: 'caco', grav: 1, luz: 0, precisaSangue: true }
};
const ESTADO_DE = {};                                  // elemento -> id do estado
for (const k in ESTADOS) if (ESTADOS[k].el) ESTADO_DE[ESTADOS[k].el] = k;
const ELEM = {
  physical: { n: 'Físico',  cor: 0xd9c48a, luz: 0,   grav: 1,   forma: 'caco' },
  fire:     { n: 'Fogo',    cor: 0xff7a20, luz: 1,   grav: -1,  forma: 'brasa' },
  ice:      { n: 'Gelo',    cor: 0x8fdcff, luz: .3,  grav: 1,   forma: 'caco' },
  energy:   { n: 'Energia', cor: 0x7fb8ff, luz: 1.2, grav: 0,   forma: 'raio' },
  earth:    { n: 'Terra',   cor: 0x7ac24a, luz: 0,   grav: 1,   forma: 'torrao' },
  holy:     { n: 'Sagrado', cor: 0xfff3a0, luz: .8,  grav: -.4, forma: 'faisca' },
  death:    { n: 'Morte',   cor: 0x9f5aff, luz: .5,  grav: -.2, forma: 'fumaca' }
};

/* Resistência por CLASSE, não por criatura: a classe já existe — é o que o
   bestiário e a cor do sangue usam — então 40 monstros ganham o sistema sem
   ganhar um campo. 1 = normal, 0 = imune, 2 = dobro. `res` na ficha do monstro
   sobrescreve a classe, para a criatura que foge da própria família.
   Duas regras que não podem ser quebradas, e o teste cobra as duas:
     1. nada resiste a `physical` abaixo de .5 — o cavaleiro só tem isso, e
        imunidade a físico não é dificuldade, é parede;
     2. toda vocação precisa de PELO MENOS um elemento >= .5 em cada monstro,
        senão existe bicho que uma classe inteira não consegue matar. */
const RES = {
  'Morto-vivo': { holy: 1.6, death: 0,   earth: .3, ice: .7,   fire: 1.1 },
  'Demônio':    { holy: 1.5, death: .2,  fire: .3,  energy: .8 },
  'Dragão':     { fire: 0,   ice: 1.4,   earth: .7, energy: 1.1 },
  'Inseto':     { fire: 1.4, ice: 1.2,   earth: .4 },
  'Aracnídeo':  { fire: 1.4, ice: 1.2,   earth: .5 },
  'Réptil':     { ice: 1.4,  fire: .8,   earth: .6 },
  'Mamífero':   { ice: 1.2,  earth: .9 },
  'Gigante':    { physical: .8, energy: 1.3, earth: .8 },
  'Humanoide':  {},
  /* As três classes dos andares fundos. Elemental é a única que existe para ser
     SOBRESCRITA: a linha da classe é só o esqueleto (não sangra, resiste a
     físico, apanha do oposto) e cada elemental declara o próprio `res` — é a
     família inteira do jogo em que trocar de magia importa mais que bater mais.
     Celeste é o espelho do morto-vivo: imune ao sagrado, rasgado pela morte —
     e é o que enfim dá ao druida/necro uma presa exclusiva no endgame. */
  'Elemental':  { physical: .6, death: .5, holy: 1.1 },
  'Aberração':  { physical: .8, death: .4, holy: 1.5, energy: 1.25, earth: .6 },
  'Celeste':    { physical: .8, holy: .2, death: 1.7, fire: .8, ice: .8, energy: .9 }
};
/* golpe sem elemento (espada, garra, flecha comum) conta como físico */
function resistOf(def, el) {
  const e = el || 'physical';
  if (def.res && def.res[e] !== undefined) return def.res[e];
  const c = RES[def.cls];
  return c && c[e] !== undefined ? c[e] : 1;
}

/* INTELIGÊNCIA por CLASSE, com override na ficha — a mesma forma do RES logo
   acima e pelo mesmo motivo: a classe já existe, então 83 criaturas ganham o
   eixo sem ganhar um campo.
   NÃO é o `medo`, e a diferença importa: medo é instinto de sobrevivência,
   inteligência é ler o chão. O ciclope é brutamontes e não recua por orgulho
   (por isso não tem `medo`), mas enxerga a fogueira e dá a volta; o esqueleto
   atravessa, porque não há ninguém em casa para decidir o contrário.
   Hoje responde uma pergunta só — desviar de campo no chão? — e é onde a IA de
   #24 cresce: escolher alvo, agrupar, recuar em bando são o mesmo eixo. */
const INTEL = {
  'Humanoide': 3, 'Demônio': 3, 'Celeste': 3, 'Dragão': 3,   // planeja
  'Gigante': 2, 'Aberração': 2,                              // não planeja, mas evita
  'Mamífero': 1, 'Réptil': 1, 'Aracnídeo': 1, 'Morto-vivo': 1,
  'Inseto': 0, 'Elemental': 0                                // atravessa qualquer coisa
};
const INTEL_DESVIA = 2;   // daqui para cima a criatura contorna o que a machuca
const intelOf = def => def.int !== undefined ? def.int
  : (INTEL[def.cls] !== undefined ? INTEL[def.cls] : 1);

/* Campo no chão (#33). O teto é o mesmo desenho do SANGUE_MAX — quem protege a
   memória é a contagem, não o relógio.
   FORCA: o resíduo é uma FRAÇÃO do golpe que o criou, não o golpe inteiro. Com
   o valor cheio, atravessar uma Fúria dos Céus custava mais vida que levar a
   magia na cara, porque cada tile cobrava um tique inteiro. É o botão de ajuste
   do campo: sobe se o chão ficar inofensivo, desce se atravessar virar sentença.
   CHANCE: a magia não acende a área inteira, acende PARTE dela — brasa pega
   onde pega. Cobrir os 80 tiles de um raio 4 transformava a magia num muro e
   apagava a escolha de por onde passar; espalhado, dá para costurar entre as
   chamas, e a criatura esperta tem por onde contornar. */
const CAMPO_DUR = 120000;
const CAMPO_MAX = 300;
const CAMPO_FORCA = .25;
const CAMPO_CHANCE = .45;
/* FASES. O campo dura dois minutos e vai MORRENDO em três degraus, em vez de
   cobrar igual até apagar de repente. `ate` é a fração da duração em que a fase
   termina e `dano` o que ela cobra do golpe guardado no tile.
   A fase mínima não machuca: o chão continua marcado — brasa, mancha, geada —
   mas atravessar sai de graça. Isso resolve o problema que dois minutos criam:
   sem ela, um corredor incendiado ficaria intransitável por dois minutos
   inteiros, e negar área por tanto tempo é mais forte do que uma magia deveria
   ser. Com ela, a magia nega passagem por um minuto e deixa cicatriz pelo resto.
   A fase TEM de ser visível no desenho, não só no número: o jogador precisa
   olhar o tile e saber se dói (§20 — nada de indicador que só existe na regra).
   Quem for mexer, mexa aqui: é a única régua das três fases, e o desenho, o
   dano e o desvio da criatura leem todos dela. */
const CAMPO_FASES = [
  { n: 'cheia',  ate: .50, dano: 1 },     // 60s
  { n: 'fraca',  ate: .80, dano: .4 },    // 36s
  { n: 'minima', ate: 1,   dano: 0 }      // 24s — só a marca
];
/* Quem passa POR CIMA de quem está em pé no tile. Fogo e veneno ENVOLVEM: quem
   entra na fogueira fica dentro dela, e quem atola no veneno fica atolado. Gelo
   e energia são chão tratado — geada e carga ficam sob os pés, e passar por
   cima esconderia a criatura atrás de uma placa azul sem ganhar leitura nenhuma.
   Vale só para a entidade do PRÓPRIO tile: campo não tapa quem está noutro. */
const CAMPO_ACIMA = { fire: true, earth: true };
function campoFase(k) {
  for (let i = 0; i < CAMPO_FASES.length; i++) if (k < CAMPO_FASES[i].ate) return i;
  return CAMPO_FASES.length - 1;
}

/* --------------------------------------------------------------- monstros */
/* loot: [idDoItem, chance, min, max] — cada linha rola sozinha, então um monstro
   pode largar nenhum item, um, ou a lista inteira. min/max = quantidade (empilháveis).

   spd: NÃO se declara aqui. Sai de VEL_BASE[classe] + tier×VEL_TIER, montado no
   fim deste arquivo. A régua antiga dizia "velocidade sai da natureza, não do
   tier" e ninguém a seguiu: o lobo de tier 1 tinha 345, o valor mais alto do
   jogo, e o juggernaut de tier 11 tinha 235 — mais lento que um rato. Natureza
   E força, as duas, e derivado em vez de escolhido à mão.
   Quem precisar de exceção declara `spd` e o valor é respeitado; hoje ninguém
   precisa, e uma exceção sem motivo escrito é a volta do problema.

   medo: fração da vida em que a criatura desiste e foge. Ausente = luta até
   morrer. Bicho burro (verme, besouro) não tem noção de perigo, morto-vivo não
   tem instinto de sobrevivência, e brutamontes (minotauro, ciclope, dragão) não
   recua por orgulho — sobram os animais e os humanoides que pensam.

   ranged: TER tiro não é ser atirador. `recua: true` é o que faz a criatura
   manter distância — é o ofício de quem carrega arco ou lança. Dragão e demônio
   têm sopro, mas são brutamontes: avançam, queimam de longe no caminho e brigam
   coladas. Sem essa distinção o dragão fugia do jogador a vida inteira.

   hab: uma habilidade por criatura, ligada à natureza e à dificuldade dela.
     { tipo:'area',  r, dano:[min,max] }  estouro em volta do próprio bicho
     { tipo:'lento', r, lento, dur, dano } prende ou atrasa quem está no raio
     { tipo:'cura',  val }                 fecha as próprias feridas
   `cd` é o descanso em ms e `grito` é o que aparece sobre a cabeça — dar aviso
   é o que separa "difícil" de "injusto". */
const MONSTERS = {
  rat: {
    n: 'Rato', hp: 20, exp: 5, atk: [1, 6], arm: 0, sz: .5, col: 0x8a7b6a, tier: 0, medo: .4,
    loot: [['weak_health_potion', 0.08], ['leather_legs', 0.05], ['gold', .8, 1, 10], ['rat_tail', .35, 1, 2], ['meat', .12], ['dagger', .04], ['leather_boots', .02]]
  },
  snake: {
    n: 'Cobra', hp: 30, exp: 8, atk: [2, 9], arm: 2, sz: .45, col: 0x4f8f3a, tier: 0, medo: .3,
    loot: [['gold', .7, 1, 14], ['snake_hide', .3], ['meat', .1], ['health_potion', .05]]
  },
  bug: {
    n: 'Besouro Gigante', hp: 45, exp: 12, atk: [3, 12], arm: 4, sz: .55, col: 0x6b4f2a, tier: 0,
    loot: [['weak_health_potion', 0.07], ['bronze_amulet', 0.05], ['gold', .8, 2, 20], ['bug_shell', .3], ['arrow', .12, 3, 8], ['leather_helmet', .05], ['health_potion', .05]]
  },
  wolf: {
    n: 'Lobo', hp: 65, exp: 22, atk: [5, 18], arm: 3, sz: .7, col: 0x8f8f96, tier: 1, medo: .35,
    loot: [['leather_legs', 0.06], ['viking_helmet', 0.04], ['gold', .85, 4, 30], ['wolf_paw', .25], ['meat', .35, 1, 2], ['bone', .1], ['leather_armor', .06], ['hand_axe', .05]]
  },
  spider: {
    n: 'Aranha', hp: 55, exp: 20, atk: [4, 16], arm: 5, sz: .6, col: 0x2f2f3a, tier: 1,
    hab: { tipo: 'lento', r: 3, lento: .3, dur: 5000, cd: 13000, col: 0xcfd6e0, grito: 'sssss' },
    loot: [['rapier', 0.05], ['gold', .8, 3, 26], ['spider_silk', .18], ['arrow', .15, 2, 10], ['studded_helmet', .05], ['health_potion', .08]]
  },
  skeleton: {
    n: 'Esqueleto', hp: 80, exp: 35, atk: [6, 22], arm: 6, sz: .8, col: 0xdad2bd, tier: 1,
    loot: [['sabre', 0.06], ['rapier', 0.05], ['gold', .9, 5, 38], ['bone', .5, 1, 3], ['skull', .12], ['bolt', .1, 3, 9],
    ['short_sword', .08], ['studded_armor', .06], ['wooden_shield', .07]]
  },
  orc: {
    n: 'Orc', hp: 100, exp: 45, atk: [8, 26], arm: 7, sz: .85, col: 0x6f8f4a, tier: 1, medo: .15,
    loot: [['bread', 0.12], ['cheese', 0.08], ['soldier_helmet', 0.06], ['sabre', 0.05], ['gold', .9, 8, 48], ['orc_tooth', .25], ['meat', .2], ['arrow', .12, 5, 15],
    ['axe', .06], ['studded_shield', .06], ['studded_legs', .07]]
  },
  orc_spearman: {
    n: 'Orc Lanceiro', hp: 110, exp: 55, atk: [6, 18], arm: 7, sz: .85, col: 0x8aa05a, tier: 2, medo: .25,
    ranged: { min: 10, max: 30, range: 5, col: 0xd2b48c, recua: true },
    loot: [['bread', 0.1], ['apple', 0.1], ['soldier_helmet', 0.05], ['gold', .9, 10, 58], ['orc_tooth', .3], ['spear', .3, 1, 3], ['arrow', .25, 5, 20],
    ['short_bow', .07], ['studded_armor', .07]]
  },
  ghoul: {
    n: 'Carniçal', hp: 140, exp: 85, atk: [10, 32], arm: 10, sz: .85, col: 0x7d8f6a, tier: 2,
    hab: { tipo: 'lento', r: 1, lento: .5, dur: 5000, cd: 14000, col: 0x8fbf6a, grito: 'Grrhh...' },
    loot: [['torch', 0.06], ['silver_amulet', 0.04], ['clerical_mace', 0.04], ['gold', .9, 12, 74], ['rotten_flesh', .35], ['skull', .15], ['white_pearl', .04],
    ['brass_helmet', .05], ['chain_armor', .06], ['strong_health_potion', .05]]
  },
  rotworm: {
    n: 'Verme Podre', hp: 120, exp: 70, atk: [9, 28], arm: 12, sz: .7, col: 0xa06a4a, tier: 2,
    loot: [['club_ring', 0.03], ['gold', .9, 10, 62], ['worm_slime', .35], ['meat', .25], ['bone', .15], ['mace', .07], ['brass_legs', .05]]
  },
  dwarf_soldier: {
    n: 'Anão Soldado', hp: 175, exp: 110, atk: [12, 38], arm: 14, sz: .7, col: 0xb08a4a, tier: 2, medo: .12,
    loot: [['cheese', 0.12], ['bread', 0.1], ['protection_amulet', 0.04], ['plate_shield', 0.04], ['gold', .95, 15, 95], ['iron_ore', .25], ['small_ruby', .02], ['health_potion', .1],
    ['battle_axe', .05], ['brass_armor', .06], ['brass_shield', .07],
    ['gg_legs', .01], ['gg_boots', .01], ['gg_sword', .008], ['gg_axe', .008], ['gg_mace', .008]]
  },
  minotaur: {
    n: 'Minotauro', hp: 200, exp: 130, atk: [14, 44], arm: 15, sz: 1.0, col: 0x8a5a3a, tier: 3,
    loot: [['bread', 0.1], ['grapes', 0.1], ['morning_star', 0.03], ['plate_shield', 0.03], ['gold', .95, 20, 115], ['minotaur_leather', .3], ['minotaur_horn', .08], ['ham', .2],
    ['sword', .07], ['plate_legs', .04], ['battle_shield', .05]]
  },
  minotaur_archer: {
    n: 'Minotauro Arqueiro', hp: 190, exp: 145, atk: [8, 24], arm: 13, sz: 1.0, col: 0x9a6a2a, tier: 3, medo: .2,
    ranged: { min: 18, max: 52, range: 6, col: 0xe0c080, recua: true },
    loot: [['arbalest', 0.04], ['steel_crossbow', 0.02], ['gold', .95, 22, 125], ['minotaur_leather', .3], ['arrow', .4, 10, 30], ['bolt', .15, 5, 15],
    ['bow', .07], ['crossbow', .03], ['strong_mana_potion', .06]]
  },
  cyclops: {
    n: 'Ciclope', hp: 280, exp: 200, atk: [18, 56], arm: 18, sz: 2, col: 0x7a6a5a, tier: 3,
    hab: { tipo: 'area', r: 2, dano: [18, 44], cd: 11000, col: 0xc9a05a, grito: 'ESMAGA!' },
    loot: [['gold', .95, 30, 170], ['cyclops_toe', .25], ['cyclops_eye', .2], ['bone', .3, 1, 3], ['ham', .25], ['might_ring', .02],
    ['plate_armor', .05], ['war_hammer', .03], ['steel_helmet', .05]]
  },
  giant_spider: {
    n: 'Aranha Gigante', hp: 380, exp: 320, atk: [22, 68], arm: 20, sz: 1.15, col: 0x3a2f4a, tier: 4,
    hab: { tipo: 'lento', r: 3, lento: .55, dur: 7000, dano: [10, 25], cd: 11000, col: 0xcfd6e0, grito: 'sssSSS' },
    loot: [['gold', .95, 40, 230], ['spider_silk', .4, 1, 2], ['black_pearl', .06], ['life_ring', .03],
    ['knight_legs', .03], ['tower_shield', .02], ['strong_health_potion', .12]]
  },
  demon_skeleton: {
    n: 'Esqueleto Demoníaco', hp: 420, exp: 380, atk: [24, 72], arm: 24, sz: .95, col: 0xc45a2a, tier: 4,
    // já queimou: o fogo que derrete morto-vivo comum não move este
    res: { fire: .5 },
    hab: { tipo: 'cura', val: 90, cd: 15000, col: 0xc98bdd, grito: 'Vita reverto!' },
    loot: [['black_shield', 0.03], ['gold', .95, 45, 260], ['bone', .4, 2, 5], ['skull', .3], ['small_sapphire', .04], ['black_pearl', .05],
    ['serpent_sword', .05], ['knight_armor', .02], ['war_axe', .02]]
  },
  dragon: {
    n: 'Dragão', hp: 700, exp: 700, atk: [26, 80], arm: 25, sz: 1.5, col: 0x2f8f4a, tier: 5,
    ranged: { min: 40, max: 110, range: 6, col: 0xff8020, el: 'fire' },
    hab: { tipo: 'area', r: 3, dano: [35, 85], cd: 9000, el: 'fire', col: 0xff8020, grito: 'GRAAAWR!' },
    loot: [['crown_armor', 0.025], ['crown_legs', 0.03], ['platinum_amulet', 0.02], ['gold', .98, 60, 330], ['dragon_scale', .35, 1, 2], ['dragon_ham', .3], ['small_diamond', .04], ['talon', .02],
    ['dragon_necklace', .06], ['knight_sword', .05], ['crown_helmet', .03], ['great_health_potion', .15]]
  },
  dragon_lord: {
    n: 'Senhor Dragão', hp: 1300, exp: 1500, atk: [38, 120], arm: 30, sz: 1.7, col: 0xc02020, tier: 6,
    ranged: { min: 70, max: 180, range: 7, col: 0xff4020, el: 'fire' },
    hab: { tipo: 'area', r: 4, dano: [55, 130], cd: 8000, el: 'fire', col: 0xff4020, grito: 'GRAAAWR!' },
    loot: [['golden_legs', 0.025], ['gold', .99, 120, 620], ['red_dragon_scale', .4, 1, 2], ['dragon_head', .08], ['dragon_ham', .5, 1, 2], ['small_diamond', .1], ['gold_ingot', .08],
    ['dragon_scale_mail', .04], ['royal_helmet', .04], ['fire_sword', .04], ['great_mana_potion', .2]]
  },
  demon: {
    n: 'Demônio', hp: 2400, exp: 3500, atk: [60, 190], arm: 38, sz: 1.9, col: 0x8a1030, tier: 7,
    ranged: { min: 110, max: 260, range: 7, col: 0xff2060, el: 'death' },
    hab: { tipo: 'area', r: 4, dano: [80, 190], cd: 7000, el: 'death', col: 0xff2060, grito: 'MORRA!' },
    loot: [['horned_helmet', 0.025], ['gold', 1, 300, 1200], ['demon_dust', .5, 1, 3], ['demon_horn', .3], ['demon_wing', .25], ['demon_skull', .2], ['gold_ingot', .3], ['talon', .15],
    ['great_health_potion', .5, 1, 2], ['demon_shield', .05], ['demon_helmet', .04], ['magic_plate_armor', .02],
    ['stonecutter_axe', .03], ['thunder_hammer', .03], ['magic_sword', .03], ['elvish_bow', .03]]
  }
};

/* Aparência de cada monstro: `shape`/`o` é o boneco procedural do art.js. */
const MOB_ART = {
  rat: { shape: 'quadruped' },
  snake: { shape: 'serpent' },
  bug: { shape: 'arachnid' },
  /* Espécie sem forma própria reaproveita `shape` de outra — se distingue pela
     cor da tabela e pelo tamanho (`sz`). */
  wolf: { shape: 'quadruped' },
  spider: { shape: 'arachnid' },
  skeleton: { shape: 'biped', o: { thin: true, skin: 0xe8e2d0, eyes: 0xff4444, weapon: 0x8a8578 } },
  orc: { shape: 'biped', o: { skin: 0x86a35c, weapon: 0x7a6a4a } },
  orc_spearman: { shape: 'biped', o: { skin: 0x9ab06a, weapon: 0xb8a070 } },
  ghoul: { shape: 'biped', o: { skin: 0x93a37c, eyes: 0xffee88 } },
  rotworm: { shape: 'worm' },
  dwarf_soldier: { shape: 'biped', o: { skin: 0xd8b98a, weapon: 0x9aa0a8, shield: 0x8a7a4a } },
  minotaur: { shape: 'biped', o: { horns: true, skin: 0xa06a44, weapon: 0x8a7a5a } },
  minotaur_archer: { shape: 'biped', o: { horns: true, skin: 0xb07a34, weapon: 0x6a4a2a } },
  cyclops: { sheet: 'cyclops', shape: 'biped', o: { skin: 0x8f7f6a, eyes: 0xffcc44, weapon: 0x6a5a4a } },
  giant_spider: { shape: 'arachnid' },
  demon_skeleton: { shape: 'biped', o: { thin: true, skin: 0xd8a070, eyes: 0xff3311, weapon: 0xc45a2a } },
  dragon: { shape: 'dragon' },
  dragon_lord: { shape: 'dragon' },
  /* `sheet` = pasta em assets/creatures/. O boneco procedural continua descrito
     porque é ele quem aparece enquanto o PNG não chegou. */
  demon: { sheet: 'demon', shape: 'biped', o: { horns: true, wings: true, skin: 0xa02040, eyes: 0xffdd00, hornCol: 0x2a0a12, weapon: 0xff4020 } }
};
for (const k in MOB_ART) Object.assign(MONSTERS[k], MOB_ART[k]);

/* classe e dificuldade de cada criatura — usadas pelo bestiário, como no Tibia */
const MOB_META = {
  rat: ['Mamífero', 'harmless'], snake: ['Réptil', 'harmless'], bug: ['Inseto', 'harmless'],
  wolf: ['Mamífero', 'trivial'], spider: ['Aracnídeo', 'trivial'], skeleton: ['Morto-vivo', 'trivial'],
  orc: ['Humanoide', 'trivial'], orc_spearman: ['Humanoide', 'easy'], ghoul: ['Morto-vivo', 'easy'],
  rotworm: ['Inseto', 'easy'], dwarf_soldier: ['Humanoide', 'easy'],
  minotaur: ['Humanoide', 'medium'], minotaur_archer: ['Humanoide', 'medium'], cyclops: ['Gigante', 'medium'],
  giant_spider: ['Aracnídeo', 'hard'], demon_skeleton: ['Morto-vivo', 'hard'], dragon: ['Dragão', 'hard'],
  dragon_lord: ['Dragão', 'challenging'], demon: ['Demônio', 'challenging']
};
for (const k in MOB_META) { MONSTERS[k].cls = MOB_META[k][0]; MONSTERS[k].diff = MOB_META[k][1]; }

/* O que cada classe espirra ao morrer. Sai da classe que o bestiário já usa, em
   vez de uma cor por monstro: inseto e aracnídeo largam hemolinfa esverdeada,
   morto-vivo estilhaça osso, demônio sangra escuro. `seco` marca quem solta
   caco em vez de líquido — o render usa isso para dar bordas retas e não deixar
   poça no chão, porque osso não escorre. */
const SANGUE_CLASSE = {
  'Inseto':    { cor: 0x7bbf3a, seco: false },
  'Aracnídeo': { cor: 0x8fd14a, seco: false },
  'Morto-vivo': { cor: 0xd8d0b8, seco: true },
  'Demônio':   { cor: 0x4a0d16, seco: false },
  'Dragão':    { cor: 0x9c1f10, seco: false },
  /* Elemental não sangra: espirra o próprio material e ele seca na hora.
     Celeste sangra luz. Aberração sangra o que não tem nome. */
  'Elemental': { cor: 0xc9d8e8, seco: true },
  'Aberração': { cor: 0x3a1050, seco: false },
  'Celeste':   { cor: 0xffe9a8, seco: false }
};
const SANGUE_PADRAO = { cor: 0x8e1414, seco: false };   // mamífero, humanoide, réptil, gigante
for (const k in MONSTERS) if (MONSTERS[k].cls) MONSTERS[k].sangue = SANGUE_CLASSE[MONSTERS[k].cls] || SANGUE_PADRAO;

/* ---- lote 2 de criaturas: variações das famílias que já existem ----------
   O lote 1 monta a criatura em três tabelas separadas (MONSTERS, MOB_ART,
   MOB_META) e costura com três laços. Aqui é a mesma criatura, declarada de uma
   vez só: `art` é o boneco, `meta` é [classe, dificuldade]. `mob()` faz a
   costura na hora e alimenta as três tabelas antigas, então bestiário, sangue e
   render continuam lendo o que sempre leram.
   Cada variação existe para tapar um degrau da curva ou para dar um jeito de
   lutar que a família ainda não tinha (quem atira, quem cura, quem estoura). */
function mob(id, d) {
  const { art, meta, ...st } = d;
  MOB_ART[id] = art; MOB_META[id] = meta;
  MONSTERS[id] = Object.assign(st, art, { cls: meta[0], diff: meta[1] });
  MONSTERS[id].sangue = SANGUE_CLASSE[meta[0]] || SANGUE_PADRAO;
}

/* FAUNA PASSIVA — o mundo precisa de paz.
   `passivo` só faz uma coisa: a criatura não liga o encalço por ver você. Todo
   o resto reaproveita o que já existia — apanhar acorda ela (em `dealDamage`) e
   `medo: 1` faz fugir ao primeiro golpe, pelo mesmo ramo de fuga que o lobo
   ferido usa. Encurralada ela vira e luta, o que também já era regra.
   `noite` some com a criatura de dia (em `refreshSpawns`), usando o ciclo que
   `ehNoite()` já mantinha sem ninguém consumir.
   Estes bichos existem para o caminho entre hunts ter vida sem ter briga: eles
   dão pouca experiência, largam sustento e troco, e não perseguem ninguém. */
mob('hare', {
  n: 'Lebre-parda', hp: 12, exp: 3, atk: [1, 3], arm: 0, sz: .35, col: 0xa08a6a, tier: 0,
  passivo: true,
  art: { shape: 'quadruped' }, meta: ['Mamífero', 'harmless'],
  loot: [['egg', 0.1], ['gold', .3, 1, 5], ['meat', .5], ['pelt', .3], ['bone', .06]]
});
mob('deer', {
  n: 'Cervo-cinzento', hp: 40, exp: 9, atk: [1, 5], arm: 1, sz: .95, col: 0x8c7355, tier: 0,
  passivo: true,
  art: { shape: 'quadruped' }, meta: ['Mamífero', 'harmless'],
  loot: [['apple', 0.12], ['gold', .35, 1, 8], ['meat', .6, 1, 2], ['pelt', .35], ['antler', .12]]
});
mob('boar', {
  n: 'Javali-de-cerdas', hp: 95, exp: 26, atk: [6, 18], arm: 4, sz: .8, col: 0x5d4a3a, tier: 1,
  passivo: true,
  art: { shape: 'quadruped' }, meta: ['Mamífero', 'trivial'],
  loot: [['apple', 0.1], ['grapes', 0.08], ['gold', .4, 2, 14], ['meat', .5, 1, 2], ['ham', .25], ['pelt', .4], ['boar_tusk', .15]]
});
mob('firefly', {
  n: 'Vaga-lume', hp: 8, exp: 2, atk: [1, 2], arm: 0, sz: .3, col: 0xd8e07a, tier: 0,
  passivo: true, noite: true, luz: 1.8,      // raio do halo em tiles, como o da tocha
  art: { shape: 'mote' }, meta: ['Inseto', 'harmless'],
  loot: [['egg', 0.08], ['gold', .25, 1, 4], ['glow_gland', .45], ['bug_shell', .1], ['health_potion', .02]]
});

/* mamíferos */
mob('cave_rat', {
  n: 'Rato de Caverna', hp: 28, exp: 9, atk: [2, 8], arm: 1, sz: .5, col: 0x59504a, tier: 0, medo: .4,
  art: { shape: 'quadruped' }, meta: ['Mamífero', 'harmless'],
  loot: [['weak_health_potion', 0.08], ['bronze_amulet', 0.04], ['torch', 0.08], ['gold', .8, 1, 14], ['rat_tail', .4, 1, 2], ['meat', .15], ['bone', .08], ['brown_mushroom', .05]]
});
mob('dire_wolf', {
  n: 'Lobo Atroz', hp: 190, exp: 125, atk: [12, 36], arm: 9, sz: .95, col: 0x4a4a54, tier: 2, medo: .2,
  art: { shape: 'quadruped' }, meta: ['Mamífero', 'easy'],
  loot: [['moonlight_rod', 0.03], ['gold', .9, 12, 70], ['wolf_paw', .35, 1, 2], ['meat', .35, 1, 2], ['bone', .2], ['bo_hood', .02], ['bo_legs', .02],
  ['health_potion', .1], ['leather_armor', .05]]
});
mob('winter_wolf', {
  n: 'Lobo Gélido', hp: 260, exp: 195, atk: [16, 46], arm: 12, sz: 1.0, col: 0xb6d0e2, tier: 3, medo: .25,
  hab: { tipo: 'lento', r: 2, lento: .4, dur: 5000, dano: [12, 30], cd: 12000, el: 'ice', col: 0x9fe4ff, grito: 'Auuuuu!' },
  art: { shape: 'quadruped' }, meta: ['Mamífero', 'medium'],
  loot: [['gold', .9, 18, 100], ['wolf_paw', .35, 1, 2], ['meat', .3], ['small_sapphire', .03], ['bo_boots', .02], ['bo_staff', .012],
  ['white_pearl', .04], ['strong_health_potion', .08]]
});

/* orcs — a tribo ganha quem cura, quem enlouquece e quem manda */
mob('orc_shaman', {
  n: 'Orc Xamã', hp: 95, exp: 78, atk: [5, 16], arm: 5, sz: .8, col: 0x5f7f3a, tier: 2, medo: .3,
  ranged: { min: 16, max: 42, range: 5, col: 0x9f5aff, el: 'death', recua: true },
  hab: { tipo: 'cura', val: 60, cd: 14000, col: 0x8fdc8f, grito: 'Ug rak zul!' },
  art: { shape: 'biped', o: { skin: 0x7a9a4a, weapon: 0x6a4a7a, eyes: 0xc98bdd } }, meta: ['Humanoide', 'easy'],
  loot: [['rune_ih', 0.06], ['wand_of_vortex', 0.04], ['energy_ring', 0.03], ['brasa_wand', 0.05], ['gold', .9, 10, 60], ['orc_tooth', .3], ['mana_potion', .2], ['rune_hmm', .05],
  ['elven_amulet', .03], ['studded_armor', .05]]
});
mob('orc_berserker', {
  n: 'Orc Berserker', hp: 145, exp: 105, atk: [14, 42], arm: 5, sz: .9, col: 0x8a6a3a, tier: 2,
  art: { shape: 'biped', o: { skin: 0x9a8a4a, eyes: 0xff4444, weapon: 0x8a5a3a } }, meta: ['Humanoide', 'easy'],
  loot: [['cheese', 0.1], ['bread', 0.08], ['axe_ring', 0.03], ['viking_helmet', 0.05], ['gold', .9, 12, 70], ['orc_tooth', .35], ['meat', .25], ['battle_axe', .05], ['studded_legs', .07]]
});
mob('orc_warlord', {
  n: 'Senhor da Guerra Orc', hp: 300, exp: 235, atk: [20, 58], arm: 16, sz: 1.05, col: 0x4f6f2a, tier: 3, medo: .12,
  hab: { tipo: 'area', r: 2, dano: [20, 50], cd: 11000, col: 0xc9a05a, grito: 'PARA A GUERRA!' },
  art: { shape: 'biped', o: { skin: 0x6f8f3a, weapon: 0x9aa0a8, shield: 0x7a5a3a } }, meta: ['Humanoide', 'medium'],
  loot: [['morning_star', 0.04], ['gold', .95, 25, 140], ['orc_tooth', .4, 1, 2], ['iron_ore', .15], ['barbarian_axe', .05],
  ['viking_shield', .06], ['plate_armor', .04]]
});

/* mortos-vivos */
mob('skeleton_warrior', {
  n: 'Esqueleto Guerreiro', hp: 165, exp: 108, atk: [12, 36], arm: 14, sz: .85, col: 0xc8c0a8, tier: 2,
  art: { shape: 'biped', o: { thin: true, skin: 0xe8e2d0, eyes: 0xff4444, weapon: 0x9aa0a8, shield: 0x8a7a4a } },
  meta: ['Morto-vivo', 'easy'],
  loot: [['sword_ring', 0.03], ['clerical_mace', 0.04], ['gold', .9, 12, 70], ['bone', .5, 1, 3], ['skull', .2], ['short_sword', .07],
  ['brass_shield', .05], ['chain_armor', .05]]
});
mob('skeleton_archer', {
  n: 'Esqueleto Arqueiro', hp: 130, exp: 96, atk: [6, 18], arm: 9, sz: .8, col: 0xd8d0b8, tier: 2,
  ranged: { min: 14, max: 40, range: 6, col: 0xd9c48a, recua: true },
  art: { shape: 'biped', o: { thin: true, skin: 0xe0dac6, eyes: 0xffee88, weapon: 0x8a6a3a } },
  meta: ['Morto-vivo', 'easy'],
  loot: [['arbalest', 0.03], ['gold', .9, 10, 60], ['bone', .45, 1, 3], ['arrow', .35, 5, 20], ['bolt', .2, 3, 10],
  ['short_bow', .07], ['studded_armor', .05]]
});
mob('necrophage', {
  n: 'Necrófago', hp: 230, exp: 165, atk: [14, 42], arm: 13, sz: .9, col: 0x5f7050, tier: 3,
  hab: { tipo: 'lento', r: 2, lento: .45, dur: 6000, dano: [10, 24], cd: 13000, col: 0x8fbf6a, grito: 'Hrrgghh...' },
  art: { shape: 'biped', o: { skin: 0x7a8a60, eyes: 0xffee88 } }, meta: ['Morto-vivo', 'medium'],
  loot: [['rune_ih', 0.05], ['ruby_necklace', 0.03], ['wand_of_decay', 0.04], ['umbral_wand', 0.05], ['gold', .9, 16, 92], ['rotten_flesh', .4], ['skull', .2], ['black_pearl', .04],
  ['brass_armor', .05], ['strong_health_potion', .08]]
});
mob('lich', {
  n: 'Lich', hp: 620, exp: 640, atk: [18, 50], arm: 22, sz: .95, col: 0x6a4a8a, tier: 5,
  ranged: { min: 55, max: 140, range: 7, col: 0x9f5aff, el: 'death', recua: true },
  hab: { tipo: 'cura', val: 130, cd: 14000, col: 0xc98bdd, grito: 'Mors non est finis!' },
  art: { shape: 'biped', o: { thin: true, skin: 0xd8d0c0, eyes: 0x9f5aff, weapon: 0x9f5aff } },
  meta: ['Morto-vivo', 'hard'],
  loot: [['rune_sd', 0.04], ['rune_uh', 0.05], ['blue_robe', 0.05], ['platinum_amulet', 0.02], ['gold', .95, 60, 320], ['skull', .4], ['bone', .35, 1, 4], ['small_sapphire', .08],
  ['blue_gem', .03], ['skull_staff', .04], ['great_mana_potion', .12]]
});

/* aracnídeos e insetos */
mob('poison_spider', {
  n: 'Aranha Venenosa', hp: 105, exp: 62, atk: [8, 26], arm: 8, sz: .7, col: 0x4a6a2a, tier: 2,
  hab: { tipo: 'lento', r: 2, lento: .35, dur: 6000, dano: [8, 20], cd: 12000, col: 0x8fd14a, grito: 'ssshh' },
  art: { shape: 'arachnid' }, meta: ['Aracnídeo', 'easy'],
  loot: [['silver_amulet', 0.04], ['snakebite_rod', 0.04], ['gold', .8, 6, 44], ['spider_silk', .22], ['health_potion', .1], ['studded_helmet', .05], ['arrow', .15, 3, 12]]
});
mob('tarantula', {
  n: 'Tarântula', hp: 240, exp: 178, atk: [16, 46], arm: 14, sz: .95, col: 0x6a4a2a, tier: 3,
  art: { shape: 'arachnid' }, meta: ['Aracnídeo', 'medium'],
  loot: [['ruby_necklace', 0.03], ['fullmoon_rod', 0.05], ['gold', .9, 18, 105], ['spider_silk', .3], ['bug_shell', .2], ['white_pearl', .05],
  ['plate_legs', .03], ['strong_health_potion', .08]]
});
mob('fire_beetle', {
  n: 'Besouro de Fogo', hp: 70, exp: 32, atk: [5, 18], arm: 8, sz: .6, col: 0xb0402a, tier: 1,
  hab: { tipo: 'area', r: 1, dano: [10, 26], cd: 12000, el: 'fire', col: 0xff7a20, grito: '*estala*' },
  art: { shape: 'arachnid' }, meta: ['Inseto', 'trivial'],
  loot: [['gold', .8, 3, 26], ['bug_shell', .35], ['meat', .1], ['health_potion', .06], ['rune_explosion', .02]]
});
mob('carrion_worm', {
  n: 'Verme Carniceiro', hp: 300, exp: 195, atk: [16, 48], arm: 18, sz: .95, col: 0x8a4a3a, tier: 3,
  art: { shape: 'worm' }, meta: ['Inseto', 'medium'],
  loot: [['gold', .9, 20, 110], ['worm_slime', .4, 1, 2], ['rotten_flesh', .3], ['bone', .2],
  ['ham', .2], ['war_hammer', .02]]
});

/* répteis */
mob('cobra', {
  n: 'Naja', hp: 60, exp: 27, atk: [4, 16], arm: 4, sz: .55, col: 0x8a7a2a, tier: 1, medo: .3,
  art: { shape: 'serpent' }, meta: ['Réptil', 'trivial'],
  loot: [['scale_armor', 0.06], ['snakebite_rod', 0.04], ['gold', .75, 3, 24], ['snake_hide', .35], ['meat', .12], ['health_potion', .07], ['brown_mushroom', .06]]
});
mob('serpent_spawn', {
  n: 'Serpe Anciã', hp: 780, exp: 840, atk: [30, 88], arm: 26, sz: 1.5, col: 0x2a6a5a, tier: 5,
  ranged: { min: 45, max: 120, range: 6, col: 0x7ac24a, el: 'earth' },
  hab: { tipo: 'area', r: 3, dano: [38, 92], cd: 9500, el: 'earth', col: 0x7ac24a, grito: 'SSSHAAAA!' },
  art: { shape: 'serpent' }, meta: ['Réptil', 'hard'],
  loot: [['gold', .98, 70, 360], ['snake_hide', .5, 1, 3], ['tentacle', .3], ['green_gem', .04], ['small_sapphire', .08],
  ['terra_rod', .04], ['dragon_ham', .2], ['great_health_potion', .15]]
});

/* anões */
mob('dwarf_guard', {
  n: 'Anão Guardião', hp: 300, exp: 205, atk: [16, 50], arm: 22, sz: .75, col: 0x9a7a3a, tier: 3, medo: .1,
  art: { shape: 'biped', o: { skin: 0xd8b98a, weapon: 0x9aa0a8, shield: 0xb08a4a } }, meta: ['Humanoide', 'medium'],
  loot: [['cheese', 0.1], ['grapes', 0.08], ['bright_sword', 0.03], ['halberd', 0.03], ['guardian_shield', 0.02], ['steel_crossbow', 0.02], ['gold', .95, 22, 130], ['iron_ore', .35], ['small_ruby', .04], ['dwarven_shield', .04],
  ['plate_armor', .04], ['health_potion', .12],
  ['gg_helmet', .01], ['gg_armor', .01], ['gg_shield', .012], ['gg_halberd', .008], ['gg_greatsword', .008]]
});
mob('dwarf_geomancer', {
  n: 'Anão Geomante', hp: 210, exp: 190, atk: [8, 24], arm: 14, sz: .7, col: 0x7a6a9a, tier: 3, medo: .25,
  ranged: { min: 30, max: 80, range: 6, col: 0x8ac24a, el: 'earth', recua: true },
  art: { shape: 'biped', o: { skin: 0xd8b98a, weapon: 0x8ac24a, eyes: 0x8ac24a } }, meta: ['Humanoide', 'medium'],
  loot: [['rune_avalanche', 0.05], ['rune_ih', 0.05], ['grove_rod', 0.05], ['gold', .95, 20, 120], ['iron_ore', .3], ['small_sapphire', .04], ['dwarven_ring', .03],
  ['mana_potion', .2], ['springsprout_rod', .03],
  ['gg_amulet', .012], ['gg_ring', .012], ['gg_maul', .008], ['gg_greataxe', .008]]
});

/* minotauros e gigantes */
mob('minotaur_mage', {
  n: 'Minotauro Mago', hp: 290, exp: 265, atk: [10, 30], arm: 14, sz: 1.0, col: 0x8a4a6a, tier: 4, medo: .25,
  ranged: { min: 35, max: 95, range: 6, col: 0xff7a20, el: 'fire', recua: true },
  hab: { tipo: 'area', r: 2, dano: [28, 66], cd: 11000, el: 'fire', col: 0xff7a20, grito: 'Mor gah!' },
  art: { shape: 'biped', o: { horns: true, skin: 0x9a5a6a, weapon: 0xff7a20, eyes: 0xff7a20 } },
  meta: ['Humanoide', 'hard'],
  loot: [['rune_gfb', 0.06], ['rune_ih', 0.04], ['blue_robe', 0.03], ['wand_of_cosmic_energy', 0.04], ['crescent_rod', 0.05], ['ossuary_staff', 0.03], ['gold', .95, 25, 140], ['minotaur_leather', .3], ['minotaur_horn', .1], ['mana_potion', .25],
  ['wand_of_dragonbreath', .03], ['elven_amulet', .05]]
});
mob('minotaur_guard', {
  n: 'Minotauro Guarda', hp: 420, exp: 335, atk: [22, 66], arm: 24, sz: 1.15, col: 0x6a3a2a, tier: 4,
  art: { shape: 'biped', o: { horns: true, skin: 0x8a4a34, weapon: 0x9aa0a8, shield: 0x7a6a4a } },
  meta: ['Humanoide', 'hard'],
  loot: [['grapes', 0.1], ['cheese', 0.08], ['bright_sword', 0.03], ['halberd', 0.03], ['gold', .95, 32, 180], ['minotaur_leather', .35, 1, 2], ['minotaur_horn', .12], ['ham', .3], ['gl_boots', .025], ['gl_sword', .012], ['gl_mace', .012],
  ['spike_sword', .04], ['knight_legs', .03], ['tower_shield', .02]]
});
mob('cyclops_smith', {
  n: 'Ciclope Ferreiro', hp: 420, exp: 335, atk: [22, 66], arm: 26, sz: 1.3, col: 0x5a6a7a, tier: 4,
  hab: { tipo: 'area', r: 2, dano: [26, 60], cd: 11000, col: 0xffa53a, grito: 'MARTELA!' },
  art: { shape: 'biped', o: { skin: 0x7a7a6a, eyes: 0xffcc44, weapon: 0x9aa0a8 } }, meta: ['Gigante', 'hard'],
  loot: [['crown_armor', 0.02], ['crown_legs', 0.02], ['gold', .95, 40, 220], ['cyclops_toe', .3], ['cyclops_eye', .18], ['iron_ore', .3], ['gold_ingot', .03],
  ['war_hammer', .05], ['steel_helmet', .06], ['plate_armor', .05]]
});

/* dragões e demônios */
mob('dragon_hatchling', {
  n: 'Filhote de Dragão', hp: 320, exp: 265, atk: [16, 48], arm: 16, sz: .95, col: 0x4aa05a, tier: 3, medo: .2,
  ranged: { min: 22, max: 60, range: 5, col: 0xff8020, el: 'fire' },
  art: { shape: 'dragon' }, meta: ['Dragão', 'medium'],
  loot: [['gold', .95, 25, 140], ['dragon_scale', .2], ['dragon_ham', .2], ['meat', .2],
  ['health_potion', .12], ['serpent_sword', .03]]
});
mob('frost_dragon', {
  n: 'Dragão Gélido', hp: 1500, exp: 1750, atk: [40, 126], arm: 32, sz: 1.7, col: 0x7ac4e0, tier: 6,
  ranged: { min: 75, max: 190, range: 7, col: 0x9fe4ff, el: 'ice' },
  hab: { tipo: 'area', r: 4, dano: [58, 138], cd: 8000, el: 'ice', col: 0x9fe4ff, grito: 'GRAAAWR!' },
  art: { shape: 'dragon' }, meta: ['Dragão', 'challenging'],
  loot: [['rune_avalanche', 0.08], ['horned_helmet', 0.02], ['gold', .99, 130, 640], ['dragon_scale', .45, 1, 2], ['small_sapphire', .12], ['gold_ingot', .08], ['fn_helmet', .02], ['fn_legs', .02],
  ['hailstorm_rod', .04], ['tower_shield', .05], ['great_mana_potion', .2]]
});
mob('fire_devil', {
  n: 'Diabrete', hp: 380, exp: 335, atk: [20, 60], arm: 20, sz: .85, col: 0xc04a2a, tier: 4,
  ranged: { min: 30, max: 85, range: 5, col: 0xff7a20, el: 'fire' },
  art: { shape: 'biped', o: { horns: true, wings: true, skin: 0xc0502a, eyes: 0xffdd00, hornCol: 0x2a0a12, weapon: 0xff6a20 } },
  meta: ['Demônio', 'hard'],
  loot: [['rune_gfb', 0.06], ['wand_of_inferno', 0.04], ['flame_trident', 0.04], ['gold', .95, 40, 230], ['demon_dust', .15], ['small_ruby', .05], ['talon', .03], ['ch_hood', .02],
  ['great_health_potion', .1], ['fire_sword', .02]]
});

/* ---- chefes: um por hunt, no centro dela -------------------------------
   O que separa chefe de "bicho grande" é que ele tem nome próprio, mora num
   lugar só e não volta em um minuto — matar um é um acontecimento, não uma
   linha de grind. Todos são a criatura-tema da região levada ao extremo, com a
   habilidade dela num raio maior; nenhum tem `medo`, porque chefe que foge
   vira perseguição chata pelo mapa inteiro.
   `plateCol` é a cor do nome na cabeça: é o aviso de que aquele ali não é da
   mesma régua dos vizinhos. */
const BOSS_PLATE = '#ffb03d';
const boss = (id, d) => mob(id, Object.assign({ boss: true, plateCol: BOSS_PLATE }, d));

boss('alpha_wolf', {
  n: 'Presa-Branca, o Alfa', hp: 900, exp: 1400, atk: [22, 62], arm: 14, sz: 1.3, col: 0xe8e4dc, tier: 3,
  hab: { tipo: 'area', r: 2, dano: [24, 58], cd: 10000, col: 0xdfe8f0, grito: 'AUUUUUU!' },
  art: { shape: 'quadruped' }, meta: ['Mamífero', 'boss'],
  /* o Alfa é a porta do Caçador Ancestral: caça de floresta larga equipamento de
     caçador. Chance alta por peça porque são 8 e ele nasce um por região */
  loot: [['gold', 1, 260, 700], ['wolf_paw', 1, 2, 4], ['dragon_ham', .5], ['boots_of_haste', .12],
  ['bo_hood', .16], ['bo_armor', .12], ['bo_legs', .14], ['bo_boots', .16], ['bo_shield', .14], ['bo_staff', .1],
  ['time_ring', .2], ['leather_armor', .4], ['strong_health_potion', .6, 1, 3],
  ['ah_hood', .16], ['ah_armor', .13], ['ah_legs', .15], ['ah_boots', .16],
  ['ah_shield', .14], ['ah_amulet', .15], ['ah_ring', .15], ['ah_bow', .12]]
});
boss('orc_warchief', {
  n: 'Gruk, Chefe de Guerra', hp: 1400, exp: 2200, atk: [30, 84], arm: 22, sz: 1.35, col: 0x3f5f1a, tier: 4,
  hab: { tipo: 'area', r: 3, dano: [34, 78], cd: 9000, col: 0xc9a05a, grito: 'MATEM TODOS!' },
  art: { shape: 'biped', o: { skin: 0x5f7f2a, eyes: 0xff4444, weapon: 0x9aa0a8, shield: 0x7a5a3a } },
  meta: ['Humanoide', 'boss'],
  loot: [['gold', 1, 400, 1000], ['orc_tooth', 1, 3, 6], ['barbarian_axe', .25], ['viking_shield', .3],
  ['noble_armor', .15], ['might_ring', .18], ['strong_health_potion', .6, 1, 3],
  ['fs_hood', .14], ['fs_armor', .11], ['fs_legs', .13], ['fs_boots', .14],
  ['fs_shield', .12], ['fs_amulet', .13], ['fs_ring', .13], ['fs_bow', .10]]
});
boss('bone_lord', {
  n: 'Osgar, Senhor dos Ossos', hp: 1800, exp: 2900, atk: [32, 92], arm: 26, sz: 1.3, col: 0xb8ae90, tier: 5,
  ranged: { min: 50, max: 130, range: 7, col: 0x9f5aff, el: 'death' },
  hab: { tipo: 'cura', val: 260, cd: 13000, col: 0xc98bdd, grito: 'Ossos não morrem!' },
  art: { shape: 'biped', o: { thin: true, skin: 0xe8e2d0, eyes: 0x9f5aff, weapon: 0x9f5aff } },
  meta: ['Morto-vivo', 'boss'],
  /* o Escudeiro Nobre sai daqui: a cripta é onde os cavaleiros que falharam
     ficaram, e o Senhor dos Ossos guarda o que sobrou deles */
  loot: [['gold', 1, 500, 1300], ['skull', 1, 3, 6], ['bone', 1, 4, 9], ['black_pearl', .5, 1, 2],
  ['skull_staff', .2], ['ring_of_healing', .18], ['crown_helmet', .12], ['strong_mana_potion', .6, 1, 3],
  ['ns_helmet', .14], ['ns_armor', .11], ['ns_legs', .13], ['ns_boots', .14],
  ['ns_shield', .12], ['ns_amulet', .13], ['ns_ring', .13], ['ns_sword', .10]]
});
boss('hive_queen', {
  n: 'Rainha do Enxame', hp: 1100, exp: 1700, atk: [26, 70], arm: 24, sz: 1.45, col: 0x7a6a1a, tier: 4,
  hab: { tipo: 'lento', r: 3, lento: .5, dur: 7000, dano: [20, 48], cd: 10000, col: 0x8fd14a, grito: 'kkkrrRRK!' },
  art: { shape: 'arachnid' }, meta: ['Inseto', 'boss'],
  loot: [['gold', 1, 300, 800], ['bug_shell', 1, 3, 6], ['spider_silk', .7, 1, 3], ['white_pearl', .4, 1, 2],
  ['elven_amulet', .2], ['brass_armor', .3], ['strong_health_potion', .5, 1, 2],
  ['ai_hood', .16], ['ai_armor', .13], ['ai_legs', .15], ['ai_boots', .16],
  ['ai_tome', .14], ['ai_amulet', .15], ['ai_ring', .15], ['ai_staff', .12]]
});
boss('dwarf_king', {
  n: 'Durnak, Rei sob a Pedra', hp: 2200, exp: 3400, atk: [36, 100], arm: 34, sz: 1.1, col: 0xc9a13a, tier: 5,
  hab: { tipo: 'area', r: 3, dano: [40, 92], cd: 9000, col: 0xffa53a, grito: 'PELA FORJA!' },
  art: { shape: 'biped', o: { skin: 0xd8b98a, eyes: 0xffcc44, weapon: 0xffd070, shield: 0xc9a13a } },
  meta: ['Humanoide', 'boss'],
  /* o Rei é o atalho do conjunto: larga qualquer peça e com chance de verdade,
     porque ele nasce um por região e só volta em 10 minutos — sem isso, fechar
     as 14 peças no 1% dos anões comuns viraria um mês de mina */
  loot: [['gold', 1, 600, 1500], ['iron_ore', 1, 3, 6], ['gold_ingot', .5, 1, 2], ['small_ruby', .5, 1, 2],
  ['dwarven_shield', .3], ['golden_armor', .1], ['steel_boots', .18], ['great_health_potion', .5, 1, 2],
  ['gg_helmet', .1], ['gg_armor', .1], ['gg_legs', .1], ['gg_boots', .1], ['gg_shield', .12],
  ['gg_amulet', .12], ['gg_ring', .12], ['gg_mace', .06], ['gg_sword', .06], ['gg_axe', .06],
  ['gg_halberd', .06], ['gg_maul', .06], ['gg_greatsword', .06], ['gg_greataxe', .06]]
});
boss('minotaur_king', {
  n: 'Amaruk, Rei Minotauro', hp: 2600, exp: 4200, atk: [42, 116], arm: 32, sz: 1.6, col: 0x7a2a1a, tier: 5,
  hab: { tipo: 'area', r: 3, dano: [46, 106], cd: 8500, col: 0xff8a3a, grito: 'AJOELHE-SE!' },
  art: { shape: 'biped', o: { horns: true, skin: 0x9a3a24, eyes: 0xff4444, weapon: 0xffd070, hornCol: 0x2a1a12 } },
  meta: ['Humanoide', 'boss'],
  loot: [['gold', 1, 700, 1800], ['minotaur_horn', 1, 2, 4], ['minotaur_leather', 1, 3, 6], ['small_diamond', .35], ['guardian_halberd', .15],
  ['gl_helmet', .16], ['gl_armor', .12], ['gl_legs', .14], ['gl_boots', .16], ['gl_shield', .14], ['gl_sword', .1], ['gl_mace', .1],
  ['giant_sword', .12], ['warrior_helmet', .15], ['knight_armor', .12], ['great_health_potion', .6, 1, 3]]
});
boss('cyclops_king', {
  n: 'Brontes, o Ogro-Rei', hp: 2000, exp: 3000, atk: [40, 110], arm: 30, sz: 1.75, col: 0x6a5a48, tier: 5,
  hab: { tipo: 'area', r: 3, dano: [44, 100], cd: 9000, col: 0xc9a05a, grito: 'ESMAGA TUDO!' },
  art: { shape: 'biped', o: { skin: 0x8a7a64, eyes: 0xffcc44, weapon: 0x6a5a4a } }, meta: ['Gigante', 'boss'],
  loot: [['gold', 1, 550, 1400], ['cyclops_toe', 1, 2, 5], ['cyclops_eye', .8, 1, 2], ['bone', .8, 3, 7], ['gold_ingot', .25], ['guardian_halberd', .18],
  ['thunder_hammer', .08], ['tower_shield', .18], ['royal_helmet', .12], ['great_health_potion', .5, 1, 2]]
});
boss('broodmother', {
  n: 'Mãe das Ninhadas', hp: 3200, exp: 5200, atk: [48, 130], arm: 30, sz: 1.75, col: 0x2a1a34, tier: 6,
  hab: { tipo: 'lento', r: 4, lento: .6, dur: 8000, dano: [40, 96], cd: 9000, col: 0xcfd6e0, grito: 'SSSSSSS!' },
  art: { shape: 'arachnid' }, meta: ['Aracnídeo', 'boss'],
  loot: [['gold', 1, 800, 2000], ['spider_silk', 1, 4, 8], ['black_pearl', .8, 2, 4], ['talon', .25],
  ['vampire_shield', .1], ['soft_boots', .1], ['life_ring', .3], ['great_health_potion', .7, 1, 3]]
});
boss('dragon_matriarch', {
  n: 'Escamas-de-Fogo, a Matriarca', hp: 4200, exp: 7000, atk: [55, 150], arm: 34, sz: 1.9, col: 0xd8721a, tier: 6,
  ranged: { min: 90, max: 220, range: 7, col: 0xff6a10, el: 'fire' },
  hab: { tipo: 'area', r: 4, dano: [66, 158], cd: 8000, el: 'fire', col: 0xff6a10, grito: 'GRAAAAAWR!' },
  art: { shape: 'dragon' }, meta: ['Dragão', 'boss'],
  loot: [['gold', 1, 1100, 2600], ['dragon_head', .9], ['red_dragon_scale', 1, 2, 5], ['dragon_scale', 1, 3, 6], ['small_diamond', .6, 1, 2],
  ['dragon_scale_mail', .12], ['fire_sword', .15], ['dragon_necklace', .35], ['great_health_potion', .8, 2, 4]]
});
boss('demon_lord', {
  n: 'Zathrax, Senhor do Fosso', hp: 8000, exp: 15000, atk: [80, 240], arm: 44, sz: 2.1, col: 0x5a0820, tier: 7,
  ranged: { min: 140, max: 320, range: 8, col: 0xff2060, el: 'death' },
  hab: { tipo: 'area', r: 5, dano: [100, 240], cd: 6500, el: 'death', col: 0xff2060, grito: 'AJOELHE-SE OU MORRA!' },
  art: { shape: 'biped', o: { horns: true, wings: true, skin: 0x7a0a24, eyes: 0xffdd00, hornCol: 0x1a050a, weapon: 0xff2060 } },
  meta: ['Demônio', 'boss'],
  loot: [['gold', 1, 2000, 5000], ['demon_horn', 1, 2, 4], ['demon_wing', .8, 1, 2], ['demon_skull', .7], ['demon_dust', 1, 3, 6], ['gold_ingot', .8, 2, 4],
  ['magic_plate_armor', .12], ['demon_helmet', .18], ['magic_sword', .12], ['royal_crossbow', .12],
  ['great_health_potion', 1, 3, 6]]
});

/* ================== lote 3: o que mora abaixo do Abismo ====================
   O jogo terminava no Fosso Demoníaco (nível 80) e um personagem de 60 já
   passava por cima dele. Daqui pra baixo a régua muda de escala: os andares
   Fenda (-3) e Coração (-4) são o endgame, e cada família resolve o combate de
   um jeito que as antigas não resolviam —
     Elemental  troca de magia importa mais que bater mais (imune ao próprio
                elemento, rasgado pelo oposto);
     Aberração  come mana e enxerga através da parede — o mago perde o escudo
                mágico como muleta e passa a ter de escolher a hora de gastar;
     Celeste    o espelho do morto-vivo: o sagrado não arranha, a morte rasga.
   E as três dão ao bestiário classe nova pra encher, o que vale para os charms.

   `fase`: chefe grande troca de habilidade abaixo de uma fração da vida. É a
   diferença entre "saco de vida" e briga que se aprende — o jogador que decorou
   a primeira metade descobre no meio que precisa de outro plano. Só chefe tem. */

/* ---- elementais: a mesma ficha, quatro elementos, quatro respostas certas -- */
const elemental = (id, el, oposto, d) => {
  const { diff = 'hard', ...st } = d;
  mob(id, Object.assign({
    sz: 1.3,
    art: { shape: 'biped', o: { skin: d.col, eyes: 0xffffff } },
    res: { [el]: 0, [oposto]: 1.7, physical: .6, death: .5, holy: 1.1 }
  }, st, { meta: ['Elemental', diff] }));
};

elemental('fire_elemental', 'fire', 'ice', {
  n: 'Elemental de Fogo', hp: 2100, exp: 2900, atk: [66, 190], arm: 30, col: 0xff6a10, tier: 7,
  ranged: { min: 80, max: 200, range: 6, col: 0xff8020, el: 'fire' },
  hab: { tipo: 'area', r: 3, dano: [70, 170], cd: 8000, el: 'fire', col: 0xff8020, grito: 'FSSSHHH' },
  loot: [['gold', .95, 300, 900], ['ember_core', .5], ['red_dragon_scale', .12], ['small_ruby', .2],
  ['great_health_potion', .5, 1, 2], ['fire_sword', .04], ['sa_boots', .03], ['void_wand', .05]]
});
elemental('ice_elemental', 'ice', 'fire', {
  n: 'Elemental de Gelo', hp: 3200, exp: 4600, atk: [92, 250], arm: 38, col: 0x9fe4ff, tier: 8,
  hab: { tipo: 'lento', r: 3, lento: .55, dur: 7000, dano: [70, 180], cd: 9000, el: 'ice', col: 0x9fe4ff, grito: 'krrrrk' },
  loot: [['gold', .95, 450, 1300], ['frozen_core', .5], ['small_sapphire', .25], ['white_pearl', .3],
  ['supreme_health_potion', .4, 1, 2], ['sa_helmet', .03], ['sa_ring', .04], ['glacier_rod', .06]]
});
elemental('storm_elemental', 'energy', 'earth', {
  n: 'Elemental de Tempestade', hp: 5600, exp: 13500, atk: [150, 400], arm: 52, col: 0x7fb8ff, tier: 9, diff: 'nightmare',
  ranged: { min: 170, max: 420, range: 7, col: 0x7fb8ff, el: 'energy' },
  hab: { tipo: 'area', r: 4, dano: [160, 380], cd: 7000, el: 'energy', col: 0x7fb8ff, grito: 'KRAKKKK' },
  loot: [['gold', .95, 1200, 3200], ['storm_core', .5], ['void_shard', .12], ['small_diamond', .3],
  ['ultimate_mana_potion', .5, 1, 3], ['vz_boots', .02], ['vz_ring', .03]]
});

/* ---- a forja infernal (Abismo, nível 100): o degrau logo acima do demônio -- */
mob('hellhound', {
  n: 'Cão do Inferno', hp: 2800, exp: 3400, atk: [72, 210], arm: 36, sz: 1.2, col: 0x8a2a10, tier: 7,
  ranged: { min: 70, max: 175, range: 5, col: 0xff6a10, el: 'fire' },
  art: { shape: 'quadruped' }, meta: ['Demônio', 'hard'],
  loot: [['gold', .95, 320, 950], ['ember_core', .3], ['demon_dust', .25], ['meat', .4, 1, 3], ['ch_boots', .03], ['ch_staff', .015],
  ['great_health_potion', .5, 1, 2], ['talon', .06]]
});
mob('hellfire_fighter', {
  n: 'Lutador do Fogo Infernal', hp: 2300, exp: 3000, atk: [58, 165], arm: 30, sz: 1.15, col: 0xd0421a, tier: 7, medo: .1,
  ranged: { min: 90, max: 230, range: 6, col: 0xff8020, el: 'fire', recua: true },
  hab: { tipo: 'area', r: 2, dano: [66, 155], cd: 9000, el: 'fire', col: 0xff8020, grito: 'QUEIME!' },
  art: { shape: 'biped', o: { horns: true, skin: 0xc0381a, eyes: 0xffdd00, weapon: 0xff6a10, hornCol: 0x2a0a08 } },
  meta: ['Demônio', 'hard'],
  loot: [['verdant_rod', 0.04], ['gold', .95, 300, 880], ['ember_core', .28], ['demon_dust', .3], ['small_ruby', .12],
  ['great_mana_potion', .5, 1, 3], ['sa_rod', .02]]
});
mob('destroyer', {
  n: 'Destruidor', hp: 3400, exp: 4200, atk: [95, 265], arm: 48, sz: 1.45, col: 0x5a3a2a, tier: 8,
  hab: { tipo: 'area', r: 2, dano: [80, 200], cd: 8500, col: 0xc9a05a, grito: 'DESTRUIR!' },
  art: { shape: 'biped', o: { horns: true, skin: 0x6a4030, eyes: 0xff4444, weapon: 0x8a8a92, hornCol: 0x1a1008 } },
  meta: ['Demônio', 'challenging'],
  loot: [['arcane_eye_wand', 0.04], ['gold', .95, 420, 1200], ['demon_horn', .2], ['demon_dust', .4, 1, 2], ['iron_ore', .3, 1, 3],
  ['supreme_health_potion', .4, 1, 2], ['sa_axe', .02], ['sa_shield', .03], ['void_wand', .04]]
});

/* ---- a cripta gélida (Fenda, nível 130) ----------------------------------- */
mob('frost_giant', {
  n: 'Gigante do Gelo', hp: 3800, exp: 5400, atk: [115, 300], arm: 54, sz: 1.7, col: 0xa8c8dd, tier: 8, medo: .1,
  hab: { tipo: 'lento', r: 3, lento: .5, dur: 6000, dano: [90, 220], cd: 9500, el: 'ice', col: 0x9fe4ff, grito: 'CONGELE!' },
  art: { shape: 'biped', o: { skin: 0xb8d4e8, eyes: 0x5aa9ff, weapon: 0x8a8a92 } }, meta: ['Gigante', 'challenging'],
  loot: [['gold', .95, 500, 1500], ['frozen_core', .35], ['bone', .6, 2, 5], ['small_sapphire', .2], ['fn_boots', .03], ['fn_staff', .015], ['wind_rod', .05],
  ['supreme_health_potion', .45, 1, 2], ['sa_maul', .02], ['sa_legs', .03], ['glacier_rod', .05]]
});
mob('undead_dragon', {
  n: 'Dragão Morto-Vivo', hp: 4600, exp: 7200, atk: [125, 335], arm: 50, sz: 1.85, col: 0x6a6a5a, tier: 9,
  ranged: { min: 130, max: 330, range: 7, col: 0x9f5aff, el: 'death' },
  hab: { tipo: 'area', r: 4, dano: [120, 290], cd: 8000, el: 'death', col: 0x9f5aff, grito: 'GRRRAAAAH!' },
  art: { shape: 'dragon' }, meta: ['Morto-vivo', 'challenging'],
  loot: [['gold', .95, 700, 1900], ['soul_shard', .3], ['dragon_scale', .5, 1, 3], ['skull', .5, 1, 3],
  ['supreme_mana_potion', .5, 1, 3], ['sa_armor', .025], ['sa_sword', .02]]
});

/* ---- a necrópole (Fenda, nível 160) --------------------------------------- */
mob('banshee', {
  n: 'Banshee', hp: 3000, exp: 5000, atk: [95, 250], arm: 34, sz: 1.15, col: 0xc8b8e8, tier: 8, medo: .2,
  ranged: { min: 120, max: 300, range: 7, col: 0x9f5aff, el: 'death', recua: true },
  hab: { tipo: 'lento', r: 4, lento: .45, dur: 6000, dano: [80, 190], cd: 10000, el: 'death', col: 0xc8b8e8, grito: 'IIIIIIIH!' },
  art: { shape: 'biped', o: { thin: true, skin: 0xd8c8f0, eyes: 0x9f5aff } }, meta: ['Morto-vivo', 'challenging'],
  loot: [['rune_sd', 0.05], ['rune_uh', 0.06], ['gold', .95, 520, 1500], ['soul_shard', .3], ['black_pearl', .3], ['white_pearl', .35], ['cs_boots', .03], ['cs_staff', .015], ['storm_staff', .05],
  ['supreme_mana_potion', .5, 1, 2], ['sa_amulet', .03], ['spectral_bow', .04]]
});
mob('vampire_lord', {
  n: 'Lorde Vampiro', hp: 3600, exp: 5800, atk: [110, 290], arm: 44, sz: 1.25, col: 0x4a1020, tier: 8,
  hab: { tipo: 'cura', val: 900, cd: 13000, col: 0xff5555, grito: 'Seu sangue é meu.' },
  art: { shape: 'biped', o: { thin: true, skin: 0xd8c0c0, eyes: 0xff2020, weapon: 0x8a1020 } },
  meta: ['Morto-vivo', 'challenging'],
  loot: [['rune_sd', 0.06], ['rune_uh', 0.06], ['gold', .95, 600, 1700], ['soul_shard', .28], ['vampire_shield', .06], ['small_ruby', .25], ['cs_hood', .025], ['cs_tome', .02], ['soul_wand', .05],
  ['supreme_health_potion', .5, 1, 2], ['sa_ring', .03], ['sa_bow', .02]]
});
mob('soul_eater', {
  n: 'Devorador de Almas', hp: 4400, exp: 7600, atk: [135, 350], arm: 46, sz: 1.5, col: 0x3a1050, tier: 9,
  ranged: { min: 140, max: 340, range: 6, col: 0xc78bff, el: 'death' },
  hab: { tipo: 'mana', val: 220, r: 5, cd: 11000, col: 0xc78bff, grito: 'Dê-me sua mente.' },
  art: { shape: 'biped', o: { thin: true, skin: 0x5a2070, eyes: 0xc78bff } }, meta: ['Aberração', 'challenging'],
  loot: [['gold', .95, 700, 2000], ['soul_shard', .4], ['void_shard', .08], ['small_diamond', .2], ['plague_rod', .05],
  ['supreme_mana_potion', .6, 1, 3], ['sa_helmet', .025], ['spirit_staff', .03]]
});

/* ---- a fenda do vazio (Coração, nível 200) -------------------------------- */
mob('void_crawler', {
  n: 'Rastejante do Vazio', hp: 6000, exp: 14000, atk: [160, 420], arm: 62, sz: 1.6, col: 0x2a0a40, tier: 9,
  hab: { tipo: 'lento', r: 3, lento: .6, dur: 7000, dano: [140, 330], cd: 8500, el: 'death', col: 0xc78bff, grito: 'krrKRRK' },
  art: { shape: 'arachnid' }, meta: ['Aberração', 'nightmare'],
  loot: [['frostgem_rod', 0.04], ['gold', .95, 1100, 3000], ['void_shard', .35], ['spider_silk', .6, 2, 5], ['black_pearl', .4, 1, 3],
  ['ultimate_health_potion', .4, 1, 2], ['vz_boots', .02], ['vz_amulet', .02]]
});
mob('mind_devourer', {
  n: 'Devorador de Mentes', hp: 5200, exp: 13000, atk: [145, 385], arm: 55, sz: 1.4, col: 0x50207a, tier: 9,
  ranged: { min: 180, max: 440, range: 7, col: 0xc78bff, el: 'energy', recua: true },
  hab: { tipo: 'mana', val: 400, r: 6, cd: 9000, col: 0xc78bff, grito: 'Sua mente é ruído.' },
  art: { shape: 'biped', o: { thin: true, skin: 0x6a30a0, eyes: 0xffffff } }, meta: ['Aberração', 'nightmare'],
  loot: [['gold', .95, 1000, 2800], ['tentacle', .35], ['void_shard', .3], ['storm_core', .2], ['small_diamond', .3],
  ['ultimate_mana_potion', .5, 1, 3], ['vz_crown', .015], ['vz_staff', .015]]
});
mob('hollow_one', {
  n: 'O Oco', hp: 6800, exp: 16000, atk: [180, 460], arm: 70, sz: 1.75, col: 0x141018, tier: 10,
  hab: { tipo: 'area', r: 3, dano: [170, 400], cd: 8000, el: 'death', col: 0x9f5aff, grito: '...' },
  art: { shape: 'biped', o: { skin: 0x201828, eyes: 0xff2060, weapon: 0x3a2050 } }, meta: ['Aberração', 'nightmare'],
  loot: [['time_staff', 0.04], ['gold', .95, 1400, 3600], ['void_shard', .4], ['soul_shard', .5, 1, 2], ['gold_ingot', .4, 1, 2],
  ['ultimate_health_potion', .45, 1, 2], ['vz_armor', .015], ['vz_aegis', .02], ['abyssal_ballista', .025]]
});

/* ---- a cidadela caída (Coração, nível 250) -------------------------------- */
mob('dark_paladin', {
  n: 'Paladino Renegado', hp: 7000, exp: 20000, atk: [195, 500], arm: 78, sz: 1.5, col: 0x2a2a3a, tier: 10, medo: .08,
  ranged: { min: 200, max: 480, range: 6, col: 0xfff0b0, el: 'holy' },
  hab: { tipo: 'cura', val: 2200, cd: 14000, col: 0xfff0b0, grito: 'A luz me sustenta.' },
  art: { shape: 'biped', o: { skin: 0x3a3a4a, eyes: 0xfff0b0, weapon: 0xffe9a8, shield: 0x8a8a92 } },
  meta: ['Humanoide', 'nightmare'],
  loot: [['gold', .95, 1600, 4200], ['seraph_feather', .25], ['gold_ingot', .5, 1, 3], ['small_diamond', .4],
  ['ultimate_health_potion', .5, 1, 3], ['vz_sword', .015], ['vz_maul', .015]]
});
mob('fallen_angel', {
  n: 'Anjo Caído', hp: 7500, exp: 22000, atk: [205, 520], arm: 74, sz: 1.6, col: 0xd8c088, tier: 10,
  ranged: { min: 220, max: 520, range: 7, col: 0xfff0b0, el: 'holy' },
  hab: { tipo: 'area', r: 4, dano: [190, 450], cd: 7500, el: 'holy', col: 0xfff0b0, grito: 'CAIA COMIGO!' },
  art: { shape: 'biped', o: { wings: true, skin: 0xe8d0a0, eyes: 0xfff0b0, weapon: 0xffe9a8 } },
  meta: ['Celeste', 'nightmare'],
  loot: [['light_staff', 0.035], ['gold', .95, 1800, 4600], ['seraph_feather', .35], ['void_shard', .2], ['gold_ingot', .5, 1, 3], ['blood_staff', .04],
  ['ultimate_mana_potion', .5, 1, 3], ['vz_legs', .015], ['vz_bow', .015], ['nature_staff', .03]]
});
mob('seraph_guard', {
  n: 'Guarda Serafim', hp: 8200, exp: 24000, atk: [220, 545], arm: 88, sz: 1.7, col: 0xfff0c0, tier: 10, medo: .05,
  hab: { tipo: 'area', r: 3, dano: [200, 470], cd: 8000, el: 'holy', col: 0xfff0b0, grito: 'NÃO PASSARÁS.' },
  art: { shape: 'biped', o: { wings: true, skin: 0xfff4d8, eyes: 0xffffff, weapon: 0xffe9a8, shield: 0xffe9a8 } },
  meta: ['Celeste', 'nightmare'],
  loot: [['antler_rod', 0.035], ['gold', .95, 2000, 5200], ['seraph_feather', .4, 1, 2], ['small_diamond', .5, 1, 2], ['gold_ingot', .6, 1, 3], ['celestial_rod', .04],
  ['ultimate_health_potion', .5, 1, 3], ['vz_aegis', .015], ['vz_crown', .015]]
});

/* ---- o coração do abismo (Coração, nível 320): o fim da linha ------------- */
mob('behemoth', {
  n: 'Beemote', hp: 9500, exp: 30000, atk: [230, 580], arm: 82, sz: 1.95, col: 0x4a3a2a, tier: 11,
  hab: { tipo: 'area', r: 3, dano: [220, 520], cd: 8000, col: 0xc9a05a, grito: 'RRRRAAAAH!' },
  art: { shape: 'biped', o: { horns: true, skin: 0x5a4a34, eyes: 0xff4444, weapon: 0x8a8a92, hornCol: 0x1a1008 } },
  meta: ['Gigante', 'nightmare'],
  loot: [['gold', .95, 2400, 6000], ['primordial_heart', .12], ['void_shard', .3], ['gold_ingot', .7, 2, 4],
  ['ultimate_health_potion', .6, 2, 4], ['vz_maul', .02], ['vz_axe', .02]]
});
mob('hellspawn', {
  n: 'Prole do Inferno', hp: 10000, exp: 34000, atk: [215, 545], arm: 72, sz: 1.8, col: 0x6a0818, tier: 11,
  ranged: { min: 250, max: 600, range: 8, col: 0xff2060, el: 'death' },
  hab: { tipo: 'area', r: 4, dano: [230, 540], cd: 7000, el: 'fire', col: 0xff6a10, grito: 'ARDA!' },
  art: { shape: 'biped', o: { horns: true, wings: true, skin: 0x8a0a20, eyes: 0xffdd00, hornCol: 0x1a050a, weapon: 0xff2060 } },
  meta: ['Demônio', 'nightmare'],
  loot: [['gold', .95, 2600, 6400], ['primordial_heart', .14], ['demon_horn', .6, 1, 3], ['ember_core', .5, 1, 2],
  ['ultimate_mana_potion', .6, 2, 4], ['vz_staff', .02], ['vz_ring', .025]]
});
mob('juggernaut', {
  n: 'Colosso', hp: 12500, exp: 42000, atk: [265, 640], arm: 100, sz: 2.1, col: 0x3a3a44, tier: 11,
  hab: { tipo: 'area', r: 3, dano: [250, 580], cd: 7500, col: 0x8fb8d8, grito: 'ESMAGAR.' },
  art: { shape: 'biped', o: { skin: 0x4a4a58, eyes: 0xff4444, weapon: 0x9aa0a8, shield: 0x6a6a78 } },
  meta: ['Gigante', 'nightmare'],
  loot: [['gold', .95, 3000, 7500], ['primordial_heart', .18], ['void_shard', .4], ['gold_ingot', .8, 2, 5],
  ['ultimate_health_potion', .7, 2, 5], ['vz_armor', .02], ['vz_sword', .02]]
});

/* ---- os seis chefes novos ------------------------------------------------- */
boss('forge_tyrant', {
  n: 'Ignus, Tirano da Forja', hp: 15000, exp: 30000, atk: [110, 300], arm: 55, sz: 2.0, col: 0xff5a10, tier: 8,
  ranged: { min: 150, max: 360, range: 7, col: 0xff8020, el: 'fire' },
  hab: { tipo: 'area', r: 4, dano: [120, 280], cd: 7500, el: 'fire', col: 0xff8020, grito: 'A FORJA NUNCA APAGA!' },
  // metade da vida: para de queimar de longe e vira uma bola de fogo que persegue
  fase: { hp: .5, grito: 'ENTÃO ARDA COMIGO!', hab: { tipo: 'area', r: 6, dano: [150, 340], cd: 4000, el: 'fire', col: 0xff6a10, grito: 'ARDA!' } },
  art: { shape: 'biped', o: { horns: true, skin: 0xd0421a, eyes: 0xffdd00, weapon: 0xff6a10, hornCol: 0x2a0a08 } },
  meta: ['Demônio', 'boss'],
  loot: [['gold', 1, 3000, 7000], ['ember_core', 1, 2, 5], ['demon_horn', .8, 1, 3], ['primordial_heart', .1],
  ['ch_hood', .16], ['ch_armor', .12], ['ch_legs', .14], ['ch_boots', .16], ['ch_shield', .12], ['ch_tome', .12], ['ch_staff', .1],
  ['sa_helmet', .2], ['sa_armor', .18], ['sa_axe', .12], ['sa_rod', .12], ['supreme_health_potion', 1, 3, 6]]
});
boss('frost_titan', {
  n: 'Vorgrim, Titã do Gelo', hp: 24000, exp: 60000, atk: [150, 400], arm: 68, sz: 2.2, col: 0x9fe4ff, tier: 9,
  hab: { tipo: 'lento', r: 5, lento: .6, dur: 8000, dano: [140, 330], cd: 8000, el: 'ice', col: 0x9fe4ff, grito: 'O FRIO É PACIENTE.' },
  fase: { hp: .4, grito: 'ENTÃO CONGELE DE VEZ!', hab: { tipo: 'area', r: 5, dano: [190, 430], cd: 5000, el: 'ice', col: 0xa8ecff, grito: 'AVALANCHE!' } },
  art: { shape: 'biped', o: { skin: 0xb8d4e8, eyes: 0x5aa9ff, weapon: 0x8fb8d8, shield: 0x8a8a92 } },
  meta: ['Gigante', 'boss'],
  loot: [['gold', 1, 4000, 9000], ['frozen_core', 1, 3, 6], ['small_sapphire', 1, 2, 4], ['primordial_heart', .12],
  ['fn_helmet', .16], ['fn_armor', .12], ['fn_legs', .14], ['fn_boots', .16], ['fn_shield', .12], ['fn_tome', .12], ['fn_staff', .1],
  ['sa_shield', .2], ['sa_legs', .18], ['sa_maul', .12], ['sa_bow', .12], ['supreme_health_potion', 1, 4, 8]]
});
boss('lich_king', {
  n: 'Morvhen, o Rei Lich', hp: 32000, exp: 95000, atk: [165, 430], arm: 62, sz: 1.9, col: 0x5a2070, tier: 10,
  ranged: { min: 220, max: 520, range: 8, col: 0x9f5aff, el: 'death' },
  hab: { tipo: 'mana', val: 500, r: 7, cd: 8000, col: 0xc78bff, grito: 'SUA MAGIA É MINHA.' },
  fase: { hp: .5, grito: 'LEVANTEM-SE, MEUS MORTOS!', hab: { tipo: 'area', r: 5, dano: [200, 470], cd: 5000, el: 'death', col: 0x9f5aff, grito: 'PARA A COVA!' } },
  art: { shape: 'biped', o: { thin: true, skin: 0xd8d0b8, eyes: 0xc78bff, weapon: 0x9f5aff } },
  meta: ['Morto-vivo', 'boss'],
  loot: [['gold', 1, 5500, 13000], ['soul_shard', 1, 3, 7], ['void_shard', .6, 1, 3], ['primordial_heart', .15],
  ['cs_hood', .16], ['cs_armor', .12], ['cs_legs', .14], ['cs_boots', .16], ['cs_shield', .12], ['cs_tome', .12], ['cs_staff', .1],
  ['sa_amulet', .25], ['sa_ring', .25], ['sa_sword', .12], ['sa_boots', .18], ['spectral_bow', .2], ['spirit_staff', .2], ['supreme_mana_potion', 1, 4, 8]]
});
boss('void_maw', {
  n: 'A Fauce do Vazio', hp: 50000, exp: 210000, atk: [250, 620], arm: 85, sz: 2.3, col: 0x2a0a40, tier: 11,
  ranged: { min: 280, max: 660, range: 8, col: 0xc78bff, el: 'energy' },
  hab: { tipo: 'mana', val: 900, r: 8, cd: 7000, col: 0xc78bff, grito: 'NADA SAI.' },
  fase: { hp: .5, grito: 'ENTÃO SEJA NADA.', hab: { tipo: 'area', r: 6, dano: [280, 640], cd: 4500, el: 'energy', col: 0x7fb8ff, grito: 'COLAPSO!' } },
  art: { shape: 'arachnid' }, meta: ['Aberração', 'boss'],
  loot: [['gold', 1, 9000, 22000], ['void_shard', 1, 4, 9], ['primordial_heart', .3, 1, 2], ['gold_ingot', 1, 3, 7],
  ['vz_boots', .18], ['vz_ring', .2], ['vz_bow', .12], ['vz_staff', .12], ['abyssal_ballista', .18], ['ultimate_mana_potion', 1, 5, 10]]
});
boss('fallen_seraph', {
  n: 'Aurelion, o Serafim Caído', hp: 72000, exp: 420000, atk: [290, 720], arm: 96, sz: 2.4, col: 0xffe9a8, tier: 12,
  ranged: { min: 320, max: 760, range: 8, col: 0xfff0b0, el: 'holy' },
  hab: { tipo: 'cura', val: 9000, cd: 15000, col: 0xfff0b0, grito: 'A LUZ NÃO SE APAGA.' },
  fase: { hp: .35, grito: 'ENTÃO QUE TUDO QUEIME NA LUZ!', hab: { tipo: 'area', r: 7, dano: [320, 740], cd: 4500, el: 'holy', col: 0xfff0b0, grito: 'JULGAMENTO!' } },
  art: { shape: 'biped', o: { wings: true, skin: 0xfff4d8, eyes: 0xffffff, weapon: 0xffe9a8, shield: 0xffe9a8 } },
  meta: ['Celeste', 'boss'],
  loot: [['gold', 1, 14000, 34000], ['seraph_feather', 1, 4, 9], ['primordial_heart', .45, 1, 2], ['small_diamond', 1, 3, 8],
  ['vz_crown', .2], ['vz_legs', .2], ['vz_sword', .12], ['vz_amulet', .22], ['nature_staff', .18], ['ultimate_health_potion', 1, 6, 12]]
});
boss('abyssal_god', {
  n: 'Nharzul, o Que Dorme no Fundo', hp: 130000, exp: 950000, atk: [340, 860], arm: 115, sz: 2.6, col: 0x1a0810, tier: 12,
  ranged: { min: 380, max: 900, range: 9, col: 0xff2060, el: 'death' },
  hab: { tipo: 'area', r: 6, dano: [320, 780], cd: 6500, el: 'death', col: 0xff2060, grito: 'EU SOU O FUNDO.' },
  fase: { hp: .3, grito: 'VOCÊ ACORDOU O QUE DORMIA.', hab: { tipo: 'area', r: 9, dano: [420, 980], cd: 4000, el: 'fire', col: 0xff6a10, grito: 'FIM.' } },
  art: { shape: 'biped', o: { horns: true, wings: true, skin: 0x2a0a18, eyes: 0xff2060, hornCol: 0x0a0206, weapon: 0xff2060 } },
  meta: ['Demônio', 'boss'],
  loot: [['gold', 1, 30000, 70000], ['primordial_heart', 1, 3, 6], ['void_shard', 1, 5, 12], ['seraph_feather', 1, 4, 9],
  ['vz_armor', .25], ['vz_aegis', .25], ['vz_axe', .15], ['vz_maul', .15], ['ultimate_health_potion', 1, 10, 20]]
});

/* ---- elites: a mesma criatura com outra régua ---------------------------
   Não é espécie nova — é um modificador sorteado no ponto de spawn. Vale mais
   que 20 tabelas novas porque multiplica o que já existe: cada bicho do jogo
   passa a ter 5 versões, e o jogador aprende a ler o nome antes de encostar.
   `mult` multiplica os números; quem não tem `hab` própria herda a do elite,
   e quem tem fica com a sua (mexer na natureza do bicho o descaracteriza).
   `tier` sobe, então o loot rola numa raridade acima — é o prêmio de ter
   escolhido a briga mais difícil. */
const ELITES = [
  { id: 'veterano', n: '% Veterano', col: 0x6a5a3a, plateCol: '#cfa85a',
    mult: { hp: 2.0, exp: 2.4, atk: 1.3, arm: 1.4, spd: 1.0, sz: 1.12, tier: 1 } },
  { id: 'feroz', n: '% Feroz', col: 0xa02a2a, plateCol: '#ff7a5a',
    mult: { hp: 1.5, exp: 2.2, atk: 1.55, arm: .9, spd: 1.15, sz: 1.05, tier: 1 } },
  { id: 'couracado', n: '% Couraçado', col: 0x4a5a6a, plateCol: '#8fb8d8',
    mult: { hp: 2.6, exp: 2.6, atk: 1.15, arm: 2.2, spd: .88, sz: 1.2, tier: 1 } },
  { id: 'anciao', n: '% Ancião', col: 0x5a3a7a, plateCol: '#c78bff',
    mult: { hp: 2.2, exp: 3.0, atk: 1.35, arm: 1.5, spd: 1.0, sz: 1.15, tier: 2 },
    hab: { tipo: 'area', r: 2, dano: [16, 44], cd: 12000, el: 'death', col: 0xc78bff, grito: '...' } }
];
const ELITE_CHANCE = 0.05;      // 1 em 20 pontos de spawn; sobe pra 0.12 se quiser mundo hostil

/* mistura duas cores em RGB — o elite fica com a cor da espécie puxada pro tom
   do modificador, então continua reconhecível de longe e diferente de perto */
const mixCol = (a, b, k) => {
  const c = s => Math.round((a >> s & 255) * (1 - k) + (b >> s & 255) * k);
  return (c(16) << 16) | (c(8) << 8) | c(0);
};

/* Cópia da definição da espécie com os números multiplicados. O jogo inteiro lê
   a criatura por `m.def` — render, combate, loot, corpo e placa —, então trocar
   só essa referência basta: nada mais precisa saber que existe elite. */
function defModificada(d, mod) {
  const s = mod.mult;
  const esc = (v, k) => Math.round(v * k);
  const def = Object.assign({}, d, {
    n: mod.n.replace('%', d.n),
    hp: esc(d.hp, s.hp), exp: esc(d.exp, s.exp), arm: esc(d.arm, s.arm),
    atk: d.atk.map(v => esc(v, s.atk)), spd: esc(d.spd, s.spd),
    sz: d.sz * s.sz, col: mixCol(d.col, mod.col, .45),
    tier: d.tier + s.tier, plateCol: mod.plateCol, elite: mod.id
  });
  if (d.ranged) def.ranged = Object.assign({}, d.ranged,
    { min: esc(d.ranged.min, s.atk), max: esc(d.ranged.max, s.atk) });
  if (d.hab) def.hab = d.hab.dano
    ? Object.assign({}, d.hab, { dano: d.hab.dano.map(v => esc(v, s.atk)) })
    : d.hab;
  else if (mod.hab) def.hab = Object.assign({}, mod.hab, { grito: d.n.toUpperCase() + '!' });
  return def;
}

/* Bestiário: 3 marcos por criatura, como no Tibia (Proeza / Perícia / Maestria).
   Números reais do Tibia: Inofensivo 5/10/25 (1 ponto), Trivial 10/100/250 (5),
   Fácil 25/250/500 (15), Médio 50/500/1000 (25). Comprimi os altos para caber
   numa sessão — mexa em `k` se quiser o grind original. */
const BEST_DIFF = {
  harmless:    { n: 'Inofensivo', col: '#9fd4a0', k: [5, 15, 30], cp: 1 },
  trivial:     { n: 'Trivial',    col: '#a9c96a', k: [10, 30, 70], cp: 5 },
  easy:        { n: 'Fácil',      col: '#e0c95a', k: [15, 45, 100], cp: 15 },
  medium:      { n: 'Médio',      col: '#e09a4a', k: [20, 60, 140], cp: 25 },
  hard:        { n: 'Difícil',    col: '#e0685a', k: [25, 80, 180], cp: 50 },
  challenging: { n: 'Desafiador', col: '#c77dff', k: [30, 100, 220], cp: 100 },
  /* Degrau que o Tibia não tem, porque o Tibia não precisa: aqui os dois andares
     de baixo são todos 'nightmare' e sem uma faixa própria eles cairiam em
     'challenging' junto com o demônio — o bestiário perderia a única coluna que
     ainda diz ao jogador o que ele tem condição de encarar. */
  nightmare:   { n: 'Pesadelo',   col: '#ff5a8a', k: [40, 120, 260], cp: 200 },
  /* Chefe tem marcos baixos de propósito: ele nasce um por região e volta em
     10 minutos, então pedir 220 mortes seria pedir um dia inteiro parado no
     mesmo tile. Em troca, o carisma que ele rende é o maior do jogo. */
  boss: { n: 'Chefe', col: '#ffb03d', k: [1, 3, 8], cp: 150 }
};
const BEST_STAGE = ['Proeza', 'Perícia', 'Maestria'];
/* o que cada marco revela — igual à ideia do Tibia */
const BEST_REVEAL = [
  'vida, experiência e o loot comum',
  'ataque, armadura, velocidade e o loot incomum',
  'todo o loot (raro e lendário), onde vive, e rende pontos de carisma'
];
/* faixa de chance -> rótulo de raridade do loot, como a coluna do bestiário */
const LOOT_RARITY = [
  { min: 0.25, n: 'Comum', col: '#cfc9ba', stage: 0 },
  { min: 0.10, n: 'Incomum', col: '#7fd08a', stage: 1 },
  { min: 0.04, n: 'Raro', col: '#5aa9ff', stage: 2 },
  { min: 0.015, n: 'Muito raro', col: '#c77dff', stage: 2 },
  { min: 0, n: 'Lendário', col: '#ff8b3d', stage: 2 }
];
/* ---- respawn: tempo por FORÇA da criatura, não fixo para todo mundo -------
   Era 25–60s para tudo. Dois problemas. Rápido demais, primeiro: um Colosso de
   42 mil de experiência voltava no mesmo meio minuto que um rato. E estreito
   demais, segundo — matando um núcleo de 8 em meio minuto, os oito voltavam
   dentro da MESMA janela de 60s, o que lê como "o grupo inteiro renasceu junto"
   mesmo o relógio sendo individual.
   A faixa larga é o que dessincroniza sozinho: com 90–150s de base, dois pontos
   mortos ao mesmo tempo voltam com um minuto de diferença entre si. */
const RESPAWN_BASE = [90000, 150000];        // faixa do bicho mais fraco
const RESPAWN_MULT = {
  harmless: 1, trivial: 1, easy: 1.4, medium: 1.8,
  hard: 2.4, challenging: 3.2, nightmare: 4.0,
  /* Chefe sai da MESMA régua, e não de uma faixa fixa à parte. Com faixa fixa
     (eram 8–15 min) ele deixou de ser o mais demorado assim que o respawn comum
     subiu: um Colosso voltava em 6–10 min contra os 8 do chefe. Preso ao
     multiplicador, ele fica sempre o dobro do bicho mais duro, aconteça o que
     acontecer com a base. */
  boss: 9
};
const AVISO_NASCER = 5000;   // quanto tempo antes o chão avisa que vem coisa

const CHARM_COST = 100;   // pontos de carisma para marcar uma criatura como presa
const CHARM_BONUS = 0.18; // +18% de dano contra a espécie marcada
const CHARM_MAX = 3;

/* Hunts: regiões temáticas com respawn denso de uma família de monstros, como
   os hunting grounds do Tibia. `z` é o andar (0 montanha, 1 superfície, 2 caverna,
   3 abismo) — SURF ainda não existe aqui, world.js só carrega depois. */
const HUNTS = [
  { id: 'wolf_wood', n: 'Bosque dos Lobos', z: 1, r: 8, lvl: 8, boss: 'alpha_wolf', mobs: ['wolf', 'spider', 'dire_wolf'], best: 'carne, couro e xp inicial' },
  { id: 'orc_camp', n: 'Acampamento Orc', z: 1, r: 9, lvl: 15, boss: 'orc_warchief', mobs: ['orc', 'orc_spearman', 'orc_shaman', 'orc_berserker'], best: 'ouro e equipamento leve' },
  { id: 'cyclop_hill', n: 'Colina dos Ciclopes', z: 1, r: 8, lvl: 40, boss: 'cyclops_king', mobs: ['cyclops', 'cyclops_smith'], best: 'ouro pesado e placas' },
  { id: 'insect_cave', n: 'Ninho de Insetos', z: 2, r: 8, lvl: 10, boss: 'hive_queen', mobs: ['bug', 'spider', 'rotworm', 'fire_beetle', 'poison_spider'], best: 'xp rápido em nível baixo' },
  { id: 'undead_crypt', n: 'Cripta dos Mortos', z: 2, r: 9, lvl: 25, boss: 'bone_lord', mobs: ['skeleton', 'ghoul', 'skeleton_warrior', 'skeleton_archer', 'necrophage'], best: 'ossos, crânios e pérolas' },
  { id: 'dwarf_mine', n: 'Mina dos Anões', z: 2, r: 8, lvl: 30, boss: 'dwarf_king', mobs: ['dwarf_soldier', 'dwarf_guard', 'dwarf_geomancer'], best: 'minério de ferro e rubis' },
  { id: 'mino_den', n: 'Covil dos Minotauros', z: 2, r: 9, lvl: 35, boss: 'minotaur_king', mobs: ['minotaur', 'minotaur_archer', 'minotaur_mage', 'minotaur_guard'], best: 'couro e chifres de minotauro' },
  { id: 'spider_nest', n: 'Ninho de Aranhas', z: 3, r: 8, lvl: 50, boss: 'broodmother', mobs: ['giant_spider', 'spider', 'tarantula'], best: 'seda de aranha e pérolas negras' },
  { id: 'dragon_lair', n: 'Covil do Dragão', z: 3, r: 8, lvl: 60, boss: 'dragon_matriarch', mobs: ['dragon', 'demon_skeleton', 'dragon_hatchling', 'frost_dragon'], best: 'escamas e equipamento raro' },
  { id: 'demon_pit', n: 'Fosso Demoníaco', z: 3, r: 7, lvl: 80, boss: 'demon_lord', mobs: ['demon', 'dragon_lord', 'fire_devil', 'lich'], best: 'o último degrau antes da Fenda' },
  /* Daqui pra baixo é o endgame. Os raios são menores (6-7) de propósito: são
     seis regiões novas dividindo dois andares, e círculo grande demais faria a
     colocação falhar por falta de espaço. Denso e pequeno também joga melhor —
     bicho de 10 mil de vida não precisa de campo aberto pra assustar. */
  { id: 'hell_forge', n: 'Forja Infernal', z: 3, r: 7, lvl: 100, boss: 'forge_tyrant', mobs: ['hellhound', 'hellfire_fighter', 'fire_elemental', 'destroyer'], best: 'núcleos de brasa e as primeiras peças da Sentinela' },
  { id: 'frozen_vault', n: 'Cripta Gélida', z: 4, r: 7, lvl: 130, boss: 'frost_titan', mobs: ['ice_elemental', 'frost_giant', 'undead_dragon'], best: 'núcleos congelados e placa pesada' },
  { id: 'necropolis', n: 'Necrópole de Morvhen', z: 4, r: 7, lvl: 160, boss: 'lich_king', mobs: ['banshee', 'vampire_lord', 'soul_eater'], best: 'fragmentos de alma e o conjunto da Sentinela' },
  { id: 'void_rift', n: 'Fenda do Vazio', z: 5, r: 7, lvl: 200, boss: 'void_maw', mobs: ['void_crawler', 'mind_devourer', 'storm_elemental', 'hollow_one'], best: 'estilhaços do Vazio — come sua mana, leve poção' },
  { id: 'fallen_citadel', n: 'Cidadela Caída', z: 5, r: 7, lvl: 250, boss: 'fallen_seraph', mobs: ['dark_paladin', 'fallen_angel', 'seraph_guard'], best: 'penas de serafim; o sagrado não arranha aqui' },
  { id: 'abyss_heart', n: 'Coração do Abismo', z: 5, r: 6, lvl: 320, boss: 'abyssal_god', mobs: ['behemoth', 'hellspawn', 'juggernaut'], best: 'o fim da linha: corações primordiais e a Regalia' }
];

/* --------------------------------------------------------------- coleta */
/* O RuneScape resolve com isto o que faltava aqui: uma coisa pra fazer no mundo
   que não seja bater. As três skills usam tiles que o mapa JÁ TEM — pedra,
   árvore e água estavam lá desde o primeiro dia, sem servir pra nada além de
   barrar o passo.
     tiles  nomes de tile (chaves de T) que respondem à colheita. Nomes e não
            números porque data.js não conhece world.js — quem resolve é quem usa
     seg    quantos segundos o tile leva pra voltar (o mundo não é infinito)
     tab    [item, chance, nívelMínimo] — a linha só entra no sorteio se a skill
            alcançou o nível; é isso que faz subir a skill VALER, e não só
            aumentar um número na ficha. Uma linha sai por colheita. */
/* Cada ofício tem uma ESCADA de qualidade e uma ferramenta própria.

   `tiles` — a mineração perdeu `CWALL`. Caverna é FEITA de parede de caverna:
   com ela na lista havia 46.899 tiles mineráveis contra 3.510 árvores e 3.463
   tiles de água alcançáveis, o que fazia da mineração o único recurso sem fim
   do jogo. Só `ROCK` deixa ~2.000, na mesma ordem dos outros dois — minerar
   voltou a ser procurar veio, como lenhar é procurar árvore.

   `ferramenta` — lista de ids que servem. A picareta e a vara existem só para
   isso; o machado NÃO tem versão de lenhador porque `axe` e `hand_axe` já são
   machados, e obrigar um item novo idêntico seria tabela por tabela.

   `alcance` — de quantos tiles se colhe. Picareta e machado exigem encostar; a
   VARA alcança `ALCANCE_TIRO`, o mesmo do arco, e ainda precisa de linha limpa:
   ninguém pesca através de uma montanha.

   Sem `ico`: o §17 veta emoji como ícone de gameplay, e o pá/machado/anzol que
   abriam a linha do log eram justamente isso. O log fala por escrito.

   `n` é o infinitivo ("para MINERAR você precisa de...") e `v` a terceira pessoa
   ("você MINERA e obtém..."). Um só dos dois dava "Você minerar e obtém".

   `tab` — [id, chance, nível]. A ordem importa: o sorteio desce da linha mais
   rara para a mais comum (ver `colher`), então escreva da rara para a comum. A
   última linha é o consolo, o que sai quando nada melhor cai. */
const COLETA = {
  mining: {
    tiles: ['ROCK'], n: 'minerar', v: 'minera', seg: 90, alcance: 1, ferramenta: ['pickaxe'],
    tab: [['gold_ingot', .0025, 65], ['small_diamond', .005, 55], ['small_sapphire', .012, 35],
    ['small_ruby', .012, 35], ['mithril_ore', .07, 48], ['iron_ore', .10, 18],
    ['silver_ore', .20, 28], ['copper_ore', .55, 10], ['coal', 1, 10]]
  },
  woodcut: {
    tiles: ['TREE'], n: 'cortar lenha', v: 'corta lenha', seg: 60, alcance: 1, ferramenta: ['axe', 'hand_axe'],
    tab: [['honeycomb', .12, 25], ['mushroom', .15, 15], ['brown_mushroom', .18, 10], ['hard_wood', .20, 35],
    ['resin', .22, 20], ['herb', .30, 10], ['wood', .70, 10], ['green_wood', 1, 10]]
  },
  fishing: {
    tiles: ['WATER'], n: 'pescar', v: 'pesca', seg: 30, alcance: ALCANCE_TIRO, ferramenta: ['fishing_rod'],
    tab: [['shimmering_pearl', .004, 65], ['black_pearl', .015, 50], ['white_pearl', .03, 35],
    ['big_fish', .25, 28], ['shrimp', .30, 18], ['shell', .30, 10], ['fish', .70, 10], ['worm', 1, 10]]
  }
};
/* Quanto a skill pesa nas duas pontas. `COLETA_EXITO` é a chance de a tentativa
   render alguma coisa: 41% na skill inicial, 62% na 45, 83% na 80. `COLETA_SORTE`
   é o quanto cada linha fica mais provável por ponto de skill ACIMA do que ela
   exige — é o que faz a skill melhorar a raridade, e não só destravar linha. */
const COLETA_EXITO = (nivel) => Math.min(.90, .35 + nivel * .006);
const COLETA_SORTE = .015;

/* ----------------------------------------------------------- imbuements */
/* A ideia é do Tibia: gastar despojo de monstro para pôr um bônus no que você
   já usa. Aqui ela resolve um problema concreto — metade do loot do jogo era
   lixo de vender. Rabo de rato, pata de lobo e seda de aranha viravam ouro e
   nada mais; agora são o preço de um atributo.
   UM imbuement por peça, e ele SUBSTITUI o anterior: sem esse limite a forja
   viraria a única fonte de poder do jogo e o equipamento que cai no chão
   deixaria de importar. `b` usa as mesmas chaves dos afixos, então o recalc, o
   tooltip e o save já sabem lidar sem uma linha nova. */
const IMBUEMENTS = [
  { id: 'vitalidade', n: 'Vitalidade', ico: '❤️', b: { maxhp: 150, hpReg: 3 }, ouro: 15000,
    mats: [['wolf_paw', 12], ['minotaur_leather', 8], ['bone', 25]] },
  { id: 'arcano', n: 'Arcano', ico: '🔷', b: { maxmana: 180, mpReg: 4 }, ouro: 15000,
    mats: [['demon_dust', 6], ['white_pearl', 10], ['spider_silk', 12]] },
  { id: 'lamina', n: 'Lâmina Cruel', ico: '⚔️', b: { atkPct: .18, crit: .06 }, ouro: 25000,
    mats: [['orc_tooth', 20], ['minotaur_horn', 8], ['talon', 2]] },
  { id: 'sanguessuga', n: 'Sanguessuga', ico: '🩸', b: { lifesteal: .08 }, ouro: 30000,
    mats: [['rotten_flesh', 20], ['skull', 15], ['demon_horn', 3]] },
  { id: 'couraca', n: 'Couraça', ico: '🛡️', b: { arm: 8, defPct: .12 }, ouro: 25000,
    mats: [['iron_ore', 25], ['bug_shell', 20], ['dragon_scale', 6]] },
  { id: 'passolargo', n: 'Passo Largo', ico: '💨', b: { speed: 45 }, ouro: 20000,
    mats: [['rat_tail', 30], ['snake_hide', 20], ['wolf_paw', 15]] },
  /* As quatro de resistência são o degrau que abre a Fenda: sem corte elemental
     o nível 130 leva 300 por sopro com a armadura cheia, e a única outra fonte
     é sorte de afixo. Aqui ele COMPRA a resistência com o que já matou. */
  { id: 'antifogo', n: 'Manto Ígneo', ico: '🔥', b: { resFire: .18 }, ouro: 40000,
    mats: [['red_dragon_scale', 8], ['ember_core', 4]] },
  { id: 'antigelo', n: 'Manto Gélido', ico: '❄️', b: { resIce: .18 }, ouro: 40000,
    mats: [['frozen_core', 4], ['small_sapphire', 10]] },
  { id: 'antimorte', n: 'Manto Sepulcral', ico: '💀', b: { resDeath: .18 }, ouro: 40000,
    mats: [['soul_shard', 4], ['black_pearl', 12]] },
  { id: 'antienergia', n: 'Manto Estático', ico: '⚡', b: { resEnergy: .18 }, ouro: 40000,
    mats: [['storm_core', 4], ['gold_ingot', 6]] },
  { id: 'primordial', n: 'Primordial', ico: '❤️‍🔥', b: { maxhp: 300, atkPct: .15, arm: 6, speed: 20 }, ouro: 250000,
    mats: [['primordial_heart', 3], ['void_shard', 12], ['seraph_feather', 8]] }
];

/* ------------------------------------------------------------------- POIs */
/* Pontos de interesse: o que o Witcher III e o Kingdom Come põem entre as
   cidades para o caminho não ser um corredor. O mapa aqui tinha DOIS estados —
   dentro de hunt (denso) e fora (ruído aleatório espalhado) — e o meio do mundo
   não valia atravessar. Um POI é uma hunt em miniatura com fim: um punhado de
   guardas temáticos em volta de um tesouro que se saqueia UMA VEZ.
   O uma-vez é o que separa POI de hunt. Hunt é lugar de voltar; POI é lugar de
   descobrir, e o mapa fica marcado para você lembrar que já passou por ali.
     r      raio do agrupamento de guardas
     dens   fração dos tiles do raio que vira ponto de spawn
     qtd    quantos existem no mundo inteiro
     loot   mesma tabela do monstro: [id, chance, min, max], cada linha rola só */
const POIS = [
  { id: 'bandit_camp', n: 'Acampamento de Bandidos', ico: '🏕️', z: [1], r: 3, dens: .3, qtd: 7,
    mobs: ['orc_berserker', 'orc_spearman', 'orc_warlord'],
    dica: 'fogueira apagada e pegadas frescas',
    loot: [['gold', 1, 200, 900], ['great_health_potion', .6, 1, 3], ['gold_ingot', .25],
    ['small_ruby', .2], ['plate_armor', .1], ['battle_axe', .12]] },
  { id: 'ruin', n: 'Ruína Esquecida', ico: '🏛️', z: [1], r: 3, dens: .3, qtd: 7,
    mobs: ['skeleton_warrior', 'ghoul', 'necrophage'],
    dica: 'pedra lavrada tomada pelo mato',
    loot: [['gold', 1, 150, 700], ['skull', .8, 1, 3], ['white_pearl', .35], ['black_pearl', .2],
    ['small_sapphire', .18], ['crown_helmet', .08], ['rune_sd', .3, 1, 2]] },
  { id: 'nest', n: 'Ninho', ico: '🕸️', z: [1, 2], r: 2, dens: .45, qtd: 8,
    mobs: ['poison_spider', 'tarantula', 'fire_beetle', 'carrion_worm'],
    dica: 'teia grossa demais para ser de aranha comum',
    loot: [['spider_silk', 1, 2, 6], ['bug_shell', .8, 2, 5], ['gold', 1, 100, 500],
    ['black_pearl', .3], ['worm_slime', .6, 1, 4]] },
  { id: 'barrow', n: 'Túmulo Antigo', ico: '⚰️', z: [2, 3], r: 3, dens: .35, qtd: 8,
    mobs: ['demon_skeleton', 'lich', 'skeleton_archer'],
    dica: 'a laje foi aberta por dentro',
    loot: [['gold', 1, 500, 2000], ['small_diamond', .35], ['gold_ingot', .5, 1, 2],
    ['soul_shard', .2], ['magic_sword', .06], ['boots_of_haste', .06], ['rune_uh', .5, 1, 3]] },
  /* O tesouro guardado é o "vale a pena?" do Witcher: UM bicho, acima da régua
     do andar, dormindo em cima do prêmio — dá pra ver os dois na mesma olhada e
     decidir. Por isso `dens: 0`: enxame em volta apagaria a escolha, viraria só
     mais uma hunt. O guarda sai por andar (`mobs` casa índice a índice com `z`),
     porque um Oco no primeiro nível de caverna não é desafio, é parede. */
  { id: 'hoard', n: 'Tesouro Guardado', ico: '💰', z: [2, 3, 4, 5], r: 2, dens: 0, qtd: 9,
    mobs: ['dragon_lord', 'demon', 'destroyer', 'hollow_one'], guarda: true,
    dica: 'alguma coisa dorme em cima disto há muito tempo',
    loot: [['gold', 1, 1500, 6000], ['gold_ingot', 1, 2, 5], ['small_diamond', .7, 1, 3],
    ['void_shard', .25], ['primordial_heart', .06], ['magic_plate_armor', .08],
    ['sa_ring', .12], ['ultimate_health_potion', .5, 1, 3]] }
];

/* Fauna de bioma: a tundra e o pântano têm dono. Mesma forma dos pools por
   andar (faixa de distância do templo) porque o problema é o mesmo — bioma
   colado no templo não pode cuspir lobo gélido em cima de um nível 3. */
const BIOMA_POOLS = {
  snow: [{ r: [0, 45], mobs: ['hare', 'deer', 'wolf', 'cave_rat', 'winter_wolf'] },
         { r: [45, 999], mobs: ['winter_wolf', 'dire_wolf', 'minotaur_archer', 'frost_dragon'] }],
  swamp: [{ r: [0, 45], mobs: ['snake', 'cobra', 'poison_spider', 'rotworm'] },
          { r: [45, 999], mobs: ['serpent_spawn', 'tarantula', 'carrion_worm', 'necrophage'] }]
};

/* pools de spawn por andar e faixa de distância do templo */
const SPAWN_POOLS = {
  /* superfície: fica mais perigoso longe do templo, e mais VIVO perto dele.
     A fauna passiva é densa no anel calmo e some conforme o perigo sobe — é o
     que faz sair do templo parecer campo e não corredor de monstro.
     Nome repetido = mais chance: o sorteio é uniforme sobre a lista, então
     duplicar 'hare' dobra o peso dele sem precisar de tabela de pesos. */
  1: [
    { r: [10, 28], mobs: ['hare', 'hare', 'deer', 'firefly', 'rat', 'snake', 'bug', 'cobra'] },
    { r: [28, 50], mobs: ['deer', 'boar', 'firefly', 'wolf', 'spider', 'skeleton', 'orc', 'fire_beetle', 'poison_spider'] },
    { r: [50, 75], mobs: ['boar', 'orc', 'orc_spearman', 'orc_shaman', 'orc_berserker', 'ghoul', 'rotworm', 'minotaur', 'dire_wolf', 'skeleton_warrior'] },
    { r: [75, 999], mobs: ['minotaur', 'minotaur_archer', 'cyclops', 'giant_spider', 'orc_warlord', 'tarantula', 'winter_wolf'] }
  ],
  // montanha: frio e alto, é onde o que voa e o que gosta de gelo vive
  0: [{ r: [0, 999], mobs: ['minotaur_archer', 'cyclops', 'giant_spider', 'dragon', 'winter_wolf', 'dragon_hatchling', 'frost_dragon'] }],
  2: [{ r: [0, 999], mobs: ['rotworm', 'dwarf_soldier', 'ghoul', 'minotaur', 'cyclops', 'dwarf_guard', 'dwarf_geomancer', 'necrophage', 'carrion_worm', 'skeleton_archer'] }],
  3: [{ r: [0, 999], mobs: ['demon_skeleton', 'giant_spider', 'dragon', 'dragon_lord', 'demon', 'lich', 'serpent_spawn', 'fire_devil', 'minotaur_guard', 'minotaur_mage', 'hellhound', 'hellfire_fighter', 'fire_elemental'] }],
  // Fenda e Coração: fora da hunt o mundo aberto já é o que a hunt de cima tinha
  // dentro. Não existe "faixa segura" abaixo do Abismo — descer É o aviso.
  4: [{ r: [0, 999], mobs: ['ice_elemental', 'frost_giant', 'undead_dragon', 'banshee', 'vampire_lord', 'soul_eater', 'destroyer'] }],
  5: [{ r: [0, 999], mobs: ['void_crawler', 'mind_devourer', 'storm_elemental', 'hollow_one', 'dark_paladin', 'fallen_angel', 'seraph_guard', 'behemoth', 'hellspawn', 'juggernaut'] }]
};

/* --------------------------------------------------------------- magias */
/* type: attack (alvo) | beam (linha) | wave (cone) | aoe (área em volta)
         heal | buff  ;  f = fator por magic level ; base = dano/cura mínima */
const SPELLS = [
  { id: 'exura', w: 'exura', n: 'Cura Leve', type: 'heal', lvl: 8, mana: 25, cd: 1000, voc: ['knight', 'ranger', 'sorcerer', 'druid'], base: 30, f: 2.2, ico: '💚' },
  { id: 'exura_ico', w: 'exura ico', n: 'Cura do Cavaleiro', type: 'heal', lvl: 8, mana: 40, cd: 1000, voc: ['knight'], base: 55, f: 3.5, ico: '💚' },
  { id: 'exura_gran', w: 'exura gran', n: 'Cura Intensa', type: 'heal', lvl: 20, mana: 70, cd: 1000, voc: ['ranger', 'sorcerer', 'druid'], base: 90, f: 4.5, ico: '💚' },
  { id: 'exura_vita', w: 'exura vita', n: 'Cura Suprema', type: 'heal', lvl: 32, mana: 160, cd: 1000, voc: ['druid'], base: 220, f: 8, ico: '💚' },
  { id: 'exura_san', w: 'exura san', n: 'Cura Sagrada', type: 'heal', lvl: 32, mana: 155, cd: 1000, voc: ['ranger'], base: 170, f: 7, ico: '💚' },

  { id: 'exori_vis', w: 'exori vis', n: 'Golpe de Energia', type: 'attack', lvl: 12, mana: 20, cd: 1200, voc: ['sorcerer'], base: 30, f: 3.6, el: 'energy', col: 0x5aa9ff, ico: '⚡' },
  { id: 'exori_flam', w: 'exori flam', n: 'Golpe de Fogo', type: 'attack', lvl: 12, mana: 20, cd: 1200, voc: ['sorcerer', 'druid'], base: 26, f: 3.2, el: 'fire', ico: '🔥' },
  { id: 'exori_frigo', w: 'exori frigo', n: 'Golpe de Gelo', type: 'attack', lvl: 14, mana: 20, cd: 1200, voc: ['druid'], base: 28, f: 3.6, el: 'ice', ico: '❄️' },
  { id: 'exori_tera', w: 'exori tera', n: 'Golpe de Terra', type: 'attack', lvl: 13, mana: 20, cd: 1200, voc: ['druid'], base: 27, f: 3.4, el: 'earth', ico: '🌿' },
  { id: 'exori_san', w: 'exori san', n: 'Míssil Divino', type: 'attack', lvl: 18, mana: 22, cd: 1100, voc: ['ranger'], base: 30, f: 3.2, el: 'holy', ico: '✨' },

  { id: 'exevo_flam_hur', w: 'exevo flam hur', n: 'Onda de Fogo', type: 'wave', lvl: 18, mana: 40, cd: 2000, voc: ['sorcerer'], base: 40, f: 3.4, el: 'fire', col: 0xff6a10, ico: '🌊' },
  { id: 'exevo_frigo_hur', w: 'exevo frigo hur', n: 'Onda de Gelo', type: 'wave', lvl: 18, mana: 40, cd: 2000, voc: ['druid'], base: 35, f: 3.4, el: 'ice', col: 0x9fe4ff, ico: '🌊' },
  { id: 'exevo_vis_lux', w: 'exevo vis lux', n: 'Raio de Energia', type: 'beam', lvl: 23, mana: 60, cd: 2200, voc: ['sorcerer'], base: 60, f: 4.6, el: 'energy', ico: '➖' },
  { id: 'exevo_mas_san', w: 'exevo mas san', n: 'Caldeira Divina', type: 'aoe', lvl: 30, mana: 130, cd: 3000, voc: ['ranger'], base: 70, f: 4.2, el: 'holy', col: 0xfff0b0, r: 3, ico: '💥' },
  { id: 'exevo_gran_mas_vis', w: 'exevo gran mas vis', n: 'Explosão Suprema', type: 'aoe', lvl: 45, mana: 300, cd: 6000, voc: ['sorcerer'], base: 190, f: 9, el: 'energy', col: 0x9f7aff, r: 4, ico: '💥' },
  { id: 'exevo_gran_mas_frigo', w: 'exevo gran mas frigo', n: 'Tempestade de Gelo', type: 'aoe', lvl: 45, mana: 300, cd: 6000, voc: ['druid'], base: 158, f: 8.6, el: 'ice', col: 0xa8ecff, r: 4, ico: '💥' },

  { id: 'exori', w: 'exori', n: 'Fúria', type: 'melee_aoe', lvl: 22, mana: 90, cd: 3000, voc: ['knight'], mult: 1.9, r: 1, col: 0xffd070, ico: '💢', estado: 'sangrando' },
  { id: 'exori_gran', w: 'exori gran', n: 'Fúria Selvagem', type: 'melee_aoe', lvl: 40, mana: 170, cd: 5000, voc: ['knight'], mult: 3.4, r: 1, col: 0xff9040, ico: '💢', estado: 'sangrando' },
  { id: 'exori_hur', w: 'exori hur', n: 'Lâmina Giratória', type: 'melee_aoe', lvl: 28, mana: 120, cd: 4000, voc: ['knight'], mult: 2.2, r: 2, col: 0xffb060, ico: '🌀', estado: 'sangrando' },

  { id: 'utani_hur', w: 'utani hur', n: 'Pressa', type: 'buff', lvl: 14, mana: 60, cd: 2000, voc: ['knight', 'ranger', 'sorcerer', 'druid'], buff: 'haste', val: 60, dur: 33000, ico: '💨' },
  { id: 'utani_gran_hur', w: 'utani gran hur', n: 'Pressa Forte', type: 'buff', lvl: 20, mana: 100, cd: 2000, voc: ['ranger', 'sorcerer', 'druid'], buff: 'haste', val: 110, dur: 22000, ico: '💨' },
  { id: 'utamo_vita', w: 'utamo vita', n: 'Escudo Mágico', type: 'buff', lvl: 14, mana: 50, cd: 2000, voc: ['knight', 'ranger', 'sorcerer', 'druid'], buff: 'mshield', dur: 200000, ico: '🔵' },
  { id: 'utura', w: 'utura', n: 'Regeneração', type: 'buff', lvl: 10, mana: 40, cd: 2000, voc: ['knight', 'ranger', 'sorcerer', 'druid'], buff: 'regen', val: 6, dur: 60000, ico: '🌱' },
  { id: 'utevo_lux', w: 'utevo lux', n: 'Luz', type: 'buff', lvl: 6, mana: 20, cd: 1000, voc: ['knight', 'ranger', 'sorcerer', 'druid'], buff: 'light', val: 9, dur: 120000, ico: '🔦' }
];

/* ---- lote 2 de magias -----------------------------------------------------
   Palavras reais do Tibia. Todo personagem nasce com algo no nível 1 (no Tibia
   as primeiras vêm no 8; aqui adiantei, como você pediu). Tipos novos:
   melee (golpe único com a arma), taunt (puxa o box), conjure (cria runa). */
const TODAS = ['knight', 'ranger', 'sorcerer', 'druid'];
SPELLS.push(
  { id: 'exura_min', w: 'exura min', n: 'Curativo', type: 'heal', lvl: 1, mana: 15, cd: 1000, voc: TODAS, base: 16, f: 1.3, ico: '💚' },
  { id: 'utevo_lux_min', w: 'utevo lux min', n: 'Lampejo', type: 'buff', lvl: 1, mana: 8, cd: 1000, voc: TODAS, buff: 'light', val: 5, dur: 90000, ico: '🕯️' },
  { id: 'exori_min', w: 'exori min', n: 'Golpe Rápido', type: 'melee', lvl: 1, mana: 15, cd: 1400, voc: ['knight'], mult: 1.3, col: 0xffd070, ico: '⚔️', estado: 'sangrando' },
  { id: 'exori_min_san', w: 'exori min san', n: 'Dardo Sagrado', type: 'attack', lvl: 1, mana: 12, cd: 1400, voc: ['ranger'], base: 13, f: 1.7, el: 'holy', ico: '✨' },
  { id: 'exori_min_flam', w: 'exori min flam', n: 'Faísca', type: 'attack', lvl: 1, mana: 12, cd: 1400, voc: ['sorcerer'], base: 13, f: 1.7, el: 'fire', col: 0xff9a40, ico: '🔥' },
  { id: 'exori_min_frigo', w: 'exori min frigo', n: 'Lasca de Gelo', type: 'attack', lvl: 1, mana: 12, cd: 1400, voc: ['druid'], base: 13, f: 1.7, el: 'ice', col: 0xaee6ff, ico: '❄️' },

  { id: 'exeta_res', w: 'exeta res', n: 'Desafio', type: 'taunt', lvl: 16, mana: 30, cd: 6000, voc: ['knight'], r: 5, col: 0xff9a3a, ico: '📢' },
  { id: 'utito_tempo', w: 'utito tempo', n: 'Fúria Sanguínea', type: 'buff', lvl: 30, mana: 120, cd: 4000, voc: ['knight'], buff: 'rage', val: 30, dur: 45000, ico: '🩸' },
  { id: 'utamo_tempo', w: 'utamo tempo', n: 'Protetor', type: 'buff', lvl: 42, mana: 120, cd: 4000, voc: ['knight'], buff: 'guard', val: 50, dur: 45000, ico: '🛡️' },

  { id: 'exori_con', w: 'exori con', n: 'Lança Etérea', type: 'attack', lvl: 23, mana: 25, cd: 1200, voc: ['ranger'], base: 55, f: 3.4, el: 'physical', ico: '🏹' },
  { id: 'utito_tempo_san', w: 'utito tempo san', n: 'Atirador de Elite', type: 'buff', lvl: 45, mana: 100, cd: 4000, voc: ['ranger'], buff: 'sharp', val: 6, dur: 45000, ico: '🎯' },

  /* Área do ranger. Antes só existia a Caldeira Divina no 30, então a vocação
     passava do 1 ao 30 sem nada que pegasse dois monstros juntos. As três usam
     forma diferente de propósito: cone à frente, linha que atravessa e estouro
     em volta — flecha em leque, tiro perfurante e chuva. Nos números ficam um
     degrau abaixo do feiticeiro no mesmo nível: área é o ponto fraco da classe,
     não a virada dela. */
  { id: 'exevo_con_hur', w: 'exevo con hur', n: 'Rajada de Flechas', type: 'wave', lvl: 12, mana: 32, cd: 2000, voc: ['ranger'], base: 28, f: 2.8, el: 'physical', ico: '🏹' },
  { id: 'exevo_con_lux', w: 'exevo con lux', n: 'Flecha Perfurante', type: 'beam', lvl: 25, mana: 62, cd: 2300, voc: ['ranger'], base: 56, f: 4.3, el: 'physical', col: 0xe0cd94, ico: '➖' },
  { id: 'exevo_gran_mas_san', w: 'exevo gran mas san', n: 'Chuva de Julgamento', type: 'aoe', lvl: 50, mana: 260, cd: 6000, voc: ['ranger'], base: 175, f: 8.4, el: 'holy', col: 0xffe9a0, r: 4, ico: '💥' },

  { id: 'exevo_vis_hur', w: 'exevo vis hur', n: 'Onda de Energia', type: 'wave', lvl: 30, mana: 80, cd: 2200, voc: ['sorcerer'], base: 70, f: 4.4, el: 'energy', ico: '🌊' },
  { id: 'exevo_tera_hur', w: 'exevo tera hur', n: 'Onda de Terra', type: 'wave', lvl: 26, mana: 70, cd: 2200, voc: ['druid'], base: 55, f: 4.1, el: 'earth', col: 0x8ac24a, ico: '🌊' },
  { id: 'exevo_gran_mas_flam', w: 'exevo gran mas flam', n: 'Fúria dos Céus', type: 'aoe', lvl: 55, mana: 350, cd: 7000, voc: ['sorcerer'], base: 210, f: 9.5, el: 'fire', col: 0xff5a10, r: 4, ico: '☄️' },
  { id: 'utana_vid', w: 'utana vid', n: 'Invisibilidade', type: 'buff', lvl: 35, mana: 150, cd: 5000, voc: ['sorcerer', 'druid'], buff: 'invis', dur: 30000, ico: '👻' },

  { id: 'adori_min_vis', w: 'adori min vis', n: 'Conjurar: Míssil Pesado', type: 'conjure', lvl: 15, mana: 90, cd: 2000, voc: ['sorcerer', 'druid'], item: 'rune_hmm', ico: '🔮' },
  { id: 'adevo_mas_flam', w: 'adevo mas flam', n: 'Conjurar: Explosão', type: 'conjure', lvl: 18, mana: 130, cd: 2000, voc: ['sorcerer', 'druid'], item: 'rune_explosion', ico: '🔮' },
  { id: 'adura_gran', w: 'adura gran', n: 'Conjurar: Cura Intensa', type: 'conjure', lvl: 15, mana: 120, cd: 2000, voc: ['druid', 'ranger'], item: 'rune_ih', ico: '🔮' },
  { id: 'adori_gran_flam', w: 'adori gran flam', n: 'Conjurar: Bola de Fogo', type: 'conjure', lvl: 22, mana: 180, cd: 2000, voc: ['sorcerer'], item: 'rune_gfb', ico: '🔮' },
  { id: 'adori_gran_frigo', w: 'adori gran frigo', n: 'Conjurar: Avalanche', type: 'conjure', lvl: 24, mana: 190, cd: 2000, voc: ['druid'], item: 'rune_avalanche', ico: '🔮' },
  { id: 'adori_vita', w: 'adori vita', n: 'Conjurar: Cura Suprema', type: 'conjure', lvl: 26, mana: 220, cd: 2000, voc: ['druid'], item: 'rune_uh', ico: '🔮' },
  { id: 'adori_vita_vis', w: 'adori vita vis', n: 'Conjurar: Morte Súbita', type: 'conjure', lvl: 32, mana: 280, cd: 2000, voc: ['sorcerer'], item: 'rune_sd', ico: '🔮' }
);
SPELLS.sort((a, b) => a.lvl - b.lvl);

/* Cor de magia e de runa: a tabela de elementos é o padrão, `col` na ficha é
   exceção. Quem repetia exatamente a cor do elemento perdeu o campo — o que
   sobrou é degradê de propósito, o fogo escurecendo conforme a magia cresce
   (faísca 0xff9a40 -> fúria dos céus 0xff5a10). Roda no fim do arquivo porque
   ITEMS e as runas são declarados antes de ELEM. */
for (const s of SPELLS) if (s.col === undefined && ELEM[s.el]) s.col = ELEM[s.el].cor;
for (const id in ITEMS) {
  const r = ITEMS[id].rune;
  if (r && r.col === undefined && ELEM[r.el]) r.col = ELEM[r.el].cor;
}

/* Velocidade da criatura: dois eixos que já existem na tabela, e nada de mão.
   NATUREZA (a classe) diz como o bicho se desloca; FORÇA (o tier, 0 a 12) diz
   quanto ele acompanha um jogador que ficou mais rápido. Antes só a natureza
   contava — e nem isso, na prática: lobo de tier 1 a 345 contra juggernaut de
   tier 11 a 235.
   A calibragem: o jogador nasce com 220 e chega a 325 (knight) ou 425
   (sorcerer) no nível 300. Peso morto nunca alcança ninguém e some do encalço
   cedo; o andarilho segue o jogador até o meio do jogo; só o caçador de tier
   alto passa a vocação lenta no fim. Escapar a pé continua possível — é assim
   no Tibia também, onde dragão anda a 86 contra os 220 do jogador — e o perigo
   mora em ser cercado, não em ser corrido.
   Roda no fim do arquivo porque depende de `cls`, que os laços de MOB_META e as
   chamadas de mob()/boss() terminam de escrever acima. */
const VEL_BASE = {
  Inseto: 185, Gigante: 185, 'Morto-vivo': 185,                                  // peso morto: arrasta
  Humanoide: 215, 'Réptil': 215, 'Aberração': 215, Celeste: 215,                 // anda sobre pernas
  'Mamífero': 245, 'Aracnídeo': 245, 'Dragão': 245, 'Demônio': 245, Elemental: 245  // caça, voa, desliza
};
const VEL_TIER = 7;    // ganho por tier; 12 tiers = +84 do mais fraco ao mais forte
const VEL_CHEFE = 20;  // chefe é a versão perigosa da própria família, inclusive nas pernas
for (const id in MONSTERS) {
  const m = MONSTERS[id];
  if (m.spd === undefined) m.spd = VEL_BASE[m.cls] + m.tier * VEL_TIER + (m.boss ? VEL_CHEFE : 0);
}

/* Valor do loot: dificuldade × natureza, pelo mesmo princípio da velocidade.
   Os 79 saques foram escritos à mão e o valor esperado por morte ia de 0.04 a
   1.50 vez a experiência, sem motivo: `dwarf_king` largava 30.613 em ouro e
   `juggernaut`, muito mais forte, largava 30.418 — e o `alpha_wolf`, um lobo,
   largava 7.971 em EQUIPAMENTO. A linha dos anões era a impressora de dinheiro
   do jogo, e dez minutos nela pagavam a melhor varinha da loja.

   Duas regras e um cuidado:
     dificuldade  o tier dobra o valor a cada degrau
     natureza     quem pensa carrega bolsa; bicho larga pedaço de si
     cuidado      MATERIAL NÃO SE MEXE. Rabo de rato, seda de aranha e osso são
                  insumo de imbuement, e cortar a chance deles para acertar uma
                  conta de ouro quebraria a forja em silêncio. Só o TESOURO
                  (o que tem `slot`, ou seja arma e equipamento) é ajustado, e
                  o ouro fecha a diferença. Nas 79, o material sozinho nunca
                  chega ao alvo, então sempre há folga para isso. */
const LOOT_BASE = 28;      // ouro esperado por morte no tier 0
const LOOT_TIER = 2;       // quanto o valor multiplica a cada tier
const LOOT_CHEFE = 5;
const LOOT_CLASSE = {
  Humanoide: 1.8, 'Demônio': 1.8, Celeste: 1.5,          // carrega bolsa, veste o que saqueou
  'Dragão': 1.3, Gigante: 1.1, 'Morto-vivo': 1.0,        // guarda tesouro, ou sobrou dele
  'Aberração': 0.8, Elemental: 0.8,                      // matéria estranha, pouco ouro
  'Aracnídeo': 0.6, 'Mamífero': 0.5, 'Réptil': 0.5, Inseto: 0.5   // larga pedaço de si
};
const lootAlvo = m => Math.round(LOOT_BASE * Math.pow(LOOT_TIER, m.tier)
  * LOOT_CLASSE[m.cls] * (m.boss ? LOOT_CHEFE : 1));
const lootVal = i => i === 'gold' ? 1
  : ITEMS[i] ? (ITEMS[i].sell !== undefined ? ITEMS[i].sell : Math.round((ITEMS[i].price || 0) * 0.4)) : 0;
const lootQtd = l => ((l[2] || 1) + (l[3] || l[2] || 1)) / 2;
const lootEV = m => (m.loot || []).reduce((s, l) => s + l[1] * lootQtd(l) * lootVal(l[0]), 0);
for (const id in MONSTERS) {
  const m = MONSTERS[id];
  if (!m.loot || !m.loot.length) continue;
  const alvo = lootAlvo(m);
  const material = m.loot.filter(l => l[0] !== 'gold' && !(ITEMS[l[0]] && ITEMS[l[0]].slot));
  const tesouro = m.loot.filter(l => ITEMS[l[0]] && ITEMS[l[0]].slot);
  const evMat = material.reduce((s, l) => s + l[1] * lootQtd(l) * lootVal(l[0]), 0);
  const evTes = tesouro.reduce((s, l) => s + l[1] * lootQtd(l) * lootVal(l[0]), 0);
  /* Tesouro só encolhe, nunca cresce: subir a chance de um equipamento raro para
     fechar a conta transformaria item de sorte em salário. Quem está abaixo do
     alvo recebe a diferença em ouro. */
  const folga = Math.max(0, alvo - evMat);
  if (evTes > folga) for (const l of tesouro) l[1] = Math.max(0.005, +(l[1] * (folga / evTes)).toFixed(4));
  /* O ouro é a folga: absorve o arredondamento e o que o tesouro não cobre.
     Só a QUANTIDADE é da régua — a chance de largar ouro fica como a tabela
     escreveu, porque ela é desenho ("dragão quase sempre larga ouro, rato nem
     sempre") e não conta de balanceamento. */
  const faltam = Math.max(0, alvo - evMat - Math.min(evTes, folga));
  const g = m.loot.find(l => l[0] === 'gold');
  const ch = g ? g[1] : 0.85;
  const med = faltam / ch;
  if (g) { g[2] = Math.max(1, Math.round(med * 0.5)); g[3] = Math.max(g[2], Math.round(med * 1.5)); }
  else if (faltam >= 1) m.loot.unshift(['gold', ch, Math.max(1, Math.round(med * 0.5)), Math.round(med * 1.5)]);
}

/* data.js — tabelas do jogo (vocações, itens, afixos, monstros, magias).
   Só dados + fórmulas puras. Nenhuma dependência. */
'use strict';

const XP_MULT = 6;      // ponytail: multiplicador global de xp p/ caber numa sessão; baixe p/ 1 se quiser grind clássico
const SKILL_RATE = 4;   // mesma curva de skill do Tibia, só N× mais rápida (par com XP_MULT); 1 = ritmo original
const MAGIC_BASE = 400; // mana necessária p/ magic level 1

/* ---------------------------------------------------------------- vocações */
/* spd = % da velocidade base ganho por nível. No Tibia todos ganham igual;
   aqui o mago é o mais rápido e o cavaleiro o mais lento, como você pediu. */
const VOCATIONS = {
/* color = tinta do boneco no mapa; art = matiz da carta em assets/vocations,
   que é outra paleta e só a tela de criação usa. */
  knight: {
    name: 'Knight', emoji: '🛡️', color: '#d8a04a', art: '#d25555',
    hp: 15, mana: 5, hpReg: 5, mpReg: 2, spd: 0.65,
    sk: { fist: 1.1, sword: 1.1, axe: 1.1, club: 1.1, distance: 1.4, shielding: 1.1 }, magic: 3.0,
    desc: 'Muito HP e dano corpo a corpo. Aguenta pancada e vive na linha de frente.',
    tags: ['Linha de frente', 'Corpo a corpo', 'Resistência', 'Escudo']
  },
  ranger: {
    name: 'Ranger', emoji: '🏹', color: '#66c48a', art: '#5587d2',
    hp: 10, mana: 15, hpReg: 4, mpReg: 4, spd: 0.85,
    sk: { fist: 1.2, sword: 1.2, axe: 1.2, club: 1.2, distance: 1.1, shielding: 1.1 }, magic: 1.4,
    desc: 'Ataque à distância, bom equilíbrio entre vida e mana.',
    tags: ['Distância', 'Equilíbrio', 'Mobilidade', 'Precisão']
  },
  sorcerer: {
    name: 'Sorcerer', emoji: '🔥', color: '#e05a5a', art: '#ae55d2',
    hp: 5, mana: 30, hpReg: 2, mpReg: 8, spd: 1.25,
    sk: { fist: 1.5, sword: 2.0, axe: 2.0, club: 2.0, distance: 2.0, shielding: 1.5 }, magic: 1.1,
    desc: 'Dano mágico pesado em área. Frágil, mas devastador.',
    tags: ['Dano em área', 'Magia', 'Frágil', 'Ofensivo']
  },
  druid: {
    name: 'Druid', emoji: '❄️', color: '#5aa9ff', art: '#98d255',
    hp: 5, mana: 30, hpReg: 2, mpReg: 8, spd: 1.05,
    sk: { fist: 1.5, sword: 2.0, axe: 2.0, club: 2.0, distance: 2.0, shielding: 1.5 }, magic: 1.1,
    desc: 'Magia de gelo/terra e as melhores curas do jogo.',
    tags: ['Suporte', 'Cura', 'Natureza', 'Controle']
  }
};
/* símbolo da vocação — o arquivo é assets/vocations/<chave>_symbol.png.
   Mesmo caminho dos itens: quem desenha usa innerHTML, então basta a tag. */
for (const k in VOCATIONS) VOCATIONS[k].emoji = `<img class="ii" src="assets/vocations/${k}_symbol.png" alt="">`;

const SKILL_NAMES = {
  fist: 'Punho', sword: 'Espada', axe: 'Machado', club: 'Clava',
  distance: 'Distância', shielding: 'Escudo', magic: 'Magic Level'
};

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
const SPRITE_ID = { dagger: 'dagger' };
const SPRITE_WT = { sword: 'sword', axe: 'axe', distance: 'bow' };
const SPRITE_SLOT = { helmet: 'helmet', armor: 'armor', shield: 'shield', boots: 'boots' };
/* '🔮' é o ico padrão de toda runa: as 7 já eram idênticas entre si, então o
   disco serve pras 7 — o elemento continua vindo do nome e da cor do efeito */
const SPRITE_ICO = { '🧪': 'potion', '🦴': 'bone', '💎': 'gem', '🔮': 'rune_fire' };
/* Arte própria ganha do genérico: se existe um PNG chamado como o id do item,
   é ele. É o que faz "soltar o arquivo na pasta e rodar o script" bastar —
   ICONES vem de src/icones.js, gerado por assets/build_skins.py. */
const spriteOf = o => (typeof ICONES !== 'undefined' && ICONES.has(o.id) ? o.id : null)
  || SPRITE_ID[o.id] || SPRITE_WT[o.wt] || SPRITE_SLOT[o.slot] || SPRITE_ICO[o.ico];
const item = o => {
  const s = spriteOf(o);
  // `spr` fica guardado porque depois de trocar `ico` pelo <img> o spriteOf não
  // casa mais o emoji — e o desenho do item no chão precisa do nome do arquivo
  if (s) {
    o.spr = s;
    /* O 1x é gravado no tamanho exato do slot, então em tela comum o pixel do
       arquivo cai em cima do pixel da tela; em tela densa o srcset entrega o 2x
       e o encaixe se repete. Sem isso o navegador reamostra e volta o borrão. */
    const dobro = typeof ICONES2X !== 'undefined' && ICONES2X.has(s)
      ? ` srcset="assets/icons/${s}.png 1x, assets/icons/${s}@2x.png 2x"` : '';
    o.ico = `<img class="ii" src="assets/icons/${s}.png"${dobro} alt="">`;
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
item({ id: 'gold', n: 'Moedas de Ouro', ico: '🪙', stack: true, price: 1 });

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
item({ id: 'skull', n: 'Crânio', ico: '💀', stack: true, sell: 34 });
item({ id: 'orc_tooth', n: 'Dente de Orc', ico: '🦷', stack: true, sell: 58 });
item({ id: 'rotten_flesh', n: 'Carne Podre', ico: '🥩', stack: true, sell: 11 });
item({ id: 'worm_slime', n: 'Gosma de Verme', ico: '💧', stack: true, sell: 24 });
item({ id: 'iron_ore', n: 'Minério de Ferro', ico: '🪨', stack: true, sell: 145 });
item({ id: 'minotaur_leather', n: 'Couro de Minotauro', ico: '🟫', stack: true, sell: 130 });
item({ id: 'minotaur_horn', n: 'Chifre de Minotauro', ico: '📯', stack: true, sell: 240 });
item({ id: 'cyclops_toe', n: 'Dedão de Ciclope', ico: '🦶', stack: true, sell: 210 });
item({ id: 'dragon_scale', n: 'Escama de Dragão', ico: '🟩', stack: true, sell: 600 });
item({ id: 'red_dragon_scale', n: 'Escama Rubra', ico: '🟥', stack: true, sell: 1250 });
item({ id: 'demon_dust', n: 'Pó Demoníaco', ico: '🟣', stack: true, sell: 950 });
item({ id: 'demon_horn', n: 'Chifre Demoníaco', ico: '😈', stack: true, sell: 1600 });

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

const SHOP_STOCK = ['weak_health_potion', 'health_potion', 'strong_health_potion', 'great_health_potion', 'mana_potion',
  'strong_mana_potion', 'great_mana_potion', 'dagger', 'sabre', 'axe', 'mace', 'short_bow', 'bow',
  'wand_of_vortex', 'snakebite_rod', 'wooden_shield', 'brass_shield', 'leather_helmet', 'soldier_helmet',
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
  'Humanoide':  {}
};
/* golpe sem elemento (espada, garra, flecha comum) conta como físico */
function resistOf(def, el) {
  const e = el || 'physical';
  if (def.res && def.res[e] !== undefined) return def.res[e];
  const c = RES[def.cls];
  return c && c[e] !== undefined ? c[e] : 1;
}

/* --------------------------------------------------------------- monstros */
/* loot: [idDoItem, chance, min, max] — cada linha rola sozinha, então um monstro
   pode largar nenhum item, um, ou a lista inteira. min/max = quantidade (empilháveis).

   spd: velocidade sai da NATUREZA do bicho, não do tier. O jogador nasce com 220
   e passa de 250 no fim, então esta é a régua:
     190-215  peso morto — besouro, verme, ciclope, esqueleto, carniçal
     235-270  humanoide de perna — orc, anão, minotauro
     285-345  caçador e coisa que voa — cobra, lobo, aranha, dragão, demônio
   Quem está abaixo de 220 o jogador alcança e escapa; acima de 260, não.

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
    n: 'Rato', hp: 20, exp: 5, atk: [1, 6], arm: 0, spd: 250, sz: .5, col: 0x8a7b6a, tier: 0, medo: .4,
    loot: [['gold', .8, 1, 10], ['rat_tail', .35, 1, 2], ['meat', .12], ['dagger', .04], ['leather_boots', .02]]
  },
  snake: {
    n: 'Cobra', hp: 30, exp: 8, atk: [2, 9], arm: 2, spd: 290, sz: .45, col: 0x4f8f3a, tier: 0, medo: .3,
    loot: [['gold', .7, 1, 14], ['snake_hide', .3], ['meat', .1], ['health_potion', .05]]
  },
  bug: {
    n: 'Besouro Gigante', hp: 45, exp: 12, atk: [3, 12], arm: 4, spd: 195, sz: .55, col: 0x6b4f2a, tier: 0,
    loot: [['gold', .8, 2, 20], ['bug_shell', .3], ['arrow', .12, 3, 8], ['leather_helmet', .05], ['health_potion', .05]]
  },
  wolf: {
    n: 'Lobo', hp: 65, exp: 22, atk: [5, 18], arm: 3, spd: 345, sz: .7, col: 0x8f8f96, tier: 1, medo: .35,
    loot: [['gold', .85, 4, 30], ['wolf_paw', .25], ['meat', .35, 1, 2], ['bone', .1], ['leather_armor', .06], ['hand_axe', .05]]
  },
  spider: {
    n: 'Aranha', hp: 55, exp: 20, atk: [4, 16], arm: 5, spd: 305, sz: .6, col: 0x2f2f3a, tier: 1,
    hab: { tipo: 'lento', r: 3, lento: .3, dur: 5000, cd: 13000, col: 0xcfd6e0, grito: 'sssss' },
    loot: [['gold', .8, 3, 26], ['spider_silk', .18], ['arrow', .15, 2, 10], ['studded_helmet', .05], ['health_potion', .08]]
  },
  skeleton: {
    n: 'Esqueleto', hp: 80, exp: 35, atk: [6, 22], arm: 6, spd: 215, sz: .8, col: 0xdad2bd, tier: 1,
    loot: [['gold', .9, 5, 38], ['bone', .5, 1, 3], ['skull', .12], ['bolt', .1, 3, 9],
    ['short_sword', .08], ['studded_armor', .06], ['wooden_shield', .07]]
  },
  orc: {
    n: 'Orc', hp: 100, exp: 45, atk: [8, 26], arm: 7, spd: 250, sz: .85, col: 0x6f8f4a, tier: 1, medo: .15,
    loot: [['gold', .9, 8, 48], ['orc_tooth', .25], ['meat', .2], ['arrow', .12, 5, 15],
    ['axe', .06], ['studded_shield', .06], ['studded_legs', .07]]
  },
  orc_spearman: {
    n: 'Orc Lanceiro', hp: 110, exp: 55, atk: [6, 18], arm: 7, spd: 245, sz: .85, col: 0x8aa05a, tier: 2, medo: .25,
    ranged: { min: 10, max: 30, range: 5, col: 0xd2b48c, recua: true },
    loot: [['gold', .9, 10, 58], ['orc_tooth', .3], ['spear', .3, 1, 3], ['arrow', .25, 5, 20],
    ['short_bow', .07], ['studded_armor', .07]]
  },
  ghoul: {
    n: 'Carniçal', hp: 140, exp: 85, atk: [10, 32], arm: 10, spd: 210, sz: .85, col: 0x7d8f6a, tier: 2,
    hab: { tipo: 'lento', r: 1, lento: .5, dur: 5000, cd: 14000, col: 0x8fbf6a, grito: 'Grrhh...' },
    loot: [['gold', .9, 12, 74], ['rotten_flesh', .35], ['skull', .15], ['white_pearl', .04],
    ['brass_helmet', .05], ['chain_armor', .06], ['strong_health_potion', .05]]
  },
  rotworm: {
    n: 'Verme Podre', hp: 120, exp: 70, atk: [9, 28], arm: 12, spd: 190, sz: .7, col: 0xa06a4a, tier: 2,
    loot: [['gold', .9, 10, 62], ['worm_slime', .35], ['meat', .25], ['bone', .15], ['mace', .07], ['brass_legs', .05]]
  },
  dwarf_soldier: {
    n: 'Anão Soldado', hp: 175, exp: 110, atk: [12, 38], arm: 14, spd: 235, sz: .7, col: 0xb08a4a, tier: 2, medo: .12,
    loot: [['gold', .95, 15, 95], ['iron_ore', .25], ['small_ruby', .02], ['health_potion', .1],
    ['battle_axe', .05], ['brass_armor', .06], ['brass_shield', .07],
    ['gg_legs', .01], ['gg_boots', .01], ['gg_sword', .008], ['gg_axe', .008], ['gg_mace', .008]]
  },
  minotaur: {
    n: 'Minotauro', hp: 200, exp: 130, atk: [14, 44], arm: 15, spd: 270, sz: 1.0, col: 0x8a5a3a, tier: 3,
    loot: [['gold', .95, 20, 115], ['minotaur_leather', .3], ['minotaur_horn', .08], ['ham', .2],
    ['sword', .07], ['plate_legs', .04], ['battle_shield', .05]]
  },
  minotaur_archer: {
    n: 'Minotauro Arqueiro', hp: 190, exp: 145, atk: [8, 24], arm: 13, spd: 265, sz: 1.0, col: 0x9a6a2a, tier: 3, medo: .2,
    ranged: { min: 18, max: 52, range: 6, col: 0xe0c080, recua: true },
    loot: [['gold', .95, 22, 125], ['minotaur_leather', .3], ['arrow', .4, 10, 30], ['bolt', .15, 5, 15],
    ['bow', .07], ['crossbow', .03], ['strong_mana_potion', .06]]
  },
  cyclops: {
    n: 'Ciclope', hp: 280, exp: 200, atk: [18, 56], arm: 18, spd: 200, sz: 1.25, col: 0x7a6a5a, tier: 3,
    hab: { tipo: 'area', r: 2, dano: [18, 44], cd: 11000, col: 0xc9a05a, grito: 'ESMAGA!' },
    loot: [['gold', .95, 30, 170], ['cyclops_toe', .25], ['bone', .3, 1, 3], ['ham', .25], ['might_ring', .02],
    ['plate_armor', .05], ['war_hammer', .03], ['steel_helmet', .05]]
  },
  giant_spider: {
    n: 'Aranha Gigante', hp: 380, exp: 320, atk: [22, 68], arm: 20, spd: 310, sz: 1.15, col: 0x3a2f4a, tier: 4,
    hab: { tipo: 'lento', r: 3, lento: .55, dur: 7000, dano: [10, 25], cd: 11000, col: 0xcfd6e0, grito: 'sssSSS' },
    loot: [['gold', .95, 40, 230], ['spider_silk', .4, 1, 2], ['black_pearl', .06], ['life_ring', .03],
    ['knight_legs', .03], ['tower_shield', .02], ['strong_health_potion', .12]]
  },
  demon_skeleton: {
    n: 'Esqueleto Demoníaco', hp: 420, exp: 380, atk: [24, 72], arm: 24, spd: 240, sz: .95, col: 0xc45a2a, tier: 4,
    // já queimou: o fogo que derrete morto-vivo comum não move este
    res: { fire: .5 },
    hab: { tipo: 'cura', val: 90, cd: 15000, col: 0xc98bdd, grito: 'Vita reverto!' },
    loot: [['gold', .95, 45, 260], ['bone', .4, 2, 5], ['skull', .3], ['small_sapphire', .04], ['black_pearl', .05],
    ['serpent_sword', .05], ['knight_armor', .02], ['war_axe', .02]]
  },
  dragon: {
    n: 'Dragão', hp: 700, exp: 700, atk: [26, 80], arm: 25, spd: 295, sz: 1.5, col: 0x2f8f4a, tier: 5,
    ranged: { min: 40, max: 110, range: 6, col: 0xff8020, el: 'fire' },
    hab: { tipo: 'area', r: 3, dano: [35, 85], cd: 9000, el: 'fire', col: 0xff8020, grito: 'GRAAAWR!' },
    loot: [['gold', .98, 60, 330], ['dragon_scale', .35, 1, 2], ['dragon_ham', .3], ['small_diamond', .04], ['talon', .02],
    ['dragon_necklace', .06], ['knight_sword', .05], ['crown_helmet', .03], ['great_health_potion', .15]]
  },
  dragon_lord: {
    n: 'Senhor Dragão', hp: 1300, exp: 1500, atk: [38, 120], arm: 30, spd: 315, sz: 1.7, col: 0xc02020, tier: 6,
    ranged: { min: 70, max: 180, range: 7, col: 0xff4020, el: 'fire' },
    hab: { tipo: 'area', r: 4, dano: [55, 130], cd: 8000, el: 'fire', col: 0xff4020, grito: 'GRAAAWR!' },
    loot: [['gold', .99, 120, 620], ['red_dragon_scale', .4, 1, 2], ['dragon_ham', .5, 1, 2], ['small_diamond', .1], ['gold_ingot', .08],
    ['dragon_scale_mail', .04], ['royal_helmet', .04], ['fire_sword', .04], ['great_mana_potion', .2]]
  },
  demon: {
    n: 'Demônio', hp: 2400, exp: 3500, atk: [60, 190], arm: 38, spd: 345, sz: 1.9, col: 0x8a1030, tier: 7,
    ranged: { min: 110, max: 260, range: 7, col: 0xff2060, el: 'death' },
    hab: { tipo: 'area', r: 4, dano: [80, 190], cd: 7000, el: 'death', col: 0xff2060, grito: 'MORRA!' },
    loot: [['gold', 1, 300, 1200], ['demon_dust', .5, 1, 3], ['demon_horn', .3], ['gold_ingot', .3], ['talon', .15],
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
  cyclops: { shape: 'biped', o: { skin: 0x8f7f6a, eyes: 0xffcc44, weapon: 0x6a5a4a } },
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
  'Dragão':    { cor: 0x9c1f10, seco: false }
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

/* mamíferos */
mob('cave_rat', {
  n: 'Rato de Caverna', hp: 28, exp: 9, atk: [2, 8], arm: 1, spd: 255, sz: .5, col: 0x59504a, tier: 0, medo: .4,
  art: { shape: 'quadruped' }, meta: ['Mamífero', 'harmless'],
  loot: [['gold', .8, 1, 14], ['rat_tail', .4, 1, 2], ['meat', .15], ['bone', .08], ['brown_mushroom', .05]]
});
mob('dire_wolf', {
  n: 'Lobo Atroz', hp: 190, exp: 125, atk: [12, 36], arm: 9, spd: 335, sz: .95, col: 0x4a4a54, tier: 2, medo: .2,
  art: { shape: 'quadruped' }, meta: ['Mamífero', 'easy'],
  loot: [['gold', .9, 12, 70], ['wolf_paw', .35, 1, 2], ['meat', .35, 1, 2], ['bone', .2],
  ['health_potion', .1], ['leather_armor', .05]]
});
mob('winter_wolf', {
  n: 'Lobo Gélido', hp: 260, exp: 195, atk: [16, 46], arm: 12, spd: 330, sz: 1.0, col: 0xb6d0e2, tier: 3, medo: .25,
  hab: { tipo: 'lento', r: 2, lento: .4, dur: 5000, dano: [12, 30], cd: 12000, el: 'ice', col: 0x9fe4ff, grito: 'Auuuuu!' },
  art: { shape: 'quadruped' }, meta: ['Mamífero', 'medium'],
  loot: [['gold', .9, 18, 100], ['wolf_paw', .35, 1, 2], ['meat', .3], ['small_sapphire', .03],
  ['white_pearl', .04], ['strong_health_potion', .08]]
});

/* orcs — a tribo ganha quem cura, quem enlouquece e quem manda */
mob('orc_shaman', {
  n: 'Orc Xamã', hp: 95, exp: 78, atk: [5, 16], arm: 5, spd: 245, sz: .8, col: 0x5f7f3a, tier: 2, medo: .3,
  ranged: { min: 16, max: 42, range: 5, col: 0x9f5aff, el: 'death', recua: true },
  hab: { tipo: 'cura', val: 60, cd: 14000, col: 0x8fdc8f, grito: 'Ug rak zul!' },
  art: { shape: 'biped', o: { skin: 0x7a9a4a, weapon: 0x6a4a7a, eyes: 0xc98bdd } }, meta: ['Humanoide', 'easy'],
  loot: [['gold', .9, 10, 60], ['orc_tooth', .3], ['mana_potion', .2], ['rune_hmm', .05],
  ['elven_amulet', .03], ['studded_armor', .05]]
});
mob('orc_berserker', {
  n: 'Orc Berserker', hp: 145, exp: 105, atk: [14, 42], arm: 5, spd: 268, sz: .9, col: 0x8a6a3a, tier: 2,
  art: { shape: 'biped', o: { skin: 0x9a8a4a, eyes: 0xff4444, weapon: 0x8a5a3a } }, meta: ['Humanoide', 'easy'],
  loot: [['gold', .9, 12, 70], ['orc_tooth', .35], ['meat', .25], ['battle_axe', .05], ['studded_legs', .07]]
});
mob('orc_warlord', {
  n: 'Senhor da Guerra Orc', hp: 300, exp: 235, atk: [20, 58], arm: 16, spd: 258, sz: 1.05, col: 0x4f6f2a, tier: 3, medo: .12,
  hab: { tipo: 'area', r: 2, dano: [20, 50], cd: 11000, col: 0xc9a05a, grito: 'PARA A GUERRA!' },
  art: { shape: 'biped', o: { skin: 0x6f8f3a, weapon: 0x9aa0a8, shield: 0x7a5a3a } }, meta: ['Humanoide', 'medium'],
  loot: [['gold', .95, 25, 140], ['orc_tooth', .4, 1, 2], ['iron_ore', .15], ['barbarian_axe', .05],
  ['viking_shield', .06], ['plate_armor', .04]]
});

/* mortos-vivos */
mob('skeleton_warrior', {
  n: 'Esqueleto Guerreiro', hp: 165, exp: 108, atk: [12, 36], arm: 14, spd: 212, sz: .85, col: 0xc8c0a8, tier: 2,
  art: { shape: 'biped', o: { thin: true, skin: 0xe8e2d0, eyes: 0xff4444, weapon: 0x9aa0a8, shield: 0x8a7a4a } },
  meta: ['Morto-vivo', 'easy'],
  loot: [['gold', .9, 12, 70], ['bone', .5, 1, 3], ['skull', .2], ['short_sword', .07],
  ['brass_shield', .05], ['chain_armor', .05]]
});
mob('skeleton_archer', {
  n: 'Esqueleto Arqueiro', hp: 130, exp: 96, atk: [6, 18], arm: 9, spd: 216, sz: .8, col: 0xd8d0b8, tier: 2,
  ranged: { min: 14, max: 40, range: 6, col: 0xd9c48a, recua: true },
  art: { shape: 'biped', o: { thin: true, skin: 0xe0dac6, eyes: 0xffee88, weapon: 0x8a6a3a } },
  meta: ['Morto-vivo', 'easy'],
  loot: [['gold', .9, 10, 60], ['bone', .45, 1, 3], ['arrow', .35, 5, 20], ['bolt', .2, 3, 10],
  ['short_bow', .07], ['studded_armor', .05]]
});
mob('necrophage', {
  n: 'Necrófago', hp: 230, exp: 165, atk: [14, 42], arm: 13, spd: 205, sz: .9, col: 0x5f7050, tier: 3,
  hab: { tipo: 'lento', r: 2, lento: .45, dur: 6000, dano: [10, 24], cd: 13000, col: 0x8fbf6a, grito: 'Hrrgghh...' },
  art: { shape: 'biped', o: { skin: 0x7a8a60, eyes: 0xffee88 } }, meta: ['Morto-vivo', 'medium'],
  loot: [['gold', .9, 16, 92], ['rotten_flesh', .4], ['skull', .2], ['black_pearl', .04],
  ['brass_armor', .05], ['strong_health_potion', .08]]
});
mob('lich', {
  n: 'Lich', hp: 620, exp: 640, atk: [18, 50], arm: 22, spd: 228, sz: .95, col: 0x6a4a8a, tier: 5,
  ranged: { min: 55, max: 140, range: 7, col: 0x9f5aff, el: 'death', recua: true },
  hab: { tipo: 'cura', val: 130, cd: 14000, col: 0xc98bdd, grito: 'Mors non est finis!' },
  art: { shape: 'biped', o: { thin: true, skin: 0xd8d0c0, eyes: 0x9f5aff, weapon: 0x9f5aff } },
  meta: ['Morto-vivo', 'hard'],
  loot: [['gold', .95, 60, 320], ['skull', .4], ['bone', .35, 1, 4], ['small_sapphire', .08],
  ['blue_gem', .03], ['skull_staff', .04], ['great_mana_potion', .12]]
});

/* aracnídeos e insetos */
mob('poison_spider', {
  n: 'Aranha Venenosa', hp: 105, exp: 62, atk: [8, 26], arm: 8, spd: 300, sz: .7, col: 0x4a6a2a, tier: 2,
  hab: { tipo: 'lento', r: 2, lento: .35, dur: 6000, dano: [8, 20], cd: 12000, col: 0x8fd14a, grito: 'ssshh' },
  art: { shape: 'arachnid' }, meta: ['Aracnídeo', 'easy'],
  loot: [['gold', .8, 6, 44], ['spider_silk', .22], ['health_potion', .1], ['studded_helmet', .05], ['arrow', .15, 3, 12]]
});
mob('tarantula', {
  n: 'Tarântula', hp: 240, exp: 178, atk: [16, 46], arm: 14, spd: 315, sz: .95, col: 0x6a4a2a, tier: 3,
  art: { shape: 'arachnid' }, meta: ['Aracnídeo', 'medium'],
  loot: [['gold', .9, 18, 105], ['spider_silk', .3], ['bug_shell', .2], ['white_pearl', .05],
  ['plate_legs', .03], ['strong_health_potion', .08]]
});
mob('fire_beetle', {
  n: 'Besouro de Fogo', hp: 70, exp: 32, atk: [5, 18], arm: 8, spd: 200, sz: .6, col: 0xb0402a, tier: 1,
  hab: { tipo: 'area', r: 1, dano: [10, 26], cd: 12000, el: 'fire', col: 0xff7a20, grito: '*estala*' },
  art: { shape: 'arachnid' }, meta: ['Inseto', 'trivial'],
  loot: [['gold', .8, 3, 26], ['bug_shell', .35], ['meat', .1], ['health_potion', .06], ['rune_explosion', .02]]
});
mob('carrion_worm', {
  n: 'Verme Carniceiro', hp: 300, exp: 195, atk: [16, 48], arm: 18, spd: 185, sz: .95, col: 0x8a4a3a, tier: 3,
  art: { shape: 'worm' }, meta: ['Inseto', 'medium'],
  loot: [['gold', .9, 20, 110], ['worm_slime', .4, 1, 2], ['rotten_flesh', .3], ['bone', .2],
  ['ham', .2], ['war_hammer', .02]]
});

/* répteis */
mob('cobra', {
  n: 'Naja', hp: 60, exp: 27, atk: [4, 16], arm: 4, spd: 300, sz: .55, col: 0x8a7a2a, tier: 1, medo: .3,
  art: { shape: 'serpent' }, meta: ['Réptil', 'trivial'],
  loot: [['gold', .75, 3, 24], ['snake_hide', .35], ['meat', .12], ['health_potion', .07], ['brown_mushroom', .06]]
});
mob('serpent_spawn', {
  n: 'Serpe Anciã', hp: 780, exp: 840, atk: [30, 88], arm: 26, spd: 300, sz: 1.5, col: 0x2a6a5a, tier: 5,
  ranged: { min: 45, max: 120, range: 6, col: 0x7ac24a, el: 'earth' },
  hab: { tipo: 'area', r: 3, dano: [38, 92], cd: 9500, el: 'earth', col: 0x7ac24a, grito: 'SSSHAAAA!' },
  art: { shape: 'serpent' }, meta: ['Réptil', 'hard'],
  loot: [['gold', .98, 70, 360], ['snake_hide', .5, 1, 3], ['green_gem', .04], ['small_sapphire', .08],
  ['terra_rod', .04], ['dragon_ham', .2], ['great_health_potion', .15]]
});

/* anões */
mob('dwarf_guard', {
  n: 'Anão Guardião', hp: 300, exp: 205, atk: [16, 50], arm: 22, spd: 230, sz: .75, col: 0x9a7a3a, tier: 3, medo: .1,
  art: { shape: 'biped', o: { skin: 0xd8b98a, weapon: 0x9aa0a8, shield: 0xb08a4a } }, meta: ['Humanoide', 'medium'],
  loot: [['gold', .95, 22, 130], ['iron_ore', .35], ['small_ruby', .04], ['dwarven_shield', .04],
  ['plate_armor', .04], ['health_potion', .12],
  ['gg_helmet', .01], ['gg_armor', .01], ['gg_shield', .012], ['gg_halberd', .008], ['gg_greatsword', .008]]
});
mob('dwarf_geomancer', {
  n: 'Anão Geomante', hp: 210, exp: 190, atk: [8, 24], arm: 14, spd: 238, sz: .7, col: 0x7a6a9a, tier: 3, medo: .25,
  ranged: { min: 30, max: 80, range: 6, col: 0x8ac24a, el: 'earth', recua: true },
  art: { shape: 'biped', o: { skin: 0xd8b98a, weapon: 0x8ac24a, eyes: 0x8ac24a } }, meta: ['Humanoide', 'medium'],
  loot: [['gold', .95, 20, 120], ['iron_ore', .3], ['small_sapphire', .04], ['dwarven_ring', .03],
  ['mana_potion', .2], ['springsprout_rod', .03],
  ['gg_amulet', .012], ['gg_ring', .012], ['gg_maul', .008], ['gg_greataxe', .008]]
});

/* minotauros e gigantes */
mob('minotaur_mage', {
  n: 'Minotauro Mago', hp: 290, exp: 265, atk: [10, 30], arm: 14, spd: 265, sz: 1.0, col: 0x8a4a6a, tier: 4, medo: .25,
  ranged: { min: 35, max: 95, range: 6, col: 0xff7a20, el: 'fire', recua: true },
  hab: { tipo: 'area', r: 2, dano: [28, 66], cd: 11000, el: 'fire', col: 0xff7a20, grito: 'Mor gah!' },
  art: { shape: 'biped', o: { horns: true, skin: 0x9a5a6a, weapon: 0xff7a20, eyes: 0xff7a20 } },
  meta: ['Humanoide', 'hard'],
  loot: [['gold', .95, 25, 140], ['minotaur_leather', .3], ['minotaur_horn', .1], ['mana_potion', .25],
  ['wand_of_dragonbreath', .03], ['elven_amulet', .05]]
});
mob('minotaur_guard', {
  n: 'Minotauro Guarda', hp: 420, exp: 335, atk: [22, 66], arm: 24, spd: 262, sz: 1.15, col: 0x6a3a2a, tier: 4,
  art: { shape: 'biped', o: { horns: true, skin: 0x8a4a34, weapon: 0x9aa0a8, shield: 0x7a6a4a } },
  meta: ['Humanoide', 'hard'],
  loot: [['gold', .95, 32, 180], ['minotaur_leather', .35, 1, 2], ['minotaur_horn', .12], ['ham', .3],
  ['spike_sword', .04], ['knight_legs', .03], ['tower_shield', .02]]
});
mob('cyclops_smith', {
  n: 'Ciclope Ferreiro', hp: 420, exp: 335, atk: [22, 66], arm: 26, spd: 198, sz: 1.3, col: 0x5a6a7a, tier: 4,
  hab: { tipo: 'area', r: 2, dano: [26, 60], cd: 11000, col: 0xffa53a, grito: 'MARTELA!' },
  art: { shape: 'biped', o: { skin: 0x7a7a6a, eyes: 0xffcc44, weapon: 0x9aa0a8 } }, meta: ['Gigante', 'hard'],
  loot: [['gold', .95, 40, 220], ['cyclops_toe', .3], ['iron_ore', .3], ['gold_ingot', .03],
  ['war_hammer', .05], ['steel_helmet', .06], ['plate_armor', .05]]
});

/* dragões e demônios */
mob('dragon_hatchling', {
  n: 'Filhote de Dragão', hp: 320, exp: 265, atk: [16, 48], arm: 16, spd: 290, sz: .95, col: 0x4aa05a, tier: 3, medo: .2,
  ranged: { min: 22, max: 60, range: 5, col: 0xff8020, el: 'fire' },
  art: { shape: 'dragon' }, meta: ['Dragão', 'medium'],
  loot: [['gold', .95, 25, 140], ['dragon_scale', .2], ['dragon_ham', .2], ['meat', .2],
  ['health_potion', .12], ['serpent_sword', .03]]
});
mob('frost_dragon', {
  n: 'Dragão Gélido', hp: 1500, exp: 1750, atk: [40, 126], arm: 32, spd: 310, sz: 1.7, col: 0x7ac4e0, tier: 6,
  ranged: { min: 75, max: 190, range: 7, col: 0x9fe4ff, el: 'ice' },
  hab: { tipo: 'area', r: 4, dano: [58, 138], cd: 8000, el: 'ice', col: 0x9fe4ff, grito: 'GRAAAWR!' },
  art: { shape: 'dragon' }, meta: ['Dragão', 'challenging'],
  loot: [['gold', .99, 130, 640], ['dragon_scale', .45, 1, 2], ['small_sapphire', .12], ['gold_ingot', .08],
  ['hailstorm_rod', .04], ['tower_shield', .05], ['great_mana_potion', .2]]
});
mob('fire_devil', {
  n: 'Diabrete', hp: 380, exp: 335, atk: [20, 60], arm: 20, spd: 320, sz: .85, col: 0xc04a2a, tier: 4,
  ranged: { min: 30, max: 85, range: 5, col: 0xff7a20, el: 'fire' },
  art: { shape: 'biped', o: { horns: true, wings: true, skin: 0xc0502a, eyes: 0xffdd00, hornCol: 0x2a0a12, weapon: 0xff6a20 } },
  meta: ['Demônio', 'hard'],
  loot: [['gold', .95, 40, 230], ['demon_dust', .15], ['small_ruby', .05], ['talon', .03],
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
  n: 'Presa-Branca, o Alfa', hp: 900, exp: 1400, atk: [22, 62], arm: 14, spd: 340, sz: 1.3, col: 0xe8e4dc, tier: 3,
  hab: { tipo: 'area', r: 2, dano: [24, 58], cd: 10000, col: 0xdfe8f0, grito: 'AUUUUUU!' },
  art: { shape: 'quadruped' }, meta: ['Mamífero', 'boss'],
  /* o Alfa é a porta do Caçador Ancestral: caça de floresta larga equipamento de
     caçador. Chance alta por peça porque são 8 e ele nasce um por região */
  loot: [['gold', 1, 260, 700], ['wolf_paw', 1, 2, 4], ['dragon_ham', .5], ['boots_of_haste', .12],
  ['time_ring', .2], ['leather_armor', .4], ['strong_health_potion', .6, 1, 3],
  ['ah_hood', .16], ['ah_armor', .13], ['ah_legs', .15], ['ah_boots', .16],
  ['ah_shield', .14], ['ah_amulet', .15], ['ah_ring', .15], ['ah_bow', .12]]
});
boss('orc_warchief', {
  n: 'Gruk, Chefe de Guerra', hp: 1400, exp: 2200, atk: [30, 84], arm: 22, spd: 260, sz: 1.35, col: 0x3f5f1a, tier: 4,
  hab: { tipo: 'area', r: 3, dano: [34, 78], cd: 9000, col: 0xc9a05a, grito: 'MATEM TODOS!' },
  art: { shape: 'biped', o: { skin: 0x5f7f2a, eyes: 0xff4444, weapon: 0x9aa0a8, shield: 0x7a5a3a } },
  meta: ['Humanoide', 'boss'],
  loot: [['gold', 1, 400, 1000], ['orc_tooth', 1, 3, 6], ['barbarian_axe', .25], ['viking_shield', .3],
  ['noble_armor', .15], ['might_ring', .18], ['strong_health_potion', .6, 1, 3],
  ['fs_hood', .14], ['fs_armor', .11], ['fs_legs', .13], ['fs_boots', .14],
  ['fs_shield', .12], ['fs_amulet', .13], ['fs_ring', .13], ['fs_bow', .10]]
});
boss('bone_lord', {
  n: 'Osgar, Senhor dos Ossos', hp: 1800, exp: 2900, atk: [32, 92], arm: 26, spd: 210, sz: 1.3, col: 0xb8ae90, tier: 5,
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
  n: 'Rainha do Enxame', hp: 1100, exp: 1700, atk: [26, 70], arm: 24, spd: 240, sz: 1.45, col: 0x7a6a1a, tier: 4,
  hab: { tipo: 'lento', r: 3, lento: .5, dur: 7000, dano: [20, 48], cd: 10000, col: 0x8fd14a, grito: 'kkkrrRRK!' },
  art: { shape: 'arachnid' }, meta: ['Inseto', 'boss'],
  loot: [['gold', 1, 300, 800], ['bug_shell', 1, 3, 6], ['spider_silk', .7, 1, 3], ['white_pearl', .4, 1, 2],
  ['elven_amulet', .2], ['brass_armor', .3], ['strong_health_potion', .5, 1, 2],
  ['ai_hood', .16], ['ai_armor', .13], ['ai_legs', .15], ['ai_boots', .16],
  ['ai_tome', .14], ['ai_amulet', .15], ['ai_ring', .15], ['ai_staff', .12]]
});
boss('dwarf_king', {
  n: 'Durnak, Rei sob a Pedra', hp: 2200, exp: 3400, atk: [36, 100], arm: 34, spd: 235, sz: 1.1, col: 0xc9a13a, tier: 5,
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
  n: 'Amaruk, Rei Minotauro', hp: 2600, exp: 4200, atk: [42, 116], arm: 32, spd: 272, sz: 1.6, col: 0x7a2a1a, tier: 5,
  hab: { tipo: 'area', r: 3, dano: [46, 106], cd: 8500, col: 0xff8a3a, grito: 'AJOELHE-SE!' },
  art: { shape: 'biped', o: { horns: true, skin: 0x9a3a24, eyes: 0xff4444, weapon: 0xffd070, hornCol: 0x2a1a12 } },
  meta: ['Humanoide', 'boss'],
  loot: [['gold', 1, 700, 1800], ['minotaur_horn', 1, 2, 4], ['minotaur_leather', 1, 3, 6], ['small_diamond', .35],
  ['giant_sword', .12], ['warrior_helmet', .15], ['knight_armor', .12], ['great_health_potion', .6, 1, 3]]
});
boss('cyclops_king', {
  n: 'Brontes, o Ogro-Rei', hp: 2000, exp: 3000, atk: [40, 110], arm: 30, spd: 205, sz: 1.75, col: 0x6a5a48, tier: 5,
  hab: { tipo: 'area', r: 3, dano: [44, 100], cd: 9000, col: 0xc9a05a, grito: 'ESMAGA TUDO!' },
  art: { shape: 'biped', o: { skin: 0x8a7a64, eyes: 0xffcc44, weapon: 0x6a5a4a } }, meta: ['Gigante', 'boss'],
  loot: [['gold', 1, 550, 1400], ['cyclops_toe', 1, 2, 5], ['bone', .8, 3, 7], ['gold_ingot', .25],
  ['thunder_hammer', .08], ['tower_shield', .18], ['royal_helmet', .12], ['great_health_potion', .5, 1, 2]]
});
boss('broodmother', {
  n: 'Mãe das Ninhadas', hp: 3200, exp: 5200, atk: [48, 130], arm: 30, spd: 315, sz: 1.75, col: 0x2a1a34, tier: 6,
  hab: { tipo: 'lento', r: 4, lento: .6, dur: 8000, dano: [40, 96], cd: 9000, col: 0xcfd6e0, grito: 'SSSSSSS!' },
  art: { shape: 'arachnid' }, meta: ['Aracnídeo', 'boss'],
  loot: [['gold', 1, 800, 2000], ['spider_silk', 1, 4, 8], ['black_pearl', .8, 2, 4], ['talon', .25],
  ['vampire_shield', .1], ['soft_boots', .1], ['life_ring', .3], ['great_health_potion', .7, 1, 3]]
});
boss('dragon_matriarch', {
  n: 'Escamas-de-Fogo, a Matriarca', hp: 4200, exp: 7000, atk: [55, 150], arm: 34, spd: 300, sz: 1.9, col: 0xd8721a, tier: 6,
  ranged: { min: 90, max: 220, range: 7, col: 0xff6a10, el: 'fire' },
  hab: { tipo: 'area', r: 4, dano: [66, 158], cd: 8000, el: 'fire', col: 0xff6a10, grito: 'GRAAAAAWR!' },
  art: { shape: 'dragon' }, meta: ['Dragão', 'boss'],
  loot: [['gold', 1, 1100, 2600], ['red_dragon_scale', 1, 2, 5], ['dragon_scale', 1, 3, 6], ['small_diamond', .6, 1, 2],
  ['dragon_scale_mail', .12], ['fire_sword', .15], ['dragon_necklace', .35], ['great_health_potion', .8, 2, 4]]
});
boss('demon_lord', {
  n: 'Zathrax, Senhor do Fosso', hp: 8000, exp: 15000, atk: [80, 240], arm: 44, spd: 340, sz: 2.1, col: 0x5a0820, tier: 7,
  ranged: { min: 140, max: 320, range: 8, col: 0xff2060, el: 'death' },
  hab: { tipo: 'area', r: 5, dano: [100, 240], cd: 6500, el: 'death', col: 0xff2060, grito: 'AJOELHE-SE OU MORRA!' },
  art: { shape: 'biped', o: { horns: true, wings: true, skin: 0x7a0a24, eyes: 0xffdd00, hornCol: 0x1a050a, weapon: 0xff2060 } },
  meta: ['Demônio', 'boss'],
  loot: [['gold', 1, 2000, 5000], ['demon_horn', 1, 2, 4], ['demon_dust', 1, 3, 6], ['gold_ingot', .8, 2, 4],
  ['magic_plate_armor', .12], ['demon_helmet', .18], ['magic_sword', .12], ['royal_crossbow', .12],
  ['great_health_potion', 1, 3, 6]]
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
  { id: 'demon_pit', n: 'Fosso Demoníaco', z: 3, r: 7, lvl: 80, boss: 'demon_lord', mobs: ['demon', 'dragon_lord', 'fire_devil', 'lich'], best: 'o melhor loot do jogo' }
];

/* pools de spawn por andar e faixa de distância do templo */
const SPAWN_POOLS = {
  1: [ // superfície: fica mais perigoso longe do templo
    { r: [10, 28], mobs: ['rat', 'snake', 'bug', 'cobra'] },
    { r: [28, 50], mobs: ['wolf', 'spider', 'skeleton', 'orc', 'fire_beetle', 'poison_spider'] },
    { r: [50, 75], mobs: ['orc', 'orc_spearman', 'orc_shaman', 'orc_berserker', 'ghoul', 'rotworm', 'minotaur', 'dire_wolf', 'skeleton_warrior'] },
    { r: [75, 999], mobs: ['minotaur', 'minotaur_archer', 'cyclops', 'giant_spider', 'orc_warlord', 'tarantula', 'winter_wolf'] }
  ],
  // montanha: frio e alto, é onde o que voa e o que gosta de gelo vive
  0: [{ r: [0, 999], mobs: ['minotaur_archer', 'cyclops', 'giant_spider', 'dragon', 'winter_wolf', 'dragon_hatchling', 'frost_dragon'] }],
  2: [{ r: [0, 999], mobs: ['rotworm', 'dwarf_soldier', 'ghoul', 'minotaur', 'cyclops', 'dwarf_guard', 'dwarf_geomancer', 'necrophage', 'carrion_worm', 'skeleton_archer'] }],
  3: [{ r: [0, 999], mobs: ['demon_skeleton', 'giant_spider', 'dragon', 'dragon_lord', 'demon', 'lich', 'serpent_spawn', 'fire_devil', 'minotaur_guard', 'minotaur_mage'] }]
};

/* --------------------------------------------------------------- magias */
/* type: attack (alvo) | beam (linha) | wave (cone) | aoe (área em volta)
         heal | buff  ;  f = fator por magic level ; base = dano/cura mínima */
const SPELLS = [
  { id: 'exura', w: 'exura', n: 'Cura Leve', type: 'heal', lvl: 8, mana: 25, cd: 1000, voc: ['knight', 'ranger', 'sorcerer', 'druid'], base: 30, f: 2.2, ico: '💚' },
  { id: 'exura_ico', w: 'exura ico', n: 'Cura do Cavaleiro', type: 'heal', lvl: 8, mana: 40, cd: 1000, voc: ['knight'], base: 55, f: 3.5, ico: '💚' },
  { id: 'exura_gran', w: 'exura gran', n: 'Cura Intensa', type: 'heal', lvl: 20, mana: 70, cd: 1000, voc: ['ranger', 'sorcerer', 'druid'], base: 90, f: 4.5, ico: '💚' },
  { id: 'exura_vita', w: 'exura vita', n: 'Cura Suprema', type: 'heal', lvl: 32, mana: 160, cd: 1000, voc: ['druid'], base: 200, f: 8, ico: '💚' },
  { id: 'exura_san', w: 'exura san', n: 'Cura Sagrada', type: 'heal', lvl: 32, mana: 155, cd: 1000, voc: ['ranger'], base: 170, f: 7, ico: '💚' },

  { id: 'exori_vis', w: 'exori vis', n: 'Golpe de Energia', type: 'attack', lvl: 12, mana: 20, cd: 1200, voc: ['sorcerer'], base: 30, f: 3.6, el: 'energy', col: 0x5aa9ff, ico: '⚡' },
  { id: 'exori_flam', w: 'exori flam', n: 'Golpe de Fogo', type: 'attack', lvl: 12, mana: 20, cd: 1200, voc: ['sorcerer', 'druid'], base: 26, f: 3.2, el: 'fire', ico: '🔥' },
  { id: 'exori_frigo', w: 'exori frigo', n: 'Golpe de Gelo', type: 'attack', lvl: 14, mana: 20, cd: 1200, voc: ['druid'], base: 30, f: 3.6, el: 'ice', ico: '❄️' },
  { id: 'exori_tera', w: 'exori tera', n: 'Golpe de Terra', type: 'attack', lvl: 13, mana: 20, cd: 1200, voc: ['druid'], base: 28, f: 3.4, el: 'earth', ico: '🌿' },
  { id: 'exori_san', w: 'exori san', n: 'Míssil Divino', type: 'attack', lvl: 18, mana: 22, cd: 1100, voc: ['ranger'], base: 30, f: 3.2, el: 'holy', ico: '✨' },

  { id: 'exevo_flam_hur', w: 'exevo flam hur', n: 'Onda de Fogo', type: 'wave', lvl: 18, mana: 40, cd: 2000, voc: ['sorcerer'], base: 40, f: 3.4, el: 'fire', col: 0xff6a10, ico: '🌊' },
  { id: 'exevo_frigo_hur', w: 'exevo frigo hur', n: 'Onda de Gelo', type: 'wave', lvl: 18, mana: 40, cd: 2000, voc: ['druid'], base: 40, f: 3.4, el: 'ice', col: 0x9fe4ff, ico: '🌊' },
  { id: 'exevo_vis_lux', w: 'exevo vis lux', n: 'Raio de Energia', type: 'beam', lvl: 23, mana: 60, cd: 2200, voc: ['sorcerer'], base: 60, f: 4.6, el: 'energy', ico: '➖' },
  { id: 'exevo_mas_san', w: 'exevo mas san', n: 'Caldeira Divina', type: 'aoe', lvl: 30, mana: 130, cd: 3000, voc: ['ranger'], base: 70, f: 4.2, el: 'holy', col: 0xfff0b0, r: 3, ico: '💥' },
  { id: 'exevo_gran_mas_vis', w: 'exevo gran mas vis', n: 'Explosão Suprema', type: 'aoe', lvl: 45, mana: 300, cd: 6000, voc: ['sorcerer'], base: 190, f: 9, el: 'energy', col: 0x9f7aff, r: 4, ico: '💥' },
  { id: 'exevo_gran_mas_frigo', w: 'exevo gran mas frigo', n: 'Tempestade de Gelo', type: 'aoe', lvl: 45, mana: 300, cd: 6000, voc: ['druid'], base: 180, f: 8.6, el: 'ice', col: 0xa8ecff, r: 4, ico: '💥' },

  { id: 'exori', w: 'exori', n: 'Fúria', type: 'melee_aoe', lvl: 22, mana: 90, cd: 3000, voc: ['knight'], mult: 1.9, r: 1, col: 0xffd070, ico: '💢' },
  { id: 'exori_gran', w: 'exori gran', n: 'Fúria Selvagem', type: 'melee_aoe', lvl: 40, mana: 170, cd: 5000, voc: ['knight'], mult: 3.4, r: 1, col: 0xff9040, ico: '💢' },
  { id: 'exori_hur', w: 'exori hur', n: 'Lâmina Giratória', type: 'melee_aoe', lvl: 28, mana: 120, cd: 4000, voc: ['knight'], mult: 2.2, r: 2, col: 0xffb060, ico: '🌀' },

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
  { id: 'exori_min', w: 'exori min', n: 'Golpe Rápido', type: 'melee', lvl: 1, mana: 15, cd: 1400, voc: ['knight'], mult: 1.3, col: 0xffd070, ico: '⚔️' },
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
  { id: 'exevo_tera_hur', w: 'exevo tera hur', n: 'Onda de Terra', type: 'wave', lvl: 26, mana: 70, cd: 2200, voc: ['druid'], base: 62, f: 4.1, el: 'earth', col: 0x8ac24a, ico: '🌊' },
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

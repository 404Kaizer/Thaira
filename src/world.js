/* world.js — geração do mundo (6 andares), pathfinding, luz por andar e
   minimapa. Só dados: quem desenha é render2d.js. Depende de data.js. */
'use strict';

/* Os dois andares de baixo são o endgame: a progressão do jogo é VERTICAL, como
   em Tibia — descer é o que separa o nível 60 do nível 300, e cada degrau tem a
   própria família de criatura, o próprio loot e o próprio chefe. Andar novo é
   barato aqui (o gerador de caverna já é genérico), então quando a curva
   precisar de mais fôlego, o caminho é FLOORS+1 e mais um pool de spawn. */
/* `let` e não `const` porque o tamanho do mapa passou a vir do ARQUIVO: cada
   terra tem o seu (Varrokgaard 192×192, Aleto 320×320), e um sistema de subsolo
   tem o dele. Os valores abaixo são o do gerador, que continua sendo o mundo
   enquanto nenhuma terra estiver desenhada. Quem troca é o `mapaAplica`. */
/* Qual terra o jogo carrega. `null` = gera pela semente; nome de arquivo em
   maps/ = a terra desenhada. É STRING: sem aspas isto é um identificador solto
   e o world.js inteiro morre de ReferenceError na carga, com o jogo abrindo em
   tela preta e sem erro que aponte para cá. */
const MAPA_ATUAL = 'varrokgaard';   // null volta ao gerador; ver #46
/* As dimensões DO GERADOR, separadas das variáveis. O gerador produz um mundo
   de 224x224 em 6 andares e precisa dizer isso toda vez que roda — senão, depois
   de carregar um mapa menor, ele geraria com o tamanho do outro e quebraria nas
   escadas. Foi exatamente o que o teste de mapa pequeno pegou. */
const GEN = { w: 224, h: 224, andares: 6, sup: 1, fundo: 4,
  nomes: ['Pico da Montanha (+1)', 'Superfície (0)', 'Caverna (-1)', 'Abismo (-2)', 'Fenda (-3)', 'Coração do Abismo (-4)'] };
let W = GEN.w, H = GEN.h, FLOORS = GEN.andares, SURF = GEN.sup;   // 0=montanha 1=superfície 2=caverna 3=abismo 4=fenda 5=coração
let FLOOR_NAMES = GEN.nomes;
let DEEP = GEN.fundo;   // a partir daqui é endgame: mais lava, mais elite, sem meio-termo

/* Os cinco últimos são COISA CONSTRUÍDA, e existem porque não havia nenhum: a
   vila de Varrokgaard foi feita de T.ROCK e do chão uma parede de casa ficou
   indistinguível de um matacão. Um material, um significado — parede, piso,
   porta, cerca e lavoura não podem sair todos da mesma pedra. */
const T = { VOID: 0, GRASS: 1, DIRT: 2, SAND: 3, WATER: 4, ROCK: 5, TREE: 6, CFLOOR: 7, CWALL: 8, LAVA: 9, DOWN: 10, UP: 11, TEMPLE: 12, SNOW: 13, SWAMP: 14,
  /* madeira — Varrokgaard é fazenda, e fazenda se constrói de tábua */
  WALL: 15, FLOOR: 16, DOOR: 17, FENCE: 18, CROP: 19, PIER: 20, HAY: 21, PROP: 22,
  /* pedra lavrada — Vigília, as Ruínas e o Labirinto. O que denuncia que um
     homem construiu é a regularidade, e sem bloco esquadrejado não há como
     distinguir o Labirinto do rei de uma caverna qualquer. */
  SWALL: 23, PAVE: 24, RUBBLE: 25,
  /* subsolo — uma forma por sistema: a Mina cavada com plano, o Ninho comido
     por bicho, o Selo e o que vaza dele */
  ORE: 26, GRAVEL: 27, WEB: 28, WEBF: 29, BONE: 30, ASH: 31, MOSS: 32,
  /* chão marcado: o que aconteceu ali fica no chão. Não confundir com o sangue
     de combate (drawBlood) nem com campo elemental (criaCampo) — os dois são
     transitórios e do motor; estes dois são AUTORAIS, o autor põe no mapa. */
  GORE: 33, RUNE: 34,
  /* móveis da vila — o que faz uma rua parecer habitada em vez de um corredor
     entre casas. Todos são OBJETO (`top` entre 0 e 0,5): barram o pé e não a
     vista, que é o mesmo caminho da cerca e do escoramento. O curral NÃO entra
     aqui: curral é cerca em volta de terra batida, e já dá para escrever. */
  WELL: 35, CART: 36, BARREL: 37, MILL: 38 };
const TILE = {
  [T.VOID]:   { c: 0x000000, top: 0,    walk: false, hide: true },
  [T.GRASS]:  { c: 0x55913a, top: 0,    walk: true,  tex: 'grass' },
  [T.DIRT]:   { c: 0x7a5c30, top: 0,    walk: true,  tex: 'dirt' },
  [T.SAND]:   { c: 0xd8bd6e, top: 0,    walk: true,  tex: 'sand' },
  [T.WATER]:  { c: 0x1f5f9e, top: -0.28, walk: false, tex: 'water' },
  [T.ROCK]:   { c: 0x5a6674, top: 1.1,  walk: false, tex: 'rock' },
  [T.TREE]:   { c: 0x27512f, top: 0,    walk: false, tex: 'grass' },
  [T.CFLOOR]: { c: 0x63543f, top: 0,    walk: true,  tex: 'cave' },
  [T.CWALL]:  { c: 0x2c2822, top: 1.1,  walk: false, tex: 'rock' },
  [T.LAVA]:   { c: 0xe64a18, top: -0.1, walk: false, tex: 'lava' },
  [T.DOWN]:   { c: 0x2f2a22, top: 0,    walk: true,  tex: 'cave' },
  [T.UP]:     { c: 0xa89778, top: 0,    walk: true,  tex: 'stone' },
  [T.TEMPLE]: { c: 0xc9b892, top: 0,    walk: true,  tex: 'stone' },
  [T.SNOW]:   { c: 0xdcecf7, top: 0,    walk: true,  tex: 'snow' },
  [T.SWAMP]:  { c: 0x5f682a, top: -0.06, walk: true, tex: 'swamp' },
  [T.WALL]:   { c: 0x6b3a1e, top: 1.1,  walk: false, tex: 'wall' },
  [T.FLOOR]:  { c: 0xa07444, top: 0,    walk: true,  tex: 'plank' },
  /* Porta CLARA de propósito: ela vive dentro de uma parede escura, e uma
     porta mais escura que a parede vira buraco. O que a lê é o contraste
     com o que a cerca, não a cor dela sozinha. */
  [T.DOOR]:   { c: 0x7a5330, top: 0,    walk: true,  tex: 'door' },
  /* Cerca tem `top` entre 0 e 0,5 de propósito: 0,5 é a régua que corta a
     vista (tapaVista) e desenha volume de parede. Abaixo dela o tile barra o
     pé e não os olhos, que é exatamente o que uma cerca faz — a guarda da
     Cerca Nova vê o que vem do outro lado. O chão sob ela é terra pisada. */
  [T.FENCE]:  { c: 0x66512e, top: 0.4,  walk: false, tex: 'dirt', obj: 'cerca' },
  [T.CROP]:   { c: 0x93a83f, top: 0,    walk: true,  tex: 'crop' },
  /* Trapiche: tábua SOBRE a água. É por isso que existe — sem ele, o Trapiche e
     o Embarcadouro de Varrokgaard teriam de ser aterrados de areia. */
  [T.PIER]:   { c: 0x8a6a3c, top: 0,    walk: true,  tex: 'pier' },
  [T.HAY]:    { c: 0x9c8340, top: 0,    walk: true,  tex: 'hay' },
  /* Escoramento barra o pé e não a vista: é um pórtico de viga, e olhar
     galeria abaixo por entre as escoras é metade do que faz a Mina parecer
     mina. Mesmo caminho da cerca — `c` e `tex` são o CHÃO sob o objeto, e a
     madeira dele é constante do art.js, porque objeto não é terreno. */
  [T.PROP]:   { c: 0x6a5c48, top: 0.45, walk: false, tex: 'gravel', obj: 'escora' },
  [T.SWALL]:  { c: 0x6d7590, top: 1.1,  walk: false, tex: 'block' },
  [T.PAVE]:   { c: 0x968a70, top: 0,    walk: true,  tex: 'pave' },
  [T.RUBBLE]: { c: 0x827668, top: 0,    walk: true,  tex: 'rubble' },
  /* Veio: é rocha, e a cor é perto da rocha DE PROPÓSITO — quem acha o veio é o
     metal desenhado na textura, não um tile de outra cor. Fosse ele azul, o
     jogador acharia minério de longe e a procura deixaria de existir. */
  [T.ORE]:    { c: 0x333f4c, top: 1.1,  walk: false, tex: 'ore' },
  [T.GRAVEL]: { c: 0x82705c, top: 0,    walk: true,  tex: 'gravel' },
  /* A teia é parede e tem sprite PRÓPRIO: o wallSprite corta topo claro e
     face escura, que é física de pedra, e aplicado a teia dava chapa
     ondulada. Ver `parede` e PAREDE_DRAW no art.js. */
  [T.WEB]:    { c: 0xb0bad2, top: 1.1,  walk: false, tex: 'web', parede: 'teia' },
  [T.WEBF]:   { c: 0x7d88a8, top: 0,    walk: true,  tex: 'webf' },
  [T.BONE]:   { c: 0xd6d2b4, top: 0,    walk: true,  tex: 'bone' },
  [T.ASH]:    { c: 0x574a44, top: 0,    walk: true,  tex: 'ash' },
  [T.MOSS]:   { c: 0x4c6b3a, top: 0,    walk: true,  tex: 'moss' },
  [T.GORE]:   { c: 0x7a2b30, top: 0,    walk: true,  tex: 'gore' },
  [T.RUNE]:   { c: 0x6f5f9c, top: 0,    walk: true,  tex: 'rune' },
  /* Os móveis da vila. `c` e `tex` são o CHÃO sob o objeto — a madeira e a
     pedra de cada um são constantes do art.js, porque objeto não é terreno.
     É a mesma regra que a cerca e o escoramento já seguem, e é o corolário do
     #48b: cor de material é constante própria, não a cor do tile multiplicada. */
  [T.WELL]:   { c: 0x968a70, top: 0.45, walk: false, tex: 'pave',   obj: 'poco',    span: [2, 2] },
  [T.CART]:   { c: 0x7a5c30, top: 0.42, walk: false, tex: 'dirt',   obj: 'carroca', sombra: 1 },
  [T.BARREL]: { c: 0x7a5c30, top: 0.40, walk: false, tex: 'dirt',   obj: 'barril',  sombra: 1 },
  /* O moinho é o único que TAPA a vista: é um prédio, não um móvel, e `top`
     1.1 o põe na régua de parede. Numa ilha que vive de trigo ele é a silhueta
     que diz "fazenda" de mais longe que qualquer outra coisa. */
  [T.MILL]:   { c: 0x8a7a5c, top: 1.1,  walk: false, tex: 'dirt',   parede: 'moinho', span: [2, 3] }
};

const WORLD = { floors: [], temple: { x: W >> 1, y: H >> 1, z: SURF }, spawns: [], hunts: [], pois: [], seed: 0, portas: new Set() };

/* --------------------------------------------------------------- ruído/rng */
function mulberry32(a) {
  return function () {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function makeNoise(seed) {
  const rnd = mulberry32(seed), p = new Float32Array(256 * 256);
  for (let i = 0; i < p.length; i++) p[i] = rnd();
  const at = (x, y) => p[((y & 255) << 8) | (x & 255)];
  const smooth = t => t * t * (3 - 2 * t);
  function val(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = smooth(x - ix), fy = smooth(y - iy);
    const a = at(ix, iy), b = at(ix + 1, iy), c = at(ix, iy + 1), d = at(ix + 1, iy + 1);
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }
  return function fbm(x, y, oct = 4, sc = 0.045) {
    let f = sc, amp = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) { sum += val(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2.1; }
    return sum / norm;
  };
}

/* em qual hunt este tile cai (null = mundo aberto) */
function huntAt(x, y, z) {
  for (const h of WORLD.hunts) {
    if (h.z !== z) continue;
    const dx = x - h.x, dy = y - h.y;
    if (dx * dx + dy * dy <= h.r * h.r) return h;
  }
  return null;
}
/* em qual POI este tile cai. Quadrado e não círculo como a hunt: o POI é
   pequeno, e num raio de 2-3 tiles o círculo tira justamente os cantos onde os
   guardas ficariam. */
function poiAt(x, y, z) {
  return WORLD.pois.find(p => p.z === z && distT(x, y, p.x, p.y) <= p.r) || null;
}
const idx = (x, y) => y * W + x;
const inBounds = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
/* Fora do mapa a superfície continua no oceano que já cerca a borda: sem isto o
   jogador anda até o limite e vê o vazio preto. Nos outros andares o fora é
   rocha maciça, e preto é a leitura certa. */
const foraDoMapa = z => z === SURF ? T.WATER : T.VOID;
const corFora = z => '#' + TILE[foraDoMapa(z)].c.toString(16).padStart(6, '0');
function tileAt(x, y, z) { return inBounds(x, y) ? WORLD.floors[z].t[idx(x, y)] : foraDoMapa(z); }
/* PORTA — o único tile cujo bloqueio muda durante o jogo.
   O estado vive num Set de chaves e não num id de tile porque o mapa é
   `Uint8Array`: aberta e fechada seriam dois ids, e aí o AUTOR do mapa teria de
   escolher qual das duas quer pintar — e isso não é decisão de mapa, é estado
   de partida. Fechada é o padrão: casa nasce fechada.
   Quem abre é só o jogador. Criatura não abre, e é isso que faz uma casa ser
   abrigo em vez de mais um corredor. */
const chavePorta = (x, y, z) => z + ':' + idx(x, y);
const portaAberta = (x, y, z) => WORLD.portas.has(chavePorta(x, y, z));
function usaPorta(x, y, z) {
  const k = chavePorta(x, y, z);
  if (WORLD.portas.has(k)) WORLD.portas.delete(k); else WORLD.portas.add(k);
  return WORLD.portas.has(k);
}
/* Porta fechada é parede para TODO MUNDO, jogador incluído — ele abre de
   propósito, com Ctrl + clique, e só então passa. Houve uma versão em que o A*
   do jogador atravessava a porta fechada e o passo a abria ao chegar; caiu
   junto com o "andar abre", porque caminho que atravessa o que está fechado
   promete uma passagem que não existe. */
function isWalkable(x, y, z) {
  const t = tileAt(x, y, z);
  if (t === T.DOOR) return portaAberta(x, y, z);
  return TILE[t].walk;
}
function distT(a, b, c, d) { return Math.max(Math.abs(a - c), Math.abs(b - d)); }

/* O tile andável mais próximo, em anéis crescentes. Existe por causa do editor
   de mapas: o save guarda a posição do personagem e o mapa muda por baixo dela,
   então a primeira coisa que se pinta por cima é exatamente o lugar onde ele
   parou. Sem isto ele carrega DENTRO da parede — e se o tile ficar cercado, ou
   se a terra encolher e a coordenada cair fora do mapa, ele fica preso para
   sempre num save que não dá para consertar de dentro do jogo.
   Anéis e não varredura do mapa inteiro: quem foi soterrado está a um ou dois
   tiles de chão, e um 192² varrido por inteiro a cada carga é desperdício. */
function chaoMaisPerto(x, y, z, raioMax = 24) {
  if (inBounds(x, y) && isWalkable(x, y, z)) return null;      // não precisa de resgate
  const cx = Math.max(0, Math.min(W - 1, x | 0)), cy = Math.max(0, Math.min(H - 1, y | 0));
  for (let r = 1; r <= raioMax; r++)
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;   // só a casca do anel
      const nx = cx + i, ny = cy + j;
      if (inBounds(nx, ny) && isWalkable(nx, ny, z)) return [nx, ny];
    }
  return null;
}

/* -------------------------------------------------------------- geração */
function genWorld(seed) {
  WORLD.seed = seed;
  WORLD.portas = new Set();
  /* Mundo gerado NÃO vem de arquivo, e precisa dizer isso: sem esta linha um
     personagem criado depois de um `mapaAplica` se salvaria como se fosse
     daquela terra, e voltaria com as coordenadas de outro mapa. */
  WORLD.mapa = null;
  // o gerador tem tamanho próprio e o reafirma: ver GEN acima
  W = GEN.w; H = GEN.h; FLOORS = GEN.andares; SURF = GEN.sup;
  DEEP = GEN.fundo; FLOOR_NAMES = GEN.nomes;
  WORLD.temple = { x: W >> 1, y: H >> 1, z: SURF };
  const rnd = mulberry32(seed), nEl = makeNoise(seed), nMo = makeNoise(seed + 7777);
  /* Terceiro ruído, bem mais largo que os outros dois: bioma é região, não
     mancha. Com a mesma frequência da umidade sairiam ilhotas de neve de três
     tiles espalhadas pelo campo inteiro; com esta, a tundra é um pedaço do
     mundo pelo qual se atravessa, e o pântano é um lugar aonde se vai. */
  const nBio = makeNoise(seed + 24601);
  WORLD.floors = [];
  for (let z = 0; z < FLOORS; z++) WORLD.floors.push({ t: new Uint8Array(W * H), deco: [] });

  // limiares por percentil — garante praia/montanha independente do seed
  const samp = [];
  for (let i = 0; i < 3000; i++) samp.push(nEl(rnd() * W, rnd() * H));
  samp.sort((a, b) => a - b);
  const q = p => samp[Math.floor(p * (samp.length - 1))];
  const tWater = q(0.20), tSand = q(0.26), tRock = q(0.88), tPlat = q(0.965);

  const surf = WORLD.floors[SURF].t, mount = WORLD.floors[0].t;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const e = nEl(x, y), m = nMo(x, y, 3, 0.07), i = idx(x, y);
    const b = nBio(x, y, 2, 0.018);
    const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
    if (edge < 3) { surf[i] = T.WATER; continue; }        // oceano em volta do mapa
    if (e < tWater) surf[i] = T.WATER;
    else if (e < tSand) surf[i] = T.SAND;
    else if (e > tRock) surf[i] = T.ROCK;
    // tundra no alto e frio, pântano no baixo e úmido; a árvore ainda nasce nos
    // dois, é o CHÃO que muda de nome e de fauna
    else if (b < .30 && e > tSand + (tRock - tSand) * .35) surf[i] = (m > .62 && mulberry32(seed + i)() < .3) ? T.TREE : T.SNOW;
    else if (b > .66 && m > .42 && e < tSand + (tRock - tSand) * .55) surf[i] = (m > .72 && mulberry32(seed + i)() < .35) ? T.TREE : T.SWAMP;
    else if (m > 0.58 && mulberry32(seed + i)() < 0.45) surf[i] = T.TREE;
    else surf[i] = m < 0.4 ? T.DIRT : T.GRASS;
    // andar de cima: platô onde a elevação é extrema
    mount[i] = e > tPlat ? T.DIRT : (e > tRock ? T.ROCK : T.VOID);
  }

  // cavernas por autômato celular
  for (let z = 2; z < FLOORS; z++) {
    const t = WORLD.floors[z].t, r2 = mulberry32(seed + z * 913);
    let a = new Uint8Array(W * H);
    for (let i = 0; i < a.length; i++) a[i] = r2() < 0.46 ? 1 : 0;
    for (let it = 0; it < 4; it++) {
      const b = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          n += inBounds(x + dx, y + dy) ? a[idx(x + dx, y + dy)] : 1;
        }
        b[idx(x, y)] = n > 4 ? 1 : (n < 4 ? 0 : a[idx(x, y)]);
      }
      a = b;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = idx(x, y), edge = Math.min(x, y, W - 1 - x, H - 1 - y);
      if (edge < 2 || a[i]) t[i] = T.CWALL;
      // quanto mais fundo, mais o chão é lava: no Coração ela é 1 tile em 12 e
      // vira geografia, não decoração — passagem estreita e box difícil de fechar
      else t[i] = (z >= 3 && r2() < 0.03 * (z - 2)) ? T.LAVA : T.CFLOOR;
    }
  }

  // templo no centro
  const tx = WORLD.temple.x, ty = WORLD.temple.y;
  for (let y = ty - 4; y <= ty + 4; y++) for (let x = tx - 4; x <= tx + 4; x++)
    if (inBounds(x, y)) surf[idx(x, y)] = T.TEMPLE;
  for (let y = ty - 7; y <= ty + 7; y++) for (let x = tx - 7; x <= tx + 7; x++)
    if (inBounds(x, y) && !TILE[surf[idx(x, y)]].walk) surf[idx(x, y)] = T.DIRT;

  const carve = (t, x, y, r, tile) => {
    for (let j = -r; j <= r; j++) for (let i2 = -r; i2 <= r; i2++)
      if (inBounds(x + i2, y + j)) t[idx(x + i2, y + j)] = tile;
  };

  /* Escada JÁ COLOCADA é intocável. Um par [z,z+1] sorteia em cima de tiles do
     andar z, e os tiles de escada são andáveis: sem esta guarda, colocar o par
     [3,4] podia cair num T.UP que o par [2,3] tinha acabado de criar e apagá-lo
     — o buraco do andar 2 passava a dar num chão sem volta, e quem descesse por
     ele ficava preso. O andar de baixo também precisa da guarda: `carve` alarga
     em raio 2 e engoliria a escada do vizinho pelo mesmo motivo. */
  const ehEscada = (t, i) => t[i] === T.UP || t[i] === T.DOWN;
  const livrePraCavar = (t, x, y, r) => {
    for (let j = -r; j <= r; j++) for (let i2 = -r; i2 <= r; i2++)
      if (inBounds(x + i2, y + j) && ehEscada(t, idx(x + i2, y + j))) return false;
    return true;
  };

  // escadas: superfície->caverna->abismo->fenda->coração, e superfície->montanha
  const pairs = [[SURF, 2, 16], [2, 3, 12], [3, 4, 10], [4, 5, 8]];
  for (const [up, down, count] of pairs) {
    const tu = WORLD.floors[up].t, td = WORLD.floors[down].t;
    let placed = 0, guard = 0;
    while (placed < count && guard++ < 8000) {
      const x = 6 + Math.floor(rnd() * (W - 12)), y = 6 + Math.floor(rnd() * (H - 12));
      const i = idx(x, y);
      if (!TILE[tu[i]].walk || tu[i] === T.TEMPLE || ehEscada(tu, i)) continue;
      if (!livrePraCavar(td, x, y, 2)) continue;
      if (distT(x, y, tx, ty) < 10) continue;
      carve(td, x, y, 2, T.CFLOOR);
      tu[i] = T.DOWN; td[i] = T.UP;
      placed++;
    }
  }
  { // montanha (só onde o platô existe)
    let placed = 0, guard = 0;
    while (placed < 6 && guard++ < 20000) {
      const x = 6 + Math.floor(rnd() * (W - 12)), y = 6 + Math.floor(rnd() * (H - 12));
      if (mount[idx(x, y)] !== T.DIRT) continue;
      if (ehEscada(surf, idx(x, y))) continue;      // não rouba o buraco da caverna
      // acha chão andável na superfície por perto e cava um caminho até a escada
      let best = null;
      for (let r = 2; r <= 6 && !best; r++)
        for (let j = -r; j <= r && !best; j++) for (let i2 = -r; i2 <= r && !best; i2++) {
          const nx = x + i2, ny = y + j;
          if (inBounds(nx, ny) && TILE[surf[idx(nx, ny)]].walk) best = [nx, ny];
        }
      if (!best) continue;
      let [cx, cy] = best;
      while (cx !== x || cy !== y) {
        cx += Math.sign(x - cx); cy += Math.sign(y - cy);
        if (!ehEscada(surf, idx(cx, cy))) surf[idx(cx, cy)] = T.DIRT;   // a trilha desvia da escada
      }
      surf[idx(x, y)] = T.UP; mount[idx(x, y)] = T.DOWN;
      placed++;
    }
  }

  // hunts: acha um lugar aberto o bastante no andar certo, longe do templo e das outras
  WORLD.hunts = [];
  const rH = mulberry32(seed + 31337);
  for (const def of HUNTS) {
    for (let n = 0; n < 6000; n++) {
      const x = 12 + Math.floor(rH() * (W - 24)), y = 12 + Math.floor(rH() * (H - 24));
      if (!isWalkable(x, y, def.z)) continue;                 // o centro tem que dar pé
      if (def.z === SURF && distT(x, y, tx, ty) < 26) continue;
      if (WORLD.hunts.some(h => h.z === def.z && distT(x, y, h.x, h.y) < h.r + def.r + 8)) continue;
      let livre = 0, total = 0;
      for (let j = -def.r; j <= def.r; j++) for (let i2 = -def.r; i2 <= def.r; i2++) {
        if (i2 * i2 + j * j > def.r * def.r) continue;
        total++; if (isWalkable(x + i2, y + j, def.z)) livre++;
      }
      if (livre / total < 0.55) continue;
      WORLD.hunts.push(Object.assign({ x, y }, def));
      break;
    }
  }

  /* POIs: mesma busca da hunt, só que menor e em lote. Ficam longe do templo,
     fora de hunt e longe uns dos outros — POI colado em hunt some no meio do
     respawn dela e deixa de ser descoberta. */
  WORLD.pois = [];
  const rP = mulberry32(seed + 90210);
  for (const def of POIS) {
    for (let k = 0; k < def.qtd; k++) {
      for (let n = 0; n < 3000; n++) {
        const z = def.z[Math.floor(rP() * def.z.length)];
        const x = 8 + Math.floor(rP() * (W - 16)), y = 8 + Math.floor(rP() * (H - 16));
        if (!isWalkable(x, y, z) || tileAt(x, y, z) === T.TEMPLE) continue;
        if (distT(x, y, tx, ty) < 22) continue;
        if (huntAt(x, y, z)) continue;
        if (WORLD.hunts.some(h => h.z === z && distT(x, y, h.x, h.y) < h.r + def.r + 5)) continue;
        if (WORLD.pois.some(p => p.z === z && distT(x, y, p.x, p.y) < 18)) continue;
        let livre = 0, total = 0;
        for (let j = -def.r; j <= def.r; j++) for (let i2 = -def.r; i2 <= def.r; i2++) {
          total++; if (isWalkable(x + i2, y + j, z)) livre++;
        }
        if (livre / total < 0.6) continue;
        // a posição vem DEPOIS do molde: `def.z` é a lista de andares possíveis,
        // e sobrescrever na ordem errada deixava o POI com z sendo um array
        WORLD.pois.push(Object.assign({}, def, { x, y, z, uid: def.id + '_' + k }));
        break;
      }
    }
  }
  // decoração + pontos de spawn
  WORLD.spawns = [];
  for (let z = 0; z < FLOORS; z++) {
    const t = WORLD.floors[z].t, deco = WORLD.floors[z].deco, r3 = mulberry32(seed + 555 + z);
    const pools = SPAWN_POOLS[z];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const tt = t[idx(x, y)];
      if (tt === T.TREE) deco.push({ x, y, k: 0 });
      else if ((tt === T.CFLOOR || tt === T.DIRT) && r3() < 0.02) deco.push({ x, y, k: z === 0 || z >= 2 ? 1 : 2 });
      if (!TILE[tt].walk || tt === T.DOWN || tt === T.UP) continue;
      const d = distT(x, y, tx, ty);
      if (z === SURF && d < 14) continue;                   // zona segura do templo
      // dentro de hunt não se sorteia por tile: a hunt é povoada em bloco, depois
      // deste laço, para que o spawn saia em NÚCLEOS e não espalhado (ver abaixo)
      if (huntAt(x, y, z)) continue;
      // POI: guarda temático em volta do tesouro, denso mas num raio pequeno
      const poi = poiAt(x, y, z);
      if (poi) {
        if (x === poi.x && y === poi.y) continue;     // o centro é o tesouro
        if (r3() > poi.dens) continue;
        WORLD.spawns.push({ x, y, z, m: poi.mobs[Math.floor(r3() * poi.mobs.length)], dead: 0, live: null, poi: poi.uid });
        continue;
      }
      /* Mundo aberto: RALO de propósito. O mapa dobrou de área, e manter a taxa
         antiga dobraria a quantidade de bicho de estrada — o oposto do que faz
         um mundo ser bom de atravessar. O perigo mora nas hunts e nos POIs; o
         caminho entre eles é para andar, não para brigar a cada dez passos. */
      if (r3() > (z === SURF ? 0.004 : 0.009)) continue;
      const bio = BIOMA_POOLS[TILE[tt].tex];             // tundra e pântano têm dono
      const usados = bio || pools;
      const pool = usados.find(p => d >= p.r[0] && d < p.r[1]) || usados[usados.length - 1];
      WORLD.spawns.push({ x, y, z, m: pool.mobs[Math.floor(r3() * pool.mobs.length)], dead: 0, live: null });
    }
  }

  /* Chefe no centro exato da hunt: um ponto de spawn só, e o centro já é andável
     porque a colocação da hunt exigiu isso. `boss` marca o ponto — quem lê é o
     respawn (chefe demora minutos, não segundos) e o sorteio de elite, que não
     roda aqui: chefe já é o extremo da espécie, empilhar modificador em cima
     seria pedir uma parede de vida que ninguém derruba. */
  /* ---- povoamento da hunt: NÚCLEOS, não chuvisco ---------------------------
     A regra antiga era um dado por tile dentro do círculo. Isso produzia duas
     coisas ruins. Primeiro, densidade uniforme: nenhum ponto da hunt valia mais
     que outro, então não havia razão para se posicionar, e a fila de corpo a
     corpo e o `exeta res` — que já existem no código — quase nunca importavam.
     Segundo, e pior, a quantidade saía do acaso: o dado rodava sobre quantos
     tiles andáveis calhavam de cair no círculo, e caverna funda tem menos chão
     que superfície. Medido, isso dava de 3 a 20 bichos por hunt — a Fenda do
     Vazio, de nível 200, nascia com TRÊS.

     Agora o orçamento sai do raio (previsível, igual para hunts de mesmo porte)
     e é distribuído em poucos núcleos densos, com o resto da hunt quase vazio.
     É o que permite puxar um grupo, recuar até um gargalo e fechar box — e é o
     que faz andar de núcleo em núcleo ser a habilidade que a hunt cobra. */
  const HUNT_DENS = 0.5;    // bichos por r² — a única régua de densidade de hunt
  const POR_NUCLEO = 8;     // alvo por núcleo; é o que cabe em volta de um jogador
  const hSeed = (id) => { let n = 0; for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) | 0; return n; };

  for (const h of WORLD.hunts) {
    const rH2 = mulberry32(seed + 7000 + hSeed(h.id));
    // tiles onde cabe um ponto de spawn: andáveis, fora do centro (é do chefe) e
    // fora de escada, que não pode nascer bloqueada
    const livres = [];
    for (let j = -h.r; j <= h.r; j++) for (let i2 = -h.r; i2 <= h.r; i2++) {
      const x = h.x + i2, y = h.y + j;
      if (i2 * i2 + j * j > h.r * h.r) continue;
      if (x === h.x && y === h.y) continue;
      const tt = tileAt(x, y, h.z);
      if (!TILE[tt].walk || tt === T.DOWN || tt === T.UP) continue;
      livres.push([x, y]);
    }
    if (!livres.length) continue;

    const orcamento = Math.min(livres.length, Math.round(h.r * h.r * HUNT_DENS));
    const nNucleos = Math.max(2, Math.min(5, Math.round(orcamento / POR_NUCLEO)));
    const usados = new Set();
    const mobAleatorio = () => h.mobs[Math.floor(rH2() * h.mobs.length)];

    // núcleos afastados entre si: dois colados viram um só e some o corredor
    const centros = [];
    for (let n = 0; n < nNucleos * 40 && centros.length < nNucleos; n++) {
      const c = livres[Math.floor(rH2() * livres.length)];
      if (centros.some(o => distT(c[0], c[1], o[0], o[1]) < 5)) continue;
      centros.push(c);
    }

    const cota = Math.floor(orcamento / Math.max(1, centros.length));
    for (const [cx, cy] of centros) {
      const perto = livres.filter(([x, y]) => distT(x, y, cx, cy) <= 2 && !usados.has(x + ':' + y));
      for (let k = perto.length - 1; k > 0; k--) {          // embaralha
        const j = Math.floor(rH2() * (k + 1)); [perto[k], perto[j]] = [perto[j], perto[k]];
      }
      for (const [x, y] of perto.slice(0, cota)) {
        usados.add(x + ':' + y);
        WORLD.spawns.push({ x, y, z: h.z, m: mobAleatorio(), dead: 0, live: null, hunt: h.id });
      }
    }

    /* Alguns poucos vagando fora dos núcleos. Servem de aviso — você sabe que
       entrou na hunt antes de encostar no primeiro grupo — e impedem que o
       espaço entre núcleos vire corredor completamente morto. */
    let vagantes = 2 + Math.floor(rH2() * 3);
    for (let n = 0; n < 200 && vagantes > 0; n++) {
      const [x, y] = livres[Math.floor(rH2() * livres.length)];
      if (usados.has(x + ':' + y)) continue;
      if (centros.some(c => distT(x, y, c[0], c[1]) <= 3)) continue;   // fora dos núcleos
      usados.add(x + ':' + y); vagantes--;
      WORLD.spawns.push({ x, y, z: h.z, m: mobAleatorio(), dead: 0, live: null, hunt: h.id });
    }
  }

  for (const h of WORLD.hunts)
    if (h.boss) WORLD.spawns.push({ x: h.x, y: h.y, z: h.z, m: h.boss, dead: 0, live: null, hunt: h.id, boss: true });

  /* O guardião do tesouro dorme COLADO nele, não espalhado no raio: é o que faz
     dar pra ver o prêmio e o preço na mesma olhada e decidir se vale. Vai num
     tile vizinho porque o centro é o baú. */
  for (const p of WORLD.pois) {
    if (!p.guarda) continue;
    const v = DIRS.map(([dx, dy]) => [p.x + dx, p.y + dy]).find(([x, y]) => isWalkable(x, y, p.z));
    const m = p.mobs[p.z ? POIS.find(d => d.id === p.id).z.indexOf(p.z) : 0] || p.mobs[0];
    if (v) WORLD.spawns.push({ x: v[0], y: v[1], z: p.z, m, dead: 0, live: null, poi: p.uid });
  }
}

/* ------------------------------------------------------------ pathfinding */
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
/* `bloq(x,y)` é o bloqueio que não está no mapa: quem está EM PÉ no caminho.
   O tile de destino é isento — perseguidor mira o tile do jogador e o jogador
   está nele; sem a isenção nenhum caminho fecharia e o bicho ficaria parado. */
function findPath(sx, sy, gx, gy, z, maxNodes = 9000, bloq = null) {
  if (!inBounds(gx, gy) || !isWalkable(gx, gy, z)) return null;
  const open = [idx(sx, sy)], g = new Map(), f = new Map(), from = new Map();
  g.set(open[0], 0); f.set(open[0], 0);
  const goal = idx(gx, gy);
  let n = 0;
  while (open.length && n++ < maxNodes) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (f.get(open[i]) < f.get(open[bi])) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur === goal) {
      const path = [];
      for (let c = cur; c !== idx(sx, sy); c = from.get(c)) path.push([c % W, (c / W) | 0]);
      return path.reverse();
    }
    const cx = cur % W, cy = (cur / W) | 0, cg = g.get(cur);
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      // diagonal não trava mais por causa de obstáculo/criatura na quina — só o
      // tile de destino importa, então dá pra cortar por entre dois objetos ou
      // duas criaturas coladas
      if (!inBounds(nx, ny) || !isWalkable(nx, ny, z)) continue;
      if (bloq && !(nx === gx && ny === gy) && bloq(nx, ny)) continue;
      const ni = idx(nx, ny), ng = cg + (dx && dy ? 1.5 : 1);
      if (g.has(ni) && g.get(ni) <= ng) continue;
      g.set(ni, ng); from.set(ni, cur);
      f.set(ni, ng + distT(nx, ny, gx, gy));
      if (!open.includes(ni)) open.push(ni);
    }
  }
  return null;
}

/* ------------------------------------------------------- luz por andar */
/* No Tibia a luz é um passe à parte: cor+intensidade do ambiente, mais o halo
   das fontes. No subsolo o ambiente é fixo (`amb` preenchido); na superfície
   ele é null aqui porque quem manda é o relógio, logo abaixo. */
/* `torch` saiu daqui: o raio da luz é do ITEM que o jogador carrega, não do
   andar. Um raio por andar acendia o herói mesmo com a mochila vazia. */
/* Indexada por PROFUNDIDADE, não por número de andar. A entrada 0 é o que fica
   acima da superfície, a 1 é a superfície, e daí para baixo. Com índice
   absoluto, uma terra que numere os andares de outro jeito recebia o ambiente
   errado — em Varrokgaard, cuja superfície é o andar 0, a caverna ganhava céu,
   clima e ciclo de dia. Ver . */
const FLOOR_AMBIENCE = [
  { bg: '#223047', amb: null },
  { bg: '#162015', amb: null },
  { bg: '#0b0a09', amb: '#2b2a30' },
  { bg: '#0a0506', amb: '#241419' },
  { bg: '#070309', amb: '#1e1030' },   // fenda: o roxo do vazio
  { bg: '#050203', amb: '#2a0c10' }    // coração: só a brasa
];

/* A profundidade de um andar, medida a partir da superfície: −1 é o que está
   acima dela, 0 é ela, 1+ é subsolo. É o que torna o ambiente independente da
   numeração de cada terra. */
const ambienteDe = z => FLOOR_AMBIENCE[Math.max(0, Math.min(FLOOR_AMBIENCE.length - 1, (z - SURF) + 1))];

/* Ciclo dia/noite. A hora vem do relógio de parede: continua de onde parou entre
   recargas e não precisa de estado salvo nem de tick. A noite não fecha em preto
   — escura o bastante para a tocha valer, clara o bastante para se jogar. */
const DIA_MS = 10 * 60000;
const CEU = [
  [0.00, '#39406b'],   // madrugada
  [0.20, '#4a5378'],
  [0.26, '#9c7a63'],   // amanhecer
  [0.34, '#e6dcc6'],
  [0.50, '#ffffff'],   // meio-dia
  [0.68, '#f2e4c6'],
  [0.78, '#b0764f'],   // poente
  [0.86, '#4d4f74'],
  [1.00, '#39406b']
];
const horaDoDia = (ms = Date.now()) => (ms % DIA_MS) / DIA_MS;

function corDoCeu(td) {
  let i = 0;
  while (i < CEU.length - 2 && td >= CEU[i + 1][0]) i++;
  const [p0, c0] = CEU[i], [p1, c1] = CEU[i + 1];
  const k = (td - p0) / (p1 - p0 || 1);
  const n0 = parseInt(c0.slice(1), 16), n1 = parseInt(c1.slice(1), 16);
  const canal = s => Math.round((n0 >> s & 255) + ((n1 >> s & 255) - (n0 >> s & 255)) * k);
  return [canal(16), canal(8), canal(0)];
}
/* Relógio do jogo. O dia dura DIA_MS de verdade, então a hora é a fração do
   ciclo em 24h. Os cortes das fases saem da rampa do CÉU, não de números
   redondos: com 6/12/18/24 na mão o painel anunciava "Manhã" com o céu ainda
   roxo. Amanhecer é .26 e poente .78 lá em cima — é daí que vêm estes. */
const FASES = [[.26, 'Madrugada'], [.50, 'Manhã'], [.78, 'Tarde'], [1, 'Noite']];
function horaDoJogo(ms = Date.now()) {
  const td = horaDoDia(ms), h = td * 24;
  return { h: Math.floor(h), min: Math.floor(h % 1 * 60), fase: FASES.find(f => td < f[0])[1] };
}
const ehNoite = (td = horaDoDia()) => {
  const [r, g, b] = corDoCeu(td);
  return r * .3 + g * .6 + b * .1 < 110;
};
/* Tem alguma coisa em cima de mim? Índice menor é o andar de CIMA. É a mesma
   conta que decide se o teto entra no desenho — e agora também se a chuva cai e
   se ela é ouvida. As três TÊM de sair daqui: se divergirem, chove dentro da
   caverna ou o teto some debaixo de um céu que continua limpo. */
const souCoberto = (x = P.x, y = P.y, z = P.z) => z - 1 >= 0 && tileAt(x, y, z - 1) !== T.VOID;

/* Clima. Mesma ideia do relógio do dia: sai do Date.now(), então continua entre
   recargas, não precisa de tick nem de estado salvo e é igual em qualquer aba.
   Senóides de períodos incomensuráveis — o tempo vira sem repetir num laço que
   dê para decorar. Só existe onde há céu: no subsolo devolve tudo parado.
     nublado — quanto o céu está fechado, é o que escurece o mundo;
     frente  — a tempestade se formando: sobe ANTES da primeira gota e fica
               cravada em 1 enquanto chove;
     chuva   — só na metade mais fechada do céu;
     vento   — inclina mato e chuva e empurra a nuvem;
     raio    — clarão do relâmpago no quadro, 0 na maior parte do tempo;
     molhado — quanto o chão está encharcado, que atrasa a chuva e a sobrevive;
     nuvens  — força da SOMBRA no chão;
     luz     — força da fonte que projeta sombra (sol de dia, lua de noite);
     estado  — o rótulo, para log, áudio e spawn lerem a MESMA coisa. */
const CLIMA_PARADO = { nublado: 0, chuva: 0, frente: 0, vento: .25, raio: 0, molhado: 0,
                       nuvens: 0, luz: .6, estado: 'abrigado' };
const nubladoEm = ms => {
  const m = ms / 60000, c = Math.sin(m / 2.7) * .6 + Math.sin(m / 6.3) * .4;
  return Math.max(0, Math.min(1, (c + .15) / .85));
};
const chuvaDe = nublado => Math.max(0, (nublado - .55) / .45);

/* Chão molhado. Não é a chuva de agora: a poça demora a se formar e continua ali
   depois que para. Como o clima inteiro é função do relógio, a memória é uma
   média com peso do passado recente em vez de um acumulador — nada para salvar,
   nada para dessincronizar entre abas, e o chão já nasce molhado se você entrar
   no jogo no meio de um temporal.
   ponytail: seca no mesmo ritmo em que molha; poça de verdade some mais devagar
   que aparece. Se a secagem instantânea incomodar, separar os dois pesos. */
const MOLHADO_AMOSTRAS = 6, MOLHADO_PASSO = 60000;
function molhadoEm(ms) {
  let soma = 0, peso = 0;
  for (let i = 0; i < MOLHADO_AMOSTRAS; i++) {
    const p = 1 - i / MOLHADO_AMOSTRAS;
    soma += chuvaDe(nubladoEm(ms - i * MOLHADO_PASSO)) * p; peso += p;
  }
  return Math.min(1, soma / peso * 1.3);
}

/* Relâmpago. O clarão sai de um HASH da janela de tempo, e não de um sorteio
   guardado: o resto do clima é função do relógio, e um raio com estado próprio
   seria a única coisa a não sobreviver ao reload — piscaria diferente em cada
   aba, e o trovão de um jogador cairia num silêncio para o outro. A janela é
   fixa; o hash decide se caiu e em que instante dela. */
const RAIO_JANELA = 4200, RAIO_DUR = 240;
function relampago(chuva, ms) {
  if (chuva < .45) return 0;                       // garoa não tem raio
  const h = Math.sin(Math.floor(ms / RAIO_JANELA) * 12.9898) * 43758.5453;
  const r = h - Math.floor(h);
  if (r > chuva) return 0;                         // nem toda janela tem raio
  const k = (ms % RAIO_JANELA - (r / chuva) * (RAIO_JANELA - RAIO_DUR)) / RAIO_DUR;
  if (k < 0 || k > 1) return 0;
  // dois estouros: o principal e a réplica fraca — clarão único lê como falha de tela
  return Math.min(1, Math.max(0, 1 - k * 4) + Math.max(0, .5 - Math.abs(k - .34) * 6));
}

function climaAgora(z, ms = Date.now()) {
  if (ambienteDe(z).amb) return CLIMA_PARADO;
  const nublado = nubladoEm(ms);
  const [r, g, b] = corDoCeu(horaDoDia(ms));
  const sol = Math.min(1, (r * .3 + g * .6 + b * .1) / 200);
  /* `luz` é a força da fonte que projeta sombra: sol de dia, lua de noite (o
     azul da madrugada nunca zera a luminância, então a noite tem sombra fraca em
     vez de nenhuma), e céu fechado difunde. Sai daqui uma vez e alimenta duas
     coisas: a força da sombra de nuvem e o alfa da sombra projetada. Se cada uma
     tivesse a sua conta, a nuvem escureceria numa hora e o boneco em outra. */
  const luz = sol * (1 - nublado * .6);
  const chuva = chuvaDe(nublado);
  const frente = Math.max(0, Math.min(1, (nublado - .40) / .15));
  /* Terceira senóide, incomensurável com as duas do céu: vento que subisse junto
     com a nuvem viraria a mesma informação duas vezes. O piso vem da frente —
     tempestade sem vento é chuva de regador. */
  const vento = Math.min(1, Math.max(.12 + (Math.sin(ms / 60000 / 4.1) * .5 + .5) * .55, frente * .9));
  /* A nuvem escurece pela frente da tempestade, não só pelo recorte. A curva do
     recorte tem pico no meio e AFINA quando o céu fecha de vez — a sombra sumia
     justo na hora em que a chuva começava, que é o contrário do que o céu faz. */
  return { nublado, chuva, frente, vento, raio: relampago(chuva, ms), molhado: molhadoEm(ms), luz,
           nuvens: Math.min(1, Math.max(nublado * luz * 1.4, frente * (.4 + luz * .6))),
           estado: chuva > .5 ? 'tempestade' : chuva > 0 ? 'chuva' : nublado > .5 ? 'nublado' : 'limpo' };
}

/* ambiente efetivo do andar: a caverna ignora o relógio, a superfície não.
   `ms` existe para o teste poder fixar a hora — sem ele a asserção de noite
   dependia do relógio de parede e falhava sozinha uma vez a cada ciclo. */
function ambienteAgora(z, ms = Date.now()) {
  const a = ambienteDe(z);
  if (a.amb) return a;
  const f = 1 - .4 * climaAgora(z, ms).nublado;   // céu fechado escurece o dia inteiro
  const [r, g, b] = corDoCeu(horaDoDia(ms)).map(v => Math.round(v * f));
  /* `escuro` (0..1) é o quanto a hora está fechando a luz: é ele que segura o
     halo da tocha de dia, quando o passe de luz mal escurece e o glow estourava.
     No subsolo a tabela manda e o escuro é total, por isso ele só sai aqui. */
  // meio-dia pleno dispensa o passe: multiplicar a cena inteira por branco é trabalho à toa
  return { bg: a.bg, amb: Math.min(r, g, b) > 246 ? null : `rgb(${r},${g},${b})`,
    escuro: 1 - Math.min(r, g, b) / 255 };
}

/* ------------------------------------------------------------- minimapa */
const miniCanvas = [];
function buildMinimaps() {
  miniCanvas.length = 0;
  for (let z = 0; z < FLOORS; z++) {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), t = WORLD.floors[z].t;
    for (let i = 0; i < t.length; i++) {
      const c = TILE[t[i]].c, hide = TILE[t[i]].hide;
      img.data[i * 4] = hide ? 8 : (c >> 16) & 255;
      img.data[i * 4 + 1] = hide ? 8 : (c >> 8) & 255;
      img.data[i * 4 + 2] = hide ? 10 : c & 255;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    miniCanvas.push(cv);
  }
}


/* ==================================================== o mapa como arquivo ===
   O mundo deixa de ser função da semente e passa a ser DADO. O gerador continua
   vivo e é ele que produz o primeiro rascunho de cada terra — mas depois de
   congelado, corrigir o mapa é editar o arquivo, não sortear de novo e torcer.

   UM CARACTERE POR TILE, UMA LINHA POR LINHA DO MAPA, sem compressão. É de
   propósito: o arquivo abre num editor de texto e se LÊ o mapa, e o git mostra
   em qual linha a mudança caiu — que é exatamente o que importa quando o mapa
   passa a ser desenhado à mão. Comprimir economizaria uns KB e custaria as duas
   coisas. Aleto, a 128×128, dá 16 KB por andar. */
const TILE_CHAR = '.gdswRTcCLv^#npMPDFHjyISauOkWebzmxr@%$&';   // índice = id do tile em T
const CHAR_TILE = {};
for (let i = 0; i < TILE_CHAR.length; i++) CHAR_TILE[TILE_CHAR[i]] = i;

function mapaSerializa(nome) {
  return {
    nome, w: W, h: H, andares: FLOORS, sup: SURF, fundo: DEEP,
    origem: WORLD.seed,                       // de que semente este rascunho saiu
    nomes: FLOOR_NAMES,
    templo: { x: WORLD.temple.x, y: WORLD.temple.y, z: WORLD.temple.z },
    hunts: WORLD.hunts,
    pois: WORLD.pois,
    /* Só o que define o ponto. `dead`, `live` e o relógio de respawn são estado
       de partida e nascem zerados — congelar isso seria salvar um jogo, não um
       mapa. */
    spawns: WORLD.spawns.map(s => {
      const o = { x: s.x, y: s.y, z: s.z, m: s.m };
      if (s.hunt) o.hunt = s.hunt;
      if (s.boss) o.boss = 1;
      return o;
    }),
    deco: WORLD.floors.map(f => f.deco),
    tiles: WORLD.floors.map(f => {
      const linhas = [];
      for (let y = 0; y < H; y++) {
        let l = '';
        for (let x = 0; x < W; x++) l += TILE_CHAR[f.t[y * W + x]];
        linhas.push(l);
      }
      return linhas.join('\n');
    })
  };
}

/* Guardado no próprio arquivo do mapa pelo compor: quantos tiles de patch
   estavam aplicados quando ele foi escrito. É o que permite ao editor comparar
   com o patch em disco e perceber que o mapa está atrasado — o estado em que
   "editei, gravei e sumiu tudo", que na verdade é "gravou e ninguém recompôs". */
function mapaAplica(o) {
  W = o.w; H = o.h; FLOORS = o.andares; SURF = o.sup;
  WORLD.portas = new Set();   // terra nova nasce com tudo fechado
  if (o.fundo !== undefined) DEEP = o.fundo;
  if (o.nomes) FLOOR_NAMES = o.nomes;
  WORLD.mapa = o.nome;
  WORLD.seed = o.origem || 0;
  WORLD.temple = { x: o.templo.x, y: o.templo.y, z: o.templo.z };
  WORLD.hunts = o.hunts || [];
  WORLD.pois = o.pois || [];
  WORLD.spawns = (o.spawns || []).map(s =>
    Object.assign({ dead: 0, live: null }, s));
  WORLD.floors = o.tiles.map((txt, z) => {
    const t = new Uint8Array(W * H), linhas = txt.split('\n');
    for (let y = 0; y < H && y < linhas.length; y++) {
      const l = linhas[y];
      for (let x = 0; x < W && x < l.length; x++) t[y * W + x] = CHAR_TILE[l[x]] || 0;
    }
    return { t, deco: (o.deco && o.deco[z]) || [] };
  });
  return WORLD;
}

/* O gerador CONTINUA VIVO, e não é transição: é o que mantém o jogo jogável
   enquanto as terras são desenhadas uma por uma. Sem nome de mapa, sorteia como
   sempre sorteou. */
function carregaMundo(seed, nome) {
  if (!nome) { genWorld(seed); WORLD.mapa = null; return Promise.resolve(null); }
  return fetch('maps/' + nome + '.json')
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(o => { mapaAplica(o); return nome; })
    .catch(e => {
      console.warn(`mapa "${nome}" não carregou (${e.message}); gerando pela semente`);
      genWorld(seed); WORLD.mapa = null; return null;
    });
}

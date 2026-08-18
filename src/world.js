/* world.js — geração do mundo (6 andares), pathfinding, luz por andar e
   minimapa. Só dados: quem desenha é render2d.js. Depende de data.js. */
'use strict';

/* Os dois andares de baixo são o endgame: a progressão do jogo é VERTICAL, como
   em Tibia — descer é o que separa o nível 60 do nível 300, e cada degrau tem a
   própria família de criatura, o próprio loot e o próprio chefe. Andar novo é
   barato aqui (o gerador de caverna já é genérico), então quando a curva
   precisar de mais fôlego, o caminho é FLOORS+1 e mais um pool de spawn. */
const W = 224, H = 224, FLOORS = 6, SURF = 1;   // 0=montanha 1=superfície 2=caverna 3=abismo 4=fenda 5=coração
const FLOOR_NAMES = ['Pico da Montanha (+1)', 'Superfície (0)', 'Caverna (-1)', 'Abismo (-2)', 'Fenda (-3)', 'Coração do Abismo (-4)'];
const DEEP = 4;   // a partir daqui é endgame: mais lava, mais elite, sem meio-termo

const T = { VOID: 0, GRASS: 1, DIRT: 2, SAND: 3, WATER: 4, ROCK: 5, TREE: 6, CFLOOR: 7, CWALL: 8, LAVA: 9, DOWN: 10, UP: 11, TEMPLE: 12, SNOW: 13, SWAMP: 14 };
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
  [T.SWAMP]:  { c: 0x5f682a, top: -0.06, walk: true, tex: 'swamp' }
};

const WORLD = { floors: [], temple: { x: W >> 1, y: H >> 1, z: SURF }, spawns: [], hunts: [], pois: [], seed: 0 };

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
function isWalkable(x, y, z) { return TILE[tileAt(x, y, z)].walk; }
function distT(a, b, c, d) { return Math.max(Math.abs(a - c), Math.abs(b - d)); }

/* -------------------------------------------------------------- geração */
function genWorld(seed) {
  WORLD.seed = seed;
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
const FLOOR_AMBIENCE = [
  { bg: '#223047', amb: null },
  { bg: '#162015', amb: null },
  { bg: '#0b0a09', amb: '#2b2a30' },
  { bg: '#0a0506', amb: '#241419' },
  { bg: '#070309', amb: '#1e1030' },   // fenda: o roxo do vazio
  { bg: '#050203', amb: '#2a0c10' }    // coração: só a brasa
];

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
   Duas senóides de períodos incomensuráveis — o tempo vira sem repetir num laço
   que dê para decorar. Só existe onde há céu: no subsolo devolve tudo zero.
     nublado — quanto o céu está fechado, é o que escurece o mundo;
     chuva   — só na metade mais fechada do céu;
     nuvens  — força da SOMBRA no chão, que é outra curva: céu limpo não tem
               nuvem para projetar e céu 100% fechado não tem recorte, o pico
               está no meio. E sem sol (noite) não há sombra nenhuma. */
function climaAgora(z, ms = Date.now()) {
  if (FLOOR_AMBIENCE[z].amb) return { nublado: 0, chuva: 0, nuvens: 0 };
  const m = ms / 60000;
  const c = Math.sin(m / 2.7) * .6 + Math.sin(m / 6.3) * .4;
  const nublado = Math.max(0, Math.min(1, (c + .15) / .85));
  const [r, g, b] = corDoCeu(horaDoDia(ms));
  const sol = Math.min(1, (r * .3 + g * .6 + b * .1) / 200);
  return { nublado, chuva: Math.max(0, (nublado - .55) / .45),
           nuvens: Math.min(1, nublado * (1 - nublado * .6) * sol * 1.4) };
}

/* ambiente efetivo do andar: a caverna ignora o relógio, a superfície não.
   `ms` existe para o teste poder fixar a hora — sem ele a asserção de noite
   dependia do relógio de parede e falhava sozinha uma vez a cada ciclo. */
function ambienteAgora(z, ms = Date.now()) {
  const a = FLOOR_AMBIENCE[z];
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


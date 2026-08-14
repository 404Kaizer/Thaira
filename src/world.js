/* world.js — geração do mundo (4 andares), pathfinding, luz por andar e
   minimapa. Só dados: quem desenha é render2d.js. Depende de data.js. */
'use strict';

const W = 160, H = 160, FLOORS = 4, SURF = 1;   // 0=montanha  1=superfície  2=caverna  3=profundo
const FLOOR_NAMES = ['Pico da Montanha (+1)', 'Superfície (0)', 'Caverna (-1)', 'Abismo (-2)'];

const T = { VOID: 0, GRASS: 1, DIRT: 2, SAND: 3, WATER: 4, ROCK: 5, TREE: 6, CFLOOR: 7, CWALL: 8, LAVA: 9, DOWN: 10, UP: 11, TEMPLE: 12 };
const TILE = {
  [T.VOID]:   { c: 0x000000, top: 0,    walk: false, hide: true },
  [T.GRASS]:  { c: 0x4a7a3a, top: 0,    walk: true,  tex: 'grass' },
  [T.DIRT]:   { c: 0x6d5738, top: 0,    walk: true,  tex: 'dirt' },
  [T.SAND]:   { c: 0xc9b477, top: 0,    walk: true,  tex: 'sand' },
  [T.WATER]:  { c: 0x2a5a8c, top: -0.28, walk: false, tex: 'water' },
  [T.ROCK]:   { c: 0x6e6e72, top: 1.1,  walk: false, tex: 'rock' },
  [T.TREE]:   { c: 0x3d6630, top: 0,    walk: false, tex: 'grass' },
  [T.CFLOOR]: { c: 0x554d45, top: 0,    walk: true,  tex: 'cave' },
  [T.CWALL]:  { c: 0x38332d, top: 1.1,  walk: false, tex: 'rock' },
  [T.LAVA]:   { c: 0xd1441a, top: -0.1, walk: false, tex: 'lava' },
  [T.DOWN]:   { c: 0x3a332c, top: 0,    walk: true,  tex: 'cave' },
  [T.UP]:     { c: 0x9a9185, top: 0,    walk: true,  tex: 'stone' },
  [T.TEMPLE]: { c: 0xb9ae94, top: 0,    walk: true,  tex: 'stone' }
};

const WORLD = { floors: [], temple: { x: 80, y: 80, z: SURF }, spawns: [], hunts: [], seed: 0 };

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
const idx = (x, y) => y * W + x;
const inBounds = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
function tileAt(x, y, z) { return inBounds(x, y) ? WORLD.floors[z].t[idx(x, y)] : T.VOID; }
function isWalkable(x, y, z) { return TILE[tileAt(x, y, z)].walk; }
function distT(a, b, c, d) { return Math.max(Math.abs(a - c), Math.abs(b - d)); }

/* -------------------------------------------------------------- geração */
function genWorld(seed) {
  WORLD.seed = seed;
  const rnd = mulberry32(seed), nEl = makeNoise(seed), nMo = makeNoise(seed + 7777);
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
    const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
    if (edge < 3) { surf[i] = T.WATER; continue; }        // oceano em volta do mapa
    if (e < tWater) surf[i] = T.WATER;
    else if (e < tSand) surf[i] = T.SAND;
    else if (e > tRock) surf[i] = T.ROCK;
    else if (m > 0.58 && mulberry32(seed + i)() < 0.45) surf[i] = T.TREE;
    else surf[i] = m < 0.4 ? T.DIRT : T.GRASS;
    // andar de cima: platô onde a elevação é extrema
    mount[i] = e > tPlat ? T.DIRT : (e > tRock ? T.ROCK : T.VOID);
  }

  // cavernas por autômato celular
  for (const z of [2, 3]) {
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
      else t[i] = (z === 3 && r2() < 0.03) ? T.LAVA : T.CFLOOR;
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

  // escadas: superfície->caverna->abismo e superfície->montanha
  const pairs = [[SURF, 2, 16], [2, 3, 12]];
  for (const [up, down, count] of pairs) {
    const tu = WORLD.floors[up].t, td = WORLD.floors[down].t;
    let placed = 0, guard = 0;
    while (placed < count && guard++ < 8000) {
      const x = 6 + Math.floor(rnd() * (W - 12)), y = 6 + Math.floor(rnd() * (H - 12));
      if (!TILE[tu[idx(x, y)]].walk || tu[idx(x, y)] === T.TEMPLE) continue;
      if (distT(x, y, tx, ty) < 10) continue;
      carve(td, x, y, 2, T.CFLOOR);
      tu[idx(x, y)] = T.DOWN; td[idx(x, y)] = T.UP;
      placed++;
    }
  }
  { // montanha (só onde o platô existe)
    let placed = 0, guard = 0;
    while (placed < 6 && guard++ < 20000) {
      const x = 6 + Math.floor(rnd() * (W - 12)), y = 6 + Math.floor(rnd() * (H - 12));
      if (mount[idx(x, y)] !== T.DIRT) continue;
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
        surf[idx(cx, cy)] = T.DIRT;
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
      // dentro de hunt: só a família dela, e bem mais denso (é onde se fecha box)
      const hunt = huntAt(x, y, z);
      if (hunt) {
        if (x === hunt.x && y === hunt.y) continue;   // o centro é do chefe, ver abaixo
        if (r3() > 0.075) continue;
        WORLD.spawns.push({ x, y, z, m: hunt.mobs[Math.floor(r3() * hunt.mobs.length)], dead: 0, live: null, hunt: hunt.id });
        continue;
      }
      if (r3() > (z === SURF ? 0.008 : 0.012)) continue;    // fora das hunts o mundo é mais vazio
      const pool = pools.find(p => d >= p.r[0] && d < p.r[1]) || pools[pools.length - 1];
      WORLD.spawns.push({ x, y, z, m: pool.mobs[Math.floor(r3() * pool.mobs.length)], dead: 0, live: null });
    }
  }

  /* Chefe no centro exato da hunt: um ponto de spawn só, e o centro já é andável
     porque a colocação da hunt exigiu isso. `boss` marca o ponto — quem lê é o
     respawn (chefe demora minutos, não segundos) e o sorteio de elite, que não
     roda aqui: chefe já é o extremo da espécie, empilhar modificador em cima
     seria pedir uma parede de vida que ninguém derruba. */
  for (const h of WORLD.hunts)
    if (h.boss) WORLD.spawns.push({ x: h.x, y: h.y, z: h.z, m: h.boss, dead: 0, live: null, hunt: h.id, boss: true });
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
  { bg: '#0a0506', amb: '#241419' }
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
  // meio-dia pleno dispensa o passe: multiplicar a cena inteira por branco é trabalho à toa
  return { bg: a.bg, amb: Math.min(r, g, b) > 246 ? null : `rgb(${r},${g},${b})` };
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


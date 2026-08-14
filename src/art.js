/* art.js — arte procedural em <canvas>: texturas de chão, sprites de criatura
   em 4 direções (modelo do Tibia) e decoração. Zero download, zero licença.
   Sem dependência de engine: tudo aqui devolve <canvas> pronto para drawImage. */
'use strict';

/* ------------------------------------------------------------- utilidades */
const _rgb = (hex, f = 1, a = 1) => {
  const r = Math.min(255, (hex >> 16 & 255) * f) | 0, g = Math.min(255, (hex >> 8 & 255) * f) | 0, b = Math.min(255, (hex & 255) * f) | 0;
  return a < 1 ? `rgba(${r},${g},${b},${a})` : `rgb(${r},${g},${b})`;
};
const shade = (hex, f) => ((Math.min(255, (hex >> 16 & 255) * f) | 0) << 16) | ((Math.min(255, (hex >> 8 & 255) * f) | 0) << 8) | (Math.min(255, (hex & 255) * f) | 0);

function _canvas(S) { const c = document.createElement('canvas'); c.width = c.height = S; return c; }
function _canvas2(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}
/* Sorteio semeado. A textura precisa sair idêntica quando redesenhada, senão o
   truque de costura em tileTexture() vira quatro texturas diferentes empilhadas.
   mulberry32 é o mesmo gerador do mundo; a cópia mora aqui porque art.js também
   roda sozinho (tools/amostra/kaykit.html carrega só ele). */
let _rnd = Math.random;
const _mulberry = a => () => {
  a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
const _hash = s => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

function _speckle(ctx, S, hex, n, sMin, sMax, fLo, fHi) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = _rgb(hex, fLo + _rnd() * (fHi - fLo));
    const s = sMin + _rnd() * (sMax - sMin);
    ctx.fillRect(_rnd() * S, _rnd() * S, s, s);
  }
}
function _cracks(ctx, S, hex, n, f) {
  ctx.lineWidth = 1.4; ctx.strokeStyle = _rgb(hex, f);
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    let x = _rnd() * S, y = _rnd() * S;
    ctx.moveTo(x, y);
    for (let j = 0; j < 3; j++) { x += (_rnd() - .5) * S * .16; y += (_rnd() - .5) * S * .16; ctx.lineTo(x, y); }
    ctx.stroke();
  }
}

/* --------------------------------------------------------- texturas de chão */
const TEX_CACHE = {};
const TEX_DRAW = {
  grass(ctx, S, c) {
    ctx.fillStyle = _rgb(c); ctx.fillRect(0, 0, S, S);
    _speckle(ctx, S, c, 700, 1, 3, .7, 1.3);
    ctx.lineWidth = 1;
    for (let i = 0; i < 70; i++) {                       // tufos de grama
      const x = _rnd() * S, y = _rnd() * S;
      ctx.strokeStyle = _rgb(c, .6 + _rnd() * .8);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (_rnd() - .5) * 3, y - 3 - _rnd() * 4); ctx.stroke();
    }
  },
  dirt(ctx, S, c) {
    ctx.fillStyle = _rgb(c); ctx.fillRect(0, 0, S, S);
    _speckle(ctx, S, c, 500, 1, 4, .75, 1.25);
    for (let i = 0; i < 26; i++) {                       // pedrinhas
      ctx.fillStyle = _rgb(c, 1.4); ctx.beginPath();
      ctx.arc(_rnd() * S, _rnd() * S, .8 + _rnd() * 1.2, 0, 7); ctx.fill();
    }
  },
  sand(ctx, S, c) {
    ctx.fillStyle = _rgb(c); ctx.fillRect(0, 0, S, S);
    _speckle(ctx, S, c, 900, 1, 2, .88, 1.12);
    ctx.strokeStyle = _rgb(c, .88); ctx.lineWidth = 1.5;
    const k = Math.PI * 2 / S;                           // período = S: a onda fecha na borda
    for (let i = 0; i < 5; i++) {                        // marcas de vento
      ctx.beginPath();
      for (let x = 0; x <= S; x += 6) ctx.lineTo(x, i * S / 5 + Math.sin(x * k * 2 + i) * 3);
      ctx.stroke();
    }
  },
  water(ctx, S, c) {
    // fundo chapado: o gradiente vertical de antes ia de claro a escuro e saltava
    // de volta na emenda, o que virava listra a cada 3 tiles. A profundidade sai
    // do respingo, que costura.
    ctx.fillStyle = _rgb(c); ctx.fillRect(0, 0, S, S);
    _speckle(ctx, S, c, 420, 2, 6, .82, 1.18);
    ctx.strokeStyle = _rgb(c, 1.9); ctx.lineWidth = 1.6;
    const k = Math.PI * 2 / S;
    for (let i = 0; i < 7; i++) {                        // ondinhas
      ctx.globalAlpha = .2 + _rnd() * .25;
      ctx.beginPath();
      for (let x = 0; x <= S; x += 4) ctx.lineTo(x, i * S / 7 + Math.sin(x * k * 3 + i * 2) * 2.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },
  rock(ctx, S, c) {
    ctx.fillStyle = _rgb(c); ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 90; i++) {                       // facetas de pedra
      ctx.fillStyle = _rgb(c, .78 + _rnd() * .5);
      ctx.beginPath();
      const x = _rnd() * S, y = _rnd() * S, r = 2.5 + _rnd() * 5;
      for (let a = 0; a < 6; a++) ctx.lineTo(x + Math.cos(a * 1.05) * r * (.6 + _rnd() * .6), y + Math.sin(a * 1.05) * r * (.6 + _rnd() * .6));
      ctx.fill();
    }
    _cracks(ctx, S, c, 26, .5);
    _speckle(ctx, S, c, 260, 1, 2, .8, 1.2);
  },
  cave(ctx, S, c) {
    ctx.fillStyle = _rgb(c); ctx.fillRect(0, 0, S, S);
    _speckle(ctx, S, c, 600, 1, 3, .65, 1.4);
    _cracks(ctx, S, c, 30, .55);
  },
  lava(ctx, S, c) {
    ctx.fillStyle = _rgb(c, .32); ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 22; i++) {                       // veios incandescentes
      ctx.strokeStyle = _rgb(c, 1 + _rnd() * .9);
      ctx.lineWidth = 1 + _rnd() * 3;
      ctx.beginPath();
      let x = _rnd() * S, y = _rnd() * S; ctx.moveTo(x, y);
      for (let j = 0; j < 4; j++) ctx.lineTo(x += (_rnd() - .5) * 30, y += (_rnd() - .5) * 30);
      ctx.stroke();
    }
  },
  stone(ctx, S, c) {                                     // piso do templo: lajotas
    ctx.fillStyle = _rgb(c, .72); ctx.fillRect(0, 0, S, S);
    const n = 3, p = S / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      ctx.fillStyle = _rgb(c, .92 + _rnd() * .22);
      ctx.fillRect(i * p + 2, j * p + 2, p - 4, p - 4);
    }
    _speckle(ctx, S, c, 300, 1, 2, .8, 1.15);
  }
};
/* 96×96 = 3×3 tiles de 32: o recorte varia por tile e o chão não fica repetido.
   A textura é desenhada 9×: uma centrada e oito deslocadas de ±S. O respingo que
   escapa pela direita reentra pela esquerda, o que fecha a emenda que aparecia a
   cada 3 tiles. Duas condições fazem funcionar: o sorteio é semeado, então as 9
   passadas saem idênticas; e o fundo opaco de cada rotina só cai na tela na
   passada (0,0) — nas outras oito ele pinta fora do canvas. Por isso (0,0) vem
   primeiro: se viesse depois apagaria as bordas costuradas. */
const TEX_S = 96;
const _WRAP = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
function tileTexture(kind, hex) {
  const key = kind + hex;
  if (TEX_CACHE[key]) return TEX_CACHE[key];
  const c = _canvas(TEX_S), g = c.getContext('2d'), seed = _hash(key);
  for (const [dx, dy] of _WRAP) {
    _rnd = _mulberry(seed);
    g.save(); g.translate(dx * TEX_S, dy * TEX_S);
    TEX_DRAW[kind](g, TEX_S, hex);
    g.restore();
  }
  _rnd = Math.random;
  return TEX_CACHE[key] = c;
}

/* Água e lava correm: a textura já é costurada, então basta deslocar o recorte
   com o tempo. A cópia empilhada em dobro evita ter de quebrar o desenho em dois
   quando o recorte passa da borda de baixo — o recorte anda no máximo TEX_S e a
   altura é 2×TEX_S, então nunca sai da folha. */
const FLOW_CACHE = {};
function flowTexture(kind, hex) {
  const key = kind + hex;
  if (FLOW_CACHE[key]) return FLOW_CACHE[key];
  const src = tileTexture(kind, hex), c = _canvas2(TEX_S, TEX_S * 2), g = c.getContext('2d');
  g.drawImage(src, 0, 0); g.drawImage(src, 0, TEX_S);
  return FLOW_CACHE[key] = c;
}

/* ---------------------------------------------------- bordas de terreno */
/* Quem tem prioridade maior invade o vizinho. Água é a menor de todas: assim é a
   margem de terra que avança sobre a água, e não a água sobre a praia. */
const TERRAIN_PRIO = { water: 0, lava: 1, grass: 2, cave: 3, dirt: 4, sand: 5, rock: 6, stone: 7 };

/* 8 máscaras de 32×32: 0..3 = N,L,S,O; 4..7 = NL,SL,SO,NO.
   O degradê sozinho dá borda de aerógrafo, que destoa de tudo em volta. A
   mordida em destination-out quebra a reta e devolve o serrilhado — e só morde
   onde a máscara já está no meio do caminho, para não furar o miolo opaco. */
const MASK_CACHE = [];
function edgeMask(m) {
  if (MASK_CACHE[m]) return MASK_CACHE[m];
  const c = _canvas(32), g = c.getContext('2d');
  _rnd = _mulberry(m * 7919 + 13);
  if (m < 4) {
    const [ax, ay] = [[0, 1], [-1, 0], [0, -1], [1, 0]][m];      // sentido do desvanecer
    const gr = g.createLinearGradient(16 - ax * 16, 16 - ay * 16, 16 + ax * 16, 16 + ay * 16);
    gr.addColorStop(0, '#fff'); gr.addColorStop(.12, '#fff'); gr.addColorStop(.45, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
  } else {
    const cx = m === 4 || m === 5 ? 32 : 0, cy = m === 5 || m === 6 ? 32 : 0;
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, 15);
    gr.addColorStop(0, '#fff'); gr.addColorStop(.3, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
  }
  g.fillRect(0, 0, 32, 32);
  const d = g.getImageData(0, 0, 32, 32).data;
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 300; i++) {
    const x = (_rnd() * 16 | 0) * 2, y = (_rnd() * 16 | 0) * 2;
    const a = d[(y * 32 + x) * 4 + 3] / 255;
    if (_rnd() > 1 - a) continue;                                // quanto mais opaco, menos mordida
    g.globalAlpha = .6 + _rnd() * .4;
    g.fillRect(x, y, 2, 2);
  }
  _rnd = Math.random;
  return MASK_CACHE[m] = c;
}

const BORDER_CACHE = {};
function borderSprite(kind, hex, m) {
  const key = kind + hex + '|' + m;
  if (BORDER_CACHE[key]) return BORDER_CACHE[key];
  const c = _canvas(32), g = c.getContext('2d');
  /* ponytail: recorte fixo (0,0) dos 96 — a borda não continua o padrão exato do
     tile vizinho. Invisível em textura de ruído costurado, que é o caso de todas.
     Se entrar terreno estruturado na borda, indexar o recorte por x%3,y%3. */
  g.drawImage(tileTexture(kind, hex), 0, 0, 32, 32, 0, 0, 32, 32);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(edgeMask(m), 0, 0);
  return BORDER_CACHE[key] = c;
}

/* ------------------------------------------------------------ arrebentação */
/* A borda de terreno já resolve a reta de 90° entre dois chãos, mas água
   encostando em terra continua uma emenda parada: falta o que praia tem, que é a
   espuma. Faixa clara e estreita, desenhada no tile de ÁGUA.
   O pico NÃO fica na borda do tile: a margem visível não está ali, e sim uns
   12px para dentro da água, que é até onde a terra invadiu (o desvanecer de
   edgeMask morre em ~.45 de 32px). Por isso o gradiente sobe do nada em .22,
   estoura em .38 e volta a nada em .60 — a faixa cai justamente em cima do
   contato, e não em cima da areia nem no meio do lago.
   A mordida é a mesma ideia de edgeMask: espuma é renda, fita adesiva não. */
const FOAM_CACHE = [];
const FOAM_COR = '226,242,255';
function foamSprite(m) {
  if (FOAM_CACHE[m]) return FOAM_CACHE[m];
  const c = _canvas(32), g = c.getContext('2d');
  _rnd = _mulberry(m * 104729 + 7);
  const [ax, ay] = [[0, 1], [-1, 0], [0, -1], [1, 0]][m];      // mesmo sentido de edgeMask
  const gr = g.createLinearGradient(16 - ax * 16, 16 - ay * 16, 16 + ax * 16, 16 + ay * 16);
  gr.addColorStop(0, `rgba(${FOAM_COR},0)`);
  gr.addColorStop(.22, `rgba(${FOAM_COR},0)`);
  gr.addColorStop(.38, `rgba(${FOAM_COR},.9)`);
  gr.addColorStop(.60, `rgba(${FOAM_COR},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 150; i++) {
    g.globalAlpha = .5 + _rnd() * .5;
    g.fillRect((_rnd() * 16 | 0) * 2, (_rnd() * 16 | 0) * 2, 2, 2);
  }
  _rnd = Math.random;
  return FOAM_CACHE[m] = c;
}

/* ------------------------------------------------------------ paredes 32×48 */
/* No Tibia a parede é vista de frente e transborda para cima, invadindo o tile
   de trás. Topo claro + face escura + bisel = volume sem 3D. */
const WALL_CACHE = {};
const WALL_TOP = 16, WALL_H = 32 + WALL_TOP;
function wallSprite(kind, hex) {
  const key = kind + hex;
  if (WALL_CACHE[key]) return WALL_CACHE[key];
  const tex = tileTexture(kind, hex), c = _canvas2(32, WALL_H), g = c.getContext('2d');
  /* O que faz ler como parede é a diferença de valor entre topo e face, não a
     textura: com .16 de claro contra .2 de escuro as duas ficavam quase no mesmo
     tom e o bloco virava laje. Agora o topo é chapa iluminada e a face é sombra
     funda, com a quina viva entre as duas. */
  g.drawImage(tex, 0, 0, 32, WALL_TOP, 0, 0, 32, WALL_TOP);            // topo
  g.fillStyle = 'rgba(255,246,225,.30)'; g.fillRect(0, 0, 32, WALL_TOP);
  g.drawImage(tex, 0, 32, 32, 32, 0, WALL_TOP, 32, 32);                 // face
  g.fillStyle = 'rgba(0,0,0,.46)'; g.fillRect(0, WALL_TOP, 32, 32);
  // a face escurece para baixo: o pé da parede é o que menos vê o céu
  const fundo = g.createLinearGradient(0, WALL_TOP, 0, WALL_H);
  fundo.addColorStop(0, 'rgba(0,0,0,0)'); fundo.addColorStop(1, 'rgba(0,0,0,.3)');
  g.fillStyle = fundo; g.fillRect(0, WALL_TOP, 32, 32);
  g.fillStyle = 'rgba(255,250,235,.42)'; g.fillRect(0, WALL_TOP, 32, 1);   // quina
  g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, WALL_H - 2, 32, 2);
  return WALL_CACHE[key] = c;
}

/* -------------------------------------------------------- sprites 2D (Tibia) */
/* 4 direções × 3 quadros de passo, desenhados uma vez e guardados em cache.
   Caixa base 32×40 com os pés em (16,38); `size` escala tudo (1 = humano).
   Só três desenhos por criatura: frente, costas e perfil — o oeste é o leste
   espelhado, exatamente como o cliente faz. */
const DIR_S = 0, DIR_W = 1, DIR_N = 2, DIR_E = 3;
const SPR_CACHE = {};
const SPR_W = 32, SPR_H = 40, SPR_FEET = 38;

function _el(g, x, y, rx, ry, c) { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); }
function _rc(g, x, y, w, h, c, r) { g.fillStyle = c; g.beginPath(); g.roundRect(x, y, w, h, r === undefined ? 1.5 : r); g.fill(); }
function _poly(g, pts, c) {
  g.fillStyle = c; g.beginPath();
  pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
  g.closePath(); g.fill();
}
function _olhos(g, x, y, c, sep) {
  g.fillStyle = c;
  g.fillRect(x - (sep || 2.6) - .9, y, 1.8, 2); g.fillRect(x + (sep || 2.6) - .9, y, 1.8, 2);
}

const SHAPE_DRAW = {
  biped(g, color, o, dir, sw) {
    const md = _rgb(color), dk = _rgb(color, .68), esc = _rgb(color, .45);
    const pele = o.skin || shade(color, 1.25);
    const perfil = dir === DIR_E, costas = dir === DIR_N;
    const bw = o.thin ? 9 : 12, cw = perfil ? bw * .78 : bw;

    if (o.wings) {                                     // asas atrás do corpo
      const wc = _rgb(shade(color, .5));
      _el(g, 16 - 9, 17, 7, 9.5, wc); _el(g, 16 + 9, 17, 7, 9.5, wc);
    }
    // pernas: perna curta = pé no ar. No perfil elas abrem no eixo do passo.
    const p1 = 10 - Math.max(0, sw) * 2.5, p2 = 10 - Math.max(0, -sw) * 2.5;
    _rc(g, 16 - 4.5 + (perfil ? sw * 2 : 0), 28, 4, p1, esc);
    _rc(g, 16 + .5 - (perfil ? sw * 2 : 0), 28, 4, p2, dk);
    _rc(g, 16 - cw / 2, 15, cw, 14, md, 4);            // tronco
    _rc(g, 16 - cw / 2 - 1, 13.5, cw + 2, 4.5, dk, 2); // ombros
    if (perfil) _rc(g, 16 + 1, 17 + sw * 1.5, 3.2, 10, dk);
    else {
      _rc(g, 16 - cw / 2 - 2.6, 17 - sw, 3.2, 10, dk);
      _rc(g, 16 + cw / 2 - .6, 17 + sw, 3.2, 10, dk);
    }
    _el(g, 16, 9.5, 6, 6.5, _rgb(pele));               // cabeça
    if (costas) _el(g, 16, 8, 6, 5, _rgb(shade(pele, .55)));            // nuca/cabelo
    else if (perfil) {
      _el(g, 15, 7.5, 5.4, 4.4, _rgb(shade(pele, .55)));
      _poly(g, [[21.4, 9], [23, 10.4], [21.4, 11.2]], _rgb(pele));      // nariz
      _olhos(g, 19, 8.6, _rgb(o.eyes || 0x20180f), 0);
    } else _olhos(g, 16, 8.6, _rgb(o.eyes || 0x20180f));
    if (o.horns) {
      const hc = _rgb(o.hornCol || 0xe8e0cc);
      _poly(g, [[11.5, 6.5], [13.5, 2], [14.5, 7]], hc);
      _poly(g, [[20.5, 6.5], [18.5, 2], [17.5, 7]], hc);
    }
    if (o.weapon && !costas) {                         // arma na mão direita
      _rc(g, 16 + cw / 2 + 1.4, 11, 2.6, 14, _rgb(o.weapon), 1);
      _rc(g, 16 + cw / 2 + .2, 24.5, 5, 2, _rgb(0x5a4630), 1);
    }
    if (o.shield && !costas && !perfil) _el(g, 16 - cw / 2 - 3, 21, 3.2, 5.6, _rgb(o.shield));
  },

  quadruped(g, color, o, dir, sw) {
    const md = _rgb(color), dk = _rgb(color, .7), lt = _rgb(color, 1.28), esc = _rgb(color, .45);
    if (dir === DIR_E) {
      _rc(g, 3, 24, 5, 2.4, dk, 1.2);                                   // rabo
      [8, 12, 18, 22].forEach((x, i) => _rc(g, x + (i % 2 ? sw * 2 : -sw * 2), 30, 3.2, 7, i < 2 ? esc : dk));
      _rc(g, 6, 21, 19, 10, md, 5);                                     // corpo
      _el(g, 25, 19, 5.2, 4.6, lt);                                     // cabeça
      _poly(g, [[22.5, 16.5], [23.5, 12], [25.5, 15.5]], dk);
      _poly(g, [[26.5, 15.5], [28.5, 12], [29, 16.5]], dk);
      _el(g, 29.5, 20.5, 1.6, 1.4, _rgb(0x2a2018));                     // focinho
      _olhos(g, 26.5, 17.6, _rgb(o.eyes || 0x1a1410), 0);
    } else {
      const costas = dir === DIR_N;
      [11, 21].forEach((x, i) => _rc(g, x - 1.6 + (i ? sw : -sw), 30, 3.4, 7, dk));
      _el(g, 16, 26, 8.5, 6.5, md);                                     // corpo de frente
      if (costas) { _el(g, 16, 20, 5.4, 4.8, dk); _rc(g, 15, 12, 2, 6, dk, 1); }
      else {
        _el(g, 16, 19.5, 5.4, 5, lt);                                   // cabeça
        _poly(g, [[11.5, 17], [12.5, 12], [14.5, 16.5]], dk);
        _poly(g, [[20.5, 16.5], [19.5, 12], [17.5, 17]], dk);
        _el(g, 16, 22, 1.8, 1.4, _rgb(0x2a2018));
        _olhos(g, 16, 18, _rgb(o.eyes || 0x1a1410), 2.2);
      }
    }
  },

  arachnid(g, color, o, dir, sw) {
    const md = _rgb(color), dk = _rgb(color, .62), lt = _rgb(color, 1.3);
    for (let i = 0; i < 8; i++) {                                       // 8 patas
      const lado = i < 4 ? -1 : 1, k = i % 4;
      const x0 = 16 + lado * 4, y0 = 24 + k * 1.6;
      const dobra = Math.sin(sw * 1.2 + k * 1.4) * 2;
      g.strokeStyle = dk; g.lineWidth = 1.6; g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x0 + lado * 6, y0 - 4 + dobra);
      g.lineTo(x0 + lado * 11, y0 + 6 + dobra * .5);
      g.stroke();
    }
    _el(g, 16, 27, 8, 7, md);                                           // abdômen
    _el(g, 16, 27, 5, 4, dk);
    _el(g, 16, 20, 5.4, 4.6, lt);                                       // cefalotórax
    for (let i = 0; i < 4; i++) {                                       // olhinhos vermelhos
      g.fillStyle = _rgb(o.eyes || 0xff5555);
      g.fillRect(13.4 + i * 1.8, 18.4 - (i % 2), 1.4, 1.4);
    }
    _poly(g, [[14, 23.5], [15, 26], [15.8, 23.5]], dk);                 // quelíceras
    _poly(g, [[18, 23.5], [17, 26], [16.2, 23.5]], dk);
  },

  serpent(g, color, o, dir, sw) {
    const md = _rgb(color), dk = _rgb(color, .72), lt = _rgb(color, 1.3);
    for (let i = 5; i >= 0; i--) {                                      // corpo em S
      const t = i / 5;
      _el(g, 16 + Math.sin(i * 1.05 + sw * .5) * 7, 35 - i * 3.8, 4.4 - t * 1.4, 3.4 - t * .8, i % 2 ? md : dk);
    }
    const hx = 16 + Math.sin(6 * 1.05 + sw * .5) * 7;
    _el(g, hx, 12.5, 4.4, 3.6, lt);                                     // cabeça
    _olhos(g, hx, 11, _rgb(o.eyes || 0xffe066), 2);
    g.strokeStyle = '#e05'; g.lineWidth = 1; g.beginPath();             // língua
    g.moveTo(hx, 15.5); g.lineTo(hx, 18.5); g.stroke();
  },

  worm(g, color, o, dir, sw) {
    const md = _rgb(color), dk = _rgb(color, .68);
    for (let i = 5; i >= 0; i--)
      _el(g, 16 + Math.sin(sw * .8 + i * .7) * 1.6, 34 - i * 4, 5.4 - i * .35, 3.6, i % 2 ? md : dk);
    _olhos(g, 16, 13, _rgb(o.eyes || 0x99ff99), 2);
    g.fillStyle = _rgb(0x3a1010); g.fillRect(14, 16, 4, 1.6);           // boca
  },

  dragon(g, color, o, dir, sw) {
    const md = _rgb(color), dk = _rgb(color, .66), lt = _rgb(color, 1.3), esc = _rgb(color, .42);
    const wc = _rgb(shade(color, .5));
    if (dir === DIR_E) {
      _el(g, 4, 20, 5, 9, wc);                                          // asa
      _rc(g, 1, 26, 7, 2.6, dk, 1.2);                                   // rabo
      [7, 11, 19, 23].forEach((x, i) => _rc(g, x + (i % 2 ? sw * 2 : -sw * 2), 29, 4, 8, i < 2 ? esc : dk));
      _rc(g, 5, 17, 21, 13, md, 6);
      _el(g, 26, 13, 6, 5, lt);
      _poly(g, [[23, 10], [25, 5], [27, 10]], esc);
      _olhos(g, 27, 11.5, _rgb(o.eyes || 0xffcc33), 0);
      _poly(g, [[30, 13], [32, 14.5], [30, 16]], _rgb(0xffaa33));       // baforada
    } else {
      const costas = dir === DIR_N;
      _el(g, 6, 18, 6, 10, wc); _el(g, 26, 18, 6, 10, wc);              // asas
      [10, 22].forEach((x, i) => _rc(g, x - 2 + (i ? sw : -sw), 28, 4.5, 9, esc));
      _el(g, 16, 22, 10, 9, md);
      if (costas) { _el(g, 16, 13, 6, 5.5, dk); _rc(g, 15, 24, 2, 12, esc, 1); }
      else {
        _el(g, 16, 12.5, 6.5, 5.5, lt);
        _poly(g, [[11, 10], [12.5, 4], [15, 9]], esc);
        _poly(g, [[21, 10], [19.5, 4], [17, 9]], esc);
        _olhos(g, 16, 11, _rgb(o.eyes || 0xffcc33), 2.8);
        _poly(g, [[14, 16], [16, 19], [18, 16]], _rgb(0xffaa33));
      }
    }
  }
};

/* cópia chapada do desenho, usada pelo contorno */
function _chapado(cv, cor) {
  const s = _canvas2(cv.width, cv.height), g = s.getContext('2d');
  g.drawImage(cv, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = cor; g.fillRect(0, 0, s.width, s.height);
  return s;
}
/* O contorno é a própria silhueta escura carimbada nos 8 sentidos, com o desenho
   por cima. Sem ele o bicho da cor do chão simplesmente some — rato em terra,
   verme na grama. Custo só na montagem do cache; o quadro não paga nada. */
const OITO = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const SPR_PAD = 2;

function creatureSprite(shape, color, size, o, dir, frame) {
  o = o || {};
  const key = [shape, color, size, dir, frame, o.skin, o.eyes, o.weapon, o.shield, o.horns, o.wings, o.hornCol, o.thin].join('|');
  if (SPR_CACHE[key]) return SPR_CACHE[key];
  const s = Math.max(.45, size) * 1.15;
  const base = _canvas2(SPR_W * s, SPR_H * s), bg = base.getContext('2d');
  bg.scale(s, s);
  if (dir === DIR_W) { bg.translate(SPR_W, 0); bg.scale(-1, 1); }        // oeste = leste espelhado
  const sw = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  (SHAPE_DRAW[shape] || SHAPE_DRAW.biped)(bg, color, o, dir === DIR_W ? DIR_E : dir, sw);

  const p = SPR_PAD;
  const c = _canvas2(base.width + p * 2, base.height + p * 2), g = c.getContext('2d');
  const negro = _chapado(base, '#140f0b');
  for (const [dx, dy] of OITO) g.drawImage(negro, p + dx, p + dy);
  g.drawImage(base, p, p);
  c.cx = SPR_W / 2 * s + p; c.feet = SPR_FEET * s + p;                   // âncora: pés no chão do tile
  return SPR_CACHE[key] = c;
}

/* ---------------------------------------------------------- decoração/chão */
const DECO_CACHE = {};
/* k: 0 = árvore, 1 = pedra/estalagmite, 2 = arbusto. `v` dá variação por tile.
   O sorteio antigo era `(v*37 + a*13) % 100`, que usava o próprio limite do
   intervalo como semente: mudava a cor mas devolvia o mesmo número para o mesmo
   intervalo, então a silhueta saía idêntica em todas as árvores e a floresta
   virava carimbo repetido. Agora é o mesmo mulberry das texturas, semeado por
   `v`, e altura, tronco, copa e espécie variam de verdade. */
function decoSprite(k, v) {
  const key = k + ':' + v;
  if (DECO_CACHE[key]) return DECO_CACHE[key];
  _rnd = _mulberry(_hash('deco' + k + '_' + v));
  const r = (a, b) => a + _rnd() * (b - a);
  const conifera = k === 0 && _rnd() < .42;
  const alt = Math.round(k === 0 ? r(46, 62) : k === 1 ? r(20, 30) : r(15, 22));
  const c = _canvas2(32, alt), g = c.getContext('2d');
  if (k === 0) {
    const tronco = r(13, 20), leve = r(-1.6, 1.6);
    _rc(g, 16 - 2.2 + leve, alt - tronco, 4.4, tronco, _rgb(shade(0x4a3520, r(.85, 1.2))), 1);
    const cor = shade(conifera ? 0x27562a : 0x2f6b28, r(.78, 1.3));
    if (conifera) {                                                      // pinheiro: saias que afinam
      const base = alt - tronco + 3;
      for (let i = 0; i < 3; i++) {
        const w = 12 - i * 3, yy = base - i * r(8, 10);
        _poly(g, [[16 - w, yy], [16, yy - r(11, 15)], [16 + w, yy]], _rgb(cor, 1 - i * .13));
      }
    } else {                                                             // copa em bolhas
      const cy = alt - tronco - r(7, 11), raio = r(9, 12);
      _el(g, 16, cy + 3, raio, raio * .88, _rgb(cor, .8));
      for (let i = 0; i < 3; i++)
        _el(g, 16 + r(-5, 5), cy - r(0, 7), raio * r(.5, .75), raio * r(.45, .7), _rgb(cor, r(.95, 1.35)));
    }
  } else if (k === 1) {
    const cor = shade(0x6a6560, r(.75, 1.2)), pico = r(.7, 1), lado = r(-3, 3);
    const topo = alt - 20 * pico;
    _poly(g, [[8, alt], [11, alt - 14 * pico], [16 + lado, topo], [21, alt - 13 * pico], [25, alt]], _rgb(cor));
    _poly(g, [[16 + lado, topo], [21, alt - 13 * pico], [25, alt], [19, alt]], _rgb(cor, .72));
  } else {
    const cor = shade(0x3f7a35, r(.8, 1.25));
    for (let i = 0; i < 3; i++)
      _el(g, 16 + r(-6, 6), alt - r(4, 11), r(5, 7.5), r(4.5, 6.5), _rgb(cor, r(.8, 1.25)));
  }
  c.cx = 16; c.feet = alt;
  _rnd = Math.random;
  return DECO_CACHE[key] = c;
}

/* ---------------------------------------------------- folha do ranger (PNG) */
/* tools/amostra/ranger_frames.png: 7×4 células de 184×236, 24 quadros úteis (as linhas
   têm 7,6,6,5 — a última coluna de três delas é vazia). Conferido na folha: toda
   célula já vem com os pés em y=230 e o conteúdo centrado em x=92, então a
   âncora é fixa e não precisa de bbox por quadro.
   A escala 0.2 põe o boneco na mesma caixa do sprite procedural (36.8×46 em
   unidades de mundo). Mas o cache é feito já no tamanho FINAL de tela, isto é,
   multiplicado pela ampliação da câmera: assim a célula de 184×236 é reduzida
   uma única vez, com filtro bom, e o desenho sai 1:1 sem passar por nearest.
   Cachear na unidade de mundo e deixar o mundo dobrar depois custava quase todo
   o detalhe — reduzia 5× e ampliava 2× em cima do estrago. */
const SHEET_CW = 184, SHEET_CH = 236, SHEET_ESC = .2;
const SHEET_LINHAS = [7, 6, 6, 5];
const SHEET_POS = [];
SHEET_LINHAS.forEach((n, r) => { for (let c = 0; c < n; c++) SHEET_POS.push([r, c]); });

/* [parado, passo, passo] por direção (DIR_S, DIR_W, DIR_N, DIR_E). É só isto que
   muda para trocar quadro. Foram dados dois quadros de caminhada por direção; o
   primeiro do par serve também de pose parada, então andar alterna os dois e
   parar volta ao primeiro.
   Espelho: os quadros 7–12 da folha olham todos para a esquerda — o que muda
   entre eles é a perna, não a direção (os rótulos "Lado →" da prévia não se
   confirmam na imagem). Então o leste é o oeste invertido, como o procedural já
   fazia. Inverter em torno do meio da célula é exato porque o conteúdo de toda
   célula está centrado em x=92 = CW/2. */
const RANGER_DIR = { 0: [0, 0, 2], 1: [8, 8, 9], 2: [4, 4, 5], 3: [8, 8, 9] };
const RANGER_ESP = { 3: true };

let sheetImg = null;
const SHEET_CACHE = {};
/* `esc` é a ampliação com que o mundo vai desenhar (CAM.scale, 1 a 4). O quadro
   é reduzido já para o tamanho final em tela e marcado com `k` = 1/esc, que o
   desenho usa para não ampliar de novo. Uma redução só, com filtro bom, e blit
   1:1 — sem nearest no caminho. */
function rangerSprite(dir, frame, esc) {
  if (!sheetImg) { sheetImg = new Image(); sheetImg.src = 'tools/amostra/ranger_frames.png'; }
  if (!sheetImg.complete || !sheetImg.naturalWidth) return null;   // ainda carregando
  esc = esc || 1;
  const key = dir + ':' + frame + ':' + esc;
  if (SHEET_CACHE[key]) return SHEET_CACHE[key];
  const [r, c] = SHEET_POS[RANGER_DIR[dir][frame]];
  const w = Math.round(SHEET_CW * SHEET_ESC * esc), h = Math.round(SHEET_CH * SHEET_ESC * esc);
  const cv = _canvas2(w, h), g = cv.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  if (RANGER_ESP[dir]) { g.translate(w, 0); g.scale(-1, 1); }
  g.drawImage(sheetImg, c * SHEET_CW, r * SHEET_CH, SHEET_CW, SHEET_CH, 0, 0, w, h);
  cv.cx = 92 * SHEET_ESC * esc; cv.feet = 230 * SHEET_ESC * esc;
  cv.k = 1 / esc;                          // já está em pixel de tela
  return SHEET_CACHE[key] = cv;
}

/* --------------------------------------------- folha de criatura (PNG) */
/* assets/creatures/<nome>.png, montada por assets/build_criaturas.py: célula
   fixa de 208×248, colunas = quadro (parado, passo, passo), linhas = direção na
   ordem DIR_S/DIR_W/DIR_N/DIR_E e mais uma de tombado. O script já centrou o
   corpo e pôs os pés em PES, então a âncora é a mesma em toda célula — nada de
   tabela por quadro.
   A célula ocupa a MESMA caixa do boneco procedural do mesmo `size`, senão a
   criatura com folha nasceria de outro tamanho que a da tabela manda.
   Cache no tamanho final de tela (`esc` = ampliação da câmera) e `k` = 1/esc,
   pelo mesmo motivo do ranger: uma redução só, com filtro bom, e blit 1:1. */
const CRIA_CW = 208, CRIA_CH = 248, CRIA_PES = 244, CRIA_MORTO = 4;
const criaImg = {}, CRIA_CACHE = {};

function creatureSheet(nome, dir, frame, esc, size) {
  let im = criaImg[nome];
  if (!im) { im = criaImg[nome] = new Image(); im.src = `assets/creatures/${nome}.png`; }
  if (!im.complete || !im.naturalWidth) return null;          // ainda carregando
  esc = esc || 1;
  const key = [nome, dir, frame, esc, size].join(':');
  if (CRIA_CACHE[key]) return CRIA_CACHE[key];
  const f = SPR_H * Math.max(.45, size) * 1.15 / CRIA_CH * esc;   // mesma escala do procedural
  const w = Math.round(CRIA_CW * f), h = Math.round(CRIA_CH * f);
  const cv = _canvas2(w, h), g = cv.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(im, frame * CRIA_CW, dir * CRIA_CH, CRIA_CW, CRIA_CH, 0, 0, w, h);
  cv.cx = w / 2; cv.feet = CRIA_PES * f;
  cv.k = 1 / esc;                          // já está em pixel de tela
  return CRIA_CACHE[key] = cv;
}

/* ------------------------------------------------------- ícones de item */
/* Os PNGs do inventário servem no chão também. <img> carrega sozinho; enquanto
   não chegou devolve null e o chamador desenha o quadradinho de antes. */
const ICON_CACHE = {};
function itemIcon(nome) {
  if (!nome) return null;
  let im = ICON_CACHE[nome];
  if (!im) { im = ICON_CACHE[nome] = new Image(); im.src = `assets/icons/${nome}.png`; }
  return im.complete && im.naturalWidth ? im : null;
}

/* Primeira linha com pixel opaco do sprite. O canvas tem folga vazia por cima —
   na célula do ranger são 54px dos 236, quase um quinto — então ancorar a placa
   de nome no topo do canvas deixa o nome boiando bem longe da cabeça.
   Guardado no próprio canvas, como cx/feet/k, e só quando alguém pergunta.
   O try existe porque canvas com imagem de outra origem (abrir o jogo por
   file://) proíbe ler pixel: melhor a placa voltar ao topo do canvas do que o
   desenho inteiro parar. */
function spriteTop(spr) {
  if (spr.topo !== undefined) return spr.topo;
  spr.topo = 0;
  try {
    const d = spr.getContext('2d').getImageData(0, 0, spr.width, spr.height).data;
    busca: for (let y = 0; y < spr.height; y++)
      for (let x = 0; x < spr.width; x++)
        if (d[(y * spr.width + x) * 4 + 3] > 16) { spr.topo = y; break busca; }
  } catch (e) { /* canvas manchado: fica em 0 */ }
  return spr.topo;
}

/* ----------------------------------------------------------- contorno */
/* Bicho verde em cima de grama some: o sprite e o chão têm o mesmo valor e a
   silhueta se perde. O contorno é o próprio desenho em preto, deslocado 1px nas
   quatro direções, com o sprite por cima. brightness(0) zera a cor e mantém o
   alfa — sai a forma exata sem máscara.
   Montado uma vez por sprite e guardado como a silhueta: filtrar quatro vezes
   por boneco a cada quadro seria caro à toa. A folga de 1px acompanha as âncoras,
   senão o boneco sobe 1px ao ganhar contorno.
   ponytail: espessura em pixel de ORIGEM, então ela cresce com o zoom e é mais
   fina nos sprites de folha (que já vêm em escala de tela). Se incomodar, medir
   a folga em pixel de tela e remontar por escala. */
const OUT_CACHE = new WeakMap();
const OUT_OFF = [[0, -1], [1, 0], [0, 1], [-1, 0]];
function outlined(spr) {
  if (!spr) return spr;
  let c = OUT_CACHE.get(spr);
  if (c) return c;
  c = _canvas2(spr.width + 2, spr.height + 2);
  const g = c.getContext('2d');
  g.filter = 'brightness(0)';
  for (const [dx, dy] of OUT_OFF) g.drawImage(spr, 1 + dx, 1 + dy);
  g.filter = 'none';
  g.drawImage(spr, 1, 1);
  c.cx = spr.cx + 1; c.feet = spr.feet + 1; c.k = spr.k;
  OUT_CACHE.set(spr, c);
  return c;
}

/* ------------------------------------------------------------- sombras */
/* A silhueta é o próprio sprite pintado de preto (source-in preserva o alfa das
   bordas). Guardada junto do sprite, que já é eterno no cache.
   O desfoque entra aqui, na montagem, e não no desenho: sombra de borda dura
   vira um decalque recortado, e `filter` a cada quadro por boneco seria caro à
   toa. A folga de SOMBRA_PAD existe para o desfoque não bater na borda e cortar. */
const SIL_CACHE = new WeakMap();
const SOMBRA_PAD = 4;
function silhouette(spr) {
  let s = SIL_CACHE.get(spr);
  if (s) return s;
  const p = SOMBRA_PAD;
  s = _canvas2(spr.width + p * 2, spr.height + p * 2);
  const g = s.getContext('2d');
  g.filter = 'blur(2px)';
  g.drawImage(spr, p, p);
  g.filter = 'none';
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#000';
  g.fillRect(0, 0, s.width, s.height);
  // âncora acompanha a folga; a escala é a mesma do sprite
  s.cx = spr.cx + p; s.feet = spr.feet + p; s.k = spr.k;
  SIL_CACHE.set(spr, s);
  return s;
}

/* Mancha de contato sob os pés. A sombra projetada sai inclinada e some para o
   sudeste; na linha dos pés ela tem só a largura da bota — e em quadro de costas,
   largura zero. Sem esta mancha o boneco fica pairando sobre o próprio rastro.
   Gradiente pronto em canvas pelo mesmo motivo do edgeShadow: um CanvasGradient
   por boneco a cada quadro seria lixo à toa. */
let CONTACT_CACHE = null;
function contactShadow() {
  if (CONTACT_CACHE) return CONTACT_CACHE;
  const c = _canvas(64), g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,.5)');
  gr.addColorStop(.45, 'rgba(0,0,0,.3)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return CONTACT_CACHE = c;
}

/* Oclusão de contato: o sol é fixo no noroeste, então quem é alto ao norte (0)
   ou a oeste (1) escurece aquela borda do tile vizinho. Gradiente pronto em
   canvas — criar um CanvasGradient por tile a cada quadro seria lixo à toa. */
const EDGE_CACHE = {};
function edgeShadow(dir) {
  if (EDGE_CACHE[dir]) return EDGE_CACHE[dir];
  const c = _canvas(32), g = c.getContext('2d');
  const gr = dir ? g.createLinearGradient(0, 0, 14, 0) : g.createLinearGradient(0, 0, 0, 14);
  gr.addColorStop(0, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return EDGE_CACHE[dir] = c;
}

/* Sombra de nuvem: manchas moles em folha que casa consigo mesma, para o render
   ladrilhar sem costura visível. Branco onde não há nuvem — a folha vai por cima
   da cena em `multiply`, então branco não mexe em nada e a mancha escurece.
   Cada blob é pintado 9 vezes (ele e os 8 vizinhos): o que sai por uma borda
   entra pela oposta, que é o que faz a folha fechar.
   A forma não é uma bolha por nuvem: bolha isolada vira bolinha, e um punhado de
   bolinhas iguais vira sarampo. Cada nuvem é um AGLOMERADO de bolhas achatadas e
   giradas, espalhadas ao longo de um eixo próprio — é o que dá contorno irregular
   e alongado, que é o que sombra de nuvem tem. */
let CLOUD_CACHE = null;
const CLOUD_S = 256;
function cloudTexture() {
  if (CLOUD_CACHE) return CLOUD_CACHE;
  const c = _canvas(CLOUD_S), g = c.getContext('2d'), rnd = _mulberry(0xc10d5);
  g.fillStyle = '#fff'; g.fillRect(0, 0, CLOUD_S, CLOUD_S);
  const bolha = (x, y, r, achat, gira, a) => {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const px = x + dx * CLOUD_S, py = y + dy * CLOUD_S;
      if (px < -r || px > CLOUD_S + r || py < -r || py > CLOUD_S + r) continue;
      g.save();
      g.translate(px, py); g.rotate(gira); g.scale(1, achat);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
      gr.addColorStop(0, `rgba(0,0,0,${a})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(-r, -r, r * 2, r * 2);
      g.restore();
    }
  };
  for (let i = 0; i < 6; i++) {
    const cx = rnd() * CLOUD_S, cy = rnd() * CLOUD_S, eixo = rnd() * 6.283;
    const n = 4 + (rnd() * 4 | 0);
    for (let j = 0; j < n; j++) {
      const d = (j / (n - 1) - .5) * CLOUD_S * (.20 + rnd() * .22);
      const desvio = (rnd() - .5) * CLOUD_S * .06;
      bolha(cx + Math.cos(eixo) * d - Math.sin(eixo) * desvio,
            cy + Math.sin(eixo) * d + Math.cos(eixo) * desvio,
            CLOUD_S * (.07 + rnd() * .07), .5 + rnd() * .45, eixo + (rnd() - .5),
            .16 + rnd() * .16);
    }
  }
  return CLOUD_CACHE = c;
}

/* escadas: buraco escuro para descer, degraus claros para subir */
const STAIR_CACHE = {};
function stairSprite(desce) {
  const key = desce ? 'd' : 'u';
  if (STAIR_CACHE[key]) return STAIR_CACHE[key];
  const c = _canvas2(32, 32), g = c.getContext('2d');
  if (desce) {
    _el(g, 16, 16, 12, 11, 'rgba(0,0,0,.85)');
    for (let i = 0; i < 3; i++) { g.fillStyle = _rgb(0x5a5348, 1 - i * .22); g.fillRect(8 + i * 2, 8 + i * 5, 16 - i * 4, 3); }
  } else {
    for (let i = 0; i < 4; i++) { g.fillStyle = _rgb(0x9a9185, .65 + i * .13); g.fillRect(6, 26 - i * 6, 20, 5); }
    g.fillStyle = 'rgba(255,220,140,.25)'; g.fillRect(6, 2, 20, 28);
  }
  return STAIR_CACHE[key] = c;
}

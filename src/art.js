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

/* Puxa a cor para o cinza dela, mantendo o valor. Serve a tile cuja cor tem de
   ser saturada para NÃO se confundir com outro tile na régua de paleta, e cujo
   desenho pede pedra: a laje sai cinza e só o sulco carrega a cor. */
const _dessat = (hex, k) => {
  const r = hex >> 16 & 255, g = hex >> 8 & 255, b = hex & 255, m = (r + g + b) / 3;
  return (Math.round(r + (m - r) * k) << 16) | (Math.round(g + (m - g) * k) << 8) | Math.round(b + (m - b) * k);
};

/* Paleta DISCRETA de um material: n tons fixos, do escuro ao claro. É o que
   separa tileset feito à mão de ruído — arte à mão escolhe cinco cores e usa as
   cinco; `_rgb(c, .7 + rnd * .8)` sorteia um tom contínuo por pixel, e o olho lê
   isso como sujeira uniforme, não como forma. Quem quiser textura de grão
   continua usando _speckle; quem estiver desenhando OBJETO usa isto. */
const _tons = (hex, n, lo, hi) => {
  const t = [];
  for (let i = 0; i < n; i++) t.push(shade(hex, lo + (hi - lo) * i / (n - 1)));
  return t;
};

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
  /* FORMA, CONTORNO E LUZ POR OBJETO — não ruído. A versão anterior era
     _speckle mais risco solto, com tom contínuo sorteado por pixel: lia como
     tinta jogada no chão, que foi como o dono do projeto a descreveu. O que
     separa tileset feito à mão é sempre a mesma receita: objetos discretos, cada
     um com sombra do lado escuro e brilho do lado claro, numa paleta de poucos
     tons fixos. A luz vem de cima-esquerda e é a MESMA para todo objeto — luz
     por objeto costura; o que estraga tile é luz assada no quadro inteiro. */
  grass(ctx, S, c) {
    const t = _tons(c, 5, .78, 1.34);                    // 5 tons, e só eles
    ctx.fillStyle = _rgb(t[1]); ctx.fillRect(0, 0, S, S);
    /* Mancha PEQUENA e de um tom só de diferença. Larga e contrastada, o campo
       vira camuflagem militar: o que se lê são as manchas, e o capim some. Nas
       referências o chão é quase liso e quem carrega a leitura é o tufo. */
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = _rgb(t[_rnd() < .5 ? 0 : 2]);
      ctx.beginPath();
      const x = _rnd() * S, y = _rnd() * S, r = 2.5 + _rnd() * 4.5;
      for (let a = 0; a < 7; a++) {
        const an = a * .9, rr = r * (.6 + _rnd() * .7);
        ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr * .8);
      }
      ctx.fill();
    }
    /* O tufo: 3 a 5 folhas saindo de UMA raiz. Folha solta espalhada vira
       chuvisco; o que o olho lê como capim é o grupo. */
    const tufo = (x, y, n, alt, cor, dx) => {
      ctx.strokeStyle = _rgb(cor); ctx.lineWidth = 1;
      for (let k = 0; k < n; k++) {
        const lado = (k - (n - 1) / 2) / Math.max(1, n - 1);
        ctx.beginPath(); ctx.moveTo(x + dx, y + dx);
        ctx.lineTo(x + dx + lado * 3.4, y + dx - alt * (.68 + _rnd() * .5));
        ctx.stroke();
      }
    };
    for (let i = 0; i < 130; i++) {                      // o tufo é quem faz o capim
      const x = _rnd() * S, y = _rnd() * S, n = 3 + (_rnd() * 3 | 0), alt = 3 + _rnd() * 3.4;
      tufo(x, y, n, alt, t[0], 1);                       // a sombra do tufo, deslocada 1 px
      tufo(x, y, n, alt, t[3 + (_rnd() < .3 ? 1 : 0)], 0);
    }
    /* Rasteira seca, e RARA. A versão com falha de terra escura punha bolinhas
       pretas no capim, que de longe lê como buraco. Nas referências o chão é
       calmo: o que enche o olho é a borda entre terrenos e o que está em cima
       dele, não o chão ficar ocupado. */
    for (let i = 0; i < 9; i++) {
      const x = _rnd() * S, y = _rnd() * S, r = 3 + _rnd() * 4;
      ctx.fillStyle = _rgb(shade(c, .92), .55);
      ctx.beginPath();
      for (let a = 0; a < 7; a++) {
        const an = a * .9, rr = r * (.6 + _rnd() * .7);
        ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr * .8);
      }
      ctx.fill();
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
  snow(ctx, S, c) {
    ctx.fillStyle = _rgb(c); ctx.fillRect(0, 0, S, S);
    _speckle(ctx, S, c, 800, 1, 3, .94, 1.06);           // grão fino: neve não tem contraste
    for (let i = 0; i < 14; i++) {                       // sombra das cristas
      ctx.fillStyle = _rgb(c, .86); ctx.beginPath();
      ctx.ellipse(_rnd() * S, _rnd() * S, 4 + _rnd() * 7, 1.5 + _rnd() * 2, _rnd() * 3, 0, 7); ctx.fill();
    }
  },
  swamp(ctx, S, c) {
    ctx.fillStyle = _rgb(c); ctx.fillRect(0, 0, S, S);
    _speckle(ctx, S, c, 520, 1, 4, .6, 1.35);
    for (let i = 0; i < 9; i++) {                        // poças paradas
      ctx.fillStyle = _rgb(c, .55); ctx.beginPath();
      ctx.ellipse(_rnd() * S, _rnd() * S, 3 + _rnd() * 6, 2 + _rnd() * 4, _rnd() * 3, 0, 7); ctx.fill();
    }
    ctx.lineWidth = 1;
    for (let i = 0; i < 34; i++) {                       // junco
      const x = _rnd() * S, y = _rnd() * S;
      ctx.strokeStyle = _rgb(c, 1.5);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (_rnd() - .5) * 2, y - 4 - _rnd() * 5); ctx.stroke();
    }
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
  /* ---- coisa construída. Nenhuma destas empresta a textura de outra: aqui
     diferenciar É o requisito, e uma fórmula só com a cor trocada foi o que
     produziu os quatro campos de chão indistinguíveis do #33. ---- */
  /* Tábua e prumo, e não taipa clara entre madeira escura: com o barro em 1,7×
     a face saía salmão e o topo, que o wallSprite ainda clareia em 30%, virava
     telha de barro — parede de dois materiais, que é o oposto do que o tile
     existe para resolver. Um material só, e a leitura vem do prumo. */
  wall(ctx, S, c) {                                      // parede de tábua com prumo aparente
    ctx.fillStyle = _rgb(c, 1.15); ctx.fillRect(0, 0, S, S);
    _speckle(ctx, S, c, 380, 1, 3, .95, 1.35);
    const p = S / 6;                                     // 6 prumos em 96 = 2 por tile
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = _rgb(c, .6);  ctx.fillRect(i * p, 0, p * .34, S);              // prumo
      ctx.fillStyle = _rgb(c, .4);  ctx.fillRect(i * p + p * .28, 0, p * .07, S);    // sombra dele
      ctx.fillStyle = _rgb(c, 1.4); ctx.fillRect(i * p + p * .36, 0, 1, S);          // quina iluminada
    }
    _cracks(ctx, S, c, 12, .6);                          // fenda entre tábuas, escura — clara virava cipó
  },
  /* O período destas duas DIVIDE 32 de propósito. O recorte de tileTexture anda
     de 32 em 32 e o de borderSprite é fixo em (0,0): com período que não divida
     o tile, a tábua sairia com a junta em altura diferente conforme a casa caiu
     em linha par ou ímpar, e a borda com a junta de outro tile. */
  plank(ctx, S, c) {                                     // piso de dentro: tábua corrida
    ctx.fillStyle = _rgb(c); ctx.fillRect(0, 0, S, S);
    const n = 12, h = S / n;                             // 12 tábuas em 96 = 4 por tile, 8 px cada
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = _rgb(c, .86 + _rnd() * .3); ctx.fillRect(0, i * h, S, h - 1);
      ctx.fillStyle = _rgb(c, .5);                ctx.fillRect(0, i * h + h - 1, S, 1);
    }
    ctx.lineWidth = 1;                                   // veio: é o que separa tábua de laje
    for (let i = 0; i < 46; i++) {
      const x = _rnd() * S, y = (_rnd() * n | 0) * h + 1 + _rnd() * (h - 3);
      ctx.strokeStyle = _rgb(c, .72 + _rnd() * .12);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 5 + _rnd() * 16, y); ctx.stroke();
    }
  },
  crop(ctx, S, c) {                                      // lavoura: leira lavrada e o que cresce nela
    /* Leira é MASSA de planta, não listra. Com o camalhão em 0,95 contra terra
       em 0,42 e pouco pé por cima, saía código de barras: o que se via era o
       degrau de cor, não a lavoura. Contraste curto e muito pé transbordando a
       leira — é o pé que tem de fechar a linha, e não o retângulo. */
    ctx.fillStyle = _rgb(c, .5); ctx.fillRect(0, 0, S, S);         // terra revirada entre as leiras
    _speckle(ctx, S, c, 420, 1, 3, .42, .66);
    /* Cada leira tem o próprio viço e falha em trechos. Com todas no mesmo tom e
       inteiras de ponta a ponta, o trigal saía impresso — pente, não lavoura. */
    const n = 12, p = S / n;                             // 12 leiras em 96 = 4 por tile, 8 px cada
    const vico = [];
    for (let i = 0; i < n; i++) {
      vico.push(.72 + _rnd() * .3);
      ctx.fillStyle = _rgb(c, vico[i]);
      let y = 0;
      while (y < S) {                                    // a leira falha: pé que não vingou
        const h = 8 + _rnd() * 30;
        if (_rnd() > .16) ctx.fillRect(i * p + 1, y, p * .62, Math.min(h, S - y));
        y += h;
      }
    }
    ctx.lineWidth = 1;
    for (let i = 0; i < 430; i++) {                      // o pé nasce na leira e passa da borda dela
      const f = _rnd() * n | 0, x = f * p + 1 + _rnd() * p * .8, y = _rnd() * S;
      ctx.strokeStyle = _rgb(c, vico[f] + _rnd() * .45);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (_rnd() - .5) * 2.5, y - 3 - _rnd() * 4); ctx.stroke();
    }
  },
  /* A porta é MOTIVO, não ruído, e por isso se desenha 3×3 — um por tile de 32 e
     não um em 96. O recorte de tileTexture() varia com x%3 e y%3: textura de
     grão aguenta isso, desenho não, e uma porta que muda de cara conforme a
     casa caiu em coordenada par ou ímpar não é porta. */
  /* A porta ABERTA. Ela e a fechada eram o mesmo desenho, então abrir não mudava
     nada na tela — o jogador só descobria que tinha aberto tentando passar.
     O que muda não é a cor: é a SILHUETA. Some a folha do meio do vão, sobra o
     batente dos dois lados e o vão escuro no miolo, com a folha recolhida
     encostada num deles. É a mesma leitura de qualquer porta aberta vista de
     cima: o buraco é o que se vê. */
  door_open(ctx, S, c) {
    const p = S / 3;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      ctx.save(); ctx.translate(i * p, j * p);
      ctx.fillStyle = _rgb(c, .16); ctx.fillRect(0, 0, p, p);                  // o vão, mais escuro
      ctx.fillStyle = _rgb(c, .34);                                            // o fundo do vão
      ctx.fillRect(4, 3, p - 8, p - 6);
      ctx.fillStyle = _rgb(c, 1.35); ctx.fillRect(0, 0, 3.5, p);               // o batente esquerdo
      ctx.fillStyle = _rgb(c, .85);  ctx.fillRect(p - 3.5, 0, 3.5, p);         // o direito, na sombra
      ctx.fillStyle = _rgb(c, 1.55); ctx.fillRect(2.5, 1, 4, p - 2);           // a folha recolhida
      ctx.fillStyle = _rgb(c, 1.1);  ctx.fillRect(3, 2, 3, p - 4);
      ctx.fillStyle = _rgb(c, .55);  ctx.fillRect(6.5, 1, 1.6, p - 2);         // a sombra dela no vão
      ctx.restore();
    }
  },
  door(ctx, S, c) {
    const p = S / 3;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      ctx.save(); ctx.translate(i * p, j * p);
      ctx.fillStyle = _rgb(c, .22); ctx.fillRect(0, 0, p, p);                  // o vão, quase preto
      ctx.fillStyle = _rgb(c, 1.6); ctx.fillRect(2, 1, p - 4, p - 2);          // a folha, clara
      ctx.fillStyle = _rgb(c, 1.25);
      for (let k = 0; k < 4; k++) ctx.fillRect(3, 2 + k * (p - 4) / 4, p - 6, (p - 4) / 4 - 1.6);
      ctx.fillStyle = _rgb(c, .8);                                             // ferragem
      ctx.fillRect(3, p * .26, p - 6, 2); ctx.fillRect(3, p * .68, p - 6, 2);
      ctx.fillStyle = _rgb(c, 3.2);                                            // maçaneta
      ctx.beginPath(); ctx.arc(p - 7, p / 2, 1.7, 0, 7); ctx.fill();
      ctx.restore();
    }
  },
  /* ---- madeira de fora: trapiche, palha e escoramento -------------------- */
  pier(ctx, S, c) {                                      // tábua do trapiche, com fresta para a água
    ctx.fillStyle = 'rgba(8,14,22,.94)'; ctx.fillRect(0, 0, S, S);  // a fresta mostra o escuro de baixo
    const n = 6, h = S / n;                              // 6 pranchas em 96 = 2 por tile, 16 px
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = _rgb(c, .82 + _rnd() * .32);
      ctx.fillRect(0, i * h + 1, S, h - 2.5);            // a folga entre pranchas é a fresta
      ctx.fillStyle = _rgb(c, .55); ctx.fillRect(0, i * h + h - 3.5, S, 1.2);
      for (let k = 0; k < 6; k++) {                      // prego: é o que diz que alguém pregou
        ctx.fillStyle = _rgb(c, .35);
        ctx.fillRect((k * 16 + 6) % S, i * h + 3, 1.6, 1.6);
        ctx.fillRect((k * 16 + 6) % S, i * h + h - 6, 1.6, 1.6);
      }
    }
  },
  hay(ctx, S, c) {                                       // palha solta: fio cruzado, sem direção
    /* Contraste CURTO. Com o fio indo de .7 a 1.4 sobre fundo .48 a palha virava
       um bloco de ouro que roubava a cena inteira de uma vila — palha é seca,
       fosca, e a única coisa que ela tem de dizer é "isto aqui é monte". */
    ctx.fillStyle = _rgb(c, .62); ctx.fillRect(0, 0, S, S);
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 900; i++) {                      // muita palha e nenhum eixo
      const x = _rnd() * S, y = _rnd() * S, a = _rnd() * Math.PI, l = 4 + _rnd() * 9;
      ctx.strokeStyle = _rgb(c, .78 + _rnd() * .42);
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
    _speckle(ctx, S, c, 200, 1, 3, .5, .68);             // sombra por baixo do monte
  },

  /* ---- pedra lavrada: é a REGULARIDADE que denuncia que um homem fez ------ */
  block(ctx, S, c) {                                     // bloco esquadrejado, fiada deslocada
    /* Faces em torno de .8: com .88 a 1.18 e uma aresta em 1.35, o wallSprite
       ainda clareava o topo em 30% e a muralha saía de gelo. Pedra lavrada
       VELHA é escura; quem faz a leitura é a junta, não o brilho. */
    ctx.fillStyle = _rgb(c, .42); ctx.fillRect(0, 0, S, S);        // a junta, ao fundo
    const bw = S / 6, bh = S / 12;                       // 16×8 px: os dois dividem 32
    for (let j = 0; j < 12; j++) {
      const off = (j % 2) * bw / 2;                      // amarração: fiada par anda meio bloco
      for (let i = -1; i < 7; i++) {
        const x = i * bw + off;
        ctx.fillStyle = _rgb(c, .7 + _rnd() * .24);
        ctx.fillRect(x + 1, j * bh + 1, bw - 2, bh - 2);
        ctx.fillStyle = _rgb(c, 1.02);                   // aresta de cima do bloco pega luz
        ctx.fillRect(x + 1, j * bh + 1, bw - 2, 1);
        ctx.fillStyle = _rgb(c, .5);                     // e a de baixo fica na sombra da fiada
        ctx.fillRect(x + 1, j * bh + bh - 2, bw - 2, 1);
      }
    }
    _speckle(ctx, S, c, 320, 1, 2, .6, .88);             // o desgaste, que tira a cara de novo
  },
  pave(ctx, S, c) {                                      // calçada: pedra miúda irregular
    /* A pedra ENCOSTA na vizinha e a junta é escura. Com pedra pequena, redonda
       e junta clara por baixo, a calçada saía plástico-bolha: o que se via era o
       fundo, com bolinhas em cima. Calçada é o contrário — pedra encostada, e a
       junta é a linha escura que sobra entre elas. */
    ctx.fillStyle = _rgb(c, .42); ctx.fillRect(0, 0, S, S);        // a junta, ao fundo
    const p = S / 12;                                    // 8 px: 4 pedras por tile
    for (let j = 0; j < 12; j++) {
      const off = (j % 2) * p / 2;                       // fiada alternada: calçamento não é grade
      for (let i = -1; i < 13; i++) {
        const cx = i * p + p / 2 + off + (_rnd() - .5) * 1.2;
        const cy = j * p + p / 2 + (_rnd() - .5) * 1.2;
        const lados = 4 + (_rnd() * 3 | 0), a0 = _rnd() * 6.28;
        const esc = .82 + _rnd() * .34;                  // tamanhos misturados
        ctx.fillStyle = _rgb(c, .68 + _rnd() * .42);
        ctx.beginPath();
        for (let a = 0; a < lados; a++) {
          const an = a0 + a * 6.283 / lados, r = p * .62 * esc * (.82 + _rnd() * .36);
          ctx.lineTo(cx + Math.cos(an) * r, cy + Math.sin(an) * r);
        }
        ctx.fill();
      }
    }
    _speckle(ctx, S, c, 340, 1, 2, .6, .9);              // o desgaste do pisado
  },
  rubble(ctx, S, c) {                                    // entulho: bloco quebrado e pó
    const CACO = 0x8e8b84;
    ctx.fillStyle = _rgb(c, .55); ctx.fillRect(0, 0, S, S);        // o pó, entre os cacos
    _speckle(ctx, S, c, 520, 1, 3, .45, .8);
    for (let i = 0; i < 85; i++) {                       // caco anguloso, tamanhos misturados
      const x = _rnd() * S, y = _rnd() * S, r = 2 + _rnd() * 6, a0 = _rnd() * 6;
      const face = .62 + _rnd() * .5;
      ctx.fillStyle = _rgb(CACO, face * .55);            // sombra projetada do caco
      ctx.beginPath(); ctx.ellipse(x, y + r * .55, r * .95, r * .45, 0, 0, 7); ctx.fill();
      ctx.fillStyle = _rgb(CACO, face);
      ctx.beginPath();
      for (let a = 0; a < 4; a++) {
        const an = a0 + a * 1.57 + _rnd() * .4;
        ctx.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r * .8);
      }
      ctx.fill();
      ctx.fillStyle = _rgb(CACO, face * 1.3);            // a quebra fresca é mais clara
      ctx.fillRect(x - r * .5, y - r * .55, r * .9, 1.2);
    }
  },

  /* ---- subsolo: uma forma por sistema ------------------------------------ */
  /* Metal do veio: cor PRÓPRIA, e não a da rocha multiplicada. Escalando o azul
     da pedra o veio saía branco-azulado, ocupava meio tile e o minério virava
     cristal — dava para achar do outro lado do andar, que é o oposto de procurar. */
  ore(ctx, S, c) {                                       // rocha com veio: só o metal denuncia
    const METAL = 0xb08a4a;
    ctx.fillStyle = _rgb(c); ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 80; i++) {                       // a mesma faceta da rocha, para SER rocha
      ctx.fillStyle = _rgb(c, .62 + _rnd() * .34);       // escura: o topo do wallSprite já clareia 30%
      ctx.beginPath();
      const x = _rnd() * S, y = _rnd() * S, r = 2.5 + _rnd() * 5;
      for (let a = 0; a < 6; a++) ctx.lineTo(x + Math.cos(a * 1.05) * r * (.6 + _rnd() * .6), y + Math.sin(a * 1.05) * r * (.6 + _rnd() * .6));
      ctx.fill();
    }
    _cracks(ctx, S, c, 20, .55);
    for (let i = 0; i < 5; i++) {                        // o fio: fino, sinuoso, e some às vezes
      let x = _rnd() * S, y = _rnd() * S, a = _rnd() * 6.28;
      for (let j = 0; j < 22; j++) {
        a += (_rnd() - .5) * .9;
        x += Math.cos(a) * 4; y += Math.sin(a) * 4;
        if (_rnd() < .3) continue;                       // veio interrompido: rocha come o fio
        ctx.strokeStyle = _rgb(METAL, .85 + _rnd() * .4);
        ctx.lineWidth = .8 + _rnd() * 1.2;
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4); ctx.stroke();
        if (_rnd() < .34) {                              // o nódulo — é ele que se vê
          ctx.fillStyle = _rgb(METAL, 1.25);
          ctx.beginPath(); ctx.arc(x, y, 1.2 + _rnd() * 1.1, 0, 7); ctx.fill();
        }
      }
    }
  },
  gravel(ctx, S, c) {                                    // brita da galeria: grão miúdo e anguloso
    /* Escura e de contraste curto: brita de mina não é areia de praia, e com o
       grão de .72 a 1.32 a galeria saía mais clara que a superfície. */
    ctx.fillStyle = _rgb(c, .5); ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 1100; i++) {                     // muito grão pequeno é o que faz brita
      const x = _rnd() * S, y = _rnd() * S, r = .9 + _rnd() * 2.2;
      ctx.fillStyle = _rgb(c, .62 + _rnd() * .46);
      ctx.beginPath();
      ctx.lineTo(x - r, y + r * .6); ctx.lineTo(x, y - r); ctx.lineTo(x + r, y + r * .5);
      ctx.fill();
    }
    for (let i = 0; i < 90; i++) {                       // pedra graúda: sem ela, brita lê como terra
      const x = _rnd() * S, y = _rnd() * S, r = 2.6 + _rnd() * 3.4, a0 = _rnd() * 6;
      ctx.fillStyle = _rgb(c, .4);                       // sombra, que é o que dá o tamanho
      ctx.beginPath(); ctx.ellipse(x, y + r * .5, r, r * .5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = _rgb(c, .8 + _rnd() * .45);
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const an = a0 + k * 1.257 + _rnd() * .3;
        ctx.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r * .85);
      }
      ctx.fill();
    }
    _speckle(ctx, S, c, 240, 1, 2, .38, .55);            // o pó entre os grãos
  },
  /* Teia é NÓ com fio saindo dele, não fio atravessando o quadro. A versão
     anterior traçava linhas quase horizontais de borda a borda e o wallSprite,
     que clareia a faixa de cima e escurece a de baixo, transformava isso em
     chapa ondulada. O que faz ler teia é o centro radial e a espiral em volta. */
  web(ctx, S, c) {                                       // parede de teia: centro, raio e espiral
    ctx.fillStyle = 'rgba(9,9,13,.97)'; ctx.fillRect(0, 0, S, S);
    ctx.lineWidth = 1;
    const fio = (x0, y0, a, len, f) => {                 // fio com barriga: teia não tem reta
      ctx.strokeStyle = _rgb(c, f, .3 + _rnd() * .45);
      ctx.beginPath();
      const bar = (_rnd() - .5) * 4;
      for (let t = 0; t <= 1.001; t += .12) {
        const sg = Math.sin(t * Math.PI) * bar;
        ctx.lineTo(x0 + Math.cos(a) * len * t - Math.sin(a) * sg,
                   y0 + Math.sin(a) * len * t + Math.cos(a) * sg);
      }
      ctx.stroke();
    };
    for (let i = 0; i < 7; i++) {                        // o centro de onde a teia sai
      const cx = _rnd() * S, cy = _rnd() * S, n = 7 + (_rnd() * 5 | 0), a0 = _rnd() * 6.28;
      const raio = 14 + _rnd() * 22;
      for (let k = 0; k < n; k++) fio(cx, cy, a0 + k * 6.283 / n, raio * (.7 + _rnd() * .6), .75 + _rnd() * .45);
      for (let v = 1; v <= 4; v++) {                     // a espiral, em trechos entre dois raios
        const rr = raio * v / 4.5;
        for (let k = 0; k < n; k++) {
          if (_rnd() < .25) continue;                    // teia rasgada: a volta não fecha sempre
          const a1 = a0 + k * 6.283 / n, a2 = a1 + 6.283 / n;
          ctx.strokeStyle = _rgb(c, .6 + _rnd() * .4, .3 + _rnd() * .35);
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a1) * rr, cy + Math.sin(a1) * rr);
          const am = (a1 + a2) / 2, rm = rr * .84;       // a volta cede para dentro
          ctx.quadraticCurveTo(cx + Math.cos(am) * rm * 1.05, cy + Math.sin(am) * rm * 1.05,
                               cx + Math.cos(a2) * rr, cy + Math.sin(a2) * rr);
          ctx.stroke();
        }
      }
    }
    for (let i = 0; i < 40; i++)                         // fio solto entre os centros
      fio(_rnd() * S, _rnd() * S, _rnd() * 6.283, 10 + _rnd() * 26, .45 + _rnd() * .3);
    for (let i = 0; i < 95; i++) {                       // o bolo denso, onde a teia é velha
      ctx.fillStyle = _rgb(c, .75 + _rnd() * .45, .13 + _rnd() * .22);
      ctx.beginPath(); ctx.ellipse(_rnd() * S, _rnd() * S, 3 + _rnd() * 8, 2 + _rnd() * 6, _rnd() * 3, 0, 7); ctx.fill();
    }
  },
  webf(ctx, S, c) {                                      // teia no chão: pisada, achatada, grudenta
    /* Teia pisada é CLARA e tem fio: o tile antes era escuro com borrão pálido
       por cima e lia como fumaça. Aqui a manta cobre quase tudo e o escuro é o
       que aparece nos rasgos — que é o que o pé faz com teia. */
    ctx.fillStyle = 'rgba(14,14,19,.95)'; ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 46; i++) {                       // a manta: lençol, não fio
      ctx.fillStyle = _rgb(c, .78 + _rnd() * .4, .3 + _rnd() * .22);
      ctx.beginPath();
      const x = _rnd() * S, y = _rnd() * S, r = 7 + _rnd() * 16;
      for (let a = 0; a < 9; a++) {
        const an = a * .7, rr = r * (.55 + _rnd() * .7);
        ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr * .78);
      }
      ctx.fill();
    }
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 90; i++) {                       // fio frouxo por cima, sem tensão
      const x = _rnd() * S, y = _rnd() * S, a = _rnd() * 6.28;
      ctx.strokeStyle = _rgb(c, 1.15 + _rnd() * .35, .4 + _rnd() * .35);
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 1; k < 5; k++)
        ctx.lineTo(x + Math.cos(a + k * .4) * k * 4.5, y + Math.sin(a + k * .4) * k * 3.6);
      ctx.stroke();
    }
    for (let i = 0; i < 22; i++) {                       // o rasgo, por onde se vê o chão
      ctx.fillStyle = 'rgba(10,10,14,.8)';
      ctx.beginPath();
      ctx.ellipse(_rnd() * S, _rnd() * S, 2 + _rnd() * 5, 1.5 + _rnd() * 3, _rnd() * 3, 0, 7); ctx.fill();
    }
    _speckle(ctx, S, c, 200, 1, 2, .5, .78);             // a sujeira presa na teia
  },
  bone(ctx, S, c) {                                      // ossada: o chão da cripta é o que sobrou
    ctx.fillStyle = _rgb(c, .3); ctx.fillRect(0, 0, S, S);        // a falha entre os ossos
    ctx.lineCap = 'round';
    for (let i = 0; i < 260; i++) {                      // osso longo: cápsula, não risco
      const x = _rnd() * S, y = _rnd() * S, a = _rnd() * 3.14, l = 4 + _rnd() * 10;
      ctx.strokeStyle = _rgb(c, .72 + _rnd() * .34);
      ctx.lineWidth = 2.2 + _rnd() * 2.4;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
      ctx.strokeStyle = _rgb(c, .42);                    // a sombra do osso de baixo
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + Math.sin(a) * 1.6, y - Math.cos(a) * 1.6 + 1.4);
      ctx.lineTo(x + Math.cos(a) * l + Math.sin(a) * 1.6, y + Math.sin(a) * l - Math.cos(a) * 1.6 + 1.4);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    for (let i = 0; i < 10; i++) {                       // crânio: a silhueta que nomeia o tile
      const x = _rnd() * S, y = _rnd() * S, r = 3.2 + _rnd() * 1.4;
      ctx.fillStyle = _rgb(c, .5);                       // sombra debaixo, para ter volume
      ctx.beginPath(); ctx.ellipse(x, y + 1.6, r * 1.1, r * .9, 0, 0, 7); ctx.fill();
      ctx.fillStyle = _rgb(c, 1.02);
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      ctx.fillRect(x - r * .62, y + r * .42, r * 1.24, r * .72);
      ctx.fillStyle = _rgb(c, .26);                      // as duas órbitas, e é só o que cabe em 32px
      ctx.fillRect(x - r * .58, y - r * .2, r * .46, r * .5);
      ctx.fillRect(x + r * .12, y - r * .2, r * .46, r * .5);
    }
  },
  ash(ctx, S, c) {                                       // cinza: pó fino que guarda a marca do pé
    /* O claro da cinza é acinzentado e o escuro é o carvão que sobrou. Saindo
       tudo da mesma cor quente, o tile lia como lama. */
    const PO = _dessat(c, .55);
    ctx.fillStyle = _rgb(PO, .95); ctx.fillRect(0, 0, S, S);
    _speckle(ctx, S, PO, 900, 1, 2, .85, 1.25);          // grão fino, contraste curto
    for (let i = 0; i < 22; i++) {                       // monte e cova: cinza não fica plana
      ctx.fillStyle = _rgb(PO, i % 2 ? 1.3 : .68);
      ctx.beginPath();
      ctx.ellipse(_rnd() * S, _rnd() * S, 5 + _rnd() * 11, 3 + _rnd() * 6, _rnd() * 3, 0, 7); ctx.fill();
    }
    for (let i = 0; i < 60; i++) {                       // carvão que não virou pó: quente e escuro
      ctx.fillStyle = _rgb(c, .3 + _rnd() * .25);
      ctx.fillRect(_rnd() * S, _rnd() * S, 1 + _rnd() * 3, 1 + _rnd() * 2.4);
    }
  },
  /* A pedra tem cor própria. Com pedra e musgo saindo da mesma cor verde, o tile
     virava um segundo capim: numa ruína encostada na grama, os dois eram o mesmo
     campo verde e o chão da ruína sumia. O que se vê aqui é PEDRA, e o musgo é
     o que a está tomando. */
  moss(ctx, S, c) {                                      // pedra tomada de musgo, em manchas
    const PEDRA = 0x6e6a62;
    ctx.fillStyle = _rgb(PEDRA, .8); ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 60; i++) {                       // a laje quebrada por baixo
      ctx.fillStyle = _rgb(PEDRA, .68 + _rnd() * .5);
      ctx.beginPath();
      const x = _rnd() * S, y = _rnd() * S, r = 3 + _rnd() * 6;
      for (let a = 0; a < 5; a++) ctx.lineTo(x + Math.cos(a * 1.257) * r * (.7 + _rnd() * .5),
                                             y + Math.sin(a * 1.257) * r * (.7 + _rnd() * .5));
      ctx.fill();
    }
    _cracks(ctx, S, PEDRA, 16, .55);
    for (let i = 0; i < 26; i++) {                       // a mancha de musgo, e ela não cobre tudo
      const x = _rnd() * S, y = _rnd() * S, r = 4 + _rnd() * 9;
      ctx.fillStyle = _rgb(c, .7 + _rnd() * .3);
      ctx.beginPath();
      for (let a = 0; a < 9; a++) {
        const an = a * .7, rr = r * (.5 + _rnd() * .8);
        ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr);
      }
      ctx.fill();
      for (let k = 0; k < 40; k++) {                     // tufo curto na borda da mancha
        const an = _rnd() * 6.28, rr = r * (.6 + _rnd() * .6);
        ctx.fillStyle = _rgb(c, 1 + _rnd() * .5);
        ctx.fillRect(x + Math.cos(an) * rr, y + Math.sin(an) * rr, 1 + _rnd() * 1.8, 1 + _rnd() * 2);
      }
    }
  },

  /* ---- chão marcado, e é AUTORAL: o sangue de combate (drawBlood) e o campo
     elemental (criaCampo) continuam sendo do motor e passam. Estes dois o autor
     põe no mapa e ficam lá — é o lugar que carrega o que aconteceu nele. ---- */
  gore(ctx, S, c) {                                      // laje encharcada há muito tempo
    /* MANCHA, e mancha é o que ficou depois de secar: a laje continua sendo a
       maior parte do tile e o sangue vive na junta e na baixada. A versão que
       cobria o tile de poças vermelhas vivas lia como carne, não como lugar
       onde aconteceu alguma coisa. */
    const LAJE = _dessat(c, .82);
    ctx.fillStyle = _rgb(LAJE, .62); ctx.fillRect(0, 0, S, S);
    const p = S / 3;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {     // a laje, e ela manda no tile
      ctx.fillStyle = _rgb(LAJE, .82 + _rnd() * .22);
      ctx.fillRect(i * p + 1, j * p + 1, p - 2, p - 2);
    }
    _speckle(ctx, S, LAJE, 300, 1, 2, .7, 1);
    /* Doze e não cinco: em 96 px, cinco poças davam tile de 32 px sem nenhuma —
       metade da mancha saía laje limpa e o lugar não contava mais nada. */
    for (let i = 0; i < 12; i++) {                       // poça velha: escura, e a laje ainda manda
      const x = _rnd() * S, y = _rnd() * S, r = 5 + _rnd() * 10;
      ctx.fillStyle = _rgb(c, .62, .8);
      ctx.beginPath();
      for (let a = 0; a < 11; a++) {
        const an = a * .571, rr = r * (.55 + _rnd() * .7);
        ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr * .8);
      }
      ctx.fill();
      ctx.fillStyle = _rgb(c, .3, .85);                  // o miolo secou quase preto
      ctx.beginPath(); ctx.ellipse(x, y, r * .4, r * .3, 0, 0, 7); ctx.fill();
    }
    for (let i = 0; i < 170; i++) {                      // respingo, que é o que conta a violência
      ctx.fillStyle = _rgb(c, .5 + _rnd() * .4, .35 + _rnd() * .4);
      ctx.fillRect(_rnd() * S, _rnd() * S, .8 + _rnd() * 1.6, .8 + _rnd() * 1.6);
    }
    for (let i = 0; i < 20; i++) {                       // e o que escorreu para a junta
      const j = (_rnd() * 3 | 0) * p, hor = _rnd() < .5;
      ctx.fillStyle = _rgb(c, .38, .6);
      if (hor) ctx.fillRect(_rnd() * S, j, 6 + _rnd() * 22, 2);
      else ctx.fillRect(j, _rnd() * S, 2, 6 + _rnd() * 22);
    }
  },
  /* Selo gravado: MOTIVO, então 3×3 como a porta. E o motivo ENCOSTA nas quatro
     bordas de propósito — assim tile vizinho emenda com tile vizinho e um chão
     de selo lê como uma inscrição grande. Com o anel fechado no meio do tile,
     um piso inteiro virava grade de medalhões idênticos, que é o "repeated
     identical cards" que o §23 veta. A laje sai CINZA (_dessat) e a cor
     saturada, que existe para o tile não se confundir na régua de paleta, fica
     só no sulco — é ele que ainda tem alguma coisa acesa dentro. */
  rune(ctx, S, c) {
    const p = S / 3, LAJE = _dessat(c, .8);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      ctx.save(); ctx.translate(i * p, j * p);
      ctx.fillStyle = _rgb(LAJE, .72); ctx.fillRect(0, 0, p, p);
      _speckle(ctx, p, LAJE, 90, 1, 2, .78, 1);
      ctx.fillStyle = _rgb(LAJE, .5);                                // junta da laje
      ctx.fillRect(0, p - 1.5, p, 1.5); ctx.fillRect(p - 1.5, 0, 1.5, p);
      const m = p / 2, r = p * .3;
      const grava = (f, w) => {                                      // sulco fundo, brilho no fundo dele
        ctx.strokeStyle = f < 1 ? _rgb(LAJE, f) : _rgb(c, f);
        ctx.lineWidth = w; ctx.lineJoin = 'round';
        ctx.beginPath();                                             // losango que toca as 4 bordas
        ctx.moveTo(m, 0); ctx.lineTo(p, m); ctx.lineTo(m, p); ctx.lineTo(0, m); ctx.closePath();
        ctx.stroke();
        ctx.beginPath();                                             // e o anel preso a ele
        ctx.arc(m, m, r, 0, 7); ctx.stroke();
      };
      grava(.34, 3.2);
      grava(1.15, 1);                                                // brando: é brasa velha, não LED
      ctx.fillStyle = _rgb(c, 1.4);
      ctx.beginPath(); ctx.arc(m, m, 1.2, 0, 7); ctx.fill();
      ctx.restore();
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
/* Quem desenha borda por cima de quem. Pântano fica logo acima da água (é água
   com chão) e neve acima da grama — assim a tundra invade o campo e não o
   contrário, que é como bioma frio parece na natureza. */
/* Lavoura entra com a MESMA prioridade do capim: prioridade igual não desenha
   borda nenhuma, e é isso que se quer — o limite de um trigal é a linha reta
   onde alguém parou de arar, não um degradê. Piso e porta ficam no topo porque
   coisa construída invade o terreno, e nunca o contrário. */
/* Lavoura fica ACIMA do capim: assim o trigal transborda para a grama vizinha e
   o limite do campo deixa de ser a escadinha de tiles que denuncia o mapa. Musgo
   e cinza entram junto do chão de caverna; coisa construída fica no topo, porque
   ela invade o terreno e nunca o contrário. */
const TERRAIN_PRIO = {
  water: 0, swamp: 1, lava: 1, grass: 2,
  crop: 3, snow: 3, cave: 3, moss: 3, ash: 3, webf: 3,
  dirt: 4, gravel: 4, bone: 4, hay: 4,
  sand: 5, rock: 6, ore: 6,
  stone: 7, pave: 7, rubble: 7, gore: 7, rune: 7,
  wall: 8, plank: 8, door: 8, door_open: 8, pier: 8, block: 8, prop: 8, web: 8
};

/* 8 máscaras de 32×32: 0..3 = N,L,S,O; 4..7 = NL,SL,SO,NO.
   O degradê sozinho dá borda de aerógrafo, que destoa de tudo em volta. A
   mordida em destination-out quebra a reta e devolve o serrilhado — e só morde
   onde a máscara já está no meio do caminho, para não furar o miolo opaco. */
/* Para onde cada máscara aponta, do centro do tile para fora. É propriedade da
   MÁSCARA, então mora aqui junto dela — o laço de borda do render2d usa esta
   mesma lista, para não haver duas ordens de vizinho que possam divergir. */
const EDGE_DIR = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
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
  /* O contorno vem ASSADO aqui e não num segundo sprite: a chave é a mesma
     (tex + cor + lado), então não custa cache nenhum e poupa um drawImage por
     lado por tile — que no pior caso eram oito por tile, todo quadro.
     Ordem: o lábio claro primeiro, a linha escura por cima. Invertida, o claro
     sobra por fora e vira halo, que é o brilho que o §23 veta. */
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = .5;
  g.drawImage(_tinge(rimMask(m, RIM + 3), _rgb(hex, 1.35)), 0, 0);
  g.globalAlpha = .62;
  g.drawImage(_tinge(rimMask(m, RIM), _rgb(hex, .32)), 0, 0);
  return BORDER_CACHE[key] = c;
}
/* Pinta uma máscara de uma cor só. Sai daqui porque `source-in` sobre o próprio
   canvas apagaria o que já está nele — a máscara tem de ser tingida à parte. */
function _tinge(mask, cor) {
  const c = _canvas(32), g = c.getContext('2d');
  g.drawImage(mask, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = cor; g.fillRect(0, 0, 32, 32);
  return c;
}

/* Contorno da junta entre terrenos. O degradê sozinho resolve a reta de 90° e
   não desenha junta NENHUMA: um terreno desvanece no outro e o chão fica sem
   limite, que é a leitura de tinta espalhada. Todo tileset feito à mão marca a
   transição com uma linha escura e um lábio claro logo acima dela — é isso que
   faz o caminho parecer cavado no capim em vez de pintado por cima.

   A faixa sai da PRÓPRIA máscara: ela menos ela mesma deslocada para fora dá
   exatamente o trecho onde a máscara está desvanecendo, que é onde a junta cai.
   Derivar em vez de desenhar uma segunda curva garante que o contorno acompanhe
   a mordida serrilhada do edgeMask — duas curvas separadas divergiriam, e o
   contorno passaria ao lado da borda em vez de em cima dela. */
const RIM = 3;
const RIM_CACHE = {};
function rimMask(m, d) {
  const key = m + ':' + d;
  if (RIM_CACHE[key]) return RIM_CACHE[key];
  const c = _canvas(32), g = c.getContext('2d');
  const [ax, ay] = EDGE_DIR[m];
  g.drawImage(edgeMask(m), 0, 0);
  g.globalCompositeOperation = 'destination-out';
  g.drawImage(edgeMask(m), ax * d, ay * d);
  return RIM_CACHE[key] = c;
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

/* Cerca: mourão e travessa, com vão entre os dois. Não é parede baixa — a
   diferença entre cercar e murar é enxergar por cima, e ela vive no `top` do
   tile (0,4, abaixo do 0,5 que corta a vista) e nesta silhueta vazada. Sem o
   vão, sobra uma mureta, que é o mesmo defeito de fazer casa de pedregulho.
   Duas variantes só, pelo eixo em que a cerca corre: quem manda é o vizinho, e
   três lados de madeira num tile de canto ninguém repara. */
const CERCA_TOP = 14, CERCA_H = 32 + CERCA_TOP, CERCA_MAD = 0x6b4a2a;
const ESCORA_MAD = 0x6a4c2c;
const CERCA_CACHE = {};
function cercaSprite(horiz) {
  const key = horiz ? 'h' : 'v';
  if (CERCA_CACHE[key]) return CERCA_CACHE[key];
  const c = _canvas2(32, CERCA_H), g = c.getContext('2d');
  const pe = CERCA_TOP + 20;                                   // onde o mourão encosta no chão
  const mourao = (x, y, w, h) => {
    g.fillStyle = _rgb(CERCA_MAD, .85); g.fillRect(x, y, w, h);
    g.fillStyle = _rgb(CERCA_MAD, 1.3); g.fillRect(x, y, w, 2); // topo cortado pega luz
    g.fillStyle = _rgb(CERCA_MAD, .55); g.fillRect(x + w - 1, y, 1, h);
  };
  g.fillStyle = 'rgba(0,0,0,.28)';                             // sombra no pé, que prega no chão
  g.fillRect(0, pe - 2, 32, 3);
  if (horiz) {
    g.fillStyle = _rgb(CERCA_MAD, 1.05);                       // travessas de ponta a ponta
    g.fillRect(0, CERCA_TOP + 3, 32, 3); g.fillRect(0, CERCA_TOP + 11, 32, 3);
    mourao(4, 0, 4, pe); mourao(24, 0, 4, pe);
  } else {
    g.fillStyle = _rgb(CERCA_MAD, 1.05);                       // a cerca some para o fundo
    g.fillRect(13, 0, 3, pe); g.fillRect(19, 0, 3, pe);
    mourao(12, CERCA_TOP - 4, 5, 24); mourao(12, pe - 6, 5, 6);
  }
  return CERCA_CACHE[key] = c;
}

/* Escoramento de mina: pórtico de duas pernas e um chapéu, na MESMA folha e no
   mesmo encaixe da cerca. É objeto, não parede: entre as pernas se vê a galeria
   continuar, e é isso que faz a Mina parecer cavada com plano em vez de um
   corredor de pedra. Bloqueia o pé (o `walk` do tile) e não a vista (`top` 0,45).
   Duas variantes pelo eixo da galeria, como a cerca. */
function escoraSprite() {
  if (CERCA_CACHE.escora) return CERCA_CACHE.escora;
  const c = _canvas2(32, CERCA_H), g = c.getContext('2d');
  const pe = CERCA_TOP + 22, topo = CERCA_TOP - 2;
  const viga = (x, y, w, h) => {
    g.fillStyle = _rgb(ESCORA_MAD, .8); g.fillRect(x, y, w, h);
    g.fillStyle = _rgb(ESCORA_MAD, 1.3); g.fillRect(x, y, Math.min(w, 2), h);
    g.fillStyle = _rgb(ESCORA_MAD, .5); g.fillRect(x + w - 2, y, 2, h);
  };
  g.fillStyle = 'rgba(0,0,0,.34)'; g.fillRect(0, pe - 2, 32, 4);   // sombra que prega no chão
  viga(1, topo + 5, 8, pe - topo - 5);                             // as duas pernas
  viga(23, topo + 5, 8, pe - topo - 5);
  viga(0, topo, 32, 6);                                            // e o chapéu por cima delas
  g.fillStyle = _rgb(ESCORA_MAD, 1.45); g.fillRect(0, topo, 32, 1.5);
  g.fillStyle = _rgb(ESCORA_MAD, .62);                             // a cunha que trava o chapéu
  g.fillRect(6, topo + 6, 4, 3); g.fillRect(22, topo + 6, 4, 3);
  return CERCA_CACHE.escora = c;
}

/* Parede de teia. O wallSprite corta topo claro e face escura, que é como pedra
   pega luz — aplicado a teia, produzia chapa ondulada e o Ninho virava galpão de
   zinco. Aqui o volume vem de um degradê contínuo, e a leitura vem da borda de
   BAIXO, que não é reta: fio pendurado. Sprite que encosta reto na borda do tile
   lê como cortado pelo tile, e é isso que fazia a teia parecer bloco. */
function teiaSprite(kind, hex, v) {
  /* Oito variantes, sorteadas pelo TILE. A pedra pode repetir o mesmo sprite em
     todo tile porque a textura dela é grão; teia é desenho, e o mesmo desenho a
     cada 32 px vira papel de parede — foi o que apareceu na primeira olhada. */
  const key = 'teia' + kind + hex + (v || 0);
  if (WALL_CACHE[key]) return WALL_CACHE[key];
  const c = _canvas2(32, WALL_H), g = c.getContext('2d');
  _rnd = _mulberry(_hash(key));
  const ox = ((v || 0) & 1) * 32, oy = (((v || 0) >> 1) % 3) * 16;   // recorte diferente por variante
  g.drawImage(tileTexture(kind, hex), ox, oy, 32, WALL_H, 0, 0, 32, WALL_H);
  const gr = g.createLinearGradient(0, 0, 0, WALL_H);
  gr.addColorStop(0, 'rgba(255,255,255,.20)');           // o alto da massa vê a luz
  gr.addColorStop(.36, 'rgba(0,0,0,0)');
  gr.addColorStop(1, 'rgba(0,0,0,.52)');                 // e o pé dela some no escuro
  g.fillStyle = gr; g.fillRect(0, 0, 32, WALL_H);
  g.globalCompositeOperation = 'destination-out';        // come a borda de baixo, coluna a coluna
  for (let x = 0; x < 32; x++) {
    const corte = 2 + Math.abs(Math.sin(x * .55)) * 6 + _rnd() * 4;
    g.fillRect(x, WALL_H - corte, 1, corte);
  }
  g.globalCompositeOperation = 'source-over';
  g.lineWidth = 1;
  for (let i = 0; i < 16; i++) {                         // o fio que ainda pende do que sobrou
    const x = _rnd() * 32, y0 = WALL_H - 12 - _rnd() * 10;
    g.strokeStyle = _rgb(hex, .85, .3 + _rnd() * .35);
    g.beginPath(); g.moveTo(x, y0);
    g.lineTo(x + (_rnd() - .5) * 3, y0 + 7 + _rnd() * 9); g.stroke();
  }
  _rnd = Math.random;
  return WALL_CACHE[key] = c;
}

/* Parede com desenho PRÓPRIO. O padrão continua sendo o wallSprite — só entra
   aqui o material cuja física não é a da pedra. */
/* ------------------------------------------------- móveis da vila (#10)
   Relato do dono do projeto: "o mapa está VAZIO, sem graça. Uma vila pode ter
   uma fonte, um curral, uma carroça no meio da rua, barris de água, um moinho".
   Estava certo — a vila tinha casa, rua e templo, e nada do que se põe ENTRE
   eles, que é o que faz uma rua parecer usada em vez de recém-construída.
   Os quatro seguem a receita do #48: objeto discreto, paleta curta de `_tons`,
   sombra de um lado e luz do outro, e a MESMA direção de luz do resto do jogo —
   claro em cima e à esquerda, sombra à direita e embaixo. O curral não está
   aqui de propósito: curral é cerca em volta de terra batida, e a cerca já
   existe. Tile novo para o que já dá para escrever seria tile a mais. */
/* A pedra do poço é ESCURA e fria de propósito, e isso custou uma medição: era
   0x8d8779, e o PAVE em que ele se apoia é 0x968a70 — distância 13, num projeto
   cuja régua exige 30. O aro sumia dentro da calçada e o que restava a ler era
   o pórtico de madeira com um buraco preto no meio.
   É o corolário do #48b, e o mais caro deles: cor de material é constante
   PRÓPRIA, não a cor do tile em que a coisa está. Vale duas vezes aqui, porque
   poço e calçada são o mesmo material — pedra sobre pedra — e o que tem de
   separar os dois é o poço ser velho e molhado, não claro. */
const POCO_PEDRA = 0x5f6357, POCO_MAD = 0x6b4a2a, CARROCA_MAD = 0x7a5530;
const BARRIL_MAD = 0x6e4a26, BARRIL_ARO = 0x4a4238, MOINHO_PEDRA = 0x9a8f78;
const VILA_CACHE = {};

/* Fonte/poço: aro redondo de pedra, água escura dentro, pórtico de madeira com
   corda e balde. O que o faz ler de longe é a BOCA ESCURA — sem ela o aro vira
   um monte de pedra qualquer, que é o defeito do #46 de novo. */
function pocoSprite() {
  if (VILA_CACHE.poco) return VILA_CACHE.poco;
  /* DOIS POR DOIS. Num tile de 32 o aro cabia com 21 px e o poço lia como
     balde de brinquedo. Com 64 ele tem o tamanho que uma boca de poço tem no
     mundo — e é a diferença entre mobília e sujeira no chão. */
  const W2 = 64, H2 = CERCA_TOP + 64;
  const c = _canvas2(W2, H2), g = c.getContext('2d');
  const t = _tons(POCO_PEDRA, 4, .7, 1.35), m = _tons(POCO_MAD, 3, .7, 1.25);
  const cx = 32, pe = H2 - 6;
  _el(g, cx, pe - 9, 26, 15, _rgb(t[1]));                  // o corpo do aro
  _el(g, cx, pe - 17, 26, 14, _rgb(t[3]));                 // a borda, pegando luz
  _el(g, cx, pe - 17, 19.5, 9.5, _rgb(t[0]));              // a espessura da alvenaria
  _el(g, cx, pe - 16, 17, 7.5, '#12161a');                 // a boca: o buraco
  _el(g, cx - 5, pe - 18, 5.5, 2.2, 'rgba(150,190,225,.30)');   // a água lá no fundo
  /* As juntas: é a junta que diz alvenaria. Sem elas o anel sai liso e lê como
     metal. Com 64 px cabem oito, e é aí que a pedra vira PEDRAS. */
  g.strokeStyle = _rgb(POCO_PEDRA, .42); g.lineWidth = 1.6;
  for (let i = 0; i < 8; i++) {
    const a = -2.9 + i * .82;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * 20, pe - 17 + Math.sin(a) * 10);
    g.lineTo(cx + Math.cos(a) * 26, pe - 9 + Math.sin(a) * 15); g.stroke();
  }
  /* O musgo, no lado que não pega sol: um poço de fazenda é velho e molhado, e
     é o musgo que conta isso sem uma linha de texto. */
  g.fillStyle = 'rgba(78,104,58,.5)';
  g.fillRect(8, pe - 12, 9, 9); g.fillRect(46, pe - 7, 8, 6); g.fillRect(12, pe - 3, 6, 4);
  // o pórtico: dois montantes e a travessa, com a corda e o balde
  g.fillStyle = _rgb(m[0]); g.fillRect(13, CERCA_TOP + 2, 7, 40);      // esquerdo, na sombra
  g.fillStyle = _rgb(m[2]); g.fillRect(44, CERCA_TOP + 2, 7, 40);      // direito, na luz
  g.fillStyle = _rgb(m[1]); g.fillRect(9, CERCA_TOP - 4, 46, 7);       // a travessa
  g.fillStyle = _rgb(POCO_MAD, 1.5); g.fillRect(9, CERCA_TOP - 4, 46, 2.5);
  g.fillStyle = _rgb(POCO_MAD, .5); g.fillRect(9, CERCA_TOP + 1, 46, 2);
  g.fillStyle = _rgb(m[0]); g.fillRect(20, CERCA_TOP - 1, 24, 5);      // o sarilho
  g.fillStyle = _rgb(POCO_MAD, 1.35); g.fillRect(20, CERCA_TOP - 1, 24, 1.5);
  g.fillStyle = 'rgba(214,199,164,.95)'; g.fillRect(31, CERCA_TOP + 4, 2, 16);  // a corda
  g.fillStyle = _rgb(m[0]); g.fillRect(26, CERCA_TOP + 19, 13, 11);            // o balde
  g.fillStyle = _rgb(POCO_MAD, 1.45); g.fillRect(26, CERCA_TOP + 19, 13, 2.5);
  g.fillStyle = _rgb(0x4a4238, 1.1); g.fillRect(26, CERCA_TOP + 24, 13, 1.8);
  /* `cx` e `feet` são o que o `dropShadow` do render usa para ancorar a sombra:
     onde fica o eixo do objeto e onde ele encosta no chão. Sem eles a sombra
     sai deslocada; com uma elipse assada no sprite, como estava antes, ela nem
     existe — a mancha entrava no passe de luz junto com o objeto, escurecia com
     ele à noite e parava de separar a coisa do chão. Era por isso que a carroça
     lia como papel no chão. */
  c.cx = 32; c.feet = H2;
  return VILA_CACHE.poco = c;
}

/* Carroça de fazenda: caixa de tábua, duas rodas de raio e o varal. Duas
   variantes pelo eixo, como a cerca — quem manda é o vizinho igual. */
function carrocaSprite(horiz) {
  const k = horiz ? 'ch' : 'cv';
  if (VILA_CACHE[k]) return VILA_CACHE[k];
  const c = _canvas2(32, CERCA_H), g = c.getContext('2d');
  const t = _tons(CARROCA_MAD, 4, .68, 1.3);
  const pe = CERCA_TOP + 26;
  /* A RODA VEM DEPOIS DA CAÇAMBA. Na primeira versão vinha antes, e o caixote
     cobria a metade de cima das duas: o que sobrava eram dois blocos escuros
     nas pontas, que liam como alça e não como roda. Numa carroça vista de três
     quartos a roda é o que está MAIS PERTO do olho — ela passa na frente da
     caçamba, e é o aro dela que diz "isto anda". */
  const roda = (x, y, r) => {
    _el(g, x, y, r, r, '#241a10');                       // o pneu, quase preto
    _el(g, x, y, r - 1.5, r - 1.5, _rgb(t[1]));
    g.strokeStyle = _rgb(t[3]); g.lineWidth = 1.1;
    for (let i = 0; i < 4; i++) {                        // os raios
      const a = i * Math.PI / 4;
      g.beginPath(); g.moveTo(x - Math.cos(a) * (r - 2.2), y - Math.sin(a) * (r - 2.2));
      g.lineTo(x + Math.cos(a) * (r - 2.2), y + Math.sin(a) * (r - 2.2)); g.stroke();
    }
    _el(g, x, y, 2, 2, _rgb(t[3]));                      // o cubo
  };
  if (horiz) {
    /* A caçamba é mais ESTREITA que o tile de propósito: a roda tem de sobrar
       para fora dela dos dois lados, senão vira um caixote com sombra embaixo. */
    g.fillStyle = _rgb(t[1]); g.fillRect(6, pe - 22, 20, 13);          // a caçamba
    g.fillStyle = _rgb(t[3]); g.fillRect(6, pe - 22, 20, 2.5);         // a borda de cima, na luz
    g.fillStyle = _rgb(CARROCA_MAD, .5); g.fillRect(23, pe - 22, 3, 13);
    g.fillStyle = _rgb(CARROCA_MAD, .58);
    for (let x = 9; x < 25; x += 4) g.fillRect(x, pe - 19, 1.2, 9);    // as tábuas
    g.fillStyle = _rgb(t[2]); g.fillRect(0, pe - 14, 7, 2.5);          // o varal
    roda(9, pe - 6, 6); roda(23, pe - 6, 6);
  } else {
    g.fillStyle = _rgb(t[1]); g.fillRect(9, pe - 26, 14, 20);
    g.fillStyle = _rgb(t[3]); g.fillRect(9, pe - 26, 14, 2.5);
    g.fillStyle = _rgb(CARROCA_MAD, .5); g.fillRect(20, pe - 26, 3, 20);
    g.fillStyle = _rgb(CARROCA_MAD, .58);
    for (let y = pe - 23; y < pe - 8; y += 4) g.fillRect(10, y, 12, 1.2);
    g.fillStyle = _rgb(t[2]); g.fillRect(15, pe - 32, 2.5, 7);
    roda(6, pe - 12, 6); roda(26, pe - 12, 6);
  }
  c.cx = 16; c.feet = pe + 2;
  return VILA_CACHE[k] = c;
}

/* Barris: dois, de tamanhos diferentes. Um só lê como tonel esquecido; o par lê
   como depósito, que é o que uma vila de fazenda encosta na parede. */
function barrilSprite(horiz) {
  const k = horiz ? 'bh' : 'bv';
  if (VILA_CACHE[k]) return VILA_CACHE[k];
  const c = _canvas2(32, CERCA_H), g = c.getContext('2d');
  const t = _tons(BARRIL_MAD, 4, .7, 1.3);
  const pe = CERCA_TOP + 26;
  const barril = (cx, cy, w, h) => {
    g.fillStyle = _rgb(t[1]);                                     // o bojo, que é o que faz barril
    g.beginPath(); g.moveTo(cx - w / 2, cy - h / 2 + 2);
    g.quadraticCurveTo(cx - w / 2 - 1.6, cy, cx - w / 2, cy + h / 2 - 2);
    g.lineTo(cx + w / 2, cy + h / 2 - 2);
    g.quadraticCurveTo(cx + w / 2 + 1.6, cy, cx + w / 2, cy - h / 2 + 2);
    g.closePath(); g.fill();
    g.fillStyle = _rgb(BARRIL_MAD, .52); g.fillRect(cx + w / 2 - 2, cy - h / 2 + 2, 2, h - 4);
    g.fillStyle = _rgb(BARRIL_MAD, 1.35);
    for (let x = cx - w / 2 + 2; x < cx + w / 2 - 1; x += 3) g.fillRect(x, cy - h / 2 + 2, 1, h - 4);
    g.fillStyle = _rgb(BARRIL_ARO, 1.15);                   // os dois arcos
    g.fillRect(cx - w / 2 - 1, cy - h / 4, w + 2, 1.6);
    g.fillRect(cx - w / 2 - 1, cy + h / 5, w + 2, 1.6);
    _el(g, cx, cy - h / 2 + 2, w / 2, 2.2, _rgb(t[3]));           // a tampa, pegando luz
    _el(g, cx, cy - h / 2 + 2, w / 2 - 1.6, 1.4, _rgb(t[0]));
  };
  /* ESCALA. A primeira versão fez os dois com 11 e 9 px de largura num tile de
     32 — de longe sumiam, de perto liam como brinquedo largado no chão. Medidos
     os outros três móveis, o barril era o único fora da régua: poço 21 px,
     carroça 24, moinho 26. Objeto de rua tem de OCUPAR a rua; do contrário não
     é mobília, é sujeira. Agora o par enche o tile de ponta a ponta. */
  if (horiz) { barril(11, pe - 12, 16, 20); barril(23, pe - 8, 13, 16); }
  else { barril(14, pe - 17, 16, 20); barril(21, pe - 7, 13, 16); }
  c.cx = 16; c.feet = pe + 2;
  return VILA_CACHE[k] = c;
}

/* Moinho: torre de pedra e as PÁS. É o único destes que tapa a vista, porque é
   prédio e não móvel — e numa ilha que vive de trigo é a silhueta que diz
   "fazenda" de mais longe que qualquer outra coisa. Vai por PAREDE_DRAW pelo
   mesmo motivo da teia: a régua de topo claro e face escura do wallSprite é
   física de pedra lisa, e pá de moinho não é pedra. */
function moinhoSprite() {
  if (VILA_CACHE.moinho) return VILA_CACHE.moinho;
  /* DOIS POR TRÊS, e este é o caso que provou a regra: com um tile por moinho,
     dois tiles MILL lado a lado desenhavam DOIS MOINHOS COLADOS. Moinho é
     prédio — ocupa o chão de um prédio. */
  const W3 = 64, H3 = WALL_TOP + 96;
  const c = _canvas2(W3, H3), g = c.getContext('2d');
  const t = _tons(MOINHO_PEDRA, 5, .5, 1.3);
  const base = H3 - 1, topo = WALL_TOP + 26;               // o corpo da torre
  /* Tronco-cônica, mais larga embaixo: retângulo lê como chaminé. */
  _poly(g, [[22, topo], [42, topo], [50, base], [14, base]], _rgb(t[1]));
  _poly(g, [[36, topo], [42, topo], [50, base], [42, base]], _rgb(MOINHO_PEDRA, .5));
  g.fillStyle = _rgb(MOINHO_PEDRA, .62);
  for (let y = topo + 5; y < base - 2; y += 7) {           // as fiadas
    const w = 20 + (y - topo) * .3; g.fillRect(32 - w / 2, y, w, 1.6);
  }
  g.fillStyle = '#241c14';                                 // porta e janelas
  g.fillRect(27, base - 20, 10, 20);
  g.fillRect(24, topo + 16, 6, 8); g.fillRect(35, topo + 16, 6, 8);
  g.fillStyle = _rgb(0x6b4a2a, 1.15); g.fillRect(26, base - 20, 12, 2.5);   // a verga
  // o capelo
  _poly(g, [[18, topo + 2], [32, topo - 16], [46, topo + 2]], _rgb(0x6b4a2a, 1.1));
  _poly(g, [[32, topo - 16], [46, topo + 2], [38, topo + 2]], _rgb(0x6b4a2a, .58));
  /* As pás em ASPA e não em cruz: a cruz alinhada com o tile lê como grade de
     janela, e é a inclinação que faz o olho ver moinho. */
  const cx = 32, cy = topo - 8;
  g.strokeStyle = _rgb(0x6b4a2a, 1.25); g.lineWidth = 2.4;
  g.fillStyle = 'rgba(232,222,190,.88)';
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    const ex = cx + Math.cos(a) * 26, ey = cy + Math.sin(a) * 26;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(ex, ey); g.stroke();
    g.save(); g.translate(ex, ey); g.rotate(a);            // a vela na ponta
    g.fillRect(-11, -5, 11, 10); g.restore();
  }
  _el(g, cx, cy, 3.4, 3.4, _rgb(0x4a3520, 1));             // o eixo
  c.cx = 32; c.feet = H3;
  return VILA_CACHE.moinho = c;
}

const PAREDE_DRAW = { teia: teiaSprite, moinho: moinhoSprite };
const paredeSprite = (def, v) => (def.parede ? PAREDE_DRAW[def.parede] : wallSprite)(def.tex, def.c, v);

/* Tile que carrega objeto em cima do chão: o `obj` da ficha do tile diz qual.
   Dois hoje, e é o suficiente para o render não precisar conhecer nome de tile. */
const OBJ_DRAW = { cerca: cercaSprite, escora: escoraSprite,
  poco: pocoSprite, carroca: carrocaSprite, barril: barrilSprite };

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

  /* Bicho pequeno que VOA. As outras cinco formas plantam o corpo no chão pelos
     pés; esta flutua de propósito, e é isso que a distingue de longe — silhueta
     minúscula, alta no tile e sem perna nenhuma.
     Nasceu porque o vaga-lume sem forma caía no `biped` padrão e virava uma
     criança humanoide de trinta centímetros. */
  mote(g, color, o, dir, sw) {
    const md = _rgb(color), dk = _rgb(color, .55), lt = _rgb(color, 1.6);
    const yb = 21 + Math.sin(sw * 1.7) * 1.6;                  // pairando, nunca parado
    const abre = 2.4 + Math.abs(Math.sin(sw * 2.2)) * 1.8;     // asa borrada batendo
    g.globalAlpha = .4;
    _el(g, 16 - 2.8, yb - 1.6, abre, 1.4, '#eef4d2');
    _el(g, 16 + 2.8, yb - 1.6, abre, 1.4, '#eef4d2');
    g.globalAlpha = 1;
    _el(g, 16, yb, 2.1, 1.5, dk);                              // tórax
    _el(g, 16, yb + 2.1, 2.5, 1.9, md);                        // abdômen
    _el(g, 16, yb + 2.5, 1.5, 1.1, lt);                        // a lanterna
    _olhos(g, 16, yb - 1.4, '#241f14', 1.1);
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
   fixa de 352×248, colunas = quadro (parado, passo, passo), linhas = direção na
   ordem DIR_S/DIR_W/DIR_N/DIR_E e mais uma de tombado. O script já centrou o
   corpo e pôs os pés em PES, então a âncora é a mesma em toda célula — nada de
   tabela por quadro.
   A célula ocupa a MESMA caixa do boneco procedural do mesmo `size`, senão a
   criatura com folha nasceria de outro tamanho que a da tabela manda.
   Cache no tamanho final de tela (`esc` = ampliação da câmera) e `k` = 1/esc,
   pelo mesmo motivo do ranger: uma redução só, com filtro bom, e blit 1:1. */
const CRIA_CW = 352, CRIA_CH = 248, CRIA_PES = 244, CRIA_MORTO = 4;
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

/* Qual COLUNA da linha usar. A folha guarda os parados e depois os passos, e
   quantos são de cada vem do src/criaturas.js (gerado junto com o PNG).
   Andando, o quadro sai do progresso do passo — assim o bicho anda na velocidade
   em que se move de verdade.
   Parado NÃO fica alternando: os quadros de idle são poses (o ciclope levanta o
   porrete, o demônio abre a asa), não meio respiro cada. Alternar de meio em meio
   segundo vira tique. Ele fica na pose base e, de tempo em tempo, passa pelas
   outras e volta — com fase do uid, senão o mapa inteiro gesticula junto.
   Sem a tabela (folha antiga), o padrão é 1 parado + 2 passos, que é o que o
   jogo fazia antes dela existir. */
const CRIA_PADRAO = [1, 2], CRIA_ESPERA = 5200, CRIA_GESTO = 700;
const criaLinhas = n => (typeof CRIA_FOLHA !== 'undefined' && CRIA_FOLHA[n]) || null;
function criaQuadro(nome, dir, andando, prog, agora, uid) {
  const t = criaLinhas(nome);
  const [parados, passos] = (t && t.linhas[dir]) || CRIA_PADRAO;
  if (andando && passos) return parados + Math.min(passos - 1, Math.floor(prog * passos));
  if (parados < 2) return 0;
  const gesto = CRIA_GESTO * (parados - 1), ciclo = CRIA_ESPERA + gesto;
  const q = (agora + (uid || 0) * 1373) % ciclo - CRIA_ESPERA;
  return q < 0 ? 0 : 1 + Math.floor(q / CRIA_GESTO);
}
/* Tombado, quando são POSES do mesmo corpo: dois ciclopes caídos lado a lado não
   podem ser a mesma foto. Sorteado na morte (game.js) e guardado com o corpo,
   senão arrastar o cadáver trocaria o desenho. */
const criaTombado = (nome, x, y) => {
  const t = criaLinhas(nome);
  return t && t.morto > 1 ? ((x * 7 + y * 13) % t.morto + t.morto) % t.morto : 0;
};
/* Tombado, quando os quadros são o bicho APODRECENDO (demônio: corpo, carne com
   osso, caveira): aí não é sorteio, é relógio — o corpo passa pelos quadros ao
   longo da vida dele. `tombado: "apodrece"` na pasta é quem diz qual é qual. */
function criaMorto(nome, corpo, agora, vida) {
  const t = criaLinhas(nome);
  if (!t || t.morto < 2) return 0;
  if (t.tombado !== 'apodrece') return corpo.pose || 0;
  const k = (agora - corpo.t) / (vida || 120000);
  return Math.max(0, Math.min(t.morto - 1, Math.floor(k * t.morto)));
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

/* Caixa do que está DESENHADO no sprite, não do canvas: a folga vazia em volta
   é grande (na célula do ranger são 54px dos 236 só em cima). A placa de nome usa
   o topo dela, e o corpo morto usa o centro — os dois erravam feio com a medida
   do canvas. Guardada no próprio canvas, como cx/feet/k, e só quando perguntam.
   O try existe porque canvas com imagem de outra origem (abrir o jogo por
   file://) proíbe ler pixel: melhor a caixa virar o canvas inteiro do que o
   desenho inteiro parar. */
function spriteBox(spr) {
  if (spr.caixa) return spr.caixa;
  let x0 = 0, y0 = 0, x1 = spr.width - 1, y1 = spr.height - 1;   // manchado: canvas inteiro
  try {
    const d = spr.getContext('2d').getImageData(0, 0, spr.width, spr.height).data;
    x0 = spr.width; y0 = spr.height; x1 = -1; y1 = -1;
    for (let y = 0; y < spr.height; y++)
      for (let x = 0; x < spr.width; x++)
        if (d[(y * spr.width + x) * 4 + 3] > 16) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          y1 = y;
        }
    if (x1 < 0) { x0 = y0 = 0; x1 = spr.width - 1; y1 = spr.height - 1; }   // sprite vazio
  } catch (e) { /* canvas manchado: fica com o canvas inteiro */ }
  return spr.caixa = { x0, y0, x1, y1, mx: (x0 + x1 + 1) / 2, my: (y0 + y1 + 1) / 2 };
}
const spriteTop = spr => spriteBox(spr).y0;

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
/* Corpo TINGIDO na cor do elemento: mesma técnica da silhueta (source-in mais
   fill), sem o desfoque — aqui o recorte é o próprio boneco, não a sombra dele.
   Cache por sprite E por cor: um estado tinge muitos bichos, mas as cores são
   quatro. É o que faz o congelado ficar azul e o queimando alaranjado sem folha
   nova nem filtro de canvas (que só sabe produzir branco). */
const TINT_CACHE = new WeakMap();
function tingido(spr, cor) {
  let porCor = TINT_CACHE.get(spr);
  if (!porCor) TINT_CACHE.set(spr, porCor = new Map());
  let s = porCor.get(cor);
  if (s) return s;
  s = _canvas2(spr.width, spr.height);
  const g = s.getContext('2d');
  g.drawImage(spr, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = cor;
  g.fillRect(0, 0, s.width, s.height);
  porCor.set(cor, s);
  return s;
}
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
/* Poças. Manchas achatadas e esparsas, ladrilhadas em coordenada do MUNDO igual
   à nuvem — poça que anda com a câmera é chuvisco na lente. Bem menos densa que
   a folha de nuvem de propósito: o chão molhado é o efeito, a poça é o sotaque.
   Saem DUAS folhas do MESMO desenho: a clara vai no `lighter` (o lustro) e a
   escura no `multiply` (a água encharcando o piso). Duas folhas sorteadas
   separadamente seriam dois recortes que não casam, e o lustro cairia ao lado da
   poça em vez de dentro dela; a escura é a clara recortada em preto pelo
   `source-in`, o mesmo truque da silhueta aqui de cima. */
let POCA_CACHE = null;
const POCA_S = 192;
function poolTexture() {
  if (POCA_CACHE) return POCA_CACHE;
  const luz = _canvas(POCA_S), g = luz.getContext('2d'), rnd = _mulberry(0x9042a);
  /* Uma elipse girada lê como círculo esticado, não como poça: o olho reconhece
     a curva perfeita na hora. O contorno tem de ser IRREGULAR, e sai do mesmo
     truque da nuvem — várias elipses achatadas se sobrepondo ao longo de um eixo
     que serpenteia. O que interessa é a silhueta somada, não cada bolha.
     `lighten` em vez de `source-over`: bolhas sobrepostas com alfa somariam e
     deixariam um miolo mais claro a cada cruzamento, denunciando as peças. */
  /* Poucas, e é o ponto. A folha cobre ~4,5 tiles na tela, então cada unidade
     aqui é uma poça a cada dois ou três tiles. Com trinta delas o chão inteiro
     ficava salpicado e o efeito lia como textura de ruído ou lama — poça precisa
     de chão seco em volta para ser poça. */
  const POCAS = 8;
  g.globalCompositeOperation = 'lighten';
  for (let i = 0; i < POCAS; i++) {
    const cx = rnd() * POCA_S, cy = rnd() * POCA_S;
    const eixo = rnd() * 6.283, esc = POCA_S * (.016 + rnd() * .022);
    const n = 3 + (rnd() * 3 | 0);
    /* Compacta, não esticada. Com o eixo longo a poça saía um rastro deitado, que
       o olho lê como borrão ou pegada — água parada empoça em volta do ponto
       baixo, ela não escorre pela tela. O deslocamento entre bolhas é curto e o
       desvio lateral é da ordem do raio: o que sobra é o contorno lobado. */
    for (let j = 0; j < n; j++) {
      const d = (j / (n - 1 || 1) - .5) * esc * 1.5;
      const bx = cx + Math.cos(eixo) * d + (rnd() - .5) * esc * .9;
      const by = cy + Math.sin(eixo) * d * .7 + (rnd() - .5) * esc * .7;
      const rx = esc * (.6 + rnd() * .55), ry = rx * (.62 + rnd() * .3);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const px = bx + dx * POCA_S, py = by + dy * POCA_S;
        if (px < -rx || px > POCA_S + rx || py < -rx || py > POCA_S + rx) continue;
        g.save();
        g.translate(px, py); g.rotate((rnd() - .5) * .8);
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
        /* Borda CURTA: a queda toda acontece nos últimos 12% do raio. Com a queda
           longa a mancha vira sombra desfocada, e sombra desfocada no chão já é a
           da nuvem — duas coisas diferentes não podem ter a mesma borda. */
        gr.addColorStop(0, 'rgba(255,255,255,1)');
        gr.addColorStop(.88, 'rgba(255,255,255,1)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.scale(1, ry / rx); g.fillRect(-rx, -rx, rx * 2, rx * 2);
        g.restore();
      }
    }
  }
  g.globalCompositeOperation = 'source-over';
  const escuro = _canvas(POCA_S), ge = escuro.getContext('2d');
  ge.drawImage(luz, 0, 0);
  ge.globalCompositeOperation = 'source-in';
  ge.fillStyle = '#2b3138';                 // não preto: água escurece o chão, não o apaga
  ge.fillRect(0, 0, POCA_S, POCA_S);
  return POCA_CACHE = { luz, escuro };
}

/* Uma folha por semente, em cache: a mesma semente devolve sempre a mesma nuvem
   (o ladrilho não pode piscar entre quadros) e sementes diferentes devolvem
   formas diferentes. É o que deixa as duas camadas terem recorte próprio em vez
   de serem a mesma mancha em duas escalas. */
const CLOUD_CACHE = new Map();
const CLOUD_S = 256;
function cloudTexture(semente = 0xc10d5) {
  const feito = CLOUD_CACHE.get(semente);
  if (feito) return feito;
  const c = _canvas(CLOUD_S), g = c.getContext('2d'), rnd = _mulberry(semente);
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
  for (let i = 0, bancos = 5 + (rnd() * 4 | 0); i < bancos; i++) {
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
  CLOUD_CACHE.set(semente, c);
  return c;
}

/* escadas: buraco escuro para descer, degraus claros para subir */
const STAIR_CACHE = {};
/* Marca de POI no chão. Os 39 pontos de interesse apareciam no minimapa e
   NADA no terreno: o jogador via o losango no mapa, andava até lá e chegava num
   quadrado igual a todos os outros. Isto é informação faltando, não enfeite.

   Procedural, e não recorte de `assets/scenario/tiles_01.png`, por dois motivos:
   a folha tem célula fracionária e fundo chroma (o #19 cataloga), e adereço não
   precisa costurar com o vizinho — o custo de acertar a extração não se paga
   aqui. Segue o mesmo idioma do `stairSprite` logo abaixo.
   Cada marca sai da própria `dica` da tabela, para o que se vê no chão e o que
   se lê no mapa contarem a mesma história.
   Saqueado desenha apagado, igual ao losango do minimapa: o mapa é o caderno do
   jogador, e o chão tem de concordar com ele. */
const POI_CACHE = {};
const POI_DRAW = {
  // "fogueira apagada e pegadas frescas"
  bandit_camp(g) {
    for (let i = 0; i < 7; i++) {                                  // roda de pedras
      const a = i / 7 * Math.PI * 2;
      _el(g, 16 + Math.cos(a) * 9, 18 + Math.sin(a) * 6, 2.6, 2, _rgb(0x6b6459));
    }
    _poly(g, [[11, 20], [21, 15], [22, 17], [12, 22]], _rgb(0x2a211a));   // lenha cruzada
    _poly(g, [[11, 15], [21, 20], [22, 18], [12, 13]], _rgb(0x33291f));
    _el(g, 16, 18, 3.4, 2.4, _rgb(0x15110d));                      // brasa morta
  },
  // "pedra lavrada tomada pelo mato"
  ruin(g) {
    g.fillStyle = _rgb(0x9a9185); g.fillRect(10, 8, 6, 16);        // coluna quebrada
    g.fillStyle = _rgb(0x7c7468); g.fillRect(10, 8, 2, 16);
    _poly(g, [[10, 8], [16, 8], [15, 5], [11, 6]], _rgb(0xb0a698)); // topo lascado
    g.fillStyle = _rgb(0x8a8276); g.fillRect(18, 19, 9, 5);        // bloco tombado
    for (let i = 0; i < 5; i++)                                     // mato subindo
      _el(g, 9 + i * 3.4, 24 - (i % 2) * 2, 2.2, 3, _rgb(0x3f6b34));
  },
  // "teia grossa demais para ser de aranha comum"
  nest(g) {
    g.strokeStyle = _rgb(0xd8d2c4, 1, .8); g.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {                                   // raios
      const a = i / 6 * Math.PI * 2;
      g.beginPath(); g.moveTo(16, 17);
      g.lineTo(16 + Math.cos(a) * 13, 17 + Math.sin(a) * 11); g.stroke();
    }
    for (const r of [5, 9, 12]) {                                   // anéis
      g.beginPath(); g.ellipse(16, 17, r, r * .82, 0, 0, 7); g.stroke();
    }
    _el(g, 16, 17, 4, 3.4, _rgb(0xe8e2d2));                         // casulo no centro
    _el(g, 16, 17, 2.2, 1.8, _rgb(0xb9ae94));
  },
  // "a laje foi aberta por dentro"
  barrow(g) {
    _el(g, 16, 20, 12, 8, _rgb(0x2b2620));                          // cova
    _el(g, 16, 20, 9, 5.6, _rgb(0x0d0b09));                         // boca escura
    _poly(g, [[6, 12], [20, 9], [22, 13], [8, 16]], _rgb(0x8a8276)); // laje empurrada
    _poly(g, [[6, 12], [20, 9], [20, 10.5], [6, 13.5]], _rgb(0xa79e90));
  },
  // "alguma coisa dorme em cima disto há muito tempo"
  hoard(g) {
    _el(g, 16, 22, 12, 5, _rgb(0x6b5a2a));                          // monte
    for (let i = 0; i < 14; i++) {                                  // moedas
      const x = 6 + (i * 7 % 21), y = 17 + (i * 5 % 8);
      _el(g, x, y, 2.2, 1.5, _rgb(i % 3 ? 0xd9a441 : 0xf0cd7a));
    }
    _poly(g, [[16, 10], [17.4, 14], [21, 15.4], [17.4, 16.8], [16, 20],
              [14.6, 16.8], [11, 15.4], [14.6, 14]], _rgb(0xfff0b0, 1, .55));  // brilho
  }
};
function poiSprite(id, saqueado) {
  const key = id + (saqueado ? '.s' : '');
  if (POI_CACHE[key]) return POI_CACHE[key];
  const c = _canvas2(32, 32), g = c.getContext('2d');
  const d = POI_DRAW[id];
  if (!d) return POI_CACHE[key] = c;              // tipo novo sem arte: some, não quebra
  if (saqueado) g.globalAlpha = .32;
  d(g);
  g.globalAlpha = 1;
  return POI_CACHE[key] = c;
}

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

/* ---------------------------------------------------- campos no chão (#33) */
/* Modelo Tibia: o campo é um SPRITE que ocupa o tile, com quadros discretos —
   não um tingimento com partícula por cima. A primeira tentativa foi essa, e o
   dono do projeto estava certo em rejeitá-la: bolinha subindo em quatro cores
   não diz fogo, veneno, gelo nem energia. A cor sozinha nunca disse.
   O que diz é SILHUETA e MOVIMENTO, e por isso cada elemento tem a própria
   rotina em vez de uma fórmula compartilhada — é o caso em que reusar a mesma
   função é exatamente o erro, porque diferenciar é o requisito inteiro.

     fogo    língua que afina para cima, núcleo claro, tremula rápido
     veneno  massa rasteira que borbulha e estoura, não sobe
     gelo    cristal angular crescendo das bordas, quase parado, brilha às vezes
     energia arco que estala e some, sem deriva nenhuma

   QUADROS DISCRETOS são metade da assinatura: 4 quadros trocados de vez em
   quando lêem como pixel-art animado; a mesma coisa interpolada lê como efeito
   de motor moderno, que é o que o §23 veta. Pré-desenhar também troca dezenas de
   traçados por tile e por quadro por um `drawImage`. */
const CAMPO_CACHE = {};
const CAMPO_FRAMES = 4;
const CAMPO_MS = 150;          // 600 ms de laço: rápido no fogo, imperceptível no gelo
const CAMPO_DRAW = {
  /* FOGO. Leito de brasa embaixo e línguas por cima, em três faixas de cor: a
     externa escura dá contorno, o núcleo claro é o que faz parecer quente. A
     ponta anda por quadro — é a tremulação, e ela é o que separa fogo de
     "triângulo laranja". */
  /* FOGO. Quinta versão, e a primeira feita contra uma IMAGEM de referência do
     Tibia em vez de contra uma descrição. As quatro anteriores e o que cada
     descrição virou ao pé da letra:
       "língua que afina para cima"  -> spike
       "massa que enche o tile"      -> lava (camadas empilhadas na horizontal)
       "pilha de círculos"           -> pino de boliche
       "labaredas com perfil de gota"-> minhocas se contorcendo (três colunas
                                        estreitas balançando cada uma pra um lado)
     O que a referência mostra, e nenhuma descrição minha tinha:
       1. UMA massa por tile, larga quanto o tile — não três chamas separadas.
          Chama separada balançando é minhoca; massa única com a crista mexendo
          é fogo.
       2. Crista IRREGULAR de vários picos pequenos, não uma silhueta suave.
       3. Sombreado CONCÊNTRICO: borda escura, laranja, amarelo e quase branco,
          cada camada encaixada dentro da anterior e seguindo a mesma crista.
          Faixa horizontal vira líquido; encaixe concêntrico vira volume.
       4. O AMARELO domina o centro. Minhas versões eram laranja escuro com um
          fiapo claro, e é metade do motivo de não parecerem quentes.

     A crista é uma soma de três senoides em x (≈1,5 + 3 + 5 picos), com a fase
     andando por quadro: é o que faz o fogo lamber sem nenhuma parte se destacar
     como objeto próprio. As pontas afunilam nas laterais para o desenho morrer
     dentro do quadro e não ler como cortado pelo tile. */
  fire(g, S, base, q, v, fase) {
    /* A fase mínima é a MESMA chama, pequena — não um desenho à parte. A versão
       anterior trocava por uma mancha de queimado com brasas e o tile virava um
       buraco escuro no chão. Uma régua de altura só, três valores: o jogador lê
       "o fogo está morrendo" porque é o mesmo fogo diminuindo. */
    const alto = [.62, .40, .17][fase] * S;
    /* CRISTA POR RUÍDO, não por senoides. Soma de senoides sempre volta a ser
       periódica, e com a abóbada simétrica por cima o resultado foi uma ameia
       de castelo — bonitinha, igual dos dois lados, e nada parecida com fogo.
       Aqui sete alturas SORTEADAS (semeadas pelo quadro e pela variante do
       tile) interpoladas com smoothstep: irregular por construção, diferente em
       cada tile e em cada quadro, e sem eixo de simetria nenhum. */
    const nC = 7, rr = _mulberry(q * 137 + v * 911 + 7), ctrl = [];
    for (let i = 0; i <= nC; i++) ctrl.push(rr());
    const alturaEm = t => {
      const p = t * nC, i = Math.min(nC - 1, p | 0), f = p - i;
      return ctrl[i] + (ctrl[i + 1] - ctrl[i]) * (f * f * (3 - 2 * f));
    };
    const crista = [];
    for (let x = 0; x < S; x++) {
      const t = x / S;
      let h = alto * (.45 + alturaEm(t) * .85);
      h *= Math.min(1, Math.sin(Math.PI * (.03 + t * .94)) * 1.5);   // morre nas bordas
      crista.push(Math.max(0, h));
    }
    // média com os vizinhos: sem ela cada coluna de 1px vira degrau e a ponta
    // sai quadrada, que foi a outra metade da reclamação
    const suave = crista.map((_, i) =>
      (crista[Math.max(0, i - 1)] + crista[i] * 2 + crista[Math.min(S - 1, i + 1)]) / 4);
    /* Camada = a MESMA crista rebaixada, sem recuo lateral. O recuo lateral fixo
       da versão anterior cortava as camadas internas em linha reta vertical — é
       exatamente o "quadrado no meio". Rebaixando só a altura, a camada some
       sozinha onde a chama é fina, e a silhueta interna acompanha a externa.
       O deslocamento em x tira o encaixe perfeitamente concêntrico. */
    /* As camadas internas puxam para uma ABÓBADA centrada em vez de copiarem a
       crista. Copiando a crista, o claro virava uma faixa fina acompanhando o
       contorno — leitura de montanha sombreada, não de fogo. Puxando para o
       centro, o amarelo vira MIOLO: quente no meio, escuro na borda, que é o
       que a referência mostra. `k` é o quanto cada camada já esqueceu a crista. */
    const domo = x => alto * .92 * Math.sin(Math.PI * (x + .5) / S);
    const camada = (cor, baixa, desloc, k) => {
      g.fillStyle = cor;
      for (let x = 0; x < S; x++) {
        const c = suave[Math.max(0, Math.min(S - 1, x + desloc))];
        const h = c + (domo(x) - c) * k - baixa;
        if (h <= 1.2) continue;
        g.fillRect(x, S - 2 - h, 1, h);
      }
    };
    camada(_rgb(shade(base, .62)), 0, 0, 0);           // borda escura: a crista crua
    camada(_rgb(base), fase === 2 ? 1.2 : 3, 1, .22);  // laranja
    camada(_rgb(shade(base, 1.55)), fase === 2 ? 2.5 : 7, -1, .5);   // amarelo — é ele que manda
    if (fase < 2) camada(_rgb(shade(base, 2.3)), 11.5, 2, .72);      // miolo branco: só enquanto há fogo
    // faísca solta acima da crista, o único ponto pontual
    const fx = 5 + ((q * 7 + v * 5) % 22), fy = 3 + ((q * 3 + v) % 6);
    g.fillStyle = _rgb(shade(base, 1.8), 1, .8); g.fillRect(fx, fy, 1.6, 1.6);
  },
  /* VENENO. Massa ESCURA que cobre o tile, com realce claro por cima — a
     primeira versão era verde claro espalhado e sumia no capim, porque tinha a
     mesma luminância do terreno. O que separa não é a cor, é o contraste: base
     bem escura, poças brilhantes dentro, borda lumpenta feita de bolhas.
     Não sobe: veneno é poça viva, e o dia em que subir vira fumaça. */
  earth(g, S, base, q, v, fase) {
    const massa = _rgb(shade(base, .5)), poca = _rgb(shade(base, .95)), luz = _rgb(shade(base, 1.5));
    /* SEM FUNDO, por decisão do dono do projeto. O retângulo escuro atrás dava
       o corpo, mas lado a lado desenhava um bloco chapado com bolha em cima, e
       o terreno sumia embaixo dele. Agora o veneno é só a poça: bolhas grandes
       encostando umas nas outras fazem o corpo, e o chão aparece nos vãos —
       que é o que faz parecer coisa DERRAMADA e não retângulo pintado. */
    /* Fase encolhe a poça e apaga o brilho: na mínima sobra a mancha seca no
       chão, que é veneno que já foi. */
    /* A mínima ENCOLHE pouco: é mancha seca, e mancha seca continua ocupando o
       chão. Encolher demais fazia o tile parecer limpo — o veneno passou, mas o
       jogador tem de continuar vendo onde ele esteve. */
    const enc = [1, .85, .8][fase], n = [11, 10, 10][fase];
    for (let i = 0; i < n; i++) {
      const a = i * 2.1 + (v & 3) * .5, d = (2 + i % 4 * 3.6) * enc;
      _el(g, S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d * .9,
          (4.6 - i % 3 * .9) * enc, (3.9 - i % 3 * .8) * enc,
          fase >= 2 ? _rgb(shade(base, .5 + (i % 3) * .08)) : (i % 4 ? massa : poca));
    }
    if (fase >= 2) return;                             // mínima: mancha e mais nada
    for (let i = 0; i < (fase ? 3 : 5); i++) {                     // brilho de superfície
      const a = i * 1.7 + q * .3, d = (3 + i % 3 * 3) * enc;
      _el(g, S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d * .8 - 1, 2, 1.4, poca);
    }
    const bolhas = [[10, 12], [22, 15], [14, 22], [24, 24]].slice(0, fase ? 2 : 4);
    bolhas.forEach(([bx, by], i) => {
      const f = (q + i) % CAMPO_FRAMES;
      if (f === 3) {
        /* Estourou. Anel ABERTO e irregular em vez do círculo fechado: o
           círculo perfeito lia como forma geométrica desenhada por cima da
           massa, não como bolha que acabou de arrebentar. */
        g.strokeStyle = luz; g.lineWidth = 1.4; g.lineCap = 'round';
        g.beginPath(); g.arc(bx, by, 3.6, .6, 4.4); g.stroke();
        _el(g, bx + 3, by - 2, 1, .8, luz);                        // respingo
      } else {
        const r = 1.4 + f * 1.1;
        _el(g, bx, by, r, r * .85, poca);
        _el(g, bx - r * .3, by - r * .35, r * .4, r * .3, luz);    // brilho da bolha
      }
    });
  },
  /* GELO. Poça CONGELADA vista de cima: placas irregulares separadas por trincas
     brancas. A primeira versão eram lascas apontando para o centro e o resultado
     foi um cata-vento — simetria radial é a coisa mais fácil de errar aqui,
     porque gelo real racha em pedaço torto.
     Fica parado de propósito: o que muda por quadro é só o brilho. Um treme, o
     outro não, e isso separa gelo de fogo antes mesmo da cor. */
  ice(g, S, base, q, v, fase) {
    let placas = [
      [[0, 0], [14, 0], [17, 10], [6, 14], [0, 9]],
      [[14, 0], [32, 0], [32, 8], [20, 12], [17, 10]],
      [[0, 9], [6, 14], [4, 24], [0, 26]],
      [[6, 14], [17, 10], [20, 12], [22, 22], [12, 26], [4, 24]],
      [[32, 8], [32, 20], [22, 22], [20, 12]],
      [[0, 26], [4, 24], [12, 26], [10, 32], [0, 32]],
      [[12, 26], [22, 22], [32, 20], [32, 32], [10, 32]]
    ];
    const tons = [.62, .88, .72, 1, .8, .68, .92];
    /* Derrete de fora para dentro: na fraca sobram cinco placas, na mínima três
       e sem trinca clara — sobra a geada rala, que escorrega mas não gela. */
    const vivas = [7, 5, 4][fase];
    placas.slice(0, vivas).forEach((p, i) => _poly(g, p, _rgb(shade(base, tons[i] * (fase ? .8 : 1)))));
    placas = placas.slice(0, vivas);
    g.strokeStyle = _rgb(shade(base, 1.55)); g.lineWidth = 1;      // trinca clara
    placas.forEach(p => {
      g.beginPath();
      p.forEach((pt, i) => i ? g.lineTo(pt[0], pt[1]) : g.moveTo(pt[0], pt[1]));
      g.closePath(); g.stroke();
    });
    for (let i = 0; i < 5; i++) {                                  // agulhas de geada
      const r = _rnd() * 6.283, x = 4 + _rnd() * 24, y = 4 + _rnd() * 24;
      g.strokeStyle = _rgb(0xffffff, 1, .5); g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x - Math.cos(r) * 3, y - Math.sin(r) * 3);
      g.lineTo(x + Math.cos(r) * 3, y + Math.sin(r) * 3);
      g.stroke();
    }
    /* Brilho, não cruz. A versão anterior era um traço horizontal mais um
       vertical do mesmo tamanho, e o desenho que sai disso é o sinal de mais —
       lia como ícone de interface. Um losango pequeno com um pixel branco no
       meio lê como luz batendo na quina da placa, que é o que devia. */
    if (fase >= 2) {
      /* Mínima: a geada FINA cobrindo o tile inteiro, sem placa brilhante nem
         faísca. Escorrega, não gela — mas se vê. */
      g.strokeStyle = _rgb(shade(base, 1.2), 1, .45); g.lineWidth = 1;
      for (let i = 0; i < 9; i++) {
        const x = 2 + (i * 11 % 27), y = 3 + (i * 7 % 25), a = i * 1.3;
        g.beginPath();
        g.moveTo(x - Math.cos(a) * 4, y - Math.sin(a) * 4);
        g.lineTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4);
        g.stroke();
      }
      return;
    }
    const [bx, by] = [[9, 7], [24, 9], [15, 19], [26, 27]][q];
    _poly(g, [[bx, by - 2.6], [bx + 1.5, by], [bx, by + 2.6], [bx - 1.5, by]], _rgb(0xffffff, 1, .8));
    g.fillStyle = _rgb(0xffffff); g.fillRect(bx - .5, by - .5, 1, 1);
  },
  /* ENERGIA. Refeita contra a imagem de referência do Tibia, que mostrou uma
     estrutura que nenhuma descrição minha tinha: NÃO é raio atravessando o
     tile. É um CONTORNO EM ESTRELA espinhosa — fechado, de traço fino, pontas
     alternando longa e curta — com um NÚCLEO claro arredondado no meio.
     As duas versões anteriores (fita ondulada e zigue-zague em W) erravam a
     topologia inteira: linha ABERTA atravessando, quando o certo é aura FECHADA
     em volta de um miolo. O miolo diz "energia contida"; o espinho diz
     "descarregando". Só traço, sem preenchimento: na referência o chão aparece
     entre a estrela e o núcleo, e é isso que impede virar bolha chapada. */
  energy(g, S, base, q, v, fase) {
    const halo = _rgb(shade(base, 1.2)), nucleo = _rgb(shade(base, 1.75));
    /* A mínima é o MESMO contorno, pequeno e apagado — não um desenho à parte.
       A versão anterior trocava por uma estrela dupla de pontas retas e a fase
       mínima virava outro elemento; é a mesma correção que o fogo levou. */
    const esc = [1, .84, .72][fase];
    /* Contorno BOLHUDO e fino, com o chão aparecendo entre a aura e o miolo.
       A versão anterior tinha ponta reta, 11 pontas e raio interno colado no
       núcleo — o traçado se cruzava perto do centro e o resultado era uma
       estrela CHAPADA, tipo adesivo. A referência é o oposto: linha fina, poucos
       lobos, e vão de chão bem visível entre o anel e o núcleo.
       As curvas quadráticas passam pelos MEIOS das arestas usando o vértice de
       controle: cada vértice vira lobo arredondado em vez de bico. */
    const lobos = 8, pts = [], rr = _mulberry(1000 + q * 37 + v * 991);
    for (let i = 0; i < lobos * 2; i++) {
      const a = (i / (lobos * 2)) * 6.283 + q * .2 + (rr() - .5) * .3;
      const r = (i % 2 ? 9.4 + rr() * 1.6 : 12.8 + rr() * 2.6) * esc;
      pts.push([16 + Math.cos(a) * r, 16 + Math.sin(a) * r * .95]);
    }
    const meioDe = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    g.strokeStyle = fase === 2 ? _rgb(shade(base, 1.05), 1, .62) : halo;
    g.lineWidth = fase === 2 ? 1.3 : 1; g.lineJoin = 'round';
    g.beginPath();
    const m0 = meioDe(pts[pts.length - 1], pts[0]);
    g.moveTo(m0[0], m0[1]);
    for (let i = 0; i < pts.length; i++) {
      const cur = pts[i], m = meioDe(cur, pts[(i + 1) % pts.length]);
      g.quadraticCurveTo(cur[0], cur[1], m[0], m[1]);
    }
    g.closePath(); g.stroke();
    // realce branco só nos lobos longos: dá a leitura de descarga sem encher
    if (fase < 2) {
      g.strokeStyle = _rgb(0xffffff, 1, fase ? .4 : .55);
      for (let i = 1; i < pts.length; i += 4) {
        g.beginPath();
        g.moveTo(pts[i][0], pts[i][1]);
        g.lineTo(16 + (pts[i][0] - 16) * .72, 16 + (pts[i][1] - 16) * .72);
        g.stroke();
      }
    }
    /* FAÍSCAS. O contorno sozinho lê como aura parada — quase uma flor. A
       faísca é o que diz que está DESCARREGANDO: risquinhos quebrados saltando
       do miolo para fora, em posição e comprimento novos a cada quadro, mais um
       ponto branco solto. Trocam de lugar em vez de deslizar, que é a mesma
       regra da descontinuidade que vale para o raio. */
    const nf = fase === 2 ? 2 : fase === 1 ? 3 : 5;
    const rf = _mulberry(q * 613 + v * 71 + 3);
    for (let i = 0; i < nf; i++) {
      const a = rf() * 6.283, d0 = 4 + rf() * 3, d1 = d0 + 3.5 + rf() * 5;
      const quebra = (rf() - .5) * .55;                 // o cotovelo do risco
      const dm = (d0 + d1) / 2;
      g.strokeStyle = _rgb(shade(base, 1.6), 1, fase === 2 ? .5 : .85);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(16 + Math.cos(a) * d0, 16 + Math.sin(a) * d0 * .94);
      g.lineTo(16 + Math.cos(a + quebra) * dm, 16 + Math.sin(a + quebra) * dm * .94);
      g.lineTo(16 + Math.cos(a - quebra * .6) * d1, 16 + Math.sin(a - quebra * .6) * d1 * .94);
      g.stroke();
      if (i % 2 === 0) {                                // ponto branco na ponta
        g.fillStyle = _rgb(0xffffff, 1, fase === 2 ? .45 : .8);
        g.fillRect(16 + Math.cos(a - quebra * .6) * d1 - .6, 16 + Math.sin(a - quebra * .6) * d1 * .94 - .6, 1.4, 1.4);
      }
    }
    // núcleo PEQUENO: na referência a aura é que ocupa o tile, não o miolo
    if (fase === 2)                                    // carga residual crepitando no chão
      for (let i = 0; i < 4; i++)
        _el(g, 11 + ((i * 5 + q * 3) % 11), 12 + ((i * 7 + q) % 9), 1.5, 1.2, _rgb(shade(base, 1.15), 1, .55));
    _el(g, 16, 16, 4 * esc, 3.5 * esc, fase === 2 ? _rgb(shade(base, 1.2), 1, .5) : nucleo);
    if (fase < 2) _el(g, 15.2, 15.2, 1.9 * esc, 1.6 * esc, _rgb(0xffffff, 1, fase ? .7 : .95));
  }
};
/* Um sprite por elemento e por quadro, desenhado uma vez e reaproveitado. 32×32
   como o resto da arte do projeto: o render amplia com nearest-neighbor, então
   desenhar em 32 é o que garante a borda dura do §18. */
/* VARIANTE POR TILE. O mesmo sprite repetido em trinta tiles desenha uma grade
   de carimbos — defeito que só aparece na vista lado a lado e que um tile
   sozinho esconde por completo. Quatro variantes por espelhamento custam quatro
   canvas a mais e quebram o padrão sem redesenhar rotina nenhuma.
   FOGO não espelha na vertical: a chama tem "para cima", e virá-la de cabeça
   para baixo faz o fogo pingar do teto. Em troca ele varia a posição e a altura
   das línguas, que é o que a rotina faz com o `v`. */
const CAMPO_VARS = 4;
const CAMPO_EIXO_Y = { fire: false };
/* Quem pode GIRAR um quarto de volta. Espelhar só na horizontal deixava os arcos
   de energia todos deitados, e lado a lado isso desenha listras. Raio não tem
   em pé nem deitado, então girar é de graça; fogo tem, e por isso fica de fora. */
const CAMPO_GIRA = { energy: true };
const campoVarDe = (x, y) => (x * 5 + y * 3) & 3;
function campoSprite(el, q, v = 0, fase = 0) {
  const key = el + q + '.' + v + '.' + fase;
  if (CAMPO_CACHE[key]) return CAMPO_CACHE[key];
  const c = _canvas2(32, 32), g = c.getContext('2d'), d = CAMPO_DRAW[el];
  if (!d) return CAMPO_CACHE[key] = c;            // elemento novo sem arte: some, não quebra
  g.save();
  g.translate(16, 16);                                   // tudo em volta do centro
  if (v & 2) {
    if (CAMPO_GIRA[el]) g.rotate(Math.PI / 2);
    else if (CAMPO_EIXO_Y[el] !== false) g.scale(1, -1);
  }
  if (v & 1) g.scale(-1, 1);
  g.translate(-16, -16);
  _rnd = _mulberry(_hash(key));
  d(g, 32, (typeof ELEM !== 'undefined' && ELEM[el] ? ELEM[el].cor : 0xffffff), q, v, fase);
  _rnd = Math.random;
  g.restore();
  return CAMPO_CACHE[key] = c;
}

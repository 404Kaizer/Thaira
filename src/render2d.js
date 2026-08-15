/* render2d.js — a visão do mundo no modelo do Tibia.
   Grade quadrada alinhada aos eixos, tile de 32×32, câmera presa no jogador.
   A profundidade sai de três truques, nenhum deles 3D:
     1. sprites vistos de frente que transbordam para cima no tile de trás;
     2. cada andar acima do jogador desenhado 1 tile para cima-esquerda;
     3. algoritmo do pintor: andares de baixo primeiro, depois varredura por
        linha (y externo, x interno) — quem está mais ao sul cobre quem está
        ao norte.
   Depende de world.js (WORLD/TILE/tileAt), art.js (sprites) e do estado em G/P. */
'use strict';

const TS = 32;                                   // tile em pixels de origem
const CAM = { zoom: 2, scale: 2 };               // zoom fracionário — passo fino no wheel
let gcv = null, g2 = null, VW = 0, VH = 0, camX = 0, camY = 0;

/* Em tela HiDPI o canvas tinha o tamanho em pixel de CSS e o navegador esticava
   o resultado — o jogo inteiro saía borrado, apesar do imageSmoothingEnabled.
   Agora o buffer é criado em pixel de dispositivo e a escala do mundo cresce
   junto, então o tamanho aparente não muda e o pixel fica limpo. Arredondado
   para inteiro de propósito: 1,25 esticaria uns pixels e não outros, que é pior
   num jogo desenhado em pixel do que a resolução menor. */
const dprInt = () => Math.max(1, Math.round(devicePixelRatio || 1));
function resizeCam(canvas) {
  gcv = canvas || gcv; if (!gcv) return;
  const d = dprInt();
  VW = gcv.width = Math.round((gcv.clientWidth || 800) * d);
  VH = gcv.height = Math.round((gcv.clientHeight || 600) * d);
  CAM.scale = CAM.zoom * d;
  g2 = gcv.getContext('2d');
  g2.imageSmoothingEnabled = false;              // mexer no width zera o contexto
}

/* ------------------------------------------------------- mundo <-> tela */
/* A transformação do cliente: o deslocamento por andar é o que dá profundidade. */
const tpx = () => TS * CAM.scale;
function w2s(x, y, z) {
  const t = tpx(), dz = (P.z - (z === undefined ? P.z : z)) * t;
  return [(x - camX) * t - dz + VW / 2, (y - camY) * t - dz + VH / 2];
}
/* Linha de contato com o chão, em fração do tile. Meio, não borda de baixo: com
   a borda o boneco ficava plantado no limite sul do próprio tile, o corpo cobria
   o tile de cima e — pior — o clique no corpo caía no tile errado, porque
   screenToTile arredonda para o tile cujo CENTRO está mais perto. */
const CHAO = .5;
// respiro parado: ±1,4% da altura. Em boneco de 40px é meio pixel, que é o ponto
// — tem de dar para ver que está vivo e não para ver que está inflando.
const RESPIRO = .014;

/* Placas de nome e texto flutuante vivem no HTML por cima do canvas. Estas duas
   funções existem só para isso, então devolvem pixel de CSS — enquanto o resto
   do render trabalha em pixel de canvas, que com dpr>1 é um número diferente.
   Sem a conversão a placa do jogador ia parar na borda da tela em tela HiDPI. */
const paraCss = ([sx, sy]) => { const d = dprInt(); return [sx / d, sy / d]; };
function project(x, y, h) {
  const [sx, sy] = w2s(x, y);
  return paraCss([sx, sy + tpx() / 2 - (h || 0) * 16 * CAM.scale]);
}
/* Âncora da placa: sai da altura real do sprite, não de um `h` chutado por
   criatura. Com o número fixo, quem era alto ficava com o nome no meio do peito
   — e era o mesmo defeito no dragão e no jogador. */
function plateAnchor(e) {
  const spr = creatureSpriteFor(e), K = CAM.scale * (spr.k || 1);
  const [sx, sy] = w2s(e.px, e.py);
  // altura útil = dos pés até o primeiro pixel opaco, não até o topo do canvas
  const alto = (spr.feet - spriteTop(spr)) * K;
  /* w2s devolve o CENTRO do tile; drawEntity recebe o canto (w2s - t/2) e só
     então soma t * CHAO. Sem o -t/2 aqui a placa descia meio tile e pousava na
     cabeça. A folga acompanha o zoom, senão em tile grande a barra encosta. */
  const t = tpx();
  return paraCss([sx, sy + t * (CHAO - .5) - alto - 3 - t * .1]);
}
const evToCanvas = (ev, canvas) => {
  const r = canvas.getBoundingClientRect();
  return [(ev.clientX - r.left) * (canvas.width / (r.width || 1)),
          (ev.clientY - r.top) * (canvas.height / (r.height || 1))];
};
function screenToTile(ev, canvas) {
  const [sx, sy] = evToCanvas(ev, canvas), t = tpx();
  return [Math.round(camX + (sx - VW / 2) / t), Math.round(camY + (sy - VH / 2) / t)];
}
/* ------------------------------------------------------------- caches */
let decoMaps = null, floorVoid = null, cacheSeed = -1;
function worldCaches() {
  if (cacheSeed === WORLD.seed && decoMaps) return;
  cacheSeed = WORLD.seed; decoMaps = []; floorVoid = [];
  for (let z = 0; z < FLOORS; z++) {
    const m = new Map();
    for (const d of WORLD.floors[z].deco) m.set(d.y * W + d.x, d);
    decoMaps.push(m);
    const t = WORLD.floors[z].t;
    let vazio = false;
    for (let i = 0; i < t.length; i++) if (t[i] === T.VOID) { vazio = true; break; }
    floorVoid.push(vazio);
  }
}

/* --------------------------------------------------------------- desenho */
/* fontes de luz do quadro: {x, y, r, cor, a0, a1}. Lava, magia e projétil
   entram aqui do mesmo jeito — a cor é a da própria coisa. */
const luzes = [];

function drawWorld() {
  if (!g2) return;
  worldCaches();
  const t = tpx(), amb = ambienteAgora(P.z);
  camX = P.px; camY = P.py;
  /* Tremor: desloca a CÂMERA, não os sprites — assim chão, bicho e efeito
     sacodem juntos e nada desalinha. Em tiles porque camX é em tiles; a
     amplitude vem em pixel de tela, então divide pelo tamanho do tile.
     Durante o hitstop G.now não anda: o quadro inteiro congela deslocado, que é
     justamente o que dá o peso do golpe. */
  const ab = G.abalo;
  if (ab) {
    const k = 1 - (G.now - ab.t) / ab.dur;
    if (k <= 0) G.abalo = null;
    else {
      /* Oscilação por seno, não por sorteio: sorteio muda a cada chamada de
         drawWorld e a placa de nome — que lê camX depois — sairia num ponto
         diferente do corpo. Duas frequências primas entre si para o tremor não
         virar uma linha na diagonal. */
      const a = ab.amp * k * CAM.scale / t;
      camX += Math.sin(G.now * .091) * a; camY += Math.cos(G.now * .117) * a;
    }
  }
  g2.imageSmoothingEnabled = false;
  g2.fillStyle = amb.bg; g2.fillRect(0, 0, VW, VH);
  luzes.length = 0;

  const cols = Math.ceil(VW / t / 2) + 2, rows = Math.ceil(VH / t / 2) + 3;
  const cx = Math.floor(camX), cy = Math.floor(camY);

  /* pilha de andares: o de baixo aparece pelos buracos do atual; o de cima só
     quando o jogador não está coberto — é o teto que some ao entrar na caverna */
  const coberto = souCoberto();
  const zs = [];
  if (P.z + 1 < FLOORS && floorVoid[P.z]) zs.push(P.z + 1);
  zs.push(P.z);
  if (P.z - 1 >= 0 && !coberto) zs.push(P.z - 1);

  const bucket = entityBucket();
  for (const z of zs) drawFloor(z, cx - cols, cx + cols, cy - rows, cy + rows, t, z === P.z ? bucket : null);
  const clima = climaAgora(P.z);
  if (clima.nuvens > .01) cloudPass(t, clima.nuvens);
  drawEffects(t);
  if (amb.amb) {
    /* A tocha entra como mais uma luz da lista em vez de ser tratada à parte
       dentro do passe: assim o passe de luz e o bloom leem a MESMA coisa e não
       há como um acender o que o outro não acende.
       O raio sai do que o jogador CARREGA, não do andar. Com o raio do andar o
       herói era uma lanterna acesa de graça, dia e noite, e não havia escuro
       nenhum para a tocha resolver. Sem fonte na mochila não entra luz aqui — o
       passe de luz continua rodando, só que ele então apenas escurece.
       Duas senóides incomensuráveis: tremor de chama que nunca fecha o ciclo. */
    const raio = luzCarregada();
    if (raio > 0) {
      const [px, py] = w2s(P.px, P.py);
      const tremor = 1 + Math.sin(G.now * .009) * .035 + Math.sin(G.now * .023) * .02;
      luzes.push({ x: px, y: py, cor: '#ffd696', a0: .95, a1: .4, tocha: 1, r: raio * t * tremor });
    }
    lightPass(amb);
  }
  bloomPass();
  // chuva por último: cai ENTRE a câmera e o mundo, então não leva o multiply da luz
  if (clima.chuva > 0 && !coberto) rainPass(clima.chuva);
  gradePass();
}

/* Moldura no tile sob o cursor. Entra entre os dois passes do andar, no mesmo
   ponto do sangue: por cima do chão inteiro e por baixo de tudo que tem volume,
   então nunca risca um sprite. Vermelha onde não dá para pisar — responde "por
   que ele não anda até lá?" antes de o jogador clicar e ouvir que não dá. */
function hoverTile(t) {
  if (!G.hover) return;
  const [hx, hy] = G.hover;
  const [sx, sy] = w2s(hx, hy);
  const pode = isWalkable(hx, hy, P.z);
  g2.strokeStyle = pode ? 'rgba(255,255,255,.55)' : 'rgba(255,90,90,.55)';
  g2.lineWidth = Math.max(1, CAM.scale);
  g2.strokeRect(sx - t / 2 + .5, sy - t / 2 + .5, t - 1, t - 1);
}

/* Sombra de nuvem no chão. A folha é ladrilhada em coordenada do MUNDO — sem
   isso ela grudaria na tela e as nuvens andariam junto com o jogador. O resto do
   deslocamento é o vento, e ele passa por cima de tudo (criatura inclusive):
   nuvem que só escurece o piso e ignora quem está em pé parece decalque. */
const VENTO = [.010, .004];
/* inclinação do mato, em cisalhamento: no topo de uma árvore de ~50px dá uns 2px
   de balanço. Mais que isso e ela derrete de lado em vez de balançar. */
const VENTO_INCL = .045;
/* Duas passadas da MESMA folha em escala e velocidade diferentes. Uma folha só,
   por maior que seja, repete visivelmente numa tela larga — dá para contar o
   ladrilho. Duas em batimento não fecham o ciclo dentro do campo de visão, e a
   diferença de velocidade ainda dá paralaxe: nuvem alta e nuvem baixa. */
function cloudPass(t, forca) {
  camadaNuvem(t, t * 16, 1, forca * .55);
  camadaNuvem(t, t * 9.7, 1.8, forca * .42);
}
function camadaNuvem(t, esc, vel, forca) {
  const cv = cloudTexture();
  const wrap = v => ((v % esc) + esc) % esc - esc;
  const ox = wrap(VW / 2 - camX * t + G.now * VENTO[0] * vel * CAM.scale);
  const oy = wrap(VH / 2 - camY * t + G.now * VENTO[1] * vel * CAM.scale);
  g2.globalCompositeOperation = 'multiply';
  g2.globalAlpha = forca;
  for (let y = oy; y < VH; y += esc) for (let x = ox; x < VW; x += esc) g2.drawImage(cv, x, y, esc, esc);
  g2.globalAlpha = 1;
  g2.globalCompositeOperation = 'source-over';
}

/* Chuva em espaço de tela. As gotas são sorteadas uma vez e recicladas pelo
   módulo do relógio: nada é alocado por quadro e não há estado para atualizar —
   a posição é função do tempo. `forca` só corta quantas entram, então a chuva
   engrossa e afina sozinha conforme o céu fecha. */
const CHUVA_N = 280;
const gotas = Array.from({ length: CHUVA_N }, () => ({ x: Math.random(), y: Math.random(), v: .7 + Math.random() * .6 }));
const CHUVA_INCL = .3;
function rainPass(forca) {
  const S = CAM.scale, n = Math.round(CHUVA_N * Math.min(1, forca));
  const alt = VH + 80, larg = VW + 260;      // H é a altura do mundo, não sombrear
  g2.strokeStyle = 'rgba(176,204,232,.55)';
  g2.lineWidth = Math.max(1, S * .55);
  g2.beginPath();
  for (let i = 0; i < n; i++) {
    const d = gotas[i];
    const y = ((d.y + G.now * .0011 * d.v) % 1) * alt - 40;
    const x = (d.x * larg + y * CHUVA_INCL) % larg - 130;
    const c = 15 * S * d.v;
    g2.moveTo(x, y); g2.lineTo(x - c * CHUVA_INCL, y + c);
  }
  g2.stroke();
}

/* Sol fixo no noroeste — a mesma diagonal do deslocamento por andar, então a
   sombra concorda com a perspectiva em vez de brigar com ela. A silhueta é
   inclinada para o leste e achatada; d negativo espelha na vertical, que é o que
   põe a cabeça na ponta da sombra, longe dos pés. */
const SOL_INCL = 0.38, SOL_ACHAT = 0.28;
function dropShadow(spr, px, py) {
  const s = silhouette(spr), S = CAM.scale * (spr.k || 1);   // k: sprite já em pixel de tela
  // contato primeiro: é ele que prende o boneco no chão, a projetada só dá direção
  const cw = s.width * S * .5, ch = cw * .4;
  g2.drawImage(contactShadow(), px - cw / 2, py - ch / 2, cw, ch);
  g2.save();
  g2.globalAlpha = .28;
  g2.transform(1, 0, -SOL_INCL, -SOL_ACHAT, px, py);
  g2.drawImage(s, -s.cx * S, -s.feet * S, s.width * S, s.height * S);
  g2.restore();
}

function drawFloor(z, x0, x1, y0, y1, t, bucket) {
  const S = CAM.scale, dz = (P.z - z) * t, deco = decoMaps[z];
  const meio = VW / 2 - t / 2, meioY = VH / 2 - t / 2;
  const telaX = x => Math.round((x - camX) * t - dz + meio);
  const telaY = y => Math.round((y - camY) * t - dz + meioY);
  const alto = (x, y) => TILE[tileAt(x, y, z)].top > 0.5;

  /* 1º passe: só o chão. Tem de sair inteiro antes de qualquer sombra — o tile
     do vizinho, desenhado depois, apagaria a sombra que cai em cima dele. */
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const tt = tileAt(x, y, z), def = TILE[tt];
    if (def.hide || def.top > 0.5) continue;
    const sx = telaX(x), sy = telaY(y);
    const cropX = ((x % 3) + 3) % 3 * TS, cropY = ((y % 3) + 3) % 3 * TS;
    const corre = def.tex === 'water' || def.tex === 'lava';
    if (corre) {
      // o recorte desce com o relógio: a água escorre em vez de só piscar
      const vel = def.tex === 'lava' ? .004 : .011;
      g2.drawImage(flowTexture(def.tex, def.c),
        cropX, cropY + (G.now * vel) % TEX_S, TS, TS, sx, sy, t, t);
      const k = Math.sin(G.now * 0.0018 + x * .7 + y * .5);
      g2.globalAlpha = def.tex === 'lava' ? .18 + k * .12 : .05 + k * .04;
      g2.fillStyle = def.tex === 'lava' ? '#ff8a2a' : '#cfe8ff';
      g2.fillRect(sx, sy, t, t); g2.globalAlpha = 1;
      if (def.tex === 'lava' && z === P.z)
        luzes.push({ x: sx + t / 2, y: sy + t / 2, r: t * 2.2, cor: '#ff8c32', a0: .8, a1: .3 });
    } else {
      g2.drawImage(tileTexture(def.tex || 'dirt', def.c), cropX, cropY, TS, TS, sx, sy, t, t);
    }
    tileBorders(x, y, z, def, sx, sy, t);
    if (tt === T.DOWN || tt === T.UP) g2.drawImage(stairSprite(tt === T.DOWN), sx, sy, t, t);
    // parede ao norte ou a oeste projeta no chão daqui: é a sombra dela e o contato
    if (alto(x, y - 1)) g2.drawImage(edgeShadow(0), sx, sy, t, t);
    if (alto(x - 1, y)) g2.drawImage(edgeShadow(1), sx, sy, t, t);
  }

  /* Sangue do chão entra entre os dois passes: depois do piso inteiro, para a
     mancha não ser apagada pelo tile vizinho, e antes dos volumes, para quem
     pisa nela passar por cima. Só o andar do jogador tem sangue desenhado. */
  /* Corpo entra aqui, e não no balde de entidades: sprite de bicho grande
     transborda o próprio tile, e no balde o corpo de um tile mais ao sul/leste
     era pintado DEPOIS do jogador e o cobria. Como chão, fica sempre atrás de
     bicho, boneco, parede e deco. */
  if (bucket) {
    drawBlood(z, t);
    const lim = VW / t + 3;
    for (const c of G.corpses)
      if (c.z === z && Math.abs(c.x - camX) <= lim && Math.abs(c.y - camY) <= lim)
        drawEntity({ k: 'corpo', c }, telaX(c.x), telaY(c.y), t);
    hoverTile(t);
  }

  /* 2º passe: o que tem volume, na ordem do pintor */
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const tt = tileAt(x, y, z), def = TILE[tt];
    if (def.hide && !bucket) continue;                    // buraco ainda pode ter alguém em cima
    const sx = telaX(x), sy = telaY(y);
    if (!def.hide) {
      if (def.top > 0.5) g2.drawImage(wallSprite(def.tex, def.c), sx, sy - WALL_TOP * S, t, WALL_H * S);
      const d = deco.get(y * W + x);
      if (d) {
        // 9 variantes por `x*7+y*13` repetiam em diagonal e a olho nu; 16 com as
        // duas coordenadas embaralhadas quebram o padrão sem inchar o cache
        const s = outlined(decoSprite(d.k, ((x * 92837111) ^ (y * 689287499)) >>> 28));
        const gx = sx + t / 2, gy = sy + t * CHAO;
        dropShadow(s, gx, gy);
        /* Vento: cisalhamento com o pivô no PÉ da planta — a mesma transform da
           sombra projetada. Assim a raiz fica pregada no chão e quem balança é a
           copa, que é como planta se mexe; inclinar o desenho inteiro faria a
           árvore deslizar de lado.
           A fase sai do TILE, não só do relógio: com a fase igual o bosque
           inteiro se inclina junto, que lê como cortina, não como vento.
           Pedra (k=1) não balança, arbusto (k=2) balança menos que árvore. */
        const balanco = d.k === 1 ? 0
          : Math.sin(G.now * .0016 + x * .9 + y * 1.7) * (d.k === 0 ? VENTO_INCL : VENTO_INCL * .5);
        g2.save();
        g2.transform(1, 0, balanco, 1, gx, gy);
        g2.drawImage(s, -s.cx * S, -s.feet * S, s.width * S, s.height * S);
        g2.restore();
      }
    }
    if (bucket) {
      const lista = bucket.get(y * W + x);
      if (lista) for (const it of lista) drawEntity(it, sx, sy, t);
    }
  }
}

/* Transição entre terrenos. Sem isto a grama encosta na areia numa reta de 90°,
   que é o que mais denuncia um mapa de tiles. Cada vizinho de prioridade maior
   pinta a própria textura na borda deste tile, recortada pela máscara daquele
   lado. O canto diagonal só entra quando nenhum dos dois ortogonais dele já
   cobriu aquela quina — senão sai mancha dobrada, mais escura que o resto.
   Parede e buraco ficam de fora: não são chão, quem cuida deles é o 2º passe. */
const NB8 = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
function tileBorders(x, y, z, def, sx, sy, t) {
  const p0 = TERRAIN_PRIO[def.tex] || 0;
  const praia = def.tex === 'water';
  let orto = 0;
  for (let m = 0; m < 8; m++) {
    if (m > 3 && (orto >> (m - 4) & 1 || orto >> ((m - 3) & 3) & 1)) continue;
    const nd = TILE[tileAt(x + NB8[m][0], y + NB8[m][1], z)];
    if (nd.hide || nd.top > 0.5) continue;
    if ((TERRAIN_PRIO[nd.tex] || 0) <= p0) continue;
    if (m < 4) orto |= 1 << m;
    g2.drawImage(borderSprite(nd.tex, nd.c, m), sx, sy, t, t);
    /* Espuma: só no tile de água e só nas ortogonais — a máscara de canto é
       radial e a faixa sairia curva, e o canto quase sempre já tem um dos dois
       lados ortogonais espumando do lado.
       O alfa pulsa por tile E por lado: fase igual faz a costa inteira piscar
       junta, que lê como cintilação de tela, não como arrebentação. */
    if (praia && m < 4) {
      g2.globalAlpha = .30 + Math.sin(G.now * .0026 + x * .8 + y * 1.1 + m) * .16;
      g2.drawImage(foamSprite(m), sx, sy, t, t);
      g2.globalAlpha = 1;
    }
  }
}

/* tudo que pisa no chão vai para o balde do seu tile: assim a criatura entra
   na ordem do pintor junto com o tile em que está, como no cliente.
   Quem está no meio do passo ocupa dois tiles ao mesmo tempo e tem de entrar no
   mais TARDIO dos dois — ancorar no destino faz o chão desenhado depois cobrir o
   boneco quando ele anda para o norte ou oeste. "Mais tardio" é só o maior índice
   linear, já que a varredura é y externo e x interno; e tem de ser um dos dois
   tiles de verdade: tirar o máximo de x e de y separadamente inventa o tile do
   canto no passo diagonal, e se o canto for parede o boneco passa por cima dela. */
function entityBucket() {
  const b = new Map();
  const add = (x, y, e) => { const k = y * W + x, l = b.get(k); l ? l.push(e) : b.set(k, [e]); };
  const andante = e => {
    let ax = e.x, ay = e.y;
    if (e.stepD) {
      const fx = Math.round(e.fx), fy = Math.round(e.fy);
      if (fy * W + fx > ay * W + ax) { ax = fx; ay = fy; }
    }
    add(ax, ay, { k: 'bicho', e, ax, ay });
  };
  for (const d of G.drops) if (d.z === P.z) add(d.x, d.y, { k: 'item', d });
  for (const m of G.mobs) if (m.z === P.z && m.hp > 0) andante(m);
  andante(P);
  return b;
}

const _num = c => typeof c === 'number' ? c : parseInt(String(c).replace('#', ''), 16);
function facingOf(e) {
  let dx, dy;
  if (e.stepD) { dx = e.x - e.fx; dy = e.y - e.fy; }
  else if (e === P) { const d = P.lastDir || [0, 1]; dx = d[0]; dy = d[1]; }
  else { dx = P.px - e.px; dy = P.py - e.py; }
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIR_E : DIR_W) : (dy >= 0 ? DIR_S : DIR_N);
}
/* o quadro do passo sai do progresso do passo, não do relógio: o boneco anda
   na velocidade em que se move de verdade */
const frameOf = e => e.stepD ? ((G.now - e.stepT) / e.stepD < .5 ? 1 : 2) : 0;

/* Um ponto só para o contorno: placa de nome, sombra e desenho leem daqui, então
   nenhum deles fica com âncora de um sprite e desenho de outro. */
const creatureSpriteFor = e => outlined(_criaturaCrua(e));
function _criaturaCrua(e) {
  if (e === P) {
    /* ranger sai da folha desenhada; enquanto o PNG não chega — ou se a vocação
       for outra — cai no boneco procedural, que é o que todo mundo usa */
    if (P.voc === 'ranger') { const s = rangerSprite(facingOf(P), frameOf(P), CAM.scale); if (s) return s; }
    const cor = _num(VOCATIONS[P.voc].color);
    const eq = it => it ? _num(itemStats(it).color) : null;
    return creatureSprite('biped', cor, 1, { skin: 0xe8c39e, weapon: eq(P.eq.weapon), shield: eq(P.eq.shield) },
      facingOf(P), frameOf(P));
  }
  /* criatura com arte própria sai da folha; enquanto o PNG não chega cai no
     procedural, como o ranger faz */
  if (e.def.sheet) {
    const s = creatureSheet(e.def.sheet, facingOf(e), frameOf(e), CAM.scale, e.def.sz);
    if (s) return s;
  }
  return creatureSprite(e.def.shape || 'biped', e.def.col, e.def.sz, e.def.o, facingOf(e), frameOf(e));
}

function drawEntity(it, sx, sy, t) {
  const S = CAM.scale;
  if (it.k === 'corpo') {
    g2.fillStyle = 'rgba(90,15,15,.55)';
    g2.beginPath(); g2.ellipse(sx + t / 2, sy + t * .62, t * .34, t * .2, 0, 0, 7); g2.fill();
    const c = it.c;
    if (!c.spr) return;
    /* A folha traz o bicho JÁ tombado, então este não gira: girar o desenho de
       quem está deitado o põe de lado no chão. */
    const morto = c.spr.sheet && outlined(creatureSheet(c.spr.sheet, CRIA_MORTO, 0, S, c.spr.size));
    if (morto) {
      const K = S * morto.k;
      g2.globalAlpha = .9;
      g2.drawImage(morto, sx + t / 2 - morto.cx * K, sy + t * .62 - morto.feet * K,
        morto.width * K, morto.height * K);
      g2.globalAlpha = 1;
      return;
    }
    const s = outlined(creatureSprite(c.spr.shape, c.spr.color, c.spr.size, c.spr.o, DIR_S, 0));
    g2.save();
    g2.translate(sx + t / 2, sy + t * .6); g2.rotate(Math.PI / 2); g2.globalAlpha = .8;
    g2.drawImage(s, -s.feet * S * .55, -s.cx * S, s.width * S, s.height * S);
    g2.restore(); g2.globalAlpha = 1;
    return;
  }
  if (it.k === 'item') {
    const cor = RARITY[it.d.it.r].color, ico = itemIcon((ITEMS[it.d.it.id] || 0).spr);
    g2.fillStyle = 'rgba(0,0,0,.4)';
    g2.beginPath(); g2.ellipse(sx + t / 2, sy + t * .74, t * .22, t * .1, 0, 0, 7); g2.fill();
    if (!ico) {                                    // PNG ainda carregando
      g2.fillStyle = cor; g2.fillRect(sx + t * .34, sy + t * .38, t * .32, t * .28);
      g2.strokeStyle = '#000'; g2.lineWidth = Math.max(1, S * .5);
      g2.strokeRect(sx + t * .34, sy + t * .38, t * .32, t * .28);
      return;
    }
    const d = t * .72, x = sx + (t - d) / 2, y = sy + t * .78 - d;
    if (it.d.it.r > 0) {                           // a cor da raridade era o quadrado; agora é o brilho
      const gr = g2.createRadialGradient(sx + t / 2, sy + t * .5, 0, sx + t / 2, sy + t * .5, t * .46);
      gr.addColorStop(0, cor); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g2.globalAlpha = .45; g2.fillStyle = gr;
      g2.fillRect(sx, sy, t, t); g2.globalAlpha = 1;
    }
    g2.drawImage(ico, x, y, d, d);
    return;
  }
  const e = it.e, spr = creatureSpriteFor(e);
  const ox = (e.px - it.ax) * t, oy = (e.py - it.ay) * t;   // deslocamento do passo, relativo à âncora
  /* Marca do alvo: mancha e cantoneiras, as duas no CHÃO, antes do bicho. As
     cantoneiras já foram desenhadas depois do sprite para não serem tapadas — só
     que aí viravam risco vermelho atravessando a criatura. No chão, o corpo tapa
     o pedaço de cima delas, e é assim que tem de ser: o marcador está embaixo. */
  if (G.target === e) {
    g2.fillStyle = 'rgba(255,68,68,.18)';
    g2.fillRect(sx + ox + 1, sy + oy + 1, t - 2, t - 2);
    g2.strokeStyle = '#ff5555'; g2.lineWidth = Math.max(2, S);
    const x0 = sx + ox + 1, y0 = sy + oy + 1, L = t - 2, c = L * .3;
    g2.beginPath();
    for (const [px, py, ex, ey] of [[0, 0, 1, 1], [L, 0, -1, 1], [0, L, 1, -1], [L, L, -1, -1]]) {
      g2.moveTo(x0 + px + ex * c, y0 + py);
      g2.lineTo(x0 + px, y0 + py); g2.lineTo(x0 + px, y0 + py + ey * c);
    }
    g2.stroke();
  }
  dropShadow(spr, sx + ox + t / 2, sy + oy + t * CHAO);
  // investida do ataque: o boneco avança na direção que está olhando
  const atk = atkPhase(e), dir = facingOf(e);
  const lunge = atk ? Math.sin(atk * Math.PI) * 5 * S : 0;
  const lx = dir === DIR_E ? lunge : dir === DIR_W ? -lunge : 0;
  const ly = dir === DIR_S ? lunge : dir === DIR_N ? -lunge : 0;
  // K é a escala do próprio sprite; o passo e a investida continuam em S, que é a do mundo
  const K = S * (spr.k || 1);
  /* Respiração: a ALTURA oscila em torno do pé, a posição do corpo não. Subir o
     sprite inteiro descolaria o boneco do chão e da própria sombra de contato —
     vira flutuação, não respiro. Escalando só o y a partir da âncora dos pés, o
     pé fica pregado e quem sobe é o peito.
     A fase vem do uid, senão o mapa inteiro respira em uníssono, que é pior que
     não respirar. E quem está no meio do passo não respira: o quadro de
     caminhada já levanta o corpo, as duas coisas juntas viram tremelique. */
  const Ky = K * (1 + (e.stepD ? 0 : Math.sin(G.now * .0027 + (e.uid || 0) * 1.7) * RESPIRO));
  const dx = sx + ox + lx + t / 2 - spr.cx * K, dy = sy + oy + ly + t * CHAO - spr.feet * Ky,
        dw = spr.width * K, dh = spr.height * Ky;
  g2.drawImage(spr, dx, dy, dw, dh);
  /* Clarão do acerto: o MESMO sprite por cima, achatado em branco. brightness(0)
     zera a cor e mantém o alfa, invert(1) leva o preto ao branco — sai a
     silhueta exata sem máscara nem canvas extra. Some em ~90ms; o filtro só
     entra em quem acabou de apanhar, então não pesa no quadro. */
  const fk = e.hitT ? 1 - (G.now - e.hitT) / 90 : 0;
  if (fk > 0) {
    g2.save();
    g2.globalAlpha = Math.min(1, fk) * .85; g2.filter = 'brightness(0) invert(1)';
    g2.drawImage(spr, dx, dy, dw, dh);
    g2.restore();
  }
}

/* Manchas de chão. Escurecem e encolhem devagar: o alfa cai com o quadrado do
   tempo, então fica quase parado a maior parte da vida e some no fim, em vez de
   apagar linearmente e parecer piscar. Fora de vista nem entra no laço — são até
   SANGUE_MAX manchas de ~6 elipses cada. */
function drawBlood(z, t) {
  const lim = VW / t + 3;
  for (const b of G.blood) {
    if (b.z !== z) continue;
    if (Math.abs(b.x - camX) > lim || Math.abs(b.y - camY) > lim) continue;
    const k = (G.now - b.t) / b.dur, [cx, cy] = w2s(b.x, b.y);
    // multiply em vez de source-over: mancha tinge o chão, tinta cobre. Com
    // source-over as poças saíam chapadas por cima da textura, como adesivo.
    g2.globalCompositeOperation = 'multiply';
    g2.globalAlpha = Math.max(0, .85 * (1 - k * k));
    g2.fillStyle = b.cor;
    for (const m of b.manchas) {
      g2.beginPath();
      g2.ellipse(cx + m.dx * t, cy + m.dy * t, m.rx * t, m.ry * t, 0, 0, 7);
      g2.fill();
    }
  }
  g2.globalAlpha = 1;
  g2.globalCompositeOperation = 'source-over';
}

function drawEffects(t) {
  const S = CAM.scale;
  /* Gotas do esguicho: saem do centro, desaceleram e caem. A queda é o seno do
     progresso, o mesmo truque do projétil — sobe e desce sem guardar velocidade.
     Caco de osso é quadrado e não desacelera; sangue é redondo e freia. */
  for (const f of G.fx) {
    if (f.kind !== 'blood') continue;
    const k = (G.now - f.t) / f.dur, [x, y] = w2s(f.x, f.y);
    g2.globalAlpha = Math.max(0, 1 - k * k);
    g2.fillStyle = f.color;
    for (const g of f.gotas) {
      const avanco = f.seco ? k : 1 - (1 - k) * (1 - k);          // osso voa reto, sangue freia
      const d = g.v * avanco * t * .55;
      const gx = x + Math.cos(g.a) * d, gy = y + Math.sin(g.a) * d * .6 + Math.sin(Math.PI * k) * -5 * S;
      const r = g.r * S * (1 - k * .4);
      if (f.seco) g2.fillRect(gx - r / 2, gy - r / 2, r, r);
      else { g2.beginPath(); g2.arc(gx, gy, r, 0, 7); g2.fill(); }
    }
  }
  g2.globalAlpha = 1;
  /* Impacto, na altura do peito e não no chão: é ali que o golpe acerta.
     Sangue sai, freia e cai; faísca sai reta e apaga; fumaça sobe e abre. */
  for (const f of G.fx) {
    if (f.kind !== 'impacto') continue;
    const k = (G.now - f.t) / f.dur;
    if (k >= 1) continue;
    const [x0, y0] = w2s(f.x, f.y), y = y0 - t * .35;
    /* Desenho vindo da tabela de elementos: `forma` diz o que é a partícula e
       `grav` para onde ela vai (-1 sobe, +1 cai). Sem isto fogo, gelo, terra e
       sagrado eram o mesmo leque de riscos, só que de outra cor. */
    if (f.forma && f.forma !== 'raio') {
      const quadrado = f.forma === 'caco' || f.forma === 'torrao';
      const pesado = f.forma === 'torrao';
      g2.fillStyle = f.color;
      for (const g of f.p) {
        // torrão sai devagar e para; brasa e faísca saem e continuam subindo
        const av = pesado ? 1 - (1 - k) * (1 - k) : k;
        const d = g.v * av * (pesado ? 13 : 17) * S;
        const gx = x0 + Math.cos(g.a) * d;
        const gy = y + Math.sin(g.a) * d * .6 + f.grav * k * k * 11 * S;
        const r = g.r * S * (1 - k * .35);
        g2.globalAlpha = Math.max(0, 1 - k * k);
        if (f.forma === 'fumaca') {                        // abre e desbota, não voa
          g2.globalAlpha = Math.max(0, .5 * (1 - k));
          g2.beginPath(); g2.arc(gx, gy, r * (1 + k * 2), 0, 7); g2.fill();
        } else if (quadrado) { g2.fillRect(gx - r / 2, gy - r / 2, r, r); }
        else { g2.beginPath(); g2.arc(gx, gy, r, 0, 7); g2.fill(); }
      }
      g2.globalAlpha = 1;
      // só quem tem luz na tabela acende: terra e físico não clareiam o chão
      if (f.luz > 0)
        luzes.push({ x: x0, y, r: t * 1.1 * f.luz, cor: f.color, a0: .7 * (1 - k) * f.luz, a1: .2 * (1 - k) });
    } else if (f.tipo === 'magico') {
      g2.strokeStyle = f.color; g2.lineWidth = Math.max(1, S * .6);
      g2.globalAlpha = Math.max(0, 1 - k);
      g2.beginPath();
      for (const g of f.p) {
        const d0 = g.v * k * 26 * S, d1 = d0 + g.r * 3.5 * S;
        const cx = Math.cos(g.a), cy = Math.sin(g.a) * .7;
        g2.moveTo(x0 + cx * d0, y + cy * d0); g2.lineTo(x0 + cx * d1, y + cy * d1);
      }
      g2.stroke();
      if (f.luz > 0)
        luzes.push({ x: x0, y, r: t * 1.3 * f.luz, cor: f.color, a0: .8 * (1 - k), a1: .25 * (1 - k) });
    } else if (f.tipo === 'erro') {
      g2.fillStyle = '#c9ccd2';
      for (const g of f.p) {
        const d = g.v * k * 11 * S;
        g2.globalAlpha = Math.max(0, .32 * (1 - k));
        g2.beginPath();
        g2.arc(x0 + Math.cos(g.a) * d, y + Math.sin(g.a) * d * .5 - k * 13 * S, (1.6 + g.r + k * 5) * S, 0, 7);
        g2.fill();
      }
    } else {
      g2.fillStyle = f.color; g2.globalAlpha = Math.max(0, 1 - k * k);
      for (const g of f.p) {
        const av = 1 - (1 - k) * (1 - k);                    // sai rápido e freia
        const d = g.v * av * 17 * S;
        const gx = x0 + Math.cos(g.a) * d;
        const gy = y + Math.sin(g.a) * d * .6 + k * k * 9 * S;   // e cai no fim
        const r = g.r * S * (1 - k * .35);
        g2.beginPath(); g2.arc(gx, gy, r, 0, 7); g2.fill();
      }
    }
  }
  g2.globalAlpha = 1;
  for (const f of G.fx) {
    if (f.kind !== 'burst') continue;
    const k = (G.now - f.t) / f.dur, [x, y] = w2s(f.x, f.y);
    g2.globalAlpha = Math.max(0, .8 * (1 - k));
    g2.fillStyle = f.color;
    g2.beginPath(); g2.arc(x, y, (5 + k * 12) * f.scale * S, 0, 7); g2.fill();
    // a explosão ilumina num raio bem maior que o próprio desenho — mas só a de
    // quem tem luz na tabela: torrão e flecha estouram sem acender nada
    if (f.luz > 0)
      luzes.push({ x, y, r: t * 2.4 * f.scale * f.luz * (1 - k * .5), cor: f.color,
        a0: .85 * f.luz * (1 - k), a1: .3 * (1 - k) });
  }
  g2.globalAlpha = 1;
  for (const p of G.proj) {
    const k = (G.now - p.t) / p.dur;
    const [x, y] = w2s(p.x0 + (p.x1 - p.x0) * k, p.y0 + (p.y1 - p.y0) * k);
    const yy = y - Math.sin(Math.PI * k) * 9 * S;
    g2.fillStyle = p.color;
    g2.beginPath(); g2.arc(x, yy, 2.6 * S, 0, 7); g2.fill();
    // flecha e torrão não acendem o caminho; bola de fogo e raio, sim
    const luz = p.el ? (ELEM[p.el] || 0).luz : 1;
    if (luz > 0) luzes.push({ x, y: yy, r: t * 1.3 * luz, cor: p.color, a0: .7 * luz, a1: .25 });
  }
}

/* Segundo passe, como no cliente: pinta a luz num buffer (ambiente + halos) e
   multiplica sobre a cena. Céu aberto não passa por aqui. */
let lightCv = null;
function halo(ctx, x, y, r, cor, a0, a1) {
  const n = _num(cor);
  if (!(r > 0) || !(n >= 0)) return;              // cor estranha não derruba o quadro
  const c = `${n >> 16 & 255},${n >> 8 & 255},${n & 255}`;
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${c},${a0})`);
  gr.addColorStop(.5, `rgba(${c},${a1})`);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
}
function lightPass(amb) {
  if (!lightCv) lightCv = document.createElement('canvas');
  if (lightCv.width !== VW || lightCv.height !== VH) { lightCv.width = VW; lightCv.height = VH; }
  const lg = lightCv.getContext('2d');
  lg.globalCompositeOperation = 'source-over';
  lg.fillStyle = amb.amb; lg.fillRect(0, 0, VW, VH);
  lg.globalCompositeOperation = 'lighter';
  for (const l of luzes) halo(lg, l.x, l.y, l.r, l.cor, l.a0, l.a1);
  g2.globalCompositeOperation = 'multiply';
  g2.drawImage(lightCv, 0, 0);
  g2.globalCompositeOperation = 'source-over';
}

/* Bloom: os mesmos halos SOMADOS na cena, mais largos e bem mais fracos. O passe
   de luz só modula o que já está pintado, então a lava não clareia nada em volta
   — luz que não vaza lê como decalque. Somar por cima é o que faz vazar.
   Fora do buffer de luz de propósito: assim vale também de dia, quando o passe
   de luz nem é chamado e uma bola de fogo continua tendo de brilhar.

   A TOCHA não entra. Somar não tem teto — diferente do passe de luz, que só
   modula e por isso nunca passa do brilho da própria textura. O halo da tocha
   tem 7 tiles de raio e cobria a tela inteira: a caverna vinha 3× mais clara e o
   escuro do subsolo, que é o ponto dele, ia embora. Ela já aparece no passe de
   luz; quem precisa vazar é o que EMITE (lava, magia, projétil, estouro).
   ponytail: mesmo sem a tocha, um campo de lava soma um halo POR TILE e satura
   se forem muitos. Os dois números abaixo seguram na prática. Se um dia saturar,
   o conserto é pintar o bloom num buffer com `lighter` e trazer para a cena com
   alfa fixo — aí o teto é do buffer, não da soma. */
const BLOOM_R = 1.45, BLOOM_A = .12;
function bloomPass() {
  g2.globalCompositeOperation = 'lighter';
  for (const l of luzes)
    if (!l.tocha) halo(g2, l.x, l.y, l.r * BLOOM_R, l.cor, l.a0 * BLOOM_A, l.a1 * BLOOM_A * .6);
  g2.globalCompositeOperation = 'source-over';
}

/* Vinheta e tinte, o último passe de todos: é lente, não mundo — por isso vem
   depois até da chuva.
   O tinte existe porque o passe de luz desiste no meio-dia pleno (multiplicar a
   cena por branco é trabalho à toa) e é justamente ali que o quadro fica lavado.
   Entra em soft-light e com a cor do céu normalizada para meio-tom: soft-light
   com cinza médio é identidade, então o que sobra é só a INCLINAÇÃO de cor do
   céu. Sem normalizar, o branco do meio-dia clareava ainda mais — o contrário do
   que se quer. Andar com luz própria não leva tinte: o passe de luz já pinta a
   caverna inteira de azul, tingir de novo só empasta.
   A vinheta é chapa pronta em canvas pelo mesmo motivo do contactShadow: um
   CanvasGradient de tela cheia por quadro seria lixo à toa. */
let vinCv = null;
const GRADE_A = .30, VINHETA_A = .38;
function gradePass() {
  if (!FLOOR_AMBIENCE[P.z].amb) {
    const [r, g, b] = corDoCeu(horaDoDia());
    const f = 128 / Math.max(1, r * .3 + g * .6 + b * .1);
    g2.globalCompositeOperation = 'soft-light';
    g2.globalAlpha = GRADE_A;
    g2.fillStyle = `rgb(${Math.min(255, r * f) | 0},${Math.min(255, g * f) | 0},${Math.min(255, b * f) | 0})`;
    g2.fillRect(0, 0, VW, VH);
    g2.globalAlpha = 1;
    g2.globalCompositeOperation = 'source-over';
  }
  if (!vinCv || vinCv.width !== VW || vinCv.height !== VH) {
    vinCv = vinCv || document.createElement('canvas');
    vinCv.width = VW; vinCv.height = VH;
    const vg = vinCv.getContext('2d'), rad = Math.hypot(VW, VH) / 2;
    const gr = vg.createRadialGradient(VW / 2, VH / 2, rad * .55, VW / 2, VH / 2, rad);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, `rgba(0,0,0,${VINHETA_A})`);
    vg.fillStyle = gr; vg.fillRect(0, 0, VW, VH);
  }
  g2.drawImage(vinCv, 0, 0);
}

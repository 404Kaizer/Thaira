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
/* Meia-largura da tela em tiles. A IA usa isto para decidir a que distância a
   criatura percebe o jogador: o raio era fixo em 8 e a tela mostra 8,2, então
   bicho na borda aparecia e ficava parado olhando. Como o zoom é fracionário e
   o jogador pode mexer nele, o número tem de sair da viewport, não de uma
   constante — só assim a promessa "ela te vê um pouco antes de você ver ela"
   continua valendo em qualquer zoom. */
const raioVista = () => Math.ceil(VW / 2 / tpx());
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
  // câmera SEM tremor: com camX o clique seguia a sacudida e caía no tile errado
  return [Math.round(P.px + (sx - VW / 2) / t), Math.round(P.py + (sy - VH / 2) / t)];
}
/* ------------------------------------------------------------- caches */
/* O cache de `deco` saiu daqui: quem indexa objeto por tile agora é o
   `reindexObjs` do world.js, e ter um segundo índice no render era a mesma
   estrutura mantida em dois lugares — o editor mexe na lista e só um dos dois
   saberia. Sobra o `floorVoid`, que é sobre o terreno. */
let floorVoid = null, cacheSeed = -1;
function worldCaches() {
  if (cacheSeed === WORLD.seed && floorVoid) return;
  cacheSeed = WORLD.seed; floorVoid = [];
  for (let z = 0; z < FLOORS; z++) {
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
/* Chama: cor e tremor num lugar só, porque a tocha na mão e a tocha largada no
   chão têm de ser a MESMA luz. Laranja-âmbar, não branco-quente — o halo pálido
   lia como lanterna. Duas senóides incomensuráveis: o tremor nunca fecha ciclo. */
const CHAMA_COR = '#ffb14a';
/* Luz mágica. Branco puxado para o azul frio, no oposto do âmbar da chama: a
   magia de luz e a tocha davam halos idênticos, e o jogador não tinha como ver
   que a tocha tinha apagado e o que restava era a magia. Cor é a única pista
   barata aqui — o halo não tem forma nem ícone próprios. */
const MAGIA_LUZ_COR = '#cfe4ff';
const chamaTremor = () => 1 + Math.sin(G.now * .009) * .035 + Math.sin(G.now * .023) * .02;
/* Força da chama = escuro da hora: de dia o halo quase não aparece, de noite vai
   ao cheio. Guardado do quadro porque a tocha do CHÃO é desenhada lá dentro do
   passe das entidades, longe do `amb`. Subsolo não tem hora: escuro total. */
let chamaF = 1;
/* Força da fonte que projeta sombra no quadro (sol/lua/tocha). Vem de
   `climaAgora().luz`, é lida por quem desenha sombra projetada e vale para o
   quadro inteiro — sombra por boneco recalculando a hora seria a mesma conta N
   vezes, e bastaria uma divergir para o mapa ter dois sóis. */
let solF = 1;
/* Vento do quadro, 0..1. Mesmo motivo do solF: mato, chuva e nuvem têm de
   concordar. Com cada um lendo o próprio relógio, a copa balançava para um lado
   e a chuva caía para o outro no mesmo temporal. */
let ventoF = .25;
/* Quanto de poça desenhar no quadro, já com as ressalvas aplicadas (0 debaixo de
   teto ou com o chão seco). Vem pronto porque quem consome está lá dentro do
   drawFloor, que não vê o clima — passar por parâmetro obrigaria a furar a
   assinatura de drawFloor por causa de um efeito só. */
let pocaF = 0;

function drawWorld() {
  if (!g2) return;
  worldCaches();
  const t = tpx(), amb = ambienteAgora(P.z);
  camX = P.px; camY = P.py;
  /* Tremor: desloca a CÂMERA, não os sprites — assim chão, bicho e efeito
     sacodem juntos e nada desalinha. Em tiles porque camX é em tiles; a
     amplitude vem em pixel de tela, então divide pelo tamanho do tile.
     Lê G.real, não G.now: durante o hitstop o mundo para e a câmera continua
     sacudindo — é a sacudida que dá o peso do golpe. Com o relógio do jogo a
     câmera congelava deslocada e a pausa lia como travamento. */
  const ab = G.abalo;
  if (ab) {
    const k = 1 - (G.real - ab.t) / ab.dur;
    if (k <= 0) G.abalo = null;
    else {
      /* Oscilação por seno, não por sorteio: sorteio muda a cada chamada de
         drawWorld e a placa de nome — que lê camX depois — sairia num ponto
         diferente do corpo. Duas frequências primas entre si para o tremor não
         virar uma linha na diagonal. */
      const a = ab.amp * k * CAM.scale / t;
      camX += Math.sin(G.real * .091) * a; camY += Math.cos(G.real * .117) * a;
    }
  }
  g2.imageSmoothingEnabled = false;
  g2.fillStyle = amb.bg; g2.fillRect(0, 0, VW, VH);
  chamaF = amb.escuro == null ? 1 : amb.escuro;
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
  // clima antes do chão: quem desenha sombra projetada lê `solF`, e depois do
  // laço ele valeria para o quadro seguinte — a sombra chegaria atrasada à noite
  const clima = climaAgora(P.z);
  solF = clima.luz; ventoF = clima.vento;
  pocaF = coberto || clima.molhado < .04 ? 0 : clima.molhado;
  for (const z of zs) drawFloor(z, cx - cols, cx + cols, cy - rows, cy + rows, t, z === P.z ? bucket : null);
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
    const lz = luzCarregada();
    if (lz.r > 0) {
      const [px, py] = w2s(P.px, P.py);
      /* Luz mágica não tremula: o tremor é o que diz "isso é fogo". Uma chama
         parada parece bug e um encantamento piscando parece chama. */
      luzes.push({ x: px, y: py, cor: lz.magica ? MAGIA_LUZ_COR : CHAMA_COR,
        a0: .95 * chamaF, a1: .4 * chamaF, tocha: 1,
        r: lz.r * t * .85 * (lz.magica ? 1 : chamaTremor()) });
    }
    lightPass(amb);
  }
  bloomPass();
  /* Relâmpago e chuva por último: caem ENTRE a câmera e o mundo, então não levam
     o multiply do passe de luz. O clarão vem depois do bloom de propósito — ele
     é luz do céu chegando na cena inteira, não brilho de um objeto dela. */
  if (clima.raio > 0 && !coberto) {
    g2.globalCompositeOperation = 'lighter';
    g2.fillStyle = `rgba(150,172,214,${(clima.raio * .34).toFixed(3)})`;
    g2.fillRect(0, 0, VW, VH);
    g2.globalCompositeOperation = 'source-over';
  }
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
/* Duas passadas, folha PRÓPRIA em cada uma, em escala e velocidade diferentes.
   Uma folha só, por maior que seja, repete visivelmente numa tela larga — dá
   para contar o ladrilho. Duas em batimento não fecham o ciclo dentro do campo
   de visão; com sementes diferentes elas também não compartilham contorno, então
   nem o recorte denuncia a repetição. A diferença de velocidade ainda dá
   paralaxe: nuvem alta e nuvem baixa. */
function cloudPass(t, forca) {
  camadaNuvem(t, t * 16, 1, forca * .85, 0xc10d5);
  camadaNuvem(t, t * 9.7, 1.8, forca * .65, 0x51ee7);
}
function camadaNuvem(t, esc, vel, forca, semente) {
  const cv = cloudTexture(semente);
  const wrap = v => ((v % esc) + esc) % esc - esc;
  const v = vel * (.4 + ventoF * 1.6);          // calmaria arrasta, temporal corre
  const ox = wrap(VW / 2 - camX * t + G.now * VENTO[0] * v * CAM.scale);
  const oy = wrap(VH / 2 - camY * t + G.now * VENTO[1] * v * CAM.scale);
  g2.globalCompositeOperation = 'multiply';
  g2.globalAlpha = forca;
  for (let y = oy; y < VH; y += esc) for (let x = ox; x < VW; x += esc) g2.drawImage(cv, x, y, esc, esc);
  g2.globalAlpha = 1;
  g2.globalCompositeOperation = 'source-over';
}

/* Poça. Duas passadas da MESMA máscara: a primeira escurece o chão encharcado
   (multiply), a segunda devolve o lustro por cima (lighter, preso ao `solF` —
   poça só brilha se há luz para refletir). Só o lustro faria decalque brilhante;
   só o escuro faria mancha de óleo. Sem deriva, ao contrário da nuvem: água
   parada fica parada, e é isso que separa uma coisa da outra na tela.
   ponytail: o lustro é branco, não a cor do céu. Tingir exigiria uma cópia da
   máscara por tom de céu; se a poça branca destoar no poente, cachear a máscara
   tingida com a cor quantizada em ~16 passos e trocar só quando ela virar. */
function poolPass(t, molhado) {
  /* Recorte antes de tudo: poça só em chão PLANO. Sem ele a lâmina passava por
     cima do mar, da lava e do topo das paredes — não se forma poça dentro do
     oceano. `top === 0` é a mesma marca da tabela que já separa piso de líquido
     (água, lava e brejo são negativos) e de parede (positivos), então não há uma
     segunda lista de tiles molháveis para divergir da primeira. */
  const cols = Math.ceil(VW / t / 2) + 2, rows = Math.ceil(VH / t / 2) + 3;
  const cx = Math.floor(camX), cy = Math.floor(camY);
  const meio = VW / 2 - t / 2, meioY = VH / 2 - t / 2;
  const chao = new Path2D();
  let algum = false;
  for (let y = cy - rows; y <= cy + rows; y++) for (let x = cx - cols; x <= cx + cols; x++) {
    const tt = tileAt(x, y, P.z);
    if (tt === T.VOID || TILE[tt].top !== 0) continue;
    // +1 no tamanho: sem a sobreposição sai um fio de piso seco entre os tiles
    chao.rect(Math.round((x - camX) * t + meio), Math.round((y - camY) * t + meioY), t + 1, t + 1);
    algum = true;
  }
  if (!algum) return;

  const { luz, escuro } = poolTexture(), esc = t * 4.5;
  const wrap = v => ((v % esc) + esc) % esc - esc;
  const ox = wrap(VW / 2 - camX * t), oy = wrap(VH / 2 - camY * t);
  const ladrilha = cv => {
    for (let y = oy; y < VH; y += esc) for (let x = ox; x < VW; x += esc) g2.drawImage(cv, x, y, esc, esc);
  };
  g2.save();
  g2.clip(chao);
  /* O LUSTRO é o que diz "isso é água"; o escuro sozinho diz "isso é mancha".
     Por isso o brilho pesa quase tanto quanto o escurecimento, e nunca zera: de
     noite ele cai, mas alguma coisa a poça sempre reflete — chão molhado é a
     única superfície da cena que devolve luz num mundo sem sol. */
  g2.globalCompositeOperation = 'multiply';
  g2.globalAlpha = molhado * .34; ladrilha(escuro);
  g2.globalCompositeOperation = 'lighter';
  g2.globalAlpha = molhado * .2 * (.35 + solF * .65); ladrilha(luz);
  g2.globalAlpha = 1;
  g2.globalCompositeOperation = 'source-over';
  g2.restore();
}

/* Chuva em espaço de tela. As gotas são sorteadas uma vez e recicladas pelo
   módulo do relógio: nada é alocado por quadro e não há estado para atualizar —
   a posição é função do tempo. `forca` só corta quantas entram, então a chuva
   engrossa e afina sozinha conforme o céu fecha. */
const CHUVA_N = 280;
const gotas = Array.from({ length: CHUVA_N }, () => ({ x: Math.random(), y: Math.random(), v: .7 + Math.random() * .6 }));
/* inclinação MÁXIMA: no vento cheio a gota cai quase 45°. Em calmaria ela cai
   quase reta — é a inclinação, mais que a quantidade, que faz a chuva parecer
   forte, e ela agora sai do mesmo vento que dobra o mato. */
const CHUVA_INCL = .55;
function rainPass(forca) {
  const S = CAM.scale, n = Math.round(CHUVA_N * Math.min(1, forca));
  const incl = CHUVA_INCL * ventoF;
  const alt = VH + 80, larg = VW + 260;      // H é a altura do mundo, não sombrear
  g2.strokeStyle = 'rgba(176,204,232,.55)';
  g2.lineWidth = Math.max(1, S * .55);
  g2.beginPath();
  for (let i = 0; i < n; i++) {
    const d = gotas[i];
    const y = ((d.y + G.now * .0011 * d.v) % 1) * alt - 40;
    const x = (d.x * larg + y * incl) % larg - 130;
    const c = 15 * S * d.v;
    g2.moveTo(x, y); g2.lineTo(x - c * incl, y + c);
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
  g2.globalAlpha = .28 * solF;
  g2.transform(1, 0, -SOL_INCL, -SOL_ACHAT, px, py);
  g2.drawImage(s, -s.cx * S, -s.feet * S, s.width * S, s.height * S);
  g2.restore();
}

function drawFloor(z, x0, x1, y0, y1, t, bucket) {
  const S = CAM.scale, dz = (P.z - z) * t;
  const meio = VW / 2 - t / 2, meioY = VH / 2 - t / 2;
  const telaX = x => Math.round((x - camX) * t - dz + meio);
  const telaY = y => Math.round((y - camY) * t - dz + meioY);
  /* "É alto?" passou a perguntar às DUAS camadas — a parede virou objeto, e a
     sombra de contato que ela projeta no chão do vizinho é desenhada aqui. Só o
     terreno, isto responderia "não" para toda parede do jogo e as paredes
     passariam a flutuar sem sombra nenhuma. */
  const alto = (x, y) => TILE[tileAt(x, y, z)].top > 0.5 || objsAt(x, y, z).some(objTapaVista);
  /* A largura de um tile na tela é a DISTÂNCIA ATÉ O VIZINHO, e não `t`.
     Parece a mesma coisa e não é quando `t` é fracionário: a posição de cada
     tile é arredondada (senão o pixel treme ao rolar a câmera) e a largura era
     `t` cheio, então a cada 1/frac(t) tiles a conta deixava UM PIXEL DE FRESTA e
     o fundo escuro aparecia por baixo. O efeito é uma grade que não existe,
     riscando mapa e oceano por igual.
     Nunca apareceu no jogo porque lá o zoom é 2 e o tile mede 64 px inteiros; o
     editor, que mostra o mapa afastado, caiu nela na primeira olhada — medido a
     2,2 px por tile: fração 0,2, uma linha escura a cada 5 tiles, exatamente o
     que a conta prevê. Tirando a diferença dos dois cantos arredondados, tile
     vizinho encosta em tile vizinho em qualquer zoom. */
  const largT = x => telaX(x + 1) - telaX(x);
  const altT = y => telaY(y + 1) - telaY(y);

  /* 1º passe: só o chão. Tem de sair inteiro antes de qualquer sombra — o tile
     do vizinho, desenhado depois, apagaria a sombra que cai em cima dele. */
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const tt = tileAt(x, y, z), def = TILE[tt];
    if (def.hide || def.top > 0.5) continue;
    const sx = telaX(x), sy = telaY(y), tw = largT(x), th = altT(y);
    const cropX = ((x % 3) + 3) % 3 * TS, cropY = ((y % 3) + 3) % 3 * TS;
    const corre = def.tex === 'water' || def.tex === 'lava';
    if (corre) {
      // o recorte desce com o relógio: a água escorre em vez de só piscar
      const vel = def.tex === 'lava' ? .004 : .011;
      g2.drawImage(flowTexture(def.tex, def.c),
        cropX, cropY + (G.now * vel) % TEX_S, TS, TS, sx, sy, tw, th);
      const k = Math.sin(G.now * 0.0018 + x * .7 + y * .5);
      g2.globalAlpha = def.tex === 'lava' ? .18 + k * .12 : .05 + k * .04;
      g2.fillStyle = def.tex === 'lava' ? '#ff8a2a' : '#cfe8ff';
      g2.fillRect(sx, sy, tw, th); g2.globalAlpha = 1;
      if (def.tex === 'lava' && z === P.z)
        luzes.push({ x: sx + t / 2, y: sy + t / 2, r: t * 2.2, cor: '#ff8c32', a0: .8, a1: .3 });
    } else {
      /* A porta saiu daqui: ela deixou de ser tile e virou objeto, então quem
         a desenha é o laço de objetos do 2º passe, com a textura escolhida pelo
         `aberta` da INSTÂNCIA. O 1º passe voltou a fazer uma coisa só —
         perguntar ao tile qual é a textura do chão. */
      g2.drawImage(tileTexture(def.tex || 'dirt', def.c), cropX, cropY, TS, TS, sx, sy, tw, th);
    }
    tileBorders(x, y, z, def, sx, sy, t, tw, th);
    if (tt === T.DOWN || tt === T.UP) g2.drawImage(stairSprite(tt === T.DOWN), sx, sy, tw, th);
    // parede ao norte ou a oeste projeta no chão daqui: é a sombra dela e o contato
    if (alto(x, y - 1)) g2.drawImage(edgeShadow(0), sx, sy, tw, th);
    if (alto(x - 1, y)) g2.drawImage(edgeShadow(1), sx, sy, tw, th);
  }

  /* Sangue do chão entra entre os dois passes: depois do piso inteiro, para a
     mancha não ser apagada pelo tile vizinho, e antes dos volumes, para quem
     pisa nela passar por cima. Só o andar do jogador tem sangue desenhado. */
  /* Corpo entra aqui, e não no balde de entidades: sprite de bicho grande
     transborda o próprio tile, e no balde o corpo de um tile mais ao sul/leste
     era pintado DEPOIS do jogador e o cobria. Como chão, fica sempre atrás de
     bicho, boneco, parede e deco. */
  if (bucket) {
    /* Marca de POI: decalque de chão, só acima da poça — sangue e corpo passam
       por cima dela, como qualquer coisa que caia ali depois.
       Laço sobre os 39 pontos, não sobre os tiles visíveis: `poiAt` varre a
       lista inteira e chamá-lo por tile faria a mesma busca centenas de vezes
       por quadro para achar meia dúzia de marcas. */
    /* Poça abaixo de tudo: é o chão molhado, não algo caído nele. Marca de POI,
       sangue, corpo e boneco passam por cima. Estava no laço de fora, junto da
       sombra de nuvem, e de lá pintava por cima do jogador — nuvem passa por
       cima de quem está em pé de propósito, água parada no chão não. */
    if (pocaF > 0) poolPass(t, pocaF);
    const limP = VW / t + 3;
    for (const p of WORLD.pois)
      if (p.z === z && Math.abs(p.x - camX) <= limP && Math.abs(p.y - camY) <= limP)
        g2.drawImage(poiSprite(p.id, !!(P.seen && P.seen['poi' + p.uid])),
          telaX(p.x), telaY(p.y), t, t);
    drawBlood(z, t);
    // gelo e energia são chão tratado: ficam sob os pés, aqui mesmo. Sem
    // entidades no andar (bucket nulo) todo campo sai aqui, que dá no mesmo.
    drawCampos(z, t, c => !bucket || !CAMPO_ACIMA[c.el]);
    /* Antes do corpo, pela mesma regra do marcador de alvo: quadro no chão é
       marca do TILE, não do que está em cima dele — desenhado por último ele
       riscava o cadáver ao meio. */
    hoverTile(t);
    const lim = VW / t + 3;
    for (const c of G.corpses)
      if (c.z === z && Math.abs(c.x - camX) <= lim && Math.abs(c.y - camY) <= lim)
        drawEntity({ k: 'corpo', c }, telaX(c.x), telaY(c.y), t);
  }

  /* 2º passe: o que tem volume, na ordem do pintor */
  for (let y = y0; y <= y1; y++) { for (let x = x0; x <= x1; x++) {
    const tt = tileAt(x, y, z), def = TILE[tt];
    if (def.hide && !bucket) continue;                    // buraco ainda pode ter alguém em cima
    const sx = telaX(x), sy = telaY(y), tw = largT(x), th = altT(y);
    if (!def.hide) {
      /* Um laço sobre os OBJETOS do tile, no lugar dos três ramos que havia
         aqui — âncora de `span`, parede e objeto-de-tile — mais o laço separado
         de `deco`. Os quatro perguntavam ao TILE o que desenhar em cima do
         chão, o que só funcionava porque objeto era tile; agora perguntam ao
         objeto, e a ordem de desenho é a ordem da lista, que é a ordem em que o
         autor colocou. É o que permite N por tile: a tocha sai depois da parede
         em que está pregada, a caneca depois da mesa. */
      for (const o of objsAt(x, y, z)) {
        /* Rastro de objeto grande: só a ÂNCORA desenha. Um tile tem 32 px, e
           poço, moinho e fonte desenhados dentro de um só serão pequenos por
           construção — nenhum ajuste de desenho conserta isso.
           A âncora deixou de ser adivinhada ("não tenho vizinho igual a oeste
           nem ao norte", que lia dois objetos iguais encostados como um só) e
           passou a ser o que a entrada DIZ que é. */
        if (o.x !== x || o.y !== y) continue;
        const d = OBJ[o.o]; if (!d) continue;
        // 9 variantes por `x*7+y*13` repetiam em diagonal e a olho nu; 16 com as
        // duas coordenadas embaralhadas quebram o padrão sem inchar o cache
        const v = ((x * 92837111) ^ (y * 689287499)) >>> 28;
        const gx = sx + t / 2, gy = sy + t * CHAO;

        /* Planta: sprite de deco, com vento e sombra de motor. */
        if (d.deco !== undefined) {
          const s = outlined(decoSprite(d.deco, v));
          dropShadow(s, gx, gy);
          /* Vento: cisalhamento com o pivô no PÉ da planta — a mesma transform
             da sombra projetada. Assim a raiz fica pregada no chão e quem
             balança é a copa, que é como planta se mexe; inclinar o desenho
             inteiro faria a árvore deslizar de lado.
             A fase sai do TILE, não só do relógio: com a fase igual o bosque
             inteiro se inclina junto, que lê como cortina, não como vento.
             No vento cheio a copa fica dobrada para um lado e só treme em cima
             disso — planta em temporal não oscila em torno da vertical, ela
             deita. Por isso o vento entra como VIÉS somado, não só amplitude.
             Pedra não balança, moita balança metade da árvore. */
          const vies = (ventoF - .3) * VENTO_INCL * 1.6;
          const balanco = d.deco === 1 ? 0
            : (vies + Math.sin(G.now * .0016 * (.5 + ventoF) + x * .9 + y * 1.7) * VENTO_INCL * (.4 + ventoF))
              * (d.deco === 0 ? 1 : .5);
          g2.save();
          g2.transform(1, 0, balanco, 1, gx, gy);
          g2.drawImage(s, -s.cx * S, -s.feet * S, s.width * S, s.height * S);
          g2.restore();
        }
        /* PORTA: decalque de chão, e o único objeto cuja textura muda em jogo.
           Ela nunca teve volume — era um tile `walk:true` com textura própria —,
           e continua não tendo: o que muda ao abrir é a SILHUETA (some a folha
           do meio do vão), medido em 94% dos pixels. */
        else if (d.draw === 'porta')
          g2.drawImage(tileTexture(o.aberta ? 'door_open' : 'door', 0x7a5330), 0, 0, TS, TS, sx, sy, tw, th);
        /* Objeto de mais de um tile: desenha a coisa inteira a partir da âncora.
           A sombra vem do MOTOR, a mesma da árvore e do boneco: mancha de
           contato mais silhueta projetada, inclinada pelo sol e com a alfa
           seguindo `solF`. Baixa o objeto no chão em vez de deixá-lo boiando —
           a projetada sozinha não basta e a de contato sozinha também não: é a
           de contato que prende, e a projetada que dá direção. */
        else if (d.span) {
          const sp = d.span, alto = d.top > 0.5 ? WALL_TOP : CERCA_TOP;
          const spr = (PAREDE_DRAW[d.draw] || OBJ_DRAW[d.draw])();
          dropShadow(spr, sx + t * sp[0] / 2, sy + t * (sp[1] - 1) + t * CHAO);
          g2.drawImage(spr, sx, sy - alto * S, t * sp[0], (alto + 32 * sp[1]) * S);
        }
        /* Parede. A cor e a textura são do MATERIAL do objeto — não mais do
           tile, que agora é o chão que ele pisa. */
        else if (d.top > 0.5)
          g2.drawImage((d.draw ? PAREDE_DRAW[d.draw] : wallSprite)(d.tex, d.c, v >>> 1),
            sx, sy - WALL_TOP * S, tw, WALL_H * S);
        /* Objeto solto ou corrido (cerca, escoramento, barril). Sai no 2º passe,
           com os volumes: no 1º viraria risco pintado no chão e o jogador
           passaria por cima do que devia estar na frente dele. O eixo vem do
           vizinho IGUAL — é o que faz a cerca correr no sentido da cerca e a
           escora no sentido da galeria. */
        else if (d.draw) {
          const spr = OBJ_DRAW[d.draw](d.eixo
            ? objsAt(x - 1, y, z).some(n => n.o === o.o) || objsAt(x + 1, y, z).some(n => n.o === o.o)
            : false);
          /* Cerca e escoramento CORREM em linha, e sombra projetada por tile num
             lance de cerca vira serrilha; quem tem sombra de motor é o objeto
             SOLTO — carroça, barril, poço. É o `sombra` da FICHA que decide, e
             não o nome do objeto, senão o render volta a conhecer coisa por
             coisa. */
          if (d.sombra) dropShadow(spr, gx, gy);
          g2.drawImage(spr, sx, sy - CERCA_TOP * S, tw, CERCA_H * S);
        }
      }
    }
  }
  /* A fileira inteira de bichos sai DEPOIS dos tiles dela, e em ordem do PÉ
     desenhado — não do x do tile. Quem está no meio de um passo diagonal está
     entre duas fileiras: pelo tile ele é da de baixo, mas na tela já subiu meio
     quadrado, e desenhar pelo x fazia o boneco que sobe passar por cima do bicho
     que está mais à frente — some meio ciclope atrás do jogador. */
  if (bucket) {
    const fila = [];
    for (let x = x0; x <= x1; x++) { const l = bucket.get(y * W + x); if (l) fila.push(...l); }
    if (fila.length > 1) fila.sort((a, b) => peY(a) - peY(b));
    for (const it of fila) drawEntity(it, telaX(it.bx), telaY(it.by), t);
    // e o campo que ENVOLVE sai por cima — desta fileira só, para não tapar
    // criatura de outro tile
    drawCampos(z, t, c => CAMPO_ACIMA[c.el], y);
  }
  }
}
/* pé desenhado: quem anda está entre dois tiles, o resto está no tile mesmo */
const peY = it => it.k === 'bicho' ? it.e.py : it.by;

/* Transição entre terrenos. Sem isto a grama encosta na areia numa reta de 90°,
   que é o que mais denuncia um mapa de tiles. Cada vizinho de prioridade maior
   pinta a própria textura na borda deste tile, recortada pela máscara daquele
   lado. O canto diagonal só entra quando nenhum dos dois ortogonais dele já
   cobriu aquela quina — senão sai mancha dobrada, mais escura que o resto.
   Parede e buraco ficam de fora: não são chão, quem cuida deles é o 2º passe. */
const NB8 = EDGE_DIR;                                   // a ordem é a das máscaras, e mora com elas
/* `tw`/`th` pelo mesmo motivo do 1º passe: a borda entre dois terrenos é
   estampada por tile, e desenhada com `t` cheio enquanto o chão usa a distância
   até o vizinho ela sobra ou falta um pixel — a 11,3 px por tile isso deixava 43
   colunas escuras, a mesma grade falsa por outra porta. */
function tileBorders(x, y, z, def, sx, sy, t, tw, th) {
  tw = tw || t; th = th || t;
  const p0 = TERRAIN_PRIO[def.tex] || 0;
  const praia = def.tex === 'water';
  let orto = 0;
  for (let m = 0; m < 8; m++) {
    if (m > 3 && (orto >> (m - 4) & 1 || orto >> ((m - 3) & 3) & 1)) continue;
    const nd = TILE[tileAt(x + NB8[m][0], y + NB8[m][1], z)];
    if (nd.hide || nd.top > 0.5) continue;
    if ((TERRAIN_PRIO[nd.tex] || 0) <= p0) continue;
    if (m < 4) orto |= 1 << m;
    /* A VARIANTE sai da coordenada de MUNDO, e é ela que faz a franja
       atravessar o tile: a máscara da variante v é a fatia do ruído de v·32 a
       v·32+32, e o ruído é periódico em BORDA_P tiles — então o tile x+1 começa
       onde o x terminou e a curva não tem degrau na junta. Borda que corre na
       horizontal indexa por x, na vertical por y, e o canto pelos dois. */
    const v = ((m === 0 || m === 2 ? x : m === 1 || m === 3 ? y : x + y) % BORDA_P + BORDA_P) % BORDA_P;
    // o borderSprite já traz o contorno da junta assado dentro dele
    g2.drawImage(borderSprite(nd.tex, nd.c, m, v), sx, sy, tw, th);
    /* Espuma: só no tile de água e só nas ortogonais — a máscara de canto é
       radial e a faixa sairia curva, e o canto quase sempre já tem um dos dois
       lados ortogonais espumando do lado.
       O alfa pulsa por tile E por lado: fase igual faz a costa inteira piscar
       junta, que lê como cintilação de tela, não como arrebentação. */
    if (praia && m < 4) {
      g2.globalAlpha = .30 + Math.sin(G.now * .0026 + x * .8 + y * 1.1 + m) * .16;
      g2.drawImage(foamSprite(m), sx, sy, tw, th);
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
  const add = (x, y, e) => { e.bx = x; e.by = y; const k = y * W + x, l = b.get(k); l ? l.push(e) : b.set(k, [e]); };
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
    const dir = facingOf(e);
    const q = criaQuadro(e.def.sheet, dir, !!e.stepD, e.stepD ? (G.now - e.stepT) / e.stepD : 0, G.now, e.uid);
    const s = creatureSheet(e.def.sheet, dir, q, CAM.scale, e.def.sz);
    if (s) return s;
  }
  return creatureSprite(e.def.shape || 'biped', e.def.col, e.def.sz, e.def.o, facingOf(e), frameOf(e));
}

/* Proporção do item no chão. O PNG preenche a própria arte, então anel, colar e
   bota saíam do tamanho de uma calça — anel do tamanho do tile. A régua é o
   slot; o que não está na tabela ocupa o tile como antes. */
const CHAO_ESCALA = { ring: .34, amulet: .78, boots: .68, light: .70, helmet: .80 };
const CHAO_MOEDA = { '1': .34, few: .58, many: .82 };
/* Despojo e comida não têm slot, então todos caíam do MESMO tamanho: ovo igual a
   cabeça de dragão, pérola igual a tronco. A régua aqui é o tamanho da coisa no
   mundo, em fração do tile — só entra quem foge do padrão, o resto continua .88.
   Quatro faixas, para não virar um número por item:
     .30 miudeza que cabe na mão fechada (gema, pérola, dente)
     .45 objeto de uma mão (poção, ovo, fruta, naco de minério)
     .70 coisa de carregar com as duas (peixe grande, pele, crânio)
    1.05 o que não cabe no colo (cabeça de dragão, tora, chifre de minotauro) */
const CHAO_ITEM = {
  small_ruby: .30, small_sapphire: .30, small_diamond: .30, green_gem: .30, blue_gem: .30,
  white_pearl: .30, black_pearl: .30, shimmering_pearl: .32, orc_tooth: .30, spider_silk: .38,
  talon: .40, feather: .42, seraph_feather: .45, rat_tail: .38, glow_gland: .34, soul_shard: .40,
  void_shard: .40, frozen_core: .42, ember_core: .42, storm_core: .42,
  apple: .42, egg: .40, bread: .48, cheese: .45, grapes: .45, honeycomb: .48, brown_mushroom: .40,
  worm_slime: .45, resin: .40, coal: .48, copper_ore: .50, iron_ore: .50, silver_ore: .50,
  mithril_ore: .50, gold_ingot: .50, gold: .50, cyclops_eye: .45, arrow: .45, bolt: .45,
  meat: .60, ham: .62, fish: .55, big_fish: .75, skull: .60, demon_skull: .66, pelt: .70,
  minotaur_leather: .70, snake_hide: .70, wolf_paw: .55, boar_tusk: .55, bug_shell: .60,
  dragon_scale: .55, red_dragon_scale: .55, primordial_heart: .60, demon_horn: .62, demon_wing: .80,
  tentacle: .75, antler: .85, wood: .95, hard_wood: 1.0, minotaur_horn: .95, dragon_head: 1.10,
  dragon_ham: .85, spear: 1.05
};

function drawEntity(it, sx, sy, t) {
  const S = CAM.scale;
  if (it.k === 'corpo') {
    /* Corpo morto vai CENTRADO no tile. Vivo se ancora pelos pés, que é o que
       planta o boneco no chão; deitado não há pé nenhum, e a mesma âncora jogava
       o corpo pra fora do quadrado — e o clique do saque é por TILE, então corpo
       torto vira dúvida sobre qual quadrado saquear.
       O meio sai do DESENHO (primeiro pixel opaco até os pés), não do canvas: a
       folga vazia por cima do sprite empurraria tudo para baixo de novo. */
    const mx = sx + t / 2, my = sy + t / 2;
    g2.fillStyle = 'rgba(90,15,15,.55)';
    g2.beginPath(); g2.ellipse(mx, my, t * .34, t * .2, 0, 0, 7); g2.fill();
    const c = it.c;
    if (!c.spr) return;
    /* A folha traz o bicho JÁ tombado, então este não gira: girar o desenho de
       quem está deitado o põe de lado no chão. */
    const morto = c.spr.sheet && outlined(creatureSheet(c.spr.sheet, CRIA_MORTO,
      criaMorto(c.spr.sheet, c, G.now, c.ttl), S, c.spr.size));
    if (morto) {
      const cm = spriteBox(morto);
      /* Deitado tem o comprimento de quem estava EM PÉ: a arte do tombado vem com
         braço e porrete esparramados e sozinha ela cobria quatro tiles, mas um
         teto em tile fixo encolhia o ciclope até virar rato. A régua é a altura
         do próprio bicho vivo — cada criatura acha a sua. */
      const pe = creatureSheet(c.spr.sheet, DIR_S, 0, S, c.spr.size);
      const alvo = pe ? (spriteBox(pe).y1 - spriteBox(pe).y0 + 1) * S * pe.k : t * 2;
      const K = S * morto.k * Math.min(1, alvo / ((cm.x1 - cm.x0 + 1) * S * morto.k));
      g2.globalAlpha = .9;
      g2.drawImage(morto, mx - cm.mx * K, my - cm.my * K, morto.width * K, morto.height * K);
      g2.globalAlpha = 1;
      return;
    }
    const s = outlined(creatureSprite(c.spr.shape, c.spr.color, c.spr.size, c.spr.o, DIR_S, 0));
    g2.save();
    /* Girado 90°: os eixos do sprite trocam de papel na tela, mas centrar é
       centrar — os dois offsets saem do meio da caixa do desenho do mesmo jeito. */
    const cs = spriteBox(s);
    g2.translate(mx, my); g2.rotate(Math.PI / 2); g2.globalAlpha = .8;
    g2.drawImage(s, -cs.mx * S, -cs.my * S, s.width * S, s.height * S);
    g2.restore(); g2.globalAlpha = 1;
    return;
  }
  if (it.k === 'item') {
    /* Item no chão ocupa o tile inteiro e não passa do quadrado. Ele está
       DEITADO no chão, então a sombra não sai de uma linha de pé como a do
       boneco: é a própria silhueta, do mesmo tamanho, deslocada para o sudeste
       (o sol é fixo no noroeste). Assim a sombra escapa por todas as bordas do
       desenho, que é o que um objeto largado no chão faz. */
    /* moeda escolhe o monte pela quantidade; o resto tem sprite fixo */
    const def = ITEMS[it.d.it.id] || 0;
    const spr = def.moeda ? def.moeda + '_' + COIN_MONTE(it.d.it.count || 1) : def.spr;
    const ico = itemIcon(spr);
    if (!ico) {
      /* Sem PNG o item continua sendo o emoji da mochila: o mesmo item não pode
         ter duas caras, uma no inventário e um quadradinho no chão. O quadrado
         da raridade sobrou para quem TEM arte e ainda não recebeu o arquivo —
         hoje só antes da pré-carga do início. */
      g2.save();
      if (!spr) {
        g2.font = `${Math.round(t * .58)}px serif`;
        g2.textAlign = 'center'; g2.textBaseline = 'middle';
        g2.fillStyle = '#fff';
        g2.fillText(def.ico, sx + t / 2, sy + t / 2);
      } else {
        g2.fillStyle = RARITY[it.d.it.r].color;
        g2.fillRect(sx + t * .34, sy + t * .38, t * .32, t * .28);
        g2.strokeStyle = '#000'; g2.lineWidth = Math.max(1, S * .5);
        g2.strokeRect(sx + t * .34, sy + t * .38, t * .32, t * .28);
      }
      g2.restore();
      return;
    }
    /* Tocha largada continua acesa — mas só onde ela está: o raio da bolsa é de
       quem carrega, no chão vira uma poça de dois tiles. `tocha` mantém ela fora
       do bloom, igual à da mão, senão o chão vira lanterna de dia. */
    if (def.luz) luzes.push({ x: sx + t / 2, y: sy + t / 2, cor: CHAMA_COR,
      a0: .9 * chamaF, a1: .3 * chamaF, tocha: 1, r: t * 2 * chamaTremor() });
    // moeda escala pelo monte, não pelo id: é a quantidade que muda o tamanho
    const esc = def.moeda ? CHAO_MOEDA[COIN_MONTE(it.d.it.count || 1)]
      : (CHAO_ITEM[def.id] || CHAO_ESCALA[def.slot] || .88);
    const d = t * esc, x = sx + (t - d) / 2, y = sy + (t - d) / 2;
    const sil = silhouette(ico), K = d / ico.width, pad = (sil.width - ico.width) / 2 * K;
    /* Dois passes da mesma silhueta: o curto gruda no contorno — é ele que
       segura o item quando o chão já está escuro e o deslocamento sumiria — e o
       longo é a projeção para o sudeste. */
    for (const [o, a] of [[.02, .5], [.07, .4 * solF]]) {
      g2.globalAlpha = a;
      g2.drawImage(sil, x - pad + t * o, y - pad + t * o, sil.width * K, sil.height * K);
    }
    g2.globalAlpha = 1;
    g2.drawImage(ico, x, y, d, d);
    return;
  }
  const e = it.e, spr = creatureSpriteFor(e);
  const ox = (e.px - it.ax) * t, oy = (e.py - it.ay) * t;   // deslocamento do passo, relativo à âncora
  /* Criatura que acende. Entra no mesmo balde de halos da tocha e da lava, então
     ela ilumina o terreno de verdade em vez de só ter pixel claro — que é o que
     faz um vaga-lume valer a pena existir de noite. `luz` é o raio em tiles,
     igual ao da tocha. */
  if (e.def && e.def.luz)
    luzes.push({ x: sx + ox + t / 2, y: sy + oy + t * .5, r: t * e.def.luz,
      cor: cssCol(e.def.col), a0: .75, a1: .2 });
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
  /* Estado elemental: o CORPO tingido na cor do elemento, pulsando por cima do
     sprite — o congelado fica azul, o queimando alaranjado. Junto com a
     partícula contínua que o `frame` emite (brasa que sobe, caco que cai, raio
     que estala), é o estado que se lê no boneco e não num selo à parte.
     Um anel no chão foi tentado antes e não servia: o corpo do minotauro é mais
     largo que o tile e comia o anel inteiro. */
  const flash = estadoFlash(e);
  if (flash > 0) {
    g2.save();
    // acende forte e apaga: o quadrado deixa a queda rápida no fim, como o clarão
    g2.globalAlpha = .78 * flash * flash;
    g2.drawImage(tingido(spr, cssCol(estiloEstado(e.estadoK).cor)), dx, dy, dw, dh);
    g2.restore();
  }
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

/* Campo no chão (#33). O desenho vem de `campoSprite` em art.js: um sprite por
   elemento e por quadro, no modelo do Tibia. Aqui só se escolhe o quadro e se
   estampa no tile.
   O QUADRO É COMPARTILHADO por todos os campos do mesmo elemento, de propósito:
   com fase por tile, um campo grande vira ruído de trinta animações fora de
   compasso; em compasso, a área inteira pulsa como uma coisa só, que é como o
   Tibia lê.
   A opacidade só serve à MORTE do campo — enquanto ele vive é opaco, porque o
   jogador precisa saber qual tile machuca, e tile meio transparente responde
   "mais ou menos". A versão anterior tingia o chão e soltava partícula, e não
   dava para dizer se era fogo ou veneno: cor sozinha não é identidade. */
/* `pred` escolhe quais elementos entram e `linha` restringe a uma fileira.
   Os dois existem por causa da ordem: gelo e energia saem no passe do chão, e
   fogo e veneno saem DENTRO do laço de fileiras, logo depois das entidades
   daquela fileira. Desenhar todos depois de tudo (foi a primeira versão) fazia
   o fogo de um tile tapar a criatura de outro — o campo tem de passar por cima
   de quem está em pé NELE, e por cima de mais ninguém. */
function drawCampos(z, t, pred, linha) {
  const lim = VW / t + 3;
  /* MESMA origem de tile do drawFloor, e não a do `w2s`: aquela devolve o centro
     do tile (VW/2) e esta o canto (VW/2 − t/2). Estampar a partir do centro
     jogava o campo meio tile para baixo e para a direita, o que na tela parecia
     um campo MAIOR que o tile. */
  const dz = (P.z - z) * t, meio = VW / 2 - t / 2, meioY = VH / 2 - t / 2;
  const q = Math.floor(G.now / CAMPO_MS) % CAMPO_FRAMES;
  // ponytail: varredura linear por fileira (≤300 campos × ~20 fileiras). Se um
  // dia pesar, indexar G.campos por y uma vez por quadro corta para uma passada.
  for (const c of G.campos) {
    if (c.z !== z) continue;
    if (linha !== undefined && c.y !== linha) continue;
    if (pred && !pred(c)) continue;
    if (Math.abs(c.x - camX) > lim || Math.abs(c.y - camY) > lim) continue;
    const k = (G.now - c.t) / c.dur;
    if (k >= 1) continue;
    /* A FASE é quem conta a história, não o alfa: o desenho muda de verdade a
       cada degrau (chama vira brasa, poça vira mancha) para o jogador saber
       olhando se aquele tile ainda dói. O alfa só apaga os últimos instantes. */
    const fase = campoFase(k);
    g2.globalAlpha = k < .93 ? 1 : Math.max(0, (1 - k) * 14);
    const sx = Math.round((c.x - camX) * t - dz + meio);
    const sy = Math.round((c.y - camY) * t - dz + meioY);
    g2.drawImage(campoSprite(c.el, q, campoVarDe(c.x, c.y), fase), sx, sy, t, t);
    /* GLOW na cor do elemento, entrando na MESMA lista das outras luzes do jogo
       (tocha, projétil mágico, impacto) — assim o passe de luz e o bloom leem a
       mesma coisa e não há como um acender o que o outro não acende.
       A força sai do `luz` que a tabela ELEM já declara, então fogo e energia
       brilham forte e terra quase nada; o piso de .4 existe porque campo no chão
       é matéria acesa mesmo quando o elemento não é luminoso — sem ele o veneno
       não teria brilho nenhum. E cai por fase: brasa apagando ilumina pouco. */
    const e = ELEM[c.el];
    const lf = Math.max(.4, e.luz) * [1, .62, .3][fase];
    luzes.push({ x: sx + t / 2, y: sy + t / 2, r: t * 1.5 * lf,
      cor: cssCol(e.cor), a0: .8 * lf, a1: .24 * lf });
  }
  g2.globalAlpha = 1;
}


function drawEffects(t) {
  const S = CAM.scale;
  /* Aviso de nascimento: anel que FECHA no tile durante os últimos segundos
     antes da criatura voltar. Dar aviso é a mesma regra que já vale para a
     habilidade de monstro — o jogador tem de poder sair dali, senão não é
     dificuldade, é imposto.

     O alfa começa alto e sobe pouco. A primeira versão subia de .07 a .55 ao
     longo dos cinco segundos, e na prática eram quase cinco segundos de nada e
     um lampejo no fim — indistinguível do clarão de nascimento, que é justamente
     o que ele deveria ANTECIPAR.

     As três lascas girando por fora não são enfeite: movimento é o que o olho
     pega na periferia. Um anel parado o jogador só nota se já estiver olhando
     para ele. */
  for (const n of G.nascendo || []) {
    const falta = n.ate - Date.now();
    if (falta <= 0 || falta > AVISO_NASCER) continue;
    const k = 1 - falta / AVISO_NASCER;                 // 0 = começou, 1 = agora
    const [x, y] = w2s(n.x, n.y);
    const pulso = .5 + .5 * Math.sin(G.now * (.005 + k * .014));
    g2.globalAlpha = (.45 + k * .45) * (.7 + pulso * .3);
    g2.strokeStyle = '#b98cf0'; g2.lineWidth = (1.6 + k * 2.4) * S;
    g2.beginPath();
    g2.ellipse(x, y, t * (.58 - k * .3), t * (.29 - k * .15), 0, 0, 7);
    g2.stroke();
    // miolo escuro que cresce: a sombra chega antes da criatura
    g2.globalAlpha = (.25 + k * k * .5) * (.8 + pulso * .2);
    g2.fillStyle = '#31104a';
    g2.beginPath();
    g2.ellipse(x, y, t * (.14 + .22 * k), t * (.07 + .11 * k), 0, 0, 7);
    g2.fill();
    g2.globalAlpha = (.5 + k * .4) * (.6 + pulso * .4);
    g2.fillStyle = '#d8b4ff';
    for (let i = 0; i < 3; i++) {
      const a = G.now * .0022 + i * 2.094, r = t * (.62 - k * .34);
      g2.beginPath();
      g2.arc(x + Math.cos(a) * r, y + Math.sin(a) * r * .5, (1.1 + k * 1.4) * S, 0, 7);
      g2.fill();
    }
  }
  g2.globalAlpha = 1;
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
  if (!ambienteDe(P.z).amb) {
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

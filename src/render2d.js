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
  /* E REDESENHA NA HORA. Escrever em `gcv.width` apaga o canvas, e até aqui
     ninguém repintava antes do próximo `requestAnimationFrame` — daí o pisco
     preto ao arrastar a borda da janela, que é o defeito 5 da rodada 1. Redimensionar
     dispara em rajada (o `ResizeObserver` chama a cada pixel arrastado), então o
     pisco aparecia o arrasto inteiro, não uma vez.
     Vai AQUI e não no observador porque são sete chamadores, o editor incluído.
     `G.started` porque o canvas existe antes de haver mundo para desenhar. */
  if (typeof G !== 'undefined' && G && G.started) drawWorld();
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
/* A FOGUEIRA TEM DE VALER MAIS QUE A TOCHA NA MÃO, e não valia: a tocha
   carregada sai do item (`luz: 6`, vezes .85 = 5,1 tiles) e o objeto do mapa
   saía do próprio `luz` cru — a fogueira, que é o maior deles, dava 3,2. Uma
   fogueira mais fraca que o archote no bolso é errado no jogo antes de ser
   errado na tabela. O fator recoloca a família inteira acima dela sem mexer nas
   105 fichas: fogueira 5,8, poste 6,5, lampião 5,0, candelabro 3,2.
   ponytail: um fator sobre a tabela, e não 20 números reescritos. Quando alguma
   peça precisar destoar da família, é a ficha dela que muda. */
const LUZ_OBJ = 1.8;
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
/* Altura do sol do QUADRO. Mesmo motivo do `solF`: sai uma vez por quadro em vez
   de uma vez por sombra desenhada — são dezenas por quadro, e todas veem o mesmo
   céu. */
let altSolF = 0;
/* Comprimento da borda de parede no quadro, em múltiplos da base. Rampa PRÓPRIA,
   e diferente da projetada: esta nunca desce abaixo de 1. A borda é OCLUSÃO de
   contato, não sombra de sol — ela existe com qualquer luz, e acoplá-la ao sol
   apagaria a sombra de toda parede interna, deixando a casa de papel. O que a
   hora muda é só o quanto ela estica. E a rampa é contínua na virada do dia:
   `alturaSol` vale 0 tanto no nascer quanto de madrugada, então não há salto. */
let bordaF = 1;
const RAIO_SOMBRA = .7;                  // quanto o clarão do relâmpago pesa no sol do quadro
/* Cor do céu do quadro, calculada UMA vez. O `gradePass` já a calculava; o
   cintilo da água tinha um `#cfe8ff` cravado ao lado, então ao poente o céu
   virava laranja e a água continuava refletindo meio-dia. Guardo o par cru (o
   grade normaliza para meio-tom) e o css pronto (o cintilo pinta por tile de
   água, e montar a string em cada um seria lixo por quadro). */
let ceuRGB = [255, 255, 255], ceuCss = '#ffffff';
const AGUA_CINTILO_A = [.05, .04];       // base e amplitude do cintilo da água
/* Vento do quadro, 0..1. Mesmo motivo do solF: mato, chuva e nuvem têm de
   concordar. Com cada um lendo o próprio relógio, a copa balançava para um lado
   e a chuva caía para o outro no mesmo temporal. */
let ventoF = .25;
/* DERIVA INTEGRADA. Nuvem e mato tiravam a posição de `G.now * taxa(ventoF)` —
   o RELÓGIO ABSOLUTO vezes uma taxa que muda. Isso não acelera: teleporta, por
   `G.now × Δvento`, e o salto cresce com o tempo de sessão. Medido a 10 min de
   jogo, com o vento congelado como controle: a nuvem sai de 38,8 px/s para 908
   no pico da frente da tempestade (23,4×) e a fase do mato de 2,07 rad/s para
   45,8 (22,1×) — o que o dono via como "nuvem acelerada quando vai chover".
   Integrar é a correção inteira: a posição passa a ser a soma de `dt × taxa`, e
   mudar a taxa muda só o quanto ela anda daqui para a frente.
   O teto de 200 ms é para a aba que volta de segundo plano: lá o `rAF` é
   estrangulado, `G.now` dá um salto de segundos, e sem o teto a nuvem
   atravessaria a tela de uma vez — o mesmo teleporte por outra porta. E `dt`
   zero quando `G.now` não andou é o que deixa `drawWorld` ser chamado duas
   vezes no mesmo instante (o `resizeCam` faz isso, e o editor desenha com o
   relógio parado) sem a deriva correr em dobro. */
const deriva = { ms: 0, nuvem: 0, mato: 0 };
const DERIVA_DT = 200;
function derivaAvanca() {
  const dt = Math.min(DERIVA_DT, Math.max(0, G.now - deriva.ms));
  deriva.ms = G.now;
  deriva.nuvem += dt * (.4 + ventoF * 1.6);      // calmaria arrasta, temporal corre
  deriva.mato += dt * .0016 * (.5 + ventoF);
}
/* Quanto de poça desenhar no quadro, já com as ressalvas aplicadas (0 debaixo de
   teto ou com o chão seco). Vem pronto porque quem consome está lá dentro do
   drawFloor, que não vê o clima — passar por parâmetro obrigaria a furar a
   assinatura de drawFloor por causa de um efeito só. */
let pocaF = 0;
/* As faixas de parede do quadro, em pixel de TELA: a crista (aponta para o céu)
   e a face (aponta para a câmera). Recolhidas no desenho e lidas pelo passe de
   luz — quem sabe se há crista é o laço que desenha a parede, porque com vizinha
   em cima o sprite não desenha nenhuma. */
/* AS FAIXAS DE CRISTA E FACE SAÍRAM. Elas eram o único lugar do motor que
   pintava um RETÂNGULO DE TILE, OPACO, com a COR DO CÉU, em cima de pixel de
   parede — e no tile de CIMA, porque a arte da parede transborda um tile. A
   guarda (`!abrigado(x, y-1)`) é avaliada por tile, então um lance de muro saía
   com uns tiles banhados de céu e outros não: faixas verticais claras e escuras
   ao longo da mesma parede. O dono relatou isso três vezes — "cada parede
   reflete separadamente, como se não fossem um conjunto", "algumas partes das
   paredes ainda possuem efeitos de fora afetando", "continua".
   O volume não se perde: quem o desenha é o PRÓPRIO SPRITE — a chapa clara do
   topo, a face escurecida pela profundidade e a quina viva entre as duas. O que
   a parede perde é a crista mudar de cor com a hora, e esse é o preço aceito.
   Se um dia voltar, volta como TERMO de quem calcula luz por pixel — pela mesma
   razão que a cobertura saiu. */

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
  silhuetaDoQuadro();

  const cols = Math.ceil(VW / t / 2) + 2, rows = Math.ceil(VH / t / 2) + 3;
  const cx = Math.floor(camX), cy = Math.floor(camY);

  /* pilha de andares: o de baixo aparece pelos buracos do atual; o de cima só
     quando o jogador não está coberto — é o teto que some ao entrar na caverna */
  const coberto = abrigado();
  const zs = [];
  if (P.z + 1 < FLOORS && floorVoid[P.z]) zs.push(P.z + 1);
  zs.push(P.z);
  if (P.z - 1 >= 0 && !coberto) zs.push(P.z - 1);

  const bucket = entityBucket();
  // clima antes do chão: quem desenha sombra projetada lê `solF`, e depois do
  // laço ele valeria para o quadro seguinte — a sombra chegaria atrasada à noite
  const clima = climaAgora(P.z);
  /* O clarão do relâmpago entra no SOL do quadro. Sem isto o quadro mais claro
     do dia tinha a sombra mais fraca do dia: o raio clareia a cena e a sombra
     continuava presa a `clima.luz`, que na tempestade está no chão. Entra na
     ATRIBUIÇÃO e não no uso, para não colidir com o `solNoTile`, que é uma
     pergunta por tile — aqui o assunto é quanta luz o céu está dando. */
  solF = Math.min(1, clima.luz + clima.raio * RAIO_SOMBRA); ventoF = clima.vento;
  derivaAvanca();                        // depois do vento do quadro, antes de quem deriva
  altSolF = alturaSol();
  bordaF = 1 + (SOL_LONGO - 1) * (1 - altSolF);
  ceuRGB = corDoCeu(horaDoDia());
  ceuCss = `rgb(${ceuRGB[0]},${ceuRGB[1]},${ceuRGB[2]})`;
  // sem o `coberto`: quem tira a poça de debaixo do telhado é o laço do poolPass,
  // tile a tile — este número diz só o quanto o chão está encharcado
  pocaF = clima.molhado < .04 ? 0 : clima.molhado;
  /* Um recorte só para os três: construído uma vez por quadro e só quando há
     tempo para desenhar. `save`/`restore` porque nuvem e chuva mexem em
     `globalAlpha` e `globalCompositeOperation`. */
  const temTempo = clima.nuvens > .01 || clima.chuva > 0 || clima.raio > 0;
  /* O tinte do `gradePass` é a COR do céu, então ele quer o mesmo recorte da
     chuva — e ele roda mesmo sem tempo nenhum. Por isso o recorte deixou de
     depender só do clima: sem isso, num dia limpo o interior levava 96% do
     tinte quente da rua, e relativamente MAIS (6,7% contra 5,3%), porque o
     mesmo laranja cai sobre chão já 42% escurecido pelo telhado. */
  const temCeu = !ambienteDe(P.z).amb;         // andar com luz própria não tem céu
  const ceu = (temTempo || temCeu) ? recorteCeu(t) : null;
  // `ceu` nulo quer dizer "nada abrigado à vista": não há o que recortar, e o
  // `clip` some junto — é o caso comum em campo aberto
  const sobCeu = fn => { g2.save(); if (ceu) g2.clip(ceu); fn(); g2.restore(); };
  for (const z of zs) drawFloor(z, cx - cols, cx + cols, cy - rows, cy + rows, t, z === P.z ? bucket : null);
  if (clima.nuvens > .01) sobCeu(() => cloudPass(t, clima.nuvens));
  drawEffects(t);
  /* O passe rodava só quando a hora escurecia o céu; ao meio-dia ele era pulado
     por economia. Com telhado isso não serve mais: é justamente ao meio-dia que
     a diferença entre dentro e fora tem de aparecer. */
  /* `luzes.length`: ao meio-dia descoberto o passe era pulado por economia, e
     com isso a tocha e a fogueira não acendiam nada justo na hora em que o
     buffer é branco liso. Quem pede o passe é haver fonte em cena — antes era o
     `faces.length`, e ele saiu com as faixas de parede. */
  if (temCeu) sobCeu(horaPass);
  if (amb.amb || coberto || luzes.length) {
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
    lightPass(amb, t);
  }
  bloomPass(t);
  /* A NÉVOA vai DEPOIS do passe de luz e do bloom: ela é ar entre a câmera e o
     mundo, então não leva o multiply do ambiente — névoa escurecida pela noite
     que ela mesma deveria clarear é mancha, não névoa. E vai DENTRO do recorte
     de céu, com nuvem, relâmpago e chuva: não entra névoa em sala fechada, e o
     recorte já existe e já é memoizado no quadro. Antes do clarão de propósito
     — o relâmpago é luz do céu chegando na cena inteira, e a névoa é parte da
     cena. */
  if (temCeu) sobCeu(() => nevoaPass(t, clima.molhado));
  /* Relâmpago e chuva por último: caem ENTRE a câmera e o mundo, então não levam
     o multiply do passe de luz. O clarão vem depois do bloom de propósito — ele
     é luz do céu chegando na cena inteira, não brilho de um objeto dela. */
  if (clima.raio > 0) sobCeu(() => {
    g2.globalCompositeOperation = 'lighter';
    g2.fillStyle = `rgba(150,172,214,${(clima.raio * .34).toFixed(3)})`;
    g2.fillRect(0, 0, VW, VH);
    g2.globalCompositeOperation = 'source-over';
  });
  if (clima.chuva > 0) sobCeu(() => rainPass(clima.chuva));
  gradePass(ceu);
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
/* A DIREÇÃO DO VENTO É UMA SÓ, e sai daqui. Estava cravada em quatro lugares
   com dois sinais: nuvem e gota andavam para LESTE, a copa deitava para OESTE, e
   o traço da chuva era desenhado no eixo errado da própria gota — 57,6° medidos
   entre o traço e a trajetória de uma mesma gota no vento cheio.
   O traço NÃO era um quarto voto: ele é o desenho de para onde a gota vai, então
   estava só errado. Descontado ele, a contagem é 2 a 1 para leste, e é por isso
   que `VENTO` fica com o sinal que já tinha e quem vira é a copa.
   Virar o vento do mundo inteiro é trocar este `+` por `-`: os três leitores
   derivam o sinal daqui e nenhum o crava. */
const VENTO_SINAL = Math.sign(VENTO[0]) || 1;
/* inclinação do mato, em cisalhamento: no topo de uma árvore de ~50px dá uns 2px
   de balanço. Mais que isso e ela derrete de lado em vez de balançar. */
const VENTO_INCL = .045;
/* VIÉS da copa: o quanto a planta fica DEITADA, antes do tremor. Dois consertos
   numa linha só. O sinal sai do `VENTO` (cisalhamento positivo joga o topo para
   oeste, porque no espaço do sprite o topo tem y negativo — era por isso que a
   copa deitava contra a nuvem e contra a chuva). E o `max(0, ...)`: escrito
   `(ventoF - .3)` cru, o viés ficava NEGATIVO em brisa, então em vento fraco a
   planta deitava para o lado oposto ao de vento forte — a direção do mato se
   invertia junto com a força, e ninguém veria isso sem medir. */
const viesDoVento = vf => -VENTO_SINAL * Math.max(0, vf - .3) * VENTO_INCL * 1.6;
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

/* O CANTO NOROESTE DE UM TILE NA TELA. Existe porque a conta estava escrita à
   mão em três lugares e um deles estava errado: `telhadoNaLuz` usava `w2s`
   direto, que devolve o CENTRO, e a máscara de telhado saía meio tile a sudeste
   do chão que ela escurece. É a mesma armadilha de "dois sistemas de coordenadas
   nunca se misturam" — aqui as duas medidas têm o mesmo nome e a mesma unidade,
   e só a metade de um tile as separa. Uma função, um lugar para errar.
   `drawFloor` fica de fora de propósito: ele desloca por andar (`dz`) e mede a
   largura pela distância até o vizinho, que é outra conta. */
const cantoDoTile = (x, y, t) => [Math.round((x - camX) * t + VW / 2 - t / 2),
                                  Math.round((y - camY) * t + VH / 2 - t / 2)];
/* A janela de tiles do quadro: a mesma para o recorte do céu, a máscara de
   telhado e a poça. Divergirem significaria a chuva parar num tile em que a
   poça ainda se forma. */
const janelaDeTiles = t => [Math.ceil(VW / t / 2) + 2, Math.ceil(VH / t / 2) + 3];
/* O INVERSO do `cantoDoTile`: de pixel de tela de volta para tile do mundo.
   Existe porque as luzes são empilhadas em PIXEL por dez lugares diferentes
   (tocha, lava, lampião, item no chão, criatura, fogueira, projétil...) e
   precisam saber em que cômodo estão. É a única travessia tela→mundo do render,
   e por isso mora aqui como função pura e com régua: a regra da casa não é
   "nunca converta", é "nunca converta em silêncio no meio de outra conta".
   Arredonda porque a luz se ancora no CENTRO do tile, e algumas somam um
   deslocamento de passo ou de altura de chama por cima disso. */
const tileDaTela = (sx, sy, t) => [Math.round((sx - VW / 2) / t + camX),
                                   Math.round((sy - VH / 2) / t + camY)];

/* O CÉU É POR TILE, NÃO PELO TILE DO JOGADOR. Nuvem, chuva e relâmpago liam um
   `abrigado()` só — o do jogador — e aplicavam a resposta à tela inteira. Dava
   os dois erros ao mesmo tempo: parado na rua, a chuva caía por cima do interior
   das casas visíveis; três passos para dentro de uma cabana, a chuva sumia da
   rua inteira num quadro só. Medido contando pixel que MUDA entre dois quadros
   (a chuva é a única coisa que se move com o resto congelado): hoje o interior
   fica em 0 e o pátio a céu aberto em 50+ com o jogador de qualquer lado.
   Sobreposição de +1 não incomoda aqui: recorte é união, não alfa — a lição de
   "a máscara primeiro, o alfa depois" vale para quem PINTA por tile, e este não
   pinta. */
/* UM RETÂNGULO POR CORRIDA, e `null` quando não há nada a recortar.
   A primeira versão emitia um retângulo POR TILE, e o custo de um `clip` é
   proporcional ao número deles — com este caminho sendo recortado três vezes
   por quadro (nuvem, relâmpago, chuva) mais o `gradePass`, era o clima inteiro
   pagando por isso. E como a janela cresce quando o zoom diminui, o preço subia
   justamente ao afastar a câmera: foi o dono quem notou os dois sintomas
   juntos — "o clima é o que mais pesa" e "mexer no zoom derruba o fps".
   Duas reduções, e as duas dão a MESMA região:
   · tiles a céu aberto vizinhos na horizontal viram uma corrida só. A céu
     aberto quase toda linha é uma corrida, então cai de ~35 retângulos por
     linha para 1;
   · se NENHUM tile da janela é abrigado — o caso comum em campo aberto — não
     há o que recortar, e devolver `null` faz o chamador pular o `clip` inteiro.
   `null` aqui quer dizer "recorte desnecessário", nunca "andar sem céu": quem
   responde isso é o `temCeu`, antes da chamada. */
function recorteCeu(t) {
  const [cols, rows] = janelaDeTiles(t);
  const cx = Math.floor(camX), cy = Math.floor(camY);
  const lado = Math.ceil(t) + 1;
  /* As corridas saem para um array e só viram `Path2D` se houver o que recortar.
     A primeira versão montava o caminho e DEPOIS o descartava — em campo aberto
     isso era um objeto e 19 chamadas de `rect` jogados fora a cada quadro. */
  const corridas = [];
  let abrigados = 0;
  for (let y = cy - rows; y <= cy + rows; y++) {
    let ini = null;                                  // início da corrida atual
    for (let x = cx - cols; x <= cx + cols + 1; x++) {
      /* `daCasa`, e NÃO `abrigado`. O tile onde a parede está não é "dentro":
         o `calcDentro` o marca `SALA_PAREDE`, que é fronteira. Enquanto a parede
         preenchia o tile inteiro isso nunca apareceu — ela tapava o próprio
         chão. Com a faixa fina e oblíqua o chão do tile da parede fica EXPOSTO,
         e como ele estava fora da máscara, CHUVA E LUZ DO CÉU entravam por ele:
         a chuva caía dentro da casa e parava no limite do anel de paredes, que é
         exatamente o que o dono viu. O anel faz parte da construção. */
      const aberto = x <= cx + cols && ceuNoTile(x, y, P.z);
      if (aberto && ini === null) ini = x;
      else if (!aberto) {
        if (x <= cx + cols) abrigados++;
        if (ini !== null) { corridas.push([ini, y, x - ini]); ini = null; }
      }
    }
  }
  if (!abrigados) return null;
  const p = new Path2D();
  for (const [x, y, n] of corridas) {
    const [sx, sy] = cantoDoTile(x, y, t);
    p.rect(sx, sy, Math.round((n - 1) * t) + lado, lado);
  }
  return p;
}
function camadaNuvem(t, esc, vel, forca, semente) {
  const cv = cloudTexture(semente);
  const wrap = v => ((v % esc) + esc) % esc - esc;
  /* `vel` fica FORA da integral porque é constante por camada; o que muda com o
     tempo é a taxa do vento, e ela já está somada dentro de `deriva.nuvem`. */
  const ox = wrap(VW / 2 - camX * t + deriva.nuvem * VENTO[0] * vel * CAM.scale);
  const oy = wrap(VH / 2 - camY * t + deriva.nuvem * VENTO[1] * vel * CAM.scale);
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
  const [cols, rows] = janelaDeTiles(t);
  const cx = Math.floor(camX), cy = Math.floor(camY);
  const chao = new Path2D();
  let algum = false;
  for (let y = cy - rows; y <= cy + rows; y++) for (let x = cx - cols; x <= cx + cols; x++) {
    const tt = tileAt(x, y, P.z);
    if (tt === T.VOID || TILE[tt].top !== 0) continue;
    /* `daCasa` e nao `abrigado`: o tile ONDE A PAREDE ESTA nao e "dentro" — o
       `calcDentro` o marca `SALA_PAREDE`, que e fronteira. Perguntando
       `abrigado`, o anel de paredes ficava fora da mascara e a chuva caia nele,
       dentro da casa. O anel faz parte da construcao, e o `recorteCeu` ja usa a
       mesma regua — as duas tem de fazer a MESMA pergunta. */
    if (daCasa(x, y, P.z)) continue;        // não chove lá dentro, não empoça lá dentro
    // +1 no tamanho: sem a sobreposição sai um fio de piso seco entre os tiles
    const [sx, sy] = cantoDoTile(x, y, t);
    chao.rect(sx, sy, t + 1, t + 1);
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

/* NÉVOA. Ela tem ONDE e QUANDO, e é isso que separa névoa de filtro de tela —
   filtro de tela é exatamente a "névoa genérica de jogo gerado por IA" do §23.
   O QUANDO é uma corcova no amanhecer, e a janela sai dos MESMOS cortes da rampa
   do céu; é o sol que a queima, e é isso que a faz parecer manhã. O ONDE é a
   distância até a água, que o `distAgua` responde por tile.
   QUATRO COISAS DIVERGEM DA BANCADA, e cada uma tem o número que a obriga: ela
   mediu numa cena sintética de 8×6 tiles, e Varrokgaard é uma ilha com 20.099
   tiles de água, 54,5% da superfície.
   · PISO 0,06 e não 0,18 — a 0,18, 64% dos postos do mapa viam só o piso e o
     contraste margem/campo caía a 3,1×; a 0,06 ele é 8,1×.
   · O molhado MULTIPLICA a corcova em vez de somar com ela. Somado, a névoa
     ficava ligada 56,4% do tempo e aparecia às três da tarde; multiplicando,
     ela vale os 14% do dia que a janela dura e é ZERO ao meio-dia, sempre.
   · A máscara sai em CORRIDAS e sem a folga de +1 da bancada. Eram 713
     retângulos, e alfa por tile SOMA na sobreposição (0,18 sobre 0,18 = 0,33):
     a folga desenhava a grade. É a lição do telhado — a máscara primeiro, o
     alfa depois — violada dentro da própria bancada que a cita.
   · A distância até a água é campo pré-calculado com invalidação, não varredura
     por quadro.
   Sem deriva, ao contrário da nuvem: névoa é ar parado, e é isso que a separa
   da sombra de nuvem passando. Como a taxa nunca varia, a armadilha do
   "relógio × taxa variável" não existe aqui.
   Ressalva de identidade, honesta: em Varrokgaard "margem" quer dizer sobretudo
   COSTA — rio e lago somam 1,2% do mapa. Isto vai ler como névoa de ilha, não
   de rio. É coerente com a terra, e diferente do que a bancada mostra. */
const NEVOA_INI = .20, NEVOA_FIM = .34;  // a janela, nos cortes da rampa do CÉU
const NEVOA_TETO = .30;                  // alfa máximo, e é ele que segura a legibilidade
const NEVOA_PISO = .06;                  // quanto sobra em campo aberto
const NEVOA_MOLHADO = .55;               // peso do chão encharcado, como SEGUNDA causa
const nevoaHora = (td = horaDoDia()) => td <= NEVOA_INI || td >= NEVOA_FIM ? 0
  : Math.sin((td - NEVOA_INI) / (NEVOA_FIM - NEVOA_INI) * Math.PI);
/* Quadrática: cai rápido ao sair da margem. Linear deixava meia janela em meia
   névoa, e meia névoa em todo lugar é filtro por outro caminho. */
const nevoaDens = (x, y) => {
  const d = distAgua(x, y, P.z);
  if (d >= NEVOA_AGUA) return NEVOA_PISO;
  const k = 1 - d / NEVOA_AGUA;
  return NEVOA_PISO + (1 - NEVOA_PISO) * k * k;
};
let nevCv = null, nevMasc = null;
function nevoaPass(t, molhado) {
  const causa = nevoaHora() * (1 + molhado * NEVOA_MOLHADO);
  if (causa < .01) return;
  if (!nevCv || nevCv.width !== VW || nevCv.height !== VH) {
    nevCv = nevCv || document.createElement('canvas');
    nevMasc = nevMasc || document.createElement('canvas');
    nevCv.width = nevMasc.width = VW; nevCv.height = nevMasc.height = VH;
  }
  /* A MÁSCARA PRIMEIRO, num canvas à parte e em `source-over`, e só depois ela
     vira recorte de uma vez. Duas armadilhas moram aqui e as duas já morderam
     esta base: `destination-in` aplicado por tile num laço apaga tudo fora do
     retângulo da vez — o modo de composição vale para o CANVAS inteiro —, e
     alfa por tile soma na sobreposição.
     CORRIDAS: tiles vizinhos com a MESMA densidade viram um retângulo só, e a
     largura vai até o canto do primeiro tile de fora, nunca `t + 1`. Assim os
     retângulos encostam sem folga e sem vão: zero soma, zero fio de grade. */
  const mg = nevMasc.getContext('2d');
  mg.globalCompositeOperation = 'source-over';
  mg.clearRect(0, 0, VW, VH);
  const [cols, rows] = janelaDeTiles(t);
  const cx = Math.floor(camX), cy = Math.floor(camY);
  let algum = false;
  for (let y = cy - rows; y <= cy + rows; y++) {
    const sy = cantoDoTile(0, y, t)[1], sy1 = cantoDoTile(0, y + 1, t)[1];
    let ini = cx - cols, d0 = nevoaDens(ini, y);
    for (let x = ini + 1; x <= cx + cols + 1; x++) {
      const d = x <= cx + cols ? nevoaDens(x, y) : -1;
      if (d === d0) continue;
      if (d0 > 0) {
        const sx = cantoDoTile(ini, y, t)[0], sx1 = cantoDoTile(x, y, t)[0];
        mg.fillStyle = `rgba(0,0,0,${d0.toFixed(3)})`;
        mg.fillRect(sx, sy, sx1 - sx, sy1 - sy);
        algum = true;
      }
      ini = x; d0 = d;
    }
  }
  if (!algum) return;
  /* A FOLHA, ladrilhada em coordenada de MUNDO e tingida com a cor do CÉU.
     Presa à tela ela andaria com a câmera e viraria sujeira na lente — a mesma
     lição que a poça e a nuvem já carregam. E a cor nunca é um branco cravado:
     névoa é ar iluminado pelo céu que está por cima dela. */
  const bg = nevCv.getContext('2d');
  bg.globalCompositeOperation = 'source-over';
  bg.clearRect(0, 0, VW, VH);
  const folha = nevoaTexture(), esc = t * (NEVOA_S / TS);
  const wrap = v => ((v % esc) + esc) % esc - esc;
  const ox = wrap(VW / 2 - camX * t), oy = wrap(VH / 2 - camY * t);
  for (let y = oy; y < VH; y += esc) for (let x = ox; x < VW; x += esc) bg.drawImage(folha, x, y, esc, esc);
  bg.globalCompositeOperation = 'source-in';
  bg.fillStyle = ceuCss;
  bg.fillRect(0, 0, VW, VH);
  bg.globalCompositeOperation = 'destination-in';
  bg.drawImage(nevMasc, 0, 0);
  bg.globalCompositeOperation = 'source-over';
  g2.globalAlpha = Math.min(NEVOA_TETO, causa * NEVOA_TETO);
  g2.drawImage(nevCv, 0, 0);
  g2.globalAlpha = 1;
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
const CHUVA_VEU_A = .10;                 // alfa do véu no aguaceiro cheio
/* DOIS PLANOS: velocidade, espessura e alfa. Um traço só, com a mesma espessura
   e o mesmo brilho para as 280 gotas, lê como listra chapada — é a paralaxe
   entre um plano perto e um longe que dá volume. E ela é profundidade de
   verdade, ao contrário de escurecer a borda da tela e chamar isso de
   distância: numa câmera de cima a borda está tão perto quanto o meio. */
const CHUVA_PLANOS = [[.75, .40, .30], [1.30, .75, .62]];
function rainPass(forca) {
  const S = CAM.scale, n = Math.round(CHUVA_N * Math.min(1, forca));
  const incl = CHUVA_INCL * ventoF * VENTO_SINAL;
  const alt = VH + 80, larg = VW + 260;      // H é a altura do mundo, não sombrear
  // resto SEMPRE positivo: com o vento invertido `y * incl` fica negativo, e o
  // `%` do JS devolve negativo — a gota sairia pela esquerda da tela em silêncio
  const dentro = v => ((v % larg) + larg) % larg;
  /* O VÉU é a cortina de água entre a câmera e o chão, e a cor dela é a do CÉU,
     que é o que a chuva reflete — nunca um cinza cravado. Vai aqui dentro do
     `rainPass` de propósito: o `rainPass` já é chamado dentro do recorte de
     céu, então o véu herda o recorte e não volta a chover dentro de casa por
     outra porta. */
  g2.globalAlpha = CHUVA_VEU_A * Math.min(1, forca);
  g2.fillStyle = ceuCss;
  g2.fillRect(0, 0, VW, VH);
  g2.globalAlpha = 1;
  const meio = n >> 1;
  for (let p = 0; p < CHUVA_PLANOS.length; p++) {
    const [vel, esp, alfa] = CHUVA_PLANOS[p];
    g2.strokeStyle = `rgba(176,204,232,${alfa})`;
    g2.lineWidth = Math.max(1, S * esp);
    g2.beginPath();
    for (let i = p ? meio : 0, fim = p ? n : meio; i < fim; i++) {
      const d = gotas[i];
      const y = ((d.y + G.now * .0011 * d.v * vel) % 1) * alt - 40;
      const x = dentro(d.x * larg + y * incl) - 130;
      const c = 15 * S * d.v * vel;
      /* O traço fica NO EIXO da queda: a gota anda (incl, 1) por unidade de
         tempo, então o rastro atrás dela é −(incl, 1)·c. Estava escrito
         `y + c`, que desenhava o traço para BAIXO enquanto a gota subia de x —
         o traço cruzava a própria trajetória em 57,6°. */
      g2.moveTo(x, y); g2.lineTo(x - c * incl, y - c);
    }
    g2.stroke();
  }
}

/* Sol fixo no noroeste — a mesma diagonal do deslocamento por andar, então a
   sombra concorda com a perspectiva em vez de brigar com ela. A silhueta é
   inclinada para o leste e achatada; d negativo espelha na vertical, que é o que
   põe a cabeça na ponta da sombra, longe dos pés. */
const SOL_INCL = 0.38, SOL_ACHAT = 0.28;
const SOMBRA_PROJ = .28;                 // alfa da silhueta projetada em sol pleno
/* Comprimento da projetada por altura do sol: a pino ela encolhe, rasante ela
   estica. O teto de 1,71 não é gosto — é o mesmo teto medido da borda de parede
   (24 px / 14 px de base), acima do qual a sombra vira xadrez, que é a mesma
   armadilha da franja de terreno. */
const SOL_CURTO = .55, SOL_LONGO = 1.71;
/* QUANTO DE SOL UM TILE RECEBE, 0..1. `solF` é a luz do céu do ANDAR, e quem
   lia isso direto projetava sombra de sol onde não há sol: numa sala de paredes
   fechadas o boneco projetava 86% da sombra de campo aberto, e numa caverna
   (`CLIMA_PARADO.luz = .6`, constante) 889 px de silhueta apontando para o
   nordeste — a direção do sol fixo, ignorando a tocha, que é a única fonte lá
   embaixo. Mesma família dos três consumidores de clima que liam um booleano do
   jogador: o motor já sabe abrigo por tile, faltava perguntar.
   Andar com luz própria não tem céu nenhum, então nem o telhado entra na conta:
   é zero direto. E a sombra de CONTATO não passa por aqui de propósito — ela
   prende o objeto no chão e vale com qualquer luz; o que some é a direção. */
const solNoTile = (x, y, z) => (ambienteDe(z).amb || abrigado(x, y, z)) ? 0 : solF;
/* ONDE O PÉ DO SPRITE ENCOSTA, em pixel do próprio sprite. O objeto era o único
   desenhado por uma identidade aritmética (`sy - (height - 32)`) cujo fundo cai
   sempre no FUNDO do tile, enquanto a sombra dele, o jogador, a criatura, a
   árvore e a moita ancoram no MEIO (`CHAO`). A mesma `dropShadow` recebia duas
   linhas de chão conforme quem a chamava.
   Medido nos dois lados: 24 px de chão limpo entre a mancha e a base do barril
   no zoom 2, e — na tela, que é o que conta — a mancha de 27 das 89 peças com
   sombra não chegava a UM pixel visível, porque a arte é desenhada depois e por
   cima dela. Era o "objeto parece flutuando" que o `silhuetaFade` tinha
   consertado pela metade: o degradê arrumou a projetada, a âncora não.
   `height` como reserva porque nem todo procedural declara `feet`; com ela o pé
   do sprite cai na linha de chão do mesmo jeito, que é o que se quer. */
const peDo = spr => spr.feet || spr.height;
/* O MEIO DO SPRITE, com a mesma reserva do `peDo` e pelo mesmo motivo: nem todo
   procedural declara `cx`. `cercaSprite`, `escoraSprite`, `fogueiraSprite` e
   `pocoSprite` nao declaram, e `-undefined * S` da NaN -- o `drawImage` com NaN
   nao desenha nada e nao da erro. O dono viu o defeito exato: "alguns objetos no
   editor nao sao exibidos ao posicionar mas ainda geram colisao", porque a
   colisao vem do indice e nao do desenho. */
const cxDo = spr => spr.cx !== undefined ? spr.cx : spr.width / 2;

/* O CISALHAMENTO DO VENTO, com o pivô no PÉ da planta. Uma função porque agora
   DOIS ramos a usam: o `deco` procedural e o de folha. Duplicar a fórmula faria
   a árvore de folha e a moita procedural deitarem em ângulos diferentes no mesmo
   temporal, sem erro nenhum — e a de folha é a que tem 1712 instâncias.
   A fase sai do TILE, não só do relógio: com a fase igual o bosque inteiro se
   inclina junto, que lê como cortina, não como vento. No vento cheio a copa fica
   dobrada para um lado e só treme em cima disso — planta em temporal não oscila
   em torno da vertical, ela deita —, por isso o vento entra como VIÉS somado, e
   o tremor por cima dele oscila para os dois lados, que é o que brisa faz. */
const balancoEm = (x, y, forca) => forca === 0 ? 0
  : (viesDoVento(ventoF)
    + Math.sin(deriva.mato + x * .9 + y * 1.7) * VENTO_INCL * (.4 + ventoF)) * forca;

function dropShadow(spr, px, py, sol) {
  const s = silhouette(spr), S = CAM.scale * (spr.k || 1);   // k: sprite já em pixel de tela
  // contato primeiro: é ele que prende o boneco no chão, a projetada só dá direção
  const cw = s.width * S * .5, ch = cw * .4;
  g2.drawImage(contactShadow(), px - cw / 2, py - ch / 2, cw, ch);
  if (!sol) return;                      // sem sol não há projetada, só o contato
  g2.save();
  g2.globalAlpha = SOMBRA_PROJ * sol;
  // geometria vem da ALTURA do sol, alfa vem da ATMOSFERA — nunca as duas do mesmo número
  const comp = SOL_CURTO + (SOL_LONGO - SOL_CURTO) * (1 - altSolF);
  g2.transform(1, 0, -SOL_INCL * comp, -SOL_ACHAT * comp, px, py);
  /* a silhueta que vai para a projetada é a do FADE: cheia no pé, esvaindo na
     ponta. A do contato acima continua sendo a lisa — ela é contato, não
     projeção, e desvanecer justo onde o objeto encosta desprenderia a peça do
     chão, que é o defeito que ela existe para evitar. */
  const f = silhuetaFade(spr);
  g2.drawImage(f, -f.cx * S, -f.feet * S, f.width * S, f.height * S);
  g2.restore();
}

/* ONDE ESTÁ A CUMEEIRA, sem o autor precisar dizer. Conta quantos tiles de
   telhado correm acima e abaixo deste: no meio do lance a razão dá .5, e é ali
   que as duas águas se encontram. Com isso o autor pinta um retângulo e o
   telhado sai com forma — se a cumeeira tivesse de ser pintada à mão, toda casa
   nova exigiria três tiles diferentes e a primeira que alguém esquecesse
   voltaria a ser uma chapa.
   TETO ANOTADO: só resolve telhado de duas águas correndo leste-oeste, que é o
   das casas da vila. Cumeeira no outro eixo, ou de quatro águas, pede o mesmo
   cálculo na horizontal e a menor das duas distâncias. */
const telhaEm = (x, y, z) => tileAt(x, y, z) === T.TELHA;
function faixaTelhado(x, y, z) {
  let u = 0, d = 0;
  while (telhaEm(x, y - u - 1, z)) u++;
  while (telhaEm(x, y + d + 1, z)) d++;
  return (u + d) ? u / (u + d) : .5;
}
/* A CUMEEIRA É UMA FILEIRA, e ela não sai de comparar a fração com .5: num
   telhado de 8 fileiras as frações são 0, .14, .29, .43, .57, ... e NENHUMA cai
   em .5. Medido na amostra: a cumeeira simplesmente não era desenhada, e o
   telhado saiu com duas águas de tom diferente e nenhuma dobra entre elas — o
   que lê como dois materiais, não como um telhado.
   Quem responde é a contagem: a fileira do meio é aquela em que os tiles acima
   são a metade inteira do lance. */
function cumeTelhado(x, y, z) {
  let u = 0, d = 0;
  while (telhaEm(x, y - u - 1, z)) u++;
  while (telhaEm(x, y + d + 1, z)) d++;
  return (u + d) > 0 && u === Math.floor((u + d) / 2);
}
const mascaraTelhado = (x, y, z) => (telhaEm(x, y - 1, z) ? 1 : 0) | (telhaEm(x, y + 1, z) ? 2 : 0) |
  (telhaEm(x - 1, y, z) ? 4 : 0) | (telhaEm(x + 1, y, z) ? 8 : 0);

function drawFloor(z, x0, x1, y0, y1, t, bucket) {
  const S = CAM.scale, dz = (P.z - z) * t;
  const meio = VW / 2 - t / 2, meioY = VH / 2 - t / 2;
  const telaX = x => Math.round((x - camX) * t - dz + meio);
  const telaY = y => Math.round((y - camY) * t - dz + meioY);
  /* "É alto?" passou a perguntar às DUAS camadas — a parede virou objeto, e a
     sombra de contato que ela projeta no chão do vizinho é desenhada aqui. Só o
     terreno, isto responderia "não" para toda parede do jogo e as paredes
     passariam a flutuar sem sombra nenhuma. */
  const alto = (x, y) => tapaVista(x, y, z);   // a régua mora no world.js: uma cópia só
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
    /* A pergunta é de FAMÍLIA, não de `tex`. Enquanto era igualdade de string
       com os dois originais, `agua_clara`, `agua_funda` e `lava_viva` eram chão
       morto: não corriam, não cintilavam, não espumavam, e a lava não acendia.
       Nenhum deles tem tile em Varrokgaard hoje — era alçapão armado, e ele
       dispararia no dia em que alguém pintasse um lago com a variante no editor,
       com o sintoma "o lago novo está morto e o velho não". A `familia` é a
       mesma régua que a paleta já usa; `pantano` fica de fora porque a família
       dele é outra. */
    const fam = def.familia, ehLava = fam === 'lava';
    const corre = fam === 'agua' || ehLava;
    if (corre) {
      // o recorte desce com o relógio: a água escorre em vez de só piscar
      const vel = ehLava ? .004 : .011;
      g2.drawImage(flowTexture(def.tex, def.c),
        cropX, cropY + (G.now * vel) % TEX_S, TS, TS, sx, sy, tw, th);
      const k = Math.sin(G.now * 0.0018 + x * .7 + y * .5);
      g2.globalAlpha = ehLava ? .18 + k * .12
        : AGUA_CINTILO_A[0] + k * AGUA_CINTILO_A[1];
      // água REFLETE, lava EMITE — só a primeira pergunta que cor o céu está
      g2.fillStyle = ehLava ? '#ff8a2a' : ceuCss;
      g2.fillRect(sx, sy, tw, th); g2.globalAlpha = 1;
      if (ehLava && z === P.z)
        luzes.push({ x: sx + t / 2, y: sy + t / 2, r: t * 2.2, cor: '#ff8c32', a0: .8, a1: .3 });
    } else if (tt === T.TELHA) {
      /* TELHADO, e ele é o único chão que pergunta aos VIZINHOS. Um telhado
         ladrilhado com uma textura só sai chapado, e chapado lê como parede
         deitada — foi o que o dono viu na primeira amostra. A máscara diz onde
         a água acaba (beiral) e a faixa diz onde está a cumeeira. */
      g2.drawImage(roofSprite(def.c, mascaraTelhado(x, y, z), faixaTelhado(x, y, z),
        cumeTelhado(x, y, z)), sx, sy, tw, th);
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
    /* Só a faixa que tem tinta. O gradiente ocupa `e.px` de 32 e o resto do
       canvas é alfa zero: mesmo número de blits, 56% menos pixel ao meio-dia.
       A escala sai de `tw`/`th` e não de `S` porque é a distância até o vizinho
       que dá a largura do tile na tela — a mesma razão do 1º passe —, e `ceil`
       para não abrir fresta quando `t` é fracionário. */
    /* So a faixa que tem tinta. O gradiente ocupa `e.px` de 32 e o resto do
       canvas e alfa zero: mesmo numero de blits, 56%% menos pixel ao meio-dia. */
    if (alto(x, y - 1)) { const e = edgeShadow(0, bordaF);
      g2.drawImage(e, 0, 0, 32, e.px, sx, sy, tw, Math.ceil(e.px * th / 32)); }
    if (alto(x - 1, y)) { const e = edgeShadow(1, bordaF);
      g2.drawImage(e, 0, 0, e.px, 32, sx, sy, Math.ceil(e.px * tw / 32), th); }
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
    /* DECALQUE DE CHÃO. Entre os dois passes pelo mesmo motivo do sangue de
       combate: depois do piso inteiro, para o tile vizinho não apagar a mancha,
       e antes dos volumes, para quem pisa nela passar por cima. */
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
      for (const o of objsAt(x, y, z)) {
        if (o.x !== x || o.y !== y) continue;
        const d = OBJ[o.o];
        if (!d || d.cat !== 'mancha') continue;
        // marca sobre parede ou objeto sai no 2º passe, por cima deles
        if (temVolume(x, y, z)) continue;
        const v = ((x * 92837111) ^ (y * 689287499)) >>> 28;
        const spr = objSprite(Array.isArray(d.png) ? d.png[v % d.png.length] : d.png);
        if (!spr) continue;
        /* `multiply`, como o sangue de combate: marca TINGE o que está embaixo.
           Com `source-over` ela sairia chapada por cima da textura, que é o
           adesivo colado no chão. */
        g2.globalCompositeOperation = 'multiply';
        const w = spr.width * S, h = spr.height * S;
        g2.drawImage(spr, telaX(x) + t / 2 - w / 2, telaY(y) + t * CHAO - h / 2, w, h);
        g2.globalCompositeOperation = 'source-over';
      }
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
        drawEntity({ k: 'corpo', c }, telaX(c.x), telaY(c.y), t, solNoTile(c.x, c.y, z));
  }

  /* 2º passe: o que tem volume, na ordem do pintor */
  const vergas = [];                       // a metade de cima das portas desta fileira
  /* A COPA SAI DEPOIS DA FILEIRA, pelo mesmo motivo da verga da porta: ela fica
     ACIMA DA CABEÇA de quem está debaixo dela. A árvore tem `span` 2 e `pe` 1 —
     o tronco ocupa um tile e a copa transborda meio tile para cada lado, sobre
     chão em que se PISA. Desenhando-a com os objetos da fileira, quem pisa ali é
     desenhado depois e cobre a copa: o relato foi "em alguns tiles a árvore fica
     por trás do player".
     A pergunta é pelo PAPEL e o motor já a responde: `span[0] > pe[0]` é
     exatamente "a arte cobre tile que dá para pisar". Cama e carroça têm os dois
     iguais e continuam saindo na hora certa, debaixo de quem passa. A SOMBRA
     não vem junto — ela é chão, e sai na hora de sempre. */
  const copas = [];
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
        /* O OBJETO QUE ACENDE entra na MESMA lista das outras luzes — a da
           tocha na mão, a da lava, a do campo elemental. É isso que faz o passe
           de luz e o bloom lerem a mesma coisa: uma segunda régua de brilho
           acenderia o que a outra não acende.
           `tocha: 1` o mantém fora do bloom, como a tocha largada faz: sem isso
           o poste vira holofote de dia. E quem treme é quem tem chama nua. */
        if (d.luz) luzes.push({ x: sx + t / 2, y: sy + t * CHAO - t * .35,
          r: t * d.luz * LUZ_OBJ * (d.tremula ? chamaTremor() : 1), cor: d.luzCor || CHAMA_COR,
          a0: .95 * chamaF, a1: .38 * chamaF, tocha: 1 });
        // 9 variantes por `x*7+y*13` repetiam em diagonal e a olho nu; 16 com as
        // duas coordenadas embaralhadas quebram o padrão sem inchar o cache
        const v = ((x * 92837111) ^ (y * 689287499)) >>> 28;
        const gx = sx + t / 2, gy = sy + t * CHAO;
        /* A VARIANTE E O VENTO VALEM PARA OS DOIS RAMOS DE FOLHA, e por isso
           moram ACIMA da cadeia. Enquanto a escolha da variante estava só no
           ramo de objeto solto, dar `span` a uma peça a mandava para o ramo de
           `span` — que chamava `objSprite(d.png)` com o ARRAY inteiro, recebia
           `null` e caía no `continue`. A árvore sumiu do mapa inteiro assim, sem
           erro nenhum e com todos os sprites carregados: 8 árvores em volta do
           jogador e ZERO blits. É a armadilha da cadeia de ramos de novo — quem
           decide por cadeia obriga todo caminho a saber a mesma coisa. */
        const folha = Array.isArray(d.png) ? d.png[v % d.png.length] : d.png;
        /* O MEIO DO FOOTPRINT, que é onde a peça se apoia. Não é o meio do
           `span`: quando `pe` é menor que ele — copa de 2 tiles sobre tronco de
           1 —, alinhar o desenho pela esquerda do span joga o tronco na BORDA
           DIREITA do tile âncora, meia tile fora do lugar. Foi o que o dono viu:
           "as árvores não ficaram centralizadas nos tiles". */
        const meio = sx + t * ((d.pe || d.span || [1, 1])[0]) / 2;
        /* `dy` é a linha de chão, e o pivô do vento é ela: a raiz fica pregada
           no chão e quem balança é a copa.
           A âncora horizontal é o `cx` DO SPRITE, como no ramo `deco`, na
           criatura e no boneco — e não a borda da lona. É o que faz o contorno
           do `outlined` (que engorda a lona em 1 px de cada lado) não deslocar a
           peça, e o que mantém a peça centrada quando a lona é maior que o pé. */
        const desenha = (spr, cxTela, dy) => {
          const ox = -cxDo(spr) * S, oy = -peDo(spr) * S, w = spr.width * S, h = spr.height * S;
          const bal = d.balanca ? balancoEm(x, y, d.balanca) : 0;
          if (!bal) g2.drawImage(spr, cxTela + ox, dy + oy, w, h);
          else {
            g2.save();
            g2.transform(1, 0, bal, 1, cxTela, dy);
            g2.drawImage(spr, ox, oy, w, h);
            g2.restore();
          }
          /* A SILHUETA LEVA SÓ A BANDA DE BAIXO — UM TILE a partir do chão —, e
             não a peça inteira. A tocha está na altura de uma pessoa: a COPA de
             uma árvore passa muito acima dela e não pode fazer sombra no chão ao
             lado do tronco. Medido no jogo antes de escrever isto: com a peça
             inteira, numa mata **87% da tela virava oclusor** e a luz saía
             uniforme — o efeito desaparecia justamente onde deveria aparecer. Foi
             o caso que a bancada não tinha, porque a cena dela era rua com
             barril e caixote, peças que cabem inteiras na banda.
             Com a banda: o tronco barra, a copa não; barril, caixote e poço
             continuam barrando inteiros, porque são mais baixos que um tile.
             Sem `clip`, pela janela de ORIGEM do `drawImage`: recorte por peça
             custa proporcional ao número de retângulos, e são centenas por
             quadro. Só o andar do jogador — peça de outro andar não barra a luz
             deste. */
          if (silG && z === P.z) {
            const banda = Math.min(spr.height, 32);
            const sy0 = spr.height - banda, dh = banda * S;
            if (!bal) silG.drawImage(spr, 0, sy0, spr.width, banda, cxTela + ox, dy - dh, w, dh);
            else {
              silG.save();
              silG.transform(1, 0, bal, 1, cxTela, dy);
              silG.drawImage(spr, 0, sy0, spr.width, banda, ox, -dh, w, dh);
              silG.restore();
            }
          }
        };
        // uma vez por tile: os três desenhos abaixo projetam do mesmo sol
        const sol = solNoTile(x, y, z);

        /* MARCA, e ela vem PRIMEIRO na cadeia. A mancha declara `span` (a arte tem
           2 tiles de largura), e enquanto este ramo vinha DEPOIS do de `span`
           ela era engolida por ele e desenhada como objeto comum, com sombra e
           tudo. Terceira vez nesta leva que a cadeia de ramos morde: quem decide
           aqui e a CATEGORIA, nao um campo que varios ramos tambem leem.
           Sobre coisa. A que caiu em chão vazio já saiu no passe de chão,
           debaixo de quem pisa nela; aqui sai só a que está SOBRE parede ou
           objeto, e ela tem de vir depois deles — sangue numa parede está na
           parede, não no rodapé dela.
           Na parede a marca se centra na FACE, e não na linha de chão: a parede
           transborda um tile para cima, então o meio dela é `WALL_H·.55` abaixo
           da crista. Sobre objeto ela fica na altura do chão, que é onde o
           objeto encosta. TETO: a marca não acompanha a inclinação do que está
           embaixo — numa peça alta e estreita ela sobra para os lados. */
        if (d.cat === 'mancha') {
          if (!temVolume(x, y, z)) continue;              // já saiu no passe de chão
          const spr = folha && objSprite(folha);
          if (!spr) continue;
          const cyM = paredeEm(x, y, z)
            ? sy - WALL_TOP * S + WALL_H * S * .55
            : sy + t * CHAO;
          const w = spr.width * S, h = spr.height * S;
          g2.globalCompositeOperation = 'multiply';
          g2.drawImage(spr, sx + t / 2 - w / 2, cyM - h / 2, w, h);
          g2.globalCompositeOperation = 'source-over';
        }
        /* Planta: sprite de deco, com vento e sombra de motor. */
        else if (d.deco !== undefined) {
          const s = outlined(decoSprite(d.deco, v));
          dropShadow(s, gx, gy, sol);
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
          /* O tremor por cima do viés oscila para os DOIS lados, que é o que
             brisa faz — quem carrega a direção é só o viés. */
          const balanco = balancoEm(x, y, d.deco === 1 ? 0 : d.deco === 0 ? 1 : .5);
          g2.save();
          g2.transform(1, 0, balanco, 1, gx, gy);
          g2.drawImage(s, -s.cx * S, -s.feet * S, s.width * S, s.height * S);
          g2.restore();
        }
        /* PORTA: decalque de chão, e o único objeto cuja textura muda em jogo.
           Ela nunca teve volume — era um tile `walk:true` com textura própria —,
           e continua não tendo: o que muda ao abrir é a SILHUETA (some a folha
           do meio do vão), medido em 94% dos pixels. */
        else if (d.draw === 'porta') {
          /* A porta sai em DUAS metades, e é isto que resolve o "por cima".
             Quem está no vão está DEBAIXO da verga: desenhando a porta inteira
             antes da fileira, o boneco cobria a própria verga e a padieira, e a
             porta lia como se estivesse atrás dele. A metade de baixo (a soleira
             e a folha) sai aqui, antes do bicho; a de cima sai DEPOIS da fileira,
             por cima da cabeça de quem estiver parado ali. */
          /* De frente ou de perfil sai da PAREDE em que ela está, não de outra
             porta: parede à esquerda ou à direita quer dizer muro correndo
             leste-oeste, e aí a porta encara a câmera. */
          const spr = portaSprite(o.aberta, !(paredeEm(x - 1, y, z) || paredeEm(x + 1, y, z)));
          g2.drawImage(spr, 0, 32, 32, 32, sx, sy, tw, th);
          vergas.push([spr, sx, sy, tw, th]);
          /* PORTA ABERTA VIRA VÃO DE GRAÇA: o sprite tem um buraco no meio, e
             como o oclusor agora é o alfa, a luz passa por ele sem ninguém
             precisar perguntar `aberta`. Era uma pergunta a mais no `tapaVista`
             e agora é geometria. */
          if (silG && z === P.z) {
            silG.drawImage(spr, 0, 32, 32, 32, sx, sy, tw, th);
            silG.drawImage(spr, 0, 0, 32, 32, sx, sy - th, tw, th);
          }
        }
        /* Objeto de mais de um tile: desenha a coisa inteira a partir da âncora.
           A sombra vem do MOTOR, a mesma da árvore e do boneco: mancha de
           contato mais silhueta projetada, inclinada pelo sol e com a alfa
           seguindo `solF`. Baixa o objeto no chão em vez de deixá-lo boiando —
           a projetada sozinha não basta e a de contato sozinha também não: é a
           de contato que prende, e a projetada que dá direção. */
        else if (d.span) {
          const sp = d.span;
          /* PNG de folha primeiro, procedural como reserva — mesma ordem do
             objeto solto e do terreno. */
          /* CONTORNO. O ramo `deco` sempre chamou `outlined`, e o de folha não —
             então a peça de folha saía como PNG chapado, sem a linha escura que
             separa o objeto do chão. O dono descreveu o efeito exato: "sem
             contorno, parece um papel balançando". Vale para as 88, não só a
             árvore. `outlined` cacheia por sprite e ajusta `cx`/`feet`. */
          const spr = (folha && outlined(objSprite(folha)))
            || (d.draw && (PAREDE_DRAW[d.draw] || OBJ_DRAW[d.draw])());
          if (!spr) continue;                  // peça de folha ainda carregando
          /* `sombra: 0` na ficha tira a projetada, e ela existe para o que é
             PLANO no chão: um tapete não projeta silhueta, e a mancha de contato
             de uma coisa sem altura lê como sujeira. O padrão continua sendo
             projetar — é a regra do CLAUDE.md. */
          /* A LINHA DE CHÃO DA ÚLTIMA FILEIRA DO RASTRO. Uma só, e a arte e as
             duas sombras saem dela — era o desencontro: a sombra ancorava em
             `CHAO` e a arte no fundo do tile, meia tile abaixo, e a mancha saía
             DEBAIXO do desenho (medido: 27 das 89 peças sem um pixel visível).
             Quem se move é a SOMBRA, não a arte. A primeira tentativa subiu a
             arte até o `CHAO` e o dono viu na hora: todo objeto do mapa passou a
             flutuar meia tile acima do próprio tile. A causa é que `feet`, para
             peça de folha, NÃO é âncora — o `build_objetos.py` grava
             `peq.shape[0]`, o fundo da lona, então `feet == h` nas 105. Alinhar
             por ele não alinha pé com pé: só sobe o desenho. */
          const gyS = sy + t * sp[1];
          if (d.sombra !== 0) dropShadow(spr, meio, gyS, sol);
          if (d.pe && sp[0] > d.pe[0]) copas.push(() => desenha(spr, meio, gyS));
          else desenha(spr, meio, gyS);
        }
        /* Parede. A cor e a textura são do MATERIAL do objeto — não mais do
           tile, que agora é o chão que ele pisa. */
        else if (d.top > 0.5) {
          /* `v >>> 1` era vestígio: o wallSprite tinha dois parâmetros e ignorava
             o terceiro. Agora ele recebe os vizinhos DO MESMO material, que é o
             que emenda o lance — rochedo encostado em parede de tábua continua
             sendo duas coisas e cada uma guarda a própria crista. */
          /* OS QUATRO BITS, e nao `& 3`. Com `& 3` a parede tinha quatro
             variantes e canto de casa saia igual a lance reto -- a "visualizacao
             confusa" que o dono relatou. O `wallSprite` usa leste e oeste para
             as faces laterais, e e isso que da quina.
             E o lance NAO QUEBRA NA PORTA: `vizinhosIguais` pergunta pelo
             MATERIAL, e porta e `cat: 'objeto'` com material proprio, entao a
             parede de cada lado do vao via o fim do lance e fechava a propria
             ponta -- um entalhe em V na fachada. Quem continua a linha de uma
             construcao e parede OU porta. */
          const m = mascaraParede(x, y, z, o.o), topY = sy - WALL_TOP * S;
          /* A janela vem da FICHA e nao da instancia: o mapa grava `x,y,id`, e
             estado de instancia e SAVE, nao mapa. `ptabuaj` e tabua COM vao. */
          const spr = (d.draw ? PAREDE_DRAW[d.draw] : wallSprite)(d.tex, d.c,
              m, profParede(x, y, z, o.o),
              (((x % 3) + 3) % 3) + (((y % 3) + 3) % 3) * 3, d.jan);
          g2.drawImage(spr, sx, topY, tw, WALL_H * S);
          /* A parede é o oclusor principal, e vai para a silhueta pela SILHUETA
             do sprite e não pelo retângulo da lona: o prisma já ensinou que
             anunciar a lona tinge o que está em volta. */
          if (silG && z === P.z) silG.drawImage(spr, sx, topY, tw, WALL_H * S);
        }
        /* Objeto solto ou corrido (cerca, escoramento, barril). Sai no 2º passe,
           com os volumes: no 1º viraria risco pintado no chão e o jogador
           passaria por cima do que devia estar na frente dele. O eixo vem do
           vizinho IGUAL — é o que faz a cerca correr no sentido da cerca e a
           escora no sentido da galeria. */
        /* MANCHA saiu daqui: ela e decalque de CHAO, desenhada entre os dois
           passes junto do sangue de combate. No passe de volumes ela cobriria
           quem pisa nela, que e o defeito do `ponytail:` do tapete. */
        else if (d.draw || d.png) {
          /* PNG de folha primeiro, procedural como reserva. A ordem importa e é
             a mesma do terreno: peça com arte usa a arte, e enquanto o PNG não
             chega — ou numa máquina sem `Image`, como o node dos testes — cai no
             desenho por código, que é o que mantém o `drawWorld` headless. Por
             isso as sete que a folha SUBSTITUI mantêm o `draw` na ficha. */
          /* `png` pode ser UMA peça ou uma LISTA de variantes, sorteada pelo
             mesmo `v` do tile que a `decoSprite` já usava. Sem isso um bosque
             inteiro sai com a mesma árvore e lê como papel de parede — é a
             razão de a folha trazer cinco desenhos por família. */
          const spr = (folha && outlined(objSprite(folha)))
            || (d.draw && OBJ_DRAW[d.draw](d.eixo ? vizinhosIguais(x, y, z, o.o) : 0));
          /* Sem sprite não há o que desenhar, e isso é ESTADO NORMAL: peça só de
             folha some por um quadro enquanto o PNG carrega. Desenhar `null`
             estouraria o laço do render inteiro por um asset que chega em
             seguida. */
          if (!spr) continue;
          /* Cerca e escoramento CORREM em linha, e sombra projetada por tile num
             lance de cerca vira serrilha; quem tem sombra de motor é o objeto
             SOLTO — carroça, barril, poço. É o `sombra` da FICHA que decide, e
             não o nome do objeto, senão o render volta a conhecer coisa por
             coisa. */
          /* A base da ARTE, que é o fundo do tile — não o `gy` do `CHAO`, que é
             onde a planta e o boneco pisam. Ver a nota do ramo de `span`: para
             peça de folha o `feet` é o fundo da lona, então a linha de chão do
             objeto solto é a de sempre e quem estava fora do lugar era a mancha. */
          const gyObj = sy + t;
          if (d.sombra) dropShadow(spr, meio, gyObj, sol);
          /* A altura sai do SPRITE, não de `CERCA_H`. Enquanto era a constante,
             TODO objeto solto era espremido em 46 px: barril, carroça, lampião,
             fogueira e poste de luz saíam do mesmo tamanho, e um poste não podia
             ser mais alto que um barril por construção. Com 46 a conta dá o
             mesmo de antes (46−32 = CERCA_TOP), então nada que já estava certo
             se mexe; quem quiser subir só precisa nascer num canvas maior. */
          /* `balanca` na ficha devolve o vento à peça de folha. A árvore trocou
             o procedural pela arte e com isso saiu do ramo `deco`, que era quem
             cisalhava — sem isto as 1712 do mapa parariam de deitar no temporal,
             e o temporal é 28,4% do tempo real. O pivô é o PÉ, como na planta
             procedural e na sombra projetada: a raiz fica pregada no chão e quem
             balança é a copa. */
          desenha(spr, meio, gyObj);
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
    for (const it of fila) drawEntity(it, telaX(it.bx), telaY(it.by), t, solNoTile(it.bx, it.by, z));
    // e o campo que ENVOLVE sai por cima — desta fileira só, para não tapar
    // criatura de outro tile
    drawCampos(z, t, c => CAMPO_ACIMA[c.el], y);
  }
  /* A verga por último: ela é a parte da porta que fica ACIMA da cabeça, então
     cobre quem está parado no vão. Fora da guarda do `bucket` porque a porta
     existe com ou sem bicho no andar. */
  for (const [spr, px, py, pw, ph] of vergas) g2.drawImage(spr, 0, 0, 32, 32, px, py - ph, pw, ph);
  vergas.length = 0;
  for (const f of copas) f();
  copas.length = 0;
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
  const praia = def.familia === 'agua';
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

/* Tem parede neste tile? A porta pergunta isto aos vizinhos para saber se está
   de frente ou de perfil. Vale para qualquer material — rochedo, tábua, bloco —,
   porque o que importa é o muro correr, não de que ele é feito. */
/* Os quatro vizinhos com o MESMO objeto, em bits: 1 norte · 2 sul · 4 oeste ·
   8 leste. A cerca precisa dos quatro para fazer quina — com o booleano antigo
   ("corre na horizontal?") ela passava reto no canto, e um lance que não se
   fecha lê como duas cercas que não se encontram. */
/* MESMO MATERIAL, e não mesmo id — que é o que o comentário acima sempre
   afirmou e o código não fazia. Enquanto era `n.o === id`, duas paredes do mesmo
   material com ids diferentes (a de tábua e a de tábua COM JANELA) liam-se como
   coisas distintas: o lance se partia na janela e nascia uma aresta lateral no
   meio da fachada.
   `familia` é opcional e ninguém a declarava até agora, então `familia || id`
   deixa TODO o conteúdo existente exatamente como estava — cerca, escora,
   rochedo e teia continuam se comparando por id, porque é isso que `familia ||
   id` devolve para quem não a tem. */
const materialDe = id => (OBJ[id] || {}).familia || id;
/* O LANCE DE PAREDE NÃO QUEBRA NA PORTA.
   `vizinhosIguais` pergunta pelo MATERIAL, e porta é `cat: 'objeto'` com
   material próprio — então a parede de cada lado do vão via o fim do lance e
   fechava a própria ponta, deixando um entalhe em V na fachada. É o mesmo erro
   do `paredeEm` na sombra de prédio: perguntar pela CATEGORIA em vez do PAPEL.
   Quem continua a linha de uma construção é parede OU porta. */
const segueALinha = (x, y, z, mat) => objsAt(x, y, z).some(n =>
  materialDe(n.o) === mat || (OBJ[n.o] || {}).abrivel);
const mascaraParede = (x, y, z, id) => {
  const mat = materialDe(id);
  const t = (a, b) => segueALinha(a, b, z, mat);
  return (t(x, y - 1) ? 1 : 0) | (t(x, y + 1) ? 2 : 0)
    | (t(x - 1, y) ? 4 : 0) | (t(x + 1, y) ? 8 : 0);
};
/* E a máscara da PORTA olha para qualquer parede ou porta: o vão não tem
   material, então ele não pode exigir igualdade de material para saber em que
   sentido o muro corre. */
const mascaraVao = (x, y, z) => {
  const t = (a, b) => objsAt(a, b, z).some(n => {
    const d = OBJ[n.o] || {}; return d.cat === 'parede' || d.abrivel;
  });
  return (t(x, y - 1) ? 1 : 0) | (t(x, y + 1) ? 2 : 0)
    | (t(x - 1, y) ? 4 : 0) | (t(x + 1, y) ? 8 : 0);
};

const vizinhosIguais = (x, y, z, id) => {
  const mat = materialDe(id);
  const tem = (a, b) => objsAt(a, b, z).some(n => materialDe(n.o) === mat);
  return (tem(x, y - 1) ? 1 : 0) | (tem(x, y + 1) ? 2 : 0)
    | (tem(x - 1, y) ? 4 : 0) | (tem(x + 1, y) ? 8 : 0);
};

/* Quantos tiles abaixo da crista. É o que dá volume ao lance sem devolver a
   listra por tile: a sombra desce ao longo do muro inteiro. Para no
   `WALL_FUNDO` — abaixo disso já é o tom mais escuro e contar mais é gastar à
   toa num laço que roda por tile visível. */
const profParede = (x, y, z, id) => {
  let n = 0;
  while (n < WALL_FUNDO && objsAt(x, y - n - 1, z).some(v => v.o === id)) n++;
  return n;
};

const paredeEm = (x, y, z) => objsAt(x, y, z).some(n => (OBJ[n.o] || {}).cat === 'parede');
/* Tem alguma coisa COM VOLUME aqui? É o que decide em qual passe a marca sai:
   sobre chão vazio ela é decalque e o jogador pisa por cima; sobre parede ou
   objeto ela está NA coisa, e tem de sair depois dela. */
const temVolume = (x, y, z) => objsAt(x, y, z).some(n => {
  const c = (OBJ[n.o] || {}).cat; return c === 'parede' || c === 'objeto';
});

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
    /* Progressão visual: a arte sai do degrau do conjunto vestido, ou da escolha
       fixa do seletor de Opções (skinAtual, no data.js). Enquanto o PNG não
       chega — ou sem skin nenhuma — cai no boneco procedural, que é quem lê o
       equipamento peça a peça. Ele não é só o fundo do poço: é a única aparência
       em que trocar de arma muda o desenho. */
    const sk = skinAtual(P), dir = facingOf(P);
    if (sk === 'ranger') { const s = rangerSprite(dir, frameOf(P), CAM.scale); if (s) return s; }
    else if (sk) {
      /* Mesmo caminho da criatura com folha própria: célula fixa, coluna pelo
         progresso do passo. `uid` 0 porque só há um jogador — a fase do gesto de
         parado existe para o mapa inteiro não gesticular junto. */
      const q = criaQuadro(sk, dir, !!P.stepD, P.stepD ? (G.now - P.stepT) / P.stepD : 0, G.now, 0);
      const s = creatureSheet(sk, dir, q, CAM.scale, P_SZ);
      if (s) return s;
    }
    const cor = _num(VOCATIONS[P.voc].color);
    const eq = it => it ? _num(itemStats(it).color) : null;
    return creatureSprite('biped', cor, P_SZ, { skin: 0xe8c39e, weapon: eq(P.eq.weapon), shield: eq(P.eq.shield) },
      dir, frameOf(P));
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

function drawEntity(it, sx, sy, t, sol) {
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
    for (const [o, a] of [[.02, .5], [.07, .4 * sol]]) {
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
  dropShadow(spr, sx + ox + t / 2, sy + oy + t * CHAO, sol);
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
    /* PECA DE FOLHA primeiro, elipses como reserva -- mesma ordem do terreno e
       do objeto. O `multiply` continua: mancha TINGE o chao, tinta cobre, e com
       `source-over` a poca saia chapada por cima da textura, como adesivo.
       A reserva nao e decorativa: sem `Image` (o node dos testes) a peca nunca
       chega, e e ela que mantem o `drawWorld` headless desenhando sangue. */
    const spr = b.png && manchaSprite(b.png, b.cor);
    if (spr) {
      const w = spr.width * b.esc * (t / TS), h = spr.height * b.esc * (t / TS);
      g2.drawImage(spr, cx + b.dx * t - w / 2, cy + b.dy * t - h / 2, w, h);
    } else {
      g2.fillStyle = b.cor;
      for (const m of b.manchas) {
        g2.beginPath();
        g2.ellipse(cx + m.dx * t, cy + m.dy * t, m.rx * t, m.ry * t, 0, 0, 7);
        g2.fill();
      }
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
/* O GRADIENTE DO HALO É CACHEADO, e a regra já estava escrita no `edgeShadow`:
   criar um `CanvasGradient` por desenho a cada quadro é lixo à toa. O `halo` era
   quem a violava — numa tela coberta de campo de fogo foram medidos
   507 `createRadialGradient` POR QUADRO (254 fontes × passe de luz e bloom).

   Três coisas fazem o cache pegar de verdade:
   · o gradiente nasce na ORIGEM e o desenho se move até ele por `translate`.
     Criado em (x, y) ele seria de uma posição só, e cada fonte pediria o seu;
   · a FORÇA sai para o `globalAlpha`, e o que fica na chave é a RAZÃO entre as
     duas paradas. É isso que faz o tremor da chama não invalidar nada: ele
     multiplica `a0` e `a1` juntos, então a razão não muda. Ela é guardada em
     256 passos: em 64 a diferença contra o gradiente exato media 1,0 nível por
     canal, e em 256 cai para o invisível sem inchar o cache, porque as razões
     reais são poucas e fixas por tipo de luz;
   · o raio é arredondado ao pixel — diferença invisível, e sem isso um raio
     fracionário por quadro criaria uma entrada nova a cada vez.
   A chave inclui o CONTEXTO porque há dois (o buffer de luz e a tela), e
   gradiente não se garante compartilhável entre eles. */
const HALO_CACHE = new WeakMap();
function haloGrad(ctx, r, c, razao) {
  let m = HALO_CACHE.get(ctx);
  if (!m) HALO_CACHE.set(ctx, m = new Map());
  const k = c + '|' + r + '|' + razao;
  let gr = m.get(k);
  if (!gr) {
    gr = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    gr.addColorStop(0, `rgba(${c},1)`);
    gr.addColorStop(.5, `rgba(${c},${razao / 256})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    /* ponytail: o cache não expira. São poucas combinações reais (raio inteiro ×
       cor × razão em 64 passos) e elas se repetem o jogo inteiro; se um dia um
       efeito sortear raio contínuo, o conserto é um teto por contexto. */
    m.set(k, gr);
  }
  return gr;
}
function halo(ctx, x, y, r, cor, a0, a1) {
  const n = _num(cor);
  if (!(r > 0) || !(n >= 0) || !(a0 > 0)) return;   // cor estranha não derruba o quadro
  const c = `${n >> 16 & 255},${n >> 8 & 255},${n & 255}`;
  const ri = Math.max(1, Math.round(r));
  const razao = Math.max(0, Math.min(256, Math.round(a1 / a0 * 256)));
  const gr = haloGrad(ctx, ri, c, razao);
  const aAntes = ctx.globalAlpha;
  ctx.globalAlpha = aAntes * Math.min(1, a0);
  ctx.translate(x, y);
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, ri, 0, 7); ctx.fill();
  ctx.translate(-x, -y);
  ctx.globalAlpha = aAntes;
}
/* QUEM FECHA O RECINTO, e não `paredeEm`. Quem lê isto hoje é a chuva, a
   poça e o recorte de céu — o corte de luz da cobertura saiu do motor a pedido
   do dono: ele estava quebrado, e conserto em cima de conserto piorava o resto. Perguntar pela categoria `parede`
   deixa a PORTA de fora — ela é `cat: 'objeto'` —, e porta é um buraco no meio
   da fachada: o recorte não a apaga, mas a silhueta do vizinho cai em cima dela,
   e sobra uma mancha de sombra DENTRO de todo vão. O dono viu na hora, e o
   sintoma engana: pisando na porta o corpo cobre a mancha e ela "some", o que
   lê como se a sombra fosse chão.
   `salaDe === SALA_PAREDE` é a pergunta certa e é do próprio motor: o
   `calcDentro` marca assim tudo que fecha o recinto — parede, porta aberta ou
   fechada, e o que entrar depois. A vizinhança abrigada continua limitando isso
   à casa, senão uma pedra solta no campo viraria prédio. */
const daCasa = (x, y, z) => abrigado(x, y, z) ||
  (salaDe(x, y, z) === SALA_PAREDE && (abrigado(x - 1, y, z) || abrigado(x + 1, y, z) ||
                                       abrigado(x, y - 1, z) || abrigado(x, y + 1, z)));
/* QUEM RESPONDE "CAI CHUVA AQUI?" É A SUPERFÍCIE QUE O PIXEL MOSTRA, e num
   mapa de paredes frontais isso quase nunca é o chão do tile. A arte da parede
   cobre DOIS tiles — o dela e o de cima, porque ela sai de `sy - WALL_TOP` — e
   a face que ela desenha é sempre a VIRADA PARA O SUL, já que só existe um
   sprite. Daí a régua, e ela concilia os dois relatos do dono:
   · parede cuja vizinha ao SUL é interior está mostrando a face de DENTRO. Não
     chove nela — era o "tem luz/névoa/chuva de fora entrando na parte coberta
     da casa, na parede", visto de dentro da taverna;
   · parede cuja vizinha ao sul é rua está mostrando a FACHADA. Chove nela, e
     não chover era o "a parede da frente não está sendo afetada pela chuva".
   O tile de CIMA herda a resposta da parede que o cobre. Sem isso a fachada sai
   molhada embaixo e seca em cima, partida no meio da própria altura.
   `SALA_PAREDE` e não `paredeEm`: quem fecha o recinto é parede E PORTA, e a
   verga da porta transborda igual. */
const ehParede = (x, y, z) => salaDe(x, y, z) === SALA_PAREDE;
/* A parede também tem de estar descoberta ELA MESMA: com piso por cima, o
   andar de cima é o telhado dela, e a face não vê céu por mais aberta que
   esteja a rua ao sul. */
const faceExposta = (x, y, z) => !abrigado(x, y, z) && !abrigado(x, y + 1, z);
const ceuNoTile = (x, y, z) =>
    ehParede(x, y, z)     ? faceExposta(x, y, z)
  : ehParede(x, y + 1, z) ? faceExposta(x, y + 1, z)
  :                         !abrigado(x, y, z);
const _corDoAmb = amb => /(\d+)\D+(\d+)\D+(\d+)/.exec(amb || 'rgb(255,255,255)').slice(1).map(Number);
/* A LUZ PARA NA PAREDE, dos dois lados. O `halo` é gradiente radial puro: ele
   não perguntava geometria nenhuma, então a tocha da rua acendia a sala fechada
   ao lado e a tocha de dentro de casa vazava para a rua.

   A primeira versão respondia com o RÓTULO DE CÔMODO do `calcDentro`, e resolvia
   casa contra rua. Duas medições a derrubaram, e as duas importam:
   · o SUBSOLO é um cômodo só — dos 36.864 tiles do andar de baixo, 32.685 caem
     no mesmo "fora", então rochedo nenhum barrava tocha justamente onde a tocha
     é a única fonte de luz que existe;
   · PORTA ABERTA, que na inundação do `calcDentro` conta como parede de
     propósito (é a régua certa para "estou dentro de casa?"), apagava a luz que
     tem de passar pelo vão.

   Quem responde agora é uma inundação local a partir do tile da luz, barrada
   pelo `tapaVista` — a MESMA régua que decide o que o jogador enxerga, o que a
   flecha atravessa e o que o bicho vê. Uma régua só para os quatro, e ela já
   sabe que porta aberta é vão. O rótulo de cômodo continua existindo, mas para
   quem ele foi feito: o `dentroDeCasa`.

   Custa o mesmo que a versão de cômodo — a inundação varre a mesma janela —, e
   continua sem buffer novo e sem passe de tela cheia: um `clip` por luz. A
   versão com um segundo buffer de tela cheia foi medida em 2,7× o custo do
   quadro e caiu por isso. */
/* Memoizado na própria luz: `luzes` é esvaziado a cada quadro, então o cache
   dura um quadro e o passe de luz e o bloom, que percorrem a MESMA lista,
   constroem o recorte uma vez só em vez de duas. */
function recorteDaLuz(l, t) {
  if (l.rec === undefined) l.rec = recorteVisivel(l, t);
  return l.rec;
}
/* A INUNDAÇÃO É POR QUADRO, e o cache que eu tentei aqui FOI REVERTIDO.
   A ideia continua certa no papel — alcance de luz não muda enquanto a parede
   não muda, e medido deu 254 inundações por quadro → 0 numa tela de campo de
   fogo. Mas em jogo o dono viu o oposto: cena parada, sem chuva, caindo abaixo
   de 60, e 30 ao mexer no zoom. Foi a única mudança entre os 52 fps medidos e
   isso, então ela sai até haver medição que a defenda.
   Duas suspeitas ficam anotadas para quem retomar, nenhuma confirmada: o raio
   da tocha TREMULA a cada quadro e entra na chave (`R` sai de `l.r / t`), o que
   erra o cache e ainda o faz crescer; e o cache não tinha teto. Quem voltar a
   isto quantiza o raio da chave e põe limite de tamanho ANTES de medir de novo.
   ponytail: sem cache, cada luz refaz a busca em largura por quadro. É o preço
   conhecido, e ele é aceitável até alguém medir de novo com a chave estável. */
function recorteVisivel(l, t) {
  if (!(l.r > 0) || !(t > 0)) return null;  // raio ou tile degenerado: `l.r / t` daria Infinity
  const [lx, ly] = tileDaTela(l.x, l.y, t), z = P.z;
  /* O laço é limitado pela JANELA, não só pelo raio: recortar tile fora da tela
     é trabalho jogado fora, e sem esse teto um raio grande contra um tile
     pequeno varre o mapa inteiro por luz. */
  const [cols, rows] = janelaDeTiles(t);
  const cx = Math.floor(camX), cy = Math.floor(camY), R = Math.ceil(l.r / t) + 1;
  const x0 = Math.max(lx - R, cx - cols), x1 = Math.min(lx + R, cx + cols);
  const y0 = Math.max(ly - R, cy - rows), y1 = Math.min(ly + R, cy + rows);
  if (lx < x0 || lx > x1 || ly < y0 || ly > y1) return null;   // luz fora da janela
  const w = x1 - x0 + 1, vis = new Uint8Array(w * (y1 - y0 + 1));
  const idx = (x, y) => (y - y0) * w + (x - x0);
  const fila = [idx(lx, ly)];
  vis[fila[0]] = 1;
  for (let k = 0; k < fila.length; k++) {
    const i = fila[k], x = x0 + (i % w), y = y0 + ((i / w) | 0);
    /* A parede entra ACESA e não propaga: é a face dela que se vê. Sem isso o
       cômodo fica com o chão aceso e as paredes pretas, que é pior que o
       vazamento. O tile da própria luz nunca barra — tocha presa na parede,
       lava dentro do rochedo, e o halo não morreria na origem. */
    if (k && tapaVista(x, y, z)) continue;
    if (x > x0) { const j = i - 1; if (!vis[j]) { vis[j] = 1; fila.push(j); } }
    if (x < x1) { const j = i + 1; if (!vis[j]) { vis[j] = 1; fila.push(j); } }
    if (y > y0) { const j = i - w; if (!vis[j]) { vis[j] = 1; fila.push(j); } }
    if (y < y1) { const j = i + w; if (!vis[j]) { vis[j] = 1; fila.push(j); } }
  }
  /* Um retângulo por CORRIDA, e `null` quando nada barrou — esta parte FICA:
     ela foi medida (81 → 10 retângulos por luz) e é o que levou a cena de fogo
     de 10 para 55 fps. O custo de um `clip` é proporcional aos retângulos, e
     este recorte é aplicado duas vezes por luz (passe de luz e bloom). */
  const larg = x1 - x0 + 1, alt = y1 - y0 + 1;
  if (fila.length === larg * alt) return null;      // nada barrou: recorte dispensado
  const p = new Path2D();
  for (let y = y0; y <= y1; y++) {
    let ini = null;
    for (let x = x0; x <= x1 + 1; x++) {
      const dentro = x <= x1 && vis[idx(x, y)];
      if (dentro && ini === null) ini = x;
      else if (!dentro && ini !== null) {
        const [sx, sy] = cantoDoTile(ini, y, t);
        // +1 de folga fecha a costura entre tiles. Aqui pode: recorte é
        // booleano, ao contrário de alfa, que SOMA na sobreposição.
        p.rect(sx, sy, Math.round((x - ini - 1) * t) + t + 1, t + 1);
        ini = null;
      }
    }
  }
  return p;
}


/* ====================================================== LUZ EM WEBGL ======
   TROCA SO O LACO DE HALOS, e nada mais. O buffer de luz continua sendo um
   canvas 2D: o ambiente do ceu, o corte do telhado e as faixas de crista/face da
   parede seguem exatamente como estao, porque funcionam. O que sai e o laco que
   pinta um DISCO por fonte e o recorta por corridas de tile -- e e ele o
   "nao reflete luz de verdade": o disco atravessa parede, nao sai por vao, e a
   borda dele e o gradiente, nao a geometria.
   No lugar entra uma textura somada com `lighter`, onde cada pixel e CONTA:
   distancia ate a fonte, atenuacao, e uma marcha ate ela por uma textura de
   oclusao. Sombra e penumbra saem da mesma conta.
   RESERVA: sem WebGL, com o contexto perdido ou com o shader sem compilar,
   `luzGLTextura` devolve `null` e o `lightPass` usa o laco de hoje. O jogo nunca
   depende da GPU para desenhar -- e a mesma disciplina do `TEX_DRAW` ser reserva
   do PNG de terreno.
   TETO ANOTADO: a marcha tem 24 passos e a grade de oclusao e POR TILE, entao a
   sombra tem a resolucao do tile. Num jogo de tiles isso e justo, mas quer dizer
   que um vao de meia tile nao projeta meio facho. */
const LUZ_GL_MAX = 24;                   // fontes por passada; o resto vem somado

/* A LONA DE SILHUETA. As mesmas peças que vão para a tela vão também para cá,
   NO MESMO laço — dois laços divergiriam na primeira peça nova, e é a mesma
   razão de o editor chamar o render do jogo em vez de ter arte própria. Só o
   ALFA importa: o shader lê `.a`, então a peça entra desenhada como está e não
   há passe de conversão.
   SÓ QUANDO HÁ GPU. Sem WebGL — o node da suíte, por exemplo — `silG` fica nulo
   e nenhum blit extra acontece: o caminho de reserva não paga por isto.
   TETO ANOTADO: entram parede, porta e objeto; criatura e jogador não. Sombra
   de bicho mudaria a cada quadro e o corpo se sombrearia ao girar — quando
   quiser, o caminho é o mesmo, mais uma chamada no `drawEntity`. */
let silCv = null, silG = null;
function silhuetaDoQuadro() {
  if (!luzGLInicia()) { silG = null; return; }
  if (!silCv) silCv = document.createElement('canvas');
  if (silCv.width !== VW || silCv.height !== VH) { silCv.width = VW; silCv.height = VH; }
  silG = silCv.getContext('2d');
  silG.setTransform(1, 0, 0, 1, 0, 0);
  silG.globalCompositeOperation = 'source-over';
  silG.globalAlpha = 1;
  silG.imageSmoothingEnabled = false;
  silG.clearRect(0, 0, VW, VH);
}
let luzGL = null, luzGLFalhou = false;
const LUZ_VS = `attribute vec2 p; varying vec2 uv;
void main(){ uv = p * .5 + .5; uv.y = 1. - uv.y; gl_Position = vec4(p, 0., 1.); }`;
/* A CURVA E A MESMA DO `haloGrad`, de proposito: trocar o modelo de oclusao sem
   trocar a curva deixa a mudanca isolada. O gradiente de la tem parada em 0, .5
   e 1 com alfa 1, a1/a0 e 0, e o canvas interpola LINEAR entre elas -- entao
   aqui sao dois `mix`, e nao uma exponencial. */
const LUZ_FS = `precision highp float;
varying vec2 uv;
uniform sampler2D occ;
uniform vec2 res;
uniform vec2 occOrig;
uniform vec2 occTam;
uniform float tilePx;           // um tile em pixels de tela: a unidade da espessura
uniform int nLuz;
uniform vec3 luzCor[24];
uniform vec3 luzPos[24];
uniform vec2 luzA[24];
/* O OCLUSOR E A SILHUETA DO QUE FOI DESENHADO, e nao mais uma grade de um bit
   por tile. Na grade, barril, caixote, arvore, poco e carroca nao existiam --
   a tocha os atravessava como se fossem pintura no chao -- e a parede barrava
   com a forma do TILE. Agora a sombra tem a forma da PECA, e a borda dela vem
   macia do proprio alfa do sprite. Julgado na bancada tools/amostra/oclusor.html.
   Le o canal ALFA: o canvas de silhueta guarda as pecas desenhadas normalmente,
   entao converter para branco-sobre-preto seria um passe de tela cheia a toa.
   QUANTA COISA O RAIO ATRAVESSOU, em tiles -- e nao "atravessou, sim ou nao".
   A resposta binaria era o que fazia a luz sair QUADRADA. O passo entra na
   conta porque ele muda com a distancia da fonte: sem isso o mesmo muro vedaria
   mais de longe.
   SAI DO PROPRIO CORPO ANTES DE CONTAR: o pixel que cai DENTRO de uma peca se
   veria bloqueado por ela mesma, e a peca sairia com terra por cima. Pular um
   numero fixo de passos nao resolve -- quanto de corpo ha entre o pixel e a
   borda depende do tamanho da peca e da direcao. A regra e ignorar a CORRIDA
   INICIAL de amostras ocluidas: assim que o raio sai para o ar, comeca a
   contar. Encostado num muro, a espessura dele nao conta contra a propria face.
   Medido na bancada antes de vir para ca. */
float livre(vec2 a, vec2 b, float passo){
  vec2 d = (b - a) / 24.0;
  float bloq = 0.;
  bool saiu = false;
  for (int i = 1; i < 22; i++) {
    float v = texture2D(occ, a + d * float(i)).a;
    if (!saiu) { if (v > .5) continue; saiu = true; }
    bloq += v;
  }
  return exp(-bloq * passo * 4.0);
}
void main(){
  vec2 px = uv * res;
  vec3 col = vec3(0.);
  for (int i = 0; i < 24; i++) {
    if (i >= nLuz) break;
    float r = luzPos[i].z;
    float d = distance(px, luzPos[i].xy) / r;
    if (d >= 1.) continue;
    float a0 = luzA[i].x, a1 = luzA[i].y;
    float razao = a1 / max(a0, .0001);
    float f = d < .5 ? mix(1., razao, d / .5) : mix(razao, 0., (d - .5) / .5);
    float passo = distance(px, luzPos[i].xy) / max(tilePx, 1.) / 24.0;
    float oc = livre((px - occOrig) / occTam, (luzPos[i].xy - occOrig) / occTam, passo);
    col += luzCor[i] * (a0 * f * oc);
  }
  gl_FragColor = vec4(col, 1.);
}`;
function luzGLInicia() {
  if (luzGL || luzGLFalhou) return luzGL;
  try {
    const cv = document.createElement('canvas');
    const gl = cv.getContext('webgl', { antialias: false, premultipliedAlpha: false });
    if (!gl) throw new Error('sem webgl');
    const sh = (tipo, src) => { const o = gl.createShader(tipo);
      gl.shaderSource(o, src); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o));
      return o; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, LUZ_VS));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, LUZ_FS));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    /* DUAS TEXTURAS E DOIS FILTROS, e a diferenca entre eles e o ponto.
       A de OCLUSAO e NEAREST: quem veda a luz veda por tile inteiro, e
       interpolar ali borraria a quina da parede. A de COBERTURA e LINEAR: ali a
       interpolacao E a penumbra que se quer. */
    /* LINEAR, e nao NEAREST. Amostrando por tile a resposta so podia ser 0 ou
       1 e a sombra saia com a quina do tile -- e o relato foi exatamente esse:
       "esta muito pixelado", "cada parede reflete separadamente". Interpolando,
       a borda da parede vira meia tile de rampa e a marcha soma valores
       fracionarios: a mesma conta devolve penumbra em vez de degrau. O preco e
       a luz vazar meia tile na quina, que e o lado barato do erro. */
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(pr, 'occ'), 0);
    /* SOMA, e nao substitui: com mais de 24 fontes o quadro sai em varias
       passadas, e a soma e o que faz as passadas se juntarem. */
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    cv.addEventListener('webglcontextlost', e => { e.preventDefault(); luzGL = null; luzGLFalhou = true; });
    luzGL = { cv, gl, pr, tex, U: n => gl.getUniformLocation(pr, n) };
  } catch (e) {
    luzGLFalhou = true;
    console.warn('luz em WebGL indisponivel, usando o caminho 2D:', e.message);
  }
  return luzGL;
}
/* A GRADE DE OCLUSAO: quem veda a luz, por tile, na janela visivel mais folga.
   `tapaVista` e a mesma regua que o recorte 2D ja usa -- uma copia so. */
/* A TEXTURA DE OCLUSAO E A LONA DE SILHUETA, direto. Some a grade de tile, e
   com ela some o laco que a montava — era um `tapaVista` por tile da janela mais
   folga, todo quadro. O que entra no lugar ja foi desenhado durante o quadro
   pelos proprios blits do render. */
function luzGLTextura(t) {
  const L = luzGLInicia();
  if (!L || !luzes.length || !silCv) return null;
  const cv = L.cv, gl = L.gl, U = L.U;
  if (cv.width !== VW || cv.height !== VH) { cv.width = VW; cv.height = VH; }
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, L.tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, silCv);
  gl.viewport(0, 0, VW, VH);
  gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(U('res'), VW, VH);
  /* A silhueta e da TELA, entao a origem e o canto dela e o tamanho e a tela
     inteira: `(px - occOrig) / occTam` vira `px / res`, e as duas contas do
     shader continuam as mesmas. */
  gl.uniform2f(U('occOrig'), 0, 0);
  gl.uniform2f(U('occTam'), VW, VH);
  gl.uniform1f(U('tilePx'), t);
  const cor = new Float32Array(LUZ_GL_MAX * 3), pos = new Float32Array(LUZ_GL_MAX * 3),
        alf = new Float32Array(LUZ_GL_MAX * 2);
  for (let base = 0; base < luzes.length; base += LUZ_GL_MAX) {
    let n = 0;
    for (let k = base; k < Math.min(base + LUZ_GL_MAX, luzes.length); k++) {
      const l = luzes[k], num = _num(l.cor);
      if (!(l.r > 0) || !(num >= 0) || !(l.a0 > 0)) continue;
      cor[n * 3] = (num >> 16 & 255) / 255; cor[n * 3 + 1] = (num >> 8 & 255) / 255;
      cor[n * 3 + 2] = (num & 255) / 255;
      pos[n * 3] = l.x; pos[n * 3 + 1] = l.y; pos[n * 3 + 2] = l.r;
      alf[n * 2] = Math.min(1, l.a0); alf[n * 2 + 1] = l.a1 || 0;
      n++;
    }
    if (!n) continue;
    gl.uniform1i(U('nLuz'), n);
    gl.uniform3fv(U('luzCor'), cor);
    gl.uniform3fv(U('luzPos'), pos);
    gl.uniform2fv(U('luzA'), alf);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  return cv;
}

function lightPass(amb, t) {
  if (!lightCv) lightCv = document.createElement('canvas');
  if (lightCv.width !== VW || lightCv.height !== VH) { lightCv.width = VW; lightCv.height = VH; }
  const lg = lightCv.getContext('2d');
  lg.globalCompositeOperation = 'source-over';
  lg.fillStyle = amb.amb || 'rgb(255,255,255)'; lg.fillRect(0, 0, VW, VH);
  lg.globalCompositeOperation = 'lighter';
  /* A LUZ VEM DA GPU quando ela existe, e do laco de discos quando nao. O que
     muda e so a producao da mancha: em GL cada pixel pergunta a distancia e
     marcha ate a fonte pela grade de oclusao, entao a luz PARA na parede e SAI
     pelo vao. No 2D ela e um disco recortado por corridas de tile. */
  const luzTex = luzGLTextura(t);
  if (luzTex) lg.drawImage(luzTex, 0, 0);
  else for (const l of luzes) {
    const rec = recorteDaLuz(l, t);
    if (rec) { lg.save(); lg.clip(rec); }
    halo(lg, l.x, l.y, l.r, l.cor, l.a0, l.a1);
    if (rec) lg.restore();
  }
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
function bloomPass(t) {
  g2.globalCompositeOperation = 'lighter';
  for (const l of luzes) {
    if (l.tocha) continue;
    // o que EMITE também para na parede: lava atrás de um muro não pode
    // clarear a rua do outro lado
    const rec = recorteDaLuz(l, t);
    if (rec) { g2.save(); g2.clip(rec); }
    halo(g2, l.x, l.y, l.r * BLOOM_R, l.cor, l.a0 * BLOOM_A, l.a1 * BLOOM_A * .6);
    if (rec) g2.restore();
  }
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
/* A CURVA. Três controles clássicos de grading, e cada um manda numa parte da
   imagem: `GANHO` multiplica (as altas), `GAMA` exponencia (os médios) e `LIFT`
   soma (as sombras, puxando-as para a cor do céu). O `soft-light` de hoje faz
   um pouco dos três ao mesmo tempo e não deixa separar nenhum.
   `SPLIT` é o que dá a hora: sombra para o complemento do céu, alta para o céu.
   É por isso que o poente fica quente na luz e frio na sombra, em vez de ficar
   laranja por igual.
   Os quatro saíram da bancada `tools/amostra/shader.html`, olhando no zoom 1 —
   número de grading não se escolhe em tabela. */
const GRADE_LIFT = .18, GRADE_GAMA = 1.04, GRADE_GANHO = 1.06, GRADE_SPLIT = .22;
/* A FORÇA, e ela é o conserto de um erro meu. O passe de hoje aplica o tinte a
   `GRADE_A` = 30% de alfa; a primeira versão do shader aplicava a curva inteira
   a 100%, sem knob nenhum — e o relato foi imediato: "muito claro". A curva
   descreve o TRATAMENTO; a força diz quanto dele entra, e é ela que se mexe
   olhando o jogo. Mistura dentro do shader, não num segundo `drawImage` com
   alfa: um passe só, e o número fica explícito. */
const GRADE_FORCA = .30;
/* A NOITE MUDA DE MATIZ, e não só de brilho. O ambiente do céu é um MULTIPLY, e
   multiply só SUBTRAI: com a arte de chão medindo B/G 0,17, nenhum céu azul
   consegue levar o azul acima do verde sem apagar o quadro junto. Medido em
   campo aberto, sem fonte de luz: a tela ia de B/R 0,30 ao meio-dia a 0,63 de
   madrugada — mais azul, sim, mas ainda um VERDE escuro, quando a hora devia ser
   contada pela cor.
   Quem resolve é `color`: ele toma matiz e saturação e PRESERVA a luminosidade,
   então a noite fica azul sem clarear um pixel — a mesma receita que o sangue já
   usa para recolorir sem chapar a peça numa silhueta. Some sozinho de dia porque
   o céu de meio-dia é branco, e branco não tem matiz para impor.
   Fora do buffer de luz de propósito: lá dentro ele só caberia como mais um
   multiply, que é o beco de onde este item saiu. */
/* Céu normalizado para meio-tom: o que sobra dele é só a INCLINAÇÃO de cor, sem
   o brilho. O `gradePass` e o `horaPass` pedem a mesma coisa, e ela é uma função
   e não duas contas iguais — duas cópias divergem no dia em que alguém mexer numa. */
function ceuNorm() {
  const [r, g, b] = ceuRGB;
  const f = 128 / Math.max(1, r * .3 + g * .6 + b * .1);
  return [Math.min(255, r * f) | 0, Math.min(255, g * f) | 0, Math.min(255, b * f) | 0];
}

/* A HORA SE CONTA PELA COR, não só pelo brilho — e este passe vai ANTES do de
   luz, que é onde a primeira versão errou.

   O ambiente do céu é um MULTIPLY, e multiply só SUBTRAI: com a arte de chão
   medindo B/G 0,17, nenhum céu azul leva o azul acima do verde sem apagar o
   quadro junto. Medido em campo aberto, sem fonte de luz, a tela ia de B/R 0,30
   ao meio-dia a 0,63 de madrugada — mais azul, mas ainda um VERDE escuro.
   Quem resolve é `color`: toma matiz e saturação e PRESERVA a luminosidade,
   então a noite fica azul sem clarear um pixel — a mesma receita que o sangue já
   usa para recolorir sem chapar a peça numa silhueta. Some sozinho de dia,
   porque céu de meio-dia é branco e branco não tem matiz para impor.

   O LUGAR É QUE É O PONTO. Rodando no fim, junto do `gradePass`, ele tingia
   também a poça da tocha: medido no pátio do templo com TRÊS tochas acesas,
   4,2% de pixels quentes caíam para 0,2%. Uma tocha existe para abrir uma poça
   quente no escuro, e um tinte que a apaga tirou a única coisa que ela fazia.
   Antes do passe de luz, o halo quente MULTIPLICA por cima e come o azul de
   volta onde ele alcança: fora da luz o mundo é azul, dentro dela é quente.

   A rampa é a luminância do céu sobre 200, a mesma escala do sol no
   `climaAgora` — e não o `escuro` do ambiente, que sai do canal MÍNIMO e por
   isso marca 0,69 no poente contra 0,78 da meia-noite, empatando duas horas que
   não se parecem em nada. */
const NOITE_MATIZ = .45;   // da escada 0 / .25 / .45 / .65 no campo, a 1x: em .25 ainda le verde, .65 nao acrescenta

/* EXPOSIÇÃO DO DIA. O quadro ao meio-dia com céu limpo mede 0,332 de
   luminância; a referência que motivou a leva fica em ~0,50. O defeito não é dos
   passes: a `grama_clara` mede 0,36 de valor NO ARQUIVO e a `grama` 0,40 — a
   arte é que nasceu escura, e o passe de luz nem roda ao meio-dia pleno
   (multiplicar por branco é trabalho à toa). Por isso o ajuste é de EXPOSIÇÃO e
   não de arte: mexer nos PNG de chão deixaria objeto, árvore e criatura para
   trás, e são 105 peças de folha mais as criaturas.

   Ganho de verdade, não clareamento: o canvas somado a si mesmo em `lighter`
   dá `c + k·c`, que multiplica. Preto continua preto — um `fillRect` cinza em
   `lighter` somaria uma constante e lavaria as sombras, que é o contrário do
   que uma direção de arte escura quer.

   E ele é DO DIA. A queixa é que o escuro se gasta antes da noite; abrir a
   faixa quer dizer clarear o dia SEM tocar na noite. A rampa zera com o céu na
   metade do brilho: meio-dia 1,00 · poente 0,31 · madrugada 0,00. Dentro do
   recorte de céu, então interior, telhado e caverna seguem escuros como são.

   A ESCADA, medida no campo ao meio-dia (luminância · % de pixel estourado):
   0 → 0,337 · 0,00%   |   0,15 → 0,386 · 0,02%
   0,30 → 0,437 · 0,10%   |   0,45 → 0,484 · 0,14%
   A referência que motivou a leva fica em ~0,50, e 0,45 chega lá — mas a 1× o
   campo começa a lavar e a roupa do boneco perde contraste contra a grama. 0,30
   é onde o dia lê como dia e o jogo mantém o peso. É UM NÚMERO: mexer nele é a
   forma de mudar de ideia, e 0 volta exatamente ao que era. */
const EXPO_DIA = .30;
function horaPass() {
  const [r, g, b] = ceuRGB;
  const noite = NOITE_MATIZ * Math.max(0, 1 - (r * .3 + g * .6 + b * .1) / 200);
  if (noite <= .01) return 0;
  const n = ceuNorm();
  g2.save();
  g2.globalCompositeOperation = 'color';
  g2.globalAlpha = noite;
  g2.fillStyle = `rgb(${n[0]},${n[1]},${n[2]})`;
  g2.fillRect(0, 0, VW, VH);
  g2.restore();
  return noite;
}

/* O PASSE DE LENTE EM WEBGL, e por que ele é opcional.
   A curva acima é por pixel e por canal — canvas 2D não faz isso sem varrer o
   quadro na CPU. Um shader faz, e o protótipo (`tools/amostra/webgl.html`)
   mediu o preço da rota: subir o quadro pronto como textura custa ZERO dentro
   da régua, mesmo a 8,29 M de pixels.
   O que NÃO se faz aqui: trocar qual canvas é o visível. O mundo continua sendo
   desenhado no `gcv` de sempre, o shader lê ele, e o resultado volta por um
   `drawImage`. Assim o `index.html`, o editor e o HUD não sabem que isto
   existe, e desligar é apagar uma função.
   E ele DEGRADA: sem WebGL — o node dos testes não tem —, o passe de hoje
   continua valendo. É isso que mantém o `drawWorld` headless, que foi quem
   pegou a máscara de telhado meio tile fora. */
const GRADE_VS = `attribute vec2 p; varying vec2 uv;
void main(){ uv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
const GRADE_FS = `precision mediump float; varying vec2 uv;
uniform sampler2D cena; uniform vec3 ceuN;
uniform float lift, gama, ganho, split, forca;
void main(){
  vec3 orig = texture2D(cena, vec2(uv.x, 1. - uv.y)).rgb;
  vec3 c = orig;
  c *= ganho;
  c = pow(max(c, 0.0), vec3(gama));
  /* ceuN e a cor do ceu NORMALIZADA para meio-tom: o que sobra dela e so a
     INCLINACAO de cor, sem o brilho. Com a cor crua, o branco do meio-dia
     empurrava tudo para o branco e o campo saia leitoso — o mesmo motivo pelo
     qual o soft-light de hoje ja normaliza. */
  c += lift * ceuN * (1.0 - c);
  float l = dot(c, vec3(.3, .6, .1));
  c = mix(c, mix(vec3(1.0) - ceuN, ceuN, l), split);
  gl_FragColor = vec4(clamp(mix(orig, c, forca), 0.0, 1.0), 1.0);
}`;
let gradeCv = null, gradeGL = null, gradeMorto = false;
function gradeShader() {
  /* A ORDEM IMPORTA: escrito `gradeGL || gradeMorto`, marcar `gradeMorto` não
     desligava nada depois que o contexto já tinha subido — a função devolvia o
     `gradeGL` vivo assim mesmo. Só se via ao perder o contexto no meio do jogo:
     o `catch` marcava morto e o quadro seguinte voltava a tentar usar o
     contexto quebrado. */
  if (gradeMorto) return null;
  if (gradeGL) return gradeGL;
  try {
    gradeCv = document.createElement('canvas');
    const gl = gradeCv.getContext('webgl', { antialias: false, depth: false, stencil: false,
      /* `preserveDrawingBuffer: FALSE`, e o `false` é o ponto. Ele obriga o
         driver a guardar o backbuffer em vez de trocá-lo, e isso desliga
         caminho rápido em vários — o protótipo que aprovou esta rota mediu com
         `false` e eu embarquei com `true`, que é justamente a diferença que
         apareceu no `/fps` do dono. Dá para viver sem: o `drawImage(gradeCv)`
         acontece na MESMA tarefa do `drawArrays`, e o buffer só é descartado na
         composição, no fim da tarefa. */
      alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    if (!gl) throw 0;
    const compila = (t, src) => {
      const s = gl.createShader(t);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compila(gl.VERTEX_SHADER, GRADE_VS));
    gl.attachShader(prog, compila(gl.FRAGMENT_SHADER, GRADE_FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gradeGL = { gl, u: n => gl.getUniformLocation(prog, n) };
  } catch (e) { gradeMorto = true; gradeCv = gradeGL = null; }
  return gradeGL;
}
/* Devolve o canvas com o quadro já tratado, ou null se não deu — e `null` é um
   caminho normal, não um erro: o chamador cai no passe de hoje. */
function gradeEmGL(norm) {
  const G = gradeShader();
  if (!G) return null;
  try {
    const { gl, u } = G;
    if (gradeCv.width !== VW || gradeCv.height !== VH) { gradeCv.width = VW; gradeCv.height = VH; }
    gl.viewport(0, 0, VW, VH);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gcv);
    gl.uniform1i(u('cena'), 0);
    gl.uniform3f(u('ceuN'), norm[0] / 255, norm[1] / 255, norm[2] / 255);
    gl.uniform1f(u('lift'), GRADE_LIFT);
    gl.uniform1f(u('gama'), GRADE_GAMA);
    gl.uniform1f(u('ganho'), GRADE_GANHO);
    gl.uniform1f(u('split'), GRADE_SPLIT);
    gl.uniform1f(u('forca'), GRADE_FORCA);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return gradeCv;
  } catch (e) { gradeMorto = true; return null; }   // contexto perdido: volta para o 2D e não tenta mais
}
function gradePass(ceu) {
  if (!ambienteDe(P.z).amb) {
    const [r, g, b] = ceuRGB;            // já calculada uma vez no quadro
    const norm = ceuNorm();
    const tratado = gradeEmGL(norm);
    g2.save();
    /* SÓ onde há céu. O telhado corta a LUZ do céu no buffer de luz, e este
       passe devolvia a COR dele por cima, na tela inteira — o gate era "este
       andar tem céu?", nunca "este tile tem céu?". A vinheta fica FORA do
       recorte de propósito: ela é lente, não céu.
       O recorte fica no 2D mesmo com o shader ligado: o GL trata o quadro
       inteiro e só a região de céu volta. Assim o `recorteCeu` continua sendo
       um `Path2D` e o shader não precisa de máscara nenhuma subindo por
       quadro — que é justamente o que separa este item do feixe de luz. */
    if (ceu) g2.clip(ceu);
    if (tratado) {
      g2.drawImage(tratado, 0, 0);
    } else {
      g2.globalCompositeOperation = 'soft-light';
      g2.globalAlpha = GRADE_A;
      g2.fillStyle = `rgb(${norm[0]},${norm[1]},${norm[2]})`;
      g2.fillRect(0, 0, VW, VH);
    }
    /* A exposição vai por ÚLTIMO dentro do recorte, depois do grade: ela é um
       ganho uniforme, então escala a poça da tocha junto e o contraste relativo
       entre dentro e fora da luz não muda. (Ao contrário do tinte da hora, que
       precisou subir para antes do passe de luz justamente por NÃO ser
       uniforme.) De noite `dia` é zero e nada disto roda. */
    const dia = Math.max(0, Math.min(1, ((r * .3 + g * .6 + b * .1) / 200 - .5) * 2));
    if (EXPO_DIA * dia > .01) {
      g2.globalCompositeOperation = 'lighter';
      g2.globalAlpha = EXPO_DIA * dia;
      g2.drawImage(gcv, 0, 0);
    }
    g2.restore();
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

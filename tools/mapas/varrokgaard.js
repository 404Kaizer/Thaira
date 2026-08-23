/* varrokgaard.js — a ilha inicial, DESENHADA.
   Rode com:  node tools/mapas/varrokgaard.js

   Composição em mundo_varrokgaard.html. Cada bloco aqui corresponde a um lugar
   de lá, na mesma ordem, para conferir o desenho contra o texto sem procurar.

   192×192 em TRÊS andares — Sobre o Muro, a ilha e a Goela. É o piso de tamanho
   de mapa, e a terceira volta do desenho: a primeira, a 64², foi reprovada por
   inteiro (#46); a segunda foi JOGADA e voltou com dez pontos. Cada um deles
   está marcado abaixo com `#N`, no lugar onde é atendido.

   O andar de cima existe por causa do #7 e é quase todo VOID: só a ponte sobre
   o muro tem chão. O motor já empilha andares — desenha o de cima quando o
   jogador não está coberto —, então a ponte não pediu código de motor nenhum. */
'use strict';
const C = require('../compor');
const { T } = C;

const MURO = 0, S = 1, GOELA = 2;          // sobre o muro, superfície, subsolo
const L = 192;
const m = C.novoMapa({
  nome: 'varrokgaard', w: L, h: L, andares: 3, sup: S,
  nomes: ['Sobre o Muro', 'Varrokgaard', 'A Goela']
});

const NB8 = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
const CHAO = new Set([T.GRASS, T.DIRT, T.SAND, T.CROP, T.PAVE]);
const MAR  = new Set([T.WATER, T.VOID]);

/* Pintar região por forma geométrica NUNCA pode criar terra. É a régua mais
   cara que este mapa aprendeu, e ela falha de dois jeitos com custos
   diferentes: um retângulo de lavoura pôs 168 tiles do outro lado da enseada e
   a conferência de componentes pegou; mas um DISCO encostado na costa emenda no
   continente, engorda a silhueta e NÃO desconecta nada — a conferência passa
   verde e a ilha vira bolacha em silêncio. */
function emTerra(x, y, t) { if (!MAR.has(C.le(m, S, x, y))) C.pinta(m, S, x, y, t); }
function discoTerra(cx, cy, r, t) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++)
    for (let x = Math.floor(cx - r); x <= cx + r; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) emTerra(x, y, t);
}

/* ---------------------------------------------------------------- o mar */
C.retangulo(m, S, 0, 0, L, L, T.WATER);
C.retangulo(m, MURO, 0, 0, L, L, T.VOID);

/* --------------------------------------------------------------- a ilha
   O que dá forma a uma ilha é acidente GRANDE, não erosão de borda. Aqui a
   ENSEADA cortando o oeste — que agora é a FOZ do rio, e não um recorte
   decorativo — e o CABO DO SAL saindo a leste, de pescoço estreito. */
C.poligono(m, S, [
  [80, 11], [112, 9], [136, 21], [151, 40],       // norte: o alto da ilha
  [147, 64], [163, 73], [188, 81], [184, 99],     // o Cabo do Sal
  [163, 93], [147, 98], [147, 131],
  [138, 155], [112, 175], [86, 179], [63, 170],   // sul
  [46, 152], [35, 132],
  [55, 121], [69, 108], [52, 97],                 // a enseada = a foz
  [21, 74], [27, 43], [51, 19]
], T.GRASS);
C.rasga(m, S, T.GRASS, T.WATER, 101, .45, 2);
C.rasga(m, S, T.WATER, T.GRASS, 202, .28, 1);

/* Areia na linha d'água DO MAR, e só dela — e ela é calculada ANTES do rio de
   propósito. O rio desemboca no mar, então depois de cavado os dois são um só
   corpo d'água conectado, e uma varredura feita depois daria praia de areia nas
   margens do rio inteiro. Margem de rio é barro e mata; areia ali o faria ler
   como riacho de parque. */
C.espalha(m, S, T.SAND, 1, 306, (x, y, t) => t === T.GRASS &&
  NB8.some(([dx, dy]) => C.le(m, S, x + dx, y + dy) === T.WATER));

/* ============================================================= O RIO (#5)
   O relato foi que a mata tinha "1 tile de água, às vezes 2 ou 3, e isso não é
   um rio". Estava certo, e a correção veio da geografia e não do gosto: rio não
   é mancha, é BACIA. Nasce em terreno alto, corre sempre para baixo, RECEBE
   afluente (nunca se divide, salvo delta), meandra no curso baixo e desemboca.
   Aqui: nasce na Pedreira Rasa, que é a parte alta da ilha; desce para sudoeste
   ganhando o afluente da Mata Funda; meandra pela lavoura, que é plana; e
   desemboca na enseada, que passa a ser a FOZ e não um recorte de silhueta.
   Um tile solto de água no meio da mata é geologicamente impossível, e eu tinha
   feito 46 deles. */
const RIO = [
  [126, 52], [122, 60], [118, 66],                 // a nascente, na pedreira
  [112, 71], [104, 74], [96, 77],                  // curso alto: estreito e reto
  [89, 82], [86, 90], [90, 97],                    // o primeiro meandro
  [86, 104], [78, 107], [70, 105],                 // o segundo, já na planície
  [62, 108], [55, 112], [48, 113]                  // a foz, na enseada
];
/* Largura CRESCENTE: rio de cabeceira é um risco, rio de foz é largo. É a
   diferença entre "linha de água" e rio, e ela se lê andando ao lado.
   Os números levaram duas medições. Com cabeceira de 1 tile a erosão da margem
   comia o curso alto inteiro — sobravam OITO tiles de água em toda a metade de
   cima. E com foz de 4 tiles o curso baixo desaguava tão largo que fundia com a
   enseada e a metade sudoeste da ilha virava golfo: 404 tiles de água, e o que
   se lia na planta era costa, não rio. Dois na cabeceira, três na foz. */
for (let i = 0; i + 1 < RIO.length; i++) {
  const esp = i < 6 ? 2 : 3;
  C.linha(m, S, RIO[i][0], RIO[i][1], RIO[i + 1][0], RIO[i + 1][1], T.WATER, esp);
}
/* O AFLUENTE da Mata Funda. Só se JUNTA ao principal — rio não se divide, e um
   braço que sai do tronco e some seria a mesma mentira do tile solto. */
C.caminho(m, S, [[52, 46], [60, 56], [70, 66], [80, 73], [89, 82]], T.WATER, 2);
/* Erosão LEVE, e num passe só: a margem tem de ficar irregular sem o rio
   perder a continuidade. A .18 ela apagava a cabeceira. */
C.rasga(m, S, T.WATER, T.GRASS, 303, .10, 1);      // margem irregular, não canal

/* Poça solta não existe em geografia nenhuma, e a erosão da margem cria uma
   dúzia delas a cada passe. Todo corpo d'água que não seja o mar nem o rio some
   aqui: é a mesma varredura de componentes do chão, do outro lado. */
function limpaPocas(min) {
  /* TÁBUA SOBRE ÁGUA AINDA É ÁGUA, e esta linha custou o curso baixo do rio
     inteiro. A ponte não cobre o tile de água — ela o SUBSTITUI por PIER —,
     então cada travessia partia o rio em dois corpos separados, e os pedaços
     abaixo de 40 tiles eram varridos daqui como se fossem poça. O resultado foi
     um rio que nascia na pedreira e sumia no meio da lavoura.
     A travessia atravessa os dois; só o tile de ÁGUA conta para o tamanho e só
     ele é apagado. */
  const AGUA = t => t === T.WATER || t === T.PIER;
  const vis = new Set(); let n = 0;
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
    if (vis.has(y * L + x) || C.le(m, S, x, y) !== T.WATER) continue;
    const bloco = [[x, y]], pilha = [[x, y]]; vis.add(y * L + x);
    while (pilha.length) { const [cx, cy] = pilha.pop();
      for (const [dx, dy] of NB8) { const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= L || ny >= L || vis.has(ny * L + nx)) continue;
        if (!AGUA(C.le(m, S, nx, ny))) continue;
        vis.add(ny * L + nx);
        if (C.le(m, S, nx, ny) === T.WATER) bloco.push([nx, ny]);
        pilha.push([nx, ny]); } }
    if (bloco.length < min) { for (const [bx, by] of bloco) C.pinta(m, S, bx, by, T.GRASS); n++; }
  }
  return n;
}
const pocasLimpas = limpaPocas(40);

/* O LEITO DO RIO, guardado agora. Toda estrada é desenhada depois dele e por
   cima dele, e a primeira volta deixou isso assim: o `caminho` pintou terra
   sobre a água e a estrada virou um DIQUE — o rio saiu cortado em pedaços, a
   ilha partiu em duas com 19% do outro lado, e as poças que sobraram eram os
   trechos separados.
   O conserto não é desviar a estrada nem cravar tábua à mão: é dizer que
   estrada sobre rio É PONTE. Guardado o leito, uma varredura no fim converte
   todo tile de leito que virou chão em PIER, que existe justamente para ser
   tábua sobre a água. Vale para qualquer estrada futura sem eu ter de lembrar. */
const LEITO = new Set();
for (let y = 0; y < L; y++) for (let x = 0; x < L; x++)
  if (C.le(m, S, x, y) === T.WATER) LEITO.add(y * L + x);
function pontesNasEstradas() {
  let n = 0;
  for (const k of LEITO) {
    const x = k % L, y = (k / L) | 0;
    const t = C.le(m, S, x, y);
    if (t === T.DIRT || t === T.PAVE) { C.pinta(m, S, x, y, T.PIER); n++; }
  }
  return n;
}

/* A MATA-GALERIA. É o achado da pesquisa que mais mudou o mapa: a faixa de
   vegetação da margem — a zona ripária — tem solo úmido e fértil, mata mais
   densa que o entorno, e forma um CORREDOR por onde o bicho se desloca. Duas
   coisas caem de graça: a Mata Funda deixa de estar onde está por acaso (ela é
   a mata do curso alto) e o corredor de caça deixa de precisar de trilha
   inventada. A densidade cai com a distância da água, como funciona de fato. */
function distDaAgua(x, y, r) {
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++)
    if (C.le(m, S, x + i, y + j) === T.WATER) return Math.hypot(i, j);
  return 99;
}
const galeria = C.mulberry32(404);
C.espalha(m, S, T.TREE, 1, 405, (x, y, t) => {
  if (t !== T.GRASS) return false;
  const d = distDaAgua(x, y, 6);
  return d < 6 && galeria() < .58 - d * .09;
});

/* ================================================== a metade selvagem ===
   MATA FUNDA — a mata do curso alto, densa em volta do afluente. */
const MATA_X = 58, MATA_Y = 40, MATA_R = 28;
discoTerra(MATA_X, MATA_Y, MATA_R, T.GRASS);
const naMata = r2 => (x, y, t) => t === T.GRASS &&
  (x - MATA_X) ** 2 + (y - MATA_Y) ** 2 < r2;
C.espalha(m, S, T.TREE, .54, 407, naMata(MATA_R * MATA_R));
C.espalha(m, S, T.TREE, .24, 408, naMata((MATA_R + 12) ** 2));   // a orla, rala
discoTerra(50, 43, 5, T.GRASS);                                  // a clareira do Alfa
C.caminho(m, S, [[66, 64], [61, 53], [54, 45]], T.GRASS, 1);
C.caminho(m, S, [[38, 60], [45, 48], [57, 35], [72, 30]], T.GRASS, 1);
C.caminho(m, S, [[50, 43], [37, 47], [30, 55]], T.GRASS, 1);
C.caminho(m, S, [[50, 43], [56, 28], [66, 20]], T.GRASS, 1);

/* PEDREIRA RASA — a parte alta da ilha, e por isso a nascente. Veio à vista na
   parede do pátio, que é o que ensina minerar sem uma linha de texto. */
const PED_X = 124, PED_Y = 42;
C.poligono(m, S, [[100, 16], [143, 25], [151, 51], [127, 61], [96, 41]], T.ROCK);
C.rasga(m, S, T.ROCK, T.GRASS, 505, .30, 1);
discoTerra(PED_X, PED_Y, 9, T.DIRT);
C.espalha(m, S, T.GRAVEL, .30, 506, (x, y, t) =>
  t === T.DIRT && (x - PED_X) ** 2 + (y - PED_Y) ** 2 < 81);
for (const [x, y] of [[113, 36], [114, 37], [134, 38], [135, 39], [120, 53], [121, 54],
                      [131, 52], [110, 45], [138, 47]])
  C.pinta(m, S, x, y, T.ORE);
C.caminho(m, S, [[124, 64], [124, 56], [124, 48]], T.DIRT, 3);
C.caminho(m, S, [[126, 38], [132, 30], [136, 25]], T.DIRT, 2);
discoTerra(136, 25, 2, T.DIRT);                                  // o mirante

/* ==================================================== a Cerca Nova ======
   #6 · A linha era torta: 242 tiles espalhados por ONZE fileiras, de y 69 a 79,
   porque eu tinha posto um sorteio de ondulação achando que daria naturalidade.
   Deu desleixo. Cerca de fazenda se levanta a corda e prumo — o que a torce é o
   TERRENO, não o acaso. Agora é reta, e quem a interrompe é a água e a rocha.
   #7/#8 · e ela CONTINUA sendo cerca de madeira: quem virou muro de pedra foi a
   proteção da vila, que é outra construção com outra função. A Cerca Nova
   separa a fazenda do mato; o muro protege quem dorme. */
const CERCA_Y = 70;
let cercaTiles = 0;
for (let x = 18; x < L - 18; x++) for (let dy = 0; dy <= 1; dy++) {
  if (!CHAO.has(C.le(m, S, x, CERCA_Y + dy))) continue;
  C.pinta(m, S, x, CERCA_Y + dy, T.FENCE); cercaTiles++;
}
for (let x = 24; x < L - 24; x += 17) for (let dy = 0; dy <= 1; dy++)
  if (C.le(m, S, x, CERCA_Y + dy) === T.FENCE) C.pinta(m, S, x, CERCA_Y + dy, T.WALL);
C.linha(m, S, 26, CERCA_Y + 4, 166, CERCA_Y + 4, T.DIRT, 1);     // o caminho de ronda
const PORTAO_X = 92;
C.retangulo(m, S, PORTAO_X - 2, CERCA_Y - 2, 5, 6, T.DIRT);
C.retangulo(m, S, PORTAO_X - 3, CERCA_Y - 1, 1, 3, T.WALL);
C.retangulo(m, S, PORTAO_X + 3, CERCA_Y - 1, 1, 3, T.WALL);
C.retangulo(m, S, PORTAO_X + 6, CERCA_Y + 1, 7, 6, T.WALL);      // o posto do guarda
C.retangulo(m, S, PORTAO_X + 7, CERCA_Y + 2, 5, 4, T.FLOOR);
C.pinta(m, S, PORTAO_X + 9, CERCA_Y + 6, T.DOOR);
C.pinta(m, S, PORTAO_X + 14, CERCA_Y + 3, T.BARREL);             // #10
C.caminho(m, S, [[PORTAO_X, 68], [80, 62], [70, 58], [66, 64]], T.GRASS, 2);
C.caminho(m, S, [[PORTAO_X, 68], [104, 64], [116, 63], [124, 64]], T.DIRT, 2);
discoTerra(122, CERCA_Y + 2, 3, T.ROCK);                         // a pedra do meio
discoTerra(122, CERCA_Y - 3, 3, T.GRASS);

/* ============================================================== o sul ===
   OS TRIGAIS, na planície do rio — que é onde lavoura fica de verdade: solo de
   várzea, plano e úmido. */
function talhao(x0, y0, w, h) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const t = C.le(m, S, x, y);
    if (t === T.GRASS || t === T.DIRT) C.pinta(m, S, x, y, y % 4 === 0 ? T.DIRT : T.CROP);
  }
}
function divisa(pts) { C.caminho(m, S, pts, T.FENCE, 1); }
const TRI_X = 66, TRI_Y = 90, TRI_R = 19;
talhao(54, 76, 17, 12);
talhao(78, 80, 13, 11);
talhao(56, 92, 14, 10);
talhao(78, 96, 12, 12);
talhao(58, 118, 15, 10);
divisa([[53, 90], [72, 89]]);
divisa([[75, 78], [75, 92]]);
divisa([[57, 116], [72, 115]]);
C.caminho(m, S, [[75, 78], [75, 92], [72, 114], [80, 126]], T.DIRT, 2);
C.pinta(m, S, 73, 100, T.CART);                                  // #10, na carreira

/* CORTE VELHO — mata que alguém corta há gerações. O que diz CORTE não é a
   densidade, é a marca do machado: clareiras RETANGULARES dentro do mato. */
const COR_X = 140, COR_Y = 104, COR_R = 19;
discoTerra(COR_X, COR_Y, COR_R, T.GRASS);
const noCorte = (x, y) => (x - COR_X) ** 2 + (y - COR_Y) ** 2 < COR_R * COR_R;
C.espalha(m, S, T.TREE, .56, 701, (x, y, t) => t === T.GRASS && noCorte(x, y));
for (const [x, y, w, h] of [[128, 94, 9, 6], [141, 92, 7, 8], [132, 108, 11, 6],
                            [146, 104, 7, 7], [136, 117, 8, 5]])
  C.retangulo(m, S, x, y, w, h, T.GRASS);
C.espalha(m, S, T.DIRT, .20, 702, (x, y, t) => t === T.GRASS && noCorte(x, y));
C.caminho(m, S, [[124, 118], [136, 106], [150, 96]], T.DIRT, 2);
C.retangulo(m, S, 144, 112, 5, 4, T.WALL);                       // o rancho do lenhador
C.retangulo(m, S, 145, 113, 3, 2, T.FLOOR);
C.pinta(m, S, 146, 115, T.DOOR);
C.pinta(m, S, 150, 113, T.CART);                                 // #10, a carroça de tora
C.pinta(m, S, 143, 117, T.BARREL);

/* ================================================== VARROK, a vila ======
   A pesquisa mudou a planta. Vila medieval NÃO tem grade: as ruas emergem do
   uso, com uma via principal indo da igreja para os campos e caminhos menores
   ligando casa, celeiro, poço e pasto. E o padrão LINEAR — casas enfileiradas
   ao longo de uma via — é o de aldeia criada por ORDEM DE UM SENHOR, que é
   exatamente o caso de Varrokgaard: uma fazenda que abastece Vigília.
   A grade ortogonal de três ruas verticais da volta passada era planta de
   arquiteto. Agora é UMA rua, com as casas de frente para ela. */
const MX0 = 64, MX1 = 120, MY0 = 122, MY1 = 176;
const RUA_X = 92, VIL_X = 92, VIL_Y = 148;
discoTerra(VIL_X, VIL_Y, 30, T.DIRT);

/* #7/#8 · O MURO. Cerca a VILA e não meia ilha. Pedra lavrada, dois tiles de
   espesso — que é o que separa muro de mureta — e torre nos quatro cantos. */
for (let x = MX0; x <= MX1; x++) for (const y of [MY0, MY0 + 1, MY1 - 1, MY1])
  emTerra(x, y, T.SWALL);
for (let y = MY0; y <= MY1; y++) for (const x of [MX0, MX0 + 1, MX1 - 1, MX1])
  emTerra(x, y, T.SWALL);
for (const [x, y] of [[MX0, MY0], [MX1 - 2, MY0], [MX0, MY1 - 2], [MX1 - 2, MY1 - 2]])
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) emTerra(x + i, y + j, T.SWALL);

/* A PONTE SOBRE O MURO (#7). Pedido do dono do projeto: sobe a escada,
   atravessa a ponte, desce a escada do outro lado. Ela vive no ANDAR DE CIMA, e
   é isso que a torna uma travessia em vez de um vão na parede.
   O par de escadas fica no MESMO (x,y) nos dois andares, como toda escada do
   jogo. Isso funciona porque `afterStep` só dispara quando um passo TERMINA:
   chegar em cima não devolve o jogador para baixo — ele tem de ANDAR até a
   outra ponta da ponte, que é exatamente a travessia pedida. */
const PONTE_X = RUA_X;
for (let dx = -1; dx <= 1; dx++) {
  C.pinta(m, S, PONTE_X + dx, MY0 - 1, T.PAVE);                  // o patamar de fora
  C.pinta(m, S, PONTE_X + dx, MY0 + 2, T.PAVE);                  // o de dentro
  for (let y = MY0 - 1; y <= MY0 + 2; y++) C.pinta(m, MURO, PONTE_X + dx, y, T.PAVE);
}
/* Os parapeitos: sem eles a ponte é uma faixa de calçada boiando, e de cima não
   se lê que há queda dos dois lados. */
for (let y = MY0 - 1; y <= MY0 + 2; y++) {
  C.pinta(m, MURO, PONTE_X - 2, y, T.SWALL);
  C.pinta(m, MURO, PONTE_X + 2, y, T.SWALL);
}

/* O TEMPLO. A pesquisa mexeu aqui também: igreja medieval fica PERTO da estrada
   de entrada e do mercado, acessível a quem vem de fora — raramente no centro
   do palco. Antes ele ocupava o meio da vila e a rua tinha de desviar dele.
   Agora está logo dentro do muro, à direita de quem desce a ponte. */
const TPL_X = 99, TPL_Y = 127, TPL_W = 13, TPL_H = 17;
const TPL_CX = TPL_X + (TPL_W >> 1);
C.disco(m, S, TPL_CX, TPL_Y + TPL_H - 1, 6, T.SWALL);            // a ábside, ao sul
C.retangulo(m, S, TPL_X, TPL_Y, TPL_W, TPL_H, T.SWALL);
C.retangulo(m, S, TPL_X + 1, TPL_Y + 1, TPL_W - 2, TPL_H - 2, T.TEMPLE);
C.disco(m, S, TPL_CX, TPL_Y + TPL_H - 1, 4, T.TEMPLE);
for (let k = 0; k < 3; k++) {                                    // os contrafortes
  C.retangulo(m, S, TPL_X - 1, TPL_Y + 4 + k * 4, 1, 2, T.SWALL);
  C.retangulo(m, S, TPL_X + TPL_W, TPL_Y + 4 + k * 4, 1, 2, T.SWALL);
}
for (let k = 0; k < 4; k++) {                                    // as colunas da nave
  C.pinta(m, S, TPL_X + 3, TPL_Y + 4 + k * 3, T.SWALL);
  C.pinta(m, S, TPL_X + TPL_W - 4, TPL_Y + 4 + k * 3, T.SWALL);
}
C.retangulo(m, S, TPL_X + 5, TPL_Y, 3, 1, T.DOOR);               // a porta, ao NORTE
C.retangulo(m, S, TPL_X + 4, TPL_Y - 2, 5, 2, T.PAVE);           // o pórtico
C.linha(m, S, RUA_X + 1, MY0 + 5, TPL_X + 6, MY0 + 5, T.PAVE, 3);// a viela até ele

/* #4 · O PONTO DE TEMPLO É DENTRO DA NAVE. Ele estava no adro, do lado de fora.
   O jogo trata `WORLD.temple` como "o templo" para nascer, para a loja e para o
   marcador do mapa — e com ele na laje o personagem nascia numa praça vazia com
   o edifício fora da tela. Agora nasce DENTRO, que é de onde se sai. */
m.templo = { x: TPL_CX, y: TPL_Y + 4, z: S };

/* A rua única, da ponte ao fundo da vila. */
/* A rua começa em MY0+4 e não em MY0+2: com esp 3 ela cobre três colunas E a
   linha inteira, e começando na escada de dentro ela PINTAVA POR CIMA da
   escada — a ponte deixava de fechar e a conferência acusou. */
C.linha(m, S, RUA_X + 1, MY0 + 4, RUA_X + 1, MY1 - 3, T.PAVE, 3);
C.linha(m, S, MX0 + 4, 152, MX1 - 4, 152, T.PAVE, 3);            // a travessa do largo

function casa(x, y, w, h, px, py) {
  C.retangulo(m, S, x, y, w, h, T.WALL);
  C.retangulo(m, S, x + 1, y + 1, w - 2, h - 2, T.FLOOR);
  C.pinta(m, S, px, py, T.DOOR);
}
/* Fila oeste e fila leste, de frente para a rua; os fundos dão para as hortas,
   que é o que casa de fazenda faz. A porta olha SEMPRE para a rua. */
for (const [x, y, w, h, px, py] of [
  [70, 127, 11, 8, 80, 131], [70, 137, 11, 8, 80, 141],
  [70, 157, 11, 8, 80, 161], [70, 167, 11, 7, 80, 170],
  [99, 157, 11, 8, 99, 161], [99, 167, 11, 7, 99, 170],
  [82, 167, 8, 7, 85, 167]
]) casa(x, y, w, h, px, py);

/* O PAIOL DA HALDA — o segundo prédio com função da vila, e de onde sai o
   primeiro equipamento. Palha por dentro: é o que distingue paiol de casa. */
C.retangulo(m, S, 70, 146, 12, 5, T.WALL);
C.retangulo(m, S, 71, 147, 10, 3, T.HAY);
C.retangulo(m, S, 75, 150, 3, 1, T.DOOR);
C.retangulo(m, S, 83, 147, 4, 4, T.HAY);                         // a meda, do lado de fora

/* #10 · O que faltava: a vila tinha casa, rua e templo e NADA entre eles. Poço
   no largo, carroça na rua, barris encostados e o moinho. Numa ilha que vive de
   trigo o moinho é a silhueta que diz o que este lugar é de mais longe que
   qualquer outra coisa. */
C.objeto(m, S, RUA_X + 4, 155, T.WELL);                          // o poço, no largo — 2×2
C.pinta(m, S, RUA_X - 4, 155, T.CART);                           // a carroça, na rua
C.pinta(m, S, RUA_X + 6, 149, T.BARREL);
C.pinta(m, S, 84, 136, T.BARREL);
C.pinta(m, S, 114, 150, T.BARREL);
C.retangulo(m, S, 109, 158, 8, 9, T.DIRT);                       // o terreiro do moinho
C.objeto(m, S, 111, 160, T.MILL);                                // 2×3: é prédio
/* O CURRAL — e ele não pediu tile novo: é cerca em volta de terra batida, e a
   cerca já existia. Reuso onde reuso serve, que é o outro lado da régua do
   #48b sobre não reusar onde diferenciar é o requisito. */
const CUR_X = 99, CUR_Y = 146, CUR_W = 14, CUR_H = 9;
C.retangulo(m, S, CUR_X, CUR_Y, CUR_W, CUR_H, T.DIRT);
for (let x = CUR_X; x < CUR_X + CUR_W; x++) {
  emTerra(x, CUR_Y, T.FENCE); emTerra(x, CUR_Y + CUR_H - 1, T.FENCE);
}
for (let y = CUR_Y; y < CUR_Y + CUR_H; y++) {
  emTerra(CUR_X, y, T.FENCE); emTerra(CUR_X + CUR_W - 1, y, T.FENCE);
}
C.pinta(m, S, CUR_X, CUR_Y + 4, T.DIRT);                         // a porteira, para a rua

/* Estradas. A do portão desce até a ponte; as outras ligam a vila ao trabalho.
   A PONTE DE TÁBUA sobre o rio é o que mantém a ilha conectada agora que há um
   rio de verdade cortando-a — e é o PIER, que existe para ser tábua sobre a
   água. Sem ela o sul inteiro fica do outro lado. */
C.caminho(m, S, [[PORTAO_X, CERCA_Y + 5], [92, 92], [92, 116], [PONTE_X, MY0 - 2]], T.DIRT, 3);

C.caminho(m, S, [[MX1 + 1, 152], [130, 142], [140, 124]], T.DIRT, 2);
C.caminho(m, S, [[MX0 - 1, 152], [58, 142], [60, 126]], T.DIRT, 2);
C.caminho(m, S, [[RUA_X, MY1 + 1], [90, 180]], T.DIRT, 2);
C.caminho(m, S, [[MX1 + 1, 140], [132, 134], [146, 133]], T.DIRT, 2);

/* O TRAPICHE e O EMBARCADOURO — tábua sobre a água. */
function cais(x0, y0, w, h) {
  C.retangulo(m, S, x0, y0, w, h, T.PIER);
  C.retangulo(m, S, x0, y0 - 1, w, 1, T.PIER);
}
cais(148, 136, 3, 9);
C.retangulo(m, S, 144, 132, 6, 4, T.DIRT);
C.pinta(m, S, 146, 133, T.BARREL);                               // #10
cais(88, 178, 8, 3);
C.retangulo(m, S, 84, 173, 12, 5, T.DIRT);
C.retangulo(m, S, 85, 174, 5, 3, T.WALL);                        // a casa do barqueiro
C.retangulo(m, S, 86, 175, 3, 1, T.FLOOR);
C.pinta(m, S, 87, 176, T.DOOR);
C.pinta(m, S, 94, 175, T.BARREL);

/* ------------------------------------------------------- Cabo do Sal */
const CAB_X = 171, CAB_Y = 87;
discoTerra(CAB_X, CAB_Y, 15, T.DIRT);
C.espalha(m, S, T.ROCK, .09, 801, (x, y, t) =>
  t === T.DIRT && (x - CAB_X) ** 2 + (y - CAB_Y) ** 2 < 225);
for (const [x, y] of [[164, 80], [164, 91], [177, 82], [176, 92]])
  for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) emTerra(x + i, y + j, T.SAND);
discoTerra(CAB_X, CAB_Y, 3, T.ASH);                              // a fogueira
C.pinta(m, S, CAB_X + 4, CAB_Y + 3, T.GORE);
C.pinta(m, S, CAB_X - 3, CAB_Y + 4, T.GORE);
for (let y = CAB_Y - 16; y <= CAB_Y + 16; y++) {
  if (y > CAB_Y - 3 && y < CAB_Y + 3) continue;                  // o vão do cordão
  if (CHAO.has(C.le(m, S, CAB_X - 17, y))) C.pinta(m, S, CAB_X - 17, y, T.FENCE);
}

/* Mato ralo no que sobrou de grama do lado seguro, longe da vila. */
C.espalha(m, S, T.TREE, .025, 901, (x, y, t) => t === T.GRASS && y > CERCA_Y + 8 &&
  (x - VIL_X) ** 2 + (y - VIL_Y) ** 2 > 36 * 36);

/* ============================================================ A Goela === */
C.retangulo(m, GOELA, 0, 0, L, L, T.VOID);
C.poligono(m, GOELA, [[112, 34], [130, 30], [138, 46], [128, 58], [111, 53]], T.CFLOOR);
C.poligono(m, GOELA, [[86, 66], [104, 58], [114, 74], [101, 88], [84, 82]], T.CFLOOR);
C.poligono(m, GOELA, [[104, 92], [130, 84], [146, 102], [134, 124], [106, 118]], T.CFLOOR);
C.poligono(m, GOELA, [[138, 58], [158, 63], [161, 80], [140, 84]], T.CFLOOR);
C.caminho(m, GOELA, [[124, 56], [114, 62], [101, 72]], T.CFLOOR, 3);
C.caminho(m, GOELA, [[99, 86], [112, 94], [122, 102]], T.CFLOOR, 3);
C.caminho(m, GOELA, [[133, 50], [143, 58], [148, 66]], T.CFLOOR, 3);
C.caminho(m, GOELA, [[150, 82], [141, 96], [134, 104]], T.CFLOOR, 3);
C.rasga(m, GOELA, T.CFLOOR, T.VOID, 902, .30, 4);
const teia = C.mulberry32(913);
C.espalha(m, GOELA, T.WEBF, 1, 903, (x, y, t) => {
  if (t !== T.CFLOOR) return false;
  const d2 = (x - 126) ** 2 + (y - 104) ** 2;
  return d2 < 12 * 12 && teia() < .55 - Math.sqrt(d2) / 26;
});
C.espalha(m, GOELA, T.BONE, .05, 904, (x, y, t) => t === T.CFLOOR &&
  (x - 126) ** 2 + (y - 104) ** 2 < 14 * 14);
C.espalha(m, GOELA, T.CWALL, 1, 905, (x, y, t) => t === T.VOID &&
  NB8.some(([dx, dy]) => C.le(m, GOELA, x + dx, y + dy) === T.CFLOOR));
C.espalha(m, GOELA, T.WEB, .55, 906, (x, y, t) => t === T.CWALL &&
  (x - 126) ** 2 + (y - 104) ** 2 < 20 * 20);
C.escada(m, S, GOELA, PED_X, PED_Y);                             // a boca, no pátio

/* AS ESCADAS DA PONTE, por último de tudo. Elas estavam junto do bloco da
   ponte, lá em cima, e a estrada do portão — desenhada depois, com espessura 3
   — pintou terra por cima da escada de fora: a travessia deixava de existir e a
   conferência acusou "a ponte não fecha".
   É a mesma lição de ordem que a rua e a casa já tinham ensinado, e a escada é
   o caso mais perigoso dela: sumir uma escada não deixa buraco visível na
   planta, só um andar que ninguém alcança. */
C.escada(m, MURO, S, PONTE_X, MY0 - 1);                          // sobe, do lado de fora
C.escada(m, MURO, S, PONTE_X, MY0 + 2);                          // desce, do lado de dentro

/* As pontes, depois de TODA estrada estar desenhada. */
const tabuas = pontesNasEstradas();

/* ------------------------------------------------------------ acabamento */
const limpou = C.limpaIlhotas(m, S, 14, T.WATER);
/* A limpeza de ilhota TRANSFORMA chão em água, então ela cria poça: um pedaço
   de terra solto no meio da lavoura vira um lago de oito tiles. Por isso a
   varredura de poça roda de novo aqui, DEPOIS dela — na primeira volta rodava
   só antes, e as 39 poças que sobraram eram todas obra desta linha. */
const pocasFim = limpaPocas(40);
const matou = C.limpaIlhotas(m, S, 200, T.TREE);
C.limpaIlhotas(m, GOELA, 10, T.CWALL);

/* ======================================================= quem mora onde ===
   #2/#9 · O relato foi "muito mob em locais aleatórios" e "dentro da vila não
   pode ter mob". Medido, havia 58 pontos de spawn ESPALHADOS fora de qualquer
   hunt — 14 lebres, 12 cobras, 10 najas, 8 ratos, 7 javalis e 7 cervos soltos
   pelo mapa. Isso é o gerador de novo, por outro caminho: bicho onde uma faixa
   de distância mandou. Agora o perigo mora nos três lugares que têm NOME, e a
   ilha entre eles é caminho. */
const CAMPO = ['rat', 'hare', 'snake', 'cobra'];
const MATA  = ['wolf', 'boar', 'deer', 'dire_wolf'];
const BOSQUE = ['deer', 'hare', 'boar'];
const CAVE  = ['bug', 'firefly', 'fire_beetle', 'spider', 'poison_spider', 'cave_rat', 'rotworm'];
const CABO  = ['minotaur', 'minotaur_archer', 'minotaur_guard'];

C.spawn(m, S, 50, 43, 'alpha_wolf', { hunt: 'mata_funda', boss: 1 });
C.povoa(m, S, MATA_X, MATA_Y, MATA_R, MATA, 44, 1003, { hunt: 'mata_funda' });
C.povoa(m, S, TRI_X, TRI_Y, TRI_R, CAMPO, 24, 1001, { hunt: 'trigais' });
C.povoa(m, S, COR_X, COR_Y, COR_R, BOSQUE, 12, 1002, { hunt: 'corte_velho' });
C.povoa(m, S, PED_X, PED_Y, 12, CAMPO, 8, 1004, { hunt: 'pedreira' });

C.spawn(m, GOELA, 126, 104, 'hive_queen', { hunt: 'goela', boss: 1 });
C.povoa(m, GOELA, 126, 104, 18, CAVE, 26, 1005, { hunt: 'goela' });
C.povoa(m, GOELA, 99, 74, 12, CAVE, 11, 1006, { hunt: 'goela' });
C.povoa(m, GOELA, 124, 44, 10, CAVE, 6, 1009, { hunt: 'goela' });

C.spawn(m, S, CAB_X, CAB_Y - 2, 'minotaur_mage', { hunt: 'cabo_do_sal' });
C.povoa(m, S, CAB_X, CAB_Y, 13, CABO, 16, 1007, { hunt: 'cabo_do_sal' });

/* ------------------------------------------------------------- as hunts
   Três com nome no mapa. Trigais, Corte Velho e Pedreira levam `hunt` no spawn
   para a conferência saber que aquele bicho tem endereço — mas NÃO entram na
   lista de hunts: são lugares de trabalho com bicho de campo, não caçadas, e
   anunciá-los como hunt prometeria ao jogador o que eles não são. */
C.hunt(m, { id: 'mata_funda', n: 'Mata Funda', x: MATA_X, y: MATA_Y, z: S, r: MATA_R, lvl: 8, best: 'lobos' });
C.hunt(m, { id: 'goela', n: 'A Goela', x: 126, y: 104, z: GOELA, r: 18, lvl: 10, best: 'insetos' });
C.hunt(m, { id: 'cabo_do_sal', n: 'Cabo do Sal', x: CAB_X, y: CAB_Y, z: S, r: 14, lvl: 20, best: 'minotauros' });

/* -------------------------------------------------------------- lugares */
C.poi(m, { id: 'poco_seco', n: 'O poço seco', ico: '🕳️', x: 62, y: 84, z: S, r: 1,
  dica: 'fundo demais para um poço de fazenda, e seco desde antes de qualquer um lembrar', lugar: 1 });
C.poi(m, { id: 'barco_pedra', n: 'O barco na pedra', ico: '⛵', x: 44, y: 142, z: S, r: 1,
  dica: 'encalhado há tanto tempo que virou paisagem', lugar: 1 });
C.poi(m, { id: 'alto_pedreira', n: 'O alto da Pedreira Rasa', ico: '🏔️', x: 136, y: 25, z: S, r: 1,
  dica: 'daqui se vê o mar inteiro — e, em dia limpo, uma costa do outro lado', lugar: 1 });
C.poi(m, { id: 'pedra_meio', n: 'A pedra do meio', ico: '🪨', x: 122, y: 76, z: S, r: 1,
  dica: 'a cerca foi construída em volta dela porque ninguém quis mexer', lugar: 1 });
C.poi(m, { id: 'foz', n: 'A foz', ico: '🌊', x: 58, y: 120, z: S, r: 1,
  dica: 'onde o rio deixa de ser rio; a água daqui já tem gosto de sal', lugar: 1 });

/* A CORREÇÃO DO DONO DO PROJETO, por cima do que eu compus e antes de conferir.
   A ordem importa nas duas pontas: depois do desenho, senão o script apagaria a
   correção; antes da conferência, para que componentes, poças e rastro de
   objeto sejam medidos no que o jogo vai carregar de fato. */
const patch = C.aplicaPatch(m);

/* ============================================================= conferência */
const alvo = C.salva(m);
const kb = (require('fs').statSync(alvo).size / 1024).toFixed(0);
console.log(`maps/${m.nome}.json  ${kb} KB  ·  ${m.w}x${m.h} x ${m.andares} andares`);
console.log(`ilhotas apagadas: ${limpou.apagados}, ${limpou.tiles} tiles  ·  ` +
  `bolsões de mata fechados: ${matou.apagados}, ${matou.tiles} tiles`);
console.log(`patch do editor: ${patch.tiles} tiles aplicados` +
  (patch.fora ? `  ·  ${patch.fora} SEM ENDEREÇO (o mapa mudou embaixo deles)` : '') + '\n');
console.log(`cerca nova: ${cercaTiles} tiles de estacaria  ·  poças limpas: ${pocasLimpas}+${pocasFim}` +
  `  ·  ${tabuas} tiles de ponte sobre o rio\n`);

/* A superfície tem DOIS componentes de propósito, e isto é a diferença entre
   um defeito e um desenho: a vila é murada e só se entra por cima, então o chão
   dela não toca o chão da ilha. Antes esta conferência exigia UM e teria
   acusado a vila murada como erro — a régua tinha de mudar junto com o mapa.
   O que ela cobra agora é que os componentes sejam exatamente os dois
   esperados, e que a ponte ligue os dois. */
const compS = [];
for (let z = 0; z < m.andares; z++) {
  const { and } = C.conta(m, z);
  const { tam } = C.componentes(m, z);
  const ord = [...tam].sort((a, b) => b - a);
  const tot = ord.reduce((a, b) => a + b, 0) || 1;
  if (z === S) compS.push(...ord);
  console.log(`${m.nomes[z].padEnd(14)} ${String(and).padStart(5)} andáveis · ` +
    `${String(ord.length).padStart(3)} componentes · maior ${(ord[0] / tot * 100).toFixed(1)}%`);
}

for (const h of m.hunts) {
  let chao = 0;
  for (let y = h.y - h.r; y <= h.y + h.r; y++) for (let x = h.x - h.r; x <= h.x + h.r; x++)
    if ((x - h.x) ** 2 + (y - h.y) ** 2 <= h.r * h.r && C.TILE[C.le(m, h.z, x, y)].walk) chao++;
  const n = m.spawns.filter(s => s.hunt === h.id).length;
  console.log(`${h.n.padEnd(14)} nv ${String(h.lvl).padStart(2)} · ${String(n).padStart(3)} bichos · ` +
    `${String(chao).padStart(5)} tiles andáveis · ${(chao / n).toFixed(0)} por bicho`);
}

const foraDaTerra = m.spawns.filter(s => !C.TILE[C.le(m, s.z, s.x, s.y)].walk);
const poisNaAgua = m.pois.filter(p => !C.TILE[C.le(m, p.z, p.x, p.y)].walk);
/* #9 · A VILA NÃO TEM BICHO. Antes a paz era um raio de 26 tiles em volta do
   templo; agora é o MURO, e a conferência é sobre a área murada. Paz aqui não é
   regra de motor, é composição — e composição precisa de conferência, senão
   volta na primeira vez que uma região for empurrada dois tiles. */
const naVila = m.spawns.filter(s => s.z === S &&
  s.x >= MX0 - 2 && s.x <= MX1 + 2 && s.y >= MY0 - 2 && s.y <= MY1 + 2);
const soltos = m.spawns.filter(s => !s.hunt);
/* #5 · nenhum tile de água solto: todo corpo d'água ou é o mar, ou é o rio. */
const AGUA_OK = t => t === T.WATER || t === T.PIER;
const vis = new Set(); let pocas = 0, maior = 0;
for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
  if (vis.has(y * L + x) || C.le(m, S, x, y) !== T.WATER) continue;
  let n = 0; const p = [[x, y]]; vis.add(y * L + x);
  while (p.length) { const [cx, cy] = p.pop(); n++;
    for (const [dx, dy] of NB8) { const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= L || ny >= L || vis.has(ny * L + nx)) continue;
      if (!AGUA_OK(C.le(m, S, nx, ny))) continue;
      vis.add(ny * L + nx);
      if (C.le(m, S, nx, ny) === T.WATER) n++;
      p.push([nx, ny]); } }
  if (n > maior) maior = n;
  if (n < 40) pocas++;
}
const nasce = C.TILE[C.le(m, S, m.templo.x, m.templo.y + 2)].walk;
/* Objeto de mais de um tile: rastro completo em toda âncora. Meio poço no mapa
   não dá erro nenhum — o render só não desenha, e some. */
const objRuins = [];
for (let z = 0; z < m.andares; z++) objRuins.push(...C.conferObjetos(m, z).map(e => `z${z} ${e}`));
/* #7 · a ponte tem de FECHAR: escada dos dois lados, chão em cima entre elas. */
const ponteOk = C.le(m, S, PONTE_X, MY0 - 1) === T.UP && C.le(m, S, PONTE_X, MY0 + 2) === T.UP &&
  C.le(m, MURO, PONTE_X, MY0 - 1) === T.DOWN && C.le(m, MURO, PONTE_X, MY0 + 2) === T.DOWN &&
  C.TILE[C.le(m, MURO, PONTE_X, MY0)].walk && C.TILE[C.le(m, MURO, PONTE_X, MY0 + 1)].walk;

console.log(`\n${m.spawns.length} spawns · ${m.hunts.length} hunts · ${m.pois.length} lugares`);
console.log(`spawn em tile não andável: ${foraDaTerra.length}` +
  (foraDaTerra.length ? '  -> ' + foraDaTerra.map(s => `${s.m} em ${s.x},${s.y} z${s.z}`).join(' | ') : ''));
console.log(`lugar em tile não andável: ${poisNaAgua.length}` +
  (poisNaAgua.length ? '  -> ' + poisNaAgua.map(p => `${p.n} em ${p.x},${p.y}`).join(' | ') : ''));
console.log(`spawn DENTRO do muro da vila: ${naVila.length}` +
  (naVila.length ? '  -> ' + naVila.map(s => `${s.m} em ${s.x},${s.y}`).join(' | ') : ''));
console.log(`spawn solto, fora de todo lugar: ${soltos.length}`);
console.log(`corpos d'água menores que 40 tiles (poça solta): ${pocas}  ·  maior: ${maior}`);
console.log(`o ponto de nascer é andável: ${nasce ? 'sim' : 'NÃO'}`);
console.log(`a ponte sobre o muro fecha: ${ponteOk ? 'sim' : 'NÃO'}`);
console.log(`objeto multi-tile com rastro quebrado: ${objRuins.length}` +
  (objRuins.length ? '  -> ' + objRuins.join(' | ') : ''));
/* Dois componentes: a ilha e a vila murada. Três seria alguma coisa perdida. */
const doisComp = compS.length === 2;
console.log(`chão da superfície em 2 pedaços (ilha + vila murada): ` +
  `${doisComp ? 'sim' : 'NÃO — ' + compS.length + ' pedaços: ' + compS.join(', ')}`);

if (foraDaTerra.length || poisNaAgua.length || naVila.length || soltos.length || pocas ||
    !nasce || !ponteOk || !doisComp || objRuins.length) {
  console.log('\nATENÇÃO: o mapa não fecha.');
  /* DOIS é "compus o mapa e a conferência reclamou"; qualquer outro código
     não-zero é o script ter quebrado. A diferença importa para quem chama: com
     2 o arquivo do mapa EXISTE e é o que o jogo vai carregar, então a ferramenta
     tem de mostrá-lo e avisar; com uma exceção não há mapa novo nenhum.
     Vinha tudo como 1, e o editor tratava conferência reclamando como falha de
     execução: recusava recarregar e dizia que não tinha recomposto, enquanto o
     mapa em disco já estava atualizado. */
  process.exitCode = 2;
}

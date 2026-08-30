/* compor.js — biblioteca para DESENHAR um mapa em vez de sorteá-lo.

   O gerador continua existindo e continua útil para rascunho. Isto é o outro
   caminho: uma terra escrita como código, determinística, versionada, e que o
   git mostra em diff quando muda. Não é editor visual — é o suficiente para eu
   compor e você julgar na planta, que é o laço que temos usado.

   O `T` e o `TILE_CHAR` saem do PRÓPRIO world.js, carregado num vm. Copiar os
   ids aqui criaria uma segunda fonte de verdade que sairia do ar no dia em que
   um tile novo entrasse — e o mapa carregaria calado com o chão errado. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const raiz = path.join(__dirname, '..');
const ctx = {
  console,
  document: { createElement: () => ({ getContext: () => new Proxy({}, { get: () => () => { }, set: () => true }) }) }
};
vm.createContext(ctx);
for (const f of ['data.js', 'art.js', 'world.js'])
  vm.runInContext(fs.readFileSync(path.join(raiz, 'src', f), 'utf8'), ctx, { filename: f });
vm.runInContext('globalThis.__C = { T, TILE, TILE_CHAR, mulberry32, MONSTERS, OBJ, parteCamadas };', ctx);
const { T, TILE, TILE_CHAR, mulberry32, MONSTERS, OBJ, parteCamadas } = ctx.__C;

/* ------------------------------------------------------------------ base */
function novoMapa(cfg) {
  const { nome, w, h, andares, sup = 0, nomes } = cfg;
  return {
    /*  é o primeiro andar de ENDGAME, e o padrão é "nenhum": sem isto,
       numa terra de dois andares o subsolo virava fundo do mundo e dobrava a
       chance de elite numa caverna de tutorial. Terra que tem endgame declara. */
    nome, w, h, andares, sup, fundo: cfg.fundo !== undefined ? cfg.fundo : andares,
    nomes: nomes || Array.from({ length: andares }, (_, i) => 'Andar ' + i),
    origem: 0,
    templo: { x: w >> 1, y: h >> 1, z: sup },
    hunts: [], pois: [], spawns: [],
    _t: Array.from({ length: andares }, () => new Uint8Array(w * h))
  };
}
const dentro = (m, x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h;
const le = (m, z, x, y) => dentro(m, x, y) ? m._t[z][y * m.w + x] : T.VOID;
function pinta(m, z, x, y, t) { if (dentro(m, x, y)) m._t[z][y * m.w + x] = t; }

/* ------------------------------------------------------------- desenho */
function retangulo(m, z, x, y, w, h, t) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) pinta(m, z, i, j, t);
}
function disco(m, z, cx, cy, r, t) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= cy + r; y++)
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r2) pinta(m, z, x, y, t);
    }
}
/* Polígono por varredura de linha. É o que desenha costa, região e clareira —
   qualquer forma que não seja círculo nem caixa. */
function poligono(m, z, pts, t) {
  let yMin = Infinity, yMax = -Infinity;
  for (const [, py] of pts) { if (py < yMin) yMin = py; if (py > yMax) yMax = py; }
  for (let y = Math.floor(yMin); y <= Math.ceil(yMax); y++) {
    const cortes = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y))
        cortes.push(x1 + (y - y1) / (y2 - y1) * (x2 - x1));
    }
    cortes.sort((a, b) => a - b);
    for (let k = 0; k + 1 < cortes.length; k += 2)
      for (let x = Math.ceil(cortes[k]); x <= Math.floor(cortes[k + 1]); x++) pinta(m, z, x, y, t);
  }
}
function linha(m, z, x0, y0, x1, y1, t, esp = 1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1;
  const meia = (esp - 1) / 2;
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
    for (let dy = -meia; dy <= meia; dy++) for (let dx = -meia; dx <= meia; dx++)
      pinta(m, z, Math.round(x + dx), Math.round(y + dy), t);
  }
}
/* Caminho por pontos: estrada, riacho, galeria de mina. Só liga os pontos em
   sequência, mas é o suficiente — quem dá a forma é a lista, e lista é o que se
   edita à mão sem ferramenta nenhuma. */
function caminho(m, z, pts, t, esp = 1) {
  for (let i = 0; i + 1 < pts.length; i++)
    linha(m, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], t, esp);
}

/* ------------------------------------------------------------ irregular */
/* A borda entre dois tiles vira irregular. É o que separa "ilha desenhada com
   compasso" de costa: sem isto, todo contorno sai liso e o mapa denuncia que
   saiu de uma função. Roda em passes, lendo de uma cópia para o resultado não
   depender da ordem da varredura. */
function rasga(m, z, deTile, paraTile, seed, chance = .5, passes = 2) {
  const r = mulberry32(seed);
  for (let p = 0; p < passes; p++) {
    const copia = m._t[z].slice();
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (copia[y * m.w + x] !== deTile) continue;
      let vizinho = 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, ny = y + dy;
        if (dentro(m, nx, ny) && copia[ny * m.w + nx] === paraTile) vizinho++;
      }
      if (vizinho && r() < chance * vizinho / 4) pinta(m, z, x, y, paraTile);
    }
  }
}
/* Espalha um tile dentro de uma área, com filtro. Árvore na mata, pedra solta,
   moita no campo — tudo o que é textura e não forma. */
function espalha(m, z, t, chance, seed, filtro) {
  const r = mulberry32(seed);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (!filtro(x, y, le(m, z, x, y))) continue;
    if (r() < chance) pinta(m, z, x, y, t);
  }
}

/* ------------------------------------------------------------- conteúdo */
/* Um ponto de spawn, com a espécie escrita à mão. É a diferença que motivou a
   virada: o gerador só sabe sortear de um pool por faixa de distância, e não
   tem como dizer "exatamente um Minotauro Mago, aqui". */
function spawn(m, z, x, y, especie, extra) {
  if (!MONSTERS[especie]) throw new Error(`espécie desconhecida: ${especie}`);
  m.spawns.push(Object.assign({ x, y, z, m: especie }, extra || {}));
}
/* Espalha N spawns dentro de um raio, escolhendo do elenco daquele lugar. O
   sorteio é semeado, então a mesma chamada dá sempre o mesmo povoamento — e
   povoamento repetível é o que permite corrigir uma região sem embaralhar as
   outras. */
function povoa(m, z, cx, cy, r, elenco, quantos, seed, extra) {
  const rnd = mulberry32(seed), postos = [];
  for (let y = Math.floor(cy - r); y <= cy + r; y++)
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx*dx + dy*dy > r*r) continue;
      if (!andavel(m, z, x, y)) continue;
      if (m.spawns.some(s => s.z === z && s.x === x && s.y === y)) continue;
      postos.push([x, y]);
    }
  for (let k = postos.length - 1; k > 0; k--) {
    const j = Math.floor(rnd() * (k + 1)); [postos[k], postos[j]] = [postos[j], postos[k]];
  }
  const n = Math.min(quantos, postos.length);
  for (let i = 0; i < n; i++)
    spawn(m, z, postos[i][0], postos[i][1], elenco[Math.floor(rnd() * elenco.length)], extra);
  return n;
}
/* Objeto que ocupa mais de um tile. O mapa guarda o RASTRO inteiro — todos os
   tiles do retângulo com o mesmo id —, e quem desenha é só a âncora, no render.
   Pintar um tile só de um objeto com `span` deixaria uma âncora sem rastro (o
   desenho transborda por cima de chão andável) ou um rastro sem âncora (o tile
   bloqueia e não desenha nada, que é a parede invisível de novo). */
function objeto(m, z, x, y, tile) {
  const sp = TILE[tile].span || [1, 1];
  for (let j = 0; j < sp[1]; j++) for (let i = 0; i < sp[0]; i++) pinta(m, z, x + i, y + j, tile);
  return sp;
}
/* Todo objeto com `span` no mapa tem rastro completo e âncora única. Sem esta
   conferência, empurrar um poço um tile para o lado deixa meio poço no mapa e
   nada acusa — o render simplesmente não desenha. */
function conferObjetos(m, z) {
  const erros = [];
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const t = le(m, z, x, y), sp = TILE[t] && TILE[t].span;
    if (!sp) continue;
    if (le(m, z, x - 1, y) === t || le(m, z, x, y - 1) === t) continue;   // não é âncora
    for (let j = 0; j < sp[1]; j++) for (let i = 0; i < sp[0]; i++)
      if (le(m, z, x + i, y + j) !== t) erros.push(`${x},${y} sem rastro em +${i},+${j}`);
  }
  return erros;
}

function hunt(m, cfg) { m.hunts.push(cfg); return cfg; }
function poi(m, cfg) { m.pois.push(Object.assign({ uid: cfg.id + '_' + m.pois.length }, cfg)); }
/* Par de escadas. Sempre em par e sempre nos dois andares: escada de mão única
   é o defeito clássico de mapa desenhado. */
function escada(m, zCima, zBaixo, x, y) {
  pinta(m, zCima, x, y, T.DOWN);
  pinta(m, zBaixo, x, y, T.UP);
}

/* ------------------------------------------------------- a régua do jogo
   ANDÁVEL é chão que se pisa E sem objeto bloqueando em cima. Antes da
   separação de camadas isto era só `TILE[...].walk`, e bastava: parede e árvore
   ERAM tiles. Agora não basta, e a diferença não é acadêmica — o dono põe uma
   parede fechando um corredor, o terreno não muda, e a análise de componentes
   não vê nada. Seria o quarto caso de medir com régua diferente da do jogo, que
   é pior do que não medir: dá alarme falso, e o alarme falso esconde o
   verdadeiro.

   Funciona antes e depois de `parte()`: sem `m.objs` responde só pelo terreno,
   que é o certo enquanto árvore e parede ainda são tiles do vocabulário de
   autor. É o que permite as conferências rodarem dos dois lados da descida. */
function objsEm(m, z, x, y) {
  if (!m.objs || !m.objs[z]) return [];
  if (!m._oi) m._oi = [];
  if (!m._oi[z]) {
    const idx = new Map();
    for (const o of m.objs[z]) {
      const sp = (OBJ[o.o] || {}).span || [1, 1];
      for (let j = 0; j < sp[1]; j++) for (let i = 0; i < sp[0]; i++) {
        const k = (o.y + j) * m.w + (o.x + i), l = idx.get(k);
        if (l) l.push(o); else idx.set(k, [o]);
      }
    }
    m._oi[z] = idx;
  }
  return m._oi[z].get(y * m.w + x) || [];
}
/* PORTA CONTA COMO PASSAGEM aqui, e é uma diferença de propósito em relação ao
   `isWalkable` do jogo. Lá a porta fechada barra o passo, e tem de barrar. Aqui
   a pergunta é outra — "o jogador CONSEGUE chegar?" —, e a resposta para uma
   porta é sim: ele abre. Sem esta linha cada casa da vila virou um componente
   só dela, e a conferência passou de 3 pedaços para 15, denunciando como
   conteúdo inalcançável exatamente aquilo que tem porta. Alarme falso esconde
   alarme verdadeiro.
   Quem quiser a régua crua do jogo passa `duro`. */
function andavel(m, z, x, y, duro) {
  if (!TILE[le(m, z, x, y)].walk) return false;
  for (const o of objsEm(m, z, x, y)) {
    const d = OBJ[o.o];
    if (!d || o.aberta) continue;
    if (d.abrivel && !duro) continue;
    if (!d.walk) return false;
  }
  return true;
}
/* Desce o mapa de UMA camada para duas, no lugar onde o script mandar. Antes
   isto acontecia escondido dentro do `salva`, e a ordem estava errada: o script
   salvava e SÓ ENTÃO conferia, então as conferências mediam o mapa já partido
   com a mata virando campo aberto. Explícito, o autor escolhe o momento — e o
   momento certo é depois de todo o desenho e antes de toda conferência. */
function parte(m, semente = 555) {
  const espalhado = espalhaDeco(m, semente);
  m.objs = m._t.map((t, z) => parteCamadas(t, espalhado[z], m.w, m.h));
  m._oi = null;
  return m.objs.map(l => l.length);
}

/* ---------------------------------------------------------------- saída */
function conta(m, z) {
  let and = 0; const porTile = {};
  for (let i = 0; i < m.w * m.h; i++) {
    const t = m._t[z][i];
    porTile[t] = (porTile[t] || 0) + 1;
    if (andavel(m, z, i % m.w, (i / m.w) | 0)) and++;
  }
  return { and, porTile };
}
/* Componentes conexos — a mesma medida da planta. É o teste de que o mapa
   desenhado não repetiu o defeito do gerado: aqui a resposta TEM de ser vários,
   e cada um alcançável. */
function componentes(m, z) {
  const id = new Int32Array(m.w * m.h).fill(-1), tam = [];
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const i = y * m.w + x;
    if (id[i] >= 0 || !andavel(m, z, x, y)) continue;
    const k = tam.length; let n = 0; const p = [[x, y]]; id[i] = k;
    while (p.length) {
      const [cx, cy] = p.pop(); n++;
      /* OITO vizinhos, como o DIRS do jogo. Com quatro, a ferramenta acusava
         desconexão onde o jogo passa: caminho de um tile na diagonal é
         intransitável para uma varredura ortogonal e perfeitamente andável para
         quem anda em oito. Medir com régua diferente da do jogo é pior que não
         medir — dá alarme falso e some com o alarme verdadeiro no meio. */
      for (const [dx, dy] of [[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1]]) {
        const nx = cx + dx, ny = cy + dy, j = ny * m.w + nx;
        if (!dentro(m, nx, ny) || id[j] >= 0 || !andavel(m, z, nx, ny)) continue;
        id[j] = k; p.push([nx, ny]);
      }
    }
    tam.push(n);
  }
  return { id, tam };
}

/* Some com pedaço de chão pequeno demais para servir. A erosão da costa deixa
   ilhota de um a três tiles que ninguém alcança — e conteúdo inalcançável é
   exatamente o defeito que o mapa desenhado existe para não ter. Devolve
   quantos pedaços apagou, porque o número interessa: se for alto, a erosão está
   forte demais. */
function limpaIlhotas(m, z, minimo, vazio) {
  const { id, tam } = componentes(m, z);
  let apagados = 0, tiles = 0;
  for (let i = 0; i < tam.length; i++) if (tam[i] < minimo) { apagados++; tiles += tam[i]; }
  if (!apagados) return { apagados: 0, tiles: 0 };
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const k = id[y * m.w + x];
    if (k >= 0 && tam[k] < minimo) pinta(m, z, x, y, vazio);
  }
  return { apagados, tiles };
}

/* A composição desenha em UMA camada — `C.espalha(m, S, T.TREE, ...)` é a linha
   que se quer escrever, e ela continua valendo. Quem parte isso em chão +
   objeto é o `parteCamadas` do world.js, o MESMO que o genWorld e a carga de
   mapa antigo usam: três chamadores, uma implementação. Escrever a régua de
   novo aqui era a segunda fonte de verdade que sairia do ar no primeiro objeto
   novo — e foi assim que o primeiro esboço de Varrokgaard saiu com 2.240
   árvores que eram parede invisível de grama pelada.

   Sobra aqui só o que a composição SORTEIA e o terreno não diz: pedra e moita
   no chão batido, com a mesma chance do gerador. O `k` muda com a profundidade
   porque moita não existe no subsolo. */
/* A pedra solta BARRA o passo desde 2026-08-24 (decisão do dono: "pedra deve ter
   colisão, moita não"), e com isso ela deixou de poder cair em qualquer lugar.
   Três coisas ela não pode fazer, e as três foram medidas depois da mudança:
     · cair em cima de um SPAWN — dois apareceram em Varrokgaard, e o bicho
       nasce dentro de pedra;
     · cair no centro de um POI — o centro é o tesouro, e a coisa fica
       inalcançável;
     · SELAR um vizinho — apareceu um tile com água nos três lados e a pedra no
       quarto, virando um bolsão de 1 tile.
   A terceira é a que parecia cara e não é: basta perguntar se algum vizinho
   andável ficaria SEM NENHUM vizinho andável, que é O(8) por colocação. Não pega
   bolsão de dois tiles ou mais, e está certo que não pegue — bolsão maior é
   forma de lugar, não acidente.
   A moita não passa por nada disto, porque não barra nada. */
function decoBloqueia(k) {
  const o = OBJ[k === 1 ? 'pedra' : 'moita'];
  return !!o && !o.walk;
}
function selaVizinho(m, z, x, y) {
  for (const [dx, dy] of DIRS8) {
    const vx = x + dx, vy = y + dy;
    if (!dentro(m, vx, vy) || !andavel(m, z, vx, vy)) continue;
    let saidas = 0;
    for (const [ex, ey] of DIRS8) {
      const sx = vx + ex, sy = vy + ey;
      if (sx === x && sy === y) continue;                 // a pedra que se quer pôr
      if (dentro(m, sx, sy) && andavel(m, z, sx, sy)) saidas++;
    }
    if (!saidas) return true;
  }
  return false;
}
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
function espalhaDeco(m, semente = 555) {
  return m._t.map((t, z) => {
    const r = mulberry32(semente + z), out = [];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const tt = t[y * m.w + x];
      if (!((tt === T.CFLOOR || tt === T.DIRT) && r() < 0.02)) continue;
      const k = z === m.sup ? 1 : 2;
      if (decoBloqueia(k)) {
        if (m.spawns.some(sp => sp.z === z && sp.x === x && sp.y === y)) continue;
        if (m.pois.some(p => (p.z === undefined ? m.sup : p.z) === z && p.x === x && p.y === y)) continue;
        if (selaVizinho(m, z, x, y)) continue;
      }
      out.push({ x, y, k });
    }
    return out;
  });
}

/* ------------------------------------------------------------ o patch
   O SCRIPT SEMEIA, O EDITOR CORRIGE. Sem isto o editor de mapas seria uma
   armadilha: o dono corrige cinquenta tiles no navegador, eu rodo o script de
   novo por qualquer outro motivo, e as cinquenta correções somem sem aviso.
   O editor não grava o mapa — grava só o DIFF contra o que o script produziu,
   em `maps/<nome>.patch.json`. O script aplica o patch no fim, ANTES das
   conferências, então componentes, poças e rastro de objeto são medidos sobre o
   resultado final e não sobre o esboço. Rodar o script mil vezes preserva a
   correção; mudar o script muda o que está por baixo dela.
   O formato é `{ tiles: { "<z>": [[x, y, tile], ...] } }` — coordenada e id,
   um por tile mexido. Verboso de propósito: entra no git e tem de dar para ler
   o que mudou sem abrir ferramenta nenhuma. */
/* `camada` existe porque as duas metades do patch entram em MOMENTOS
   diferentes: o terreno antes da descida (quando `m._t` ainda é vocabulário de
   autor) e o objeto depois dela (quando `m.objs` existe). Chamar a função
   inteira duas vezes reaplicava o patch de terreno POR CIMA do chão já partido,
   devolvendo `T.FENCE` e `T.TREE` ao terreno — a cerca voltava a ser tile E
   continuava sendo objeto, contada duas vezes, e o andar "Sobre o Muro" caiu de
   20 tiles andáveis para 12. */
function aplicaPatch(m, nome, camada) {
  const alvo = path.join(raiz, 'maps', (nome || m.nome) + '.patch.json');
  if (!fs.existsSync(alvo)) return { tiles: 0, fora: 0 };
  const o = JSON.parse(fs.readFileSync(alvo, 'utf8'));
  let n = 0, fora = 0, nObj = 0, foraObj = 0;
  for (const z in (camada === 'objs' ? {} : o.tiles || {})) {
    const iz = +z;
    if (iz < 0 || iz >= m.andares) { fora += o.tiles[z].length; continue; }
    for (const [x, y, t] of o.tiles[z]) {
      /* Tile fora do mapa ou id que não existe mais é CONTADO e não aplicado.
         O patch é escrito contra uma versão do script; se o script encolher a
         terra ou um tile sair da tabela, a correção correspondente perde o
         endereço — e isso tem de aparecer no relatório em vez de sumir. */
      if (!dentro(m, x, y) || !TILE[t]) { fora++; continue; }
      m._t[iz][y * m.w + x] = t;
      n++;
    }
  }
  /* A camada de OBJETO do patch. Entra depois do `parte()`, porque objeto só
     existe depois dele — e o `varrokgaard.js` chama nesta ordem: patch de
     tiles, parte, patch de objetos, confere.
     A unidade de diff é a LISTA ancorada num tile, e não o objeto solto: é o
     que cobre pôr, tirar e vários por tile com uma forma só. Substitui o que
     houver ali — quem gravou o patch viu o tile inteiro e decidiu por ele. */
  for (const z in (camada === 'tiles' ? {} : o.objs || {})) {
    const iz = +z;
    if (iz < 0 || iz >= m.andares || !m.objs) { foraObj += o.objs[z].length; continue; }
    for (const [x, y, ids] of o.objs[z]) {
      if (!dentro(m, x, y)) { foraObj++; continue; }
      const desconhecido = (ids || []).filter(id => !OBJ[id]);
      if (desconhecido.length) { foraObj += desconhecido.length; }
      m.objs[iz] = m.objs[iz].filter(ob => !(ob.x === x && ob.y === y));
      for (const id of ids || []) if (OBJ[id]) { m.objs[iz].push({ x, y, o: id }); nObj++; }
    }
  }

  /* A CAMADA DE SPAWN, terceira. Entra por último porque ela se apoia no que as
     outras duas deixaram: mover um bicho para cima de uma parede recém-pintada
     tem de ser visto pela conferência, e ela roda depois disto.
     A unidade de diff é a LISTA de espécies ancoradas num tile, igual à camada
     de objeto — cobre pôr, tirar e vários por tile com uma forma só, e lista
     VAZIA é "não há bicho aqui", que é como uma remoção viaja.
     Espécie que não existe mais é CONTADA e não aplicada, como o tile órfão: o
     patch é escrito contra uma versão do jogo, e se uma criatura sair da tabela
     a correção perde o endereço — isso tem de aparecer no relatório em vez de
     sumir. */
  let nSp = 0, foraSp = 0;
  for (const z in (camada === 'tiles' ? {} : o.spawns || {})) {
    const iz = +z;
    if (iz < 0 || iz >= m.andares) { foraSp += o.spawns[z].length; continue; }
    for (const [x, y, especies] of o.spawns[z]) {
      if (!dentro(m, x, y)) { foraSp++; continue; }
      const desconhecida = (especies || []).filter(e => !MONSTERS[e]);
      foraSp += desconhecida.length;
      m.spawns = m.spawns.filter(sp => !(sp.z === iz && sp.x === x && sp.y === y));
      for (const e of especies || []) if (MONSTERS[e]) { m.spawns.push({ x, y, z: iz, m: e }); nSp++; }
    }
  }
  m._oi = null;
  return { tiles: n, fora, objs: nObj, foraObj, spawns: nSp, foraSp };
}

/* O MAPA ESTÁ ATRASADO EM RELAÇÃO AO PATCH?
   Aconteceu de verdade e custou um susto: um servidor antigo gravou o patch e
   não recompôs, o mapa ficou com 262 tiles enquanto o patch tinha 727, e do
   lado de fora isso parece "editei, gravei e sumiu tudo". Nada se perde nesse
   estado — o patch é o que importa —, mas ninguém tem como saber olhando.
   Qualquer ferramenta que carregue um mapa pode chamar isto e dizer. */
function patchAtrasado(nome) {
  const mapa = path.join(raiz, 'maps', nome + '.json');
  const patch = path.join(raiz, 'maps', nome + '.patch.json');
  if (!fs.existsSync(mapa) || !fs.existsSync(patch)) return false;
  return fs.statSync(patch).mtimeMs > fs.statSync(mapa).mtimeMs + 1000;
}

function salva(m) {
  /* Já vem partido. A descida mora no `parte()`, chamado pelo script antes das
     conferências — ver o comentário lá. Aqui ficou só a gravação.
     O script que esquecer de chamar `parte()` grava um mapa SEM objeto nenhum,
     e isso seria silencioso: o jogo carregaria um mundo de chão liso. Por isso
     falha alto em vez de gravar. */
  if (!m.objs) throw new Error('salva(): chame C.parte(m) antes — o mapa ainda está em uma camada');
  const chao = m._t;
  const saida = {
    nome: m.nome, w: m.w, h: m.h, andares: m.andares, sup: m.sup, fundo: m.fundo,
    origem: m.origem, nomes: m.nomes, templo: m.templo,
    hunts: m.hunts, pois: m.pois, spawns: m.spawns,
    /* Uma linha por objeto, ordenada por y e depois x: o arquivo lê na ordem do
       mapa e o git aponta a linha exata que mudou, que é a mesma razão pela qual
       o terreno é um caractere por tile. */
    objs: m.objs.map(l => l.slice()
      .sort((a, b) => a.y - b.y || a.x - b.x || (a.o < b.o ? -1 : 1))
      .map(o => o.x + ',' + o.y + ',' + o.o)),
    tiles: chao.map(t => {
      const linhas = [];
      for (let y = 0; y < m.h; y++) {
        let l = '';
        for (let x = 0; x < m.w; x++) l += TILE_CHAR[t[y * m.w + x]];
        linhas.push(l);
      }
      return linhas.join('\n');
    })
  };
  const dir = path.join(raiz, 'maps');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const alvo = path.join(dir, m.nome + '.json');
  fs.writeFileSync(alvo, JSON.stringify(saida));
  return alvo;
}

module.exports = { T, TILE, OBJ, MONSTERS, mulberry32,
  novoMapa, le, pinta, retangulo, disco, poligono, linha, caminho,
  rasga, espalha, limpaIlhotas, spawn, povoa, objeto, conferObjetos, hunt, poi, escada, conta, componentes,
  espalhaDeco, andavel, objsEm, parte, aplicaPatch, patchAtrasado, salva };

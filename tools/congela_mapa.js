/* congela_mapa.js — pega um mundo GERADO e o transforma em arquivo.

   É a ponte entre o gerador e a autoria: o gerador produz o primeiro rascunho de
   uma terra, este script o congela, e a partir daí corrigir o mapa é editar o
   arquivo em vez de sortear de novo e torcer.

     node tools/congela_mapa.js                 -> maps/mundo.json, semente 12345
     node tools/congela_mapa.js aleto 777       -> maps/aleto.json, semente 777

   Roda sem navegador, no mesmo esquema da suíte: carrega os fontes num contexto
   vm com o mínimo de DOM que o data.js e o world.js pedem. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const nome = process.argv[2] || 'mundo';
const seed = Number(process.argv[3] || 12345);

const ctx = {
  console,
  document: {
    createElement: () => ({
      width: 0, height: 0,
      getContext: () => new Proxy({
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) })
      }, { get: (t, k) => k in t ? t[k] : () => { }, set: () => true })
    })
  }
};
vm.createContext(ctx);
const raiz = path.join(__dirname, '..');
for (const f of ['data.js', 'art.js', 'world.js'])
  vm.runInContext(fs.readFileSync(path.join(raiz, 'src', f), 'utf8'), ctx, { filename: f });
vm.runInContext('globalThis.__M = { genWorld, mapaSerializa, WORLD, W, H, FLOORS, isWalkable };', ctx);
const M = ctx.__M;

M.genWorld(seed);
const mapa = ctx.mapaSerializa(nome);

const dir = path.join(raiz, 'maps');
if (!fs.existsSync(dir)) fs.mkdirSync(dir);
const alvo = path.join(dir, nome + '.json');
fs.writeFileSync(alvo, JSON.stringify(mapa));

/* Conferência na saída, porque congelar errado é o tipo de defeito que só
   aparece jogando: conta o que foi escrito e compara com o que estava na
   memória. Se divergir, o arquivo não presta e é melhor saber agora. */
let andaveis = 0;
for (let z = 0; z < M.FLOORS; z++)
  for (let y = 0; y < M.H; y++)
    for (let x = 0; x < M.W; x++) if (M.isWalkable(x, y, z)) andaveis++;
const kb = (fs.statSync(alvo).size / 1024).toFixed(0);

console.log(`maps/${nome}.json  ${kb} KB`);
console.log(`  ${M.W}x${M.H} x ${M.FLOORS} andares  ·  semente ${seed}`);
console.log(`  ${andaveis.toLocaleString('pt-BR')} tiles andáveis  ·  ${M.WORLD.spawns.length} spawns  ·  ` +
  `${M.WORLD.hunts.length} hunts  ·  ${M.WORLD.pois.length} POIs`);
console.log(`\nPara o jogo usar: MAPA_ATUAL = '${nome}' em src/world.js`);

/* planta_png.js — a planta de um mapa como PNG, sem navegador.

   Rode com:  node tools/planta_png.js varrokgaard [andar] [px]

   A página tools/amostra/mapa.html continua sendo a planta de verdade — tem
   camadas, nomes e componentes. Esta aqui existe para quando não há navegador à
   mão: mesma cor de tile, tirada do TILE do próprio world.js, um PNG e pronto.
   O encoder é o `zlib` da stdlib; PNG sem filtro é cabeçalho, IDAT e IEND. */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const C = require('./compor');

const nome = process.argv[2] || 'varrokgaard';
const z = +(process.argv[3] || 0);
const px = +(process.argv[4] || 4);

const raiz = path.join(__dirname, '..');
const o = JSON.parse(fs.readFileSync(path.join(raiz, 'maps', nome + '.json'), 'utf8'));
const linhas = o.tiles[z].split('\n');

/* O CHAR_TILE do compor é id -> caractere; aqui preciso do inverso. */
const vm = require('vm');
const ctx = { console, document: { createElement: () => ({ getContext: () => new Proxy({}, { get: () => () => { }, set: () => true }) }) } };
vm.createContext(ctx);
for (const f of ['data.js', 'art.js', 'world.js'])
  vm.runInContext(fs.readFileSync(path.join(raiz, 'src', f), 'utf8'), ctx, { filename: f });
vm.runInContext('globalThis.__P = { CHAR_TILE };', ctx);
const { CHAR_TILE } = ctx.__P;

const W = o.w * px, H = o.h * px;
const buf = Buffer.alloc(H * (1 + W * 3));           // 1 byte de filtro por linha
for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) {
  const t = CHAR_TILE[linhas[y][x]] || 0;
  const c = C.TILE[t].c;
  for (let j = 0; j < px; j++) {
    const base = (y * px + j) * (1 + W * 3) + 1 + x * px * 3;
    for (let i = 0; i < px; i++) {
      buf[base + i * 3] = (c >> 16) & 255;
      buf[base + i * 3 + 1] = (c >> 8) & 255;
      buf[base + i * 3 + 2] = c & 255;
    }
  }
}
/* Marcas por cima: spawn, chefe, hunt, lugar, escada e o templo. É o que
   separa "imagem do terreno" de PLANTA — sem elas dá para julgar a costa e não
   dá para julgar o conteúdo. */
function ponto(cx, cy, r, rgb) {
  for (let y = cy * px - r; y <= cy * px + r; y++) for (let x = cx * px - r; x <= cx * px + r; x++) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const i = y * (1 + W * 3) + 1 + x * 3;
    buf[i] = rgb[0]; buf[i + 1] = rgb[1]; buf[i + 2] = rgb[2];
  }
}
function anel(cx, cy, r, rgb) {
  for (let a = 0; a < 720; a++) {
    const x = Math.round((cx + Math.cos(a / 114.6) * r) * px), y = Math.round((cy + Math.sin(a / 114.6) * r) * px);
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const i = y * (1 + W * 3) + 1 + x * 3;
    buf[i] = rgb[0]; buf[i + 1] = rgb[1]; buf[i + 2] = rgb[2];
  }
}
for (const h of o.hunts || []) if (h.z === z) anel(h.x, h.y, h.r, [255, 90, 60]);
for (const s of o.spawns || []) if (s.z === z) ponto(s.x, s.y, s.boss ? 3 : 1, s.boss ? [255, 40, 40] : [255, 210, 90]);
for (const p of o.pois || []) if (p.z === z) ponto(p.x, p.y, 2, [120, 220, 255]);
if (o.templo.z === z) ponto(o.templo.x, o.templo.y, 3, [255, 255, 255]);

function pedaco(tipo, dados) {
  const len = Buffer.alloc(4); len.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(corpo) >>> 0);
  return Buffer.concat([len, corpo, crc]);
}
const TAB = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
function crc32(b) { let c = -1; for (let i = 0; i < b.length; i++) c = TAB[(c ^ b[i]) & 255] ^ (c >>> 8); return c ^ -1; }

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 2;                            // 8 bits, RGB
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  pedaco('IHDR', ihdr),
  pedaco('IDAT', zlib.deflateSync(buf)),
  pedaco('IEND', Buffer.alloc(0))
]);
const saida = path.join(raiz, 'tools', 'amostra', `planta_${nome}_${z}.png`);
fs.writeFileSync(saida, png);
console.log(`${saida}  ${W}x${H}  ${(png.length / 1024).toFixed(0)} KB`);

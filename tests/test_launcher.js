/* test_launcher.js — self-check do servidor estático do launcher.
   Roda com:  node tests/test_launcher.js
   O que quebra silencioso aqui é o Content-Type (script servido como octet-stream
   não executa) e o guard de path: `..` cru some na normalização da URL, mas
   %2e%2e%2f chega inteiro no decodeURIComponent. */
'use strict';
const assert = require('assert');
const servidor = require('../main.js');

servidor.listen(0, '127.0.0.1', async () => {
  const base = `http://127.0.0.1:${servidor.address().port}`;

  const raiz = await fetch(base + '/');
  assert.equal(raiz.status, 200, 'raiz deve servir index.html');
  assert.match(raiz.headers.get('content-type'), /text\/html/);
  assert.equal(raiz.headers.get('cache-control'), 'no-store', 'sem no-store o JS editado não recarrega');

  const js = await fetch(base + '/src/game.js');
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type'), /text\/javascript/);

  const fuga = await fetch(base + '/%2e%2e%2f%2e%2e%2fsecret.txt');
  assert.equal(fuga.status, 403, 'path traversal codificado tem que ser barrado');

  assert.equal((await fetch(base + '/nao_existe.png')).status, 404);

  console.log('launcher ok');
  servidor.close();
});

/* O FORMATO DO PATCH, num lugar só e testável.
   Estava embutido no handler do main.js, e por isso não tinha como ser exercido
   por teste — o que deixou passar o bug mais caro que a auditoria do editor
   achou: o handler escrevia só `tiles` e jogava fora o `objs` que o editor
   manda. O `aplicaPatch` lê `o.objs`, que nunca existia no arquivo, então TODA
   edição de objeto morria ao gravar, em silêncio.

   Uma ENTRADA POR LINHA, e não um número por linha: o patch entra no git e o
   diff tem de se ler. `JSON.stringify` com indent põe cada coordenada numa
   linha e um patch de 25 tiles ocupa 200; tudo numa linha só tem o mesmo
   defeito pelo outro lado.

   O `tools/serve.py` tem a própria cópia disto, porque é Python — e é por isso
   que o teste exercita OS DOIS e compara a saída byte a byte. Dois escritores
   que discordam significa que gravar pelo navegador e gravar pelo launcher
   produzem arquivos diferentes, e aí o mapa depende de por onde se salvou. */
'use strict';

function camada(chave, dados) {
  const zs = Object.keys(dados).sort((a, b) => a - b).filter(z => dados[z].length);
  if (!zs.length) return ['  "' + chave + '": {}'];
  return ['  "' + chave + '": {'].concat(
    zs.flatMap((z, i) => ['    "' + z + '": [']
      .concat(dados[z].map((t, j) => '      ' + JSON.stringify(t) +
        (j + 1 < dados[z].length ? ',' : '')))
      .concat(['    ]' + (i + 1 < zs.length ? ',' : '')]))
  ).concat(['  }']);
}

/* AS CAMADAS, em lista e em ORDEM DE APLICAÇÃO. Eram duas escritas à mão em
   quatro lugares que tinham de concordar — os dois serializadores, o `soma` e o
   `aplicaPatch` — e foi assim que a camada de objeto ficou semanas sendo
   descartada na gravação sem ninguém ver. Com a lista, acrescentar uma camada é
   uma palavra aqui e a mesma palavra no `serve.py`, e o teste compara as duas
   saídas byte a byte.
   A ordem é a de aplicação, e ela não é arbitrária: terreno primeiro, objeto
   depois (o objeto só existe depois do `parte`), e spawn por último, porque ele
   se apoia no chão e nos objetos que os dois anteriores deixaram. */
const CAMADAS = ['tiles', 'objs', 'spawns'];

/* Quantos endereços o patch carrega, somando TODAS as camadas. Contando só
   `tiles`, uma sessão inteira de objeto passava pelo freio de encolhimento como
   "não encolheu" — e o freio existe justamente para não deixar trabalho sumir. */
function soma(o) {
  return CAMADAS.reduce((n, chave) =>
    n + Object.values((o && o[chave]) || {}).reduce((a, t) => a + t.length, 0), 0);
}

function serializa(nome, dados) {
  const linhas = ['{', '  "nome": ' + JSON.stringify(nome) + ','];
  CAMADAS.forEach((chave, i) => {
    const bloco = camada(chave, (dados && dados[chave]) || {});
    if (i + 1 < CAMADAS.length) bloco[bloco.length - 1] += ',';
    linhas.push(...bloco);
  });
  return linhas.concat(['}']).join('\n') + '\n';
}

module.exports = { serializa, soma, CAMADAS };

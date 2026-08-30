/* A suíte do tools/, que até aqui não existia — a dívida está anotada no
   tasks.html desde a leva do terreno de PNG. Começa pelo pincel do editor,
   porque foi ele que provou o custo do silêncio: o hash do ruído nascia na
   faixa [0, .5) por um deslocamento COM sinal, a mancha saía com dois terços da
   área do círculo, e nada acusava — ruído enviesado ainda parece ruído.

   O bloco é recortado do editor.html por marca, e não copiado: cópia vira
   segunda fonte de verdade e passa a testar a si mesma. Se as marcas sumirem, o
   teste falha alto em vez de testar nada.

   node tests/test_tools.js */
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..');

let ok = 0;
const falhas = [];
const eh = (nome, cond, obs = '') => {
  if (cond) ok++; else falhas.push(nome + (obs ? ' — ' + obs : ''));
};

/* ---------------------------------------------- o pincel do editor de mapas */
const html = fs.readFileSync(path.join(RAIZ, 'tools/editor.html'), 'utf8');
const a = html.indexOf('[PINCEL]'), b = html.indexOf('[/PINCEL]');
if (a < 0 || b < 0 || b < a) {
  console.error('as marcas [PINCEL]/[/PINCEL] sumiram do tools/editor.html — o teste não tem o que recortar');
  process.exit(1);
}
// Vai do fim do comentário de marca até `[/PINCEL]`, que mora dentro de um
// comentário de bloco — daí o fechamento colado no fim, para fechar o que ficou
// aberto no recorte.
const FECHA = '*' + '/';
const fonte = html.slice(html.indexOf(FECHA, a) + 2, b) + FECHA;
const pincel = new Function('raio', 'forma', 'dens', fonte + '\nreturn { celulas, ruido, _hxy };');

const P = (raio, forma, dens = 100) => pincel(raio, forma, dens);
const conta = (raio, forma, dens, espalha, x = 50, y = 50) =>
  P(raio, forma, dens).celulas(x, y, espalha).length;

/* O ruído é o que dá forma à mancha; enviesado, ele encolhe o pincel em
   silêncio. Média e faixa medidas sobre 200×200, que é a ordem de um andar. */
{
  const { ruido, _hxy } = P(4, 'mancha');
  let sh = 0, sr = 0, n = 0, lo = 1, hi = 0;
  for (let y = 0; y < 200; y++) for (let x = 0; x < 200; x++) {
    const h = _hxy(x, y), r = ruido(x, y);
    sh += h; sr += r; n++;
    if (h < lo) lo = h; if (h > hi) hi = h;
  }
  eh('o hash do ruído cobre [0,1) e não meia faixa', hi > .95 && lo < .05,
     'faixa medida ' + lo.toFixed(3) + '–' + hi.toFixed(3));
  eh('o hash não é enviesado', Math.abs(sh / n - .5) < .02, 'média ' + (sh / n).toFixed(3));
  eh('o ruído herda a média do hash', Math.abs(sr / n - .5) < .03, 'média ' + (sr / n).toFixed(3));
}

/* A forma decide o CONTORNO. Trocar de forma não pode trocar o tamanho do
   pincel junto — botão que faz duas coisas de uma vez é o defeito que a
   primeira versão da mancha tinha. */
{
  const q = conta(4, 'quadrado', 100, false);
  const c = conta(4, 'circulo', 100, false);
  eh('o quadrado é o lado inteiro', q === 81, 'medido ' + q);
  eh('o círculo cabe dentro do quadrado e não é ele', c < q && c > q * .7, 'medido ' + c);
  const ms = [[20, 20], [60, 90], [130, 40], [77, 151], [100, 100]]
    .map(([x, y]) => conta(4, 'mancha', 100, false, x, y));
  const med = ms.reduce((s, v) => s + v, 0) / ms.length;
  eh('a mancha tem a área do círculo, não metade dela', Math.abs(med / c - 1) < .25,
     'mancha ' + med.toFixed(0) + ' contra círculo ' + c);
  eh('a mancha muda de lugar para lugar', new Set(ms).size > 1, 'medidas ' + ms.join(','));
}

/* O contorno tem de ser DETERMINÍSTICO no mesmo ponto: é isso que permite a
   marca sob o cursor mostrar exatamente onde a tinta cai. Sorteio por traço
   faria a marca mentir, e um editor que mente é pior que a planta chapada. */
{
  const um = P(5, 'mancha').celulas(64, 88, false).map(String).join('|');
  const dois = P(5, 'mancha').celulas(64, 88, false).map(String).join('|');
  eh('a mancha é a mesma toda vez no mesmo ponto', um === dois);
  /* Irregular quer dizer as DUAS coisas: bojo para fora do círculo e mordida
     para dentro dele. Só uma passaria com um círculo de outro tamanho. */
  const R = 5, lim = R + .5;
  const cel = P(R, 'mancha').celulas(64, 88, false);
  const dentro = new Set(cel.map(([x, y]) => x + ',' + y));
  const bojo = cel.some(([x, y]) => Math.hypot(x - 64, y - 88) > lim);
  let mordida = false;
  for (let j = -R; j <= R && !mordida; j++) for (let i = -R; i <= R; i++)
    if (Math.hypot(i, j) <= lim && !dentro.has((64 + i) + ',' + (88 + j))) { mordida = true; break; }
  eh('a mancha estoura o círculo em algum lado', bojo);
  eh('a mancha morde o círculo em algum lado', mordida);
}

/* A densidade só vale ao PINTAR. A marca pede o contorno inteiro, porque
   mostrar um sorteio que não vai se repetir é pior que não mostrar nada. */
{
  const cheio = conta(4, 'circulo', 30, false);
  eh('a marca ignora a densidade', cheio === conta(4, 'circulo', 100, false), 'medido ' + cheio);
  const amostras = Array.from({ length: 40 }, () => conta(4, 'circulo', 30, true));
  const med = amostras.reduce((s, v) => s + v, 0) / amostras.length;
  eh('30% de densidade acerta perto de 30% da área', Math.abs(med / cheio - .3) < .06,
     'medido ' + (med / cheio * 100).toFixed(0) + '%');
  const m60 = Array.from({ length: 40 }, () => conta(4, 'circulo', 60, true))
    .reduce((s, v) => s + v, 0) / 40;
  eh('mais densidade acerta mais', m60 > med * 1.5, m60.toFixed(0) + ' contra ' + med.toFixed(0));
}

/* O 1×1 escapa das duas: pincel de um tile que às vezes não pinta é ferramenta
   quebrada, não spray. */
for (const f of ['quadrado', 'circulo', 'mancha'])
  eh('o 1×1 pinta sempre um tile, em ' + f,
     Array.from({ length: 30 }, () => conta(0, f, 5, true)).every(v => v === 1));

/* ------------------------------- o escritor de patch dos dois servidores ---
   O bug mais caro que a auditoria do editor achou: o handler escrevia só
   `tiles` e jogava fora o `objs` que o editor manda. O `aplicaPatch` lê
   `o.objs`, que nunca existia no arquivo — TODA edição de objeto morria ao
   gravar, em silêncio, e o patch em disco nem tinha a chave. Do lado de fora
   isso lê como "pintei a árvore, gravei, e ela sumiu".

   O teste EXERCITA os dois escritores, e não varre o fonte atrás da palavra
   "objs": a primeira versão fazia isso e passou verde numa mutação que trocava
   os dados por `{}` mantendo a palavra. Teste que procura menção não guarda
   comportamento. */
{
  const fmt = require(path.join(RAIZ, 'tools/patch_fmt.js'));
  const dados = {
    tiles:  { 1: [[10, 20, 3], [11, 20, 3]] },
    objs:   { 1: [[10, 20, ['arvore']], [12, 21, ['barril', 'cerca']], [13, 21, []]] },
    /* A camada de SPAWN, terceira. Mesma forma das outras duas — a unidade de
       diff é a LISTA ancorada num tile, não o spawn solto — pelo mesmo motivo:
       cobre pôr, tirar e vários por tile com uma forma só, e quem gravou viu o
       tile inteiro e decidiu por ele. */
    spawns: { 1: [[30, 40, ['rat']], [31, 41, ['wolf', 'rat']], [32, 42, []]] },
  };
  const txt = fmt.serializa('zz_prova', dados);
  let j = null;
  try { j = JSON.parse(txt); } catch (e) { /* fica nulo e a asserção abaixo pega */ }
  eh('o patch gravado é JSON válido', !!j);
  eh('o patch carrega a camada de TILE', j && Object.values(j.tiles || {}).flat().length === 2);
  eh('o patch carrega a camada de OBJETO', j && Object.values(j.objs || {}).flat().length === 3,
     'sem ela, editar objeto no editor não sobrevive ao gravar');
  eh('a lista de objetos chega intacta',
     j && JSON.stringify(j.objs[1][1]) === JSON.stringify([12, 21, ['barril', 'cerca']]));
  /* A borracha é uma LISTA VAZIA, e ela tem de sobreviver: é assim que "tirei o
     barril daqui" viaja no patch. Some ela e a remoção vira um nada. */
  eh('a borracha (lista vazia) sobrevive',
     j && Array.isArray(j.objs[1][2][2]) && j.objs[1][2][2].length === 0);
  /* Uma ENTRADA por linha: o patch entra no git e o diff tem de se ler. */
  eh('uma entrada por linha, para o diff se ler', txt.split(String.fromCharCode(10)).length >= 12);
  /* O freio de encolhimento conta as DUAS camadas: contando só tiles, uma
     sessão inteira de objeto passava como "não encolheu". */
  eh('o patch carrega a camada de SPAWN', j && Object.values(j.spawns || {}).flat().length === 3,
     'sem ela, mover um bicho no editor não sobrevive ao gravar');
  eh('a lista de spawns chega intacta',
     j && JSON.stringify(j.spawns[1][1]) === JSON.stringify([31, 41, ['wolf', 'rat']]));
  eh('o tile SEM spawn (lista vazia) sobrevive',
     j && Array.isArray(j.spawns[1][2][2]) && j.spawns[1][2][2].length === 0);
  eh('a contagem do patch soma as TRÊS camadas', fmt.soma(dados) === 8,
     'medido ' + fmt.soma(dados));
  /* A lista de camadas é a fonte única: os dois serializadores leem dela, e o
     `aplicaPatch` percorre as mesmas chaves. Divergir aqui é o defeito que a
     camada de objeto teve por semanas. */
  eh('as camadas estão declaradas em ordem de aplicação',
     JSON.stringify(fmt.CAMADAS) === JSON.stringify(['tiles', 'objs', 'spawns']),
     'medido ' + JSON.stringify(fmt.CAMADAS));
  /* Patch VELHO, sem a chave nova, tem de continuar lendo: o do dono tem 2.183
     endereços e nenhum `spawns`. */
  const velho = fmt.serializa('zz_velho', { tiles: { 1: [[1, 2, 3]] } });
  let jv = null; try { jv = JSON.parse(velho); } catch (e) { /* pega abaixo */ }
  eh('patch sem a camada nova continua válido', !!jv && fmt.soma(jv) === 1);

  /* OS DOIS ESCRITORES TÊM DE CONCORDAR. São dois porque um é do launcher e o
     outro do serve.py (Python) — e se divergirem, o arquivo passa a depender de
     por onde o dono salvou. */
  const { execFileSync } = require('child_process');
  let py = null;
  try {
    /* `exec` do FONTE, e não `import`: o importlib valida o `.pyc` por (mtime,
       tamanho), e isso torna este teste capaz de NÃO PEGAR. Medido — trocar
       `['tiles','objs','spawns']` por `['tiles','spawns','objs']` tem o mesmo
       tamanho em bytes, e com as duas escritas dentro do mesmo segundo o Python
       reusou o bytecode velho e a mutação passou verde. Rodando sozinha, a
       mesma mutação era pega.
       Teste que às vezes não pega é pior que teste nenhum, e a causa aqui nem
       era o teste: era o cache no meio do caminho. Lendo o fonte não há cache,
       e de quebra nenhum `__pycache__` nasce em `tools/`. */
    py = execFileSync('python', ['-B', '-c',
      "import sys,json;" +
      /* `__file__` porque o serve.py deriva a RAIZ dele, e `exec` não o define
         sozinho. `__name__` diferente de `__main__` para a guarda não subir o
         servidor e pendurar o teste — que já aconteceu uma vez. */
      "g={'__name__':'nao_main','__file__':sys.argv[1]};" +
      "exec(open(sys.argv[1],encoding='utf-8').read(),g);" +
      "sys.stdout.write(g['serializa_patch'](sys.argv[2], json.loads(sys.argv[3])))",
      path.join(RAIZ, 'tools/serve.py'), 'zz_prova', JSON.stringify(dados)],
      { encoding: 'utf8', timeout: 30000 });
    /* O stdout do Python no Windows traduz a quebra de linha, e isso e do
       CANO e nao do escritor -- o arquivo de verdade sai com `newline=''`.
       Normaliza aqui para a comparacao medir o CONTEUDO. */
    py = py.split(String.fromCharCode(13) + String.fromCharCode(10))
            .join(String.fromCharCode(10));
  } catch (e) { py = 'FALHOU: ' + (e.message || e); }
  eh('o serve.py escreve o patch igualzinho ao launcher',
     py === txt, py === txt ? '' : 'as duas saídas divergem');
  /* Importar o serve.py não pode SUBIR UM SERVIDOR: sem guarda de __main__ ele
     sobe, e quem importar fica pendurado. Se este teste passou, a guarda está
     lá — ele importa o módulo e volta.

     SEM TESTE, de propósito: que o serve.py grave LF e não CRLF. A comparação
     acima normaliza a quebra de linha porque o stdout do Python no Windows a
     traduz, e essa tradução é do CANO — então ela não consegue distinguir o
     arquivo. Guardar isso exigiria a suíte escrever arquivo de verdade em
     `maps/`, e teste que escreve perto do trabalho do dono é o risco que este
     projeto já pagou uma vez. A consequência de perder é churn de diff no git,
     não perda de dado. */
}

/* ------------------------------------------- a ESCADA é um par, nunca meia ---
   Foi meia escada que quebrou a ponte sobre o muro: tábua pintada por cima de
   duas `DOWN` com o pincel de tile comum, e o mapa continuou parecendo certo —
   escada que some não deixa buraco visível na planta.
   O bloco é recortado do editor.html por marca, como o do pincel: a regra tem
   de ser exercida onde ela mora, não copiada. */
{
  const a = html.indexOf('[ESCADA]'), b2 = html.indexOf('[/ESCADA]');
  if (a < 0 || b2 < 0 || b2 < a) {
    console.error('as marcas [ESCADA] sumiram do tools/editor.html');
    process.exit(1);
  }
  const src = html.slice(html.indexOf(FECHA, a) + 2, b2) + FECHA;
  const { parDe, ehEscada } = new Function(src + '\nreturn { parDe, ehEscada };')();
  const TT = { VOID: 0, UP: 11, DOWN: 10 };
  const N = 3;                                   // Sobre o Muro, Varrokgaard, A Goela

  /* `z` CRESCE PARA BAIXO. DOWN em cima pede UP no andar seguinte, e é assim que
     o `C.escada` do compor.js escreve — se estes dois discordarem, o editor cria
     escada que o script considera quebrada. */
  eh('DOWN pede UP no andar de BAIXO',
     JSON.stringify(parDe(TT.DOWN, 0, N, TT)) === JSON.stringify({ t: TT.UP, z: 1 }));
  eh('UP pede DOWN no andar de CIMA',
     JSON.stringify(parDe(TT.UP, 1, N, TT)) === JSON.stringify({ t: TT.DOWN, z: 0 }));

  /* Escada para fora do mundo não se cria: no andar mais fundo não há para onde
     descer, e no mais alto não há de onde vir. */
  eh('DOWN no andar mais fundo não tem par', parDe(TT.DOWN, N - 1, N, TT) === null);
  eh('UP no andar mais alto não tem par', parDe(TT.UP, 0, N, TT) === null);

  /* Ida e volta: a metade de baixo aponta de volta para a de cima, exatamente.
     Sem isto o par poderia sair torto por um andar e ninguém veria. */
  for (let zz = 0; zz + 1 < N; zz++) {
    const desce = parDe(TT.DOWN, zz, N, TT);
    const volta = parDe(desce.t, desce.z, N, TT);
    eh(`o par fecha nos dois sentidos no andar ${zz}`,
       volta && volta.z === zz && volta.t === TT.DOWN);
  }

  eh('só UP e DOWN são escada',
     ehEscada(TT.UP, TT) && ehEscada(TT.DOWN, TT) && !ehEscada(1, TT) && !ehEscada(TT.VOID, TT));
}

/* ------------------- classe de ESTADO não pode ter nome de classe de LAYOUT ---
   `.barra` era a barra de ferramentas E a marca de "barra o passo" nas amostras
   da paleta. A colisão não dava erro nenhum: os 20 tiles com `walk:false`
   herdavam `display:flex` e `padding:6px 12px` da barra, e num quadradinho de
   32 px isso deixa 8 px de largura — água, árvore, veio e teia saíam como
   tirinha vertical. Foi o dono que viu, mandando print.
   O teste é estrutural e não decorado: lê o `<style>`, junta as classes que
   mexem em CAIXA (display, padding, margin, position, flex) e cobra que nenhuma
   delas seja pendurada por `classList.add` — que é como marca de estado entra. */
{
  const ed = fs.readFileSync(path.join(RAIZ, 'tools/editor.html'), 'utf8');
  const estilo = (ed.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];
  const caixa = new Set();
  for (const m of estilo.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/\b(display|padding|margin|position|flex)\s*:/.test(m[2])) continue;
    for (const cls of m[1].matchAll(/\.([a-zA-Z][\w-]*)/g)) caixa.add(cls[1]);
  }
  const penduradas = [...ed.matchAll(/classList\.add\('([\w-]+)'\)/g)].map(m => m[1]);
  const colidem = [...new Set(penduradas)].filter(c => caixa.has(c));
  eh('nenhuma marca de estado usa nome de classe que mexe na caixa',
     !colidem.length, colidem.length ? 'colidem: ' + colidem.join(', ') : '');
}

/* --------------------------------------- o editor grava o mapa CARREGADO ---
   `gravar()` lia o campo de texto do nome. Bastava trocar o nome depois de
   editar para as correções de um mapa irem para o patch de OUTRO, com as
   coordenadas calculadas com o W do primeiro. */
{
  const ed = fs.readFileSync(path.join(RAIZ, 'tools/editor.html'), 'utf8');
  const i = ed.indexOf('function gravar()');
  const corpo = ed.slice(i, i + 400);
  eh('o editor grava o mapa carregado, não o que está na caixa',
     /const nome = carregado;/.test(corpo));
  eh('e o nome carregado é registrado ao carregar', /carregado = nome;/.test(ed));
}

/* ------------------------------------------------------------------ saída */
if (falhas.length) {
  console.error('\n' + falhas.length + ' falha(s):');
  for (const f of falhas) console.error('  ✗ ' + f);
  console.error('\n' + ok + ' passaram, ' + falhas.length + ' falharam');
  process.exit(1);
}
console.log('tudo certo: ' + ok + ' verificações passaram');

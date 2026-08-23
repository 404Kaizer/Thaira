/* Launcher desktop. No navegador o F1-F12, F5, Ctrl+W e Ctrl+T sao consumidos
   antes do keydown chegar no jogo -- preventDefault nao recupera. Aqui, sem menu
   de aplicacao, o Electron nao registra acelerador nenhum e o teclado inteiro e
   do jogo (inclusive hotkey rebindada pra F1..F12). */
const { app, BrowserWindow, Menu } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');

const RAIZ = __dirname;
// mesma porta do serve.py de proposito: localStorage e por origem, entao
// personagem criado numa porta nao some quando voce troca de jeito de abrir
const PORTA = 8765;
const DEV = process.argv.includes('--dev');
/* `--editor` abre o editor de mapas junto com o jogo. Existe porque um .html
   nao pode subir servidor -- o navegador nao deixa pagina iniciar processo, e
   nao ha volta nisso. Entao o arquivo que se clica passa a ser o Editor.bat, e
   ele sobe ESTE launcher, que ja e o servidor. */
const MODO_EDITOR = process.argv.includes('--editor');
/* .ico e nao .png: o Windows quer a folha multi-tamanho (16 a 256) pra barra de
   tarefas e alt-tab sem reamostrar. Caminho errado aqui nao da erro nenhum --
   o Electron cai no atomo padrao em silencio, que foi como o app.png inexistente
   passou batido. O test_launcher confere que o arquivo existe. */
const ICONE = path.join(RAIZ, 'build', 'icon.ico');
const TIPOS = {
  // charset explicito: sem ele o navegador adivinha, e um HTML sem <meta charset>
  // proprio sai com acento quebrado (foi o que aconteceu com o tasks.html)
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
};

/* GRAVAR O PATCH DO EDITOR E RECOMPOR O MAPA, aqui dentro.
   O editor de mapas nasceu servido pelo tools/serve.py, e isso obrigava a abrir
   um terminal, subir o python e rodar `node tools/mapas/<terra>.js` na mao --
   tres passos para uma coisa que devia ser "edita, grava, joga". Pior: um
   serve.py que ja estivesse rodando ficava com o codigo velho e gravava sem
   recompor, o que le exatamente como perder o trabalho.
   O launcher JA e um servidor Node. Poe tudo aqui e sobra um duplo clique.
   O script roda pelo proprio binario do Electron com ELECTRON_RUN_AS_NODE, que
   e o mesmo Node -- assim nao ha exigencia de ter `node` no PATH da maquina. */
const NOME_MAPA = /^[a-z0-9_-]{1,40}$/;

function recompoe(nome, pronto) {
  const script = path.join(RAIZ, 'tools', 'mapas', nome + '.js');
  if (!fs.existsSync(script))
    return pronto({ recompos: false, log: 'nao ha tools/mapas/' + nome + '.js: o patch foi gravado, mas nada o aplica.' });
  execFile(process.execPath, [script], {
    cwd: RAIZ, timeout: 120000, encoding: 'utf8',
    env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: '1' })
  }, (erro, saida, erroSaida) => {
    pronto({ recompos: !erro, log: (saida || '') + (erroSaida || '') });
  });
}

function gravaPatch(req, res, nome, forcar) {
  if (!NOME_MAPA.test(nome)) { res.writeHead(400).end('nome de mapa invalido'); return; }
  let corpo = '';
  req.on('data', c => corpo += c);
  req.on('end', () => {
    let dados;
    try { dados = JSON.parse(corpo); } catch (e) { res.writeHead(400).end('json invalido'); return; }
    const dir = path.join(RAIZ, 'maps');
    fs.mkdirSync(dir, { recursive: true });
    const alvo = path.join(dir, nome + '.patch.json');
    /* O PATCH SÓ CRESCE, a não ser que alguém diga o contrário em alto e bom som.
       Este handler grava o que recebe, e foi assim que 1.632 tiles de trabalho
       viraram 2: bastou um POST de teste com dois tiles. O editor sempre manda o
       acumulado (ele lê o patch antigo e soma), então uma gravação que ENCOLHE o
       arquivo é, por construção, alguém que não passou pelo editor — script,
       teste, curl. Nesses casos o certo é recusar e mandar guardar cópia.
       `?forcar=1` existe para o caso legítimo de querer mesmo encolher; e a cópia
       de segurança sai ANTES de qualquer escrita, sempre. */
    let antes = 0;
    if (fs.existsSync(alvo)) {
      try {
        const v = JSON.parse(fs.readFileSync(alvo, 'utf8'));
        antes = Object.values(v.tiles || {}).reduce((a, t) => a + t.length, 0);
        fs.writeFileSync(alvo.replace(/\.json$/, '.bak.json'), fs.readFileSync(alvo));
      } catch (e) { /* patch ilegível: a gravação nova é o conserto */ }
    }
    const novos = Object.values(dados.tiles || {}).reduce((a, t) => a + t.length, 0);
    if (novos < antes && !forcar) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, recompos: false, tiles: antes, log:
        'RECUSADO: a gravação tem ' + novos + ' tiles e o patch em disco tem ' + antes + '.\n\n' +
        'O editor sempre manda o acumulado, então isto não veio dele. Nada foi\n' +
        'escrito, e há uma cópia em maps/' + nome + '.patch.bak.json.\n\n' +
        'Se você QUER mesmo encolher o patch, repita com ?forcar=1.' }));
      return;
    }
    /* Um TILE por linha, e nao um numero por linha: o patch entra no git e o
       diff tem de se ler. JSON.stringify com indent poe cada coordenada numa
       linha e um patch de 25 tiles ocupa 200. */
    const tiles = dados.tiles || {};
    const zs = Object.keys(tiles).sort((a, b) => a - b);
    const txt = ['{', '  "nome": ' + JSON.stringify(nome) + ',', '  "tiles": {']
      .concat(zs.flatMap((z, i) => ['    "' + z + '": [']
        .concat(tiles[z].map((t, j) => '      [' + t[0] + ', ' + t[1] + ', ' + t[2] + ']' +
          (j + 1 < tiles[z].length ? ',' : '')))
        .concat(['    ]' + (i + 1 < zs.length ? ',' : '')])))
      .concat(['  }', '}']).join('\n') + '\n';
    fs.writeFileSync(alvo, txt, 'utf8');
    const n = zs.reduce((a, z) => a + tiles[z].length, 0);
    recompoe(nome, r => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(Object.assign({ ok: true, tiles: n }, r)));
    });
  });
}

const servidor = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (req.method === 'POST') {
    if (!rel.startsWith('/patch/')) { res.writeHead(404).end(); return; }
    const q = new URL(req.url, 'http://x').searchParams;
    return gravaPatch(req, res, rel.slice('/patch/'.length), q.get('forcar') === '1');
  }
  const arq = path.join(RAIZ, rel === '/' ? 'index.html' : rel);
  if (!arq.startsWith(RAIZ + path.sep)) { res.writeHead(403).end(); return; }
  // no-store pelo mesmo motivo do serve.py: sem isso voce edita o JS, recarrega
  // e continua rodando o arquivo antigo
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', TIPOS[path.extname(arq).toLowerCase()] || 'application/octet-stream');
  fs.createReadStream(arq).on('error', () => res.writeHead(404).end()).pipe(res);
});

function abrirJanela() {
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    width: 1280, height: 800, backgroundColor: '#0b0c0f', show: false,
    icon: ICONE,   // barra de titulo, alt-tab e barra de tarefas
  });
  win.maximize();
  win.once('ready-to-show', () => win.show());
  win.loadURL(`http://localhost:${PORTA}/`);
  /* F9 abre o editor de mapas. Fica FORA do --dev de proposito: editar o mundo
     e trabalho normal do dono do projeto, nao depuracao. F9 nao e hotkey de
     hotbar (a hotbar usa F1..F12 rebindavel, mas F9 nao vem atribuida) -- se um
     dia colidir, o certo e trocar aqui e nao tirar o atalho. */
  win.webContents.on('before-input-event', (e, i) => {
    if (i.type !== 'keyDown') return;
    if (i.key === 'F9') { abrirEditor(); e.preventDefault(); return; }
    // F5 so recarrega com --dev; no jogo normal ela fica livre pra hotbar
    if (DEV && i.key === 'F5') { win.webContents.reload(); e.preventDefault(); }
  });
  if (DEV) win.webContents.openDevTools({ mode: 'detach' });
}

/* A JANELA DO EDITOR, ao lado da do jogo. Duas janelas na mesma origem, entao
   o BroadcastChannel liga as duas: gravar no editor recompoe o mapa e o jogo
   troca o mundo debaixo dos pes, sem recarregar e sem perder o personagem.
   Abre por F9 de dentro do jogo, e fecha sozinha com ele. */
let janelaEditor = null;
function abrirEditor() {
  if (janelaEditor && !janelaEditor.isDestroyed()) { janelaEditor.focus(); return; }
  janelaEditor = new BrowserWindow({
    width: 1400, height: 900, backgroundColor: '#12100e', show: false, icon: ICONE,
    title: 'Editor de mapas — Thaira'
  });
  janelaEditor.once('ready-to-show', () => janelaEditor.show());
  janelaEditor.on('closed', () => { janelaEditor = null; });
  janelaEditor.loadURL('http://localhost:' + PORTA + '/tools/editor.html');
  janelaEditor.webContents.on('before-input-event', (e, i) => {
    if (i.type === 'keyDown' && i.key === 'F5') { janelaEditor.webContents.reload(); e.preventDefault(); }
  });
}

function iniciar() {
  // duas janelas compartilham a MESMA localStorage: as duas salvariam o
  // personagem por cima uma da outra e a ultima a fechar ganharia. O return e
  // obrigatorio -- so o app.quit() nao impede o whenReady de rodar e abrir a 2a.
  if (!app.requestSingleInstanceLock()) return app.quit();

  /* Sem isto o Windows agrupa a janela sob o electron.exe e o botao da barra de
     tarefas herda o icone DELE, mesmo com o `icon:` da janela certo. */
  app.setAppUserModelId('com.thaira.rpg');

  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });

  app.whenReady().then(() => {
    /* As DUAS janelas quando se entra pelo Editor.bat: editar sem ver o
       resultado no jogo nao serve para nada, e era esse o fluxo que obrigava a
       abrir servidor e rodar node na mao. Gravar no editor recompoe e o jogo se
       atualiza sozinho pelo BroadcastChannel -- as duas janelas sao da mesma
       origem, entao o canal as liga. */
    const abrir = () => { abrirJanela(); if (MODO_EDITOR) abrirEditor(); };
    servidor.once('listening', abrir);
    // porta ocupada = serve.py ja esta de pe, entao so aproveita
    servidor.once('error', e => { if (e.code === 'EADDRINUSE') abrir(); else throw e; });
    servidor.listen(PORTA, '127.0.0.1');
  });
  app.on('window-all-closed', () => app.quit());
}

// sob `node` puro (tests/test_launcher.js) o require('electron') devolve so o
// caminho do binario, sem app: ai o modulo e apenas o servidor
if (app && app.whenReady) iniciar();

module.exports = servidor;
// o caminho do icone sai junto para o test_launcher conferir o QUE a janela usa,
// e nao so se algum .ico existe na pasta -- apontar para arquivo inexistente e
// exatamente a falha silenciosa que este teste guarda
module.exports.ICONE = ICONE;

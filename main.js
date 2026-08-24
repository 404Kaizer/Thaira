/* Launcher desktop. No navegador o F1-F12, F5, Ctrl+W e Ctrl+T sao consumidos
   antes do keydown chegar no jogo -- preventDefault nao recupera. Aqui, sem menu
   de aplicacao, o Electron nao registra acelerador nenhum e o teclado inteiro e
   do jogo (inclusive hotkey rebindada pra F1..F12). */
const { app, BrowserWindow, Menu, dialog } = require('electron');
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
const patchFmt = require('./tools/patch_fmt.js');
const soma = patchFmt.soma;
const NOME_MAPA = /^[a-z0-9_-]{1,40}$/;

function recompoe(nome, pronto) {
  const script = path.join(RAIZ, 'tools', 'mapas', nome + '.js');
  if (!fs.existsSync(script))
    return pronto({ recompos: false, log: 'nao ha tools/mapas/' + nome + '.js: o patch foi gravado, mas nada o aplica.' });
  execFile(process.execPath, [script], {
    cwd: RAIZ, timeout: 120000, encoding: 'utf8',
    env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: '1' })
  }, (erro, saida, erroSaida) => {
    /* Codigo 2 = o mapa FOI escrito e a conferencia reclamou. O mapa em disco e
       o que o jogo carrega, entao a ferramenta tem de mostra-lo e avisar -- nao
       fingir que nada aconteceu nem esconder o resultado. */
    const aviso = !!erro && erro.code === 2;
    pronto({ recompos: !erro || aviso, aviso, log: (saida || '') + (erroSaida || '') });
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
        antes = soma(v);
        fs.writeFileSync(alvo.replace(/\.json$/, '.bak.json'), fs.readFileSync(alvo));
      } catch (e) { /* patch ilegível: a gravação nova é o conserto */ }
    }
    const novos = soma(dados);
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
    /* O FORMATO mora em tools/patch_fmt.js, e não aqui: embutido no handler
       ele não tinha como ser exercido por teste, e foi assim que a camada de
       objeto ficou de fora sem ninguém perceber. O serve.py tem a própria
       cópia (é Python), e o teste compara as duas saídas byte a byte. */
    fs.writeFileSync(alvo, patchFmt.serializa(nome, dados), 'utf8');
    const n = soma(dados);
    recompoe(nome, r => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(Object.assign({ ok: true, tiles: n }, r)));
    });
  });
}

const servidor = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  /* Marcador de identidade. Serve para o proprio launcher descobrir QUEM esta
     na porta quando ela ja esta ocupada: se responder isto, e um launcher; se
     nao, e outro servidor -- e outro servidor nao sabe recompor o mapa. */
  if (rel === '/__thaira') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ launcher: true, recompoe: true }));
    return;
  }
  /* Recompor sem gravar patch: e o botao "recompor agora" do editor, para o
     caso de o mapa ter ficado atrasado por qualquer motivo. */
  if (req.method === 'POST' && rel.startsWith('/recompor/')) {
    const nome = rel.slice('/recompor/'.length);
    if (!NOME_MAPA.test(nome)) { res.writeHead(400).end(); return; }
    return recompoe(nome, r => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(r));
    });
  }
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

/* Um servidor ESTRANHO na porta 8765. Quase sempre um `python tools/serve.py`
   deixado rodando de uma versao anterior. Continuar seria pior que parar: as
   janelas abririam, tudo pareceria funcionar, e cada gravacao do editor sumiria
   silenciosamente do mapa. */
function avisaPortaOcupada() {
  const r = dialog.showMessageBoxSync({
    type: 'warning',
    title: 'A porta ' + PORTA + ' já está ocupada',
    message: 'Há outro servidor na porta ' + PORTA + '.',
    detail:
      'Quase sempre é um "python tools/serve.py" deixado aberto de antes.\n\n' +
      'Se eu usar esse servidor, o jogo abre e parece funcionar — mas ele NÃO sabe\n' +
      'recompor o mapa, então tudo que você gravar no editor fica só no patch e\n' +
      'nunca aparece no jogo. É o defeito de "editei, gravei e não mudou nada".\n\n' +
      'Feche a outra janela de terminal e abra o Editor.bat de novo.',
    buttons: ['Fechar', 'Abrir assim mesmo (o editor não vai recompor)'],
    defaultId: 0, cancelId: 0
  });
  if (r === 1) return abrir();
  app.quit();
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
    /* PORTA OCUPADA NAO E MAIS "aproveita e pronto", e essa linha custou caro.
       Quando o servidor daqui so servia arquivo, dar de ombros para um serve.py
       ja de pe era inofensivo. Agora ele tambem GRAVA O PATCH E RECOMPOE o mapa,
       e um serve.py antigo na mesma porta grava sem recompor: o dono edita,
       salva, e o mapa fica parado -- para sempre, e sem pista nenhuma. Foi
       exatamente o que aconteceu, com o editor acusando "o mapa esta atrasado"
       a cada abertura.
       Entao: pergunta QUEM esta na porta. Se for outro launcher, aproveita. Se
       for qualquer outra coisa, avisa em vez de fingir que esta tudo bem. */
    servidor.once('error', e => {
      if (e.code !== 'EADDRINUSE') throw e;
      http.get({ host: '127.0.0.1', port: PORTA, path: '/__thaira', timeout: 1500 }, r => {
        let b = '';
        r.on('data', d => b += d);
        r.on('end', () => {
          let ok = false;
          try { ok = JSON.parse(b).recompoe === true; } catch (_) { }
          if (ok) return abrir();
          avisaPortaOcupada();
        });
      }).on('error', avisaPortaOcupada).on('timeout', avisaPortaOcupada);
    });
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

/* Launcher desktop. No navegador o F1-F12, F5, Ctrl+W e Ctrl+T sao consumidos
   antes do keydown chegar no jogo -- preventDefault nao recupera. Aqui, sem menu
   de aplicacao, o Electron nao registra acelerador nenhum e o teclado inteiro e
   do jogo (inclusive hotkey rebindada pra F1..F12). */
const { app, BrowserWindow, Menu } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = __dirname;
// mesma porta do serve.py de proposito: localStorage e por origem, entao
// personagem criado numa porta nao some quando voce troca de jeito de abrir
const PORTA = 8765;
const DEV = process.argv.includes('--dev');
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

const servidor = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
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
  if (!DEV) return;
  win.webContents.openDevTools({ mode: 'detach' });
  // F5 so existe com --dev; no jogo normal ela fica livre pra hotbar
  win.webContents.on('before-input-event', (e, i) => {
    if (i.type === 'keyDown' && i.key === 'F5') { win.webContents.reload(); e.preventDefault(); }
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
    servidor.once('listening', abrirJanela);
    // porta ocupada = serve.py ja esta de pe, entao so aproveita
    servidor.once('error', e => { if (e.code === 'EADDRINUSE') abrirJanela(); else throw e; });
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

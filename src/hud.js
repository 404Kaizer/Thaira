/* hud.js — gerenciador de layout no modelo do cliente do Tibia:
   sidebars nos dois lados, painéis que trocam de lado / sobem / descem /
   colapsam / somem, barras de status na borda ou na sidebar, console
   redimensionável. Tudo salvo no localStorage. */
'use strict';

const HUD_KEY = 'thaira.hud';
/* ordem e lado padrão, parecido com o cliente: minimapa em cima à direita,
   depois status, equipamento, skills, lista de batalha, magias e mochila */
/* `fixo` não estica: o minimapa é um canvas de altura própria e o equipamento é
   grade absoluta de 178x239 — puxar a borda dos dois só criaria vão morto. */
const HUD_PANELS = [
  { id: 'minimap', n: 'Minimapa', dock: 'r', fixo: true },
  { id: 'status', n: 'Status', dock: 'r' },
  { id: 'equip', n: 'Equipamento', dock: 'r', fixo: true },
  { id: 'skills', n: 'Habilidades', dock: 'r' },
  { id: 'battle', n: 'Batalha', dock: 'r' },
  { id: 'spells', n: 'Magias', dock: 'r' },
  { id: 'bag', n: 'Mochila', dock: 'r' }
];
/* pedaços da tela que também ligam/desligam */
const HUD_BITS = [
  { id: 'hotbar', n: 'Barra de habilidades', el: '#hotbar-wrap' },
  { id: 'console', n: 'Chat', el: '#console' },
  { id: 'hunt', n: 'Nome da hunt', el: '#hunt-label' },
  { id: 'toolbar', n: 'Botões (bestiário/mapa)', el: '#toolbar' },
  { id: 'toast', n: 'Notificações de marco', el: '#toast' }
];
const HUD_DEF = () => ({
  // col: qual das duas colunas do lado; largo: ocupa as duas, na faixa do topo;
  // h: altura do corpo em px, 0 = do tamanho do conteúdo
  panels: HUD_PANELS.reduce((o, p, i) => (o[p.id] = { dock: p.dock, col: 0, largo: false, h: 0, ord: i, open: true, show: true }, o), {}),
  bits: HUD_BITS.reduce((o, b) => (o[b.id] = true, o), {}),
  status: 'edge',      // edge | sidebar | both | none
  hotAberto: false,    // segunda fileira da barra de habilidades
  cols: { l: 0, r: 1 },  // colunas abertas por lado: 0 fechado, 1, ou 2
  consoleH: 148
});
let HUD = HUD_DEF();

function hudLoad() {
  try {
    const raw = localStorage.getItem(HUD_KEY);
    if (!raw) return;
    const d = JSON.parse(raw), base = HUD_DEF();
    // mescla com o padrão: chave nova em versão nova não quebra save antigo
    HUD = {
      panels: Object.assign(base.panels, d.panels || {}),
      bits: Object.assign(base.bits, d.bits || {}),
      status: d.status || base.status,
      hotAberto: !!d.hotAberto,
      cols: Object.assign(base.cols, d.cols || {}),
      consoleH: d.consoleH || base.consoleH
    };
  } catch (e) { HUD = HUD_DEF(); }
}
const hudSave = () => localStorage.setItem(HUD_KEY, JSON.stringify(HUD));

/* ------------------------------------------------------------- aplicar */
function hudApply() {
  for (const s of ['l', 'r']) {
    document.querySelector('#lado-' + s).hidden = !HUD.cols[s];
    for (const c of [0, 1]) document.querySelector(`#dock-${s}${c}`).hidden = c >= HUD.cols[s];
    // a seta mostra o que o próximo clique faz: abrir, alargar ou fechar
    const a = document.querySelector(`.dock-arrow[data-d="${s}"]`), n = HUD.cols[s];
    a.textContent = ['›»‹', '‹«›'][s === 'l' ? 0 : 1][n];
    a.title = ['abrir a barra', 'alargar para duas colunas', 'fechar a barra'][n];
  }
  const ordenados = HUD_PANELS.slice().sort((a, b) => HUD.panels[a.id].ord - HUD.panels[b.id].ord);
  for (const p of ordenados) {
    const cfg = HUD.panels[p.id], el = document.querySelector('#panel-' + p.id);
    if (!el) continue;
    // painel largo vive na faixa do topo; senão, na sua coluna — e a coluna 2
    // fechada devolve o painel para a primeira em vez de sumir com ele
    const alvo = cfg.largo ? `#faixa-${cfg.dock}`
      : `#dock-${cfg.dock}${Math.min(cfg.col || 0, Math.max(0, HUD.cols[cfg.dock] - 1))}`;
    document.querySelector(alvo).appendChild(el);          // appendChild move e reordena
    el.style.display = cfg.show ? '' : 'none';
    el.classList.toggle('fechado', !cfg.open);
    // o ⇔ só faz sentido com as duas colunas abertas
    const bl = el.querySelector('[data-a="largo"]');
    if (bl) bl.hidden = HUD.cols[cfg.dock] < 2;
    // altura puxada à mão (o corpo já rola por dentro pelo CSS)
    const pb = el.querySelector('.pb');
    if (pb) pb.style.height = cfg.h ? cfg.h + 'px' : '';
  }
  // barras de status: borda do game, sidebar, as duas ou nenhuma
  const sb = document.querySelector('#statusbars'), alvo = HUD.status;
  document.querySelector('#topbar').style.display = (alvo === 'edge' || alvo === 'both') ? '' : 'none';
  HUD.panels.status.show = (alvo === 'sidebar' || alvo === 'both');
  document.querySelector('#panel-status').style.display = HUD.panels.status.show ? '' : 'none';
  // o mesmo bloco de barras vive num lugar só (ids não podem duplicar)
  (alvo === 'sidebar' ? document.querySelector('#status-body') : document.querySelector('#topbar')).appendChild(sb);
  sb.style.display = alvo === 'none' ? 'none' : '';

  for (const b of HUD_BITS) {
    const el = document.querySelector(b.el);
    if (el) el.style.display = HUD.bits[b.id] ? '' : 'none';
  }
  document.querySelector('#console').style.height = HUD.consoleH + 'px';
  // segunda fileira da barra de habilidades: a seta mostra o que o clique faz
  const hw = document.querySelector('#hotbar-wrap'), ha = document.querySelector('#hotbar-arrow');
  if (ha) {
    hw.classList.toggle('aberto', HUD.hotAberto);
    ha.textContent = HUD.hotAberto ? '˄' : '˅';
    ha.title = HUD.hotAberto ? 'menos slots' : 'mais slots';
  }
  hudResize();
}
/* o canvas encolheu/cresceu junto com as sidebars */
function hudResize() {
  const cv = document.querySelector('#c');
  if (cv && typeof g2 !== 'undefined' && g2) resizeCam(cv);
}

/* ------------------------------------------------------------- controles */
/* mover painel de lado/coluna/ordem é arraste; aqui sobrou só o que é liga-desliga */
function hudMove(id, campo) {
  const cfg = HUD.panels[id];
  // recolhido pela falta de espaço tem de abrir no clique como qualquer outro:
  // o botão alterna o que está NA TELA, não o que está guardado
  if (campo === 'open') cfg.open = document.querySelector('#panel-' + id).classList.contains('fechado');
  else cfg[campo] = !cfg[campo];                           // show | largo
  hudApply(); hudSave(); hudOptions(true);
}

/* A coluna NÃO recolhe painel nenhum sozinha. Antes, quando o último painel
   passava do fim da coluna, ela fechava os de baixo até caber — abrir uma aba
   ao máximo recolhia todas as outras, e o jogador perdia o layout que tinha
   montado sem ter pedido nada.
   Não precisa: `.panel{flex:0 1 auto}` já espreme os elásticos e cada corpo
   rola por dentro do próprio quadro (ver `.panel .pb`). O piso é o `min-height`
   de 34px por painel — sete deles cabem em qualquer coluna real. */

/* --------------------------------------------------------------- arraste */
/* Arrastar o cabeçalho leva o painel para outra coluna e outra posição. Mouse
   cru em vez do drag-and-drop do HTML5: o fantasma nativo é um bitmap desbotado
   que não se estiliza, e aqui quem segue o cursor é o próprio painel. */
let arr = null, suprimeClick = false;

/* comete o arraste: o painel assume o lado/coluna e a coluna inteira é
   renumerada com ele encaixado na posição i */
function hudSolta(id, s, col, ordem, i) {
  const cfg = HUD.panels[id];
  if (!HUD.cols[s]) HUD.cols[s] = 1;                       // soltar num lado fechado abre o lado
  cfg.dock = s; cfg.col = col; cfg.show = true;
  const nova = ordem.filter(x => x !== id);
  nova.splice(Math.min(i, nova.length), 0, id);
  nova.forEach((x, k) => HUD.panels[x].ord = k);
  hudApply(); hudSave(); hudOptions(true);
}

/* a coluna mais próxima de onde soltou fica com o painel; metade da tela decide
   o lado, e só com as duas colunas abertas a distância desempata entre elas */
function hudAlvo(x) {
  const s = x < innerWidth / 2 ? 'l' : 'r';
  if (HUD.cols[s] < 2) return { s, col: 0 };
  const dist = c => {
    const r = document.querySelector(`#dock-${s}${c}`).getBoundingClientRect();
    return Math.abs(x - (r.left + r.right) / 2);
  };
  return { s, col: dist(1) < dist(0) ? 1 : 0 };
}

/* vizinhos da caixa alvo e o índice onde o painel entra: antes do primeiro cujo
   meio já passou do cursor */
function hudVizinhos(d) {
  const cfg = HUD.panels[d.id];
  const caixa = document.querySelector(cfg.largo ? `#faixa-${d.alvo.s}` : `#dock-${d.alvo.s}${d.alvo.col}`);
  const irmaos = [...caixa.children].filter(c =>
    c.classList.contains('panel') && c !== d.el && c.style.display !== 'none');
  let i = irmaos.findIndex(c => d.y < c.getBoundingClientRect().top + c.offsetHeight / 2);
  return { caixa, irmaos, i: i < 0 ? irmaos.length : i };
}

function hudArrastaInicio(e, id, el) {
  if (e.button || (e.target.dataset && e.target.dataset.a)) return;   // ⇔ ▾ ✕ têm clique próprio
  const r = el.getBoundingClientRect();
  arr = { id, el, dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, x: e.clientX, y: e.clientY, moveu: false };
  e.preventDefault();
}

addEventListener('mousemove', e => {
  if (!arr) return;
  // botão solto fora da janela não gera mouseup: sem isto o painel fica grudado
  // no cursor para sempre, e só um F5 devolve a interface
  if (!e.buttons) return dispatchEvent(new MouseEvent('mouseup'));
  // enquanto não passar de 4px o gesto ainda pode ser o clique que recolhe
  if (!arr.moveu) {
    if (Math.abs(e.clientX - arr.x) + Math.abs(e.clientY - arr.y) < 4) return;
    arr.moveu = true;
    arr.el.style.width = arr.w + 'px';
    arr.el.classList.add('arrastando');
    document.querySelector('#app').classList.add('arrastando');
  }
  arr.x = e.clientX; arr.y = e.clientY;
  arr.el.style.left = (e.clientX - arr.dx) + 'px';
  arr.el.style.top = (e.clientY - arr.dy) + 'px';
  arr.alvo = hudAlvo(e.clientX);
  const { caixa, irmaos, i } = hudVizinhos(arr);
  arr.ordem = irmaos.map(c => c.id.slice(6)); arr.i = i;
  const linha = document.querySelector('.drop-line') ||
    Object.assign(document.createElement('div'), { className: 'drop-line' });
  caixa.insertBefore(linha, irmaos[i] || null);
});

/* altura do painel: puxar a aba de baixo. O corpo ganha rolagem própria em vez
   de empurrar os painéis de baixo coluna afora. */
let red = null;
addEventListener('mousemove', e => {
  if (!red) return;
  if (!e.buttons) return dispatchEvent(new MouseEvent('mouseup'));   // idem: soltou fora
  const h = Math.max(60, Math.round(red.h0 + e.clientY - red.y0));
  HUD.panels[red.id].h = h;
  red.pb.style.height = h + 'px';
});
addEventListener('mouseup', () => { if (red) { red = null; hudApply(); hudSave(); } });

addEventListener('mouseup', () => {
  if (!arr) return;
  const d = arr; arr = null;
  const linha = document.querySelector('.drop-line');
  if (linha) linha.remove();
  d.el.classList.remove('arrastando');
  d.el.style.left = d.el.style.top = d.el.style.width = '';
  document.querySelector('#app').classList.remove('arrastando');
  if (!d.moveu || !d.alvo) return;
  // o click nasce depois do mouseup: sem isso, todo arraste recolhia o painel
  suprimeClick = true; setTimeout(() => suprimeClick = false);
  hudSolta(d.id, d.alvo.s, d.alvo.col, d.ordem, d.i);
});

/* janela de opções da interface (Tibia: Opções > Interface > HUD) */
function hudOptions(soAtualiza) {
  const w = document.querySelector('#ui-win');
  if (!soAtualiza) w.style.display = w.style.display === 'flex' ? 'none' : 'flex';
  if (w.style.display !== 'flex') return;
  const box = document.querySelector('#ui-list');
  box.innerHTML = '';
  /* cabeçalho do grupo; `acao` é o botão do próprio grupo (o "padrão" do áudio),
     que fica na régua do título em vez de virar mais uma linha da lista */
  const sec = (t, acao) => {
    const d = document.createElement('div'); d.className = 'sec';
    d.innerHTML = `<span>${t}</span><i></i>`;
    if (acao) {
      const b = document.createElement('button');
      b.className = 'mini'; b.textContent = acao.n; b.onclick = acao.fn;
      d.appendChild(b);
    }
    box.appendChild(d);
  };
  /* `rad` = escolha dentro de um grupo (pino no meio + nome em dourado);
     sem ele a linha é liga/desliga (pedra acesa por inteiro) */
  const linha = (nome, ligado, onToggle, rad) => {
    const d = document.createElement('div');
    d.className = 'ui-row' + (rad && ligado ? ' on' : '');
    d.innerHTML = `<i class="ck${rad ? ' rad' : ''}${ligado ? ' on' : ''}"></i><span class="lbl">${nome}</span>`;
    d.onclick = onToggle;
    box.appendChild(d);
  };

  sec('Tela');
  linha('Tela cheia', !!document.fullscreenElement, () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  });

  /* Áudio. Mexer no cursor aplica na hora, sem confirmar: som é coisa que se
     acerta ouvindo, e ter de fechar o painel para conferir atrapalha. */
  sec('Áudio', { n: 'padrão', fn: () => { audioVolReset(); hudOptions(true); } });
  const volume = (id, nome) => {
    const d = document.createElement('div'); d.className = 'ui-vol';
    const v = audioVols()[id];
    d.innerHTML = `<span class="lbl">${nome}</span>`;
    const r = document.createElement('input');
    r.type = 'range'; r.min = 0; r.max = 1; r.step = .05; r.value = v;
    r.style.setProperty('--v', Math.round(v * 100) + '%');   // parte cheia da calha
    const n = document.createElement('b'); n.textContent = Math.round(v * 100) + '%';
    r.oninput = e => {
      const x = +e.target.value, pct = Math.round(x * 100) + '%';
      n.textContent = pct; r.style.setProperty('--v', pct); audioVol(id, x);
    };
    d.appendChild(r); d.appendChild(n);
    box.appendChild(d);
  };
  volume('geral', 'Volume geral');
  volume('musica', 'Música');
  volume('efeitos', 'Efeitos');
  volume('passos', 'Passos');
  volume('ambiente', 'Ambiente (vento, chuva)');

  sec('Barras de vida e mana');
  const modos = [['edge', 'na borda do jogo'], ['sidebar', 'na barra lateral'], ['both', 'nos dois'], ['none', 'escondidas']];
  for (const [v, n] of modos)
    linha(n, HUD.status === v, () => { HUD.status = v; hudApply(); hudSave(); hudOptions(true); }, true);

  sec('Painéis');
  for (const p of HUD_PANELS)
    if (p.id !== 'status') linha(p.n, HUD.panels[p.id].show, () => hudMove(p.id, 'show'));

  sec('Elementos da tela');
  for (const b of HUD_BITS)
    linha(b.n, HUD.bits[b.id], () => { HUD.bits[b.id] = !HUD.bits[b.id]; hudApply(); hudSave(); hudOptions(true); });
}

/* --------------------------------------------------------------- montagem */
addEventListener('DOMContentLoaded', () => {
  hudLoad();
  /* cabeçalho: alargar, recolher, fechar. Lado, coluna e ordem saíram daqui —
     agora é o arraste que faz isso, e três ícones de 11px a menos no cabeçalho. */
  for (const p of HUD_PANELS) {
    const el = document.querySelector('#panel-' + p.id);
    if (!el) continue;
    if (p.fixo) el.classList.add('fixo');
    const h = document.createElement('div');
    h.className = 'ph';
    h.innerHTML = `<span>${p.n}</span>
      <i data-a="largo" title="ocupar as duas colunas">⇔</i>
      <i data-a="open" title="recolher">▾</i><i data-a="show" title="fechar">✕</i>`;
    h.onclick = e => {
      if (suprimeClick) return;                             // foi arraste, não clique
      hudMove(p.id, (e.target.dataset && e.target.dataset.a) || 'open');
    };
    h.addEventListener('mousedown', e => hudArrastaInicio(e, p.id, el));
    el.insertBefore(h, el.firstChild);
    if (p.fixo) continue;
    const g = document.createElement('div');
    g.className = 'pg'; g.title = 'arraste para mudar a altura';
    g.addEventListener('mousedown', e => {
      const pb = el.querySelector('.pb');
      red = { id: p.id, pb, y0: e.clientY, h0: pb.getBoundingClientRect().height };
      e.preventDefault();
    });
    el.appendChild(g);
  }
  // janela menor = menos espaço na coluna: a conta do que cabe tem de refazer
  addEventListener('resize', () => hudApply());
  addEventListener('fullscreenchange', () => hudOptions(true));
  document.querySelector('#ui-btn').onclick = () => hudOptions();
  document.querySelector('#ui-close').onclick = () => document.querySelector('#ui-win').style.display = 'none';
  document.querySelector('#ui-reset').onclick = () => { HUD = HUD_DEF(); hudApply(); hudSave(); hudOptions(true); };
  // a seta cicla o lado: 1 coluna -> 2 colunas -> fechado
  document.querySelector('#hotbar-arrow').onclick = () => {
    HUD.hotAberto = !HUD.hotAberto; hudApply(); hudSave();
  };
  document.querySelectorAll('.dock-arrow').forEach(a => a.onclick = () => {
    HUD.cols[a.dataset.d] = (HUD.cols[a.dataset.d] + 1) % 3;
    hudApply(); hudSave(); hudOptions(true);
  });
  // console redimensionável arrastando a borda de cima
  const grip = document.querySelector('#console-grip');
  let arrastando = false;
  grip.addEventListener('mousedown', e => { arrastando = true; e.preventDefault(); });
  addEventListener('mousemove', e => {
    if (!arrastando) return;
    HUD.consoleH = Math.max(60, Math.min(420, innerHeight - e.clientY - 6));
    document.querySelector('#console').style.height = HUD.consoleH + 'px';
    hudResize();
  });
  addEventListener('mouseup', () => { if (arrastando) { arrastando = false; hudSave(); } });
  // abas do chat: tudo x só combate
  document.querySelectorAll('#chat-tabs .tab').forEach(b => b.onclick = () => {
    document.querySelectorAll('#chat-tabs .tab').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    document.querySelector('#log').dataset.canal = b.dataset.canal;
  });
  hudApply();
});

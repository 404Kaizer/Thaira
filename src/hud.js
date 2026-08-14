/* hud.js — gerenciador de layout no modelo do cliente do Tibia:
   sidebars nos dois lados, painéis que trocam de lado / sobem / descem /
   colapsam / somem, barras de status na borda ou na sidebar, console
   redimensionável. Tudo salvo no localStorage. */
'use strict';

const HUD_KEY = 'thaira.hud';
/* ordem e lado padrão, parecido com o cliente: minimapa em cima à direita,
   depois status, equipamento, skills, lista de batalha, magias e mochila */
const HUD_PANELS = [
  { id: 'minimap', n: 'Minimapa', dock: 'r' },
  { id: 'status', n: 'Status', dock: 'r' },
  { id: 'equip', n: 'Equipamento', dock: 'r' },
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
  panels: HUD_PANELS.reduce((o, p, i) => (o[p.id] = { dock: p.dock, ord: i, open: true, show: true }, o), {}),
  bits: HUD_BITS.reduce((o, b) => (o[b.id] = true, o), {}),
  status: 'edge',      // edge | sidebar | both | none
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
      consoleH: d.consoleH || base.consoleH
    };
  } catch (e) { HUD = HUD_DEF(); }
}
const hudSave = () => localStorage.setItem(HUD_KEY, JSON.stringify(HUD));

/* ------------------------------------------------------------- aplicar */
function hudApply() {
  const docks = { l: document.querySelector('#dock-left'), r: document.querySelector('#dock-right') };
  const ordenados = HUD_PANELS.slice().sort((a, b) => HUD.panels[a.id].ord - HUD.panels[b.id].ord);
  for (const p of ordenados) {
    const cfg = HUD.panels[p.id], el = document.querySelector('#panel-' + p.id);
    if (!el) continue;
    docks[cfg.dock].appendChild(el);                       // appendChild move e reordena
    el.style.display = cfg.show ? '' : 'none';
    el.classList.toggle('fechado', !cfg.open);
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
  for (const d of ['l', 'r']) docks[d].classList.toggle('vazio', !docks[d].querySelector('.panel:not([style*="none"])'));
  hudResize();
}
/* o canvas encolheu/cresceu junto com as sidebars */
function hudResize() {
  const cv = document.querySelector('#c');
  if (cv && typeof g2 !== 'undefined' && g2) resizeCam(cv);
}

/* ------------------------------------------------------------- controles */
function hudMove(id, campo, valor) {
  const cfg = HUD.panels[id];
  if (campo === 'dock') cfg.dock = cfg.dock === 'l' ? 'r' : 'l';
  else if (campo === 'open') cfg.open = !cfg.open;
  else if (campo === 'show') cfg.show = !cfg.show;
  else if (campo === 'ord') {
    const irmaos = HUD_PANELS.filter(p => HUD.panels[p.id].dock === cfg.dock)
      .sort((a, b) => HUD.panels[a.id].ord - HUD.panels[b.id].ord);
    const i = irmaos.findIndex(p => p.id === id), j = i + valor;
    if (j < 0 || j >= irmaos.length) return;
    const o = HUD.panels[irmaos[j].id].ord;
    HUD.panels[irmaos[j].id].ord = cfg.ord; cfg.ord = o;
  }
  hudApply(); hudSave(); hudOptions(true);
}

/* janela de opções da interface (Tibia: Opções > Interface > HUD) */
function hudOptions(soAtualiza) {
  const w = document.querySelector('#ui-win');
  if (!soAtualiza) w.style.display = w.style.display === 'flex' ? 'none' : 'flex';
  if (w.style.display !== 'flex') return;
  const box = document.querySelector('#ui-list');
  box.innerHTML = '';
  const sec = t => { const d = document.createElement('div'); d.className = 'sec'; d.textContent = t; box.appendChild(d); };
  const linha = (nome, ligado, onToggle, extra) => {
    const d = document.createElement('div'); d.className = 'ui-row';
    d.innerHTML = `<span>${ligado ? '☑' : '☐'} ${nome}</span>`;
    d.onclick = onToggle;
    if (extra) { const e = document.createElement('span'); e.className = 'ui-extra'; e.innerHTML = extra.html; e.onclick = ev => { ev.stopPropagation(); extra.fn(ev); }; d.appendChild(e); }
    box.appendChild(d);
  };
  sec('Barras de vida e mana');
  const modos = [['edge', 'na borda do jogo'], ['sidebar', 'na barra lateral'], ['both', 'nos dois'], ['none', 'escondidas']];
  for (const [v, n] of modos)
    linha(n, HUD.status === v, () => { HUD.status = v; hudApply(); hudSave(); hudOptions(true); });
  sec('Painéis');
  for (const p of HUD_PANELS) {
    if (p.id === 'status') continue;
    const c = HUD.panels[p.id];
    linha(p.n, c.show, () => hudMove(p.id, 'show'), {
      html: `<b title="trocar de lado">${c.dock === 'l' ? '→' : '←'}</b>`,
      fn: () => hudMove(p.id, 'dock')
    });
  }
  /* Áudio. Mexer no cursor aplica na hora, sem confirmar: som é coisa que se
     acerta ouvindo, e ter de fechar o painel para conferir atrapalha. */
  sec('Áudio');
  const volume = (id, nome) => {
    const d = document.createElement('div'); d.className = 'ui-vol';
    const v = audioVols()[id];
    d.innerHTML = `<span>${nome}</span>`;
    const r = document.createElement('input');
    r.type = 'range'; r.min = 0; r.max = 1; r.step = .05; r.value = v;
    const n = document.createElement('b'); n.textContent = Math.round(v * 100) + '%';
    r.oninput = e => { const x = +e.target.value; n.textContent = Math.round(x * 100) + '%'; audioVol(id, x); };
    d.appendChild(r); d.appendChild(n);
    box.appendChild(d);
  };
  volume('geral', 'Volume geral');
  volume('musica', 'Música');
  volume('efeitos', 'Efeitos');
  volume('passos', 'Passos');
  volume('ambiente', 'Ambiente (vento, chuva)');
  const vr = document.createElement('div');
  vr.className = 'ui-row'; vr.innerHTML = '<span>↺ volumes padrão</span>';
  vr.onclick = () => { audioVolReset(); hudOptions(true); };
  box.appendChild(vr);

  sec('Elementos da tela');
  for (const b of HUD_BITS)
    linha(b.n, HUD.bits[b.id], () => { HUD.bits[b.id] = !HUD.bits[b.id]; hudApply(); hudSave(); hudOptions(true); });
  const r = document.createElement('button');
  r.className = 'btn'; r.textContent = 'Restaurar padrão';
  r.onclick = () => { HUD = HUD_DEF(); hudApply(); hudSave(); hudOptions(true); };
  box.appendChild(r);
}

/* --------------------------------------------------------------- montagem */
addEventListener('DOMContentLoaded', () => {
  hudLoad();
  // cabeçalho de cada painel: trocar de lado, subir, descer, colapsar, fechar
  for (const p of HUD_PANELS) {
    const el = document.querySelector('#panel-' + p.id);
    if (!el) continue;
    const h = document.createElement('div');
    h.className = 'ph';
    h.innerHTML = `<span>${p.n}</span>
      <i data-a="dock" title="trocar de lado">⇄</i><i data-a="up" title="subir">↑</i>
      <i data-a="down" title="descer">↓</i><i data-a="open" title="recolher">▾</i>
      <i data-a="show" title="fechar">✕</i>`;
    h.onclick = e => {
      const a = e.target.dataset && e.target.dataset.a;
      if (!a) return hudMove(p.id, 'open');                 // clicar no título recolhe
      if (a === 'up') hudMove(p.id, 'ord', -1);
      else if (a === 'down') hudMove(p.id, 'ord', 1);
      else hudMove(p.id, a);
    };
    el.insertBefore(h, el.firstChild);
  }
  document.querySelector('#ui-btn').onclick = () => hudOptions();
  document.querySelector('#ui-close').onclick = () => document.querySelector('#ui-win').style.display = 'none';
  document.querySelectorAll('.dock-arrow').forEach(a => a.onclick = () => {
    const lado = a.dataset.d;                                // seta ao lado do jogo abre/fecha a sidebar
    const algum = HUD_PANELS.some(p => HUD.panels[p.id].dock === lado && HUD.panels[p.id].show);
    HUD_PANELS.forEach(p => { if (HUD.panels[p.id].dock === lado) HUD.panels[p.id].show = !algum; });
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

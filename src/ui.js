/* ui.js — bestiário (com pontos de carisma) e mapa expandido.
   Depende de data.js, world.js e game.js (P, G, log, $). */
'use strict';

/* ------------------------------------------------------------- bestiário */
/* Mesma ideia do Tibia: cada criatura tem 3 marcos de mortes (Proeza, Perícia,
   Maestria). Cada marco revela mais informação; o terceiro rende pontos de
   carisma, que marcam uma espécie como presa (+dano contra ela). */
const bestKills = id => (P.best && P.best[id]) || 0;
const bestDiff = id => BEST_DIFF[MONSTERS[id].diff] || BEST_DIFF.trivial;
function bestStage(id) {                 // 0 = nunca matou, 3 = completo
  const k = bestKills(id), m = bestDiff(id).k;
  return k >= m[2] ? 3 : k >= m[1] ? 2 : k >= m[0] ? 1 : 0;
}
function bestiaryKill(id) {
  if (!MONSTERS[id]) return;
  P.best = P.best || {};
  const antes = bestStage(id);
  P.best[id] = bestKills(id) + 1;
  /* O contrato lê o MESMO contador, então não há nada para incrementar aqui —
     só o aviso de que fechou. Fica antes do `return` de estágio igual, senão a
     conclusão só apareceria nas mortes que por acaso viram marco do bestiário. */
  const a = P.tasks && P.tasks.ativo;
  if (a && a.mob === id && taskProgresso(a) === a.alvo) {
    log(`Contrato cumprido: ${a.alvo} ${MONSTERS[id].n}. Volte ao templo para receber.`, 'good');
    notify('📜', 'Contrato cumprido', 'volte ao templo para receber o pagamento');
  }
  if ($('#task-win') && $('#task-win').style.display === 'flex') renderTasks();
  const agora = bestStage(id);
  if (agora === antes) return;
  const d = bestDiff(id);
  log(`Bestiário — ${MONSTERS[id].n}: ${BEST_STAGE[agora - 1]} desbloqueada (${BEST_REVEAL[agora - 1]}).`, 'good');
  notify('📖', `${MONSTERS[id].n} — ${BEST_STAGE[agora - 1]}`, 'revelou ' + BEST_REVEAL[agora - 1]);
  if (agora === 3) {
    P.charm = (P.charm || 0) + d.cp;
    log(`+${d.cp} pontos de carisma (total ${P.charm}).`, 'good');
  }
  if ($('#best-win').style.display === 'flex') renderBestiary();
}

/* ------------------------------------------------------- contratos de caça */
/* A Tarefa de Caça do Tibia e o Slayer do RuneScape resolvem o mesmo problema
   que este jogo tinha: subir de nível era o ÚNICO objetivo, então nenhuma hunt
   tinha razão de existir depois que você passava dela. Um contrato dá razão —
   e ele custa quase nada em código porque o contador já existe: é o mesmo
   `P.best` do bestiário, com uma marca de onde a contagem começou.

   O laço é de propósito: aceita no templo, caça longe, VOLTA pro templo pra
   receber. Andar de volta é o que transforma o loot em decisão (levo mais poção
   ou volto agora?) — sem isso o contrato seria só um número que se preenche. */
const TASK_ALVOS = [25, 50, 100, 200];
const TASK_OFERTAS = 3;

/* nível sugerido da criatura: o da hunt onde ela mora. Quem só existe no mundo
   aberto conta como nível 1 — é bicho de estrada, e contrato de bicho de estrada
   some sozinho da lista quando coisa melhor aparece (a lista é ordenada por xp). */
const nivelDe = id => {
  const hs = HUNTS.filter(h => h.mobs.includes(id));
  return hs.length ? Math.min(...hs.map(h => h.lvl)) : 1;
};

function taskOfertas() {
  const vistos = Object.keys(MONSTERS).filter(id =>
    !MONSTERS[id].boss && bestKills(id) > 0 && nivelDe(id) <= P.level + 10);
  // as 10 criaturas mais fortes que ele já encarou: contrato tem de ser da faixa
  // dele, senão vira "mate 200 ratos" no nível 200
  const pool = vistos.sort((a, b) => MONSTERS[b].exp - MONSTERS[a].exp).slice(0, 10);
  const out = [];
  while (out.length < TASK_OFERTAS && pool.length) {
    const id = pool.splice(ri(0, pool.length - 1), 1)[0];
    const alvo = TASK_ALVOS[ri(0, TASK_ALVOS.length - 1)];
    const m = MONSTERS[id], d = bestDiff(id);
    /* Prêmio calibrado contra o que a própria caçada já paga: o ouro fica em
       torno de metade do que o loot das N mortes rende (bônus, não substituto) e
       a exp é 15% a mais. O carisma NÃO escala com a quantidade de propósito —
       só dá pra ter 3 presas marcadas, então um contrato de 200 bichos pagando
       carisma proporcional estouraria o teto na primeira entrega e a moeda
       inteira viraria lixo. Ele escala com a DIFICULDADE, que é o que interessa. */
    out.push({
      mob: id, alvo,
      ouro: Math.round(m.exp * alvo * 0.25),
      exp: Math.round(m.exp * XP_MULT * alvo * 0.15),
      carisma: Math.max(1, Math.round(d.cp / 5))
    });
  }
  return out;
}

function taskEstado() {
  P.tasks = P.tasks || { ativo: null, ofertas: null, feitos: 0 };
  if (!P.tasks.ativo && !P.tasks.ofertas) P.tasks.ofertas = taskOfertas();
  return P.tasks;
}
const taskProgresso = t => t ? Math.min(t.alvo, bestKills(t.mob) - t.base) : 0;

function taskAceitar(i) {
  const t = taskEstado();
  if (!shopNear()) return log('Os contratos são firmados no templo.', 'bad');
  const o = t.ofertas[i]; if (!o) return;
  t.ativo = Object.assign({ base: bestKills(o.mob) }, o);
  t.ofertas = null;
  log(`Contrato aceito: matar ${o.alvo} ${MONSTERS[o.mob].n}.`, 'good');
  notify('📜', 'Contrato aceito', `${o.alvo} ${MONSTERS[o.mob].n} — volte ao templo para receber`);
  renderTasks();
}
function taskDesistir() {
  const t = taskEstado();
  t.ativo = null; t.ofertas = taskOfertas();
  log('Contrato abandonado.');
  renderTasks();
}
function taskReceber() {
  const t = taskEstado(), a = t.ativo;
  if (!a || taskProgresso(a) < a.alvo) return;
  if (!shopNear()) return log('Volte ao templo para receber o pagamento.', 'bad');
  P.gold += a.ouro; P.charm = (P.charm || 0) + a.carisma; addExp(a.exp);
  t.feitos++; t.ativo = null; t.ofertas = taskOfertas();
  log(`Contrato cumprido: +${a.ouro} moedas, +${a.exp} exp, +${a.carisma} de carisma.`, 'good');
  notify('📜', 'Contrato cumprido', `${a.ouro} 🪙 · ${a.carisma} de carisma`);
  sfx('coin'); renderTasks(); renderBars(); renderInv();
}

function renderTasks() {
  const box = $('#task-list'); if (!box) return;
  const t = taskEstado(), perto = shopNear();
  $('#task-head').textContent = `${t.feitos} cumprido${t.feitos === 1 ? '' : 's'}`;
  if (t.ativo) {
    const a = t.ativo, p = taskProgresso(a), pronto = p >= a.alvo, m = MONSTERS[a.mob];
    box.innerHTML = `<div class="sec">Contrato em andamento</div>
      <div class="task-card">
        <b>Matar ${a.alvo} × ${m.n}</b>
        <div class="bsbar"><u style="width:${p / a.alvo * 100}%;background:${pronto ? '#7fd08a' : '#f0cd7a'}"></u></div>
        <span>${p}/${a.alvo}${pronto ? ' — pronto' : ''}</span>
        <i>Paga ${a.ouro} 🪙 · ${a.exp} exp · ${a.carisma} de carisma</i>
      </div>
      <button class="btn" id="task-claim" ${pronto && perto ? '' : 'disabled'}>
        ${pronto ? (perto ? 'Receber pagamento' : 'Volte ao templo para receber') : 'Ainda caçando'}</button>
      <button class="mini" id="task-drop" style="margin-top:8px">Abandonar contrato</button>`;
    $('#task-claim').onclick = taskReceber;
    $('#task-drop').onclick = taskDesistir;
    return;
  }
  if (!t.ofertas.length) {
    box.innerHTML = '<div class="note">Nenhum contrato disponível. Mate alguma criatura primeiro — o quadro só oferece o que você já enfrentou.</div>';
    return;
  }
  box.innerHTML = '<div class="sec">Contratos disponíveis</div>' + t.ofertas.map((o, i) => {
    const m = MONSTERS[o.mob], d = bestDiff(o.mob);
    return `<div class="task-card">
      <b>Matar ${o.alvo} × ${m.n}</b>
      <span style="color:${d.col}">${m.cls} · ${d.n} · nível ${nivelDe(o.mob)}+</span>
      <i>Paga ${o.ouro} 🪙 · ${o.exp} exp · ${o.carisma} de carisma</i>
      <button class="mini" data-i="${i}" ${perto ? '' : 'disabled'}>${perto ? 'Aceitar' : 'só no templo'}</button>
    </div>`;
  }).join('');
  box.querySelectorAll('button[data-i]').forEach(b => b.onclick = () => taskAceitar(+b.dataset.i));
}

/* classifica um item do loot pela chance, como a coluna de raridade do bestiário */
const lootRarity = ch => LOOT_RARITY.find(r => ch >= r.min) || LOOT_RARITY[LOOT_RARITY.length - 1];

let bestSel = null;
function renderBestiary() {
  const box = $('#best-list'); box.innerHTML = '';
  const total = Object.keys(MONSTERS).length;
  const completos = Object.keys(MONSTERS).filter(id => bestStage(id) === 3).length;
  $('#best-head').textContent = `${completos}/${total} completos · ${P.charm || 0} pontos de carisma`;

  const porClasse = {};
  for (const id in MONSTERS) (porClasse[MONSTERS[id].cls] = porClasse[MONSTERS[id].cls] || []).push(id);
  for (const cls of Object.keys(porClasse).sort()) {
    const h = document.createElement('div'); h.className = 'sec'; h.textContent = cls;
    box.appendChild(h);
    const grid = document.createElement('div'); grid.className = 'best-grid';
    for (const id of porClasse[cls].sort((a, b) => MONSTERS[a].exp - MONSTERS[b].exp)) {
      const st = bestStage(id), d = bestDiff(id), m = MONSTERS[id];
      const c = document.createElement('div');
      c.className = 'best-card' + (st ? '' : ' locked') + (bestSel === id ? ' sel' : '');
      c.style.borderColor = st ? d.col + '99' : '';
      const alvo = st < 3 ? d.k[st] : d.k[2];
      c.innerHTML = `<b>${st ? m.n : '???'}</b>
        <i style="color:${d.col}">${d.n}</i>
        <span>${bestKills(id)}/${alvo}</span>
        <div class="bsbar"><u style="width:${clamp(bestKills(id) / alvo * 100, 0, 100)}%;background:${d.col}"></u></div>`;
      c.onclick = () => { bestSel = id; renderBestiary(); };
      grid.appendChild(c);
    }
    box.appendChild(grid);
  }
  renderBestDetail();
}

function renderBestDetail() {
  const box = $('#best-detail');
  if (!bestSel) { box.innerHTML = '<div class="note">Escolha uma criatura na lista.</div>'; return; }
  const id = bestSel, m = MONSTERS[id], st = bestStage(id), d = bestDiff(id);
  const marcado = P.charms && P.charms[id];
  let h = `<div class="bd-top"><b style="color:${d.col}">${st ? m.n : '???'}</b>
    <span>${m.cls} · ${d.n}</span></div>
    <div class="note">Mortes: <b>${bestKills(id)}</b> · ${st < 3 ? `faltam <b>${d.k[st] - bestKills(id)}</b> para ${BEST_STAGE[st]}` : 'entrada completa'}</div>`;

  if (st === 0) {
    h += `<div class="note">Nada registrado. Mate um para começar a preencher.<br>
      Marcos: ${d.k.join(' / ')} mortes · rende ${d.cp} pontos de carisma.</div>`;
  } else {
    h += `<div class="bd-stats"><div>Vida <b>${m.hp}</b></div><div>Experiência <b>${Math.round(m.exp * XP_MULT)}</b></div>`;
    if (st >= 2) h += `<div>Ataque <b>${m.atk[0]}–${m.atk[1]}</b></div><div>Armadura <b>${m.arm}</b></div>
      <div>Velocidade <b>${m.spd}</b></div><div>Alcance <b>${m.ranged ? m.ranged.range : 1}</b></div>`;
    h += '</div>';
    /* Elementos entram no mesmo marco das outras estatísticas de combate: é a
       tela de "o que eu sei sobre este bicho", e sem isto a única forma de
       descobrir a fraqueza era decorar as setas ▲▼ no meio da luta.
       Só o que foge de 1 aparece — listar sete linhas em que cinco dizem
       "normal" é ruído, e o que o jogador procura aqui é a exceção. */
    if (st >= 2) {
      const fora = Object.keys(ELEM).filter(k => resistOf(m, k) !== 1)
        .sort((a, b) => resistOf(m, b) - resistOf(m, a));
      if (fora.length) {
        h += '<div class="sec">Elementos</div>';
        for (const k of fora) {
          const r = resistOf(m, k);
          h += `<div class="bd-loot"><span style="color:${cssCol(ELEM[k].cor)}">${ELEM[k].n}</span>
            <i style="color:${r > 1 ? '#7fd08a' : '#e07a6a'}">${r === 0 ? 'imune' : (r > 1 ? 'fraco ×' : 'resiste ×') + r}</i></div>`;
        }
      }
    }
    h += '<div class="sec">Saque</div>';
    let escondidos = 0;
    for (const [lid, ch] of m.loot) {
      const r = lootRarity(ch);
      if (r.stage > st - 1) { escondidos++; continue; }
      h += `<div class="bd-loot"><span>${ITEMS[lid].ico} ${ITEMS[lid].n}</span>
        <i style="color:${r.col}">${r.n}</i></div>`;
    }
    if (escondidos) h += `<div class="note">+${escondidos} item(ns) ainda ocultos — mate mais para revelar.</div>`;
    if (st === 3) {
      const hunt = WORLD.hunts.find(x => x.mobs.includes(id));
      h += `<div class="sec">Onde vive</div><div class="note">${hunt
        ? `${hunt.n} (${FLOOR_NAMES[hunt.z]}) — em ${hunt.x},${hunt.y}`
        : 'espalhado pelo mundo aberto'}</div>`;
      h += marcado
        ? `<div class="note" style="color:#7fd08a">★ Marcada como presa: +${Math.round(CHARM_BONUS * 100)}% de dano.
             <button class="mini" onclick="toggleCharm('${id}')">remover</button></div>`
        : `<button class="btn" style="margin-top:8px" onclick="toggleCharm('${id}')">
             Marcar como presa — ${CHARM_COST} pontos (+${Math.round(CHARM_BONUS * 100)}% de dano)</button>`;
    }
  }
  box.innerHTML = h;
}

function toggleCharm(id) {
  P.charms = P.charms || {};
  if (P.charms[id]) {
    delete P.charms[id]; P.charm = (P.charm || 0) + Math.round(CHARM_COST / 2);
    log(`Presa removida de ${MONSTERS[id].n} (metade dos pontos devolvida).`);
  } else {
    if (Object.keys(P.charms).length >= CHARM_MAX) return log(`Você só pode ter ${CHARM_MAX} presas marcadas.`, 'bad');
    if ((P.charm || 0) < CHARM_COST) return log('Pontos de carisma insuficientes.', 'bad');
    P.charm -= CHARM_COST; P.charms[id] = 1;
    log(`${MONSTERS[id].n} marcada como presa: +${Math.round(CHARM_BONUS * 100)}% de dano.`, 'good');
  }
  renderBestiary();
}

/* ---------------------------------------------------------------- forja */
/* Imbuement: gasta despojo de monstro e ouro para pôr um bônus fixo numa peça
   equipada. O bônus entra como AFIXO (`it.af`), que é a estrutura que o recalc,
   o tooltip e o save já leem — nenhum caminho novo, nenhuma regra nova.
   Um por peça, e trocar apaga o anterior: sem esse teto a forja viraria a única
   fonte de poder e o que cai no chão deixaria de valer. */
const temMats = im => im.mats.every(([id, q]) => contaMat(id) >= q);
const contaMat = id => P.bag.filter(b => b.id === id).reduce((a, b) => a + (b.count || 1), 0);
function gastaMat(id, q) {
  for (let i = P.bag.length - 1; i >= 0 && q > 0; i--) {
    const b = P.bag[i]; if (b.id !== id) continue;
    const usa = Math.min(q, b.count || 1); q -= usa;
    if ((b.count || 1) <= usa) P.bag.splice(i, 1); else b.count -= usa;
  }
}
let forjaSlot = 'weapon';
function imbuir(imId) {
  const im = IMBUEMENTS.find(x => x.id === imId), it = P.eq[forjaSlot];
  if (!im || !it) return;
  if (!shopNear()) return log('A forja fica no templo.', 'bad');
  if (P.gold < im.ouro) return log('Ouro insuficiente.', 'bad');
  if (!temMats(im)) return log('Faltam materiais.', 'bad');
  P.gold -= im.ouro;
  im.mats.forEach(([id, q]) => gastaMat(id, q));
  // o afixo antigo do imbuement sai junto: `imb` guarda qual era, e o afixo dele
  // é reconhecível pelo nome — é o mesmo objeto que foi empurrado da tabela
  it.af = (it.af || []).filter(a => !IMBUEMENTS.some(x => x.n === a.n));
  it.af.push({ n: im.n, b: im.b });
  it.imb = im.id;
  recalc(); renderInv(); renderBars(); renderForja();
  log(`${im.ico} ${itemStats(it).name} recebeu o imbuement ${im.n}.`, 'good');
  notify(im.ico, 'Imbuement aplicado', `${im.n} em ${ITEMS[it.id].n}`);
  sfx('levelup');
}
function renderForja() {
  const box = $('#forja-list'); if (!box) return;
  const perto = shopNear();
  const slots = Object.keys(P.eq).filter(s => P.eq[s]);
  if (!slots.includes(forjaSlot)) forjaSlot = slots[0];
  const it = P.eq[forjaSlot];
  $('#forja-head').textContent = perto ? 'no templo' : 'volte ao templo para forjar';
  if (!it) { box.innerHTML = '<div class="note">Equipe alguma peça para imbuir.</div>'; return; }
  let h = '<div class="sec">Peça</div><div class="forja-slots">'
    + slots.map(s => `<button class="mini${s === forjaSlot ? ' on' : ''}" data-s="${s}">${SLOT_LABEL[s] || s}</button>`).join('')
    + `</div><div class="note">${itemStats(it).name}${it.imb ? ' · imbuído com <b>' + IMBUEMENTS.find(x => x.id === it.imb).n + '</b>' : ' · sem imbuement'}</div>`;
  h += '<div class="sec">Imbuements</div>' + IMBUEMENTS.map(im => {
    const mats = im.mats.map(([id, q]) => {
      const t = contaMat(id);
      return `<span style="color:${t >= q ? '#7fd08a' : '#e07a6a'}">${ITEMS[id].ico} ${t}/${q}</span>`;
    }).join(' · ');
    // fmtBon é o mesmo formatador do tooltip de item: rótulo em português e a
    // regra de quando o número é porcentagem. Escrever outro aqui daria duas
    // verdades sobre o mesmo bônus na mesma tela
    const bons = Object.entries(im.b).map(([k, v]) => fmtBon(k, v)).join(' · ');
    const pode = perto && temMats(im) && P.gold >= im.ouro && it.imb !== im.id;
    return `<div class="task-card">
      <b>${im.ico} ${im.n}</b><span>${bons}</span>
      <i>${mats} · ${im.ouro} 🪙</i>
      <button class="mini" data-im="${im.id}" ${pode ? '' : 'disabled'}>${it.imb === im.id ? 'já aplicado' : 'Imbuir'}</button>
    </div>`;
  }).join('');
  box.innerHTML = h;
  box.querySelectorAll('button[data-s]').forEach(b => b.onclick = () => { forjaSlot = b.dataset.s; renderForja(); });
  box.querySelectorAll('button[data-im]').forEach(b => b.onclick = () => imbuir(b.dataset.im));
}

/* ---------------------------------------------------------- mapa expandido */
let mapFloor = null;
// x/y: centro da vista em tiles do mundo. zoom: 1 = mapa inteiro no canvas.
// Não reseta ao abrir/trocar de andar — o jogador volta pro mesmo recorte.
const mapView = { x: W / 2, y: H / 2, zoom: 1 };
function openMap(z) {
  mapFloor = z === undefined ? P.z : z;
  $('#map-win').style.display = 'flex';
  drawBigMap();
}
function drawBigMap() {
  const cv = $('#map-canvas'), ctx = cv.getContext('2d'), S = cv.width;
  const k = (S / W) * mapView.zoom;
  const ox = S / 2 - mapView.x * k, oy = S / 2 - mapView.y * k;
  const tx = x => x * k + ox, ty = y => y * k + oy;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S, S);
  ctx.drawImage(miniCanvas[mapFloor], 0, 0, W, H, ox, oy, W * k, H * k);

  // hunts do andar: círculo + nome
  ctx.font = '11px "Segoe UI",sans-serif'; ctx.textAlign = 'center';
  for (const h of WORLD.hunts) {
    if (h.z !== mapFloor) continue;
    const hx = tx(h.x), hy = ty(h.y), hr = h.r * k;
    ctx.beginPath(); ctx.arc(hx, hy, hr, 0, 7);
    ctx.strokeStyle = '#ffb03a'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#00000099'; ctx.fillRect(hx - 62, hy - hr - 15, 124, 13);
    ctx.fillStyle = '#f0cd7a';
    ctx.fillText(`${h.n} (nv ${h.lvl}+)`, hx, hy - hr - 5);
  }
  /* POIs: losango com o ícone. Saqueado fica apagado — o mapa é o caderno do
     jogador, e "já fui ali" é metade da informação que ele procura aqui. */
  for (const p of WORLD.pois) {
    if (p.z !== mapFloor) continue;
    const px = tx(p.x), py = ty(p.y), feito = P.seen && P.seen['poi' + p.uid];
    ctx.globalAlpha = feito ? .35 : 1;
    ctx.beginPath(); ctx.moveTo(px, py - 5); ctx.lineTo(px + 5, py); ctx.lineTo(px, py + 5); ctx.lineTo(px - 5, py);
    ctx.closePath();
    ctx.fillStyle = feito ? '#5a5348' : '#e0b055'; ctx.fill();
    if (mapView.zoom > 2.2) {                     // só de perto: de longe vira sopa
      ctx.fillStyle = '#000000aa'; ctx.fillRect(px - 52, py + 7, 104, 12);
      ctx.fillStyle = feito ? '#8a8378' : '#f0cd7a';
      ctx.fillText(`${p.ico} ${p.n}`, px, py + 16);
    }
    ctx.globalAlpha = 1;
  }
  // escadas
  const t = WORLD.floors[mapFloor].t;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const tt = t[y * W + x];
    if (tt !== T.UP && tt !== T.DOWN) continue;
    ctx.fillStyle = tt === T.UP ? '#ffd166' : '#20242a';
    ctx.fillRect(tx(x) - 2, ty(y) - 2, 5, 5);
  }
  if (mapFloor === SURF) {
    ctx.fillStyle = '#fff0b0';
    ctx.fillRect(tx(WORLD.temple.x) - 4, ty(WORLD.temple.y) - 4, 9, 9);
    ctx.fillText('Templo', tx(WORLD.temple.x), ty(WORLD.temple.y) - 8);
  }
  if (mapFloor === P.z) {                      // você, piscando
    ctx.fillStyle = (G.now % 900 < 550) ? '#ffffff' : '#ff5252';
    ctx.fillRect(tx(P.x) - 3, ty(P.y) - 3, 7, 7);
  }
  $('#map-floor').textContent = FLOOR_NAMES[mapFloor];
  document.querySelectorAll('#map-tabs .tab').forEach(b =>
    b.classList.toggle('on', +b.dataset.z === mapFloor));
}
/* Arrastar move o centro (mapView.x/y), roda dá zoom. Mesmo esquema de
   "moved" do minimapa, mas aqui não tem clique concorrente para suprimir. */
function bindBigMap(cv) {
  let dragging = false, lastX = 0, lastY = 0;
  cv.addEventListener('mousedown', e => {
    dragging = true; lastX = e.clientX; lastY = e.clientY; cv.style.cursor = 'grabbing';
  });
  addEventListener('mousemove', e => {
    if (!dragging) return;
    const k = (cv.width / W) * mapView.zoom;
    mapView.x = clamp(mapView.x - (e.clientX - lastX) / k, 0, W);
    mapView.y = clamp(mapView.y - (e.clientY - lastY) / k, 0, H);
    lastX = e.clientX; lastY = e.clientY;
    drawBigMap();
  });
  addEventListener('mouseup', () => { dragging = false; cv.style.cursor = 'grab'; });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    mapView.zoom = clamp(mapView.zoom * (e.deltaY > 0 ? .85 : 1.18), 1, 14);
    drawBigMap();
  }, { passive: false });
}

/* Clique de interface por delegação, não botão a botão: os painéis abrem e
   fecham em 28 pontos espalhados por game.js, ui.js e hud.js, e ligar som em
   cada um significa lembrar de ligar de novo em todo botão futuro. Aqui um
   listener só cobre o que existe hoje e o que vier depois.
   Fase de captura porque alguns handlers chamam stopPropagation. */
addEventListener('pointerdown', e => {
  const b = e.target.closest('button');
  if (b) sfx(b.id.endsWith('-close') ? 'ui_close' : 'ui_click');
}, true);

/* ------------------------------------------------------------------ botões */
addEventListener('DOMContentLoaded', () => {
  $('#best-btn').onclick = () => {
    const w = $('#best-win');
    w.style.display = w.style.display === 'flex' ? 'none' : 'flex';
    if (w.style.display === 'flex') renderBestiary();
  };
  $('#best-close').onclick = () => $('#best-win').style.display = 'none';
  $('#task-btn').onclick = () => {
    const w = $('#task-win');
    w.style.display = w.style.display === 'flex' ? 'none' : 'flex';
    if (w.style.display === 'flex') renderTasks();
  };
  $('#task-close').onclick = () => $('#task-win').style.display = 'none';
  $('#forja-btn').onclick = () => {
    const w = $('#forja-win');
    w.style.display = w.style.display === 'flex' ? 'none' : 'flex';
    if (w.style.display === 'flex') renderForja();
  };
  $('#forja-close').onclick = () => $('#forja-win').style.display = 'none';
  $('#map-btn').onclick = () => openMap();
  $('#map-close').onclick = () => $('#map-win').style.display = 'none';
  $('#minimap').onclick = () => { if (!miniDragMoved) openMap(); };
  bindBigMap($('#map-canvas'));
  document.querySelectorAll('#map-tabs .tab').forEach(b =>
    b.onclick = () => { mapFloor = +b.dataset.z; drawBigMap(); });
});

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

/* ------------------------------------------------------------------ botões */
addEventListener('DOMContentLoaded', () => {
  $('#best-btn').onclick = () => {
    const w = $('#best-win');
    w.style.display = w.style.display === 'flex' ? 'none' : 'flex';
    if (w.style.display === 'flex') renderBestiary();
  };
  $('#best-close').onclick = () => $('#best-win').style.display = 'none';
  $('#map-btn').onclick = () => openMap();
  $('#map-close').onclick = () => $('#map-win').style.display = 'none';
  $('#minimap').onclick = () => { if (!miniDragMoved) openMap(); };
  bindBigMap($('#map-canvas'));
  document.querySelectorAll('#map-tabs .tab').forEach(b =>
    b.onclick = () => { mapFloor = +b.dataset.z; drawBigMap(); });
});

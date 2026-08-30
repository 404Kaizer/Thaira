/* ui.js — bestiário (com pontos de carisma) e mapa expandido.
   Depende de data.js, world.js e game.js (P, G, log, $). */
'use strict';

/* Token de cor para quem desenha em canvas. O mapa expandido é bitmap, então
   `var(--good)` não chega lá — mas duplicar o hexadecimal no JS criaria duas
   verdades sobre a mesma cor. Isto lê o token do CSS uma vez e guarda: a folha
   de estilo continua sendo a única fonte. */
const TOK = {};
const tok = n => TOK[n] || (TOK[n] = getComputedStyle(document.documentElement).getPropertyValue('--' + n).trim());

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
        <div class="bsbar"><u style="width:${p / a.alvo * 100}%;background:${pronto ? tok('good') : tok('gold2')}"></u></div>
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
            <i style="color:${r > 1 ? tok('good') : tok('bad')}">${r === 0 ? 'imune' : (r > 1 ? 'fraco ×' : 'resiste ×') + r}</i></div>`;
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
        ? `<div class="note" style="color:${tok('good')}">★ Marcada como presa: +${Math.round(CHARM_BONUS * 100)}% de dano.
             <button class="mini" onclick="toggleCharm('${id}')">remover</button></div>`
        : `<button class="btn" style="margin-top:8px" onclick="toggleCharm('${id}')">
             Marcar como presa — ${CHARM_COST} pontos (+${Math.round(CHARM_BONUS * 100)}% de dano)</button>`;
    }
  }
  // ficha igual não é remontada: os <img> do saque piscam ao renascer
  if (box._h !== h) { box._h = h; box.innerHTML = h; }
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
  h += '<div class="sec">Imbuements</div>';
  /* cabeçalho e lista em caixas separadas: a lista é remontada card a card
     (syncRows), senão imbuir refazia os <img> dos materiais e a forja inteira
     piscava — mesmo motivo do itemCell e da loja. */
  if (!box.querySelector('#forja-imbs')) box.innerHTML = '<div id="forja-cab"></div><div id="forja-imbs"></div>';
  const cab = box.querySelector('#forja-cab');
  if (cab._h !== h) {
    cab._h = h; cab.innerHTML = h;
    cab.querySelectorAll('button[data-s]').forEach(b => b.onclick = () => { forjaSlot = b.dataset.s; renderForja(); });
  }
  syncRows(box.querySelector('#forja-imbs'), IMBUEMENTS.map(im => {
    const mats = im.mats.map(([id, q]) => {
      const t = contaMat(id);
      return `<span style="color:${t >= q ? tok('good') : tok('bad')}">${ITEMS[id].ico} ${t}/${q}</span>`;
    }).join(' · ');
    // fmtBon é o mesmo formatador do tooltip de item: rótulo em português e a
    // regra de quando o número é porcentagem. Escrever outro aqui daria duas
    // verdades sobre o mesmo bônus na mesma tela
    const bons = Object.entries(im.b).map(([k, v]) => fmtBon(k, v)).join(' · ');
    const pode = perto && temMats(im) && P.gold >= im.ouro && it.imb !== im.id;
    return {
      html: `<b>${im.ico} ${im.n}</b><span>${bons}</span>
      <i>${mats} · ${im.ouro} 🪙</i>
      <button class="mini" data-im="${im.id}" ${pode ? '' : 'disabled'}>${it.imb === im.id ? 'já aplicado' : 'Imbuir'}</button>`,
      liga: d => d.querySelector('button[data-im]').onclick = () => imbuir(im.id)
    };
  }), 'task-card');
}

/* ------------------------------------------------------------- talentos */
/* Os ramos saem dos DADOS: raiz é nó sem `req`, e cada uma puxa a própria
   corrente por `req`. Escrever as colunas à mão seria a segunda fonte de
   verdade de sempre — bastaria um nó novo no data.js para a árvore desenhada
   discordar da árvore que o jogo cobra. */
/* A árvore é desenhada como GRAFO: traço em SVG por baixo, bolinha em <button>
   por cima. Duas camadas em vez de uma só porque cada uma é boa numa coisa —
   linha que acompanha coordenada é trivial em SVG e horrível em CSS, e botão
   com foco, hover e teclado é trivial em HTML e horrível em SVG.
   O SVG usa viewBox 0..100 nos dois eixos com preserveAspectRatio="none", então
   ele estica junto com o quadro e as pontas caem exatamente onde as bolinhas
   estão — que também são posicionadas em porcentagem. Um único sistema de
   coordenadas para as duas camadas; dois seriam duas verdades sobre onde o nó
   está, e a linha começaria a errar o alvo em telas de proporção diferente. */
/* Câmera da árvore, no mesmo molde da do mapa: arrastar move, roda dá zoom, e
   o recorte não reseta ao fechar — quem estava olhando um canto volta nele.
   x/y são deslocamento em PIXEL do quadro, não em porcentagem: a porcentagem já
   é o sistema em que os nós moram, e misturar os dois faria o deslocamento
   mudar de tamanho junto com o zoom. */
/* O caminho sai do id da vocação em vez de uma tabela: os quatro arquivos já
   seguem o padrão, e uma tabela de quatro linhas que só repete o nome é a
   segunda fonte de verdade de sempre. Arquivo faltando não dá erro — o fundo
   simplesmente não pinta —, então há teste conferindo que os quatro existem. */
const vocFundo = voc => `assets/vocations/${voc}_background.png`;
/* O ENQUADRAMENTO, ao contrário do caminho, é tabela — e tem de ser. As quatro
   artes são retratos de 1024×1536 e a caixa é larga e baixa, então só uma faixa
   aparece; e o assunto de cada uma cai numa altura diferente. Um número só
   serviria a uma e cortaria as outras três: no druida pega os chifres, no
   cavaleiro o elmo, no ranger o arco, no mago as mãos acesas. Reusar um valor
   aqui seria reuso onde o requisito é diferenciar.
   Os quatro saíram de OLHAR no jogo, não de conta — é a régua da casa: arte se
   julga no tamanho e na luz do jogo. */
const VOC_FUNDO_Y = { knight: 20, ranger: 20, sorcerer: 34, druid: 12 };
const vocFundoY = voc => VOC_FUNDO_Y[voc] !== undefined ? VOC_FUNDO_Y[voc] : 30;
const treeView = { x: 0, y: 0, zoom: 1 };
const TREE_ZOOM = [1, 3.5];
/* Quanto se pode deslocar sem perder o grafo de vista: no zoom 1 o quadro
   inteiro cabe e não há o que arrastar, e daí para cima o limite é a metade do
   que sobrou de cada lado. Sem isto dá para arrastar a árvore para fora e ficar
   olhando o vazio, sem botão de voltar. */
const treeLimite = (tamanho, zoom) => Math.max(0, (tamanho * zoom - tamanho) / 2);
function aplicaCam() {
  const m = $('#tree-mapa'); if (!m) return;
  const r = m.getBoundingClientRect(), z = treeView.zoom;
  // mede a caixa SEM o transform: com ele, o limite cresceria a cada quadro
  const lx = treeLimite(r.width / z, z), ly = treeLimite(r.height / z, z);
  treeView.x = clamp(treeView.x, -lx, lx);
  treeView.y = clamp(treeView.y, -ly, ly);
  m.style.transform = `translate(${treeView.x}px,${treeView.y}px) scale(${z})`;
  // o nó andou debaixo do cursor: o balão acompanha em vez de ficar para trás
  tipSegue();
}
/* Ligado UMA vez, na caixa que não é refeita — o `renderTree` reescreve o
   `innerHTML` a cada clique, e handler pendurado lá dentro morreria junto. */
function bindTreeCam(box) {
  let arrastando = false, ax = 0, ay = 0;
  box.addEventListener('mousedown', e => {
    if (e.button || e.target.closest('.tree-no')) return;   // nó tem clique próprio
    arrastando = true; ax = e.clientX; ay = e.clientY;
    box.style.cursor = 'grabbing'; e.preventDefault();
  });
  addEventListener('mousemove', e => {
    if (!arrastando) return;
    if (!e.buttons) { arrastando = false; box.style.cursor = ''; return; }
    treeView.x += e.clientX - ax; treeView.y += e.clientY - ay;
    ax = e.clientX; ay = e.clientY;
    aplicaCam();
  });
  addEventListener('mouseup', () => { arrastando = false; box.style.cursor = ''; });
  box.addEventListener('wheel', e => {
    e.preventDefault();
    treeView.zoom = clamp(treeView.zoom * (e.deltaY > 0 ? .85 : 1.18), TREE_ZOOM[0], TREE_ZOOM[1]);
    // ao voltar ao zoom 1 o limite vira 0 e o clamp recentra sozinho
    aplicaCam();
  }, { passive: false });
}
function renderTree() {
  const box = $('#tree-list'); if (!box) return;
  const livres = pontosLivres(), nos = TREES[P.voc] || [];
  $('#tree-head').textContent = livres > 0
    ? `${livres} ponto${livres > 1 ? 's' : ''} para gastar`
    : `nenhum ponto livre · o próximo no nível ${(pontosTotais() + 1) * PONTO_NIVEL}`;

  /* Traço aceso = os DOIS lados comprados, como no Skyrim. Meio-aceso quando só
     uma ponta está: é ele que mostra por onde dá para continuar, e sem esse
     estado do meio a árvore só tem "feito" e "longe", sem "próximo". */
  const linhas = treeLigacoes(P.voc).map(([a, b]) => {
    const ta = P.tree[a.id] > 0, tb = P.tree[b.id] > 0;
    const cls = ta && tb ? 'on' : (ta || tb) ? 'meio' : '';
    return `<line class="${cls}" x1="${a.pos[0]}" y1="${a.pos[1]}" x2="${b.pos[0]}" y2="${b.pos[1]}"/>`;
  }).join('');

  const bolas = nos.map(no => {
    const g = P.tree[no.id] || 0, max = no.max || 1;
    const erro = podeAlocar(no.id);
    // cheio não é travado: já foi comprado, e apagá-lo esconderia o que se tem
    const travado = !!erro && g < max;
    const estado = g >= max ? 'cheio' : g ? 'tem' : travado ? 'travado' : 'livre';
    return `<button class="tree-no ${estado}" data-no="${no.id}"
      style="left:${no.pos[0]}%;top:${no.pos[1]}%">
      <i class="bola"><b>${g}</b><s>${max}</s></i>
      <em>${no.n}</em>
    </button>`;
  }).join('');

  /* Fundo da vocação: irmão do grafo, NUNCA filho. O zoom é um `transform` no
     `.tree-mapa`, e tudo que estiver dentro dele escala junto — a arte tem de
     ficar parada e preenchendo, então mora fora. O véu é uma terceira camada
     porque `filter: blur` desce para os filhos: um escurecedor dentro do fundo
     sairia borrado junto e não seguraria a leitura do grafo. */
  const fy = vocFundoY(P.voc);
  box.innerHTML = `<div class="tree-fundo" style="background-image:url('${vocFundo(P.voc)}');
    background-position:center ${fy}%;transform-origin:center ${fy}%"></div>
  <div class="tree-veu"></div>
  <div class="tree-mapa" id="tree-mapa">
    <svg class="tree-fios" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${linhas}</svg>
    ${bolas}
  </div>`;
  aplicaCam();

  /* O balão é o `tipEm` que a mochila já usa — mesma moldura, mesmo clamp de
     borda de tela, mesmo `tipCheck` que recolhe balão órfão quando a lista se
     refaz debaixo do mouse. Um segundo tooltip aqui seria a segunda gramática
     de balão do jogo por causa de seis nós. */
  box.querySelectorAll('[data-no]').forEach(b => {
    const no = TREE_NO[b.dataset.no], g = P.tree[no.id] || 0, erro = podeAlocar(no.id);
    b.onclick = () => { if (alocaNo(b.dataset.no)) renderTree(); };
    b.onmouseenter = e => tipEm(e, `<b>${no.n}</b>`
      + `<div class="dim">${g}/${no.max} · ${efeitoDoNo(no)}</div>`
      + `<div style="margin-top:5px">${no.d}</div>`
      + (erro && g < no.max ? `<div class="bad tiny">${erro}</div>`
        : g >= no.max ? '<div class="tiny dim">No máximo.</div>'
          : '<div class="tiny bon">Clique para gastar 1 ponto.</div>'));
    b.onmouseleave = hideTip;
  });

  const gastos = pontosGastos(), perto = shopNear();
  $('#tree-respec-txt').textContent = !gastos ? 'Nada gasto ainda.'
    : perto ? `${gastos} ponto${gastos > 1 ? 's' : ''} gasto${gastos > 1 ? 's' : ''} · ${respecPreco()} de ouro`
      : 'Redistribuir só no templo.';
  $('#tree-respec').disabled = !gastos || !perto || P.gold < respecPreco();
}
/* O que o nó dá, em uma linha e por degrau. Sai do próprio `ef`, então nó novo
   se descreve sozinho — texto escrito à mão no `d` envelheceria no dia em que
   alguém mexesse no número e esquecesse da frase. */
const EF_TEXTO = {
  mana: v => `−${Math.round(v * 100)}% de mana por degrau`,
  alcance: v => `+${v} de alcance por degrau`,
  raio: v => `+${v} anel de área`,
  dur: v => `+${Math.round(v * 100)}% de duração por degrau`,
  certeza: () => 'estado sempre aplica',
  limpa: () => 'cura limpa estados',
  varinha: () => 'varinha sem custo'
};
const efeitoDoNo = no => Object.keys(no.ef).map(k => EF_TEXTO[k](no.ef[k])).join(' · ');

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
/* Pixel de CSS e pixel de BUFFER não se misturam — é a armadilha que já custou
   um "ver tudo" mostrando 46% do mapa no editor, na tela do dono, que tem
   devicePixelRatio 2. Enquanto o canvas era 620×620 fixo os dois coincidiam e o
   erro não existia; com o mapa elástico, coincidem só em tela sem HiDPI.
   Uma função só devolve os dois mundos e o fator entre eles, e desenho e
   arrasto bebem daqui — duas contas seriam duas chances de divergir. */
/* A conta fica separada do DOM de propósito: é ela que tem a armadilha, e
   armadilha que não se consegue exercer por teste é armadilha que volta. */
function escalaMapa(larguraCSS, alturaCSS, dpr, zoom) {
  const w = Math.max(1, Math.round(larguraCSS * dpr)), h = Math.max(1, Math.round(alturaCSS * dpr));
  // o mapa é quadrado (W === H): a menor dimensão é quem decide o "cabe inteiro"
  return { w, h, dpr, k: (Math.min(w, h) / W) * zoom };
}
// quantos TILES um arrasto de `cssPx` percorre. Sobe pelo dpr porque `k` mede
// pixel de buffer e o mouse anda em pixel de CSS
const arrastoEmTiles = (cssPx, dpr, k) => cssPx * dpr / k;
function mapaEscala(cv) {
  const r = cv.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);          // teto: 4× a área já é gasto puro
  const e = escalaMapa(r.width, r.height, dpr, mapView.zoom);
  if (cv.width !== e.w || cv.height !== e.h) { cv.width = e.w; cv.height = e.h; }
  return e;
}
function drawBigMap() {
  const cv = $('#map-canvas'), ctx = cv.getContext('2d');
  const { w: CW, h: CH, k } = mapaEscala(cv);
  const ox = CW / 2 - mapView.x * k, oy = CH / 2 - mapView.y * k;
  const tx = x => x * k + ox, ty = y => y * k + oy;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = corFora(mapFloor); ctx.fillRect(0, 0, CW, CH);
  ctx.drawImage(miniCanvas[mapFloor], 0, 0, W, H, ox, oy, W * k, H * k);

  // hunts do andar: círculo + nome
  ctx.font = '11px "Segoe UI",sans-serif'; ctx.textAlign = 'center';
  for (const h of WORLD.hunts) {
    if (h.z !== mapFloor) continue;
    const hx = tx(h.x), hy = ty(h.y), hr = h.r * k;
    ctx.beginPath(); ctx.arc(hx, hy, hr, 0, 7);
    ctx.strokeStyle = tok('hunt'); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = tok('scrim'); ctx.fillRect(hx - 62, hy - hr - 15, 124, 13);
    ctx.fillStyle = tok('gold2');
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
    ctx.fillStyle = feito ? tok('mute') : tok('wait'); ctx.fill();
    if (mapView.zoom > 2.2) {                     // só de perto: de longe vira sopa
      ctx.fillStyle = tok('scrim2'); ctx.fillRect(px - 52, py + 7, 104, 12);
      ctx.fillStyle = feito ? tok('dim') : tok('gold2');
      ctx.fillText(`${p.ico} ${p.n}`, px, py + 16);
    }
    ctx.globalAlpha = 1;
  }
  // escadas
  const t = WORLD.floors[mapFloor].t;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const tt = t[y * W + x];
    if (tt !== T.UP && tt !== T.DOWN) continue;
    ctx.fillStyle = tt === T.UP ? tok('stair-up') : tok('stair-down');
    ctx.fillRect(tx(x) - 2, ty(y) - 2, 5, 5);
  }
  if (mapFloor === SURF) {
    ctx.fillStyle = tok('temple');
    ctx.fillRect(tx(WORLD.temple.x) - 4, ty(WORLD.temple.y) - 4, 9, 9);
    ctx.fillText('Templo', tx(WORLD.temple.x), ty(WORLD.temple.y) - 8);
  }
  if (mapFloor === P.z) {                      // você, piscando
    ctx.fillStyle = (G.now % 900 < 550) ? tok('player') : tok('alert');
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
    /* O mouse anda em pixel de CSS e o `k` mede pixel de BUFFER, então o delta
       sobe pelo dpr antes de virar tile. Sem o fator, arrastar move METADE do
       esperado numa tela HiDPI — e só nela, que é o pior tipo de defeito. */
    const { dpr, k } = mapaEscala(cv);
    mapView.x = clamp(mapView.x - arrastoEmTiles(e.clientX - lastX, dpr, k), 0, W);
    mapView.y = clamp(mapView.y - arrastoEmTiles(e.clientY - lastY, dpr, k), 0, H);
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
  $('#spell-close').onclick = () => $('#spell-win').style.display = 'none';
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
  $('#tree-btn').onclick = () => {
    const w = $('#tree-win');
    w.style.display = w.style.display === 'flex' ? 'none' : 'flex';
    if (w.style.display === 'flex') renderTree();
  };
  $('#tree-close').onclick = () => $('#tree-win').style.display = 'none';
  bindTreeCam($('#tree-list'));
  $('#tree-respec').onclick = () => { respec(); renderTree(); };
  $('#map-btn').onclick = () => openMap();
  $('#map-close').onclick = () => $('#map-win').style.display = 'none';
  $('#minimap').onclick = () => { if (!miniDragMoved) openMap(); };
  bindBigMap($('#map-canvas'));
  document.querySelectorAll('#map-tabs .tab').forEach(b =>
    b.onclick = () => { mapFloor = +b.dataset.z; drawBigMap(); });
});

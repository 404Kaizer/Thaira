/* arraste.js — arrastar e soltar item entre mochila, equipamento, hotbar e corpo.

   MOUSE CRU, não o drag-and-drop do HTML5, pelo mesmo motivo do arraste de
   painel em hud.js: o fantasma nativo é um bitmap desbotado que não se estiliza,
   e não atravessa o canvas. O `-webkit-user-drag:none` no index.html existe para
   o nativo não competir com este.

   ZONA DECLARA, ARRASTE PERGUNTA. Quatro origens e quatro destinos dariam
   dezesseis casos escritos à mão, e cada zona nova multiplicaria de novo. Aqui
   cada zona responde duas coisas — `aceita(carga)` e `recebe(carga, alvo)` — e o
   arraste só acha a zona sob o cursor e pergunta. Somar o chão depois é escrever
   uma entrada em ZONAS, não mexer aqui.

   ONDE O ITEM ESTÁ não é gravado no nó: é perguntado ao estado na hora de soltar
   (`ondeEsta`). A mesma célula é reaproveitada entre mochila, corpo e
   equipamento (ver CELULA em game.js), então um atributo no DOM ficaria velho
   exatamente nos casos que importam. */
'use strict';

const ARR_LIMIAR = 4;      // px antes do gesto deixar de poder ser um clique
let arrIt = null;          // arraste em curso
let arrSuprime = false;    // o mouseup virou clique? o clique de item não pode disparar

/* ------------------------------------------------------------------ estado */
function ondeEsta(it) {
  if (P.bag.includes(it)) return { z: 'bag' };
  for (const slot in P.eq) if (P.eq[slot] === it) return { z: 'eq', slot };
  if (G.lootOpen && G.lootOpen.items.includes(it)) return { z: 'corpo' };
  return null;
}
/* Tira o item de onde ele estiver, sem devolver nada a lugar nenhum. Quem chama
   é responsável por colocá-lo em outro lugar — por isso é privado ao módulo. */
function arrTira(it, de) {
  if (de.z === 'bag') P.bag.splice(P.bag.indexOf(it), 1);
  else if (de.z === 'eq') { P.eq[de.slot] = null; recalc(); renderBars(); }
  else if (de.z === 'corpo') G.lootOpen.items.splice(G.lootOpen.items.indexOf(it), 1);
}
const arrCabe = () => P.bag.length < BAG_SLOTS;

/* -------------------------------------------------------------------- zonas */
const ZONAS = {
  bag: {
    aceita: c => c.tipo === 'item' && ondeEsta(c.it),
    recebe(c, alvo) {
      const de = ondeEsta(c.it);
      if (de.z === 'bag') {
        /* Dentro da própria mochila: soltar em cima de outro item TROCA os dois,
           soltar no vazio manda para o fim. Troca e não inserção porque grade de
           slot promete troca — e porque inserir obriga a corrigir o índice do
           alvo depois de tirar a peça, que é onde nasce o erro de um slot. */
        const i = P.bag.indexOf(c.it);
        if (alvo.it && alvo.it !== c.it) {
          const j = P.bag.indexOf(alvo.it);
          P.bag[i] = alvo.it; P.bag[j] = c.it;
        } else if (!alvo.it) {
          P.bag.splice(i, 1); P.bag.push(c.it);
        }
        return renderInv(), true;
      }
      if (COIN_V[c.it.id] || arrCabe()) { arrTira(c.it, de); return bagAdd(c.it); }
      return log('Sua mochila está cheia.', 'bad'), false;
    }
  },
  eq: {
    aceita: c => c.tipo === 'item' && itemStats(c.it).slot,
    recebe(c, alvo) {
      const s = itemStats(c.it);
      if (s.slot !== alvo.slot) return log(`${s.name} não vai nesse lugar.`, 'bad'), sfx('error'), false;
      if (!canEquip(s)) return sfx('error'), false;
      const de = ondeEsta(c.it), antigo = P.eq[alvo.slot];
      // trocar peça com a mochila cheia deixaria a antiga sem destino
      if (antigo && de.z !== 'bag' && !arrCabe()) return log('Sua mochila está cheia.', 'bad'), false;
      arrTira(c.it, de);
      P.eq[alvo.slot] = c.it;
      if (antigo) P.bag.push(antigo);
      recalc(); renderInv(); renderBars();
      log(`Equipou ${s.name}.`); sfx('equip');
      return true;
    }
  },
  hot: {
    /* Só entra na barra o que a barra sabe disparar: poção, runa e comida. Arma
       e armadura não têm uso por tecla, e um slot que não faz nada é pior que
       slot vazio. */
    aceita: c => c.tipo === 'hot' || (c.tipo === 'item' && (ITEMS[c.it.id].use || ITEMS[c.it.id].rune)),
    recebe(c, alvo) {
      if (c.tipo === 'hot') {
        if (c.i === alvo.i) return false;
        const t = P.hotbar[alvo.i];
        P.hotbar[alvo.i] = P.hotbar[c.i]; P.hotbar[c.i] = t;   // troca, não sobrescreve
      } else {
        P.hotbar[alvo.i] = { k: 'item', id: c.it.id };         // o item FICA onde está
        log(`${ITEMS[c.it.id].n} na tecla ${hotKeyLabel(P.hotkeys[alvo.i])}.`);
      }
      renderHotbar(); sfx('ui_click');
      return true;
    }
  },
  corpo: {
    aceita: c => c.tipo === 'item' && G.lootOpen && ondeEsta(c.it) && ondeEsta(c.it).z !== 'corpo',
    recebe(c) {
      const de = ondeEsta(c.it);
      arrTira(c.it, de);
      G.lootOpen.items.push(c.it);
      renderInv(); renderLoot(); sfx('bag');
      log(`Guardou ${itemStats(c.it).name} em ${G.lootOpen.name || 'um corpo'}.`);
      return true;
    }
  }
};

/* Que zona está sob o ponto, e com que alvo dentro dela. Um só lugar traduz DOM
   para zona — é o que mantém ZONAS sem saber de seletor nenhum. */
function arrZona(x, y) {
  const el = document.elementFromPoint(x, y); if (!el) return null;
  const hk = el.closest('.hk');
  if (hk) return { z: 'hot', alvo: { i: [...hk.parentNode.children].indexOf(hk) } };
  const cel = el.closest('.cell');
  if (cel && cel.closest('#eq-slots')) {
    // o slot vem da posição, que é o que renderInv já usa para desenhar
    const slot = Object.keys(SLOT_POS).find(s =>
      SLOT_POS[s][0] + 'px' === cel.style.left && SLOT_POS[s][1] + 'px' === cel.style.top);
    return slot ? { z: 'eq', alvo: { slot } } : null;
  }
  if (el.closest('#bag')) return { z: 'bag', alvo: { it: cel && arrItemDaCelula(cel) } };
  if (el.closest('#loot-items')) return { z: 'corpo', alvo: {} };
  return null;
}
/* A célula não guarda o item; o item guarda a célula (CELULA, em game.js). Ler
   de volta é varrer as listas — são dezenas de itens, não milhares. */
function arrItemDaCelula(cel) {
  const listas = [P.bag, Object.values(P.eq), G.lootOpen ? G.lootOpen.items : []];
  for (const l of listas) for (const it of l) if (it && CELULA.get(it) === cel) return it;
  return null;
}

/* ----------------------------------------------------------------- fantasma */
function arrFantasma(html) {
  const d = document.createElement('div');
  d.className = 'arr-ghost'; d.innerHTML = html;
  document.body.appendChild(d);
  return d;
}
function arrLimpa() {
  if (arrIt && arrIt.ghost) arrIt.ghost.remove();
  document.querySelectorAll('.arr-ok').forEach(e => e.classList.remove('arr-ok'));
  arrIt = null;
}

/* ------------------------------------------------------------------- gestos */
addEventListener('mousedown', e => {
  if (e.button !== 0 || !P) return;   // `P` é let de script clássico: não vive em window
  const hk = e.target.closest('.hk');
  const cel = e.target.closest('.cell');
  let carga = null;
  if (hk && !hk.classList.contains('vazio') && !e.target.closest('.hk b')) {
    carga = { tipo: 'hot', i: [...hk.parentNode.children].indexOf(hk), ico: hk.querySelector('span').innerHTML };
  } else if (cel && !cel.classList.contains('empty')) {
    const it = arrItemDaCelula(cel); if (!it) return;
    carga = { tipo: 'item', it, ico: itemStats(it).ico };
  }
  if (!carga) return;
  arrIt = { carga, x: e.clientX, y: e.clientY, moveu: false };
}, true);

addEventListener('mousemove', e => {
  if (!arrIt) return;
  // soltou o botão fora da janela: sem isto o fantasma fica preso no cursor
  if (!e.buttons) return dispatchEvent(new MouseEvent('mouseup'));
  if (!arrIt.moveu) {
    if (Math.abs(e.clientX - arrIt.x) + Math.abs(e.clientY - arrIt.y) < ARR_LIMIAR) return;
    arrIt.moveu = true;
    arrIt.ghost = arrFantasma(arrIt.carga.ico);
    document.body.classList.add('arrastando-item');
    hideTip();
  }
  arrIt.ghost.style.left = e.clientX + 'px';
  arrIt.ghost.style.top = e.clientY + 'px';
  // realce só onde o item cabe de verdade: pergunta à zona antes de acender
  document.querySelectorAll('.arr-ok').forEach(el => el.classList.remove('arr-ok'));
  const z = arrZona(e.clientX, e.clientY);
  if (z && ZONAS[z.z].aceita(arrIt.carga)) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const marca = el.closest('.hk') || el.closest('#eq-slots .cell') || el.closest('#bag') || el.closest('#loot-items');
    if (marca) marca.classList.add('arr-ok');
  }
});

addEventListener('mouseup', e => {
  if (!arrIt) return;
  const { carga, moveu } = arrIt;
  const x = e.clientX, y = e.clientY;
  arrLimpa();
  document.body.classList.remove('arrastando-item');
  if (!moveu) return;                       // foi clique: deixa o onclick de sempre agir
  arrSuprime = true;                        // foi arraste: o clique que vem atrás não vale
  const z = arrZona(x, y);
  if (z && ZONAS[z.z].aceita(carga)) ZONAS[z.z].recebe(carga, z.alvo);
});

/* O clique nasce do mesmo mouseup que terminou o arraste. Sem este freio,
   arrastar uma poção para a hotbar também a BEBIA no caminho. */
addEventListener('click', e => {
  if (!arrSuprime) return;
  arrSuprime = false;
  e.stopPropagation(); e.preventDefault();
}, true);

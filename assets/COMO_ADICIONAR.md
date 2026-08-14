# Como adicionar coisas em Thaira

Modelos para copiar, colar e trocar os valores. Nada aqui exige reescrever
lógica: item, criatura, hunt e conjunto são **tabelas** em `src/data.js`.

---

## 1. Arte nova (item, troféu, equipamento)

1. Salve o PNG em `assets/skins/<pasta>/`, com fundo transparente.
   **O nome do arquivo é o id do item.** `wooden_shield.png` → item `wooden_shield`.
2. Rode:

```bash
python assets/build_skins.py --aplicar
```

3. Pronto. O script recorta, encolhe no tamanho certo, gera o `@2x` para tela
   densa e refaz `src/icones.js`. O jogo passa a achar a arte **pelo id** — não
   existe lista para atualizar em lugar nenhum.

Rodar sem `--aplicar` só mostra o que mudaria, sem gravar.

### Conjunto de equipamento

Ponha as peças numa pasta terminada em `_set`. A sigla sai das iniciais:
`frost_titan_set/frost_titan_armor.png` → `ft_armor`.

Se o desenhista usou outro vocabulário, crie um `_conjunto.json` na pasta:

```json
{
  "id": "ft",
  "apelidos": { "ohsword": "sword", "graves": "boots" },
  "ignorar": ["frost_titan_set"]
}
```

| chave | para quê |
|---|---|
| `id` | sigla do conjunto (padrão: iniciais da pasta) |
| `lado` | tamanho do ícone em px (padrão 54 = o vão do slot) |
| `apelidos` | renomeia peças (`graves` → `boots`) |
| `ignorar` | peças que não viram ícone (folha de referência do conjunto) |
| `pular` | `true` = a pasta inteira não é ícone (quadros de animação) |

> **Não aumente `lado` achando que melhora.** O navegador encolhe imagem com
> filtro barato: mandar 128px para um slot de 54 borra *mais* do que mandar 54.
> Medido na armadura — 128px: 5.642 de nitidez na tela; 54px em 1:1: 28.146.

---

## 2. Item novo

Em `src/data.js`, na seção de itens. Só o que o item tem é que entra.

```js
// arma — atk entra na fórmula de dano junto com a perícia da categoria (wt)
item({ id: 'frost_blade', n: 'Lâmina Gélida', ico: '⚔️', slot: 'weapon', wt: 'sword',
       atk: 24, def: 14, lvl: 15, price: 2200 });

// peça de defesa — arm desconta dano recebido
item({ id: 'frost_armor', n: 'Peitoral Gélido', ico: '🛡️', slot: 'armor',
       arm: 9, lvl: 15, price: 2600 });

// acessório com bônus: qualquer chave de BONUS_LABEL serve
item({ id: 'frost_ring', n: 'Anel Gélido', ico: '💍', slot: 'ring',
       lvl: 15, price: 3000, b: { maxhp: 30, hpReg: 2 } });

// consumível
item({ id: 'frost_potion', n: 'Poção Gélida', ico: '🧪', use: { hp: 120 },
       stack: true, price: 80 });

// troféu de venda — sem slot e sem use: o tooltip já explica que é pra vender
item({ id: 'frost_shard', n: 'Lasca de Gelo', ico: '💎', stack: true, sell: 40 });
```

`slot`: `helmet · amulet · armor · legs · boots · weapon · shield · ring`
`wt` (categoria da arma, define qual perícia treina): `sword · axe · club · distance · wand`

Para vender na loja do templo, acrescente o id em `SHOP_STOCK`.

---

## 3. Criatura nova

Em `src/data.js`, na tabela `MOBS`:

```js
frost_wolf: {
  n: 'Lobo Gélido', hp: 120, exp: 60, atk: [10, 28], arm: 8,
  spd: 320,        // 190-215 peso morto · 235-270 humanoide · 285-345 caçador
  sz: .8,          // tamanho do corpo, mexe no empurrão e no desenho
  col: 0x9fd8ff,   // cor base de quem não tem modelo próprio
  tier: 2,         // faixa de dificuldade, usada no sorteio de raridade do loot
  medo: .3,        // foge abaixo de 30% de vida; sem a chave, luta até morrer
  loot: [['gold', .9, 10, 60], ['wolf_paw', .3], ['frost_shard', .08]]
}
```

`loot` é `[id, chance, min, max]` — cada linha rola sozinha, então a criatura
pode largar nada, um item ou a lista toda.

Opcionais:

```js
  // tiro. `recua: true` é o que faz virar ARQUEIRO (mantém distância).
  // Sem isso ela atira enquanto avança, como o dragão.
  ranged: { range: 5, min: 8, max: 20, col: 0x9fd8ff, recua: true },

  // uma habilidade por criatura; cd em ms, grito aparece sobre a cabeça
  hab: { tipo: 'area',  r: 2, dano: [10, 25], cd: 12000, col: 0x9fd8ff, grito: 'AUUU' },
  hab: { tipo: 'lento', r: 3, lento: .3, dur: 5000, cd: 13000 },
  hab: { tipo: 'cura',  val: 40, cd: 15000 },
```

Para ela nascer no mundo, inclua o id numa `SPAWN_POOLS` (por andar e distância
do templo) ou nos `mobs` de uma hunt.

---

## 4. Hunt nova

Em `src/data.js`, na lista `HUNTS`. O lugar é sorteado na geração do mapa: o
script procura terreno aberto no andar certo, longe do templo e das outras.

```js
{ id: 'frost_peak', n: 'Pico Gélido', z: 0, r: 8, lvl: 45,
  boss: 'frost_titan', mobs: ['frost_wolf', 'frost_dragon'],
  best: 'lascas de gelo e equipamento gélido' }
```

`z`: `0` montanha · `1` superfície · `2` caverna · `3` abismo
`r`: raio em tiles · `lvl`: nível sugerido, aparece no aviso ao entrar
`boss`: id da criatura que nasce no centro (respawn lento)

---

## 5. Conjunto com bônus por peça

Em `SETS`, e cada peça declarada com o helper do conjunto:

```js
SETS.ft = {
  n: 'Titã Gélido', max: 6,
  tiers: [ [2, { arm: 3 }], [4, { maxhp: 60, ice: .1 }], [6, { speed: 25, crit: .06 }] ]
};
```

---

## Conferindo

```bash
python assets/build_skins.py        # o que mudaria na arte, sem gravar
node tests/test.js                  # regras do jogo
```

O jogo é HTML puro: abra `index.html` (ou `JOGAR.bat`) e recarregue. Se um ícone
não aparecer, quase sempre é o nome do arquivo diferente do id do item — o
script imprime os ids que gerou.

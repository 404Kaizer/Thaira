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

## 6. Folha de animação (personagem e criatura)

O mesmo moinho serve para os dois. Muda a pasta de entrada e a linha de tombado:

| | pasta | vira |
|---|---|---|
| skin de vocação | `assets/skins/voc_<vocação>/<skin>/` | `assets/creatures/<skin>.png` + entrada em `VOC_SKINS` |
| criatura | `assets/skins/creatures/<nome>/` | `assets/creatures/<nome>.png` + `sheet: '<nome>'` na `MOBS` |

```bash
python assets/build_criaturas.py --aplicar
```

### O contrato: o que o motor consome

Um arquivo por quadro, fundo **transparente**, nome
`<nome>_<ação>_<lado>_<nn>.png`. Ação é `idle` ou `walk`, lado é
`front`/`left`/`back`/`right`. Tombado é `<nome>_dead_<nn>.png`, sem lado.

**Você só desenha TRÊS direções.** `right` sai espelhado de `left` sozinho (ou o
contrário). Desenhar as quatro é pagar 33% a mais por nada.

O script recorta no alfa, encolhe tudo pela **mesma** escala, planta os pés numa
linha comum e centra o corpo pela mediana das poses paradas. Ou seja: **você não
precisa acertar registro nem enquadramento** — o que ele não conserta é
proporção que muda de quadro para quadro.

### As duas folhas de referência

Ciclope e demônio estão completos e são a régua. **A contagem de quadros é
irregular de propósito** — cada linha tem a sua, e o `src/criaturas.js` guarda
isso. Não force grade uniforme:

| | frente | oeste | costas | leste | tombado |
|---|---|---|---|---|---|
| **ciclope** | 2 parado + 3 passo | 1 + 2 | 1 + 4 | *espelhado do oeste* | 4 poses |
| **demônio** | 1 + 2 | 2 + 3 | 1 + 2 | 2 + 3 (desenhado) | 3, apodrecendo |

O que eles têm em comum, e é isto que faz os dois funcionarem:

- **altura do desenho constante dentro da linha** — medido: 94% a 100% entre o
  quadro mais baixo e o mais alto. É a régua a bater
- pés na mesma linha, corpo centrado, luz sempre da mesma direção
- tombado é livre: as quatro poses do ciclope variam 77% em altura, porque estão
  deitadas em ângulos diferentes. Deitado não tem pé para plantar

**Apêndice grande muda a silhueta entre as vistas.** A asa do demônio abre de
frente e dobra no perfil, então a silhueta de frente é muito mais larga que a de
perfil — e a escala única encolheria o corpo numa vista e não na outra. Por isso
ele tem `{ "escala": "lado" }` no `_conjunto.json`: cada lado se ajeita sozinho.
Bicho com asa, capa, cauda ou porrete comprido provavelmente precisa disso; o
ciclope, que é só corpo, não precisou.

### O ritmo — é isto que "sincronia" quer dizer aqui

**Andar.** O ciclo inteiro toca **uma vez por tile andado**, espremido na duração
do passo. Não é relógio: é o progresso do passo, então o boneco anda na
velocidade em que se move de verdade.

- passo do jogador: `100000 / velocidade` ms — **~450 ms** no nível 1, ~350 ms
  bem equipado, e **×1,5 na diagonal**
- criatura: ~530 ms (peso morto) a ~290 ms (caçador)
- com 3 quadros de `walk`, cada um dura ~150 ms; com 4, ~110 ms

Consequência de desenho: **o ciclo tem de fechar em si mesmo dentro de um tile**,
porque ele recomeça do primeiro quadro a cada tile. Três quadros
(contato-esquerdo → passagem → contato-direito) é o que basta e é o que o Tibia
faz. Não desenhe uma passada de dois passos completos: ela vai tocar inteira em
meio segundo e o boneco corre no lugar.

**Parado.** Quadros de `idle` são **POSES, não respiração**. O motor fica na pose
1 por **5,2 s**, passa pelas outras a **700 ms** cada e volta para a 1. Meio
respiro cada vira tique; o ciclope levantar o porrete, não.

**Tombado.** Ou são poses do mesmo corpo (sorteia uma na morte) ou é o bicho
apodrecendo — aí `{ "tombado": "apodrece" }` no `_conjunto.json` da pasta e o
motor passa pelos quadros ao longo da vida do corpo.

**Não existe ataque.** O motor só conhece `idle`, `walk` e `dead`. Pose de golpe
não tem onde entrar hoje — não gaste geração nisso ainda.

### O estilo, medido nas folhas que já estão no jogo

- proporção atarracada e heroica: cabeça grande, corpo curto, **~2,5 cabeças** de
  altura — não 8 cabeças realista
- **contorno escuro contínuo** em toda a silhueta, quase preto
- sombreado em **poucas bandas chapadas**, sem gradiente suave
- luz **de cima e um pouco da frente**: topo da cabeça e dos ombros claros,
  sob o queixo e sob os braços escuro — a mesma direção em todos os quadros
- paleta terrosa e dessaturada: aço cinza-azulado, couro marrom, pano oliva,
  pele bronzeada. Sem neon, sem brilho, sem luz de contorno
- **sem sombra no chão.** Quem prega o boneco no chão é o `dropShadow` do motor;
  elipse pintada dentro do desenho escurece junto com ele à noite e o objeto
  vira papel no chão

E a régua final: em jogo o boneco tem **~46 px de altura**. A arte nasce em 384×256
e é reduzida ~5×. **Se não ler como silhueta, não vai ler.** Detalhe de fivela
morre; o que sobrevive é forma, contorno e as duas ou três cores grandes.

### O que o gerador obedece e o que ele ignora

A primeira versão desta receita era um prompt de prosa pedindo folha 4×4. Saiu
uma folha, e ela foi auditada cláusula por cláusula. **Cinco de onze instruções
foram ignoradas**, e não ao acaso:

| pedido | saiu | |
|---|---|---|
| células de 384×256 | exato | ✅ |
| mesma altura em todas | 94% entre a menor e a maior | ✅ |
| forma única, nada solto | nenhuma mancha solta | ✅ |
| nada cortado pela borda | nenhuma encostou | ✅ |
| mesmas cores em toda parte | distância 1 a 5 (de 255) | ✅ |
| pés na mesma linha | 3 px em duas linhas, 8 px na outra | 🟡 |
| fundo **#FF00FF chapado** | (247,5,232), verde variando de 0 a 188 | ❌ |
| **sem** sombra no chão | 20.000 px de sombra pintada | ❌ |
| 16 poses, **todas diferentes** | 7 poses distintas em 16 células | ❌ |
| tombado **não mais longo** que a altura em pé | 244 px contra 205 | ❌ |
| *(esqueci de proibir)* linha de grade | 10.783 px de divisória branca desenhada | ❌ |

O padrão é limpo. **Obedeceu tudo que é geometria visível dentro de uma imagem.
Ignorou três coisas, sempre as mesmas:**

1. **Negação.** "NO cast shadow" produz sombra. Gerador de imagem não tem "não".
   Não negue: **reenquadre**. Chamar o fundo de *chroma key para extração de
   sprite* faz ele tratar aquilo como recurso técnico, não como chão de uma cena
   — e cena é o que traz sombra junto.
2. **Valor numérico exato.** `#FF00FF` virou `(247,5,232)`. Não dependa disso: o
   `build_folhas.py` lê o fundo **das quinas** e tolera distância 60, então
   qualquer cor razoavelmente chapada serve. O que importa é ela não existir no
   personagem.
3. **Comparação entre células.** "todas diferentes", "não mais longo que" — ele
   desenha uma célula de cada vez e não confere contra as outras. Peça **poucas**
   poses e descreva **cada uma em absoluto**, por geometria.

E a palavra mais cara do prompt antigo foi **"grid"**: ela desenhou as divisórias
brancas *e* criou uma cota de 16 células — e cota se cumpre com cópia. Não peça
grade. Peça uma fileira de três.

### Duas referências, e trocá-las é o erro

Anexar imagem resolve estilo e **também carrega identidade** — o gerador não
separa as duas por conta própria, e pedir que separe é uma negação, que ele
ignora. Então a escolha da imagem é que decide:

| o que você quer | anexe | porque |
|---|---|---|
| **a mesma pessoa** em outra pose, outro lado, outro degrau | os quadros da própria skin (`_ref_<skin>.png`) | aí copiar a identidade é o objetivo |
| **uma pessoa nova** no mesmo mundo | **`assets/skins/_ref_estilo.png`** | são cinco corpos diferentes; a única coisa que eles têm em comum é o traço |

`_ref_estilo.png` traz ciclope, demônio, knight comum, sorcerer e knight veterano
lado a lado, mesma altura, em magenta chapado. Um olho só, asa, robe, placa,
moicano: **não há "o personagem" para copiar**. O que sobra de comum é espessura
de contorno, bandas de sombra, direção da luz, proporção e temperatura de paleta
— que é exatamente o que se quer levar.

Refaça a tira quando entrar arte nova, para o estilo de referência ser o estilo
atual do jogo:

```bash
python assets/build_ref_estilo.py
```

### Do zero, quando o personagem ainda não existe

Para bicho novo — `diabrete` e `minotaur` são pastas vazias — **não gere a folha
direto**. São duas perguntas diferentes brigando pela mesma imagem:

> *quem é este personagem* · *em que pose ele está*

Resolva a primeira sozinha, congele, e só então peça pose. É o mesmo princípio do
mundo autoral: **decidido e congelado** antes de multiplicar.

**Etapa 1 — fabricar a referência de identidade.** UMA imagem, UMA pose, sem
animação, sem fileira. Você está julgando só quem é e se está no estilo, então
errar é barato: regere à vontade até aprovar. Anexe `_ref_estilo.png`.

O personagem vem **primeiro** no prompt, e a referência depois, reduzida ao que
ela deve entregar. Descreva-o inteiro — espécie, porte, idade, cabelo, cabeça,
roupa, cor dominante, arma —, porque **todo campo que você deixar em branco o
gerador preenche com o que viu na referência**:

```
Draw ONE single new character, standing still, facing the viewer, full body,
arms at the sides, feet together.

THE CHARACTER:
BUILD — <porte e silhueta dos ombros>
AGE & FACE — <idade, rosto, barba>
HAIR — <cabelo>
HEAD — <o que há na cabeça, ou "bare, no hood and no helmet">
SHOULDERS — <o que muda a silhueta dos ombros, ou "narrow and bare">
CLOTHING — <peças e material>
PALETTE — <duas ou três cores, e só>
HANDS — <o que há em cada mão, ou "empty">
ONLY HE HAS — <o traço que ninguém mais tem>

The attached image is a TECHNIQUE SAMPLE. It shows five different creatures and
people who have nothing in common except how they are drawn. Copy from it only
these five things: the weight of the dark outline, the way shading is laid in a
few flat bands, the light coming from above and slightly in front, the chunky
proportions of about 2.5 heads tall, and the earthy desaturated palette
temperature. Every other trait of the character comes from the description
above, which overrides the sample.

The backdrop is a flat uniform CHROMA KEY colour for sprite extraction, bright
<magenta|green>, the same colour edge to edge, no gradient, no texture, no
ground plane, no floor, no horizon, no scenery. The character floats on the key
colour. Nothing else is drawn on it: no lines, no boxes, no borders, no
numbering, no captions.

It will be shrunk to 46 pixels tall in the game, so it must read as a
SILHOUETTE: few large shapes, a distinctive outline, strong contrast between the
character and its own parts. Detail that survives, not detail that fills.
```

**Se ainda vier parecido**, o campo que vazou é o que você não escreveu. Os que
mais escapam, em ordem: **cabeça** (o gerador repete o capuz ou o cabelo da
referência), **arma**, **silhueta dos ombros** e **paleta**. Escreva os quatro
explicitamente, mesmo quando parecerem óbvios — "bald with no headwear at all",
"empty hands", "narrow sloped shoulders", "cold grey-blue and bone white".

**Etapa 2 — a imagem aprovada vira a referência de identidade.** Daí em diante é
a receita de sempre, e o personagem para de derivar porque ninguém mais está
inventando quem ele é.

**A cor da chave sai do personagem, não do hábito.** A chave tem de ser uma cor
que **não existe** no bicho, senão o recorte abre buraco no meio dele. Demônio
vermelho e ranger de capuz verde são os dois casos que se escolhem errado
sozinhos: bicho verde vai em magenta, bicho vermelho ou roxo vai em verde. É por
isto que existe uma pasta `green_background/` e folhas em magenta.

### Como enviar ao ChatGPT

1. **Uma conversa nova por skin ou por bicho.** Conversa velha carrega o
   personagem anterior e ele vaza no novo.
2. **Primeira mensagem: a imagem anexada + o bloco de prompt inteiro**, de uma
   vez. Prompt em mensagem separada da imagem faz ele responder sobre a imagem
   em vez de desenhar.
3. **As outras direções vão na MESMA conversa**, uma mensagem por direção, sempre
   reanexando a referência. É o que mantém a armadura igual entre as vistas.
4. **Baixe o PNG**, nunca print de tela: print traz a interface junto, reamostra
   e estraga a cor da chave.
5. **Conversa nova quando começar a derivar.** Deriva não se conserta pedindo
   "igual à anterior" — recomece anexando a referência aprovada.

Antes de aceitar uma folha, rode o conferidor — ele responde as quatro
perguntas que já reprovaram folha aqui, e leva um segundo:

```bash
python assets/confere_folha.py <folha.png>
```

Ele diz altura entre poses, mancha solta, cor do fundo e, o que mais escapa,
**se as passadas são opostas ou a mesma duas vezes**. Aferido: as duas folhas
que o dono reprovou olhando deram **18,9%** e **7,6%** nas pernas; a do
sorcerer que funcionou deu **51,0%**.

E a régua por trás dele:

| | como conferir |
|---|---|
| as poses são mesmo diferentes | compare **silhueta alinhada**, não pixel cru — 2 px de deslocamento já mudam todo o contorno. Abaixo de ~6% é a mesma pose |
| altura constante | 94% ou mais entre o quadro mais baixo e o mais alto |
| nada solto, nada cortado | nenhuma mancha ≥400 px separada do corpo; nada encostando na borda |
| o fundo é chapado | pouca variação de canal — o corte tolera distância 60 |

### O prompt

**Uma direção por geração, três poses, e os quadros que já existem anexados como
referência** — senão a vista de lado volta com outra armadura e o personagem
troca de roupa ao virar.

**Perfil** — é a vista onde perna se lê, então é a perna que muda. Mas **não peça
"a passada oposta"**: comparação entre células é a categoria que o gerador ignora
(§ acima), e "perna esquerda" e "perna direita" num perfil ele não sabe distinguir
— as duas se sobrepõem. O que realmente muda entre as duas passadas de um perfil
é **qual perna está desenhada POR CIMA** e qual sai mais escura por estar atrás.
Descreva isso, que é relação dentro de uma célula só:

```
3 character poses side by side in a single horizontal row, evenly spaced, with
wide empty space between them so they never touch.

The backdrop is a flat uniform CHROMA KEY colour for sprite extraction —
bright magenta, the same colour edge to edge, no gradient, no texture, no
ground plane, no floor, no horizon, no scenery. The characters float on the
key colour. Nothing else is drawn on it: no lines, no boxes, no borders,
no numbering, no captions.

Match the attached reference image exactly: same character, same face, same
clothing, same colours, same pixel-art style, same proportions, same size.

All three poses are a FULL LEFT PROFILE, the character facing left. In this
view the two legs overlap each other, so what separates the poses is WHICH LEG
IS DRAWN ON TOP and where each boot lands. Draw each pose from its own
description below. Do not treat any pose as the reverse of another one.

Pose 1 — standing: both legs vertical and together, both boots flat on the
  ground, both arms hanging straight down beside the hips.

Pose 2 — the NEAR leg strides. The leg closest to the viewer is drawn fully on
  top of the other and stretched forward, its boot planted heel-first ahead of
  the body. The far leg is drawn behind it in a darker shade, angled back, with
  only the toe of its boot touching the ground. The near arm is swung BACK
  behind the hip. The far arm is swung FORWARD, its hand visible in front of
  the chest.

Pose 3 — the FAR leg strides. The leg closest to the viewer is still drawn on
  top, but angled BACK with only its toe touching the ground behind the body.
  The far leg is stretched forward past it, its boot planted heel-first ahead
  of the body, drawn in a darker shade because it is the far one. The near arm
  is swung FORWARD in front of the chest. The far arm is swung BACK behind the
  hip.

Every pose is the same height, standing on one common ground line, full body in
frame from the top of the head to the soles of the boots.
```

**Confira antes de aceitar, e por COR nas pernas** (ver a seção sobre a régua).
Medido: passada oposta de verdade dá **45% ou mais** de mudança de cor abaixo dos
70% da altura; passada duplicada dá **menos de 10%**. Não há meio-termo entre os
dois — se der 7%, o gerador desenhou o mesmo passo duas vezes, e nenhuma
reescrita de prosa conserta isso a não ser esta.

**Frente e costas** — aqui a perna some atrás do corpo. Quem carrega o passo é o
**braço** e qual **bota está à frente** — é assim que o ciclope funciona: o que
muda entre os quadros dele de frente é o porrete, não o pé.

E aqui vale a mesma correção do perfil, por outro motivo. **Não diga "a perna
esquerda do personagem"**: o modelo não sabe de que lado fica a esquerda de quem
está virado para ele, e as duas descrições viram a mesma imagem. Diga **o lado da
IMAGEM** — isso ele acerta sempre, porque é onde o pixel vai.

```
3 character poses side by side in a single horizontal row, evenly spaced, with
wide empty space between them so they never touch.

The backdrop is a flat uniform CHROMA KEY colour for sprite extraction —
bright magenta, the same colour edge to edge, no gradient, no texture, no
ground plane, no floor, no horizon, no scenery. The characters float on the
key colour. Nothing else is drawn on it: no lines, no boxes, no borders,
no numbering, no captions.

Match the attached reference image exactly: same character, same face, same
clothing, same colours, same pixel-art style, same proportions, same size.

All three poses are seen from the FRONT, the character facing the viewer.
Positions below are given by the side of the IMAGE, not by the character's own
left and right. Draw each pose from its own description. Do not treat any pose
as the reverse of another one.

Pose 1 — standing still: both boots side by side and level with each other,
  both arms hanging straight down beside the hips, fists loose.

Pose 2 — the boot on the RIGHT SIDE OF THE IMAGE is a full step ahead: it sits
  LOWER in the frame than the other boot and is drawn slightly larger. The boot
  on the LEFT SIDE OF THE IMAGE is planted flat directly under its hip, higher
  in the frame. The arm on the RIGHT SIDE OF THE IMAGE is swung forward across
  the chest with the fist raised and visible against the body. The arm on the
  LEFT SIDE OF THE IMAGE hangs back behind the hip, almost hidden.

Pose 3 — the boot on the LEFT SIDE OF THE IMAGE is a full step ahead: it sits
  LOWER in the frame than the other boot and is drawn slightly larger. The boot
  on the RIGHT SIDE OF THE IMAGE is planted flat directly under its hip, higher
  in the frame. The arm on the LEFT SIDE OF THE IMAGE is swung forward across
  the chest with the fist raised and visible against the body. The arm on the
  RIGHT SIDE OF THE IMAGE hangs back behind the hip, almost hidden.

Every pose is the same height, standing on one common ground line, full body in
frame from the top of the head to the soles of the boots.
```

Para **costas**, troque `seen from the FRONT, the character facing the viewer`
por `seen from the BACK, the character facing away from the viewer`, e mantenha o
resto igual — os lados continuam sendo os da imagem.

**A conferência da frente é binária e não precisa de régua de cor:** veja **qual
bota desce mais** em cada pose. Se for a mesma nas duas passadas, é o mesmo
passo. `python assets/confere_folha.py <folha.png>` responde isso.

Para **criatura**, troque a referência e o personagem — e o que ela carrega
(porrete, asa, cauda) é o que muda de posição entre as poses, pelo mesmo motivo
do braço.

**Tombado** vai em geração separada, porque "não mais longo que" é comparação e
comparação ele ignora — aqui o comprimento é absoluto:

```
(mesmo cabeçalho, mesma referência)

2 poses of the SAME character lying dead on the ground, seen from above,
sprawled at different angles with the limbs in different positions.
Each body lies within a square: it is no wider than it is tall.
```

### ANTES de julgar passada: meça por COR, não por silhueta

Esta é a armadilha mais cara desta página, e ela custou três voltas. **Duas
passadas opostas têm quase a mesma silhueta.** As duas pernas ocupam o mesmo
contorno; o que muda é qual delas está **na frente** — e isso é sombreamento e
profundidade, não recorte.

Medido nas três folhas do sorcerer, as mesmas poses pelas duas réguas:

| | silhueta | **cor** |
|---|---|---|
| costas, passada A vs B | 6,9% | **48,2%** |
| frente, passada A vs B | 10,9% | **59,8%** |
| perfil, passada A vs B | 9,5% | **57,6%** |

Pela silhueta as três pareciam pose repetida e eu concluí isso três vezes — que
a folha de costas precisava de espelho, que o perfil só tinha uma passada, que
faltava regerar. **Nada disso era verdade**: as três folhas já vinham com as duas
passadas. O dono viu antes de mim, olhando: *"sheet_03 já tem as duas passadas"*.

A régua certa: recorte, normalize as duas poses no mesmo tamanho e conte os
pixels que **mudam de cor** onde as duas têm tinta — e olhe **só a metade de
baixo**, abaixo de 70% da altura, porque cabelo e capa mexem sozinhos e inflam a
conta. Medido em folhas de verdade:

| | pernas, mudança de cor |
|---|---|
| passada oposta de verdade | **45% a 55%** |
| a mesma passada duas vezes | **menos de 10%** |

Não há meio-termo entre os dois. E confira olhando as **botas**, que é onde a
perna da frente se declara.

### O ciclo tem de FECHAR

A linha de `walk` inteira toca uma vez por tile e emenda no começo dela mesma no
tile seguinte. Então `passada A → passagem → passada B` **não fecha**: no fim da
linha o B encosta direto no A do tile seguinte, duas passadas coladas sem
passagem entre elas. É um tranco, e foi exatamente o que o dono relatou —
*"parece que as animações se repetem mais de uma vez em uma única movimentação"*.

O ciclo certo tem **quatro quadros** e a passagem entra duas vezes, porque numa
caminhada de verdade ela acontece duas vezes:

```
walk_<lado>_01  passada A     (uma perna à frente)
walk_<lado>_02  pés juntos    (a passagem)
walk_<lado>_03  passada B     (a outra perna à frente)
walk_<lado>_04  pés juntos    (a passagem de novo — é ela que fecha)
idle_<lado>_01  pés juntos    (o mesmo arquivo do 02)
```

Dois passos por tile, que é o que um humano faz ao andar um metro. E **a passada
vem primeiro**: pés juntos no começo faz o passo nascer parado e o boneco hesita
a cada tile.

### Quando a folha REALMENTE só tem uma passada: espelhe as PERNAS

Só depois de conferir por cor. Se as duas passadas mediram abaixo de ~15%, aí sim
é pose repetida, e dá para fabricar a oposta sem regerar.

**Espelhar a figura inteira troca de lado tudo que é assimétrico.** O sorcerer
carrega o cajado sobre o ombro direito nos três quadros de costas (o orbe fica a
79–90% da largura); espelhado, ele salta para o outro ombro a cada passo — e em
46 px o orbe é a coisa mais visível da silhueta.

**Espelhe só a parte de baixo, e ACHE a linha, não a chute.** "Abaixo do cinto"
parece 60% da altura e está errado: a 60% a linha passa **pelas mãos e pela
fivela**, corta o antebraço no meio e o quadro sai com a cintura partida. Varra
de 55% a 85% medindo a **descontinuidade da junta** — silhueta e cor da última
linha de cima contra a primeira já espelhada. No sorcerer deu 170 a 60% e **29 a
78%**.

O eixo do espelho é o **meio das pernas**, não o meio da figura: com o cajado
subindo de um lado, o centro da caixa está deslocado e espelhar por ele joga as
botas para fora do corpo.

**No perfil não funciona**, e a razão é forte: espelhar inverte **runa, brasão e
fivela**, e runa ao contrário lê como desenho quebrado. Testado em quatro alturas
(62%, 68%, 74%, 80%) — todas invertem a runa do manto. Perfil sem a passada
oposta se resolve desenhando o quadro, com este prompt de um só, anexando a
passada que existe:

```
ONE single character pose, on a flat uniform chroma key background, bright
magenta, nothing else drawn on it.

Match the attached image exactly: same character, same robe, same staff, same
colours, same pixel-art style, same size, same LEFT PROFILE facing left.

The attached pose has the LEFT leg reaching forward. Draw the OPPOSITE step of
the same walk: the RIGHT leg reaches forward with the heel touching down, the
LEFT leg trails behind with only the toe touching, and the arms swap too — the
arm that is forward in the attached image swings back, and the other swings
forward. Everything above the belt keeps the same shape, and every rune and
buckle keeps the same orientation as the attached image.

Same height, feet on the same ground line, full body in frame.
```

### Do que sai do gerador até o jogo

1. Salve a folha em `assets/skins/<pasta>/<folha>.png`.
2. Escreva `<folha>.json` ao lado, **nomeando cada célula com o nome final**:

```json
{ "ids": {
  "voc_knight_veteran_idle_front_01": 1,
  "voc_knight_veteran_walk_front_01": 2,
  "voc_knight_veteran_walk_front_02": 3,
  "voc_knight_veteran_walk_front_03": 4,
  "voc_knight_veteran_idle_left_01":  9,
  "voc_knight_veteran_dead_01":      15
} }
```

3. `python assets/build_folhas.py <folha>.png` sem `--aplicar` imprime a grade
   numerada — é dela que saem os números acima. Depois rode com `--aplicar`:
   ele separa os desenhos, tira o fundo **e a sombra que o gerador pintou nele**,
   e grava em `assets/skins/_recortes/`.
4. Mova os arquivos para a pasta da skin ou da criatura.
5. `python assets/build_criaturas.py --aplicar`.

O passo 4 é na mão hoje. Se virar rotina, vale um cortador de grade.

### As armadilhas

- **Altura que muda entre células.** A escala é UMA para o boneco inteiro: uma
  pose agachada sai menor e o personagem cresce e encolhe ao virar. É o defeito
  mais comum de folha gerada, e o único que o script não conserta. A régua é a
  das folhas prontas: **94% ou mais** entre o quadro mais baixo e o mais alto da
  mesma linha. Se um apêndice é o culpado, a saída é `"escala": "lado"`, não
  redesenhar.
- **Peça solta.** O corte acha desenho por mancha conectada. Flecha voando
  separada do corpo vira um desenho à parte.
- **Poses encostando.** Duas células grudadas viram uma mancha só.
- **Folha já recortada (RGBA) cortada por cor.** O `build_folhas.py` lê a cor das
  quinas; numa folha transparente a quina é preta, e aí todo desenho ESCURO cai
  na tolerância e some. O manto do sorcerer virava 13 pedaços. Já consertado —
  quando existe alfa de verdade, o alfa é a chave —, mas é o mesmo erro de
  medir com a régua errada.
- **Folhas geradas em sessões diferentes saem em escalas diferentes.** As três do
  sorcerer vieram assim: corpo de ~590 px de frente e ~727 no perfil, 23% de
  diferença. Uma escala só para o boneco inteiro faz ele encolher ao virar; o
  remendo é `{ "escala": "lado" }`, que levou de 81% para 91%. O conserto de
  verdade é gerar tudo na mesma leva, anexando sempre a mesma referência.
- **Linha de grade desenhada dentro da imagem.** O gerador adora traçar as
  divisórias brancas da "grade" que você pediu. Elas não são a cor de fundo,
  então o corte as trata como desenho. Peça `NO grid lines` e confira antes de
  cortar.
- **Pose repetida.** Conte as poses distintas antes de cortar; três iguais viram
  três arquivos e o boneco fica parado enquanto anda. Melhor duas poses boas do
  que quatro em que duas são cópia — a linha oeste do ciclope tem 1 parado + 2
  passos e basta.
- **Julgar a folha a olho.** Duas vezes nesta sessão eu li defeito onde a
  medição não achou nenhum: "o demônio encolhe de perfil" (as alturas dão 98 a
  100%) e "sobrou franja da cor-chave" (0,003%). Meça a folha montada antes de
  mandar redesenhar — geração nova custa mais que um `python -c`.
- **Lado sem arte não dá erro.** Ele cai na frente (o `build_criaturas` garante),
  então o boneco *anda para o lado olhando para você* — feio, não quebrado.
  Confira o relatório do script: ele imprime quantos quadros cada linha recebeu.

---

## 7. As cinco skins de cada vocação

Vinte descrições no formato do prompt da §6. Saem da lore das duas terras:
Varrokgaard é uma ilha de fazenda **sem vocação nenhuma**, Aleto é a cidade que
monta guarda sobre o próprio herói, e o degrau 5 é sempre quem desceu até a racha
do selo.

**Como usar:** cole o bloco **A PESSOA** da vocação + o bloco **O KIT** do degrau
que vai gerar, os dois dentro de `THE CHARACTER:`. Anexe `_ref_estilo.png` no
degrau 1 de cada vocação; nos degraus 2 a 5, anexe o degrau 1 já aprovado — é a
mesma pessoa, e ali copiar identidade é o objetivo.

**O degrau 1 é o mesmo para as QUATRO vocações: o Cidadão**
(`assets/skins/voc_all_citizen`, declarado como `SKIN_PADRAO` no `data.js`). É
lore antes de ser economia — **em Varrokgaard não se tem vocação**, e quem sai do
templo é um cidadão. A vocação vai aparecendo conforme o conjunto sobe de degrau.
Personagem criado do zero nasce com ele.

Por isso as descrições abaixo são **do degrau 2 ao 5**: os quatro degraus 1 que
esta seção trazia (Lavrador Armado, Caçador da Mata Funda, O Leitor de Varrok,
Erveira dos Trigais) eram quatro maneiras de dizer "alguém de Varrokgaard sem
vocação ainda", e uma arte só resolve as quatro.

**A PESSOA é fixa nos degraus 2 a 5.** É o que faz a progressão ser progressão e
não troca de personagem — hoje o knight erra nisso (`commom` é imberbe de cabelo
preto, `veteran` é barbudo louro: duas pessoas).

**Todo campo em branco o gerador preenche com o que viu na referência** — por
isso HEAD, SHOULDERS, HANDS e PALETTE aparecem em todos os vinte, mesmo quando a
resposta é "nada".

### Knight — quem segura a linha

| # | Nome | Onde nasce |
|---|---|---|
| 1 | **Cidadão** | comum às quatro vocações: em Varrokgaard não se tem vocação, e quem sai do templo é um cidadão |
| 2 | **Guarda da Cerca** | a Cerca Nova; a primeira coisa parecida com uniforme |
| 3 | **Escudeiro Nobre** | conjunto `ns`, a casa de um senhor de Vigília |
| 4 | **Guardião Dourado** | conjunto `gg`, o "cheguei lá" |
| 5 | **Sentinela do Abismo** | conjunto `sa`, quem desce até o selo |

```
A PESSOA (degraus 2 a 5; o degrau 1 e o Cidadao, comum a todas)
BUILD — a heavy-boned man, broad through the chest, short and stocky.
AGE & FACE — late twenties, square jaw, heavy brow, a pale scar through the
  left eyebrow, clean-shaven.
HAIR — black, cut short, pushed back off the forehead.

O KIT
2 HEAD — an open-faced iron cap with a nose bar, black hair showing beneath it.
  SHOULDERS — squared by a mail shirt, no pauldrons, outline still narrow.
  CLOTHING — riveted mail over a grey wool tabard, scuffed leather bracers,
    canvas trousers, ankle boots.
  PALETTE — cold grey mail, grey-brown wool, one rust-red band on the tabard.
  HANDS — right hand a short sword, left hand a round shield.
  ONLY HE HAS — the shield is planked timber with the wood grain showing and an
    iron boss hammered flat, obviously made on a farm.

3 HEAD — bare head, a steel bevor covering throat and chin.
  SHOULDERS — narrow overlapping steel pauldrons held close to the body.
  CLOTHING — steel breastplate, shoulder and shin plate over a dark blue-grey
    padded gambeson, mail at the armpits, knee-high boots.
  PALETTE — dark blue-grey cloth and cool polished steel, no gold anywhere.
  HANDS — right hand an arming sword, left hand a tall kite shield.
  ONLY HE HAS — one small household crest painted on the shield and repeated
    nowhere else on him.

4 HEAD — a closed helm with a narrow visor slit and a lion crest at the brow.
  SHOULDERS — very wide, heavy layered pauldrons that break the outline.
  CLOTHING — full plate with warm brass trim following every edge, a cloak
    clasped at both shoulders falling to the calf.
  PALETTE — pale steel and warm brass, deep red cloak.
  HANDS — right hand a longsword, left hand a heater shield.
  ONLY HE HAS — the brass trim is worn thin at the knuckles and the elbows,
    exactly where it gets used.

5 HEAD — a closed helm welded shut, with no eye slit at all.
  SHOULDERS — asymmetric: one pauldron intact, the other rebuilt from
    mismatched plate.
  CLOTHING — blackened plate cracked across the chest and forged shut again
    with pale metal, cloak burnt down to hanging strips.
  PALETTE — near-black steel, bone-white weld lines, one cold white light.
  HANDS — right hand a heavy sword, left hand a battered shield.
  ONLY HE HAS — a small caged lantern chained at the shoulder giving cold pale
    light, the only bright thing anywhere on him.
```

### Ranger — arco e besta

| # | Nome | Onde nasce |
|---|---|---|
| 1 | **Cidadão** | comum às quatro vocações: em Varrokgaard não se tem vocação, e quem sai do templo é um cidadão |
| 2 | **Caçador Ancestral** | conjunto `ah`, leve e barato |
| 3 | **Batedor de Vigília** | o olho da cidade fora dos muros |
| 4 | **Espreitador da Floresta** | conjunto `fs`, o Bosque Tecido |
| 5 | **Arqueiro do Selo** | quem atira no que sobe da racha |

```
A PESSOA (degraus 2 a 5; o degrau 1 e o Cidadao, comum a todas)
BUILD — a lean wiry man, narrow-shouldered, a head taller than he is wide.
AGE & FACE — mid twenties, sharp features, weathered, no beard.
HAIR — dark brown, tied back short at the nape.

O KIT
2 HEAD — hood up with a stiff brow band shading the eyes, the face still
    visible.
  SHOULDERS — narrow, softened by layered leather.
  CLOTHING — layered leathers in green and brown, antler toggles down the
    chest, a bracer on the bow arm only.
  PALETTE — forest green and tan.
  HANDS — left hand a recurve bow of dark wood, right hand empty.
  ONLY HE HAS — the antler toggles, cut and matched by hand.

3 HEAD — a hood worn under a wide flat cap.
  SHOULDERS — squared by a short cloak pinned at the left shoulder only.
  CLOTHING — a slate blue-grey uniform coat, waxed leather, high boots.
  PALETTE — slate blue-grey and black.
  HANDS — a crossbow held across the body in both hands.
  ONLY HE HAS — a waxed dispatch tube hanging at the belt.

4 HEAD — a hood deep enough that only the eyes show, lower face wrapped in
    cloth.
  SHOULDERS — narrow and hunched, a cloak hanging straight from them.
  CLOTHING — dark leathers strapped tight, a moss-green cloak with a torn
    ragged hem.
  PALETTE — deep moss green and near-black.
  HANDS — left hand a long recurve bow of bone-pale wood, right hand empty.
  ONLY HE HAS — the cloak hem hanging in uneven strips.

5 HEAD — a hood split by two curved bone ridges rising from the brow.
  SHOULDERS — plated with pale bone over blackened leather.
  CLOTHING — blackened leather with bone plating at chest and shins.
  PALETTE — black and bone white with one cold pale accent.
  HANDS — left hand a bow whose limbs are carved from ribs, right hand empty.
  ONLY HE HAS — arrows fletched with grey feathers that hang the wrong way, as
    if against a wind nobody else feels.
```

### Sorcerer — seis vezes mais mana que vida

| # | Nome | Onde nasce |
|---|---|---|
| 1 | **Cidadão** | comum às quatro vocações: em Varrokgaard não se tem vocação, e quem sai do templo é um cidadão |
| 2 | **Iniciado Arcano** | conjunto `ai`, o primeiro conjunto de mago |
| 3 | **Chama Abissal** | conjunto `ch`, o fogo que veio de baixo |
| 4 | **Culto Sepulcral** | conjunto `cs`, o que se aprende na cripta do Pântano do Selo |
| 5 | **Regalia do Vazio** | conjunto `vz`, o topo |

```
A PESSOA (degraus 2 a 5; o degrau 1 e o Cidadao, comum a todas)
BUILD — a slight old man, narrow sloped shoulders, thin through the chest.
AGE & FACE — old, deep-set eyes under a heavy brow, hard set mouth, a full
  white beard reaching the chest.
HAIR — long white hair falling past the shoulders.

O KIT
2 HEAD — bare, no hood, white hair and beard fully visible.
  SHOULDERS — narrow, edged with a band of gold runework.
  CLOTHING — a black robe with bands of gold runework at shoulders, cuffs and
    hem, over a broad leather belt hung with pouches.
  PALETTE — black and gold with one violet accent.
  HANDS — right hand a staff crowned with a caged violet orb, left hand empty.
  ONLY HE HAS — the caged violet orb, held in gold claws.

3 HEAD — bare, hair and beard singed shorter at the ends.
  SHOULDERS — squared by brass shoulder plates strapped over the robe.
  CLOTHING — charcoal and deep red robes with the hem burnt to a ragged edge.
  PALETTE — charcoal, deep red, brass, one orange ember.
  HANDS — right hand a staff whose head is an iron cage holding a single ember,
    left hand bare and ash-stained.
  ONLY HE HAS — the ash worked permanently into the creases of his hands.

4 HEAD — a hood so deep the face is only shadow, beard hanging out below it.
  SHOULDERS — bulked by layers of wound grave cloth.
  CLOTHING — grey-white grave cloth wound in overlapping layers, bone clasps
    down the chest.
  PALETTE — grey-white, bone, dull iron.
  HANDS — left forearm carries a heavy tome chained by its spine to a bracer,
    right hand a plain iron staff.
  ONLY HE HAS — a censer hanging at the hip, still smoking.

5 HEAD — a thin black iron crown resting on the white hair, no hood at all.
  SHOULDERS — wide and squared by a high standing collar.
  CLOTHING — robes of black and violet whose lower edge frays into strips that
    do not hang the way cloth should.
  PALETTE — black and violet, one point of white.
  HANDS — sleeves that end before any hand appears; the staff floats just clear
    of where the hand would be.
  ONLY HE HAS — the sleeves with nothing coming out of them.
```

### Druid — gelo, terra e cura pesada

| # | Nome | Onde nasce |
|---|---|---|
| 1 | **Cidadão** | comum às quatro vocações: em Varrokgaard não se tem vocação, e quem sai do templo é um cidadão |
| 2 | **Bosque Ancião** | conjunto `bo`, folha e galhada |
| 3 | **Fúria do Norte** | conjunto `fn`, a neve do topo da Serra Cinzenta |
| 4 | **Voz da Lagoa Alta** | o que os Ssarai ensinam a quem eles aceitam |
| 5 | **Guardiã da Racha** | segura o que sobe, curando mais rápido do que ele fere |

```
A PESSOA (degraus 2 a 5; o degrau 1 e o Cidadao, comum a todas)
BUILD — a woman, sturdy and broad through the shoulders, short and solid.
AGE & FACE — forties, a weather-lined face, steady eyes, no ornament on it.
HAIR — dark hair streaked with grey, worn in one thick braid over the shoulder.

O KIT
2 HEAD — a circlet of braided twigs, no hood, the braid still visible.
  SHOULDERS — widened by a mantle of moss and hide.
  CLOTHING — layered green and bark-brown robes with real leaves worked into
    the shoulder seams.
  PALETTE — leaf green and bark brown.
  HANDS — right hand a staff of forked antler grown into living wood, left hand
    empty.
  ONLY SHE HAS — the forked antler crowning the staff, still rough with velvet.

3 HEAD — a heavy fur hood pushed back off the head, frost in the hair.
  SHOULDERS — very wide, a thick pelt mantle over both.
  CLOTHING — white and pale grey furs over blue-grey wool, fur-topped boots.
  PALETTE — white, pale grey, cold blue.
  HANDS — right hand a staff of grey wood capped with a spike of clear ice,
    left hand empty.
  ONLY SHE HAS — frost rimed along the shoulders and the eyebrows.

4 HEAD — bare, hair wet and slicked back, a standing collar of pale river shell
    rising behind the neck.
  SHOULDERS — sloped under a cloak that hangs heavy as if soaked through.
  CLOTHING — blue-green robes cut in long overlapping panels like scales.
  PALETTE — blue-green, wet grey, pale shell.
  HANDS — right hand a staff of dark reed bound in cord with a smooth river
    stone at its head, left hand empty.
  ONLY SHE HAS — the overlapping panels that read as scales, not as cloth.

5 HEAD — bare, hair loose and gone pale, eyes lit pale with no pupil.
  SHOULDERS — heavy, with plates of grey stone grown up through the cloth.
  CLOTHING — green so dark it reads black, stone plates at shoulder and shin, a
    mantle of hanging pale lichen.
  PALETTE — near-black green, grey stone, pale lichen.
  HANDS — right hand a staff with roots running up it, left hand empty.
  ONLY SHE HAS — the roots that leave the staff and continue up inside her
    sleeve.
```

### O que muda no código

Cinco skins por vocação pedem **`SKIN_DEGRAUS = 5`** no `data.js` — já aplicado.
Com uma lista de cinco e teto quatro, a última nunca seria alcançada pela escada
automática. E cinco é o número certo por conta própria: os conjuntos têm quatro
degraus de bônus (2, 4, 6 e 8 peças) mais o degrau nu, e no teto antigo os dois
últimos dividiam arte.

---

## Conferindo

```bash
python assets/build_skins.py        # o que mudaria na arte, sem gravar
node tests/test.js                  # regras do jogo
```

O jogo é HTML puro: abra `index.html` (ou `JOGAR.bat`) e recarregue. Se um ícone
não aparecer, quase sempre é o nome do arquivo diferente do id do item — o
script imprime os ids que gerou.

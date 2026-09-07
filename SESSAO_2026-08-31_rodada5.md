# Rodada 5 — tile, parede e objeto · 2026-08-31

**Documento de repasse, escrito NO MEIO da rodada.** A sessão pode acabar por limite antes
dos agentes voltarem. Quem pegar daqui: leia isto e a seção "Vocabulário de objetos — a leva
de recorte" do `tasks.html`.

## Estado, honesto

**DESATUALIZADO — A RODADA FECHOU O QUE DAVA.** Os dois agentes entregaram, **seis
consertos entraram** com régua e mutação (suíte 1338 → 1344), e o dono decidiu a
âncora do objeto: ela sobe para a linha do jogador. Sobram três defeitos abertos do Bug
Catcher. A fonte é a seção "Rodada 5 — tile, parede e objeto" do `tasks.html`;
este arquivo fica como o registro de como a rodada foi montada.

**(histórico) DESATUALIZADO na mesma tarde.** Os cinco consertos sem risco ENTRARAM, com régua e
mutação — suíte de 1338 para 1343, cinco mutações, cinco pegas. A fonte agora é a seção
"Rodada 5 — tile, parede e objeto" do `tasks.html`. **O Bug Catcher foi parado pelo dono antes
de entregar**, então a metade dele da rodada continua por fazer, e o achado da âncora do objeto
continua esperando decisão. O resto deste arquivo é o registro de como a rodada foi montada.

- Linha de base conferida antes de começar: `tests/test.js` **1338** verificações verdes,
  `tests/test_tools.js` **53** verdes, `test_launcher.js` verde.
  (O rodapé do `tasks.html` dizia 39 em `test_tools.js` e 1338 no principal; corrigido para 53 e 1343.)
- Cópia datada de `render2d.js`, `art.js`, `world.js`, `objetos.js`, `test.js` no scratchpad
  da sessão (`bak-r5-20260831-123950`) — **some quando a sessão for limpa**; o `git diff`
  já cobre o mesmo.
- Servidor de pé em `localhost:8765` pelo `preview_start` do config `jogo`.
- Dois agentes lançados em paralelo e **ainda rodando quando esta linha foi escrita**.
  Os resultados deles NÃO chegaram. Se a sessão morrer, essa medição se perde e precisa
  ser refeita.

## As duas decisões que valem para a rodada

Confirmadas pelo dono no começo desta sessão, iguais às das rodadas 1–4:

| Pergunta | Decisão |
|---|---|
| Formato | **Time em paralelo.** Designer 2D (só leitura, mede em Node) e Bug Catcher (só jogo rodando, monkey-patch em memória), sem se falarem; o Diretor julga e implementa. |
| Autoridade | **Correção entra direto, mudança de estrutura pergunta.** Bug visual e polimento o time conserta; formato de dado, pipeline de arte ou decisão travada do CLAUDE.md vira proposta e para. |

## O escopo, e o que fica de fora

**Dentro:** `drawFloor` (1º e 2º passe), `tileTexture`, `flowTexture`, `borderSprite`,
`foamSprite`, `tileBorders`, `TERRAIN_PRIO`, `TEX_PNG_MAP`, `rimMask`/`BORDA_P`;
`wallSprite`, `PAREDE_DRAW`, `vizinhosIguais`, `profParede`, `edgeShadow`, `tapaVista`;
o laço `for (const o of objsAt(x,y,z))` inteiro — ramos `deco`, `porta`, `span`, parede e
objeto solto —, `objSprite`, `decoSprite`, `OBJ_DRAW`, `dropShadow`, `cx`/`feet`, `span`,
`artW`, as 88 peças da `objects_01`, `src/objetos.js`, `reindexObjs`.

**Fora** (rodadas 1–4 já cobriram): passe de luz, halo, telhado/abrigo, bloom, grading,
godray, nuvem, chuva, relâmpago, névoa, poça, FPS de clima.

## Já sabido — não gaste volta trazendo como achado novo

- O ramo de parede do render **não conhece `png`**: monta pelo `wallSprite` (crista, face,
  vizinhos). Cripta e Entrada de mina entraram como objeto por causa disso.
- `span` faz **dois papéis** — largura de desenho e footprint de colisão. Nove peças
  reservam ao menos um tile a mais do que o pé usa (Placa de estrada: span 2, pé 0,28).
  É decisão de ESTRUTURA; a recomendação registrada é aceitar por ora.
- O **tapete** é plano e sai no passe de volumes, então cobre quem pisa nele
  (`ponytail:` no `world.js`).
- `drawFloor` é **49% do quadro** (9,70 ms). Reduzi-lo é decisão de estrutura, não ajuste.

## Como retomar

1. Relançar os dois agentes com os prompts do formato acima — eles estão descritos em
   `SESSAO_2026-08-29_graficos.md` §8, e as armadilhas de medição que **precisam** ir no
   prompt do Bug Catcher estão no §6 do mesmo arquivo mais a seção "Armadilhas conhecidas"
   do `tasks.html`.
2. Triar o que voltar: correção entra direto, estrutura vira proposta.
3. Toda correção sai com régua nova em `tests/test.js`, **validada por mutação** — desfazer
   o conserto no fonte, um por vez, e a suíte tem de acusar.
4. Ao fim: `graphify update .` e atualizar o `tasks.html`.

## Uma nota de método desta sessão

Os dois agentes foram lançados uma primeira vez e **morreram juntos num `ENOTFOUND`** antes
de ler qualquer coisa. Falha de rede lida como falha de trabalho: a notificação diz "failed"
e traz uma primeira frase do agente que parece início de análise. Confira se ele chegou a
medir antes de tratar o resultado como vazio — e relançar é barato quando o agente não
produziu nada.

---

# Designer 2D — o que voltou (medido, 2026-08-31)

Bancada: `tests/test.js` recortado para um harness no scratchpad, mapa real
`maps/varrokgaard.json` (192×192, 3 andares, 110.592 tiles, 5.597 objetos), `g2.drawImage`
instrumentado por fonte, decodificador PNG em `zlib` para medir os 64 chãos e as 105 peças
sem abrir imagem. Nada escrito no repositório.

## CORREÇÃO — entra direto

**1 · Objeto de folha é desenhado meia tile ABAIXO da própria sombra.** CONFIRMADO.
91 dos 101 objetos têm o pé no fundo do tile; a sombra de contato deles, o jogador, a árvore
e a moita têm o pé no meio (`CHAO = .5`). `render2d.js:972` e `:907` posicionam por
`sy - (spr.height - 32) * S` — identidade aritmética cujo fundo cai sempre em `sy + t` — em
vez de ancorar pelo `feet` do sprite. A sombra dos mesmos dois ramos (`:965`, `:902`) ancora
em `gy = sy + t * CHAO`. **A mesma função (`dropShadow`) recebe duas linhas de chão conforme
quem a chama.** Barril e jogador na mesma linha, zoom 2: pé do barril em y=332, centro das
duas manchas de contato em y=300 — 24 px de chão limpo entre a mancha e a base. É o relato
que o `silhuetaFade` foi criado para resolver ("parece flutuando"): o degradê consertou a
projetada, a ÂNCORA nunca foi consertada. 4 linhas, custo por quadro zero.
**Risco de composição alto: todo objeto do mapa sobe 32 px. A direção é decisão do dono —
o que não pode continuar é a peça e a sombra discordarem.**

**2 · `carregaTerrenos` limpa dois caches e esquece dois.** CONFIRMADO. `art.js:809-810`
limpa `TEX_CACHE` e `FLOW_CACHE`; `BORDER_CACHE` e `WALL_CACHE` também derivam de
`tileTexture` e não são invalidados. Medido: `chao trocou para o PNG? true / borda trocou?
false`. Exposição: `rock → pedra.png` está no `TEX_PNG_MAP` e são 1.934 paredes no mapa real.
Envenenamento parcial por chave fina — sai muro metade PNG, metade procedural. 2 linhas.

**3 · A face da parede estica a textura 2×, e o tile de crista 1,56×.** CONFIRMADO.
`art.js:1181` recorta 32 px de origem para `FACE` px de destino; `FACE` é 50 na crista e 64
abaixo → **28% de salto de grão** na primeira emenda, justamente na costura que a máscara de
vizinho existe para esconder. Anisotropia medida em `pedra.png`: fonte isotrópica (13,13 ×
14,26), face sai 1,84:1. 340 emendas com parede embaixo no mapa real. 1 linha.

**4 · `edgeShadow` blita o tile inteiro sendo que 56% é transparente.** CONFIRMADO.
Na vila densa são 623 dos 1294 `drawImage` do quadro (48%), custando 2,55 dos 6,61 Mpx de
destino numa tela de 0,96 Mpx. Aparar o alfa zero economiza **1,43 Mpx por quadro, 1,5× a
área da tela**, com o mesmo número de blits. ~4 linhas, custo por quadro NEGATIVO.

**5 · `pedra` declara `png` que o render nunca desenha.** CONFIRMADO. `world.js:270` tem
`deco: 1` e `png: 'objects_01_62'`; o ramo `deco` (`render2d.js:843`) vem antes do ramo
`png` (`:947`). Varredura dos 101 objetos: exatamente uma peça cai em ramo que ignora o
`png`. 70 pedras no mapa. 1 linha.

**6 · `agua_clara`, `agua_funda` e `lava_viva` são chão morto.** CONFIRMADO. Não correm, não
cintilam, não espumam, e a lava não acende — quatro comportamentos decididos por igualdade de
string com `'water'`/`'lava'` (`render2d.js:738`, `:744`, `:1015`). **Exposição hoje: zero
tiles.** Alçapão armado, não defeito na tela: arma no dia em que alguém pintar um lago com
`agua_clara` no editor. A régua certa é a `familia`, que os três já declaram. 3 linhas.

**7 · A mancha de contato sai da LONA, não da base da arte.** CONFIRMADO. `render2d.js:690`
usa `s.width * S * .5`. Medidas as 105 peças: razão contato/base mediana 0,91 (certa), p90
1,82, **máx 4,00** — placa de estrada, garrafa e cadeira com mancha 4× a base. São as mesmas
11 peças de topo largo / base estreita já anotadas pelo lado do `span`. ~8 linhas com cache
em `WeakMap`, irmão do `spriteBox`.

**8 · Luz de objeto só entra na lista se a âncora está na janela do laço.** CONFIRMADO.
Margem de 2,63 tiles contra raio máximo de 3,6 (`poste`) — excede em 0,98 tile, e o chão
acende de uma vez ao andar. Baixa prioridade. 1 linha.

## MUDANÇA DE ESTRUTURA — proposta, parada

**A · O ramo `png` do render NUNCA roda headless, e é por isso que o #1 atravessou a leva
inteira sem nada acusar.** Sem `Image` no node, `objSprite` devolve `null` e o
`if (!spr) continue` dispara para as 91 peças de folha. A suíte cobre o contrato de largura
estaticamente (`test.js:3577-3708`), mas nenhuma régua faz o RENDER desenhar uma peça de
folha. *Qual linha do código a régua nunca faz rodar?* — esta.
Ordem proposta: (1) injetar `OBJ_PNG` de mentira na bancada (8 linhas) para o ramo `png`
rodar headless; (2) SÓ DEPOIS decidir se saem as seis procedurais mortas
(`pocoSprite`, `carrocaSprite`, `barrilSprite`, `tochaSprite`, `lampiaoSprite`,
`posteSprite` em `art.js:1712-1714`) e se o comentário do `world.js:293-308` — que ainda
afirma que elas são a reserva do node — é corrigido. Apagar antes de haver régua exercitando
o substituto é a ordem errada.

## HIPÓTESES DERRUBADAS — não gaste a volta de novo

1. **O `ponytail:` do `borderSprite` (recorte fixo em 0,0) já venceu.** Não. Razão entre o
   salto na emenda e o passo natural do chão: mediana 1,53×, pior `duna` 2,98×; os
   estruturados que se esperava no topo estão no meio (`tijolo` 1,41, `calcada_mosaico` 1,17).
   Gatilho para reabrir: ~3×.
2. **O `encaixa` está mutilando arte.** Não — `artW` bate com o alfa em **105/105**. As 19
   peças que encostam na borda têm `artW == lona` por causa do `SNAP`, que reamostra, não apara.
3. **Objeto de `span` 3 aparece de repente na borda.** Não — a margem cobre. Só a LUZ pipoca (#8).
4. **`flowTexture` lê fora da folha.** Não: 96 + 32 = 192 = `TEX_S × 2`, fecha exato. E a
   taxa é constante, então não é o padrão que teleporta.
5. **Falta `TERRAIN_PRIO` ou `TEX_DRAW` para algum `tex` novo.** Zero faltas em 98 tiles e
   101 objetos. Os 23 `tex` sem PNG são procedurais por decisão.
6. **Supressão de canto do `tileBorders` trocada.** Os quatro cantos conferidos um a um: certos.
7. **O `objsAt` é o gargalo (3.475 chamadas/quadro).** Não — `Map.get` com guarda, ~0,2 ms
   num quadro de 16 ms. O que pesa é o pixel, e o pixel está no #4.

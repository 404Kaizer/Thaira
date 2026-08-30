# Sessão 2026-08-29 — auditoria gráfica por time (luz, sombra, clima)

**Documento de repasse.** A sessão acabou por limite de contexto, no meio da rodada 1 de 3.
Quem pegar daqui: leia este arquivo, depois a seção *"Luz, sombra e clima — auditoria por time ·
2026-08-29"* do `tasks.html`, que tem o registro longo.

---

## 1. O que o dono pediu

> Rode o jogo, analise todos os aspectos gráficos — tiles, paredes, objetos, iluminação, shaders,
> nuvem, clima. Busque bugs e formas de aprimorar, respeitando o estilo, as mecânicas e a estrutura
> já implementada. Crie um loop de busca, correção e melhoria. Faça você mesmo os prompts e use
> agentes de produção.

Papéis definidos por ele: **Diretor** (comanda e avalia), **Designer 2D** (audita detalhe e
implementa), **Game Designer** (viabiliza), **Bug Catcher** (força o jogo a bugar).

### As quatro decisões que ele tomou antes de começar

| Pergunta | Decisão |
|---|---|
| Autoridade dos agentes | **Correção entra direto, mudança de estrutura pergunta.** Bug visual e polimento o time conserta sozinho; formato de dado, pipeline de arte ou decisão travada vira proposta e para. |
| Decisões travadas do CLAUDE.md | **Só se reabrem com a medição que as derruba na mão**, feita no tamanho e na luz do jogo. Sem medição, valem. |
| Duração | **3 rodadas completas**, depois relatório consolidado e ele decide se continua. |
| Foco | **Luz, sombra e clima.** |

Pergunta feita por ele no meio da sessão, já respondida: *puro (HTML/CSS/JS) ou adicionar
ferramentas?* — resposta resumida no §7.

---

## 2. Estado: o que ENTROU no código

Tudo em `src/render2d.js` e `tests/test.js`. **Não commitado.** Suíte em **1201 verificações**
(era 1197); `test_launcher.js` e `test_tools.js` verdes. `graphify update .` rodado.

### 2.1 Máscara de telhado alinhada — `telhadoNaLuz`

`telhadoNaLuz` pintava a máscara de abrigo a partir de `w2s(x, y)`, que devolve o **centro** do
tile. Quem desenha o chão é o `drawFloor`, a partir do **canto** (`VW/2 − t/2`). A máscara inteira
saía `(+t/2, +t/2)`.

Sintoma: meia largura de tile do interior ficava **acesa** colada nas paredes norte e oeste, e 42%
de escuro escorria para a **rua** ao sul e a leste — em toda sala do jogo.

Medido: a faixa escura começava no pixel **64** (centro da coluna 71) em vez de **48** (a borda
dela). Depois do conserto, erro **0 px**. Medição independente do Bug Catcher: `+32 px` nos dois
eixos com `t = 64`, e perfil de luminância mostrando 32 px de interior 43 níveis mais claro, com
`60/103 = 0,58 = 1 − TELHADO`.

> Terceira mordida da mesma armadilha do CLAUDE.md ("dois sistemas de coordenadas nunca se
> misturam"): pixel de CSS × pixel de buffer, coordenada de tela × coordenada do pai, e agora
> centro de tile × canto de tile.

### 2.2 Clima por tile — `recorteCeu`

`const coberto = abrigado()` (sem argumentos ⇒ tile do jogador) governava poça, clarão do relâmpago
e chuva do **quadro inteiro**. `cloudPass` não perguntava abrigo nenhum.

Os dois erros ao mesmo tempo: parado na rua, **chovia dentro das casas visíveis**; três passos para
dentro de uma cabana, **a chuva sumia da rua inteira** num quadro.

Conserto: `recorteCeu(t)` devolve um `Path2D` dos tiles a céu aberto e recorta nuvem, relâmpago e
chuva; `poolPass` ganhou `if (abrigado(x, y, P.z)) continue` no laço que já percorria; `pocaF`
deixou de consultar o jogador.

Medido contando **pixel que muda entre dois quadros** (a chuva é a única coisa que se move com o
resto congelado):

| | interior da casa | pátio a céu aberto |
|---|---|---|
| jogador FORA (83,148) | **0 px** | 53 / 69 / 52 px |
| jogador DENTRO (78,148) | **0 px** | 34 px |

Antes, com o jogador dentro, o pátio inteiro ia a zero.

### 2.3 `cantoDoTile` e `janelaDeTiles`

A conta de canto estava escrita à mão em **três** lugares e um estava errado. Agora
`telhadoNaLuz`, `recorteCeu` e `poolPass` chamam a mesma função. `drawFloor` fica de fora de
propósito: ele desloca por andar (`dz`) e mede a largura pela distância até o vizinho.

### 2.4 Duas réguas novas em `tests/test.js`

- **Clima por tile.** O stub de `Path2D` passou a guardar os `rect`; a régua conta os retângulos
  que o `recorteCeu` *de fato produziu*, com o jogador encostado num interior para o enquadramento
  ter as duas metades. Nenhum tile abrigado pode receber chuva; nenhum a céu aberto pode deixar de
  receber.
- **Convenção de canto.** `cantoDoTile` tem de ser `w2s − t/2`.

**Nenhuma das duas procura palavra no fonte.** Validadas por mutação, uma de cada vez: trocar o
canto pelo centro derruba a segunda; tirar o `abrigado` do `recorteCeu` derruba a primeira (121
tiles vazaram).

---

## 3. Confirmado, medido e AINDA ABERTO

Ordem sugerida de ataque. Os três primeiros são **correção** (entram direto pela regra de
autoridade); os menores são cosméticos.

1. **Sombra projetada do SOL dentro de casa e dentro da caverna.** `dropShadow` usa `.28 * solF`,
   e `solF = clima.luz` é a luz do céu do *andar*, nunca filtrada por abrigo. Sala de paredes
   fechadas: **86%** da sombra de sol de campo aberto (876 px contra 886 px). Caverna
   (`CLIMA_PARADO.luz = .6`, constante): 889 px de silhueta apontando para **nordeste**, ignorando
   a tocha, que é a única fonte lá embaixo.
2. **O temporal tem duas direções.** No vento cheio: copa deita para OESTE (`balanço` +0,0432);
   traço da chuva aponta para OESTE (6.690 px contra 46); a **gota** anda para LESTE (`x` é função
   de `y` com `+incl`, e o `lineTo` subtrai); a sombra de nuvem anda para LESTE
   (`VENTO = [.010, .004]`, sempre positivo). **53°** entre o traço e a trajetória da mesma gota.
   O `ventoF` unificou a *intensidade*; a *direção* está cravada em três lugares com dois sinais.
   O Designer propôs `VENTO = [-.010, .004]` (1 linha) — **duas medidas contra uma, quem está
   errado é a nuvem** —, mas isso não resolve o traço contra a trajetória da gota, que é outro
   defeito no mesmo `rainPass`.
3. **`gradePass` devolve ao interior a cor do céu por inteiro.** Gate é "este andar tem céu?", sem
   abrigo. Ao poente o interior leva **96%** do tinte quente da rua, e relativamente **mais** (6,7%
   contra 5,3%), porque o mesmo laranja cai sobre chão já 42% escurecido.
4. *(menor)* `horaDoJogo` devolve "Tarde" às 12:00 em ponto — fronteira `<` do `FASES`.
5. *(menor)* O canvas pisca preto por um quadro ao redimensionar a janela.

---

## 4. Propostas do Designer 2D, ainda NÃO triadas

Ranqueadas por ele. **O Game Designer estava avaliando viabilidade e ordem quando a sessão acabou —
esse resultado se perdeu e precisa ser refeito.**

| # | Proposta | Custo | Observação do Designer |
|---|---|---|---|
| B4 | Sombra responde à hora: altura do sol muda comprimento e força. `contactShadow` (`rgba(0,0,0,.5)`) e `edgeShadow` (`rgba(0,0,0,.45)`) são alfas cravados. | ~12 linhas | **A bancada `tools/amostra/sombras.html` já existe** com linha "atual" contra "proposta" e um `#receita` que imprime as constantes. Nunca foi para o motor. A direção **não** gira (o brilho está assado no sprite). |
| B5 | Água reflete o céu: ao poente o céu está em croma 97 e a água sai em croma 11. Trocar o `#cfe8ff` cravado. | ~4 linhas | Lava fica de fora: emite, não reflete. Alfa é knob de olhar no jogo. |
| B6 | Relâmpago endurece a sombra: `solF = Math.min(1, clima.luz + clima.raio * .7)`. | 2 linhas | Hoje o quadro do clarão tem a luz mais forte do dia com a sombra mais fraca do dia. |
| B7 | Chuva com dois planos e véu de distância (hoje: 280 gotas, um `strokeStyle`, um `lineWidth`). | ~10 linhas | O véu tem de entrar **dentro** do `recorteCeu`, senão volta a chover dentro de casa por outra porta. |
| B8 | Névoa (não existe nenhuma no `src/`): folha de nuvem invertida e tingida com a cor do céu. | ~14 linhas | **Maior risco de identidade visual** — é o item que pode virar "névoa genérica de jogo gerado por IA". Cor sai do céu, nunca de branco cravado. |
| B9 | Sombra de parede com comprimento por hora (hoje `edgeShadow` é 14 px fixos = 0,44 tile, para parede de 2 tiles). | ~12 linhas | Teto duro em ~24 px (0,75 tile): passar disso vira xadrez — mesma armadilha medida da franja de terreno. |
| B10 | Tocha atravessa parede: `halo()` é gradiente radial puro, não pergunta geometria. | ~25 linhas | **Deixar por último.** A versão preguiçosa (`destination-out` no buffer de luz) apagaria o *ambiente* junto, não só o halo; a correta exige mais um buffer de tela cheia. |
| B11 | Só a parede declara faixa de topo/face; barril, poço e carroça levam o mesmo ambiente na tampa e na lateral. | ~30 linhas em `art.js` | Trabalho de leva, não de tarde. Anotação item a item. |

Dependências que ele apontou: **B4, B6 e B9 compartilham a altura do sol** (implementar juntos ou
na ordem); **B8 depende do `recorteCeu`**, que já entrou.

Contexto que ele mediu e muda a prioridade de tudo: **chove 28,4% do tempo real** e `nuvens` médio
é 0,24. Clima não é caso raro, é o estado normal da tela.

---

## 5. Hipóteses DERRUBADAS — não gaste a volta de novo

- **"O telhado não escurece ao meio-dia."** Falso. Razão medida **0,583** ao meio-dia limpo e
  0,582 na tempestade, contra `1 − TELHADO` = 0,58. Minha primeira medição deu 0,912 e era
  **diferença de material** entre o piso da sala e o da rua.
- **Pisca do passe de luz no limiar de `amb: null`.** Salto de luminância média no cruzamento:
  **0,4 nível**. Invisível.
- **O gate `if (amb.amb || coberto || faces.length)` pular o telhado ao meio-dia.** Varredura das
  192×192 posições da superfície: **zero** pontos com sala visível e nenhuma parede no laço do
  render. O laço alcança ±5/±6 tiles, bem mais que os ±2 visíveis.
- **Banding nos cortes da rampa `CEU`.** 300 amostras: maior salto entre passos consecutivos
  **3,2 níveis** (no poente), mediana 0,41.
- **Estouro por soma entre relâmpago + lustro de poça + bloom.** Clarão máximo sobre chão
  encharcado: **0%** de pixels clipados, canal máximo 243.
- **Chuva por cima da HUD.** Impossível: chuva vai no canvas, HUD e placas são DOM por cima.
- **`bloomPass` saturando num campo de lava.** Não reproduzível — Varrokgaard tem **0 tiles de
  lava** nos três andares. Falta uma terra com lava para fechar.
- **O lustro branco da poça** (dívida anotada em `ponytail:`). `poolPass` roda *antes* do
  `lightPass`, então o multiply do ambiente já tinge o lustro. Só sai branco ao meio-dia limpo,
  quando branco é a resposta certa. **Dívida superestimada.**

---

## 6. A régua que funcionou — copie isto na próxima sessão

Nada disso estava escrito em lugar nenhum e foi o que fechou os casos.

```js
// bancada no console do jogo (scripts são clássicos: P, G, WORLD, CAM, climaAgora,
// abrigado, drawWorld, w2s, tpx... são todos globais)
window.DIR = {
  real: Date.now.bind(Date),
  tp(x, y, z) { P.x = x; P.y = y; P.px = x; P.py = y; if (z !== undefined) P.z = z; }
};
// achar um instante de tempestade DE DIA (hora e clima saem os dois do relógio)
const t0 = DIR.real(); let tem = null;
for (let i = 0; i < 200000 && !tem; i++) {
  const ms = t0 + i * 5000, td = (ms % DIA_MS) / DIA_MS;
  if (td > .45 && td < .55 && nubladoEm(ms) > .92) tem = ms;
}
Date.now = () => tem;     // congela hora E clima
G.pausa = 1e9;            // congela G.now e CONTINUA desenhando
```

1. **Congele o mundo e conte o que MUDA.** Com tudo parado, avançar `G.now` um tico
   (`G.now += 90`) e diferenciar dois `getImageData` isola *exatamente* a chuva.
2. **Câmera travada, tile lógico móvel.** `P.px/P.py` fixos e `P.x/P.y` mudando isola um booleano
   do jogador sem mexer no enquadramento.
3. **Ligue e desligue o MECANISMO, não a cena.** Trocar `WORLD.floors[z].dentro` por um
   `Uint8Array` zerado e redesenhar dá a pegada exata da máscara de telhado. Comparar tile de
   dentro com tile de fora **não dá** — são materiais diferentes, e foi assim que eu quase anunciei
   um defeito que não existia.

### Três armadilhas de medição que custaram tempo nesta sessão

- **A tocha contamina toda medição de luz.** O halo tem 7 tiles de raio e anda junto com o
  jogador: qualquer A/B que mova o personagem mede o halo, não o efeito. Tire a tocha ou não mova
  o boneco.
- **`getImageData` com coordenada negativa não estoura — ele *dá a volta na linha*.** Amostrei um
  tile fora da tela e li o lado oposto do quadro, que estava chovendo. Sempre verifique os limites
  antes de somar.
- **O laço de `requestAnimationFrame` redesenha entre o seu `drawWorld()` e o seu
  `getImageData`.** Sem congelar `G.now`, dois quadros "iguais" não são iguais.

### Como entrar no jogo

Servidor: `python tools/serve.py 8765` (ou o launcher, `Server.bat`). Personagem de teste:
`/teste` no chat sobe para nível 60 com magic level 60, runas e poções. **Nunca teste no save do
dono** — os personagens `Auditor`, `LuzTeste` e `BugCatcher` no `localStorage` são de teste e podem
ser apagados.

Casa usada como cenário em Varrokgaard, `z = 1`: **interior `x 71..80, y 147..149`**, pátio aberto
`x 82..87`. Para achar outra: `dentroDeCasa(x, y, 1)`.

---

## 7. Resposta ao dono sobre puro × ferramentas

Pergunta dele: continuar em HTML/CSS/JS puro ou agregar ferramentas?

**Recomendação: continuar puro no runtime.** Três razões concretas, todas usadas nesta sessão:

- **O laço.** Editei `render2d.js`, F5, medi pixel vinte segundos depois. Bundler põe uma
  compilação entre o clique e a tela, e o `CLAUDE.md` proíbe pedir terminal ao dono.
- **O `tests/test.js` roda o jogo de verdade.** Ele carrega os mesmos arquivos do `index.html`, na
  mesma ordem, num `vm`, e chama `drawWorld` sem navegador. Foi assim que a régua nova mediu o
  recorte de céu. Com build, o teste roda contra um artefato diferente do que embarca.
- **Nenhum defeito desta rodada era falta de ferramenta.** Convenção de coordenada, escopo de um
  booleano, alfa que não pergunta abrigo, sinal de vento. Uma engine 2D traria o sistema de luz
  *dela* e tiraria o controle que este passe tem — telhado, crista e face por tile não existe em
  engine genérica.

Correção factual: **o projeto já não é só HTML/CSS/JS.** `assets/build_terreno.py`,
`build_criaturas.py`, o launcher Electron e o `serve.py` são ferramenta — e estão no lugar certo:
**offline, na produção de asset, nunca no caminho entre o dono e o jogo.**

Avaliado e **não** recomendado: `// @ts-check` com JSDoc rodaria sem build, mas não teria pego nada
desta rodada — `w2s` devolve `[number, number]` tanto para centro quanto para canto. Tipo não
distingue convenção.

**A exceção honesta é shader.** Canvas 2D não tem. Efeito por pixel de verdade exige WebGL, e o
custo é reescrever os 78 KB do `render2d.js` **e perder o `drawWorld` headless nos testes** (não há
GL no node). Esta rodada é o argumento contra fazer agora: três dos quatro defeitos eram passes que
já existiam, desalinhados. Se um dia virar requisito, o degrau barato é **um passe WebGL só no
fim**, pós-processando o quadro 2D pronto — compra godray, bloom e color grading sem tocar em como
o mundo é desenhado, e o mundo continua testável.

Maior ganho por esforço hoje: **mais bancada em `tools/amostra/`**, que é HTML puro. O
`sombras.html` já tem proposta pronta que nunca foi para o motor.

---

## 8. Como retomar o loop

A rodada 1 fechou correção; faltam as rodadas 2 e 3.

**Passo imediato:** refazer o Game Designer (o resultado se perdeu). Ele precisa entregar: a ordem
de execução dividida em rodada 2 e rodada 3; para cada item ENTRA / ADIA / CAI com motivo;
conflitos entre itens que tocam a mesma função; constantes novas e onde moram (§29 do CLAUDE.md);
custo por quadro somado (quantos passes de tela cheia, buffers e `clip`); o que precisa de régua
nova; e quais itens ameaçam a identidade visual (§3, §23, §25).

**Entrada dele:** os três defeitos abertos do §3 e as oito propostas do §4 deste documento.

**Formato do time que funcionou:**

- **Designer 2D** — só leitura de código, sem Browser pane, mede com script Node no scratchpad
  replicando as funções puras (`corDoCeu`, `climaAgora`, `nubladoEm`, `molhadoEm`, `relampago`,
  `luzDaFrente` são todas puras). Entrega lista ranqueada com esboço de diff, custo em linhas,
  custo por quadro, risco e **a régua com que o Diretor julga**.
- **Bug Catcher** — só jogo rodando, aba própria, monkey-patch em memória (nunca edita `src/`),
  restaura tudo no fim. Entrega defeitos com: reprodução, prova numérica, mecanismo em
  `arquivo:linha`, gravidade e CONFIRMADO/PLAUSÍVEL. **Manda ele derrubar hipóteses também** — as
  oito hipóteses derrubadas do §5 valeram tanto quanto os achados.
- **Rodar os dois em paralelo, sem se falarem.** Chegaram nos mesmos dois defeitos por caminhos
  opostos, e é isso que separa medição de palpite.
- **Só um agente escreve por vez.** Os dois de investigação são read-only.

**Regras de segurança que todo agente precisa receber:** nunca escrever em `maps/` (um POST de
teste já apagou 1.632 tiles do dono); nunca `git checkout`/`restore`/`reset`; não commitar; não
subir servidor novo nem abrir Electron.

---

## 9. Arquivos tocados nesta sessão

| Arquivo | O quê |
|---|---|
| `src/render2d.js` | `cantoDoTile`, `janelaDeTiles`, `recorteCeu`; `telhadoNaLuz` alinhado; `drawWorld` recorta nuvem/relâmpago/chuva; `poolPass` pula tile abrigado; `pocaF` sem o `coberto` |
| `tests/test.js` | Stub de `Path2D` guarda `rect`; duas réguas novas; exports de `recorteCeu`, `cantoDoTile`, `janelaDeTiles`, `tpx` |
| `tasks.html` | Seção nova *"Luz, sombra e clima — auditoria por time · 2026-08-29"* |
| `graphify-out/` | `graphify update .` — 1489 nós, 2603 arestas, 104 comunidades |
| `SESSAO_2026-08-29_graficos.md` | Este documento |

Backup do `render2d.js` antes da edição ficou no scratchpad da sessão
(`...\deffd3c2-...\scratchpad\render2d.js.bak-20260829-204627`) — **some quando a sessão for
limpa**; se quiser guardar, o `git diff` já cobre.

Nada commitado. Nada escrito em `maps/`.

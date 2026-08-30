## Diagnóstico: não presuma, isole

Quando o dono aponta um defeito visual, **não responda com o primeiro palpite, e
não aja nele**. Ou pergunte qual elemento da imagem é, ou isole o mecanismo até a
medição apontar o culpado — e só então mexa.

Custou três diagnósticos errados seguidos para a mesma grade escura no chão:
mancha de GORE no patch, grade do editor, borda assada no PNG do terreno. Era o
`telhadoNaLuz` escrito duas mensagens antes.

- **O primeiro suspeito é a mudança mais recente.** Defeito que aparece logo
  depois de uma alteração é dela até prova em contrário.
- **Isole o MECANISMO, não o cenário.** O que fechou o caso foi renderizar quatro
  tiles cobertos sobre fundo branco e medir miolo contra quina (148 × 86).
  Caçar o sintoma no mapa só trouxe ruído: parede, corpo, textura.
- **Se a imagem tem mais de uma coisa estranha, PERGUNTE qual.** Escolher a mais
  chamativa é chutar.

## Confirmar antes de implementar

Se o pedido do usuário ficar ambíguo, suscetível a erro, mal explicado, ou você tiver qualquer dúvida sobre o que foi pedido, SEMPRE PERGUNTE ANTES DE IMPLEMENTAR QUALQUER COISA. Não presuma o entendimento correto e siga direto pro código — confirme primeiro.

## ponytail

Ponytail (lazy-senior-dev mode) must stay active for all coding work in this project: climb the ladder (YAGNI → reuse → stdlib → native → existing dep → one-liner → minimum code) before writing anything, keep diffs short, and mark deliberate corner-cuts with a `ponytail:` comment naming the ceiling and upgrade path.

## Concisão

Resposta curta por padrão: o código primeiro, depois no máximo 3 linhas (o que foi pulado e quando adicionar). Sem resumo do que acabou de ser feito, sem tour de features, sem justificar a simplificação em parágrafos, sem repetir o diff em prosa. Se a explicação ficar maior que o código, apague a explicação. Vale também pros arquivos gerados: nada de comentário narrando o óbvio nem doc que ninguém pediu. Relatório, walkthrough ou explicação pedida explicitamente é exceção — aí entrega completo.

## headroom

Use `headroom_compress` on large tool outputs (file reads, search results, logs, JSON) before reasoning over them, to keep context usage low. Use `headroom_retrieve` with the returned hash when the full original content is needed.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- SEMPRE rode `graphify update .` ao terminar de implementar qualquer solicitação que tenha mexido em código, antes de dar a tarefa por concluída. Não é opcional nem "quando lembrar": é o último passo de toda implementação (AST-only, sem custo de API). Se o comando falhar, avise em vez de ignorar em silêncio.

## Documentos do projeto

Estes arquivos são a memória do projeto. **Leia antes de propor ou implementar qualquer coisa** — eles guardam decisões já tomadas, e propor de novo o que já foi decidido (ou desfazer sem saber) é o desperdício mais caro aqui.

- **tasks.html** — estado técnico, fila de pendências, correções feitas e *armadilhas conhecidas*. É o documento de repasse: se você só puder ler um, leia este.
- **mundo_varrokgaard.html** e **mundo_aleto.html** — a lore e a planta das duas terras: história, elenco de criaturas, regiões, subsolo e o que **não** existe em cada uma.
- **proposta_24.html** — proposta de alinhamento das habilidades de criatura, com as decisões ainda em aberto.
- **proposta_luz.html** — o que o motor sabe (e não sabe) sobre luz, sombra e orientação de superfície, com as medições do jogo rodando e as decisões em aberto.

Regras:

- **Dois arquivos para clicar.** `Server.bat` abre o jogo; `Editor.bat` abre o jogo **e o editor de mapas** lado a lado (dentro do jogo, F9 faz o mesmo). O launcher Electron é quem serve, grava o patch e recompõe — **não peça ao dono do projeto para subir servidor, rodar `node` ou abrir terminal**; se um passo do laço exige isso, o laço está incompleto e o conserto é no launcher.
- **Mapa: o script semeia, o editor corrige.** `tools/mapas/<terra>.js` compõe e se confere; `tools/editor.html` grava só o DIFF em `maps/<terra>.patch.json`, que o script aplica no fim, antes das conferências. Rodar o script nunca apaga correção feita à mão — e por isso **não edite `maps/*.json` na mão**: ele é saída, e a próxima execução o reescreve.
- **A ordem da composição é fixa:** pinta em uma camada → patch de tiles → `C.parte(m)` → patch de objetos → confere com `C.andavel()` → `C.salva(m)`. Partir antes de conferir faz a mata virar campo aberto no meio da medição; conferir antes de partir cega a conferência para tudo que é objeto. `andavel()` conta **porta como passagem** — a pergunta ali é "o jogador consegue chegar?", não "o passo passa agora".
- **Conferência NOMEIA, não conta.** Recinto de chão fechado de propósito (a vila murada, o pátio de palha) entra numa lista com nome e um ponto dentro dele, e a régua cobra as duas metades: todos existem, e não existe nenhum fora da lista. Contar — "têm de ser 2", "agora 3" — deixa passar um recinto novo indesejado sempre que outro somir na mesma execução. E a âncora tem de ser andável **por construção** (um portão, o ponto de nascer), nunca um centro de hunt: o `espalha` põe árvore em cima e a conferência reprova o mapa por engano.
- **O editor mostra o jogo, chamando o render DO jogo.** `drawWorld` do `render2d.js`, não uma cópia — segunda arte ou segundo laço de desenho diverge no primeiro objeto novo, e um editor que mente sobre o resultado é pior que a planta chapada. O preço é o editor declarar o `P`/`G` mínimo que o render lê. Pela mesma razão a paleta desenha o sprite de verdade, e não um quadrado de cor. E o editor **não anima**: clima parado e relógio fixo ao meio-dia — nuvem passando por cima do tile que se está pintando é ruído, e cor não se julga de noite.
- O mundo é **autoral, não gerado**. `genWorld` continua vivo só para rascunho; o mapa de verdade vem de `maps/*.json`. Antes de mexer em geração de mundo, leia a seção "A virada de mundo" do tasks.html.
- **SEMPRE atualize o tasks.html** ao terminar qualquer implementação, junto com o `graphify update .`. Não é opcional: sem isso o documento envelhece em silêncio — já aconteceu de ele passar três commits desatualizado e afirmar 32 invariantes travadas por teste das quais 18 não existiam.
- Se a lore mudar, o documento da terra é a fonte — atualize-o, não o código sozinho.

## Não destrua trabalho do dono do projeto

Custou duas perdas no mesmo dia, uma delas de ~700 tiles que não voltaram.

- **Teste de escrita vai contra cópia, nunca contra o arquivo dele.** Um POST de teste com dois tiles apagou um patch de 1.632 — o handler grava o que recebe, e eu mandei dois. Se o teste escreve, o alvo é arquivo descartável.
- **`git checkout` em arquivo com trabalho não commitado é destrutivo.** Reverteu o `src/world.js` inteiro no meio de uma leva. Para desfazer mutação de teste, guarde cópia antes e restaure dela.
- **Cópia datada antes de qualquer escrita em `maps/`**, e diga onde ficou.
- Quando algo sumir, **meça antes de concluir**: nas duas vezes em que parecia perda total, o carimbo dos arquivos mostrou onde o dado ainda estava. Anunciar perda que não houve custa tanto quanto a perda.

## Manter esta memória

Este arquivo entra no contexto de **toda** sessão; o tasks.html só quando alguém o abre. Por isso os dois têm trabalhos diferentes, e misturar arruína os dois — um CLAUDE.md inchado deixa de ser lido com atenção, e aí a regra que importa se perde no meio da história.

- **Aqui**: decisão que restringe trabalho futuro, regra de método, e onde as coisas moram. Curto.
- **No tasks.html**: o que foi feito, o que falta, medições, números e a história de cada correção.

O teste para saber onde vai: *isto muda **como** eu trabalho, ou registra **o que** aconteceu?* O primeiro vem para cá; o segundo vai para o tasks.html.

**Ao terminar qualquer trabalho, atualize os dois** — o tasks.html sempre, este arquivo quando surgir decisão ou regra nova. E regra que deixou de ser geral, **tire daqui**: este arquivo também encolhe.

## Decisões que não se re-discutem

Cada uma custou uma volta inteira de trabalho. Reabrir sem motivo novo é desperdício; o histórico de cada uma está no tasks.html.

- **O mundo é autoral, não gerado.** Mapa procedural não tem profundidade: o monstro está onde uma faixa de distância mandou, e nenhum lugar tem identidade. Autoral não significa desenhado à mão pelo dono — significa **decidido e congelado**.
- **Meça com a régua do jogo.** Medir com régua diferente é pior do que não medir: dá alarme falso, e o alarme falso esconde o verdadeiro. Já aconteceu três vezes — distância de cor medindo legibilidade quando eu queria identidade, componentes conexos com 4 vizinhos quando o jogo anda em 8, e a planta de cima julgando um lugar de andar. **Arte se julga no tamanho e na luz do jogo**: aprovar no 4× deixa passar o que não lê no 1×, e julgar tile de caverna em luz de meio-dia o deixa escuro demais para onde ele mora.
- **Piso de 192×192 para superfície.** Mapa menor lê grande na planta e minúsculo andando — Varrokgaard a 64² se atravessa em dez segundos, e foi por isso que ela caiu. A exceção é o lugar que **exige** ser pequeno (sistema de subsolo, gruta, sala), nunca o que ficou pequeno por descuido. A planta não mede distância percorrida; só andando se sabe.
- **Sombra é do MOTOR, não assada no sprite.** Elipse pálida pintada dentro do desenho entra no passe de luz junto com o objeto: escurece com ele à noite e para de separá-lo do chão — o objeto vira papel no chão. Quem prega no chão é o `dropShadow` (mancha de contato **mais** silhueta projetada, alfa seguindo o sol); o sprite só declara `cx` e `feet`. Cerca e escoramento ficam de fora porque correm em linha, e sombra projetada por tile num lance de cerca vira serrilha.
- **Objeto não é chão, e o mapa tem DUAS camadas.** `t` é o terreno (denso, um byte por tile) e `objs` é o que está em cima dele (esparso, com id, `span` e estado próprios). Objeto nunca carrega o chão embaixo de si — foi assim que o barril nasceu com `tex:'dirt'` e pintava terra em cima da palha, e ter as duas combinações exigiria um id por par. **Parede é objeto** (categoria `parede`), inclusive rochedo, parede de caverna e teia; chão continua terreno. Vários objetos por tile, e a ordem da lista é a ordem de desenho. `T.TREE`, `T.BARREL` e companhia continuam existindo como **vocabulário de autor** — o script pinta uma camada só e o `parteCamadas` desce para duas —, mas não são o que o motor carrega.
- **Objeto grande ocupa mais de um tile.** Um tile tem 32 px: poço, moinho, carroça e fonte desenhados dentro de um só serão sempre pequenos, por construção, e nenhum ajuste de desenho conserta isso. O objeto declara `span: [w, h]`, é UMA entrada com N endereços no índice, e só a âncora (canto noroeste) desenha. Antes de desenhar, pergunte **quantos tiles esta coisa ocupa no mundo**, não como encolhê-la para caber em um.
- **Quem desenha o mundo desenha as DUAS camadas.** Render, minimapa, planta PNG e página de amostra. Esquecer a segunda não dá erro: o mapa fica bonito e some justamente o que dá forma ao lugar — a vila lê como calçada lisa e a mata como campo aberto. Todo objeto declara `c`, a cor do material dele, e é ela que vai para a planta; rastro inteiro, nunca só a âncora.
- **Cor de material é constante própria, e isso vale contra o CHÃO em que a coisa se apoia.** O poço tinha pedra a distância 13 do `PAVE` sob ele e sumia dentro da calçada. Quando objeto e chão são do mesmo material, quem os separa é o objeto ser mais velho, mais molhado ou mais escuro — nunca a mesma cor em outro tom.
- **Bioma e geografia se estudam antes de desenhar.** Rio é **bacia**, não mancha: nasce em terreno alto, corre sempre para baixo, **recebe** afluente (nunca se divide), meandra no curso baixo e desemboca. Um tile solto de água no meio da mata é geologicamente impossível. E rio traz mata junto — a faixa da margem (mata-galeria) é mais densa que o entorno e forma o corredor por onde o bicho anda. Vila medieval **não tem grade**: as ruas emergem do uso, a igreja fica perto da estrada de entrada e não no centro do palco, e o padrão linear é o de aldeia feita por ordem de um senhor. Não construa bioma nem arquitetura no escuro.
- **Estrada sobre rio é ponte, e forma geométrica nunca cria terra.** As duas falham caladas: o `caminho` pinta terra sobre a água e o rio vira dique; o disco encostado na costa emenda no continente e engorda a silhueta sem desconectar nada, então a conferência passa verde. Guarde o leito e converta no fim; pinte região só onde já é terra.
- **A planta de cima não julga lugar de andar.** Ela diz se a topologia fecha e se há conteúdo inalcançável. Não diz nada sobre como é estar lá dentro — isso só se sabe jogando.
- **Um material, um significado.** Se parede, casa, mureta e pedra solta forem todas do mesmo tile, o mapa vira entulho e nada se distingue de nada.
- **Elenco fechado por terra, e não classe inteira.** Nem todo mapa precisa de toda classe, nem de uma classe inteira. **A ausência caracteriza tanto quanto a presença.**
- **Variante do mesmo material declara `familia`, e a régua de paleta vale entre famílias.** Exigir 60 de distância de cor entre duas gramas é medir identidade com a régua de legibilidade — grama de mata e de campo *têm* de se parecer; o que nunca pode se confundir é grama com pântano. E todo `tex` novo precisa de rotina em `TEX_DRAW` (reserva para quando o PNG não carregar) e de entrada em `TERRAIN_PRIO` (sem ela o tile some sob a borda de qualquer vizinho). Caractere novo entra no **fim** do `TILE_CHAR`: o índice é o id, e inserir no meio reescreve calado todo mapa já gravado. O alfabeto já passou do ASCII (94 imprimíveis, dois proibidos por serem aspa e barra em JSON) e entrou no Latin-1 — que serve porque é **um code unit em UTF-16**, então o mapa continua um caractere por tile. O teto seguinte é o fim do Latin-1; quando chegar, a escolha é dois caracteres por tile ou dicionário por mapa, e não se decide no meio de uma leva de arte.
- **Terreno de PNG entra por `assets/build_terreno.py`, e o tile de chão NÃO tem borda.** Folha gerada por IA é recortada, tem a borda serrilhada erodida, é costurada por cross-fade de transbordo e sai **96×96** em `assets/terreno/` — 96 porque é o `TEX_S`, e em 32 as nove células do `x%3,y%3` sairiam iguais e o chão viraria papel de parede. `TEX_PNG_MAP` no art.js diz qual `tex` usa qual PNG. Quem faz a transição entre dois terrenos é o `borderSprite`, nunca um contorno assado no tile — é assim no Tibia e é o que faz a grade sumir. Ao julgar costura, **compare a emenda com a distribuição de junções da FONTE**: contra a saída, o borrão do cross-fade abaixa a mediana e infla a razão sem nada ter piorado. **Folha nova traz o próprio enquadramento**: o miolo é reamostrado para o tamanho de trabalho (`normaliza`), nunca se baixa o `TRABALHO` para caber — a `costura` recorta em vez de reduzir, então TRABALHO menor mostra menos motivo AMPLIADO, que é o defeito da "pedra maior que o personagem" voltando pela porta dos fundos. E **só CHÃO passa por aqui**: objeto e parede ladrilhados viram papel de parede (uma parede de bocas de caverna, um bosque de pinheiros repetidos), e o caminho deles é outro — `span`, `cx`/`feet` e sombra do motor.

- **O patch tem DUAS camadas, e quem grava tem de gravar as duas.** O editor manda `{tiles, objs}`; por muito tempo os dois servidores escreveram só `tiles`, e toda edição de objeto morria ao gravar em silêncio — o `aplicaPatch` lia uma chave que nunca existiu no arquivo. Corolário de método: **formato de arquivo não mora dentro do handler HTTP**, senão não há como exercê-lo por teste, e foi por isso que o buraco durou. O formato é o `tools/patch_fmt.js` (e o gêmeo `serializa_patch` do serve.py), e o teste roda os dois e compara byte a byte — dois escritores que divergem fazem o arquivo depender de por onde se salvou. E **teste que procura menção não guarda comportamento**: a primeira versão varria o fonte atrás da palavra "objs" e passou verde numa mutação que trocava os dados por `{}` mantendo a palavra. Irmão disso, e a mordida seguinte: **régua que mede a função pura não guarda o render CHAMAR ela.** A régua do recorte de luz passou verde na mutação que tirava o `clip` do `lightPass` — porque media `recorteSala` direto. A régua tem de exercer o caminho inteiro e cobrar o que chegou na ponta.

- **Para medir pixel, mate o `requestAnimationFrame` — congelar o relógio não basta.** `Date.now` fixo e `G.pausa` param a hora, o clima e a chama, mas o laço do jogo continua redesenhando **entre** o seu `drawWorld()` e o seu `getImageData`, e aí os dois lados do A/B leem o mesmo quadro: a medição dá **zero em tudo** e parece que o defeito não existe. Trocar `requestAnimationFrame` por um no-op durante a medição (e devolver depois) é o que fecha. Zero perfeito em todas as amostras é sintoma disto, não resultado. O irmão disso, quando a medição é **pelo** intervalo de quadro: **aba em segundo plano estrangula o `rAF`** — ela não trava nem dá erro, sai lenta, e lentidão parece resultado. Bancada que mede tempo recusa rodar com `document.hidden` e invalida o número se a aba fugir no meio. E o irmão maior dos dois: **bancada de tempo sem CONTROLE não vale** — uma variante que não desliga nada tem de medir ~zero, senão a tabela é posição e não efeito. Três medições minhas seguidas "acharam o culpado" e o controle derrubou as três; uma delas provava que tirar a nuvem deixava o quadro 6× mais lento.

- **Classe de ESTADO não pode ter nome de classe de LAYOUT.** `.barra` era a barra de ferramentas e a marca de "barra o passo" ao mesmo tempo: os 20 tiles de `walk:false` herdavam `display:flex` e `padding:6px 12px`, e num quadradinho de 32 px isso deixa 8 px de largura. Não dá erro e nenhuma medição de cor pega — a amostra desenha o sprite certo, só espremida pela caixa. Há teste estrutural: as classes que mexem em caixa não podem ser penduradas por `classList.add`.

- **Na paleta do editor só entra o que se pinta de fato.** `T.TREE`, `T.BARREL` e os outros doze são vocabulário de autor para o script, e o `parteCamadas` os desce para objeto — na paleta de tile eles desenhavam o CHÃO deles (distância de cor zero contra grama e terra) e pintar com eles não mostrava nada, porque o mapa carregado já está partido. Quem põe árvore é o pincel de objeto.

- **Dois sistemas de coordenadas nunca se misturam, e eles coincidem até o dia em que não coincidem.** Já mordeu três vezes, sempre igual: o defeito é invisível no fonte porque as duas medidas têm o mesmo nome e a mesma unidade aparente. (1) *Pixel de CSS × pixel de buffer*: câmera, mouse e overlay trabalham em CSS, `canvas.width` é buffer — em tela sem HiDPI coincidem, e na do dono (`devicePixelRatio` 2) o "ver tudo" mostrava 46% do mapa e o arrasto do mapa andaria metade. Enquanto o canvas tem tamanho cravado o erro não existe; ao virar elástico, nasce. (2) *Coordenada de tela × coordenada do pai*: `clientX` é da viewport e `left` é do ancestral posicionado — arrastar janela saltava a distância das barras laterais no dia em que as janelas passaram a morar dentro do `#stage`. **Quando algo de enquadramento estiver errado só na máquina dele, ou só depois de mudar o pai de um elemento, é esta a primeira suspeita.** O conserto é sempre o mesmo: uma função pura que devolve os dois mundos e o fator entre eles (`escalaMapa`, `posicaoJanela`), com teste — conta que mora dentro de um handler de evento não tem como ser exercida.

- **Modal do jogo se ancora no `#stage`, não na página.** O meio da página não é o meio do jogo: as barras laterais e o console ocupam o resto, e uma janela centrada na página nasce torta. As `.win` são filhas do `#stage` e o `absolute` delas resolve sozinho — sem JS de layout. "Tela cheia" quer dizer **o palco inteiro**. Duas armadilhas de CSS que custaram uma volta cada: `inset` É o atalho de top/right/bottom/left, então `top:auto` escrito depois dele desfaz metade do que ele acabou de pôr; e `#id{width}` ganha de `.classe.classe{width}`, então tamanho que uma classe precisa sobrescrever mora em `:not(.classe)` em vez de brigar por especificidade. As `.screen` de entrada (escolher e criar personagem) ficam de fora: existem antes de haver palco.

- **Modal de tela cheia é `position: fixed` e cobre a JANELA INTEIRA.** As `.win` moram dentro do `#stage` (é o que centraliza as outras no jogo), então `absolute` as prenderia ao palco — mapa e talentos precisam somir com os painéis, a barra de ação e o console. O `z-index` fica **entre** o jogo (até 20) e o balão (60), que tem de continuar por cima porque é ele que descreve o que se está olhando.

- **Arte de fundo de painel: camada IRMÃ do conteúdo, nunca filha, e enquadramento por peça.** O zoom é um `transform` no conteúdo, e tudo dentro dele escala junto — a arte parada é uma questão de onde ela mora, não de uma propriedade a acertar. O escurecedor é uma **terceira** camada porque `filter: blur` desce para os filhos: véu dentro do fundo sai borrado e não segura a leitura. O enquadramento vertical é **tabela por vocação** (`VOC_FUNDO_Y`), porque retrato numa caixa larga mostra só uma faixa e o assunto de cada arte cai numa altura diferente — um número só serve a uma e corta as outras; a `transform-origin` acompanha o mesmo número. E os três valores (desfoque, opacidade, altura) saem de **olhar no jogo**: o primeiro chute de desfoque errou por seis vezes o valor final.

- **Painel de tela cheia não tem modo janela, e quem se move é o CONTEÚDO.** Mapa e árvore de talentos abrem sempre cheios; arrastar o cabeçalho deles não faz nada. Dois modos para o mesmo painel são duas caixas para acertar, e a segunda nunca tem dono — a árvore encolhida ficava com altura zero, porque o grafo já tinha perdido o `min-height` para não esconder a fileira de baixo atrás da rolagem. Num mapa e num grafo o gesto certo é câmera: arrastar o fundo move, roda dá zoom. O **piso de zoom é 1** e o limite de deslocamento no piso é **zero** — assim o clamp recentra sozinho e não é preciso botão de "voltar ao centro". Baixar o piso abaixo de 1 faz o conteúdo caber sobrando, o clamp para de recentrar, e ele some do meio da tela sem erro nenhum.

- **A junta entre terrenos é uma FRANJA, e o que a conserta é a silhueta, não a profundidade.** O contorno (`rimMask`) é derivado da máscara: enquanto a máscara for um recuo liso da borda quadrada, ele traça fielmente a escada dos tiles — desenha a grade em vez de escondê-la. Tufe a silhueta e o contorno vem esfarrapado de graça. Duas travas medidas: a invasão **nunca passa de ~32% do tile** (a 56% os dois lados mais o canto cobrem quase o tile inteiro num degrau de um tile, e meio tile invadido lê como tile cheio — sai um quebra-cabeça de abas), e o ruído é **periódico em coordenada de mundo**, senão cada tile tem a própria franja e o degrau volta a cada 32 px. Máscara semeada só pela direção é grade por construção, qualquer que seja a mordida.

- **Cor gritante se mede por CROMA, não por saturação.** Saturação de HSL estoura em cor escura: quatro gramas oliva de luz 16–23% mediram 95–98% e a `grama_clara` que já estava no jogo passou a 83% só por ter azul 10 em vez de 1 — um pixel separando aprovado de reprovado é o sintoma. Croma (max−min) é a distância à linha dos cinzas e não explode no escuro: lava 0,81, verde neon 0,92, teto em 0,85. O **piso** continua em saturação, que é o que mede "cinza morto" de verdade.
- **Tileset feito à mão é forma, contorno e luz por objeto.** Ruído com tom sorteado por pixel lê como tinta jogada no chão. O que funciona é sempre a mesma receita: objeto discreto, paleta de poucos tons fixos (`_tons`), sombra de um lado e luz do outro, e a mesma direção de luz para todos. Luz por OBJETO costura entre tiles; luz assada no quadro inteiro é o que estraga tile. E o chão é calmo — a riqueza mora na junta entre terrenos e no que está em cima dele, não no chão ficar ocupado.
- **Descrição vira desenho literal.** Pedir "língua que afina para cima" produz um espeto. Para arte, o caminho é imagem de referência mais uma página de amostra onde o dono julga — nunca prosa.
- **Progressão visual é por KIT, não por peça.** Paperdoll literal seriam 238 itens equipáveis × 24 quadros registrados um sobre o outro — não é caro, é impossível. Sobe de degrau a arte INTEIRA (`VOC_SKINS` no data.js, uma entrada por degrau, e o **degrau 1 é o mesmo para todas as vocações** — `SKIN_PADRAO`, o Cidadão, porque em Varrokgaard não se tem vocação; folha montada pelo `build_criaturas.py` a partir de `assets/skins/voc_<vocação>/<skin>/`). Quem manda no degrau é o **conjunto vestido**, com a régua que o `SETS` já tem. O seletor em Opções escolhe entre isso e uma skin fixa, e mora no PERSONAGEM (`P.skin`) porque a lista depende da vocação. Só o **procedural** mostra a arma equipada; folha traz a arma desenhada dentro, e escolher skin é trocar detalhe por acabamento. Corolário do pipeline: **lado sem arte cai na frente, nunca em linha vazia** — célula transparente é boneco invisível ao virar, e não dá erro nenhum.
- **Recorte por tile é caro, e o preço é o NÚMERO DE RETÂNGULOS.** `clip` custa proporcional a eles, e o caminho do céu é recortado 4× por quadro (nuvem, relâmpago, chuva, tinte) enquanto o da luz é 2× **por fonte** (passe de luz e bloom). Junte os tiles vizinhos em CORRIDAS e devolva `null` quando não há o que recortar — em campo aberto o `clip` some inteiro. Medido: 348 → 19 na vila, 81 → 10 por campo de fogo. Dois sintomas denunciam isto e são fáceis de ler errado: *"o clima é o que mais pesa"* e *"mexer no zoom derruba o fps"* — o segundo porque a janela cresce ao afastar a câmera. E a régua disso é de **custo**, não de geometria: um retângulo por tile e um por corrida cobrem a mesma região, então nenhuma régua de cobertura separa as duas.
- **Cobertura por tile: a MÁSCARA vem primeiro, o alfa depois.** Pintar um retângulo por tile já com alfa desenha uma grade — os retângulos se sobrepõem (folga de um pixel, arredondamento de posição) e **alfa sobreposto SOMA**: duas passadas de 42% dão 66% na faixa comum. Medido: 62 níveis de diferença entre o miolo e a quina do tile. O certo é a máscara opaca num canvas à parte (preto sobre preto continua preto) e o alfa uma vez só, no `drawImage`. Vale para qualquer coisa desenhada tile a tile com transparência. **E modo de composição vale para o CANVAS INTEIRO, não para o que se está pintando**: um laço de `fillRect` em `destination-in` não recorta tile a tile — cada retângulo apaga tudo fora dele, e sobra a interseção, que é o último. Sintoma: o efeito mede zero em tudo. Monte a máscara inteira em `source-over` e recorte uma vez.
- **"Dentro" é o que as PAREDES fecham, não o que tem telhado.** `souCoberto` pergunta se há piso em z−1 e responde NÃO para o interior de toda casa de um pavimento — foi assim que a sala de uma casa recebeu a mesma luz do céu que a rua. Quem responde é `dentroDeCasa`, uma inundação a partir da borda do mapa (4 vizinhos, senão escapa pela diagonal de uma quina; porta conta como parede, aberta ou fechada; uma vez por andar, invalidada pelo `reindexObjs`). `abrigado()` é a soma dos dois e é o que o passe de luz pergunta.
- **A parede TRANSBORDA um tile para cima, e por isso a crista dela não é do tile dela.** Toda máscara por tile de parede (luz, sombra, seleção) acerta o tile de CIMA, não o da parede — a parede sul de uma casa desenha a própria crista dentro do interior. Corolário medido: **casa tem telhado**, então o topo do muro está debaixo dele; quem vê o céu é a crista que cai na rua. Sintoma: retângulo chapado com a largura de vários tiles dentro de um recinto. E a régua que pega isso pergunta **ONDE a faixa cai** — cor e geometria passam verdes com o defeito na tela.

- **Dentro é mais escuro que fora, e a diferença entra NO BUFFER de luz.** O motor já sabia quem está coberto (`souCoberto`, andar por cima) e ninguém perguntava por tile — interior e rua recebiam a mesma luz do céu. O telhado corta 42% (`TELHADO`), e tem de entrar antes dos halos: um multiply à parte deixaria a tocha inútil lá dentro, porque dois multiplies se acumulam e nada os desfaz. Corolário: **o passe de luz roda ao meio-dia também**, senão a diferença some justamente na hora em que ela mais importa.
- **O que corre em linha pergunta aos VIZINHOS, e um booleano nunca basta.** Parede, cerca e escoramento sofreram do mesmo defeito por motivos diferentes: a cerca recebia "corre na horizontal?" e por isso não tinha quina (as duas variantes são lances retos), e a parede não recebia nada, então repetia a chapa iluminada a cada tile e um muro vertical lia como blocos empilhados. A régua é máscara de 4 bits do vizinho **do mesmo material** (1 N · 2 S · 4 O · 8 L): 16 variantes saem da mesma composição, e a crista só aparece onde o lance acaba. Sintoma para reconhecer: **a direção horizontal parece certa e a vertical não** — é sinal de que a peça se repete sem perguntar quem está em volta.
- **A escada de tamanho tem cinco degraus e o jogador é a unidade.** 0,5 miudeza · 1 mobília · 1,5 gente · 2 o que gente atravessa (porta, parede, árvore, poste) · 2,5 o que domina gente. É a régua do Tibia: passos inteiros, nada no meio. E **altura de objeto vem do SPRITE**, não de constante — enquanto o render espremia todo objeto solto em `CERCA_H`, o poste não podia ser mais alto que o barril por construção.
- **Escala de personagem se mede contra o que GENTE CONSTRUIU, não contra outra criatura.** O jogador saiu 1,37 tile — mais baixo que a cerca da fazenda (1,44) e do mesmo tamanho que um minotauro. Comparar boneco com boneco não acusa: os dois podem estar errados juntos. Cerca, muro e porta é que dizem quanto mede uma pessoa. `P_SZ` (1,25 → 1,74 tile) vale nos TRÊS lugares onde o jogador é desenhado — folha, procedural e corpo —, senão trocar de skin ou morrer muda a altura dele.
- **Reuso é errado quando diferenciar é o requisito.** Uma fórmula só para quatro elementos deu quatro bolinhas de cores diferentes. A escada do ponytail vale para lógica, não para identidade visual. Corolário caro: **cor de material é constante própria, não a cor do tile multiplicada** — veio, entulho e musgo nasceram todos errados por escalar a cor do vizinho em vez de ter a sua.

## 1. PROJECT IDENTITY

THAIRA is a 2D dark-fantasy RPG.

The visual identity is inspired by classic 2D RPGs such as Tibia and RuneScape, but THAIRA must have its own visual identity. Do not blindly reproduce the interface, assets, layouts, terminology, or exact visual design of those games.

The objective is to create a cohesive game that feels handcrafted rather than procedurally or generically AI-generated.

The game should prioritize:

- Strong gameplay readability
- Clear information hierarchy
- Consistent visual language
- Functional interfaces
- Dark-fantasy atmosphere
- Pixel-art compatibility
- Efficient use of screen space
- Consistency across every system
- Professional game-development standards

Never sacrifice usability merely to make something look more elaborate.

---

# 2. CORE DEVELOPMENT PRINCIPLES

Before implementing anything, understand the existing architecture.

Do not unnecessarily rewrite working systems.

Do not create duplicate systems when an existing component, utility, manager, hook, service, or design token can be reused.

Before creating a new component:

1. Search the project for an existing equivalent.
2. Determine whether the existing component can be extended.
3. Reuse existing design tokens.
4. Reuse existing interaction patterns.
5. Only create a new component when there is a genuine functional or visual requirement.

Prefer modular systems over duplicated code.

Prefer data-driven systems over hardcoded content.

Keep gameplay logic separate from presentation whenever practical.

Do not introduce a dependency merely to solve a problem that can be solved cleanly with the existing project architecture.

Do not make unrelated changes while implementing a requested feature.

---

# 3. UI ART DIRECTION

The THAIRA interface must look like a handcrafted dark-fantasy RPG interface.

It must NOT look like:

- A SaaS dashboard
- A modern business application
- A generic web application
- A mobile application
- A futuristic sci-fi interface
- A cryptocurrency interface
- A generic AI-generated fantasy UI
- A glassmorphism interface
- A modern "gaming dashboard"
- A collection of unrelated cards
- A generic Bootstrap/Tailwind component library

Avoid excessive:

- Rounded cards
- Gradients
- Glow effects
- Glass effects
- Transparency
- Drop shadows
- Neon colors
- Decorative elements
- Floating cards
- Pills
- Excessive borders
- Excessive animations

The interface should feel like part of the physical world of THAIRA.

Visual materials may evoke:

- Aged iron
- Dark wood
- Leather
- Stone
- Parchment
- Old metal
- Worn cloth
- Dark glass when thematically appropriate
- Magical materials only when justified by gameplay

The UI should feel functional first and atmospheric second.

---

# 4. VISUAL LANGUAGE

THAIRA uses a restrained fantasy visual language.

### Shapes

Prefer:

- Rectangular panels
- Slightly irregular fantasy frames
- Angular shapes
- Subtle ornamental corners
- Strong silhouettes
- Simple geometric slots

Avoid making every component rounded.

Rounded corners should only be used when they have a deliberate visual purpose.

### Borders

Borders should generally be subtle.

Avoid thick generic outlines around every element.

Use different border treatments to communicate hierarchy:

- Primary window
- Secondary panel
- Interactive element
- Selected element
- Disabled element
- Warning
- Important gameplay state

Do not use the same border everywhere.

### Texture

Texture should support the material.

Examples:

- Wood texture for wooden UI
- Metal texture for forged frames
- Parchment texture for lore and documents
- Leather texture for inventory or equipment elements

Do not apply texture indiscriminately.

Do not use obvious stock textures.

Texture must remain subordinate to readability.

---

# 5. COLOR SYSTEM

The UI must use a controlled palette.

Do not invent random colors for individual screens.

Create centralized color tokens.

Conceptually:

```text
Background
Surface
Surface Elevated
Border
Border Highlight
Text Primary
Text Secondary
Text Disabled

Primary Accent
Secondary Accent

Health
Mana
Stamina

Success
Warning
Danger
Neutral

Common Item
Uncommon Item
Rare Item
Epic Item
Legendary Item
Quest
Magic
```

Colors must communicate meaning consistently throughout the game.

For example:

- Red = health, danger, damage, hostile states
- Blue = mana or magical resources where applicable
- Green = healing, positive effects, success
- Yellow/orange = warning, attention, rare information
- Purple = special/magical states when appropriate

Do not use color merely because it looks attractive.

Color should communicate information.

---

# 6. TYPOGRAPHY

Typography is part of the game's identity.

Use a display font for:

- Main titles
- Major headings
- Character/class names
- Important fantasy labels

Use a highly readable font for:

- Stats
- Inventory quantities
- Tooltips
- Quest descriptions
- Combat information
- System messages
- Detailed information

Never sacrifice readability for thematic typography.

Avoid using a decorative medieval font for every piece of text.

Do not use more fonts than necessary.

Typography hierarchy must be consistent.

---

# 7. SPACING AND PROPORTIONS

Use a consistent spacing system.

Do not randomly choose padding or margins for every component.

Define spacing tokens and reuse them.

UI should have intentional density.

THAIRA is an RPG, not a minimalist corporate application.

Information-dense interfaces are acceptable when the information is relevant.

However, do not fill empty space merely because it exists.

Empty space should be intentional.

---

# 8. COMPONENT SYSTEM

Create reusable components wherever possible.

Common UI components include:

```text
Panel
Window
Modal
Button
IconButton
Tab
Tooltip
ContextMenu
Dropdown
ProgressBar
HealthBar
ManaBar
StaminaBar
Slot
ItemSlot
EquipmentSlot
SkillSlot
HotbarSlot
Separator
Badge
Notification
QuestEntry
StatRow
CharacterAttribute
Scrollbar
Pagination
List
ListEntry
Input
SearchField
```

Every reusable component must have consistent:

- Dimensions
- Typography
- Padding
- Borders
- Hover state
- Pressed state
- Disabled state
- Selected state
- Focus state where applicable

Do not implement visually different versions of the same component unless the difference is intentional and documented.

---

# 9. INTERACTION STATES

Every interactive element should have clear states.

At minimum, consider:

```text
Default
Hover
Pressed
Selected
Disabled
Focused
Unavailable
```

States should not rely solely on color.

Use combinations of:

- Contrast
- Border
- Background
- Icon state
- Position
- Animation
- Subtle lighting
- Sound

The user should immediately understand what can be interacted with.

---

# 10. ANIMATION

Animations should be short and functional.

Avoid excessive UI animation.

Good uses:

- Window opening
- Window closing
- Button press
- Item pickup
- Item selection
- Tooltip appearance
- Notification entrance
- Health/mana changes
- Tab transitions
- Inventory interactions

Animations should reinforce the action.

Do not animate everything.

Do not use slow modern-web transitions unless they fit the game.

Avoid:

- Excessive bouncing
- Excessive scaling
- Constant floating
- Long fades
- Unnecessary particle effects
- Animation that interferes with gameplay

Gameplay responsiveness has priority over visual spectacle.

---

# 11. HUD

The HUD must provide important information without obstructing the game world.

The HUD should prioritize:

1. Player survivability
2. Active resources
3. Combat information
4. Immediate actions
5. Relevant status effects
6. Navigation
7. Secondary information

The HUD should feel integrated with the game rather than pasted on top of it.

Common elements may include:

```text
Health
Mana
Stamina
Experience
Level
Status Effects
Hotbar
Minimap
Equipment
Combat State
Target Information
Notifications
```

Do not display information merely because the game has access to it.

Only expose information that benefits the player.

---

# 12. INVENTORY

The inventory must communicate items primarily through:

- Icon
- Slot position
- Quantity
- Rarity
- Selection state
- Tooltip

The inventory must not look like a spreadsheet.

Item slots should have a strong visual relationship with equipment slots and hotbar slots.

If the same item appears in different UI systems, its visual identity must remain consistent.

Do not create different icons or representations for the same item unless technically necessary.

---

# 13. EQUIPMENT

Equipment UI should communicate character silhouette and item placement clearly.

Equipment slots should have recognizable locations.

The player should understand the relationship between:

```text
Head
Body
Hands
Weapon
Shield
Legs
Feet
Accessory
Ring
Amulet
etc.
```

Do not overcrowd the equipment screen.

Equipment comparison must be immediately understandable.

Stat changes should be visually clear but not excessively animated.

---

# 14. MENUS

Menus must serve gameplay.

Every menu should have:

- Clear purpose
- Strong title
- Logical grouping
- Obvious navigation
- Consistent exit behavior
- Consistent visual language

Do not create menus consisting entirely of decorative cards.

Avoid unnecessary nested menus.

Prefer direct access to frequently used systems.

---

# 15. WINDOWS AND PANELS

Windows should have clear hierarchy.

A primary window may contain secondary panels.

Example:

```text
Main Window
 ├── Header
 ├── Navigation / Tabs
 ├── Content
 │    ├── Primary Panel
 │    └── Secondary Panel
 └── Footer / Actions
```

Do not create five different border styles inside one window without a reason.

The player must immediately understand:

- What screen they are on
- What information belongs together
- What can be interacted with
- What is secondary information

---

# 16. TOOLTIPS

Tooltips are extremely important for RPG systems.

Tooltips should be:

- Fast
- Readable
- Compact
- Contextual
- Consistent

Item tooltips should prioritize:

```text
Item Name
Item Type
Rarity
Primary Properties
Secondary Properties
Requirements
Description
Value / Relevant Information
```

Do not create huge tooltip windows when a compact tooltip is sufficient.

Tooltips should not cover the item or important gameplay information unnecessarily.

---

# 17. ICONOGRAPHY

Do not use emojis as gameplay icons.

Do not use arbitrary Unicode symbols when a proper game icon is appropriate.

Icons must belong to the same visual family.

Important categories should have recognizable silhouettes.

Examples:

- Sword
- Shield
- Helmet
- Potion
- Spell
- Gold
- Quest
- Character
- Inventory
- Equipment
- Skills
- Map
- Settings
- Save
- Exit

Do not mix radically different icon styles.

Avoid combining:

- Flat modern icons
- 3D icons
- Emoji
- Pixel icons
- Line icons

unless there is a deliberate documented reason.

---

# 18. PIXEL ART COMPATIBILITY

THAIRA is a 2D RPG.

UI elements must respect the visual language of the game's sprites and environment.

Avoid overly smooth UI graphics when they visually conflict with pixel-art assets.

When using pixel-art UI:

- Preserve hard edges
- Avoid unintended anti-aliasing
- Respect pixel density
- Avoid fractional scaling
- Avoid blurry transforms
- Use integer-friendly dimensions where appropriate

Do not automatically pixelate every UI element.

The objective is visual cohesion, not an arbitrary pixel filter.

---

# 19. RESPONSIVE BEHAVIOR

The interface must account for the game's supported resolutions.

Do not simply scale everything proportionally.

Determine which elements should:

- Scale
- Reposition
- Collapse
- Remain fixed
- Become scrollable

Critical gameplay information must remain accessible.

Avoid interfaces that become unusable at different aspect ratios.

---

# 20. ACCESSIBILITY AND READABILITY

The UI must remain readable.

Do not use:

- Tiny text
- Low-contrast text
- Decorative fonts for important information
- Color-only indicators
- Excessive visual noise

Important information should have multiple visual cues when appropriate.

For example:

A poisoned character should not be identified only by a green icon.

Use icon + color + tooltip/state where appropriate.

---

# 21. AUDIO/UI FEEDBACK

When implementing an interaction system, consider whether it should have audio feedback.

Examples:

Button press:
- short click

Inventory interaction:
- subtle item sound

Equipment:
- appropriate equipment sound

Quest:
- distinct notification sound

Error:
- short negative feedback

Important achievement:
- stronger confirmation

Do not use the same sound for every UI action.

Audio feedback must remain subtle enough not to become irritating.

---

# 22. SCREEN COMPOSITION

Before implementing a major screen, determine its visual hierarchy.

Ask:

1. What is the player's primary objective on this screen?
2. What information is most important?
3. What action is most likely?
4. What information is secondary?
5. What can be hidden behind a tooltip?
6. What should remain visible?
7. Where should the player's eye go first?

Do not automatically center everything.

Do not automatically use a three-column card layout.

Do not automatically create a sidebar.

Do not automatically create a grid.

Choose the layout based on the gameplay requirement.

---

# 23. ANTI-AI DESIGN RULES

The following are specifically prohibited unless there is a strong design reason:

- Generic rounded cards
- Random gradients
- Excessive glow
- Purple/blue "AI aesthetic"
- Glassmorphism
- Neon borders
- Excessive drop shadows
- Excessive blur
- Generic dashboard layouts
- Stock fantasy ornaments
- Random decorative icons
- Emoji UI
- Excessive symmetrical decoration
- Repeated identical cards
- Huge headings consuming screen space
- Decorative elements with no gameplay purpose
- Random accent colors
- Modern SaaS-style buttons
- UI generated independently for each screen

If a design looks like it could belong to a random AI-generated website, reconsider it.

---

# 24. CONSISTENCY RULE

When implementing a new interface, compare it mentally against existing THAIRA interfaces.

Ask:

"Could a player immediately recognize this as THAIRA?"

If the answer is no, revise it.

New interfaces must inherit the existing visual language.

Do not redesign the entire UI simply because a new screen is being implemented.

---

# 25. DO NOT OVER-DESIGN

A common failure mode is adding visual complexity to make an interface appear more sophisticated.

Do not do this.

A professional interface is not necessarily a complicated interface.

Prefer:

```text
Clear
Consistent
Readable
Purposeful
Atmospheric
```

over:

```text
Complex
Decorative
Glowing
Animated
Overloaded
```

---

# 26. BEFORE IMPLEMENTING A NEW UI

For any significant UI feature:

### Step 1 — Inspect

Inspect the existing project architecture and UI components.

### Step 2 — Identify reuse

Find existing components, styles, tokens and utilities that should be reused.

### Step 3 — Define hierarchy

Determine the information hierarchy and primary player actions.

### Step 4 — Implement

Use the existing design system.

### Step 5 — Validate

Check:

- Alignment
- Spacing
- Typography
- Contrast
- Interaction states
- Resolution behavior
- Visual consistency
- Gameplay readability

### Step 6 — Refine

Only after functionality works, refine visual details.

Do not rewrite functional code unnecessarily during visual refinement.

---

# 27. WHEN ASKED TO "MAKE IT BEAUTIFUL"

Do NOT interpret "beautiful" as:

- More gradients
- More glow
- More shadows
- More animations
- More cards
- More decoration

Instead interpret "beautiful" as:

- Better hierarchy
- Better spacing
- Better typography
- Better proportions
- Better iconography
- Better material treatment
- Better contrast
- Better consistency
- Better interaction feedback
- Better integration with the game's atmosphere

---

# 28. WHEN ASKED TO REDESIGN AN EXISTING UI

Do not immediately replace the entire interface.

First analyze:

1. What is already working?
2. What looks generic?
3. What harms usability?
4. What violates THAIRA's visual identity?
5. What can be improved without changing functionality?

Preserve working functionality unless explicitly instructed otherwise.

Make changes incrementally.

Do not introduce unrelated features.

---

# 29. CODE QUALITY

UI code must remain maintainable.

Avoid:

- Massive components
- Duplicated styles
- Hardcoded colors everywhere
- Hardcoded dimensions everywhere
- Repeated magic numbers
- Duplicate event handlers
- Unnecessary global state
- Unnecessary dependencies
- Temporary hacks left undocumented

Use centralized constants/design tokens for values that define the visual system.

Examples:

```text
COLORS
SPACING
BORDER_WIDTH
RADIUS
FONT_SIZES
ANIMATION_DURATION
UI_Z_INDEX
```

Use semantic names.

Prefer:

```text
COLOR_TEXT_PRIMARY
COLOR_PANEL_BACKGROUND
COLOR_ACCENT
```

over:

```text
#D8C27A
#171717
#5A3F2E
```

throughout individual components.

---

# 30. GAMEPLAY CODE VS UI CODE

Do not mix gameplay rules directly into visual components when avoidable.

For example:

Bad:

```text
InventoryButton directly modifies player statistics,
inventory state, UI state and save data.
```

Prefer:

```text
Inventory System
        ↓
Game State
        ↓
UI observes state
        ↓
UI triggers game actions
```

The UI should present and interact with game systems, not become the game system itself.

---

# 31. DEBUGGING

When fixing a bug:

1. Reproduce it.
2. Identify the actual cause.
3. Fix the smallest appropriate layer.
4. Verify that the fix does not break related systems.
5. Do not rewrite unrelated code.

Do not hide errors merely to make the UI appear functional.

Do not add defensive code everywhere without understanding the underlying problem.

---

# 32. VISUAL REVIEW

After implementing a significant interface, perform a visual review.

Evaluate:

### Composition
Does the screen have a clear focal point?

### Hierarchy
Can the player identify important information immediately?

### Consistency
Does it match existing THAIRA interfaces?

### Density
Is there too much or too little information?

### Authenticity
Does it look like a handcrafted RPG interface rather than a generic web UI?

### Function
Can the player understand what to do?

### Restraint
Are there unnecessary decorative effects?

If the UI fails any of these criteria, improve it before considering the task complete.

---

# 33. IMPORTANT IMPLEMENTATION RULE

Never assume that adding more visual effects improves the UI.

If uncertain between:

```text
More decoration
```

and:

```text
Better hierarchy
```

choose better hierarchy.

If uncertain between:

```text
New component
```

and:

```text
Reuse existing component
```

choose reuse.

If uncertain between:

```text
More animation
```

and:

```text
Faster interaction
```

choose faster interaction.

If uncertain between:

```text
More information
```

and:

```text
Better information hierarchy
```

choose better hierarchy.

---

# 34. FINAL RULE

THAIRA should feel like a game designed by one coherent art direction team.

Every screen, window, button, icon, tooltip, HUD element and menu must feel like it belongs to the same world.

The goal is not to make the UI impressive in isolation.

The goal is to make the entire game feel intentional.

When implementing anything new, ask:

> "Does this look like THAIRA?"

If not, change it.
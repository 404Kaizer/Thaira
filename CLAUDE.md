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
- **proposta_estruturas.html** — parede, cobertura e sombra de construção: o diagnóstico das duas câmeras, as medições, e as três perguntas em aberto (telhado × corte da parede sul).

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
- **Mutação de teste é reversível só se você CONFERIR que reverteu.** Validar régua por mutação exige mexer no fonte, e o restauro pode falhar calado: o `cp` de volta deu *permission denied* (o servidor de preview segurava o arquivo), a mutação ficou no script, e o comando seguinte **regravou o mapa do dono com uma casa que não existe**. Depois de restaurar, `grep` a mutação e confirme que sumiu — antes de rodar qualquer coisa que grave. O mesmo trava a escrita em `maps/`: se um `open` falhar com `UNKNOWN`/`EPERM`, pare o servidor antes de insistir.
- Quando algo sumir, **meça antes de concluir**: nas duas vezes em que parecia perda total, o carimbo dos arquivos mostrou onde o dado ainda estava. Anunciar perda que não houve custa tanto quanto a perda.

## Manter esta memória

Este arquivo entra no contexto de **toda** sessão; o tasks.html só quando alguém o abre. Por isso os dois têm trabalhos diferentes, e misturar arruína os dois — um CLAUDE.md inchado deixa de ser lido com atenção, e aí a regra que importa se perde no meio da história.

- **Aqui**: decisão que restringe trabalho futuro, regra de método, e onde as coisas moram. Curto.
- **No tasks.html**: o que foi feito, o que falta, medições, números e a história de cada correção.

O teste para saber onde vai: *isto muda **como** eu trabalho, ou registra **o que** aconteceu?* O primeiro vem para cá; o segundo vai para o tasks.html.

**Ao terminar qualquer trabalho, atualize os dois** — o tasks.html sempre, este arquivo quando surgir decisão ou regra nova. E regra que deixou de ser geral, **tire daqui**: este arquivo também encolhe.

**O que apodrece nos dois é previsível, e a auditoria de 2026-09-07 mediu as três famílias.** (1) *Contagem*: número de verificação, de linha de arquivo, de item, de instância no mapa — ninguém os reescreve ao mexer no código. (2) *Referência de linha*: `arquivo.js:NNN` em prosa é foto, e as nove que havia tinham escorregado, **nove de nove**, em três semanas. Cite o identificador, que é greppável; o número é enfeite que envelhece. (3) *Mecanismo removido cuja seção ficou lendo como presente* — e esta é a cara: cobertura, telhado, faixas de crista e face e `luzDaFrente` saíram do motor, e o texto que os introduziu continuava descrevendo-os no presente, convidando a próxima leva a **reconstruir o que o dono mandou tirar**. **Ao tirar um mecanismo do motor, volte e marque a seção que o trouxe** — no mesmo commit, não depois. E na fila: número de item é identidade, então **não repita um número** (havia dois #53), pela mesma razão que id de objeto não se troca.

## Decisões que não se re-discutem

Cada uma custou uma volta inteira de trabalho. Reabrir sem motivo novo é desperdício; o histórico de cada uma está no tasks.html.

- **O mundo é autoral, não gerado.** Mapa procedural não tem profundidade: o monstro está onde uma faixa de distância mandou, e nenhum lugar tem identidade. Autoral não significa desenhado à mão pelo dono — significa **decidido e congelado**.
- **Meça com a régua do jogo.** Medir com régua diferente é pior do que não medir: dá alarme falso, e o alarme falso esconde o verdadeiro. Já aconteceu três vezes — distância de cor medindo legibilidade quando eu queria identidade, componentes conexos com 4 vizinhos quando o jogo anda em 8, e a planta de cima julgando um lugar de andar. **Arte se julga no tamanho e na luz do jogo**: aprovar no 4× deixa passar o que não lê no 1×, e julgar tile de caverna em luz de meio-dia o deixa escuro demais para onde ele mora.
- **Piso de 192×192 para superfície.** Mapa menor lê grande na planta e minúsculo andando — Varrokgaard a 64² se atravessa em dez segundos, e foi por isso que ela caiu. A exceção é o lugar que **exige** ser pequeno (sistema de subsolo, gruta, sala), nunca o que ficou pequeno por descuido. A planta não mede distância percorrida; só andando se sabe.
- **Sombra é do MOTOR, não assada no sprite.** Elipse pálida pintada dentro do desenho entra no passe de luz junto com o objeto: escurece com ele à noite e para de separá-lo do chão — o objeto vira papel no chão. Quem prega no chão é o `dropShadow` (mancha de contato **mais** silhueta projetada, alfa seguindo o sol); o sprite só declara `cx` e `feet`. Cerca e escoramento ficam de fora porque correm em linha, e sombra projetada por tile num lance de cerca vira serrilha; parede fica de fora porque quem a prega no chão é o `edgeShadow` do vizinho. Fora essas duas, **objeto que está no mapa projeta sombra** — é o padrão, não uma opção da ficha, e sem ela a peça lê como PNG chapado em vez de coisa sólida. Vale também para a BANCADA: página de amostra que desenha o sprite sem chamar o `dropShadow` e o `outlined` do jogo mente sobre o resultado, e foi assim que a primeira versão da amostra de objetos pediu julgamento de adesivo colado no chão.
- **Objeto não é chão, e o mapa tem DUAS camadas.** `t` é o terreno (denso, um byte por tile) e `objs` é o que está em cima dele (esparso, com id, `span` e estado próprios). Objeto nunca carrega o chão embaixo de si — foi assim que o barril nasceu com `tex:'dirt'` e pintava terra em cima da palha, e ter as duas combinações exigiria um id por par. **Parede é objeto** (categoria `parede`), inclusive rochedo, parede de caverna e teia; chão continua terreno. Vários objetos por tile, e a ordem da lista é a ordem de desenho. `T.TREE`, `T.BARREL` e companhia continuam existindo como **vocabulário de autor** — o script pinta uma camada só e o `parteCamadas` desce para duas —, mas não são o que o motor carrega.
- **Objeto grande ocupa mais de um tile.** Um tile tem 32 px: poço, moinho, carroça e fonte desenhados dentro de um só serão sempre pequenos, por construção, e nenhum ajuste de desenho conserta isso. O objeto declara `span: [w, h]`, é UMA entrada com N endereços no índice, e só a âncora (canto noroeste) desenha. Antes de desenhar, pergunte **quantos tiles esta coisa ocupa no mundo**, não como encolhê-la para caber em um.
- **Quem desenha o mundo desenha as DUAS camadas.** Render, minimapa, planta PNG e página de amostra. Esquecer a segunda não dá erro: o mapa fica bonito e some justamente o que dá forma ao lugar — a vila lê como calçada lisa e a mata como campo aberto. Todo objeto declara `c`, a cor do material dele, e é ela que vai para a planta; rastro inteiro, nunca só a âncora.
- **Cor de material é constante própria, e isso vale contra o CHÃO em que a coisa se apoia.** O poço tinha pedra a distância 13 do `PAVE` sob ele e sumia dentro da calçada. Quando objeto e chão são do mesmo material, quem os separa é o objeto ser mais velho, mais molhado ou mais escuro — nunca a mesma cor em outro tom.
- **Bioma e geografia se estudam antes de desenhar.** Rio é **bacia**, não mancha: nasce em terreno alto, corre sempre para baixo, **recebe** afluente (nunca se divide), meandra no curso baixo e desemboca. Um tile solto de água no meio da mata é geologicamente impossível. E rio traz mata junto — a faixa da margem (mata-galeria) é mais densa que o entorno e forma o corredor por onde o bicho anda. Vila medieval **não tem grade**: as ruas emergem do uso, a igreja fica perto da estrada de entrada e não no centro do palco, e o padrão linear é o de aldeia feita por ordem de um senhor. Não construa bioma nem arquitetura no escuro.
- **Estrada sobre rio é ponte, e forma geométrica nunca cria terra.** As duas falham caladas: o `caminho` pinta terra sobre a água e o rio vira dique; o disco encostado na costa emenda no continente e engorda a silhueta sem desconectar nada, então a conferência passa verde. Guarde o leito e converta no fim; pinte região só onde já é terra.
- **Régua mede se o mapa FECHA, nunca se ele CONVENCE.** Varrokgaard II passou em todas — perímetro 679, terra 16.672, pescoço 7, planalto 280, alcançabilidade completa — e o dono reprovou tudo na primeira olhada: silhueta de ampulheta, anéis concêntricos, cabo pendurado. O defeito de método é anterior: cobrando justificativa (cada decisão com um motivo geológico) o time otimiza para o motivo, e o estreito nasceu como *argumento* — era o que fazia a Cerca Nova ser curta — e virou a coisa mais visível da ilha. **Quem julga forma é o olho, e o portão da amostra é o que o convoca**; ele pegou este erro antes de custar a troca do mapa. Corolário para toda conferência de alcançabilidade: **a pergunta é "dá para chegar neste LUGAR", não "este tile exato é chão"** — centro de hunt cai dentro de árvore, e cravar o tile acusou três lugares inalcançáveis que não eram. Procure o chão mais próximo em anéis e meça a distância dele.
- **A planta de cima não julga lugar de andar.** Ela diz se a topologia fecha e se há conteúdo inalcançável. Não diz nada sobre como é estar lá dentro — isso só se sabe jogando.
- **Um material, um significado.** Se parede, casa, mureta e pedra solta forem todas do mesmo tile, o mapa vira entulho e nada se distingue de nada.
- **Elenco fechado por terra, e não classe inteira.** Nem todo mapa precisa de toda classe, nem de uma classe inteira. **A ausência caracteriza tanto quanto a presença.**
- **Variante do mesmo material declara `familia`, e a régua de paleta vale entre famílias.** Exigir 60 de distância de cor entre duas gramas é medir identidade com a régua de legibilidade — grama de mata e de campo *têm* de se parecer; o que nunca pode se confundir é grama com pântano. E todo `tex` novo precisa de rotina em `TEX_DRAW` (reserva para quando o PNG não carregar) e de entrada em `TERRAIN_PRIO` (sem ela o tile some sob a borda de qualquer vizinho). Caractere novo entra no **fim** do `TILE_CHAR`: o índice é o id, e inserir no meio reescreve calado todo mapa já gravado. O alfabeto já passou do ASCII (94 imprimíveis, dois proibidos por serem aspa e barra em JSON) e entrou no Latin-1 — que serve porque é **um code unit em UTF-16**, então o mapa continua um caractere por tile. O teto seguinte é o fim do Latin-1; quando chegar, a escolha é dois caracteres por tile ou dicionário por mapa, e não se decide no meio de uma leva de arte.
- **Terreno de PNG entra por `assets/build_terreno.py`, e o tile de chão NÃO tem borda.** Folha gerada por IA é recortada, tem a borda serrilhada erodida, é costurada por cross-fade de transbordo e sai **96×96** em `assets/terreno/` — 96 porque é o `TEX_S`, e em 32 as nove células do `x%3,y%3` sairiam iguais e o chão viraria papel de parede. `TEX_PNG_MAP` no art.js diz qual `tex` usa qual PNG. Quem faz a transição entre dois terrenos é o `borderSprite`, nunca um contorno assado no tile — é assim no Tibia e é o que faz a grade sumir. Ao julgar costura, **compare a emenda com a distribuição de junções da FONTE**: contra a saída, o borrão do cross-fade abaixa a mediana e infla a razão sem nada ter piorado. **Folha nova traz o próprio enquadramento**: o miolo é reamostrado para o tamanho de trabalho (`normaliza`), nunca se baixa o `TRABALHO` para caber — a `costura` recorta em vez de reduzir, então TRABALHO menor mostra menos motivo AMPLIADO, que é o defeito da "pedra maior que o personagem" voltando pela porta dos fundos. E **só CHÃO passa por aqui**: objeto e parede ladrilhados viram papel de parede (uma parede de bocas de caverna, um bosque de pinheiros repetidos), e o caminho deles é outro — `span`, `cx`/`feet` e sombra do motor.

- **Escala de objeto de folha sai da LARGURA declarada por peça, nunca de uma régua global nem da altura.** Três voltas, e as duas primeiras erradas. (1) `PX_TILE` global saiu de medir a **árvore** da folha contra a árvore do jogo — comparar boneco com boneco, e as duas podiam estar erradas juntas: errou por **1,88×**, e em 89 o jogador não passava pela porta. A âncora é o que **gente construiu** (porta, arco, poço, fonte, cadeira concordaram em 47,3). (2) Nem constante nenhuma serve: o artista desenha tudo preenchendo a mesma célula, então a folha **comprime a faixa de tamanho** — o px que cada peça pede vai de 33 a 219. (3) Declarar a **altura** e aplicá-la sobre a extensão vertical do sprite é o erro sutil e o mais caro: em perspectiva essa extensão é altura **mais profundidade projetada**, e num objeto deitado quase tudo é profundidade — a cama saiu 0,58 × 0,85 tile, mais estreita *e* mais baixa que a pessoa que dorme nela. **A largura não sofre projeção**: largura na tela é largura no mundo. A ficha declara `w` em tiles, a altura sai proporcional, e o que se escreve é decisão de design auditável ("uma cama tem 1,3 tile de largura"), não um px mágico. O jogador é a unidade: **0,90 de largura, 1,50 de altura**. Corolário do recortador: ele **centraliza** a peça numa lona de `span × 32` (contrato que o render assume), então a largura do arquivo é a da LONA — medir por ela dá 96 px para metade do catálogo. A largura do desenho é o bloco de alfa não-zero.


- **Trocar procedural por arte de folha MANTÉM o id, e a reserva sai junto.** O mapa gravado guarda o **id** do objeto: criar `barril2` e aposentar `barril` apaga a peça de toda terra já desenhada. A ficha existente é que ganha `png`. E o `draw` procedural **não** fica como reserva quando o `span` muda para caber na arte nova — a carroça foi de 1 para 3 tiles, e um sprite de 32 px desenhado em `t * 3` sai esticado sem erro nenhum: **reserva que mente sobre o tamanho é pior que reserva nenhuma**. Corolário para toda régua da casa quando um caminho novo de desenho entra: as que perguntavam "tem `draw`?" passam a mentir, e uma delas estava cobrando a fórmula de altura que o próprio render já tinha abandonado — passava só porque o procedural ainda a satisfazia.

- **Arte que chega DEPOIS precisa avisar quem desenha uma vez só.** O jogo redesenha todo quadro e não nota; a paleta do editor é montada uma vez, e sem aviso ela mostra para sempre o fallback do primeiro instante — medido, as estátuas saíam como um quadrado de TERRA, o mesmo defeito das "quatorze entradas da paleta que não eram tile". `carregaTerrenos` já resolvia isso limpando cache; `objSprite` avisa por `_objPronto`, agrupado num quadro só. E o irmão que escondeu a causa: **a página que desenha precisa carregar o arquivo GERADO** (`objetos.js`) — sem ele o `objSprite` devolve `null` antes de tentar, e o cache fica vazio em vez de errado, que é o zero que aponta.

- **Limpeza de imagem se faz ONDE O DEFEITO SE MEDE, não onde ele nasce.** A franja de chroma que sobra no recorte de objeto foi despoluída primeiro no recorte cru, em resolução de folha, onde há mais vizinhança para escolher a cor certa: caiu de 544 px para 419, e o motivo é que o `reduz` é LANCZOS sobre premultiplicado e **remistura** a vizinhança — a franja renasce na reamostragem. Rodando depois do `encaixa`, na resolução final, 544 → 48. Vale para qualquer passo de limpeza que anteceda uma reamostragem. E o que separa resíduo de arte legítima ali **não é cor nem topologia** (o roxo de um orbe *é* magenta pela régua, e a franja é tão esparsa quanto ele): é a **cor de material** da peça, que o manifesto já calculava para a planta.

- **`span` é FOOTPRINT DE COLISÃO, e o recorte nunca apara a arte para caber nele.** O `encaixa` centraliza a peça numa lona de `span × 32` — contrato que o render assume, já que ele manda `t * span[0]` como largura de destino. Enquanto o span saiu de `round(largura/32)`, uma peça de 1,35 tile virava span 1 e a lona **comia 11 px dos lados**: 32 das 105 saíram mutiladas, a pior perdendo 29%, sem erro nenhum. É `ceil`, com `assert`. O preço do `ceil` sozinho também se mede: 53 peças passavam a reservar um tile que não usam, e uma coluna de 1,09 tile bloqueando dois tiles é errado no jogo — daí o `SNAP` de 15%, que encolhe em vez de subir de span (desvio máximo medido 9%, mediana 0,7%). **E a régua disso mede o DESENHO, não a lona**: a primeira versão cobrava `lona == span × 32` e passou verde ao devolver o `round`, porque a lona continua certinha e quem foi aparado é a arte. Por isso o manifesto grava `artW`. Mesma família de sempre — *qual linha do código a régua nunca faz rodar?* **E o `span` faz DUAS coisas**: a largura de desenho e o footprint de colisão. Para peça de topo largo e base estreita isso bloqueia o dobro — a placa de estrada reserva 2 tiles e encosta no chão com 0,28. Nove das 88 medidas assim; separar os dois papéis é decisão de estrutura, e enquanto ela não vem o teto está anotado.

- **Medida declarada de cabeça é chute, e em lote o chute erra um terço.** Declarei as 105 larguras da `objects_01` sem olhar e **29 estavam erradas** — o dono teve de reclamar duas vezes antes de eu parar de pedir que ele fosse o meu conferidor. O padrão do erro é sistemático e vale para a próxima folha: **o que é alto e estreito sai baixo demais** (poste, coluna, escada, placa, entrada de mina) e **o que é baixo e largo sai alto demais** (barril, caixote, potes, garrafa) — porque a largura "média" que se chuta ignora a razão de aspecto do desenho. O conserto não é chutar melhor: é montar a folha de contato com a **silhueta do jogador na mesma escala, em célula grande**, e auditar peça por peça antes de entregar. É a mesma ferramenta que pegou os onze nomes errados, e ela custa um script. Apontar erro em lote é trabalho do autor, não do dono.

- **Julgar no tamanho do jogo vale para saber O QUE A COISA É, não só se ela ficou boa.** Eu classifiquei 105 peças pela folha de contato miúda e errei **onze nomes**: uma árvore virou "arbusto" porque o tronco não aparece na miniatura, um tonel virou "balde", uma meda de feno virou "colmeia". Errar o nome é pior que errar o gosto — o nome decide categoria, colisão, escala e onde a peça vai parar no mapa. Anotação de arte se faz na bancada, no tamanho em que se joga.

- **Pergunte pelo PAPEL, não pela categoria — e o motor quase sempre já tem a pergunta pronta.** A pegada da sombra de prédio perguntava `paredeEm` (`cat === 'parede'`) e por isso deixava a PORTA de fora, que é `cat: 'objeto'`: cada vão virou um buraco na fachada com uma mancha de sombra dentro, e pisando nela o corpo a cobria — o sintoma que chega é *"a sombra some, como se fosse o chão"*. Quem responde "isto fecha o recinto?" é `salaDe === SALA_PAREDE`, que o `calcDentro` já calcula para parede, porta e o que entrar depois. Antes de escrever um predicado sobre categoria, procure o que o motor já usa para a mesma decisão.
- **Sombra projetada ESVAI da base para a ponta.** Alfa uniforme de ponta a ponta lê como um segundo objeto deitado no chão, não como sombra — e o sintoma que o dono relata é "o objeto parece flutuando". O degradê (`silhuetaFade`, `SOMBRA_PONTA = .15` na ponta, cheio no pé) vai no **cache**, nunca no quadro: são dezenas por quadro e ele não muda com o sol — quem muda com o sol é o comprimento e o alfa global. A mancha de **contato** fica de fora e continua lisa: desvanecer justo onde o objeto encosta desprende a peça do chão, que é o defeito que ela existe para evitar. Irmão disso, e a armadilha de bancada: **`altSolF` nasce em 0 e só o `drawWorld` a atualiza**, então qualquer página que desenhe sem rodar o quadro do jogo mostra a projetada no teto de 1,71 — sombra de poente ao meio-dia, em toda hora.

- **O patch tem DUAS camadas, e quem grava tem de gravar as duas.** O editor manda `{tiles, objs}`; por muito tempo os dois servidores escreveram só `tiles`, e toda edição de objeto morria ao gravar em silêncio — o `aplicaPatch` lia uma chave que nunca existiu no arquivo. Corolário de método: **formato de arquivo não mora dentro do handler HTTP**, senão não há como exercê-lo por teste, e foi por isso que o buraco durou. O formato é o `tools/patch_fmt.js` (e o gêmeo `serializa_patch` do serve.py), e o teste roda os dois e compara byte a byte — dois escritores que divergem fazem o arquivo depender de por onde se salvou. E **teste que procura menção não guarda comportamento**: a primeira versão varria o fonte atrás da palavra "objs" e passou verde numa mutação que trocava os dados por `{}` mantendo a palavra. Irmão disso, e a mordida seguinte: **régua que mede a função pura não guarda o render CHAMAR ela.** A régua do recorte de luz passou verde na mutação que tirava o `clip` do `lightPass` — porque media a função de recorte direto (`recorteDaLuz`). A régua tem de exercer o caminho inteiro e cobrar o que chegou na ponta.

- **`span` é DESENHO em todo lugar que ele aparece, e quem responde "quantos tiles" é o `pe` — inclusive fora do render.** Custou 1.238 árvores do mapa do dono. O `parteCamadas` descarta o rastro de objeto pintado em N tiles iguais (poço, moinho) lendo o `span`; com a árvore em `span: [2,1]` e `pe: [1,1]`, numa mata densa a vizinha a oeste ou ao norte também é árvore, então **toda árvore com vizinha foi descartada como rastro de outra** — 1712 viraram 474. Ao dar `span` a uma peça, procure **todos** os leitores desse campo, não só o que você acabou de escrever. E a régua disso conta **OBJETO, não caminho**: perder objeto deixa o mapa *mais* andável, então nenhuma conferência de alcançabilidade pega — foi por isso que o script gravou o mapa mutilado sem um aviso.
- **`drawImage` com NaN não desenha e não dá erro, e o sintoma é "some da tela mas a colisão fica".** Dei reserva ao `feet` (`peDo`) e esqueci o `cx`: `cercaSprite`, `escoraSprite`, `fogueiraSprite` e `pocoSprite` não declaram `cx`, e `-undefined * S` é NaN. A varredura que cobrava âncora finita olhava **um campo só**, e a suíte ficou verde com quatro peças invisíveis. Toda âncora precisa de reserva **e** de régua, e a régua cobra as duas coordenadas.
- **Objeto se ancora pelo `cx` DO SPRITE e pelo meio do FOOTPRINT, nunca pela borda da lona — e peça de folha passa pelo `outlined` como qualquer outra.** Um relato do dono, três defeitos, uma causa. Arte saindo em `sx` com largura `t·span[0]` põe o tronco na **borda direita** do tile âncora quando `pe` é menor que `span` (copa de 2, tronco de 1); a sombra, ancorada no mesmo lugar, some debaixo da copa; e sem `outlined` — que o ramo `deco` sempre chamou e o de folha nunca — a peça lê como *"papel balançando"*, sem a linha escura que a separa do chão. O resto do motor (deco, criatura, boneco) já ancorava por `cx`; era só o ramo de folha fora. **Corolário de régua:** errar o centro é **deslocamento solidário horizontal** — arte e sombra andam juntas —, então a coincidência entre elas passa verde. Irmão exato do caso vertical, e a resposta é a mesma: âncora externa, cravada no canto do tile, medida no pé (onde o cisalhamento do vento vale zero).
- **Recolorir arte mantém a LUMINOSIDADE; e régua cuja resposta muda com a ordem da suíte não guarda nada.** (1) Tingir por `source-in` chapa a peça numa silhueta de cor única e joga fora o desenho de dentro — o miolo escuro, as gotas claras, o escorrido —, que é o adesivo colado no chão de novo. `globalCompositeOperation = 'color'` toma matiz e saturação e preserva a luminosidade; o `destination-in` depois devolve o alfa, porque o `fillRect` cobre a lona inteira. (2) A régua do sangue mediu zero duas vezes por motivos de bancada, não de código: `fill()` não ia para a fita (elipse sai por `beginPath`+`fill`, nunca `fillRect`), e **outra régua já tinha plantado os sprites de folha**, então o caminho que ela media não era o que rodava. Régua que depende de qual outra rodou antes é régua que mente; cobre os dois caminhos explicitamente. (3) Quando o resultado não é mensurável headless — no node o `getImageData` devolve zeros —, cobre a **receita** e **anote o teto**: outra receita que preservasse luminosidade passaria, e quem julga é o olho no jogo.
- **Estado de bancada que sobrevive a uma régua contamina todas as seguintes, e o sintoma aparece longe da causa.** A régua do vento crava `DEV.nublado = 1`; o caminho de saída antecipada não restaurava, e o resto da suíte rodou com temporal permanente — duas réguas de clima passaram a acusar *"chove 100% do tempo"*, sem relação aparente com quem sujou. Restaure em **toda** saída, não só na feliz.
- **`span` é desenho, `pe` é colisão — e razão contra um canal some junto com o canal.** Duas coisas que a leva de árvore obrigou. (1) O `span` fazia os dois papéis, e a copa de 2 tiles com tronco de 1 forçou a separação que já estava anotada: `reindexObjs` indexa por `pe || span`, e sem isso as 1712 árvores do mapa passariam a bloquear o dobro, murando a terra sem nada acusar. Peça de topo largo e base estreita declara `pe`. (2) A guarda do `despolui` que protege o orbe violeta era `R > G·1.25 && B > G·1.25`: com o verde em zero **qualquer** canal passa, então todo o sangue (`#86020c`, G=2) caía na exceção e nunca era despoluído — 1.096 px de chroma. O que separa violeta de vermelho escuro é o azul valer perto do vermelho. **Razão contra um canal deixa de dizer qualquer coisa quando aquele canal vai a zero**; toda régua de cor precisa de um piso absoluto ou de uma comparação entre dois canais fortes.
- **A folha de contato é a régua de largura, e ela pula o pipeline — meça a SAÍDA.** Auditar peça a peça contra a silhueta do jogador é obrigatório (a folha comprime a faixa de tamanho, e uma largura só para uma família inteira erra), mas a página de contato desenha o RECORTE CRU: eu anunciei franja rosa em seis árvores e prometi consertá-la, e a saída real tinha franja zero. Julgue tamanho na folha de contato; julgue limpeza no arquivo gravado.
- **Régua de CONCORDÂNCIA não pega deslocamento solidário, e `feet` de peça de folha não é âncora.** Duas metades do mesmo tombo, e ele foi para a tela. (1) O `build_objetos.py` grava `'feet': peq.shape[0]` — o **fundo da lona** —, então `feet == h` nas 105 peças. "Alinhar o objeto pelo `feet` dele, como o jogador" soa certo e não alinha pé com pé: só sobe o desenho meia tile, e o dono viu na hora todo objeto flutuando acima do próprio tile. Antes de ancorar por um campo, **abra o arquivo gerado e veja o que ele guarda** — nome de campo não é contrato. (2) A régua que eu escrevi cobrava a arte e a sombra **concordarem**, e passou verde na mutação que moveu as duas juntas para o lugar errado. Concordância é relação; ela não tem como ver um deslocamento que preserva a relação. Toda régua de posição precisa de uma **âncora externa** — aqui, o canto do tile — além do alinhamento entre as partes.
- **Quem escolhe por CADEIA DE RAMOS obriga a régua a percorrer a MESMA cadeia, e cache derivado esquece junto com o pai.** Duas caras do mesmo descuido, e as duas passam verdes. (1) A `pedra` declarava `deco` e `png`, e o ramo `deco` do render vem antes — a arte de folha era morta em 70 tiles, e a régua não pegava porque ela consultava o `png` **primeiro**, ordem oposta à do render: duas ordens para a mesma pergunta é duas verdades, e a que manda é a do render. Espelhar a decisão em outro lugar é sempre isto; o certo é a régua **exercer** o caminho. (2) `carregaTerrenos` limpava `TEX_CACHE` e `FLOW_CACHE` e esquecia `BORDER_CACHE` e `WALL_CACHE`, que também nascem de `tileTexture` — a franja da junta e a parede congelavam com o procedural e saía muro metade PNG, metade de cada. Ao invalidar, pergunte **quem mais deriva daquilo**. E a invalidação **não mora dentro do `onload`**, pelo mesmo motivo que o formato de patch não mora no handler HTTP: lógica em callback não tem como ser exercida, e foi por isso que o buraco durou.
- **O mundo da BANCADA não é o mapa do jogo, e o caso pode não existir lá.** A suíte roda em mundo procedural, onde o andar de cima é sólido: toda parede sai `souCoberto`, logo conta como abrigada, logo `abrigado` e "faz parte da casa" dão a mesma resposta — medido, **5.804 paredes e 0 não-abrigadas**. A régua da sombra de prédio passou verde enquanto no jogo a sombra era **invisível**, e nenhuma mutação a derrubava porque a distinção que ela media não acontece na bancada. No mapa autoral o andar de cima é 99,98% VOID e a parede é `SALA_PAREDE`. Quando a régua depende de uma condição de mapa, **PLANTE o cenário** (a suíte já sabe: pinta tile, `reindexObjs(z)`, mede, restaura no `finally`) em vez de procurar um exemplo — e desconfie de toda régua que passou de primeira sem você ter visto o efeito no jogo.
- **Régua que só ÀS VEZES pega é pior que régua que não existe** — ela mente sobre estar guardando. Duas passaram verdes na mutação antes de guardarem alguma coisa, por motivos diferentes e os dois fáceis de repetir: uma cravava o cenário num ponto em que a grandeza medida ainda vinha do **relógio real** (o salto de fase do mato caía perto de um múltiplo de 2π em parte das execuções — o conserto foi escolher o céu em que `frente * .9` domina o piso senoidal, e aí o vento sai fixo); a outra exercitava só o **caso comum** e nunca a ressalva que o código tem (todas as asserções andavam de quadro em quadro, e o teto de `dt` só existe para o salto que a aba escondida devolve). Antes de dar régua por pronta, pergunte **de que ela depende que você não controla**, e **qual linha do código ela nunca faz rodar**. E a terceira irmã, da mesma família: **régua que compara contra a própria constante não mede nada** — `seco === NEVOA_PISO` passa verde na mutação que devolve o piso da bancada, porque ela move os dois lados da igualdade. Limite de régua é **número fixo**, tirado da medição.

- **Posição que sai de RELÓGIO × TAXA VARIÁVEL não acelera: teleporta.** `G.now * (.4 + ventoF * 1.6)` reposiciona tudo que já passou quando a taxa muda, num salto de `G.now × Δtaxa` — a nuvem saiu de 38,8 px/s para 908 na frente da tempestade, e a fase do mato de 2,07 rad/s para 45,8. A assinatura é traiçoeira porque o salto **cresce com o tempo de sessão**, então lê como "o jogo degrada" ou "vazamento de memória". O conserto é integrar (`deriva += dt * taxa`), com teto no `dt` (aba em segundo plano devolve segundos de uma vez, e é o mesmo teleporte por outra porta) e `dt` zero quando o relógio não andou (`resizeCam` e o editor desenham duas vezes no mesmo instante). Onde a taxa é **constante** — queda da gota, tremor da chama, escoamento da água — o padrão é seguro.

- **Para medir pixel, mate o `requestAnimationFrame` — congelar o relógio não basta.** `Date.now` fixo e `G.pausa` param a hora, o clima e a chama, mas o laço do jogo continua redesenhando **entre** o seu `drawWorld()` e o seu `getImageData`, e aí os dois lados do A/B leem o mesmo quadro: a medição dá **zero em tudo** e parece que o defeito não existe. Trocar `requestAnimationFrame` por um no-op durante a medição (e devolver depois) é o que fecha. Zero perfeito em todas as amostras é sintoma disto, não resultado — **e tem um irmão que dá a mesma assinatura**: contar o canal de COR quando o que se desenha é **preto sobre canvas vazio**. Sombra, máscara e silhueta saem em R=G=B=0 dos dois lados e só mexem no **alfa**; medindo o vermelho, um `dropShadow` que pintava 12.977 pixels mediu zero e eu quase fui consertar o lugar errado. Quando o alvo for escuro sobre transparente, o canal a contar é o quarto. O irmão disso, quando a medição é **pelo** intervalo de quadro: **aba em segundo plano estrangula o `rAF`** — ela não trava nem dá erro, sai lenta, e lentidão parece resultado. Bancada que mede tempo recusa rodar com `document.hidden` e invalida o número se a aba fugir no meio. E o irmão maior dos dois: **bancada de tempo sem CONTROLE não vale** — uma variante que não desliga nada tem de medir ~zero, senão a tabela é posição e não efeito. Três medições minhas seguidas "acharam o culpado" e o controle derrubou as três; uma delas provava que tirar a nuvem deixava o quadro 6× mais lento.

- **Classe de ESTADO não pode ter nome de classe de LAYOUT.** `.barra` era a barra de ferramentas e a marca de "barra o passo" ao mesmo tempo: os 20 tiles de `walk:false` herdavam `display:flex` e `padding:6px 12px`, e num quadradinho de 32 px isso deixa 8 px de largura. Não dá erro e nenhuma medição de cor pega — a amostra desenha o sprite certo, só espremida pela caixa. Há teste estrutural: as classes que mexem em caixa não podem ser penduradas por `classList.add`.

- **Na paleta do editor só entra o que se pinta de fato.** `T.TREE`, `T.BARREL` e os outros doze são vocabulário de autor para o script, e o `parteCamadas` os desce para objeto — na paleta de tile eles desenhavam o CHÃO deles (distância de cor zero contra grama e terra) e pintar com eles não mostrava nada, porque o mapa carregado já está partido. Quem põe árvore é o pincel de objeto.

- **Dois sistemas de coordenadas nunca se misturam, e eles coincidem até o dia em que não coincidem.** Já mordeu três vezes, sempre igual: o defeito é invisível no fonte porque as duas medidas têm o mesmo nome e a mesma unidade aparente. (1) *Pixel de CSS × pixel de buffer*: câmera, mouse e overlay trabalham em CSS, `canvas.width` é buffer — em tela sem HiDPI coincidem, e na do dono (`devicePixelRatio` 2) o "ver tudo" mostrava 46% do mapa e o arrasto do mapa andaria metade. Enquanto o canvas tem tamanho cravado o erro não existe; ao virar elástico, nasce. (2) *Coordenada de tela × coordenada do pai*: `clientX` é da viewport e `left` é do ancestral posicionado — arrastar janela saltava a distância das barras laterais no dia em que as janelas passaram a morar dentro do `#stage`. **Quando algo de enquadramento estiver errado só na máquina dele, ou só depois de mudar o pai de um elemento, é esta a primeira suspeita.** O conserto é sempre o mesmo: uma função pura que devolve os dois mundos e o fator entre eles (`escalaMapa`, `posicaoJanela`), com teste — conta que mora dentro de um handler de evento não tem como ser exercida.

- **Modal do jogo se ancora no `#stage`, não na página.** O meio da página não é o meio do jogo: as barras laterais e o console ocupam o resto, e uma janela centrada na página nasce torta. As `.win` são filhas do `#stage` e o `absolute` delas resolve sozinho — sem JS de layout. "Tela cheia" quer dizer **o palco inteiro**. Duas armadilhas de CSS que custaram uma volta cada: `inset` É o atalho de top/right/bottom/left, então `top:auto` escrito depois dele desfaz metade do que ele acabou de pôr; e `#id{width}` ganha de `.classe.classe{width}`, então tamanho que uma classe precisa sobrescrever mora em `:not(.classe)` em vez de brigar por especificidade. As `.screen` de entrada (escolher e criar personagem) ficam de fora: existem antes de haver palco.

- **Modal de tela cheia é `position: fixed` e cobre a JANELA INTEIRA.** As `.win` moram dentro do `#stage` (é o que centraliza as outras no jogo), então `absolute` as prenderia ao palco — mapa e talentos precisam somir com os painéis, a barra de ação e o console. O `z-index` fica **entre** o jogo (até 20) e o balão (60), que tem de continuar por cima porque é ele que descreve o que se está olhando.

- **Arte de fundo de painel: camada IRMÃ do conteúdo, nunca filha, e enquadramento por peça.** O zoom é um `transform` no conteúdo, e tudo dentro dele escala junto — a arte parada é uma questão de onde ela mora, não de uma propriedade a acertar. O escurecedor é uma **terceira** camada porque `filter: blur` desce para os filhos: véu dentro do fundo sai borrado e não segura a leitura. O enquadramento vertical é **tabela por vocação** (`VOC_FUNDO_Y`), porque retrato numa caixa larga mostra só uma faixa e o assunto de cada arte cai numa altura diferente — um número só serve a uma e corta as outras; a `transform-origin` acompanha o mesmo número. E os três valores (desfoque, opacidade, altura) saem de **olhar no jogo**: o primeiro chute de desfoque errou por seis vezes o valor final.

- **Painel de tela cheia não tem modo janela, e quem se move é o CONTEÚDO.** Mapa e árvore de talentos abrem sempre cheios; arrastar o cabeçalho deles não faz nada. Dois modos para o mesmo painel são duas caixas para acertar, e a segunda nunca tem dono — a árvore encolhida ficava com altura zero, porque o grafo já tinha perdido o `min-height` para não esconder a fileira de baixo atrás da rolagem. Num mapa e num grafo o gesto certo é câmera: arrastar o fundo move, roda dá zoom. O **piso de zoom é 1** e o limite de deslocamento no piso é **zero** — assim o clamp recentra sozinho e não é preciso botão de "voltar ao centro". Baixar o piso abaixo de 1 faz o conteúdo caber sobrando, o clamp para de recentrar, e ele some do meio da tela sem erro nenhum.

- **Nunca compense um deslocamento de RENDER dentro do DADO.** O `drawFloor` desenha o andar de cima deslocado na diagonal (o `dz` entra no X e no Y) — é a leitura de altura. Pintei o telhado um tile a sudeste para ele pousar em cima da casa na tela, e quebrei tudo que LÊ o dado: o `souCoberto` pergunta "há tile em z−1 NESTA coordenada?" e não sabe nada de deslocamento de desenho. Medido, o estrago de uma linha: `abrigado` virou verdadeiro numa faixa deslocada um tile da casa, o corte de 42% do telhado e a sombra de prédio vazaram para FORA pelo leste e pelo sul, a coluna oeste e a fileira norte do interior ficaram ACESAS, e o jogador clareava do lado errado da casa. **Três sintomas que chegam como coisas diferentes, um erro só.** Dado se pinta na coordenada da coisa; deslocamento de perspectiva é do render.
- **Elevação puramente VERTICAL não deixa lance norte-sul mostrar face, e a obliquidade se assa no SPRITE, não no mundo.** Quatro rodadas de amostra: a parede era uma face frontal de dois tiles e lia como *"chão na forma de parede"*; a máscara de 16 variantes não bastava porque o DESENHO era sempre o mesmo, então lance norte-sul saía como *"extensão direta da traseira"*; afinar a chapa não resolveu porque não era espessura. A causa é geométrica — levantando só na vertical, um lance leste-oeste mostra a face inteira e um norte-sul tem a face exatamente atrás do próprio topo, daí *"uma parede está mais grossa que a outra"*. A saída é a do Tibia, medida no sprite: o muro baixo de lá é uma **banda cisalhada 1 px por linha, oblíqua a 45°** — a base fica no tile e **nada mais no jogo se move** (boneco, árvore e as 105 peças de folha seguem subindo na vertical). A parede virou um PRISMA: uma faixa fina varrida da base ao topo, com as faces saindo da própria faixa, então elas têm a mesma espessura nos dois sentidos **por construção**, sem dois desenhos para divergirem. Corolário de render: o prisma preenche uma faixa fina dentro de uma lona de 58×58, então **o passe de luz recorta pela SILHUETA do sprite** — anunciar a lona tingia o chão em volta de toda parede, e nenhuma régua de geometria pega isso porque o retângulo continua no lugar certo.
- **A junta entre terrenos é uma FRANJA, e o que a conserta é a silhueta, não a profundidade.** O contorno (`rimMask`) é derivado da máscara: enquanto a máscara for um recuo liso da borda quadrada, ele traça fielmente a escada dos tiles — desenha a grade em vez de escondê-la. Tufe a silhueta e o contorno vem esfarrapado de graça. Duas travas medidas: a invasão **nunca passa de ~32% do tile** (a 56% os dois lados mais o canto cobrem quase o tile inteiro num degrau de um tile, e meio tile invadido lê como tile cheio — sai um quebra-cabeça de abas), e o ruído é **periódico em coordenada de mundo**, senão cada tile tem a própria franja e o degrau volta a cada 32 px. Máscara semeada só pela direção é grade por construção, qualquer que seja a mordida.

- **Cor gritante se mede por CROMA, não por saturação.** Saturação de HSL estoura em cor escura: quatro gramas oliva de luz 16–23% mediram 95–98% e a `grama_clara` que já estava no jogo passou a 83% só por ter azul 10 em vez de 1 — um pixel separando aprovado de reprovado é o sintoma. Croma (max−min) é a distância à linha dos cinzas e não explode no escuro: lava 0,81, verde neon 0,92, teto em 0,85. O **piso** continua em saturação, que é o que mede "cinza morto" de verdade.
- **MULTIPLY só subtrai, e por isso ambiente de céu não muda MATIZ.** A noite lia como verde escuro apesar de o céu já ser azul (`#39406b`): o passe de luz multiplica, e multiply escala cada canal para baixo — ele nunca acrescenta o que a arte não tem. Com o chão em B/G 0,17 e o céu em B/G 1,67, o produto dá 0,28 e o verde continua sendo o máximo. Quem muda a hora é `globalCompositeOperation = 'color'`, que toma matiz e saturação e PRESERVA a luminosidade: a noite fica azul sem clarear um pixel, e some sozinha de dia porque branco não tem matiz a impor. **E o LUGAR do passe é metade do conserto**: rodando no fim do quadro ele tinge a poça da tocha junto (medido: 4,2% de pixels quentes caindo para 0,2% com três tochas acesas) — antes do passe de luz, o halo quente multiplica por cima e come o azul de volta onde alcança. Irmão disso, para o lado claro: **exposição é GANHO, não clareamento** — o canvas somado a si mesmo em `lighter` dá `c + k·c` e multiplica (preto continua preto), enquanto um `fillRect` cinza em `lighter` soma uma constante e lava as sombras. E clarear o dia é **rampa**, não constante: a queixa era o escuro se gastar antes da noite, então o ganho zera com o céu na metade do brilho e a noite não é tocada. Corolário de rampa: **`escuro` sai do canal MÍNIMO**, então marca 0,69 no poente contra 0,78 da meia-noite e empata duas horas que não se parecem; para escalar efeito de hora, a régua é a luminância. E corolário de régua: **âncora de ordem se crava no CANVAS, não na cor** — a cor do ambiente sai 240 vezes no canvas do mundo antes do buffer de luz, e a primeira versão da régua reprovou o código certo por isso.

- **Corrigir viés de gerador não se ancora em OUTRA saída do mesmo gerador.** A grama saiu oliva (matiz 78° onde grama é ~100°), e o defeito é da FONTE: fonte 77,1° → PNG gravado 74,4°, Δ 2,7° — recorte, costura e reamostragem não tiram matiz. Ancorei o alvo da correção em `trees_01` (p50 89), que é arte já aprovada e no jogo — e por isso pareceu a régua certa. Mas `trees_01` é saída do mesmo gerador oliva: **ancorar nela limita o conserto ao próprio viés que se está consertando**. Quem decide é a escada renderizada a 1× (80/86/95/102) com o olho, e a referência externa que motivou o pedido. Dois irmãos medidos na mesma leva: **deslocamento proporcional à distância de um pivô empurra mais quem estava menos errado** (a grama mais oliva ficou boa, a menos oliva virou neon) — o certo é recentrar a mediana de cada peça no alvo; e **rotação de matiz não mexe em croma**, então "ficou gritante" pode não ser saturação nenhuma, e sim **dispersão entre variantes da mesma família**. Diagnosticar pela régua errada ali manda baixar saturação, que não era o problema.

- **Tileset feito à mão é forma, contorno e luz por objeto.** Ruído com tom sorteado por pixel lê como tinta jogada no chão. O que funciona é sempre a mesma receita: objeto discreto, paleta de poucos tons fixos (`_tons`), sombra de um lado e luz do outro, e a mesma direção de luz para todos. Luz por OBJETO costura entre tiles; luz assada no quadro inteiro é o que estraga tile. E o chão é calmo — a riqueza mora na junta entre terrenos e no que está em cima dele, não no chão ficar ocupado.
- **Descrição vira desenho literal.** Pedir "língua que afina para cima" produz um espeto. Para arte, o caminho é imagem de referência mais uma página de amostra onde o dono julga — nunca prosa.
- **Progressão visual é por KIT, não por peça.** Paperdoll literal seriam 238 itens equipáveis × 24 quadros registrados um sobre o outro — não é caro, é impossível. Sobe de degrau a arte INTEIRA (`VOC_SKINS` no data.js, uma entrada por degrau, e o **degrau 1 é o mesmo para todas as vocações** — `SKIN_PADRAO`, o Cidadão, porque em Varrokgaard não se tem vocação; folha montada pelo `build_criaturas.py` a partir de `assets/skins/voc_<vocação>/<skin>/`). Quem manda no degrau é o **conjunto vestido**, com a régua que o `SETS` já tem. O seletor em Opções escolhe entre isso e uma skin fixa, e mora no PERSONAGEM (`P.skin`) porque a lista depende da vocação. Só o **procedural** mostra a arma equipada; folha traz a arma desenhada dentro, e escolher skin é trocar detalhe por acabamento. Corolário do pipeline: **lado sem arte cai na frente, nunca em linha vazia** — célula transparente é boneco invisível ao virar, e não dá erro nenhum.
- **A LUZ É DA GPU, e o resto do render é 2D — e essa fronteira é a decisão.** O buffer de luz continua sendo um canvas 2D (só o ambiente do céu); o que a GPU produz é SÓ a mancha das fontes, somada com `lighter`. Trocar o renderer inteiro jogaria fora a fita `REC`, que é como toda a suíte mede — e foi ela que pegou cada defeito da leva de paredes. O que se ganha por pixel é o que o 2D não dá: distância, atenuação e uma marcha de oclusão pela grade de parede, então a luz PARA no muro e SAI pelo vão. Medido no tile da parede: 42 no disco 2D contra 21 com oclusão. **`luzGLTextura` devolve `null` sem WebGL, com o contexto perdido ou com o shader sem compilar, e o laço de discos assume** — mesma disciplina do `TEX_DRAW` ser reserva do PNG. A suíte roda no node, que não tem WebGL: ela exercita a RESERVA, e quem julga o caminho da GPU é o olho no jogo.
- **Recorte por tile é caro, e o preço é o NÚMERO DE RETÂNGULOS.** `clip` custa proporcional a eles, e o caminho do céu é recortado 4× por quadro (nuvem, relâmpago, chuva, tinte) enquanto o da luz é 2× **por fonte** (passe de luz e bloom). Junte os tiles vizinhos em CORRIDAS e devolva `null` quando não há o que recortar — em campo aberto o `clip` some inteiro. Medido: 348 → 19 na vila, 81 → 10 por campo de fogo. Dois sintomas denunciam isto e são fáceis de ler errado: *"o clima é o que mais pesa"* e *"mexer no zoom derruba o fps"* — o segundo porque a janela cresce ao afastar a câmera. E a régua disso é de **custo**, não de geometria: um retângulo por tile e um por corrida cobrem a mesma região, então nenhuma régua de cobertura separa as duas. **O que sobra depois disso é a inundação, e ela se cacheia**: alcance de luz não muda enquanto a parede não muda (254 inundações por quadro → 0). Guarde em coordenada de TILE, não de tela — senão cada passo do jogador joga o cache fora —, e cache derivado de parede precisa de **geração**: `geoMudou()`, chamado pelo `reindexObjs` **e pelo `usaPorta`**, porque abrir o vão muda o que a luz alcança. Cache sem invalidação é defeito calado. E ao tirar a janela do laço, **devolva o teto do raio**: sem ele `l.r / t` com tile pequeno varre o mapa inteiro por luz, e a suíte trava.
- **Cobertura por tile: a MÁSCARA vem primeiro, o alfa depois.** Pintar um retângulo por tile já com alfa desenha uma grade — os retângulos se sobrepõem (folga de um pixel, arredondamento de posição) e **alfa sobreposto SOMA**: duas passadas de 42% dão 66% na faixa comum. Medido: 62 níveis de diferença entre o miolo e a quina do tile. O certo é a máscara opaca num canvas à parte (preto sobre preto continua preto) e o alfa uma vez só, no `drawImage`. Vale para qualquer coisa desenhada tile a tile com transparência. **E modo de composição vale para o CANVAS INTEIRO, não para o que se está pintando**: um laço de `fillRect` em `destination-in` não recorta tile a tile — cada retângulo apaga tudo fora dele, e sobra a interseção, que é o último. Sintoma: o efeito mede zero em tudo. Monte a máscara inteira em `source-over` e recorte uma vez.
- **O oclusor da luz é a SILHUETA do que foi desenhado, e ela leva só a BANDA DE BAIXO.** A grade de um bit por tile não tinha barril, caixote nem árvore — a tocha os atravessava como pintura no chão. A silhueta sai do mesmo blit que põe a peça na tela (dois laços divergiriam), e o shader lê o **alfa**, sem passe de conversão. Mas mandar a peça INTEIRA é o erro que a bancada não pega quando a cena é rua: a **copa** de uma árvore passa muito acima de uma tocha na mão e não pode sombrear o chão ao lado do tronco — medido, numa mata **87,3% da tela virava oclusor** e o efeito sumia justamente onde devia aparecer. Um tile a partir do chão: 87,3% → 45,9%. Recorte pela janela de ORIGEM do `drawImage`, nunca por `clip` — são centenas por quadro.
- **Bancada não substitui o jogo: ela responde a pergunta que a CENA DELA contém.** A do oclusor tinha rua com barril e caixote, peças que cabem inteiras numa tile, e por isso aprovou a silhueta cheia. A mata derrubou no primeiro quadro. Ao aprovar um modelo na bancada, pergunte **qual caso do mapa não está na cena** antes de levá-lo — e meça no jogo assim que chegar.
- **Resposta BINÁRIA em grade de tile sai QUADRADA, e o sintoma é "muito pixelado" ou "cada parede reflete separadamente".** A marcha de oclusão devolvia `0.` ou `1.` amostrando uma textura `NEAREST`: um tile aceso, o vizinho preto, nada entre os dois — e num lance de muro cada parede recebia a própria luz, como se não fossem um conjunto. O conserto é somar a **espessura atravessada** (textura `LINEAR`, `exp(-espessura × k)`), com o passo da marcha na conta, senão a mesma parede veda mais de longe. Vale para qualquer coisa que pergunte à grade e responda sim/não.
- **Arte que transborda o footprint sai DEPOIS da fileira, como a verga da porta.** `span[0] > pe[0]` quer dizer que o desenho cobre tile em que se PISA — a copa da árvore passa meio tile para cada lado do tronco. Desenhada com os objetos da fileira, quem pisa embaixo é desenhado depois e cobre a copa que está acima da própria cabeça ("em alguns tiles a árvore fica por trás do player"). A **sombra não vai junto**: ela é chão. Cama e carroça têm `span == pe` e continuam saindo debaixo de quem passa.
- **`abrigado` é SÓ ter piso por cima, e casa não cobre nada.** A cobertura de casa saiu do motor a pedido do dono, depois de muitas rodadas. Enquanto `dentroDeCasa` entrava no `abrigado`, todo recinto de parede era tratado como coberto **sem ter telhado nenhum** — e todo efeito de céu tinha de ser recortado na quina do tile em volta dele, que é a borda que nunca lê como luz nem como sombra. Sem telhado no mapa, chove dentro de casa como chove na rua; quem é abrigado tem PISO por cima, e aí a cobertura é fato do mapa e não inferência.
- **Chuva na parede se decide pela SUPERFÍCIE QUE O PIXEL MOSTRA, não pelo chão do tile.** Dois relatos opostos, uma regra: a arte da parede cobre dois tiles (o dela e o de cima) e, como só existe um sprite, a face desenhada é sempre a **virada para o sul**. Parede com interior ao sul mostra a face de dentro (não chove); com rua ao sul mostra a fachada (chove); o tile de cima **herda a resposta da parede que o cobre**, senão a fachada sai molhada embaixo e seca em cima. É o `ceuNoTile`.
- **Faixa clara no topo da parede: procure o BANHO no sprite antes do passe de luz.** Depois de tirar o `topoNaLuz` a faixa continuou, porque a chapa do `wallSprite` levava `rgba(255,246,225,.30)` — 2,6× a face, e sob o ambiente da hora isso é uma faixa pálida quase rosa em toda parede do mapa. Sem o banho: 1,24×. **Lavar com branco desatura o material** e é a mesma família do "recolorir mantém a luminosidade".
- **A parede TRANSBORDA um tile para cima, e todo efeito de céu é decidido pelo tile em que o PIXEL cai.** A arte sai de `sy - WALL_TOP` e a verga da porta vai para o mesmo lugar, então o tile ao norte de um muro é **rua no dado** — e chuva, névoa e tinte da hora (os três pelo mesmo `recorteCeu`) caíam nele e pousavam em cima da parede: de dentro da casa lê como chuva atravessando o muro. Quem fecha isso é o `ceuNoTile`: parede cuja vizinha ao sul é interior mostra a face de dentro e não toma chuva, com fachada ao sul toma, e o tile de cima **herda a resposta da parede que o cobre** — senão a fachada sai molhada embaixo e seca em cima. Rochedo solto no campo continua tomando chuva na crista. É o irmão da regra da crista: **toda máscara por tile de parede acerta o tile de CIMA**.
- **Cobertura pintada por RETÂNGULO DE TILE não vira luz, e desfoque não conserta.** O corte de luz do telhado e a silhueta da casa nasciam os dois da mesma `pegadaAbrigo`; foram removidos do motor a pedido do dono depois de rodadas de conserto que pioravam o resto. A borda de uma máscara de tile é a **quina do tile**, e é isso que faz o corte ler como adesivo. Quando a cobertura voltar, volta como **termo** de quem já calcula luz por pixel — nunca como camada por cima, e **dentro do buffer de luz, antes dos halos**: um multiply à parte deixa a tocha inútil lá dentro, porque dois multiplies se acumulam e nada os desfaz. Pelo mesmo motivo o passe de luz **roda ao meio-dia também** — o gate é `luzes.length`, não a hora, senão a tocha e a fogueira param de acender justo na hora em que só elas separam dentro de fora.
- **"Dentro" é o que as PAREDES fecham, não o que tem telhado.** `souCoberto` pergunta se há piso em z−1 e responde NÃO para o interior de toda casa de um pavimento — foi assim que a sala de uma casa recebeu a mesma luz do céu que a rua. Quem responde é `dentroDeCasa`, uma inundação a partir da borda do mapa (4 vizinhos, senão escapa pela diagonal de uma quina; porta conta como parede, aberta ou fechada; uma vez por andar, invalidada pelo `reindexObjs`). **Mas `abrigado()` NÃO é a soma dos dois** — a cobertura de casa saiu do motor a pedido do dono, e hoje ele é só `souCoberto`. `dentroDeCasa` continua vivo e é quem a chuva, a poça e o recorte de céu perguntam, sob o nome `daCasa`.
- **Luz de superfície não se pinta por RETÂNGULO DE TILE, e a guarda por tile é o que a denuncia.** As faixas de crista e face saíram do motor: eram o único lugar que pintava um retângulo de tile, opaco, com a cor do céu, em cima de pixel de PAREDE — e no tile de CIMA, porque a arte transborda um tile. A guarda (`!abrigado(x, y-1)`) valia por tile, então o mesmo lance de muro saía com uns tiles banhados de céu e outros não: **faixas verticais claras e escuras ao longo da mesma parede**, relatadas três vezes com palavras diferentes ("cada parede reflete separadamente", "efeitos de fora afetando", "continua"). Quem desenha o volume é o **sprite**: chapa clara no topo, face escurecida pela profundidade, quina viva entre as duas. Irmã da regra da cobertura, e o mesmo caminho de volta: como termo de quem calcula luz por pixel, nunca como camada por cima.
- **Sintoma igual não é causa igual, e a conta separa as duas em um minuto.** Eu apontei essas faixas como culpadas de uma banda CLARA e LILÁS numa captura noturna — e o `luzDaFrente` da época só ESCURECIA (noite 57,64,107 → 54,57,76; meio-dia 255,240,210 → 218,212,199; ele saiu do motor junto com as faixas, e não está mais no fonte). Era passe de céu caindo no tile que a parede ocupa, causa completamente outra. Antes de consertar o suspeito, **pergunte se ele pode sequer produzir o sinal** que se está vendo: direção (clareia ou escurece?), cor e tamanho eliminam metade dos suspeitos sem abrir o jogo.

- **O que corre em linha pergunta aos VIZINHOS, e um booleano nunca basta.** Parede, cerca e escoramento sofreram do mesmo defeito por motivos diferentes: a cerca recebia "corre na horizontal?" e por isso não tinha quina (as duas variantes são lances retos), e a parede não recebia nada, então repetia a chapa iluminada a cada tile e um muro vertical lia como blocos empilhados. A régua é máscara de 4 bits do vizinho **do mesmo material** (1 N · 2 S · 4 O · 8 L): 16 variantes saem da mesma composição, e a crista só aparece onde o lance acaba. Sintoma para reconhecer: **a direção horizontal parece certa e a vertical não** — é sinal de que a peça se repete sem perguntar quem está em volta.
- **A escada de tamanho tem cinco degraus e o jogador é a unidade.** 0,5 miudeza · 1 mobília · 1,5 gente · 2 o que gente atravessa (porta, parede, árvore, poste) · 2,5 o que domina gente. É a régua do Tibia: passos inteiros, nada no meio. E **altura de objeto vem do SPRITE**, não de constante — enquanto o render espremia todo objeto solto em `CERCA_H`, o poste não podia ser mais alto que o barril por construção.
- **Escala de personagem se mede contra o que GENTE CONSTRUIU, não contra outra criatura.** O jogador saiu 1,37 tile — mais baixo que a cerca da fazenda (1,44) e do mesmo tamanho que um minotauro. Comparar boneco com boneco não acusa: os dois podem estar errados juntos. Cerca, muro e porta é que dizem quanto mede uma pessoa. `P_SZ` (**1,08**, que dá 1,50 tile) vale nos TRÊS lugares onde o jogador é desenhado — folha, procedural e corpo —, senão trocar de skin ou morrer muda a altura dele.
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
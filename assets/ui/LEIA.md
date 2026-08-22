# Texturas de UI — o que gerar

Esta pasta fica **fora** de `assets/skins/`, então `build_skins.py` não mexe
nela: nada aqui é ícone de item. São texturas que o CSS consome direto.

**Leia a paleta antes.** Os tokens já estão no `:root` do `index.html` e o HUD
já roda neles. A textura entra por cima do que já existe — ela não define a cor,
ela quebra a lisura. Se você gerar arte com cor própria, ela vai brigar com a
paleta em vez de somar.

```
--ink       #060605   atrás de tudo
--well      #080706   furo: slot, campo de texto, poço do log
--surface0  #0d0c0a   pedra: chão da sidebar, moldura externa
--surface1  #15130f   couro: corpo de painel
--surface2  #221e17   saliente: cabeçalho, botão, aba ativa
--line      #3b3227   fio sutil
--line2     #5a4c33   fio de destaque
```

Cinco degraus dentro de uma faixa estreita. A hierarquia sai de "esta chapa está
8 pontos mais clara que a vizinha", não de contraste — é o que faz o chrome
sumir e deixar só o mundo e os ícones saturados na tela.

---

## Regras que valem para os três arquivos

- PNG, RGBA. **Sem anti-aliasing suave nas bordas duras** — o resto do jogo é
  pixel art, e textura borrada briga com os sprites (§18).
- **Quase sem cor própria.** Gere em cinza e deixe o tom para o CSS: a textura
  entra multiplicada sobre a superfície. Se ela vier marrom pronta, some o
  controle da paleta e cada painel vira um marrom diferente — que é exatamente o
  defeito que a gente acabou de tirar do CSS.
- Amplitude baixa: variação de valor entre 4% e 10%. Se a textura chama atenção
  sozinha, está errada (§4: textura é subordinada à leitura).
- Sem brilho especular, sem reflexo colorido, sem gradiente de estúdio, sem
  vinheta embutida (a vinheta é do jogo, não do ladrilho).

---

## 1. `leather_dark.png` — superfície de painel

**128×128, tileável nos quatro lados (seamless).**

Couro velho e escuro. Poro visível de perto, invisível de longe. Alguma marca de
uso — vinco, esfoladura rasa — mas **nada** que o olho consiga identificar como
"aquela marca ali". Vai repetir dezenas de vezes na coluna lateral; qualquer
elemento característico vira papel de parede na terceira repetição.

Teste antes de mandar: cole quatro cópias lado a lado. Se aparecer costura, ou
se você conseguir contar os ladrilhos, ainda não está pronta.

## 2. `stone_dark.png` — moldura externa

**128×128, tileável nos quatro lados (seamless).**

Pedra quase preta, granulada. Sem veio marcado, sem bloco desenhado, sem junta
de argamassa — é superfície de pedra, não parede de pedra. Grão mais grosso que
o do couro, para as duas se distinguirem mesmo com a mesma cor: é a **diferença
de grão** que vai dizer "moldura" e "conteúdo", já que a diferença de tom entre
`--surface0` e `--surface1` é de só 8 pontos.

## 3. `grain.png` — grão geral

**64×64, tileável. Ruído monocromático, alfa baixo.**

Vai por cima de tudo, inclusive das outras duas, para que nenhuma superfície
fique matematicamente lisa. É o detalhe que separa "interface feita à mão" de
"dark mode de site" — e é o mais barato dos três.

Ruído fino, granulometria de 1 a 2px, sem direção. Alfa médio em torno de 6%.

---

## O que NÃO gerar por enquanto

**Moldura e slot.** Com a paleta certa, chanfro e furo saem em CSS sem arquivo
nenhum, e já estão saindo. Só vale desenhar moldura depois que essas três
estiverem na tela e a gente vir o que ainda falta — provavelmente cantoneira de
canto, e aí é um 9-fatias, não um ladrilho.

**Madeira.** Madeira em THAIRA é objeto da ficção, não chrome: balcão da loja,
quadro de contratos, fundo de pergaminho. Quando chegar a hora dessas telas, a
gente pede a peça específica, não um ladrilho genérico.

---

## A armadilha que a arte precisa respeitar

Os ícones de item também são escuros — couro, madeira, osso. Ícone escuro em
painel escuro mata a silhueta.

Por isso `--well` é a coisa mais escura da tela, e **o slot não recebe textura
nenhuma**: ele é um furo liso e preto. Qualquer ladrilho aplicado ali reduz o
contraste justamente onde a leitura importa mais. Se em algum momento você
gerar uma textura "de slot", ela não vai entrar.

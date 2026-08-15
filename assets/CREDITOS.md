# Áudio — procedência e licença

**Tudo aqui é CC0** (domínio público). Nenhum arquivo exige atribuição, então o
jogo não precisa de tela de créditos. Este arquivo existe para provar a origem
caso alguém pergunte, e para saber onde buscar mais do mesmo.

Nada de CC-BY foi usado, mesmo estando autorizado: deu para cobrir tudo com CC0
e assim o projeto fica sem nenhuma amarra de licença.

## Efeitos — `assets/sfx/`

Montados por `assets/build_sfx.py`, que recorta e renomeia a partir dos pacotes
abaixo. O mapa de qual arquivo vira qual som está no topo do script.

| Pacote | Origem | Licença | Usado em |
|---|---|---|---|
| Kenney *Impact Sounds* | kenney.nl/assets/impact-sounds | CC0 | impacto, defesa, passos, gelo |
| Kenney *RPG Audio* | kenney.nl/assets/rpg-audio | CC0 | machado, roupa, escada, passos de terra |
| Kenney *Interface Sounds* | kenney.nl/assets/interface-sounds | CC0 | erro |
| Kenney *UI Audio* | kenney.nl/assets/ui-audio | CC0 | — (reserva) |
| Kenney *Music Jingles* | kenney.nl/assets/music-jingles | CC0 | nível, perícia, morte |
| Kenney *Casino Audio* | kenney.nl/assets/casino-audio | CC0 | — (reserva) |
| *80 CC0 RPG SFX* | opengameart.org/content/80-cc0-rpg-sfx | CC0 | lâmina, magia, gema, criatura |
| *Cure Magic* | opengameart.org/content/cure-magic | CC0 | cura, magia sagrada |
| *202 More Sound Effects* | opengameart.org/content/202-more-sound-effects | CC0 | — (reserva) |

### Freesound — arquivos avulsos

Baixados por `tools/freesound.py`, que só busca com filtro `license:"Creative
Commons 0"`. São *previews* mp3 (~128 kbps), não o arquivo original — o original
exigiria OAuth2, e para efeito de meio segundo a diferença não aparece.

O id é o que torna isto reprodutível: `python tools/freesound.py baixa <som>
<ids…>` refaz a pasta inteira do zero. A página de cada um é
`freesound.org/s/<id>/`.

| Som | ids (na ordem das variações) | Autores |
|---|---|---|
| `eat` | 521253, 723600, 723601, 457475 | maugusto_sfx, R1nkata ×2, princessemilu |
| `potion` | 574077, 445970, 534336 | ValentinPetiteau, Breviceps, Defaultv |
| `loot` | 493211, 493213, 493205, 493202 | Joao_Janz |
| `coin` | 336573, 336569, 336570, 336567 | Anthousai |
| `ui_click` | 333430, 333429, 333427 | brandondelehoy (série *UI Series*) |
| `ui_close` | 584183 | unfa |

## Trilha — `assets/music/`

Lista por ambiente em `assets/music/manifest.json`. As faixas se encadeiam: uma
acaba, a próxima entra por passagem cruzada, em ordem embaralhada.

| Arquivo | Origem (opengameart.org/content/…) | Licença |
|---|---|---|
| dia-taverna.mp3 | medieval-the-old-tower-inn | CC0 |
| dia-bardo.mp3 | medieval-the-bards-tale | CC0 |
| dia-exploracao.mp3 | medieval-exploration | CC0 |
| dia-colheita.mp3 | medieval-harvest-season | CC0 |
| dia-mercado.mp3 | medieval-market-day | CC0 |
| noite-espreita.ogg | night-prowler | CC0 |
| noite-floresta.mp3 | dark-forest-theme | CC0 |
| caverna-eco.ogg | cave-theme | CC0 |
| caverna-masmorra.ogg | dungeon-ambience | CC0 |
| caverna-templo.mp3 | into-the-ruined-temple | CC0 |
| abismo-caverna.ogg | dark-cavern-ambient | CC0 |

## Como trocar um som

1. Ponha o arquivo novo em `assets/sfx/` com o nome do evento (`hit.ogg`,
   `hit-2.ogg`, … para variações).
2. Ajuste `n` e `v` na entrada correspondente de `assets/sfx/manifest.json`.

Para refazer o pacote inteiro a partir das fontes, edite o mapa em
`assets/build_sfx.py` e rode `python assets/build_sfx.py <pasta-das-fontes>`.

Trilha: basta soltar o arquivo em `assets/music/` e citá-lo na lista do ambiente
em `assets/music/manifest.json`. Extensão vai no nome, então ogg e mp3 convivem.
